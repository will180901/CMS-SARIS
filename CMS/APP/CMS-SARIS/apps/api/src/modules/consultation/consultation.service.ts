/**
 * ConsultationService — Module 7 · Consultation & Actes Prescrits — CMS SARIS
 *
 * Gère : ouverture consultation, examen clinique, diagnostics,
 *        ordonnances, clôture, annulation.
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationService } from '../notification/notification.service'
import {
  assertPeutPrescrire,
  type PrescriptionScope,
} from '../../common/prescription'
import { assertPrestationCouverte } from '../../common/droits-categorie'
import { calculerDateReprise } from '../../common/repos'
import { consultationCascadeDeleteOps } from './consultation-cascade.util'
import {
  CreateConsultationDto,
  UpdateExamenCliniqueDto,
  AddDiagnosticDto,
  UpdateConclusionDto,
  CloturerConsultationDto,
  AnnulerConsultationDto,
  CreateOrdonnanceDto,
  AddLigneOrdonnanceDto,
  ConsultationQueryDto,
  UpdateReposDto,
  UpdateOrdonnanceDto,
} from './dto/consultation.dto'

// ── Statuts ───────────────────────────────────────────────────────────────────

type StatutConsultation = 'OUVERTE' | 'CLOTUREE' | 'ANNULEE'
const ETATS_TERMINAUX: StatutConsultation[] = ['CLOTUREE', 'ANNULEE']

// ── Includes Prisma ───────────────────────────────────────────────────────────

const PERSONNEL_SELECT = {
  id: true,
  nom: true,
  prenom: true,
  matricule: true,
  role: true,
} as const

const VISITE_RESUME = {
  id: true,
  dateOuverture: true,
  notesAccueil: true,
  patient: {
    select: {
      id: true,
      numeroPatient: true,
      identite: {
        select: { nom: true, prenom: true, dateNaissance: true, sexe: true },
      },
      categoriePatient: { select: { id: true, code: true, libelle: true } },
      allergies: {
        where: { statut: 'ACTIVE' },
        select: { id: true, substance: true, gravite: true },
      },
      alertesMedicales: {
        where: { statut: 'ACTIVE' },
        select: { id: true, type: true, message: true, gravite: true },
      },
    },
  },
  motifPrincipal: { select: { id: true, code: true, libelle: true } },
  constantes: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  site: { select: { libelle: true } },
} as const

const DIAGNOSTIC_INCLUDE = {
  pathologie: {
    select: { id: true, code: true, libelle: true, chronique: true },
  },
} as const

const LIGNE_INCLUDE = {
  medicament: {
    select: { id: true, nomGenerique: true, nomCommercial: true },
  },
  typeExamen: {
    select: { id: true, code: true, libelle: true, domaine: true },
  },
} as const

const CONSULTATION_LIST_INCLUDE = {
  visite: { select: VISITE_RESUME },
  typeConsultation: { select: { id: true, code: true, libelle: true } },
  _count: {
    select: { diagnostics: true, ordonnances: { where: { deletedAt: null } } },
  },
} as const

const CONSULTATION_DETAIL_INCLUDE = {
  visite: { select: VISITE_RESUME },
  typeConsultation: { select: { id: true, code: true, libelle: true } },
  diagnostics: { include: DIAGNOSTIC_INCLUDE, orderBy: { id: 'asc' as const } },
  ordonnances: {
    where: { deletedAt: null },
    include: {
      lignes: { where: { deletedAt: null }, include: LIGNE_INCLUDE },
      // Bon(s) actif(s) déjà générés depuis cette ordonnance — pilote le bouton « Générer un
      // bon » côté web (déjà généré vs disponible), cf. OrdonnanceDetail (packages/types).
      bonsExamen: {
        where: { deletedAt: null, statut: { not: 'ANNULE' } },
        select: { id: true },
      },
      bonsPharmacie: {
        where: { deletedAt: null, statut: { not: 'ANNULE' } },
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  // Présence des sorties critiques / suivi 1-1 + compteurs 1-N (badges d'onglets).
  // Les compteurs filtrent les tombstones (soft-delete) pour ne pas sur-compter.
  evacuation: { select: { id: true, statut: true } },
  suiviTraitement: { select: { id: true, statut: true } },
  _count: {
    select: {
      diagnostics: true,
      ordonnances: { where: { deletedAt: null } },
      bonsExamen: { where: { deletedAt: null } },
      bonsPharmacie: { where: { deletedAt: null } },
      certificats: { where: { deletedAt: null } },
    },
  },
} as const

// ── Service ───────────────────────────────────────────────────────────────────

export interface PatientDocumentItem {
  id: string
  type: 'ORDONNANCE' | 'BON_EXAMEN' | 'BON_PHARMACIE' | 'EVACUATION'
  consultationId: string
  date: Date
  statut: string
  titre: string
  details: string
  motif: string
  /** Site où l'acte a été réalisé (repère continuité multi-site). */
  site: string | null
}

