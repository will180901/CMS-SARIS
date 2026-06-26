/**
 * ConsultationService — Module 7 · Consultation & Actes Prescrits — CMS SARIS
 *
 * Gère : ouverture consultation, examen clinique, diagnostics,
 *        ordonnances, clôture, annulation.
 */

import {
  Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationService } from '../notification/notification.service'
import { assertPeutPrescrire, type PrescriptionScope } from '../../common/prescription'
import {
  CreateConsultationDto, UpdateExamenCliniqueDto, AddDiagnosticDto,
  UpdateConclusionDto, CloturerConsultationDto, AnnulerConsultationDto,
  CreateOrdonnanceDto, AddLigneOrdonnanceDto, ConsultationQueryDto,
  UpdateReposDto,
} from './dto/consultation.dto'

// ── Statuts ───────────────────────────────────────────────────────────────────

type StatutConsultation = 'OUVERTE' | 'CLOTUREE' | 'ANNULEE'
const ETATS_TERMINAUX: StatutConsultation[] = ['CLOTUREE', 'ANNULEE']

// ── Includes Prisma ───────────────────────────────────────────────────────────

const PERSONNEL_SELECT = {
  id: true, nom: true, prenom: true, matricule: true, role: true,
} as const

const VISITE_RESUME = {
  id:            true,
  dateOuverture: true,
  notesAccueil:  true,
  patient: {
    select: {
      id:            true,
      numeroPatient: true,
      identite: {
        select: { nom: true, prenom: true, dateNaissance: true, sexe: true },
      },
      categoriePatient: { select: { id: true, code: true, libelle: true } },
      allergies: {
        where:  { statut: 'ACTIVE' },
        select: { id: true, substance: true, gravite: true },
      },
      alertesMedicales: {
        where:  { statut: 'ACTIVE' },
        select: { id: true, type: true, message: true, gravite: true },
      },
    },
  },
  motifPrincipal: { select: { id: true, code: true, libelle: true } },
  constantes:     { orderBy: { createdAt: 'desc' as const }, take: 1 },
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
} as const

const CONSULTATION_LIST_INCLUDE = {
  visite: { select: VISITE_RESUME },
  typeConsultation: { select: { id: true, code: true, libelle: true } },
  _count: { select: { diagnostics: true, ordonnances: { where: { deletedAt: null } } } },
} as const

