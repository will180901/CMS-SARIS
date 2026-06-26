/**
 * TriageService — Module 6 · Accueil & Triage CMS SARIS
 *
 * Gère : ouverture de visite, file d'attente (par ordre d'arrivée), constantes
 *        vitales, changement de statut / soignant + audit trail.
 */

import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationService } from '../notification/notification.service'
import { computeImc } from '../../common/clinical'
import {
  CreateVisiteDto, UpdateStatutVisiteDto,
  UpdateSoignantVisiteDto, UpdateNotesVisiteDto,
  CreateConstanteVitaleDto, VisiteQueryDto,
} from './dto/visite.dto'

// ── Machine d'états ───────────────────────────────────────────────────────────

type StatutVisite = 'EN_ATTENTE' | 'EN_COURS' | 'CLOTUREE' | 'ANNULEE'

// Recueil : PLUS de « clôture sans consultation ». Une visite se clôture UNIQUEMENT via une
// consultation (le service Consultation pose CLOTUREE/AVEC_CONSULTATION) ; depuis le triage on
// ne peut qu'envoyer en consultation (EN_COURS) ou ANNULER. CLOTUREE n'est donc plus une cible
// de transition manuelle du triage.
const TRANSITIONS: Record<StatutVisite, StatutVisite[]> = {
  EN_ATTENTE: ['EN_COURS', 'ANNULEE'],
  // Une visite prise en charge ne peut PLUS revenir « en attente » (pas de recul de file).
  EN_COURS:   ['ANNULEE'],
  CLOTUREE:   [],
  ANNULEE:    [],
}

const ETATS_TERMINAUX: StatutVisite[] = ['CLOTUREE', 'ANNULEE']
const ETATS_MODIFIABLES: StatutVisite[] = ['EN_ATTENTE', 'EN_COURS']

// ── Includes Prisma ───────────────────────────────────────────────────────────

/** Sélect compact pour la liste — seulement les alertes critiques (badge sur la queue card). */
const PATIENT_SELECT_LIST = {
  id:              true,
  numeroPatient:   true,
  identite: {
    select: { nom: true, prenom: true, dateNaissance: true, sexe: true, photoUrl: true },
  },
  categoriePatient: { select: { id: true, code: true, libelle: true } },
  allergies: {
    where:  { gravite: 'SEVERE', statut: 'ACTIVE' },
    select: { id: true, substance: true, gravite: true },
  },
  alertesMedicales: {
    where:  { statut: 'ACTIVE', gravite: 'CRITIQUE' },
    select: { id: true, type: true, message: true, gravite: true },
  },
} as const

