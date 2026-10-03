/**
 * SuiviTraitementService — épisodes de suivi (contrôle d'état de santé,
 * évolution d'une maladie, traitement en cours). Ouvert depuis une consultation
 * clôturée (décision SUIVI_TRAITEMENT, comme EVACUATION) ; les fiches datées
 * s'ajoutent ensuite depuis le dossier patient, sans repasser par triage/consultation.
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'

/**
 * Portée de lecture d'un suivi de traitement — la même que le reste du dossier.
 *  - canViewLocked : supervision (médecin chef, admin) ; un dossier VERROUILLÉ n'est
 *    lisible que par elle. Avant, /suivi-traitement ignorait le verrou : motifs, fiches,
 *    médicaments administrés et constantes d'un dossier fermé restaient lisibles.
 *  - restreindreHistorique : infirmier hors supervision ; il voit les épisodes EN COURS
 *    (soins actuels — c'est lui qui y saisit les fiches), pas l'historique clos.
 */
export interface PorteeSuivi {
  canViewLocked: boolean
  restreindreHistorique: boolean
}
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationService } from '../notification/notification.service'
import {
  CreateSuiviTraitementDto,
  AddFicheSuiviDto,
  CloturerSuiviTraitementDto,
  AnnulerSuiviTraitementDto,
  SuiviTraitementQueryDto,
} from './dto/suivi-traitement.dto'

const SUIVI_TRAITEMENT_INCLUDE = {
  consultation: {
    select: {
      id: true,
      createdAt: true,
      visite: {
        select: {
          patient: {
            select: {
              id: true,
              numeroPatient: true,
              identite: {
                select: {
                  nom: true,
                  prenom: true,
                  dateNaissance: true,
                  sexe: true,
                },
              },
            },
          },
        },
      },
    },
  },
  fiches: { orderBy: { createdAt: 'desc' as const } },
} as const

// Une fiche entièrement vide n'a aucune valeur clinique.
const FICHE_FIELDS = [
  'temperature',
  'tensionSystolique',
  'tensionDiastolique',
  'frequenceCardiaque',
  'frequenceRespiratoire',
  'saturationO2',
  'poids',
  'noteEvolution',
  'medicamentsAdministres',
  'resultatExamen',
] as const