const CONSULTATION_DETAIL_INCLUDE = {
  visite:      { select: VISITE_RESUME },
  typeConsultation: { select: { id: true, code: true, libelle: true } },
  diagnostics: { include: DIAGNOSTIC_INCLUDE, orderBy: { id: 'asc' as const } },
  ordonnances: {
    where:   { deletedAt: null },
    include: { lignes: { where: { deletedAt: null }, include: LIGNE_INCLUDE } },
    orderBy: { createdAt: 'asc' as const },
  },
  // Présence des sorties critiques 1-1 + compteurs 1-N (badges d'onglets).
  // Les compteurs filtrent les tombstones (soft-delete) pour ne pas sur-compter.
  evacuation:      { select: { id: true, statut: true } },
  _count: { select: { diagnostics: true, ordonnances: { where: { deletedAt: null } }, bonsExamen: { where: { deletedAt: null } } } },
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
    private readonly notif:  NotificationService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async getOrThrow(id: string, siteId: string) {
    const c = await this.prisma.consultation.findFirst({ where: { id, visite: { siteId } } })
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
  private async assertEditable(id: string, userId: string, siteId: string) {
    const c = await this.getOrThrow(id, siteId)
    this.assertModifiable(c.statut)
    if (c.pickedUpById && c.pickedUpById !== userId) {
      const holder = await this.resolvePriseEnCharge(c.pickedUpById, c.pickedUpAt)
      throw new ConflictException({
        message: `Consultation en cours de modification par ${holder?.nom ?? 'un autre soignant'} — reprenez la main pour la modifier.`,
        code: 'LOCKED_BY_OTHER',
        pickedUpById: c.pickedUpById,
      })
    }
    return c
  }

  private async attachSoignants<T extends { soignantId: string }>(consultations: T[]) {
    const ids = [...new Set(consultations.map(c => c.soignantId))]
    if (!ids.length) return consultations.map(c => ({ ...c, soignant: null }))

    const personnel = await this.prisma.personnelMedical.findMany({
      where:  { id: { in: ids } },
      select: PERSONNEL_SELECT,
    })
    const map = new Map(personnel.map(p => [p.id, p]))
    return consultations.map(c => ({ ...c, soignant: map.get(c.soignantId) ?? null }))
  }

  // ── Liste consultations ──────────────────────────────────────────────────

  async findAll(
    siteId: string,
    query: ConsultationQueryDto,
    scope?: { canReadAll: boolean; personnelMedicalId: string | null },
  ) {
    const where: any = { visite: { siteId } }

    // Confidentialité : un médecin ne voit QUE les consultations qui LUI sont
    // assignées ; seule la supervision (canReadAll) voit toutes celles du site.
    if (scope && !scope.canReadAll) {
      where.soignantId = scope.personnelMedicalId ?? '__aucun_soignant__'
    }

    // Filtre patient (dossier patient — toutes consultations sans restriction statut par défaut)
    if (query.patientId) {
      where.visite = { ...where.visite, patientId: query.patientId }
    }

    // Filtre statut
    if (query.statut === 'TOUTES') {
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

  async findById(id: string, siteId: string, scope?: { canReadAll: boolean; personnelMedicalId: string | null }) {
    const where: any = { id, visite: { siteId } }
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
      where:  { id: consultation.soignantId },
      select: PERSONNEL_SELECT,
    })

    // Détenteur du verrou souple (qui a la consultation en main)
    const priseEnCharge = await this.resolvePriseEnCharge(consultation.pickedUpById, consultation.pickedUpAt)

    return { ...consultation, soignant, priseEnCharge }
  }

  /** Résout le nom affichable de l'utilisateur qui a la consultation en main. */
  private async resolvePriseEnCharge(userId: string | null, at: Date | null) {
    if (!userId) return null
    const u = await this.prisma.utilisateur.findUnique({
      where:  { id: userId },
      select: { id: true, login: true, personnelMedical: { select: { nom: true, prenom: true } } },
    })
    const nom = u?.personnelMedical
      ? `${u.personnelMedical.prenom} ${u.personnelMedical.nom}`
      : (u?.login ?? 'Utilisateur')
    return { userId, nom, at }
  }

  /** Verrou souple : marque la consultation comme prise en main par l'utilisateur. */
  async prendreEnCharge(id: string, userId: string, siteId: string) {
    const c = await this.getOrThrow(id, siteId)
    this.assertModifiable(c.statut)
    await this.prisma.consultation.update({
      where: { id },
      data:  { pickedUpById: userId, pickedUpAt: new Date() },
    })
    return this.findById(id, siteId)
  }

  // ── Documents générés d'un patient (dossier → onglet Documents) ────────────
  // Agrège tous les actes documentaires de toutes les consultations du patient :
  // ordonnances, bons d'examen, évacuations, accidents du travail.
  async findPatientDocuments(patientId: string, scope?: { restrictToOwn: boolean; personnelMedicalId: string | null; canViewLocked?: boolean }) {
    // Verrou de confidentialité (médecin-chef) : dossier verrouillé + appelant non-supervision
    // → aucun document (cohérent avec patient.findById qui dépouille le dossier).
    if (!scope?.canViewLocked) {
      const p = await this.prisma.patient.findUnique({ where: { id: patientId }, select: { verrouille: true } })
      if (p?.verrouille) return []
    }
    // Confidentialité : un médecin restreint ne voit les documents que d'un patient
    // qu'il SUIT (relation clinique), comme pour l'accès au dossier (patient.findById).
    if (scope?.restrictToOwn) {
      const soignantId = scope.personnelMedicalId ?? '__aucun_soignant__'
      const [conso, visite] = await Promise.all([
        this.prisma.consultation.findFirst({ where: { soignantId, visite: { patientId } }, select: { id: true } }),
        this.prisma.visite.findFirst({ where: { soignantId, patientId }, select: { id: true } }),
      ])
      if (!conso && !visite) {
        throw new ForbiddenException("Accès refusé : vous n'êtes pas le médecin de ce patient")
      }
    }
    const consultations = await this.prisma.consultation.findMany({
      where:   { visite: { patientId } },   // dossier centralisé : tous les documents du patient (tous sites)
      orderBy: { createdAt: 'desc' },
      include: {
        visite:      { select: { id: true, dateOuverture: true, motifPrincipal: { select: { libelle: true } }, site: { select: { libelle: true } } } },
        ordonnances: { where: { deletedAt: null }, include: { lignes: { where: { deletedAt: null }, include: LIGNE_INCLUDE } } },
        bonsExamen:  { where: { deletedAt: null }, include: { lignes: { include: { typeExamen: { select: { libelle: true } } } }, resultats: { where: { deletedAt: null } } } },
        bonsPharmacie: { where: { deletedAt: null }, include: { lignes: true } },
        evacuation:      { select: { id: true, niveauUrgence: true, statut: true, createdAt: true } },
      },
    })

    const docs: PatientDocumentItem[] = []
    for (const c of consultations) {
      const motif = c.visite.motifPrincipal?.libelle ?? '—'
      const site  = c.visite.site?.libelle ?? null   // repère « soigné à … » (continuité multi-site)
      for (const o of c.ordonnances) {
        docs.push({ id: o.id, type: 'ORDONNANCE', consultationId: c.id, date: o.createdAt, statut: o.statut,
          titre: 'Ordonnance', details: `${o.lignes.length} médicament${o.lignes.length > 1 ? 's' : ''}`, motif, site })
      }
      for (const b of c.bonsExamen) {
        const examens = b.lignes.map(l => l.typeExamen.libelle).join(', ')
        docs.push({ id: b.id, type: 'BON_EXAMEN', consultationId: c.id, date: b.createdAt, statut: b.statut,
          titre: 'Bon d\'examen', details: examens + (b.resultats.length ? ' · résultat reçu' : ''), motif, site })
      }
      for (const bp of c.bonsPharmacie) {
        const n = bp.lignes.length
        docs.push({ id: bp.id, type: 'BON_PHARMACIE', consultationId: c.id, date: bp.createdAt, statut: bp.statut,
          titre: 'Bon de pharmacie', details: `${n} médicament${n > 1 ? 's' : ''}`, motif, site })
      }
      if (c.evacuation && c.evacuation.statut !== 'ANNULE') {
        docs.push({ id: c.evacuation.id, type: 'EVACUATION', consultationId: c.id, date: c.evacuation.createdAt,
          statut: c.evacuation.statut, titre: 'Fiche d\'évacuation', details: `Urgence : ${c.evacuation.niveauUrgence}`, motif, site })
      }
    }
    docs.sort((a, b) => b.date.getTime() - a.date.getTime())
    return docs
  }

  // ── Ouvrir une consultation ──────────────────────────────────────────────

  async create(dto: CreateConsultationDto, acteurUserId: string, siteId: string) {
    // Vérifier la visite
    const visite = await this.prisma.visite.findFirst({ where: { id: dto.visiteId, siteId } })
    if (!visite) throw new NotFoundException('Visite introuvable')
    if (visite.statut !== 'EN_COURS') {
      throw new ConflictException('Seule une visite EN_COURS peut avoir une consultation ouverte')
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
    const soignant = await this.prisma.personnelMedical.findUnique({ where: { id: soignantId } })
    if (!soignant) throw new NotFoundException('Soignant introuvable')
    if (soignant.statut !== 'ACTIF') throw new ConflictException('Soignant inactif')

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
    const consultation = await this.prisma.$transaction(async tx => {
      const c = await tx.consultation.create({
        data: {
          visiteId:     dto.visiteId,
          soignantId,
          typeConsultationId: dto.typeConsultationId ?? null,
        },
        include: CONSULTATION_DETAIL_INCLUDE,
      })
      await tx.visite.update({
        where: { id: dto.visiteId },
        data:  { statut: 'CLOTUREE', typeCloture: 'AVEC_CONSULTATION', dateCloture: new Date() },
      })
      return c
    })

    // Notification CIBLÉE au médecin assigné (et non plus diffusion à tout le site).
    const medecinUser = await this.prisma.utilisateur.findFirst({
      where:  { personnelMedicalId: soignantId },
      select: { id: true },
    })
    await this.notif.emit({
      type:               'CONSULTATION_OUVERTE',
      niveau:             'INFO',
      category:           'clinique',
      titre:              'Consultation en attente',
      message:            'Un nouveau dossier vous a été affecté — consultation en attente',
      destinataireId:     medecinUser?.id ?? null,
      siteId:             visite.siteId,
      // Repli en diffusion site uniquement si le médecin n'a pas de compte lié.
      requiredPermission: medecinUser ? null : 'consultation.read',
      entiteType:         'consultation',
      entiteId:           consultation.id,
      lien:               '/consultations',
      createdById:        acteurUserId,
    })

    return { ...consultation, soignant }
  }

  // ── Examen clinique ──────────────────────────────────────────────────────

  async updateExamen(id: string, dto: UpdateExamenCliniqueDto, userId: string, siteId: string) {
    await this.assertEditable(id, userId, siteId)

    return this.prisma.consultation.update({
      where: { id },
      data:  { examenClinique: dto.examenClinique?.trim() || null },
    })
  }

  // ── Conclusion ───────────────────────────────────────────────────────────

  async updateConclusion(id: string, dto: UpdateConclusionDto, userId: string, siteId: string) {
    await this.assertEditable(id, userId, siteId)

    return this.prisma.consultation.update({
      where: { id },
      data:  { conclusion: dto.conclusion?.trim() || null },
    })
  }

  // ── Diagnostics ──────────────────────────────────────────────────────────

  async addDiagnostic(id: string, dto: AddDiagnosticDto, userId: string, siteId: string) {
    await this.assertEditable(id, userId, siteId)

    const pathologie = await this.prisma.pathologieReference.findUnique({
      where: { id: dto.pathologieId },
    })
    if (!pathologie) throw new NotFoundException('Pathologie introuvable')
    if (pathologie.statut !== 'ACTIVE') throw new ConflictException('Pathologie inactive')

    // PRINCIPAL : une seule par consultation
    if (dto.type === 'PRINCIPAL') {
      const existingPrincipal = await this.prisma.diagnosticConsultation.findFirst({
        where: { consultationId: id, type: 'PRINCIPAL' },
      })
      if (existingPrincipal) {
        throw new ConflictException('Un diagnostic principal existe déjà — retirez-le avant d\'en ajouter un nouveau')
      }
    }

    // Pas de doublon sur la même pathologie
    const doublon = await this.prisma.diagnosticConsultation.findFirst({
      where: { consultationId: id, pathologieId: dto.pathologieId },
    })
    if (doublon) throw new ConflictException('Cette pathologie est déjà dans les diagnostics')

    return this.prisma.diagnosticConsultation.create({
      data: {
        consultationId: id,
        pathologieId:   dto.pathologieId,
        type:           dto.type,
        certitude:      dto.certitude,
      },
      include: DIAGNOSTIC_INCLUDE,
    })
  }

  async removeDiagnostic(consultationId: string, diagId: string, userId: string, siteId: string) {
    await this.assertEditable(consultationId, userId, siteId)

    const diag = await this.prisma.diagnosticConsultation.findUnique({ where: { id: diagId } })
    if (!diag || diag.consultationId !== consultationId) {
      throw new NotFoundException('Diagnostic introuvable')
    }

    return this.prisma.diagnosticConsultation.delete({ where: { id: diagId } })
  }

  // ── Clôturer ─────────────────────────────────────────────────────────────

  // ── Type de consultation ──────────────────────────────────────────────────

  async setType(id: string, typeConsultationId: string | null, userId: string, siteId: string) {
    await this.assertEditable(id, userId, siteId)
    if (typeConsultationId) {
      const t = await this.prisma.typeConsultation.findUnique({ where: { id: typeConsultationId } })
      if (!t) throw new NotFoundException('Type de consultation introuvable')
    }
    return this.prisma.consultation.update({
      where:   { id },
      data:    { typeConsultationId },
      include: CONSULTATION_DETAIL_INCLUDE,
    })
  }

  // ── Repos maladie (PEC supplémentaire) ─────────────────────────────────────

  async setRepos(id: string, dto: UpdateReposDto, userId: string, siteId: string) {
    await this.assertEditable(id, userId, siteId)
    const dateReprise = dto.dateReprise ? new Date(dto.dateReprise) : null
    return this.prisma.consultation.update({
      where: { id },
      data:  {
        reposJours:      dto.reposJours ?? null,
        reposInclutJour: dto.reposInclutJour ?? false,
        dateReprise,
      },
      include: CONSULTATION_DETAIL_INCLUDE,
    })
  }

  async cloturer(id: string, dto: CloturerConsultationDto, userId: string, siteId: string) {
    const c = await this.assertEditable(id, userId, siteId)

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
      throw new BadRequestException('Le type de consultation est requis avant de clôturer')
    }

    // Validation métier : cohérence décision médicale ↔ document produit.
    // On ne peut clôturer qu'une fois le document exigé par la décision créé.
    if (dto.decisionMedicale === 'PRESCRIPTION') {
      const n = await this.prisma.ordonnance.count({ where: { consultationId: id, statut: 'VALIDEE' } })
      if (n === 0) throw new BadRequestException('Décision « Prescription » : au moins une ordonnance validée est requise')
    }
    if (dto.decisionMedicale === 'EXAMEN_COMPLEMENTAIRE') {
      const n = await this.prisma.bonExamen.count({ where: { consultationId: id } })
      if (n === 0) throw new BadRequestException('Décision « Examen complémentaire » : créez au moins un bon d\'examen avant de clôturer')
    }
    if (dto.decisionMedicale === 'EVACUATION') {
      // Une évacuation ANNULÉE ne compte pas (= inexistante) : il faut une fiche active.
      const n = await this.prisma.evacuation.count({ where: { consultationId: id, statut: { not: 'ANNULE' } } })
      if (n === 0) throw new BadRequestException('Décision « Évacuation médicale » : créez la fiche d\'évacuation avant de clôturer')
    }
    // CLOTURE_SIMPLE : décision « simple » qui
    // n'exige AUCUN document séparé (l'acte est entièrement consigné dans la
    // consultation elle-même : diagnostics + examen + conclusion). Aucune validation
    // de document à ajouter ici — comportement intentionnel.

    // Clôture atomique : consultation CLÔTURÉE + visite associée clôturée
    // (AVEC_CONSULTATION). La visite n'est fermée qu'ici (plus à la création).
    const result = await this.prisma.$transaction(async tx => {
      const updated = await tx.consultation.update({
        where: { id },
        data:  {
          statut:          'CLOTUREE',
          decisionMedicale: dto.decisionMedicale,
          conclusion:       dto.conclusion?.trim() || null,
          closedAt:         new Date(),
        },
        include: CONSULTATION_DETAIL_INCLUDE,
      })
      await tx.visite.update({
        where: { id: c.visiteId },
        data:  { statut: 'CLOTUREE', typeCloture: 'AVEC_CONSULTATION', dateCloture: new Date() },
      })
      return updated
    })

    const v = await this.prisma.visite.findUnique({ where: { id: c.visiteId }, select: { siteId: true } })
    await this.notif.emit({
      type:               'CONSULTATION_CLOTUREE',
      niveau:             'SUCCES',
      category:           'clinique',
      titre:              'Consultation clôturée',
      message:            `Décision : ${(dto.decisionMedicale ?? '—').replace(/_/g, ' ').toLowerCase()}`,
      siteId:             v?.siteId ?? null,
      requiredPermission: 'consultation.read',
      entiteType:         'consultation',
      entiteId:           id,
      lien:               '/consultations',
      createdById:        userId,
    })

    return result
  }

  // ── Annuler ───────────────────────────────────────────────────────────────

  async annuler(id: string, dto: AnnulerConsultationDto, userId: string, siteId: string) {
    const c = await this.assertEditable(id, userId, siteId)

    // Annulation APRÈS envoi : la consultation est annulée ET la visite est REMISE
    // EN FILE (rouverte EN_ATTENTE, clôture triage effacée) — on ne perd jamais le
    // patient, le triage peut le ré-orienter. (Décision produit validée.)
    return this.prisma.$transaction(async tx => {
      const updated = await tx.consultation.update({
        where: { id },
        data:  {
          statut:          'ANNULEE',
          motifAnnulation: dto.motifAnnulation,
          closedAt:        new Date(),
        },
      })
      await tx.visite.update({
        where: { id: c.visiteId },
        data:  { statut: 'EN_ATTENTE', typeCloture: null, dateCloture: null },
      })
      return updated
    })
  }

  // ── Suppression définitive (consultation.delete) ─────────────────────────
  /**
   * Supprime DÉFINITIVEMENT une consultation ANNULÉE et sans aucun document
   * (ordonnance, bon d'examen, évacuation, accident, suivi, prénatale). Une
   * consultation porteuse de documents ou non annulée n'est pas supprimable
   * (traçabilité). Réservée à `consultation.delete`.
   */
  async delete(id: string, siteId: string) {
    const c = await this.prisma.consultation.findFirst({ where: { id, visite: { siteId } } })
    if (!c) throw new NotFoundException('Consultation introuvable')
    if (c.statut !== 'ANNULEE') {
      throw new ConflictException('Seule une consultation ANNULÉE peut être supprimée (annulez-la d\'abord)')
    }
    // Comptes au NIVEAU RACINE sur le client étendu (filtre deletedAt:null) :
    // un `_count` relationnel / include imbriqué n'est PAS filtré par l'extension
    // soft-delete et compterait les documents déjà supprimés (tombstones), bloquant
    // à tort la suppression d'une consultation dont tous les documents vivants ont disparu.
    const [ordonnances, bonsExamen, bonsPharmacie, suiviChronique, consultationsPrenat, evacuation, accidentTravail] = await Promise.all([
      this.prisma.ordonnance.count({ where: { consultationId: id } }),
      this.prisma.bonExamen.count({ where: { consultationId: id } }),
      this.prisma.bonPharmacie.count({ where: { consultationId: id } }),
      this.prisma.suiviChronique.count({ where: { consultationId: id } }),
      this.prisma.consultationPrenatale.count({ where: { consultationId: id } }),
      this.prisma.evacuation.count({ where: { consultationId: id } }),
      this.prisma.accidentTravail.count({ where: { consultationId: id } }),
    ])
    const docs = ordonnances + bonsExamen + bonsPharmacie + suiviChronique + consultationsPrenat + evacuation + accidentTravail
    if (docs > 0) {
      throw new ConflictException('Cette consultation porte des documents — supprimez/annulez-les d\'abord')
    }
    await this.prisma.$transaction([
      this.prisma.diagnosticConsultation.deleteMany({ where: { consultationId: id } }),
      this.prisma.consultation.delete({ where: { id } }),
    ])
    return { deleted: true }
  }

  // ── Ordonnance — créer ────────────────────────────────────────────────────

  async createOrdonnance(consultationId: string, prescripteurUserId: string, dto: CreateOrdonnanceDto, siteId: string, scope: PrescriptionScope) {
    const c = await this.assertEditable(consultationId, prescripteurUserId, siteId)

    // Droit de prescrire (recueil) : médecin chef libre, infirmier seulement si délégué.
    // Retourne l'id de la délégation active (traçabilité) ou null.
    const delegationId = await assertPeutPrescrire(this.prisma, scope)

    // Résolution prescripteur : le JWT donne Utilisateur.id → on remonte au PersonnelMedical lié.
    const prescripteurPersonnelId = await this.resolvePrescripteur(prescripteurUserId, c)

    return this.prisma.ordonnance.create({
      data: {
        consultationId,
        prescripteurId: prescripteurPersonnelId,
        statut: 'BROUILLON',
        delegationId,
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
      where:  { id: userId },
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
    ordonnanceId:   string,
    dto:            AddLigneOrdonnanceDto,
    userId:         string,
    siteId:         string,
    scope:          PrescriptionScope,
    acknowledgeWarnings = false,
  ) {
    const c = await this.assertEditable(consultationId, userId, siteId)
    // Droit de prescrire (recueil) : infirmier uniquement si délégation active.
    await assertPeutPrescrire(this.prisma, scope)

    const ordonnance = await this.prisma.ordonnance.findUnique({ where: { id: ordonnanceId } })
    if (!ordonnance || ordonnance.consultationId !== consultationId) {
      throw new NotFoundException('Ordonnance introuvable')
    }
    if (ordonnance.statut !== 'BROUILLON') {
      throw new ConflictException('Impossible de modifier une ordonnance validée ou annulée')
    }

    const medicament = await this.prisma.medicamentReference.findUnique({
      where:   { id: dto.medicamentId },
      include: { contreIndications: true },
    })
    if (!medicament) throw new NotFoundException('Médicament introuvable')

    // ── Vérification contre-indications & allergies ─────────────────────────
    const warnings = await this.checkContreIndications(consultationId, medicament)

    // Si une alerte SEVERE/CRITIQUE et l'appelant n'a pas explicitement
    // confirmé sa connaissance des warnings → on bloque.
    const blocking = warnings.filter(w => w.severity === 'BLOCKING')
    if (blocking.length > 0 && !acknowledgeWarnings) {
      throw new ConflictException({
        message: 'Contre-indication critique détectée — confirmation médicale requise',
        warnings,
        code: 'CONTRE_INDICATION_BLOCKING',
      })
    }

    const ligne = await this.prisma.ligneOrdonnance.create({
      data: {
        ordonnanceId,
        medicamentId:  dto.medicamentId,
        posologie:     dto.posologie,
        duree:         dto.duree,
        voieAdmin:     dto.voieAdmin,
        instructions:  dto.instructions ?? null,
        justification: dto.justification ?? null,
      },
      include: LIGNE_INCLUDE,
    })

    // On renvoie les warnings au front pour qu'il puisse les afficher
    // après ajout réussi (en cas de gravité moindre).
    return warnings.length > 0
      ? { ...ligne, _warnings: warnings }
      : ligne
  }

  /**
   * Vérifie les contre-indications d'un médicament pour le patient associé
   * à la consultation. Retourne une liste de warnings classés.
   */
  private async checkContreIndications(
    consultationId: string,
    medicament: any,
  ): Promise<Array<{ type: 'ALLERGIE' | 'PATHOLOGIE'; severity: 'BLOCKING' | 'WARNING'; message: string }>> {
    // 1. Récupérer le patient + allergies actives + antécédents
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        visite: {
          include: {
            patient: {
              include: {
                allergies:        { where: { statut: 'ACTIVE' } },
                alertesMedicales: { where: { statut: 'ACTIVE' } },
              },
            },
          },
        },
      },
    })

    const patient = consultation?.visite?.patient
    if (!patient) return []

    const warnings: Array<{ type: 'ALLERGIE' | 'PATHOLOGIE'; severity: 'BLOCKING' | 'WARNING'; message: string }> = []

    const nomGen = (medicament.nomGenerique ?? '').toLowerCase()
    const nomCom = (medicament.nomCommercial ?? '').toLowerCase()
    const famille = (medicament.familleThera ?? '').toLowerCase()

    // 2. Vérifier les allergies du patient
    // Rapprochement textuel tolérant aux familles (« pénicilline » ⊂ « pénicillines »)
    // mais avec garde-fou de longueur ≥ 4 pour éviter les faux positifs sur fragments courts.
    for (const allergie of patient.allergies) {
      const sub = allergie.substance.toLowerCase().trim()
      const matches =
        (sub.length >= 4 && (nomGen.includes(sub) || nomCom.includes(sub) || famille.includes(sub)))
        || (nomGen.length >= 4 && sub.includes(nomGen))
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
    for (const ci of (medicament.contreIndications ?? []) as Array<{ typeCondition: string; condition: string; gravite: string }>) {
      const cond = ci.condition.toLowerCase().trim()

      // Match contre une alerte médicale active (garde-fou longueur ≥ 4)
      const hit = cond.length < 4 ? undefined : patient.alertesMedicales.find(a => {
        const msg = a.message.toLowerCase()
        return msg.includes(cond) || (msg.length >= 4 && cond.includes(msg))
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

  async removeLigneOrdonnance(consultationId: string, ordonnanceId: string, ligneId: string, userId: string, siteId: string) {
    await this.assertEditable(consultationId, userId, siteId)

    const ligne = await this.prisma.ligneOrdonnance.findUnique({ where: { id: ligneId } })
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
  async deleteOrdonnance(consultationId: string, ordonnanceId: string, userId: string, siteId: string) {
    await this.assertEditable(consultationId, userId, siteId)

    const ordonnance = await this.prisma.ordonnance.findUnique({ where: { id: ordonnanceId } })
    if (!ordonnance || ordonnance.consultationId !== consultationId) {
      throw new NotFoundException('Ordonnance introuvable')
    }
    if (ordonnance.statut !== 'BROUILLON') {
      throw new ConflictException('Seule une ordonnance brouillon peut être supprimée (une ordonnance validée doit être annulée)')
    }

    await this.prisma.$transaction([
      this.prisma.ligneOrdonnance.deleteMany({ where: { ordonnanceId } }),
      this.prisma.ordonnance.delete({ where: { id: ordonnanceId } }),
    ])
    return { deleted: true }
  }

  // ── Ordonnance — valider ──────────────────────────────────────────────────

  async validerOrdonnance(consultationId: string, ordonnanceId: string, acteurId: string, siteId: string) {
    const c = await this.assertEditable(consultationId, acteurId, siteId)

    const ordonnance = await this.prisma.ordonnance.findUnique({
      where:   { id: ordonnanceId },
      include: { lignes: true },
    })
    if (!ordonnance || ordonnance.consultationId !== consultationId) {
      throw new NotFoundException('Ordonnance introuvable')
    }
    if (ordonnance.statut !== 'BROUILLON') {
      throw new ConflictException('Ordonnance déjà validée ou annulée')
    }
    if (!ordonnance.lignes.length) {
      throw new BadRequestException('Une ordonnance doit comporter au moins une ligne avant validation')
    }

    const result = await this.prisma.ordonnance.update({
      where:   { id: ordonnanceId },
      data:    { statut: 'VALIDEE' },
      include: { lignes: { include: LIGNE_INCLUDE } },
    })

    const v = await this.prisma.visite.findUnique({ where: { id: c.visiteId }, select: { siteId: true } })
    await this.notif.emit({
      type:               'ORDONNANCE_VALIDEE',
      niveau:             'SUCCES',
      category:           'clinique',
      titre:              'Ordonnance validée',
      message:            `${result.lignes.length} médicament${result.lignes.length > 1 ? 's' : ''} prescrit${result.lignes.length > 1 ? 's' : ''}`,
      siteId:             v?.siteId ?? null,
      requiredPermission: 'ordonnance.read',
      entiteType:         'ordonnance',
      entiteId:           ordonnanceId,
      lien:               '/consultations',
      createdById:        acteurId ?? null,
    })
    return result
  }

  // ── Ordonnance — annuler (validée → annulée) ──────────────────────────────
  async annulerOrdonnance(consultationId: string, ordonnanceId: string, userId: string, siteId: string) {
    await this.assertEditable(consultationId, userId, siteId)
    const ord = await this.prisma.ordonnance.findUnique({ where: { id: ordonnanceId } })
    if (!ord || ord.consultationId !== consultationId) {
      throw new NotFoundException('Ordonnance introuvable')
    }
    if (ord.statut === 'ANNULEE') {
      throw new ConflictException('Ordonnance déjà annulée')
    }
    return this.prisma.ordonnance.update({
      where: { id: ordonnanceId },
      data:  { statut: 'ANNULEE' },
      include: { lignes: { include: LIGNE_INCLUDE } },
    })
  }
}