/** Sélect enrichi pour le détail — toutes les allergies/alertes actives + antécédents. */
const PATIENT_SELECT_DETAIL = {
  id:              true,
  numeroPatient:   true,
  identite: {
    select: { nom: true, prenom: true, dateNaissance: true, sexe: true, photoUrl: true },
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
  antecedents: {
    where:  { statut: 'ACTIF' },
    select: { id: true, type: true, description: true, statut: true },
  },
} as const

const VISITE_LIST_INCLUDE = {
  patient:        { select: PATIENT_SELECT_LIST },
  site:           { select: { id: true, code: true, libelle: true } },
  motifPrincipal: { select: { id: true, code: true, libelle: true } },
} as const

const VISITE_DETAIL_INCLUDE = {
  patient:        { select: PATIENT_SELECT_DETAIL },
  site:           { select: { id: true, code: true, libelle: true } },
  motifPrincipal: { select: { id: true, code: true, libelle: true } },
  constantes:     { orderBy: { createdAt: 'desc' as const } },
  evenements:     { orderBy: { createdAt: 'desc' as const } },
} as const

const PERSONNEL_SELECT = {
  id: true, nom: true, prenom: true, matricule: true, role: true,
} as const

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class TriageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notif:  NotificationService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async attachSoignants<T extends { soignantId?: string | null }>(visites: T[]) {
    const ids = [...new Set(visites.flatMap(v => v.soignantId ? [v.soignantId] : []))]
    if (!ids.length) return visites.map(v => ({ ...v, soignant: null }))

    const personnel = await this.prisma.personnelMedical.findMany({
      where:  { id: { in: ids } },
      select: PERSONNEL_SELECT,
    })
    const map = new Map(personnel.map(p => [p.id, p]))
    return visites.map(v => ({
      ...v,
      soignant: v.soignantId ? (map.get(v.soignantId) ?? null) : null,
    }))
  }

  /** Charge la visite, garantit qu'elle existe ET qu'elle appartient au site
   *  de l'utilisateur (cloisonnement multi-site — pas de modification cross-site). */
  private async getVisiteOrThrow(id: string, siteId: string) {
    const visite = await this.prisma.visite.findFirst({ where: { id, siteId } })
    if (!visite) throw new NotFoundException('Visite introuvable')
    return visite
  }

  /** Bloque toute modification métier sur une visite déjà fermée. */
  private assertModifiable(statut: string) {
    if (ETATS_TERMINAUX.includes(statut as StatutVisite)) {
      throw new ConflictException(
        `Cette visite est ${statut === 'CLOTUREE' ? 'clôturée' : 'annulée'} et ne peut plus être modifiée`,
      )
    }
  }

  private assertActor(acteurId?: string) {
    if (!acteurId) throw new BadRequestException('Utilisateur non identifié')
    return acteurId
  }

  // ── File d'attente ────────────────────────────────────────────────────────

  async findAll(query: VisiteQueryDto, scope?: { canReadAll: boolean; personnelMedicalId: string | null }) {
    const where: any = {}
    if (query.siteId) where.siteId = query.siteId

    const isHistory = !!query.statut && query.statut !== 'ACTIVES'   // CLOTUREE / ANNULEE
    if (!query.statut || query.statut === 'ACTIVES') {
      // File active du triage = visites EN_ATTENTE / EN_COURS qui ne sont PAS encore
      // parties en consultation. Dès qu'une consultation (non annulée) est ouverte, la
      // visite quitte la file : elle est « en consultation », tracée dans le dossier.
      // La file active reste PARTAGÉE (gestion collective de l'accueil).
      where.statut = { in: ['EN_ATTENTE', 'EN_COURS'] }
      where.consultations = { none: { statut: { not: 'ANNULEE' } } }
    } else {
      where.statut = query.statut
    }

    // Phase C — confidentialité : l'HISTORIQUE (clôturées / annulées) n'est visible
    // que de son INITIATEUR (soignantId) pour les non-supervision. La supervision
    // (ADMIN_SYSTEME / MEDECIN_CHEF) voit tout l'historique du site.
    if (isHistory && scope && !scope.canReadAll) {
      where.soignantId = scope.personnelMedicalId ?? '__aucun_soignant__'
    }

    const visites = await this.prisma.visite.findMany({
      where,
      include: VISITE_LIST_INCLUDE,
      orderBy: [{ dateOuverture: 'asc' }],
    })

    const sorted = [...visites].sort((a, b) => {
      if (a.statut === 'EN_COURS' && b.statut !== 'EN_COURS') return -1
      if (b.statut === 'EN_COURS' && a.statut !== 'EN_COURS') return  1
      return new Date(a.dateOuverture).getTime() - new Date(b.dateOuverture).getTime()
    })

    return this.attachSoignants(sorted)
  }

  // ── Visites d'un patient (dossier) ────────────────────────────────────────
  /** Liste BRÈVE des visites d'un patient — pour la chronologie du dossier. */
  async findByPatient(patientId: string, siteId: string) {
    return this.prisma.visite.findMany({
      where:   { patientId, siteId },
      orderBy: { dateOuverture: 'desc' },
      select: {
        id:            true,
        dateOuverture: true,
        statut:        true,
        typeCloture:   true,
        motifPrincipal: { select: { libelle: true } },
        // deletedAt:null OBLIGATOIRE : l'extension soft-delete ne filtre PAS les
        // relations imbriquées → sans ça, une consultation supprimée resterait
        // visible dans le dossier patient (timeline). Vérifié E2E.
        consultations:  { where: { deletedAt: null }, select: { id: true, statut: true } },
      },
    })
  }

  // ── Détail visite ─────────────────────────────────────────────────────────

  async findById(id: string, siteId: string) {
    const visite = await this.prisma.visite.findFirst({
      where:   { id, siteId },
      include: VISITE_DETAIL_INCLUDE,
    })
    if (!visite) throw new NotFoundException('Visite introuvable')

    const soignant = visite.soignantId
      ? await this.prisma.personnelMedical.findUnique({
          where:  { id: visite.soignantId },
          select: PERSONNEL_SELECT,
        })
      : null

    // Enrichir les événements avec l'acteur (un seul query batch)
    const acteurIds = [...new Set(visite.evenements.map(e => e.acteurId))]
    const acteurs = acteurIds.length
      ? await this.prisma.personnelMedical.findMany({
          where: { id: { in: acteurIds } },
          select: PERSONNEL_SELECT,
        })
      : []
    const acteurMap = new Map(acteurs.map(a => [a.id, a]))
    const evenements = visite.evenements.map(e => ({
      ...e,
      acteur: acteurMap.get(e.acteurId) ?? null,
    }))

    return { ...visite, soignant, evenements }
  }

  // ── Ouverture visite ──────────────────────────────────────────────────────

  async create(dto: CreateVisiteDto, siteId: string, saisiePar: string) {
    // Dossier CENTRALISÉ : le patient est global (continuité de soins). Un travailleur
    // muté/de passage peut être reçu sur n'importe quel site sans recréer son dossier.
    // La VISITE, elle, est rattachée au site de l'utilisateur (siteId, plus bas).
    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
    })
    if (!patient) throw new NotFoundException('Patient introuvable')
    if (patient.statut !== 'ACTIF') throw new ConflictException("Le dossier patient n'est pas actif")

    const existing = await this.prisma.visite.findFirst({
      where: { patientId: dto.patientId, statut: { in: ETATS_MODIFIABLES } },
    })
    if (existing) {
      throw new ConflictException({
        message: 'Ce patient a déjà une visite ouverte',
        existingVisiteId: existing.id,
      })
    }

    const motif = await this.prisma.motifConsultation.findUnique({
      where: { id: dto.motifPrincipalId },
    })
    if (!motif) throw new NotFoundException('Motif introuvable')
    if (motif.statut !== 'ACTIF') throw new ConflictException('Motif inactif')

    if (dto.soignantId) {
      const soignant = await this.prisma.personnelMedical.findUnique({
        where: { id: dto.soignantId },
      })
      if (!soignant) throw new NotFoundException('Soignant introuvable')
      if (soignant.statut !== 'ACTIF') throw new ConflictException('Soignant inactif')
    }

    // Constantes saisies au triage : calcul IMC + nettoyage des valeurs vides.
    const c = dto.constantes
    const hasConstantes = c && Object.values(c).some(v => v != null)
    const imc = computeImc(c?.poids, c?.taille)
    const notes = dto.notesAccueil?.trim() || null

    // Acte de triage atomique : visite + notes + constantes dans une transaction.
    const visite = await this.prisma.$transaction(async tx => {
      const v = await tx.visite.create({
        data: {
          patientId:        dto.patientId,
          siteId,
          motifPrincipalId: dto.motifPrincipalId,
          soignantId:       dto.soignantId ?? null,
          notesAccueil:     notes,
        },
      })

      if (hasConstantes && c) {
        await tx.constanteVitale.create({
          data: {
            visiteId:           v.id,
            patientId:          dto.patientId,
            saisiePar,
            imc,
            temperature:        c.temperature        ?? null,
            tensionSystolique:  c.tensionSystolique   ?? null,
            tensionDiastolique: c.tensionDiastolique  ?? null,
            frequenceCardiaque: c.frequenceCardiaque  ?? null,
            saturationO2:       c.saturationO2        ?? null,
            poids:              c.poids               ?? null,
            taille:             c.taille              ?? null,
            glycemie:           c.glycemie            ?? null,
            etatConscience:     c.etatConscience      ?? null,
            scoreGlasgow:       c.scoreGlasgow        ?? null,
            etatGeneral:        c.etatGeneral         ?? null,
            hydratation:        c.hydratation         ?? null,
            coloration:         c.coloration          ?? null,
          },
        })
      }

      return tx.visite.findUniqueOrThrow({ where: { id: v.id }, include: VISITE_DETAIL_INCLUDE })
    })

    // Notification (diffusion site, visible par les détenteurs de visite.read)
    await this.notif.emit({
      type:               'VISITE_CREE',
      niveau:             'INFO',
      category:           'clinique',
      titre:              'Nouvelle visite au triage',
      message:            `${patient.numeroPatient} · ${motif.libelle}`,
      siteId,
      requiredPermission: 'visite.read',
      entiteType:         'visite',
      entiteId:           visite.id,
      lien:               '/triage',
      createdById:        saisiePar,
    })

    return { ...visite, soignant: null }
  }

  // ── Suppression définitive (visite.delete) ───────────────────────────────
  /**
   * Supprime DÉFINITIVEMENT une visite (et ses constantes/événements). Bloquée
   * si une consultation y est rattachée (la supprimer d'abord). Réservée aux
   * détenteurs de `visite.delete` — contrôle CRUD total côté gouvernance.
   */
  async deleteVisite(id: string, siteId: string) {
    const visite = await this.getVisiteOrThrow(id, siteId)
    const consults = await this.prisma.consultation.findMany({ where: { visiteId: id }, select: { id: true, statut: true } })

    if (consults.length) {
      // Une visite NON annulée garde le garde-fou strict (on ne supprime pas une consultation
      // ouverte/clôturée par ce biais — données médicales réelles).
      if (visite.statut !== 'ANNULEE') {
        throw new ConflictException("Cette visite a une consultation rattachée — supprimez d'abord la consultation")
      }
      // Visite ANNULÉE : suppression en cascade autorisée, mais SEULEMENT si chaque consultation
      // est elle-même ANNULÉE et SANS aucun document (ordonnance/bon/évacuation) — traçabilité préservée.
      for (const c of consults) {
        if (c.statut !== 'ANNULEE') {
          throw new ConflictException("Une consultation rattachée n'est pas annulée — impossible de supprimer la visite")
        }
        const [ord, bex, bph, evac, suivi, prenat, accident] = await Promise.all([
          this.prisma.ordonnance.count({ where: { consultationId: c.id } }),
          this.prisma.bonExamen.count({ where: { consultationId: c.id } }),
          this.prisma.bonPharmacie.count({ where: { consultationId: c.id } }),
          this.prisma.evacuation.count({ where: { consultationId: c.id } }),
          this.prisma.suiviChronique.count({ where: { consultationId: c.id } }),
          this.prisma.consultationPrenatale.count({ where: { consultationId: c.id } }),
          this.prisma.accidentTravail.count({ where: { consultationId: c.id } }),
        ])
        if (ord + bex + bph + evac + suivi + prenat + accident > 0) {
          throw new ConflictException('Une consultation rattachée porte des documents — supprimez-les d\'abord')
        }
      }
    }

    // Suppression réellement DÉFINITIVE : on passe par le client BRUT (this.prisma.raw)
    // pour contourner l'extension soft-delete. Sinon visite + constantes deviennent des
    // tombstones (update deletedAt) alors que visiteEvenement — hors allow-list — est, lui,
    // vraiment hard-deleté → on obtenait une visite fantôme avec son journal d'audit effacé.
    // L'action de suppression elle-même reste tracée par le journal d'audit global (@Audit).
    await this.prisma.raw.$transaction([
      // Consultations annulées rattachées (+ leurs diagnostics) — cascade ordre FK.
      ...consults.flatMap(c => [
        this.prisma.raw.diagnosticConsultation.deleteMany({ where: { consultationId: c.id } }),
        this.prisma.raw.consultation.delete({ where: { id: c.id } }),
      ]),
      this.prisma.raw.constanteVitale.deleteMany({ where: { visiteId: id } }),
      this.prisma.raw.visiteEvenement.deleteMany({ where: { visiteId: id } }),
      this.prisma.raw.visite.delete({ where: { id } }),
    ])
    return { deleted: true }
  }

  // ── Changement statut ─────────────────────────────────────────────────────

  async updateStatut(id: string, dto: UpdateStatutVisiteDto, acteurId: string, siteId: string) {
    this.assertActor(acteurId)
    const visite  = await this.getVisiteOrThrow(id, siteId)
    const courant = visite.statut as StatutVisite
    const cible   = dto.statut as StatutVisite

    if (courant === cible) return visite

    const autorisees = TRANSITIONS[courant]
    if (!autorisees.includes(cible)) {
      throw new BadRequestException(
        `Transition interdite : ${courant} → ${cible}. ` +
        `Transitions autorisées depuis ${courant} : ${autorisees.join(', ') || 'aucune'}`,
      )
    }

    if (cible === 'ANNULEE' && !dto.motifAnnulation?.trim()) {
      throw new BadRequestException('Un motif d\'annulation est obligatoire')
    }

    // Cohérence : on n'annule pas une visite tant qu'une consultation est ouverte.
    if (cible === 'ANNULEE') {
      const consOuverte = await this.prisma.consultation.findFirst({
        where: { visiteId: id, statut: 'OUVERTE' },
        select: { id: true },
      })
      if (consOuverte) {
        throw new ConflictException(
          'Une consultation est en cours pour cette visite — clôturez ou annulez la consultation d\'abord',
        )
      }
    }

    const data: any = { statut: cible }
    if (cible === 'ANNULEE') {
      data.dateCloture     = new Date()
      data.motifAnnulation = dto.motifAnnulation
    }

    return this.prisma.$transaction(async tx => {
      const updated = await tx.visite.update({ where: { id }, data })
      await tx.visiteEvenement.create({
        data: {
          visiteId:     id,
          type:         'STATUT_CHANGE',
          ancienneVal:  courant,
          nouvelleVal:  cible,
          acteurId,
          commentaire:  dto.motifAnnulation ?? dto.commentaire ?? null,
        },
      })
      return updated
    })
  }

  // ── Assignation soignant ──────────────────────────────────────────────────

  async updateSoignant(id: string, dto: UpdateSoignantVisiteDto, acteurId: string, siteId: string) {
    this.assertActor(acteurId)
    const visite = await this.getVisiteOrThrow(id, siteId)
    this.assertModifiable(visite.statut)

    const nouveauId = dto.soignantId ?? null
    if (visite.soignantId === nouveauId) return visite

    if (nouveauId) {
      const soignant = await this.prisma.personnelMedical.findUnique({
        where: { id: nouveauId },
      })
      if (!soignant) throw new NotFoundException('Soignant introuvable')
      if (soignant.statut !== 'ACTIF') throw new ConflictException('Soignant inactif')
    }

    return this.prisma.$transaction(async tx => {
      const updated = await tx.visite.update({ where: { id }, data: { soignantId: nouveauId } })
      await tx.visiteEvenement.create({
        data: {
          visiteId:    id,
          type:        'SOIGNANT_CHANGE',
          ancienneVal: visite.soignantId,
          nouvelleVal: nouveauId,
          acteurId,
        },
      })
      return updated
    })
  }

  // ── Notes d'accueil ───────────────────────────────────────────────────────

  async updateNotes(id: string, dto: UpdateNotesVisiteDto, acteurId: string, siteId: string) {
    this.assertActor(acteurId)
    const visite = await this.getVisiteOrThrow(id, siteId)
    this.assertModifiable(visite.statut)

    const nouvelle = dto.notesAccueil?.trim() || null

    return this.prisma.$transaction(async tx => {
      const updated = await tx.visite.update({ where: { id }, data: { notesAccueil: nouvelle } })
      await tx.visiteEvenement.create({
        data: {
          visiteId:    id,
          type:        'NOTES_UPDATE',
          ancienneVal: visite.notesAccueil ? '(modifiées)' : null,
          nouvelleVal: nouvelle ? '(saisies)' : '(effacées)',
          acteurId,
        },
      })
      return updated
    })
  }

  // ── Constantes vitales ────────────────────────────────────────────────────

  async createConstantes(id: string, dto: CreateConstanteVitaleDto, saisiePar: string, siteId: string) {
    this.assertActor(saisiePar)
    const visite = await this.getVisiteOrThrow(id, siteId)
    this.assertModifiable(visite.statut)

    // Au moins une valeur doit être renseignée
    const hasValue = Object.values(dto).some(v => v != null && v !== '')
    if (!hasValue) {
      throw new BadRequestException('Au moins une constante doit être saisie')
    }

    // Calcul IMC automatique (helper partagé — source unique de la formule)
    const imc = computeImc(dto.poids, dto.taille)

    return this.prisma.constanteVitale.create({
      data: {
        visiteId:          id,
        patientId:         visite.patientId,
        saisiePar,
        imc,
        temperature:        dto.temperature       ?? null,
        tensionSystolique:  dto.tensionSystolique  ?? null,
        tensionDiastolique: dto.tensionDiastolique ?? null,
        frequenceCardiaque: dto.frequenceCardiaque ?? null,
        saturationO2:       dto.saturationO2       ?? null,
        poids:              dto.poids              ?? null,
        taille:             dto.taille             ?? null,
        glycemie:           dto.glycemie           ?? null,
        etatConscience:     dto.etatConscience     ?? null,
        scoreGlasgow:       dto.scoreGlasgow       ?? null,
        etatGeneral:        dto.etatGeneral        ?? null,
        hydratation:        dto.hydratation        ?? null,
        coloration:         dto.coloration         ?? null,
      },
    })
  }
}