@Injectable()
export class SuiviTraitementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notif: NotificationService,
  ) {}

  // Volontairement SANS filtre de site : l'accès est gouverné uniquement par les
  // permissions (suivi_traitement.read/update/cancel/close), pas par le site.
  private async getOrThrow(id: string) {
    const s = await this.prisma.suiviTraitement.findFirst({
      where: { id },
      include: SUIVI_TRAITEMENT_INCLUDE,
    })
    if (!s) throw new NotFoundException('Suivi de traitement introuvable')
    return (await this.avecAuteurs([s]))[0]
  }

  /**
   * Nom lisible de l'auteur de chaque fiche (constat 88) : `createdBy` est un id
   * Utilisateur sans relation Prisma — résolu comme pour les constantes du dossier
   * (nom du soignant, login à défaut).
   */
  private async avecAuteurs<T extends { fiches: { createdBy: string | null }[] }>(suivis: T[]) {
    const ids = [...new Set(suivis.flatMap((s) => s.fiches.map((f) => f.createdBy)).filter((x): x is string => !!x))]
    const users = ids.length
      ? await this.prisma.utilisateur.findMany({
          where: { id: { in: ids } },
          select: { id: true, login: true, personnelMedical: { select: { nom: true, prenom: true } } },
        })
      : []
    const noms = new Map(users.map((u) => [
      u.id,
      u.personnelMedical ? `${u.personnelMedical.prenom} ${u.personnelMedical.nom}` : u.login,
    ]))
    return suivis.map((s) => ({
      ...s,
      fiches: s.fiches.map((f) => ({ ...f, auteurNom: f.createdBy ? noms.get(f.createdBy) ?? null : null })),
    }))
  }

  /** Refuse l'accès au suivi d'un dossier verrouillé hors supervision. */
  private async assertNonVerrouille(id: string, portee?: PorteeSuivi) {
    if (!portee || portee.canViewLocked) return
    const s = await this.prisma.suiviTraitement.findFirst({
      where: { id },
      select: {
        consultation: {
          select: { visite: { select: { patient: { select: { verrouille: true } } } } },
        },
      },
    })
    if (s?.consultation?.visite?.patient?.verrouille) {
      throw new ForbiddenException(
        'Dossier verrouillé : accès réservé au médecin chef',
      )
    }
  }

  async findAll(query: SuiviTraitementQueryDto, portee?: PorteeSuivi) {
    // Volontairement SANS filtre de site (accès gouverné par permission).
    const where: any = {}
    const visite: any = {}
    if (query.patientId) visite.patientId = query.patientId
    // Verrou : jamais le contenu d'un dossier verrouillé hors supervision.
    if (portee && !portee.canViewLocked) visite.patient = { verrouille: false }
    if (Object.keys(visite).length) where.consultation = { visite }
    if (query.consultationId) where.consultationId = query.consultationId
    if (query.statut && query.statut !== 'TOUS') where.statut = query.statut
    // Infirmier, depuis le dossier : les épisodes EN COURS seulement.
    if (portee?.restreindreHistorique && query.patientId) {
      if (where.statut && where.statut !== 'EN_COURS') return []
      where.statut = 'EN_COURS'
    }

    const suivis = await this.prisma.suiviTraitement.findMany({
      where,
      include: SUIVI_TRAITEMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return this.avecAuteurs(suivis)
  }

  async findById(id: string, portee?: PorteeSuivi) {
    await this.assertNonVerrouille(id, portee)
    const s = await this.getOrThrow(id)
    if (portee?.restreindreHistorique && s.statut !== 'EN_COURS') {
      throw new ForbiddenException(
        "Suivi clôturé : l'historique est réservé au médecin chef",
      )
    }
    return s
  }

  /** Garde commune aux écritures : pas d'écriture dans un dossier qu'on ne peut pas lire. */
  async assertModifiable(id: string, portee?: PorteeSuivi) {
    await this.assertNonVerrouille(id, portee)
  }

  async create(dto: CreateSuiviTraitementDto, acteurId?: string) {
    const c = await this.prisma.consultation.findFirst({
      where: { id: dto.consultationId },
    })
    if (!c) throw new NotFoundException('Consultation introuvable')
    // Une consultation annulée n'a plus de décision médicale : rien ne s'y rattache.
    if (c.statut === 'ANNULEE') {
      throw new ConflictException(
        'Consultation annulée : aucun suivi de traitement ne peut y être rattaché',
      )
    }

    // Décision médicale = choix unique (Évacuation OU Suivi de traitement, jamais les
    // deux) — vérifié ici et pas seulement dans le picker frontend, qui ne fait que
    // refléter cette contrainte réelle.
    const evacuationActive = await this.prisma.evacuation.findFirst({
      where: { consultationId: dto.consultationId, statut: { not: 'ANNULE' } },
    })
    if (evacuationActive) {
      throw new ConflictException(
        'Une évacuation est déjà active pour cette consultation — annulez-la avant de créer un suivi de traitement',
      )
    }

    // Unicité (@unique sur consultationId). Lecture sur le client BRUT (`raw`)
    // pour voir les tombstones soft-supprimés et pouvoir les ressusciter.
    const existing = await this.prisma.raw.suiviTraitement.findUnique({
      where: { consultationId: dto.consultationId },
    })
    if (existing && !existing.deletedAt && existing.statut !== 'ANNULE') {
      throw new ConflictException({
        message: 'Un suivi de traitement existe déjà pour cette consultation',
        existingSuiviTraitementId: existing.id,
      })
    }

    // Si un suivi ANNULÉ existe, on le réactive (resaisie) : reset + purge des
    // anciennes fiches, dans une transaction. Sinon, création.
    if (existing) {
      await this.prisma.$transaction(async (tx) => {
        await tx.ficheSuiviTraitement.deleteMany({
          where: { suiviTraitementId: existing.id },
        })
        await tx.suiviTraitement.update({
          where: { id: existing.id },
          data: {
            motif: dto.motif.trim(),
            statut: 'EN_COURS',
            motifCloture: null,
            motifAnnulation: null,
            closedAt: null,
            deletedAt: null,
          },
        })
      })
      return this.getOrThrow(existing.id)
    }

    const created = await this.prisma.suiviTraitement.create({
      data: {
        consultationId: dto.consultationId,
        motif: dto.motif.trim(),
        statut: 'EN_COURS',
      },
    })
    await this.notif.emit({
      type: 'SUIVI_TRAITEMENT_OUVERT',
      niveau: 'INFO',
      category: 'clinique',
      titre: 'Suivi de traitement ouvert',
      message: dto.motif.trim(),
      siteId: null,
      requiredPermission: 'suivi_traitement.read',
      entiteType: 'suivi_traitement',
      entiteId: created.id,
      lien: '/patients',
      createdById: acteurId ?? null,
      concernedPersonnelIds: c.soignantId ? [c.soignantId] : [],
    })
    return this.getOrThrow(created.id)
  }

  async addFiche(id: string, dto: AddFicheSuiviDto, acteurId: string) {
    const s = await this.getOrThrow(id)
    if (s.statut === 'CLOTURE' || s.statut === 'ANNULE') {
      throw new ConflictException(
        'Suivi de traitement déjà ' + s.statut.toLowerCase(),
      )
    }
    if (
      !FICHE_FIELDS.some(
        (f) => dto[f] !== undefined && dto[f] !== null && dto[f] !== '',
      )
    ) {
      throw new BadRequestException(
        'Une fiche de suivi doit contenir au moins une information (constante, note, médicament ou résultat)',
      )
    }

    await this.prisma.ficheSuiviTraitement.create({
      data: {
        suiviTraitementId: id,
        temperature: dto.temperature ?? null,
        tensionSystolique: dto.tensionSystolique ?? null,
        tensionDiastolique: dto.tensionDiastolique ?? null,
        frequenceCardiaque: dto.frequenceCardiaque ?? null,
        frequenceRespiratoire: dto.frequenceRespiratoire ?? null,
        saturationO2: dto.saturationO2 ?? null,
        poids: dto.poids ?? null,
        noteEvolution: dto.noteEvolution?.trim() || null,
        medicamentsAdministres: dto.medicamentsAdministres?.trim() || null,
        resultatExamen: dto.resultatExamen?.trim() || null,
        createdBy: acteurId,
      },
    })
    return this.getOrThrow(id)
  }

  /**
   * Corrige une fiche déjà enregistrée (erreur de saisie, champ oublié) SANS
   * créer de doublon — contrairement à addFiche, la date (createdAt) et l'auteur
   * d'origine (createdBy) ne changent pas. L'historique jour par jour (une fiche
   * par passage) reste donc intact ; seule la fiche visée est corrigée en place.
   */
  async updateFiche(id: string, ficheId: string, dto: AddFicheSuiviDto) {
    const s = await this.getOrThrow(id)
    if (s.statut === 'CLOTURE' || s.statut === 'ANNULE') {
      throw new ConflictException(
        'Suivi de traitement déjà ' + s.statut.toLowerCase(),
      )
    }
    const fiche = await this.prisma.ficheSuiviTraitement.findFirst({
      where: { id: ficheId, suiviTraitementId: id },
    })
    if (!fiche) throw new NotFoundException('Fiche de suivi introuvable')
    if (
      !FICHE_FIELDS.some(
        (f) => dto[f] !== undefined && dto[f] !== null && dto[f] !== '',
      )
    ) {
      throw new BadRequestException(
        'Une fiche de suivi doit contenir au moins une information (constante, note, médicament ou résultat)',
      )
    }

    await this.prisma.ficheSuiviTraitement.update({
      where: { id: ficheId },
      data: {
        temperature: dto.temperature ?? null,
        tensionSystolique: dto.tensionSystolique ?? null,
        tensionDiastolique: dto.tensionDiastolique ?? null,
        frequenceCardiaque: dto.frequenceCardiaque ?? null,
        frequenceRespiratoire: dto.frequenceRespiratoire ?? null,
        saturationO2: dto.saturationO2 ?? null,
        poids: dto.poids ?? null,
        noteEvolution: dto.noteEvolution?.trim() || null,
        medicamentsAdministres: dto.medicamentsAdministres?.trim() || null,
        resultatExamen: dto.resultatExamen?.trim() || null,
      },
    })
    return this.getOrThrow(id)
  }

  async cloturer(id: string, dto: CloturerSuiviTraitementDto) {
    const s = await this.getOrThrow(id)
    if (s.statut !== 'EN_COURS') {
      throw new ConflictException('Seul un suivi EN_COURS peut être clôturé')
    }
    await this.prisma.suiviTraitement.update({
      where: { id },
      data: {
        statut: 'CLOTURE',
        motifCloture: dto.motifCloture?.trim() || null,
        closedAt: new Date(),
      },
    })
    return this.getOrThrow(id)
  }

  async annuler(id: string, dto: AnnulerSuiviTraitementDto) {
    const s = await this.getOrThrow(id)
    if (s.statut !== 'EN_COURS') {
      throw new ConflictException('Seul un suivi EN_COURS peut être annulé')
    }
    await this.prisma.suiviTraitement.update({
      where: { id },
      data: { statut: 'ANNULE', motifAnnulation: dto.motifAnnulation.trim() },
    })
    return this.getOrThrow(id)
  }

  /**
   * Suppression définitive d'un suivi de traitement + ses fiches (perm
   * suivi_traitement.delete). Volontairement SANS filtre de site : déclenchée
   * aussi depuis le dossier patient CENTRALISÉ (suivis des deux sites).
   */
  async delete(id: string) {
    await this.getOrThrow(id)
    await this.prisma.$transaction([
      this.prisma.ficheSuiviTraitement.deleteMany({
        where: { suiviTraitementId: id },
      }),
      this.prisma.suiviTraitement.delete({ where: { id } }),
    ])
    return { id, deleted: true }
  }
}