@Injectable()
export class ConsultationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notif: NotificationService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async getOrThrow(id: string) {
    const c = await this.prisma.consultation.findUnique({ where: { id } })
    if (!c) throw new NotFoundException('Consultation introuvable')
    return c
  }

  private assertModifiable(statut: string) {
    if (ETATS_TERMINAUX.includes(statut as StatutConsultation)) {
      throw new ConflictException(
        `Cette consultation est ${statut === 'CLOTUREE' ? 'clôturée' : 'annulée'} et ne peut plus être modifiée`,
      )
    }
  }

  /**
   * Charge une consultation et garantit qu'elle est MODIFIABLE par `userId` :
   * refuse (409) si elle est dans un état terminal OU tenue (verrou souple) par un
   * AUTRE soignant. Pour reprendre la main, l'appelant doit d'abord `prendreEnCharge`.
   * C'est ce qui empêche deux soignants d'écraser le même acte (last-write-wins).
   */
  private async assertEditable(id: string, userId: string) {
    const c = await this.getOrThrow(id)
    this.assertModifiable(c.statut)
    if (c.pickedUpById && c.pickedUpById !== userId) {
      const holder = await this.resolvePriseEnCharge(
        c.pickedUpById,
        c.pickedUpAt,
      )
      throw new ConflictException({
        message: `Consultation en cours de modification par ${holder?.nom ?? 'un autre soignant'} — reprenez la main pour la modifier.`,
        code: 'LOCKED_BY_OTHER',
        pickedUpById: c.pickedUpById,
      })
    }
    return c
  }

  private async attachSoignants<T extends { soignantId: string }>(
    consultations: T[],
  ) {
    const ids = [...new Set(consultations.map((c) => c.soignantId))]
    if (!ids.length) return consultations.map((c) => ({ ...c, soignant: null }))

    const personnel = await this.prisma.personnelMedical.findMany({
      where: { id: { in: ids } },
      select: PERSONNEL_SELECT,
    })
    const map = new Map(personnel.map((p) => [p.id, p]))
    return consultations.map((c) => ({
      ...c,
      soignant: map.get(c.soignantId) ?? null,
    }))
  }

  // ── Liste consultations ──────────────────────────────────────────────────

  async findAll(
    query: ConsultationQueryDto,
    scope?: {
      canReadAll: boolean
      personnelMedicalId: string | null
      canViewLocked?: boolean
      restreindreHistorique?: boolean
    },
  ) {
    // Multi-site sans restriction : la file de consultation est partagée entre les deux
    // sites (comme le dossier patient centralisé) — seules les permissions/la confidentialité
    // médecin gouvernent l'accès (cf. bloc `scope` ci-dessous).
    const isPatientDossier = !!query.patientId
    const where: any = { visite: {} }

    if (!isPatientDossier && scope && !scope.canReadAll) {
      // Confidentialité : un médecin ne voit QUE les consultations qui LUI sont
      // assignées ; seule la supervision (canReadAll) voit toutes celles du site.
      where.soignantId = scope.personnelMedicalId ?? '__aucun_soignant__'
    }

    if (isPatientDossier) {
      // Verrou de confidentialité (médecin-chef) : même règle que findPatientDocuments —
      // dossier verrouillé + appelant non-supervision → liste vide.
      if (!scope?.canViewLocked) {
        const p = await this.prisma.patient.findUnique({
          where: { id: query.patientId },
          select: { verrouille: true },
        })
        if (p?.verrouille) return []
      }
      where.visite = { ...where.visite, patientId: query.patientId }
    }

    // Filtre statut
    if (isPatientDossier && scope?.restreindreHistorique) {
      // Confidentialité (recueil §5) : l'infirmier consultant l'historique d'un patient
      // n'a accès qu'à la consultation EN COURS, jamais aux consultations passées.
      where.statut = 'OUVERTE'
    } else if (query.statut === 'TOUTES') {
      // pas de filtre statut
    } else if (!query.statut || query.statut === 'ACTIVES') {
      where.statut = 'OUVERTE'
    } else {
      where.statut = query.statut
    }

    const consultations = await this.prisma.consultation.findMany({
      where,
      include: CONSULTATION_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })

    return this.attachSoignants(consultations)
  }

  // ── Détail consultation ──────────────────────────────────────────────────

  /**
   * Volontairement SANS filtre `siteId` : ouvrir une consultation par id doit marcher
   * depuis le dossier patient CENTRALISÉ (Chronologie/Documents), qui montre déjà des
   * consultations/documents des deux sites — sinon cliquer sur un document d'un autre
   * site que celui actif renvoyait « Consultation introuvable ».
   */
  /**
   * `scope.canReadOrdonnances` — les ordonnances voyagent DANS le détail de la
   * consultation (pas de route de lecture dédiée). Sans cette prise en compte,
   * `ordonnance.read` serait une permission décorative : toute personne pouvant
   * ouvrir une consultation verrait forcément ses prescriptions. On retire donc
   * les ordonnances de la charge utile quand le droit manque — c'est ce qui rend
   * possible « voir la consultation sans voir les prescriptions ».
   */
  async findById(
    id: string,
    scope?: {
      canReadAll: boolean
      personnelMedicalId: string | null
      canReadOrdonnances?: boolean
    },
  ) {
    const where: any = { id }
    // Confidentialité : un soignant non-superviseur ne peut ouvrir QUE ses propres
    // consultations (cohérent avec findAll qui filtre déjà la liste — un id deviné ne suffit pas).
    if (scope && !scope.canReadAll) {
      where.soignantId = scope.personnelMedicalId ?? '__aucun_soignant__'
    }
    const consultation = await this.prisma.consultation.findFirst({
      where,
      include: CONSULTATION_DETAIL_INCLUDE,
    })
    if (!consultation) throw new NotFoundException('Consultation introuvable')

    const soignant = await this.prisma.personnelMedical.findUnique({
      where: { id: consultation.soignantId },
      select: PERSONNEL_SELECT,
    })

    // Détenteur du verrou souple (qui a la consultation en main)
    const priseEnCharge = await this.resolvePriseEnCharge(
      consultation.pickedUpById,
      consultation.pickedUpAt,
    )

    // Retrait des prescriptions si le droit de lecture correspondant manque.
    // `undefined` = appelant interne qui n'exprime pas de portée → on n'ampute rien.
    const ordonnances =
      scope?.canReadOrdonnances === false ? [] : consultation.ordonnances

    return { ...consultation, ordonnances, soignant, priseEnCharge }
  }

  /** Résout le nom affichable de l'utilisateur qui a la consultation en main. */
  private async resolvePriseEnCharge(userId: string | null, at: Date | null) {
    if (!userId) return null
    const u = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: {
        id: true,
        login: true,
        personnelMedical: { select: { nom: true, prenom: true } },
      },
    })
    const nom = u?.personnelMedical
      ? `${u.personnelMedical.prenom} ${u.personnelMedical.nom}`
      : (u?.login ?? 'Utilisateur')
    return { userId, nom, at }
  }

  /** Verrou souple : marque la consultation comme prise en main par l'utilisateur. */
  async prendreEnCharge(id: string, userId: string) {
    const c = await this.getOrThrow(id)
    this.assertModifiable(c.statut)
    await this.prisma.consultation.update({
      where: { id },
      data: { pickedUpById: userId, pickedUpAt: new Date() },
    })
    return this.findById(id)
  }

  // ── Documents générés d'un patient (dossier → onglet Documents) ────────────
  // Agrège tous les actes documentaires de toutes les consultations du patient :
  // ordonnances, bons d'examen, bons de pharmacie, évacuations.
  async findPatientDocuments(
    patientId: string,
    scope?: {
      restrictToOwn: boolean
      personnelMedicalId: string | null
      canViewLocked?: boolean
      canViewEvacuations?: boolean
      restreindreHistorique?: boolean
    },
  ) {
    // Verrou de confidentialité (médecin-chef) : dossier verrouillé + appelant non-supervision
    // → aucun document (cohérent avec patient.findById qui dépouille le dossier).
    if (!scope?.canViewLocked) {
      const p = await this.prisma.patient.findUnique({
        where: { id: patientId },
        select: { verrouille: true },
      })
      if (p?.verrouille) return []
    }
    // Confidentialité : un médecin restreint ne voit les documents que d'un patient
    // qu'il SUIT (relation clinique), comme pour l'accès au dossier (patient.findById).
    if (scope?.restrictToOwn) {
      const soignantId = scope.personnelMedicalId ?? '__aucun_soignant__'
      const [conso, visite] = await Promise.all([
        this.prisma.consultation.findFirst({
          where: { soignantId, visite: { patientId } },
          select: { id: true },
        }),
        this.prisma.visite.findFirst({
          where: { soignantId, patientId },
          select: { id: true },
        }),
      ])
      if (!conso && !visite) {
        throw new ForbiddenException(
          "Accès refusé : vous n'êtes pas le médecin de ce patient",
        )
      }
    }
    const consultations = await this.prisma.consultation.findMany({
      // dossier centralisé : tous les documents du patient (tous sites) — sauf pour
      // l'infirmier restreint (recueil §5), limité aux documents de la consultation en cours.
      where: scope?.restreindreHistorique
        ? { visite: { patientId }, statut: 'OUVERTE' }
        : { visite: { patientId } },
      orderBy: { createdAt: 'desc' },
      include: {
        visite: {
          select: {
            id: true,
            dateOuverture: true,
            motifPrincipal: { select: { libelle: true } },
            site: { select: { libelle: true } },
          },
        },
        ordonnances: {
          where: { deletedAt: null },
          include: {
            lignes: { where: { deletedAt: null }, include: LIGNE_INCLUDE },
          },
        },
        bonsExamen: {
          where: { deletedAt: null },
          include: {
            lignes: { include: { typeExamen: { select: { libelle: true } } } },
            resultats: { where: { deletedAt: null } },
          },
        },
        bonsPharmacie: {
          where: { deletedAt: null },
          include: { lignes: true },
        },
        evacuation: {
          select: {
            id: true,
            niveauUrgence: true,
            statut: true,
            createdAt: true,
          },
        },
      },
    })

    const docs: PatientDocumentItem[] = []
    for (const c of consultations) {
      const motif = c.visite.motifPrincipal?.libelle ?? '—'
      const site = c.visite.site?.libelle ?? null // repère « soigné à … » (continuité multi-site)
      for (const o of c.ordonnances) {
        docs.push({
          id: o.id,
          type: 'ORDONNANCE',
          consultationId: c.id,
          date: o.createdAt,
          statut: o.statut,
          titre: 'Ordonnance',
          details: `${o.lignes.length} médicament${o.lignes.length > 1 ? 's' : ''}`,
          motif,
          site,
        })
      }
      for (const b of c.bonsExamen) {
        const examens = b.lignes.map((l) => l.typeExamen.libelle).join(', ')
        docs.push({
          id: b.id,
          type: 'BON_EXAMEN',
          consultationId: c.id,
          date: b.createdAt,
          statut: b.statut,
          titre: "Bon d'examen",
          details: examens + (b.resultats.length ? ' · résultat reçu' : ''),
          motif,
          site,
        })
      }
      for (const bp of c.bonsPharmacie) {
        const n = bp.lignes.length
        docs.push({
          id: bp.id,
          type: 'BON_PHARMACIE',
          consultationId: c.id,
          date: bp.createdAt,
          statut: bp.statut,
          titre: 'Bon de pharmacie',
          details: `${n} médicament${n > 1 ? 's' : ''}`,
          motif,
          site,
        })
      }
      // N'expose les fiches d'évacuation que si l'appelant a evacuation.read — sinon un
      // rôle sans aucun droit sur le module Évacuations (ex. INFIRMIER) verrait leur existence
      // et leur niveau d'urgence dans le dossier patient, puis un onglet cassé au clic.
      if (
        scope?.canViewEvacuations &&
        c.evacuation &&
        c.evacuation.statut !== 'ANNULE'
      ) {
        docs.push({
          id: c.evacuation.id,
          type: 'EVACUATION',
          consultationId: c.id,
          date: c.evacuation.createdAt,
          statut: c.evacuation.statut,
          titre: "Fiche d'évacuation",
          details: `Urgence : ${c.evacuation.niveauUrgence}`,
          motif,
          site,
        })
      }
    }
    docs.sort((a, b) => b.date.getTime() - a.date.getTime())
    return docs
  }

  // ── Ouvrir une consultation ──────────────────────────────────────────────

  async create(dto: CreateConsultationDto, acteurUserId: string) {
    // Vérifier la visite — multi-site sans restriction : n'importe quel soignant
    // autorisé peut ouvrir une consultation sur une visite de n'importe quel site.
    const visite = await this.prisma.visite.findUnique({
      where: { id: dto.visiteId },
    })
    if (!visite) throw new NotFoundException('Visite introuvable')
    if (visite.statut !== 'EN_COURS') {
      throw new ConflictException(
        'Seule une visite EN_COURS peut avoir une consultation ouverte',
      )
    }

    // Le soignant de la consultation = soignant assigné à la visite (ou override via DTO)
    // Note : req.user.id est un Utilisateur.id, pas un PersonnelMedical.id — ne pas l'utiliser ici
    const soignantId = dto.soignantId ?? visite.soignantId
    if (!soignantId) {
      throw new BadRequestException(
        "Aucun soignant assigné à cette visite — assigner un soignant dans le triage avant d'ouvrir une consultation",
      )
    }

    // Vérifier le soignant
    const soignant = await this.prisma.personnelMedical.findUnique({
      where: { id: soignantId },
    })
    if (!soignant) throw new NotFoundException('Soignant introuvable')
    if (soignant.statut !== 'ACTIF')
      throw new ConflictException('Soignant inactif')

    // Un soignant ne peut avoir qu'une seule consultation OUVERTE à la fois (miroir de la
    // règle « une seule visite EN_COURS » côté triage).
    const soignantOccupe = await this.prisma.consultation.findFirst({
      where: { soignantId, statut: 'OUVERTE' },
      select: {
        id: true,
        visite: { select: { patient: { select: { numeroPatient: true } } } },
      },
    })
    if (soignantOccupe) {
      throw new ConflictException(
        `Ce soignant a déjà une consultation ouverte (patient ${soignantOccupe.visite.patient.numeroPatient}) — clôturez-la avant d'en ouvrir une nouvelle`,
      )
    }

    // Pas de consultation ouverte en double
    const existing = await this.prisma.consultation.findFirst({
      where: { visiteId: dto.visiteId, statut: 'OUVERTE' },
    })
    if (existing) {
      throw new ConflictException({
        message: 'Cette visite a déjà une consultation ouverte',
        existingConsultationId: existing.id,
      })
    }

    // Envoi en consultation = FIN du triage : la VISITE est CLÔTURÉE immédiatement
    // (AVEC_CONSULTATION) et quitte les deux zones du triage. La consultation prend
    // le relais. Si elle est ensuite ANNULÉE, la visite est REMISE EN FILE (cf. annuler()).
    const consultation = await this.prisma.$transaction(async (tx) => {
      const c = await tx.consultation.create({
        data: {
          visiteId: dto.visiteId,
          soignantId,
          typeConsultationId: dto.typeConsultationId ?? null,
        },
        include: CONSULTATION_DETAIL_INCLUDE,
      })
      await tx.visite.update({
        where: { id: dto.visiteId },
        data: {
          statut: 'CLOTUREE',
          typeCloture: 'AVEC_CONSULTATION',
          dateCloture: new Date(),
        },
      })
      return c
    })

    // Notification CIBLÉE au médecin assigné (et non plus diffusion à tout le site).
    const medecinUser = await this.prisma.utilisateur.findFirst({
      where: { personnelMedicalId: soignantId },
      select: { id: true },
    })
    await this.notif.emit({
      type: 'CONSULTATION_OUVERTE',
      niveau: 'INFO',
      category: 'clinique',
      titre: 'Consultation en attente',
      message:
        'Un nouveau dossier vous a été affecté — consultation en attente',
      destinataireId: medecinUser?.id ?? null,
      siteId: null,
      // Repli en diffusion globale (tous sites) si le médecin n'a pas de compte lié.
      requiredPermission: medecinUser ? null : 'consultation.read',
      entiteType: 'consultation',
      entiteId: consultation.id,
      lien: '/consultations',
      createdById: acteurUserId,
    })

    return { ...consultation, soignant }
  }

  // ── Examen clinique ──────────────────────────────────────────────────────

  async updateExamen(id: string, dto: UpdateExamenCliniqueDto, userId: string) {
    await this.assertEditable(id, userId)

    return this.prisma.consultation.update({
      where: { id },
      // Chaque champ n'est modifié QUE si fourni (undefined = inchangé) — permet un
      // appel dédié à l'anamnèse sans effacer le texte libre `examenClinique`, et
      // réciproquement. `null` explicite efface toujours le champ (comportement existant).
      data: {
        ...(dto.examenClinique !== undefined && {
          examenClinique: dto.examenClinique?.trim() || null,
        }),
        // Anamnèse structurée (recueil §3.2)
        ...(dto.anamneseDateDebut !== undefined && {
          anamneseDateDebut: dto.anamneseDateDebut
            ? new Date(dto.anamneseDateDebut)
            : null,
        }),
        ...(dto.anamneseDuree !== undefined && {
          anamneseDuree: dto.anamneseDuree?.trim() || null,
        }),
        ...(dto.anamneseModeDebut !== undefined && {
          anamneseModeDebut: dto.anamneseModeDebut?.trim() || null,
        }),
        ...(dto.anamneseSymptomes !== undefined && {
          anamneseSymptomes: dto.anamneseSymptomes?.trim() || null,
        }),
      },
    })
  }

  // ── Conclusion ───────────────────────────────────────────────────────────

  async updateConclusion(id: string, dto: UpdateConclusionDto, userId: string) {
    await this.assertEditable(id, userId)

    return this.prisma.consultation.update({
      where: { id },
      data: { conclusion: dto.conclusion?.trim() || null },
    })
  }

  // ── Diagnostics ──────────────────────────────────────────────────────────

  async addDiagnostic(id: string, dto: AddDiagnosticDto, userId: string) {
    await this.assertEditable(id, userId)

    const pathologie = await this.prisma.pathologieReference.findUnique({
      where: { id: dto.pathologieId },
    })
    if (!pathologie) throw new NotFoundException('Pathologie introuvable')
    if (pathologie.statut !== 'ACTIVE')
      throw new ConflictException('Pathologie inactive')

    // PRINCIPAL : une seule par consultation
    if (dto.type === 'PRINCIPAL') {
      const existingPrincipal =
        await this.prisma.diagnosticConsultation.findFirst({
          where: { consultationId: id, type: 'PRINCIPAL' },
        })
      if (existingPrincipal) {
        throw new ConflictException(
          "Un diagnostic principal existe déjà — retirez-le avant d'en ajouter un nouveau",
        )
      }
    }

    // Pas de doublon sur la même pathologie
    const doublon = await this.prisma.diagnosticConsultation.findFirst({
      where: { consultationId: id, pathologieId: dto.pathologieId },
    })
    if (doublon)
      throw new ConflictException(
        'Cette pathologie est déjà dans les diagnostics',
      )

    return this.prisma.diagnosticConsultation.create({
      data: {
        consultationId: id,
        pathologieId: dto.pathologieId,
        type: dto.type,
        certitude: dto.certitude,
      },
      include: DIAGNOSTIC_INCLUDE,
    })
  }

  async removeDiagnostic(
    consultationId: string,
    diagId: string,
    userId: string,
  ) {
    await this.assertEditable(consultationId, userId)

    const diag = await this.prisma.diagnosticConsultation.findUnique({
      where: { id: diagId },
    })
    if (!diag || diag.consultationId !== consultationId) {
      throw new NotFoundException('Diagnostic introuvable')
    }

    return this.prisma.diagnosticConsultation.delete({ where: { id: diagId } })
  }

  // ── Clôturer ─────────────────────────────────────────────────────────────

  // ── Type de consultation ──────────────────────────────────────────────────

  async setType(id: string, typeConsultationId: string | null, userId: string) {
    await this.assertEditable(id, userId)
    if (typeConsultationId) {
      const t = await this.prisma.typeConsultation.findUnique({
        where: { id: typeConsultationId },
      })
      if (!t) throw new NotFoundException('Type de consultation introuvable')
    }
    return this.prisma.consultation.update({
      where: { id },
      data: { typeConsultationId },
      include: CONSULTATION_DETAIL_INCLUDE,
    })
  }

  // ── Repos maladie (PEC supplémentaire) ─────────────────────────────────────

  async setRepos(id: string, dto: UpdateReposDto, userId: string) {
    const c = await this.assertEditable(id, userId)
    const dateReprise =
      dto.reposJours != null
        ? calculerDateReprise(
            c.createdAt,
            dto.reposJours,
            dto.reposInclutJour ?? false,
          )
        : null
    return this.prisma.consultation.update({
      where: { id },
      data: {
        reposJours: dto.reposJours ?? null,
        reposInclutJour: dto.reposInclutJour ?? false,
        dateReprise,
      },
      include: CONSULTATION_DETAIL_INCLUDE,
    })
  }

  async cloturer(id: string, dto: CloturerConsultationDto, userId: string) {
    const c = await this.assertEditable(id, userId)

    // Validation métier : au moins un diagnostic obligatoire
    const nbDiagnostics = await this.prisma.diagnosticConsultation.count({
      where: { consultationId: id },
    })
    if (nbDiagnostics === 0) {
      throw new BadRequestException(
        'Au moins un diagnostic est requis avant de clôturer la consultation',
      )
    }

    // Le type de consultation alimente les statistiques (type × pathologie × catégorie,
    // cœur du modèle Jeannette) → obligatoire avant la clôture.
    if (!c.typeConsultationId) {
      throw new BadRequestException(
        'Le type de consultation est requis avant de clôturer',
      )
    }

    // Validation métier : cohérence décision médicale ↔ document produit. La fiche
    // (évacuation/suivi) est désormais générée AVANT ce clic, depuis l'étape Décision — ces
    // contrôles ne font donc que confirmer qu'elle existe bel et bien, pas la déclencher.
    // Absence de décision (voie normale, cas dominant) : aucune validation supplémentaire,
    // comportement intentionnel (diagnostics + type déjà vérifiés ci-dessus suffisent).
    if (dto.decisionMedicale === 'EVACUATION') {
      // Une évacuation ANNULÉE ne compte pas (= inexistante) : il faut une fiche active.
      const n = await this.prisma.evacuation.count({
        where: { consultationId: id, statut: { not: 'ANNULE' } },
      })
      if (n === 0)
        throw new BadRequestException(
          "Décision « Évacuation médicale » : créez la fiche d'évacuation avant de clôturer",
        )
    }
    if (dto.decisionMedicale === 'SUIVI_TRAITEMENT') {
      // Un suivi ANNULÉ ne compte pas (= inexistant) : il faut un épisode actif.
      const n = await this.prisma.suiviTraitement.count({
        where: { consultationId: id, statut: { not: 'ANNULE' } },
      })
      if (n === 0)
        throw new BadRequestException(
          'Décision « Suivi de traitement » : ouvrez le suivi avant de clôturer',
        )
    }

    // Clôture atomique : consultation CLÔTURÉE + visite associée clôturée
    // (AVEC_CONSULTATION). La visite n'est fermée qu'ici (plus à la création).
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.consultation.update({
        where: { id },
        data: {
          statut: 'CLOTUREE',
          decisionMedicale: dto.decisionMedicale,
          conclusion: dto.conclusion?.trim() || null,
          closedAt: new Date(),
        },
        include: CONSULTATION_DETAIL_INCLUDE,
      })
      await tx.visite.update({
        where: { id: c.visiteId },
        data: {
          statut: 'CLOTUREE',
          typeCloture: 'AVEC_CONSULTATION',
          dateCloture: new Date(),
        },
      })
      return updated
    })

    await this.notif.emit({
      type: 'CONSULTATION_CLOTUREE',
      niveau: 'SUCCES',
      category: 'clinique',
      titre: 'Consultation clôturée',
      message: `Décision : ${(dto.decisionMedicale ?? '—').replace(/_/g, ' ').toLowerCase()}`,
      siteId: null,
      requiredPermission: 'consultation.read',
      entiteType: 'consultation',
      entiteId: id,
      lien: '/consultations',
      createdById: userId,
      concernedPersonnelIds: result.soignantId ? [result.soignantId] : [],
    })

    return result
  }

  // ── Annuler ───────────────────────────────────────────────────────────────

  async annuler(id: string, dto: AnnulerConsultationDto, userId: string) {
    const c = await this.assertEditable(id, userId)

    // Annulation APRÈS envoi : la consultation est annulée ET la visite est REMISE
    // EN FILE (rouverte EN_ATTENTE, clôture triage effacée) — on ne perd jamais le
    // patient, le triage peut le ré-orienter. (Décision produit validée.)
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.consultation.update({
        where: { id },
        data: {
          statut: 'ANNULEE',
          motifAnnulation: dto.motifAnnulation,
          closedAt: new Date(),
        },
      })
      await tx.visite.update({
        where: { id: c.visiteId },
        data: { statut: 'EN_ATTENTE', typeCloture: null, dateCloture: null },
      })
      return updated
    })
  }

  // ── Suppression définitive (consultation.delete) ─────────────────────────
  /**
   * Supprime DÉFINITIVEMENT une consultation CLÔTURÉE ou ANNULÉE — jamais une
   * consultation encore OUVERTE (il faut d'abord la clôturer ou l'annuler).
   * Purge en cascade tous ses documents (ordonnance, bons, évacuation, accident,
   * suivi, prénatale, certificats, diagnostics) — réservée à `consultation.delete`.
   * L'appelant (contrôleur) doit avoir présenté à l'utilisateur un écran de
   * confirmation listant ce qui va être détruit AVANT d'appeler cette méthode.
   */
  async delete(id: string) {
    const c = await this.prisma.consultation.findUnique({ where: { id } })
    if (!c) throw new NotFoundException('Consultation introuvable')
    if (c.statut === 'OUVERTE') {
      throw new ConflictException(
        'Clôturez ou annulez la consultation avant de la supprimer',
      )
    }
    // Suppression réellement DÉFINITIVE : passe par le client BRUT (`this.prisma.raw`) pour
    // contourner l'extension soft-delete — sinon Consultation/Ordonnance/BonExamen/… (tous
    // dans l'allow-list) deviendraient de simples tombstones (update deletedAt) au lieu
    // d'être vraiment effacés, contredisant la purge « irréversible » voulue ici.
    await this.prisma.raw.$transaction([
      ...consultationCascadeDeleteOps(this.prisma.raw, id),
      this.prisma.raw.consultation.delete({ where: { id } }),
    ])
    return { deleted: true }
  }

  // ── Ordonnance — créer ────────────────────────────────────────────────────

  async createOrdonnance(
    consultationId: string,
    prescripteurUserId: string,
    dto: CreateOrdonnanceDto,
    scope: PrescriptionScope,
  ) {
    const c = await this.assertEditable(consultationId, prescripteurUserId)

    if (
      dto.typeOrdonnance === 'PRESCRIPTION_EXAMEN' &&
      !dto.indicationClinik?.trim()
    ) {
      throw new BadRequestException(
        "Indication clinique requise pour une prescription d'examen",
      )
    }

    // Droit de prescrire (recueil) : médecin chef libre, infirmier seulement si délégué.
    // Retourne l'id de la délégation active (traçabilité) ou null.
    const delegationId = await assertPeutPrescrire(this.prisma, scope)

    // Résolution prescripteur : le JWT donne Utilisateur.id → on remonte au PersonnelMedical lié.
    const prescripteurPersonnelId = await this.resolvePrescripteur(
      prescripteurUserId,
      c,
    )

    return this.prisma.ordonnance.create({
      data: {
        consultationId,
        prescripteurId: prescripteurPersonnelId,
        statut: 'BROUILLON',
        delegationId,
        typeOrdonnance: dto.typeOrdonnance,
        indicationClinik:
          dto.typeOrdonnance === 'PRESCRIPTION_EXAMEN'
            ? dto.indicationClinik?.trim() || null
            : null,
        etablissementId: dto.etablissementId ?? null,
      },
      include: { lignes: { include: LIGNE_INCLUDE } },
    })
  }

  /**
   * Résout l'identité PersonnelMedical du prescripteur à partir de Utilisateur.id (JWT).
   * Fallback : si l'utilisateur n'est pas lié à un personnel, on utilise le soignant
   * de la consultation. Sinon → erreur claire.
   */
  private async resolvePrescripteur(
    userId: string,
    consultation: { soignantId: string },
  ): Promise<string> {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: { personnelMedicalId: true },
    })
    if (user?.personnelMedicalId) return user.personnelMedicalId
    // Fallback compat ascendante : soignant de la consultation
    return consultation.soignantId
  }

  // Prescription gardée par `assertPeutPrescrire` (common/prescription) : le médecin chef
  // prescrit librement, l'infirmier seulement avec une délégation active (règle du recueil).

  // ── Ordonnance — ajouter ligne ────────────────────────────────────────────

  async addLigneOrdonnance(
    consultationId: string,
    ordonnanceId: string,
    dto: AddLigneOrdonnanceDto,
    userId: string,
    scope: PrescriptionScope,
    acknowledgeWarnings = false,
  ) {
    const c = await this.assertEditable(consultationId, userId)
    // Droit de prescrire (recueil) : infirmier uniquement si délégation active.
    await assertPeutPrescrire(this.prisma, scope)

    const ordonnance = await this.prisma.ordonnance.findUnique({
      where: { id: ordonnanceId },
    })
    if (!ordonnance || ordonnance.consultationId !== consultationId) {
      throw new NotFoundException('Ordonnance introuvable')
    }
    if (ordonnance.statut !== 'BROUILLON') {
      throw new ConflictException(
        'Impossible de modifier une ordonnance validée ou annulée',
      )
    }

    // ── Branche PRESCRIPTION_EXAMEN : un ou plusieurs types d'examen, une ligne par id
    // (miroir BonExamenService.create()) — pas de vérification contre-indication (propre
    // aux médicaments).
    if (
      (ordonnance.typeOrdonnance ?? 'PHARMACEUTIQUE') === 'PRESCRIPTION_EXAMEN'
    ) {
      if (!dto.typesExamenIds?.length) {
        throw new BadRequestException("Au moins un type d'examen est requis")
      }
      const types = await this.prisma.typeExamen.findMany({
        where: { id: { in: dto.typesExamenIds } },
      })
      if (types.length !== dto.typesExamenIds.length) {
        throw new BadRequestException(
          "Un ou plusieurs types d'examen sont invalides",
        )
      }
      const lignes = await this.prisma.$transaction(
        dto.typesExamenIds.map((typeExamenId) =>
          this.prisma.ligneOrdonnance.create({
            data: {
              ordonnanceId,
              typeExamenId,
              instructions: dto.instructions ?? null,
              justification: dto.justification ?? null,
            },
            include: LIGNE_INCLUDE,
          }),
        ),
      )
      return lignes
    }

    // ── Branche PHARMACEUTIQUE (comportement existant) ──
    if (!dto.medicamentId) throw new BadRequestException('Médicament requis')
    if (!dto.posologie?.trim())
      throw new BadRequestException('Posologie requise')
    if (!dto.duree?.trim()) throw new BadRequestException('Durée requise')
    if (!dto.voieAdmin?.trim())
      throw new BadRequestException("Voie d'administration requise")

    const medicament = await this.prisma.medicamentReference.findUnique({
      where: { id: dto.medicamentId },
      include: { contreIndications: true },
    })
    if (!medicament) throw new NotFoundException('Médicament introuvable')

    // ── Vérification contre-indications & allergies ─────────────────────────
    const warnings = await this.checkContreIndications(
      consultationId,
      medicament,
    )

    // Si une alerte SEVERE/CRITIQUE et l'appelant n'a pas explicitement
    // confirmé sa connaissance des warnings → on bloque.
    const blocking = warnings.filter((w) => w.severity === 'BLOCKING')
    if (blocking.length > 0 && !acknowledgeWarnings) {
      throw new ConflictException({
        message:
          'Contre-indication critique détectée — confirmation médicale requise',
        warnings,
        code: 'CONTRE_INDICATION_BLOCKING',
      })
    }

    const ligne = await this.prisma.ligneOrdonnance.create({
      data: {
        ordonnanceId,
        medicamentId: dto.medicamentId,
        posologie: dto.posologie,
        duree: dto.duree,
        voieAdmin: dto.voieAdmin,
        quantite: dto.quantite ?? null,
        instructions: dto.instructions ?? null,
        justification: dto.justification ?? null,
      },
      include: LIGNE_INCLUDE,
    })

    // On renvoie les warnings au front pour qu'il puisse les afficher
    // après ajout réussi (en cas de gravité moindre).
    return warnings.length > 0 ? { ...ligne, _warnings: warnings } : ligne
  }

  /**
   * Vérifie les contre-indications d'un médicament pour le patient associé
   * à la consultation. Retourne une liste de warnings classés.
   */
  private async checkContreIndications(
    consultationId: string,
    medicament: any,
  ): Promise<
    Array<{
      type: 'ALLERGIE' | 'PATHOLOGIE'
      severity: 'BLOCKING' | 'WARNING'
      message: string
    }>
  > {
    // 1. Récupérer le patient + allergies actives + antécédents
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        visite: {
          include: {
            patient: {
              include: {
                allergies: { where: { statut: 'ACTIVE' } },
                alertesMedicales: { where: { statut: 'ACTIVE' } },
              },
            },
          },
        },
      },
    })

    const patient = consultation?.visite?.patient
    if (!patient) return []

    const warnings: Array<{
      type: 'ALLERGIE' | 'PATHOLOGIE'
      severity: 'BLOCKING' | 'WARNING'
      message: string
    }> = []

    const nomGen = (medicament.nomGenerique ?? '').toLowerCase()
    const nomCom = (medicament.nomCommercial ?? '').toLowerCase()
    const famille = (medicament.familleThera ?? '').toLowerCase()

    // 2. Vérifier les allergies du patient
    // Rapprochement textuel tolérant aux familles (« pénicilline » ⊂ « pénicillines »)
    // mais avec garde-fou de longueur ≥ 4 pour éviter les faux positifs sur fragments courts.
    for (const allergie of patient.allergies) {
      const sub = allergie.substance.toLowerCase().trim()
      const matches =
        (sub.length >= 4 &&
          (nomGen.includes(sub) ||
            nomCom.includes(sub) ||
            famille.includes(sub))) ||
        (nomGen.length >= 4 && sub.includes(nomGen))
      if (matches) {
        const isBlocking = allergie.gravite === 'SEVERE' && allergie.confirme
        warnings.push({
          type: 'ALLERGIE',
          severity: isBlocking ? 'BLOCKING' : 'WARNING',
          message: `Allergie ${allergie.gravite.toLowerCase()}${allergie.confirme ? ' confirmée' : ' suspectée'} à « ${allergie.substance} »`,
        })
      }
    }

    // 3. Vérifier les contre-indications déclarées du médicament
    for (const ci of (medicament.contreIndications ?? []) as Array<{
      typeCondition: string
      condition: string
      gravite: string
    }>) {
      const cond = ci.condition.toLowerCase().trim()

      // Match contre une alerte médicale active (garde-fou longueur ≥ 4)
      const hit =
        cond.length < 4
          ? undefined
          : patient.alertesMedicales.find((a) => {
              const msg = a.message.toLowerCase()
              return (
                msg.includes(cond) || (msg.length >= 4 && cond.includes(msg))
              )
            })
      if (hit) {
        const isBlocking = ci.gravite === 'ABSOLUE' || ci.gravite === 'SEVERE'
        warnings.push({
          type: 'PATHOLOGIE',
          severity: isBlocking ? 'BLOCKING' : 'WARNING',
          message: `Contre-indication ${ci.gravite.toLowerCase()} : ${ci.condition}`,
        })
      }
    }

    return warnings
  }

  // ── Ordonnance — retirer ligne ────────────────────────────────────────────

  async removeLigneOrdonnance(
    consultationId: string,
    ordonnanceId: string,
    ligneId: string,
    userId: string,
  ) {
    await this.assertEditable(consultationId, userId)

    const ligne = await this.prisma.ligneOrdonnance.findUnique({
      where: { id: ligneId },
    })
    if (!ligne || ligne.ordonnanceId !== ordonnanceId) {
      throw new NotFoundException('Ligne introuvable')
    }

    return this.prisma.ligneOrdonnance.delete({ where: { id: ligneId } })
  }

  // ── Ordonnance — supprimer (brouillon uniquement) ─────────────────────────

  /**
   * Supprime une ordonnance encore au statut BROUILLON (créée par erreur,
   * jamais validée → aucune valeur clinique/légale). Une ordonnance VALIDÉE ne
   * se supprime pas : elle s'annule (traçabilité). Hard-delete des lignes + entête
   * dans une transaction.
   */
  async deleteOrdonnance(
    consultationId: string,
    ordonnanceId: string,
    userId: string,
  ) {
    await this.assertEditable(consultationId, userId)

    const ordonnance = await this.prisma.ordonnance.findUnique({
      where: { id: ordonnanceId },
    })
    if (!ordonnance || ordonnance.consultationId !== consultationId) {
      throw new NotFoundException('Ordonnance introuvable')
    }
    if (ordonnance.statut !== 'BROUILLON') {
      throw new ConflictException(
        'Seule une ordonnance brouillon peut être supprimée (une ordonnance validée doit être annulée)',
      )
    }

    await this.prisma.$transaction([
      this.prisma.ligneOrdonnance.deleteMany({ where: { ordonnanceId } }),
      this.prisma.ordonnance.delete({ where: { id: ordonnanceId } }),
    ])
    return { deleted: true }
  }

  // ── Ordonnance — modifier l'indication clinique (brouillon uniquement) ───

  async updateOrdonnance(
    consultationId: string,
    ordonnanceId: string,
    dto: UpdateOrdonnanceDto,
    userId: string,
  ) {
    await this.assertEditable(consultationId, userId)

    const ordonnance = await this.prisma.ordonnance.findUnique({
      where: { id: ordonnanceId },
    })
    if (!ordonnance || ordonnance.consultationId !== consultationId) {
      throw new NotFoundException('Ordonnance introuvable')
    }
    if (ordonnance.statut !== 'BROUILLON') {
      throw new ConflictException(
        'Seule une ordonnance brouillon peut être modifiée',
      )
    }
    if (ordonnance.typeOrdonnance !== 'PRESCRIPTION_EXAMEN') {
      throw new BadRequestException(
        "L'indication clinique ne s'applique qu'aux prescriptions d'examen",
      )
    }

    return this.prisma.ordonnance.update({
      where: { id: ordonnanceId },
      data: { indicationClinik: dto.indicationClinik.trim() },
      include: { lignes: { include: LIGNE_INCLUDE } },
    })
  }

  // ── Ordonnance — valider ──────────────────────────────────────────────────

  async validerOrdonnance(
    consultationId: string,
    ordonnanceId: string,
    acteurId: string,
  ) {
    const c = await this.assertEditable(consultationId, acteurId)

    const ordonnance = await this.prisma.ordonnance.findUnique({
      where: { id: ordonnanceId },
      include: { lignes: true },
    })
    if (!ordonnance || ordonnance.consultationId !== consultationId) {
      throw new NotFoundException('Ordonnance introuvable')
    }
    if (ordonnance.statut !== 'BROUILLON') {
      throw new ConflictException('Ordonnance déjà validée ou annulée')
    }
    if (!ordonnance.lignes.length) {
      throw new BadRequestException(
        'Une ordonnance doit comporter au moins une ligne avant validation',
      )
    }

    const result = await this.prisma.ordonnance.update({
      where: { id: ordonnanceId },
      data: { statut: 'VALIDEE' },
      include: { lignes: { include: LIGNE_INCLUDE } },
    })

    await this.notif.emit({
      type: 'ORDONNANCE_VALIDEE',
      niveau: 'SUCCES',
      category: 'clinique',
      titre: 'Ordonnance validée',
      message: `${result.lignes.length} médicament${result.lignes.length > 1 ? 's' : ''} prescrit${result.lignes.length > 1 ? 's' : ''}`,
      siteId: null,
      requiredPermission: 'ordonnance.read',
      entiteType: 'ordonnance',
      entiteId: ordonnanceId,
      lien: '/consultations',
      createdById: acteurId ?? null,
    })
    return result
  }

  // ── Ordonnance — annuler (validée → annulée) ──────────────────────────────
  /**
   * Annule une ordonnance. Volontairement SANS `assertEditable` (pas de contrôle de
   * site ni d'état de la consultation) : cette action est aussi utilisée depuis l'onglet
   * « Documents » du dossier patient CENTRALISÉ (tous sites, y compris sur une consultation
   * déjà clôturée) — un document visible dans le dossier doit rester gérable depuis là.
   * Pour l'édition ACTIVE (OrdonnanceCard), le frontend garde déjà le bouton masqué/désactivé
   * hors consultation ouverte ou tenue par un autre soignant (readonly), donc aucune perte de
   * protection sur ce chemin-là.
   */
  async annulerOrdonnance(consultationId: string, ordonnanceId: string) {
    const c = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { id: true },
    })
    if (!c) throw new NotFoundException('Consultation introuvable')
    const ord = await this.prisma.ordonnance.findUnique({
      where: { id: ordonnanceId },
    })
    if (!ord || ord.consultationId !== consultationId) {
      throw new NotFoundException('Ordonnance introuvable')
    }
    if (ord.statut === 'ANNULEE') {
      throw new ConflictException('Ordonnance déjà annulée')
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.ordonnance.update({
        where: { id: ordonnanceId },
        data: { statut: 'ANNULEE' },
        include: { lignes: { include: LIGNE_INCLUDE } },
      })
      // Cascade : un bon pas encore délivré/validé perd sa raison d'être avec l'ordonnance —
      // on l'annule avec elle. Un bon déjà VALIDE (examen, résultat possible) ou DELIVRE
      // (pharmacie) n'est PAS touché ici : la délivrance a peut-être déjà eu lieu, on ne
      // réécrit pas silencieusement ce qui s'est réellement passé. Le frontend affiche un
      // avertissement sur ce bon (ordonnance.statut === 'ANNULEE') plutôt que de le modifier.
      await tx.bonExamen.updateMany({
        where: { ordonnanceId, statut: 'EN_ATTENTE' },
        data: {
          statut: 'ANNULE',
          motifAnnulation: "Ordonnance d'origine annulée",
        },
      })
      await tx.bonPharmacie.updateMany({
        where: { ordonnanceId, statut: 'EN_ATTENTE' },
        data: {
          statut: 'ANNULE',
          motifAnnulation: "Ordonnance d'origine annulée",
        },
      })
      return updated
    })
  }

  // ── Ordonnance — générer le bon associé ───────────────────────────────────
  /**
   * Génère automatiquement le bon (examen ou pharmacie) associé à une ordonnance VALIDÉE,
   * entièrement à partir des données déjà saisies sur ses lignes — aucune saisie
   * supplémentaire. Un seul bon ACTIF (non annulé) par ordonnance à la fois.
   */
  async genererBonDepuisOrdonnance(
    consultationId: string,
    ordonnanceId: string,
    userPermissions: string[],
  ) {
    const ordonnance = await this.prisma.ordonnance.findUnique({
      where: { id: ordonnanceId },
      include: { lignes: { include: { medicament: true } } },
    })
    if (!ordonnance || ordonnance.consultationId !== consultationId) {
      throw new NotFoundException('Ordonnance introuvable')
    }
    if (ordonnance.statut !== 'VALIDEE') {
      throw new ConflictException(
        'Seule une ordonnance validée peut générer un bon',
      )
    }

    const type = ordonnance.typeOrdonnance ?? 'PHARMACEUTIQUE'
    const permRequise =
      type === 'PRESCRIPTION_EXAMEN'
        ? 'bon_examen.create'
        : 'bon_pharmacie.create'
    if (!userPermissions.includes(permRequise)) {
      throw new ForbiddenException(`Permission « ${permRequise} » requise`)
    }

    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      select: {
        visite: {
          select: { patient: { select: { categoriePatientId: true } } },
        },
      },
    })
    if (!consultation) throw new NotFoundException('Consultation introuvable')
    const categoriePatientId = consultation.visite.patient.categoriePatientId

    if (type === 'PRESCRIPTION_EXAMEN') {
      const existant = await this.prisma.bonExamen.findFirst({
        where: { ordonnanceId, statut: { not: 'ANNULE' } },
      })
      if (existant)
        throw new ConflictException({
          message: "Un bon d'examen a déjà été généré pour cette ordonnance",
          existingBonId: existant.id,
        })

      await assertPrestationCouverte(this.prisma, categoriePatientId, 'EXAMEN')

      const typeExamenIds = ordonnance.lignes
        .map((l) => l.typeExamenId)
        .filter((v): v is string => !!v)
      if (typeExamenIds.length === 0)
        throw new ConflictException(
          "Cette ordonnance ne comporte aucun type d'examen",
        )

      try {
        return await this.prisma.$transaction(async (tx) => {
          const bon = await tx.bonExamen.create({
            data: {
              consultationId,
              ordonnanceId,
              indicationClinik: ordonnance.indicationClinik ?? '',
              etablissementId: ordonnance.etablissementId,
              statut: 'EN_ATTENTE',
            },
          })
          await tx.ligneExamen.createMany({
            data: typeExamenIds.map((typeExamenId) => ({
              bonId: bon.id,
              typeExamenId,
            })),
          })
          return tx.bonExamen.findUnique({
            where: { id: bon.id },
            include: { lignes: { include: { typeExamen: true } } },
          })
        })
      } catch (err) {
        // Fenêtre de race entre le contrôle `existant` ci-dessus et l'écriture : l'index
        // unique partiel (schema.prisma, BonExamen.ordonnanceId) intercepte une double
        // génération concurrente — même message clair que le contrôle applicatif.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new ConflictException(
            "Un bon d'examen a déjà été généré pour cette ordonnance",
          )
        }
        throw err
      }
    }

    // ── Branche PHARMACEUTIQUE ──
    const existant = await this.prisma.bonPharmacie.findFirst({
      where: { ordonnanceId, statut: { not: 'ANNULE' } },
    })
    if (existant)
      throw new ConflictException({
        message: 'Un bon de pharmacie a déjà été généré pour cette ordonnance',
        existingBonId: existant.id,
      })

    await assertPrestationCouverte(
      this.prisma,
      categoriePatientId,
      'MEDICAMENT',
    )

    const lignesMed = ordonnance.lignes.filter(
      (l) => l.medicamentId && l.medicament,
    )
    if (lignesMed.length === 0)
      throw new ConflictException(
        'Cette ordonnance ne comporte aucun médicament',
      )

    try {
      return await this.prisma.$transaction(async (tx) => {
        const bon = await tx.bonPharmacie.create({
          data: {
            consultationId,
            ordonnanceId,
            prescripteurId: ordonnance.prescripteurId,
            statut: 'EN_ATTENTE',
          },
        })
        await tx.ligneBonPharmacie.createMany({
          data: lignesMed.map((l) => ({
            bonId: bon.id,
            medicamentId: l.medicamentId,
            libelle: l.medicament!.nomGenerique,
            posologie: l.posologie,
            quantite: l.quantite,
          })),
        })
        return tx.bonPharmacie.findUnique({
          where: { id: bon.id },
          include: { lignes: { include: { medicament: true } } },
        })
      })
    } catch (err) {
      // Fenêtre de race entre le contrôle `existant` ci-dessus et l'écriture : l'index
      // unique partiel (schema.prisma, BonPharmacie.ordonnanceId) intercepte une double
      // génération concurrente — même message clair que le contrôle applicatif.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Un bon de pharmacie a déjà été généré pour cette ordonnance',
        )
      }
      throw err
    }
  }
}
