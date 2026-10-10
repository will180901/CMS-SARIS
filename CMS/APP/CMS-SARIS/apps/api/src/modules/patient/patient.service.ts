/**
 * PatientService — Module 4 · Dossier Patient CMS SARIS
 *
 * Gère : patients, identités, allergies, antécédents,
 *        alertes médicales, rattachements CDI + sous-traitants.
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { StatutPatient, Prisma } from '@prisma/client'
import sharp from 'sharp'
import { PrismaService } from '../../prisma/prisma.service'
import { CI } from '../../common/prisma/search'
import { NotificationService } from '../notification/notification.service'
import { PARCOURS_EN_COURS } from '../../common/clinical'
import { couverturePatient } from '../../common/droits-categorie'
import {
  CreatePatientDto,
  UpdateIdentiteDto,
  UpsertModeVieDto,
  ChangerCategorieDto,
  ToggleStatutPatientDto,
  PatientQueryDto,
  OuvrirDossierPersonnelDto,
} from './dto/patient.dto'
import { CreateAllergieDto, UpdateAllergieDto } from './dto/medical.dto'
import { RattacherAyantDroitDto } from './dto/rattachement.dto'
import { CreateAntecedentDto, UpdateAntecedentDto } from './dto/medical.dto'
import {
  CreateAlerteMedicaleDto,
  UpdateAlerteMedicaleDto,
} from './dto/medical.dto'
import {
  CreateSuiviChroniqueDto,
  UpdateSuiviChroniqueDto,
} from './dto/medical.dto'
import { UpdateRattachementADDto } from './dto/rattachement.dto'

// ── Alertes cliniques calculées ─────────────────────────────────────────────────

export interface AlerteClinique {
  type: 'ALLERGIE_MEDICAMENT' | 'CONSTANTE_CRITIQUE' | 'CHRONIQUE_SANS_SUIVI' | 'CONTROLE_EN_RETARD'
  gravite: 'CRITIQUE' | 'ELEVE' | 'MODERE'
  titre: string
  /** Objet de l'alerte en quelques mots (médicament, valeur mesurée, pathologie) : ce
   *  que la vue condensée du bloc « Sécurité clinique » affiche à côté du titre. */
  sujet: string
  detail: string
  /** Date de la donnee qui declenche l'alerte : mesure, prescription ou diagnostic. */
  date: string | null
  /** ACTUELLE : la donnee appartient au parcours en cours — alerte en couleur.
   *  HISTORIQUE : donnee d'un parcours termine — rappel date, ton neutre. Sans cette
   *  distinction, une SpO2 de juillet se lisait en octobre comme un etat actuel. */
  portee: 'ACTUELLE' | 'HISTORIQUE'
}

/**
 * Consultations qui ALIMENTENT le dossier (pathologies, traitements, resultats, alertes).
 *
 * Une consultation ANNULEE n'en fait jamais partie. L'annulation (ConsultationService.
 * annuler) ne touche ni ses diagnostics, ni ses ordonnances, ni ses bons : sans ce filtre,
 * une consultation ouverte par erreur sur un homonyme laissait dans SON dossier une
 * « HTA » chronique, un traitement « Validee » et un examen « en attente de saisie »
 * pour toujours.
 *
 * Pour l'infirmier (recueil §5), seule la consultation EN COURS compte. Une consultation
 * n'existe que sur une visite deja CLOTUREE (ou remise en file apres annulation) : le
 * parcours en cours, cote consultation, c'est donc exactement « statut OUVERTE » — la
 * meme regle que la liste des consultations et les documents du dossier.
 */
/**
 * Fin estimée d'un traitement à partir de sa durée en texte libre (« 30 jours »,
 * « 2 semaines », « 1 mois », « 5 j »). `null` si la durée n'est pas lisible : on ne
 * devine jamais une fin.
 */
function finDeTraitement(debut: Date, duree: string | null | undefined): Date | null {
  const m = duree?.toLowerCase().match(/(\d+)\s*(jours?|j\b|semaines?|sem\b|mois)/)
  if (!m) return null
  const n = parseInt(m[1]!, 10)
  if (!n) return null
  const fin = new Date(debut)
  if (m[2]!.startsWith('sem')) fin.setDate(fin.getDate() + n * 7)
  else if (m[2]!.startsWith('mois')) fin.setMonth(fin.getMonth() + n)
  else fin.setDate(fin.getDate() + n)
  return fin
}

/** Identité saisie pour un travailleur CDI qui n'a pas encore de dossier. */
interface TravailleurCdiSaisie {
  nom: string
  prenom: string
  dateNaissance?: string
  sexe?: string
  fonction?: string
  sectionPaie?: string
  service?: string
  departement?: string
}
/** Travailleur CDI d'un rattachement : son dossier patient existe, ou il est à créer. */
interface TravailleurCdi {
  id: string
  nom: string
  prenom: string
  matricule: string
}
type PlanCdi =
  | { existant: TravailleurCdi }
  | { aCreer: TravailleurCdiSaisie & { matricule: string } }

function consultationsDuDossier(
  patientId: string,
  restreindreHistorique?: boolean,
): Prisma.ConsultationWhereInput {
  return restreindreHistorique
    ? { visite: { patientId }, statut: 'OUVERTE' }
    : { visite: { patientId }, statut: { not: 'ANNULEE' } }
}

// ── Helpers de rapprochement (détection de doublons) ───────────────────────────

/** Minuscule, sans accents, espaces normalisés — pour comparer des noms. */
function normaliser(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/** Distance de Levenshtein (tolérance aux fautes de frappe). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length,
    n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  let cur = new Array(n + 1).fill(0)
  for (let i = 1; i <= m; i++) {
    cur[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, cur] = [cur, prev]
  }
  return prev[n]
}

function isoDate(d: Date | string | null | undefined): string | null {
  if (!d) return null
  const dt = typeof d === 'string' ? new Date(d) : d
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10)
}

// ── Includes Prisma ───────────────────────────────────────────────────────────

const CATEGORIE_SELECT = {
  select: { id: true, code: true, libelle: true },
} as const
const SITE_SELECT = { select: { id: true, code: true, libelle: true } } as const

const LISTE_INCLUDE = {
  identite: true,
  categoriePatient: CATEGORIE_SELECT,
  siteCreation: SITE_SELECT,
  // deletedAt:null OBLIGATOIRE : l'extension soft-delete ne filtre pas les relations —
  // sans lui, une allergie/alerte SUPPRIMÉE restait affichée comme critique.
  allergies: {
    where: { statut: 'ACTIVE', gravite: 'SEVERE', deletedAt: null },
    select: {
      id: true,
      substance: true,
      gravite: true,
      confirme: true,
      statut: true,
      createdAt: true,
      patientId: true,
    },
  },
  alertesMedicales: {
    where: { statut: 'ACTIVE', deletedAt: null },
    select: {
      id: true,
      type: true,
      gravite: true,
      message: true,
      statut: true,
      createdAt: true,
      resolvedAt: true,
      patientId: true,
    },
  },
} as const

const DOSSIER_INCLUDE = {
  identite: true,
  contactUrgence: true,
  donneesEmploi: true,
  modeVie: true,
  categoriePatient: CATEGORIE_SELECT,
  siteCreation: SITE_SELECT,
  // ⚠️ `where: { deletedAt: null }` explicite sur les relations soft-deletables : les
  // include imbriqués Prisma ne reçoivent PAS le filtre de l'extension soft-delete, sinon
  // le dossier laisse fuiter les sous-ressources supprimées (tombstones).
  allergies: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' as const },
  },
  antecedents: {
    where: { deletedAt: null },
    include: {
      pathologie: {
        select: { id: true, libelle: true, confidentialiteRenforcee: true },
      },
    },
  }, // AntecedentPatient n'a pas de createdAt
  alertesMedicales: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' as const },
  },
  historiquesCateg: {
    include: { nouvelleCategorie: CATEGORIE_SELECT },
    orderBy: { createdAt: 'desc' as const },
  },
  rattachementsAD: {
    where: { deletedAt: null },
    include: { historiques: { orderBy: { createdAt: 'desc' as const } } },
    orderBy: { dateDebut: 'desc' as const },
  },
  rattachementsST: {
    where: { deletedAt: null },
    include: {
      societe: { select: { id: true, nom: true, statut: true } },
      historiques: { orderBy: { createdAt: 'desc' as const } },
    },
    orderBy: { dateDebut: 'desc' as const },
  },
} as const

// ── Service ───────────────────────────────────────────────────────────────────

// Fonction portée dans le dossier d'un membre du personnel : son métier au centre,
// nommé comme dans le choix de la fonction de sa fiche (apps/web/src/config/fonctions.ts).
const FONCTION_PERSONNEL: Record<string, string> = {
  MEDECIN: 'Médecin Chef',
  INFIRMIER: 'Infirmier',
  ADMINISTRATIF: 'Administrateur Système',
  SAGE_FEMME: 'Sage-femme',
  TECHNICIEN_LAB: 'Technicien de laboratoire',
}
function libelleFonction(role: string) {
  return FONCTION_PERSONNEL[role] ?? role
}

/** Ce qu'il faut sur la fiche du personnel pour lui ouvrir un dossier, en plus du reste. */
type ChampOuverture = 'dateNaissance' | 'sexe' | 'sectionPaie' | 'departement'
const LIBELLE_CHAMP: Record<ChampOuverture, string> = {
  dateNaissance: 'date de naissance',
  sexe: 'sexe',
  sectionPaie: 'section de paie',
  departement: 'département',
}
function champsManquants(
  f: Partial<Record<ChampOuverture, Date | string | null>>,
): ChampOuverture[] {
  return (Object.keys(LIBELLE_CHAMP) as ChampOuverture[]).filter((c) => {
    const v = f[c]
    return v === null || v === undefined || (typeof v === 'string' && !v.trim())
  })
}

@Injectable()
export class PatientService {
  private readonly logger = new Logger(PatientService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notif: NotificationService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  // `floorNum` : plus petit numéro déjà réservé dans CETTE requête (pas encore commité,
  // donc invisible à `.raw`) — évite la collision quand deux dossiers du même site sont
  // créés dans la même transaction (ex. ayant droit + dossier vide de son CDI, create()
  // ci-dessous) : le `.raw` ne voit pas le premier tant que la transaction n'est pas
  // validée, donc sans ce plancher les deux calculeraient le même « prochain numéro ».
  private async generateNumeroPatient(
    siteCreationId: string,
    floorNum = 0,
  ): Promise<string> {
    const site = await this.prisma.site.findUniqueOrThrow({
      where: { id: siteCreationId },
      select: { code: true },
    })
    // Préfixe dérivé du code du site (3 premières lettres) — généralise à N sites au
    // lieu d'un ternaire à 2 branches codé en dur (reproduit exactement MOU/NKA pour
    // les codes MOUTELA/NKAYI existants). Unicité du préfixe garantie à la création
    // du site (ReferentielsService.createSite).
    const prefix = site.code.slice(0, 3).toUpperCase()
    // Numéro = (plus grand n° existant pour ce site) + 1. On lit sur le client BRUT
    // (`raw`) pour INCLURE les patients soft-supprimés : leur numeroPatient reste pris
    // (le @unique couvre les tombstones). Un `count` FILTRÉ par deletedAt collisionnerait
    // après une suppression ; baser sur le MAX évite aussi les trous de séquence.
    const last = await this.prisma.raw.patient.findFirst({
      where: {
        siteCreationId,
        numeroPatient: { startsWith: `PAT-${prefix}-` },
      },
      orderBy: { numeroPatient: 'desc' },
      select: { numeroPatient: true },
    })
    const lastNum = Math.max(
      last ? parseInt(last.numeroPatient.slice(-5), 10) || 0 : 0,
      floorNum,
    )
    return `PAT-${prefix}-${String(lastNum + 1).padStart(5, '0')}`
  }

  private async assertPatientExists(id: string) {
    const p = await this.prisma.patient.findUnique({ where: { id } })
    if (!p) throw new NotFoundException(`Patient ${id} introuvable`)
    return p
  }

  // ── Liste patients ────────────────────────────────────────────────────────

  async findAll(query: PatientQueryDto) {
    const { search, categorieId, siteId, statut } = query
    return this.prisma.patient.findMany({
      where: {
        ...(statut && { statut: statut as StatutPatient }),
        ...(categorieId && { categoriePatientId: categorieId }),
        ...(siteId && { siteCreationId: siteId }),
        ...(search && {
          OR: [
            { numeroPatient: { contains: search, ...CI } },
            { matricule: { contains: search, ...CI } },
            { identite: { nom: { contains: search, ...CI } } },
            { identite: { prenom: { contains: search, ...CI } } },
          ],
        }),
      },
      include: LISTE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  // ── Détection de doublons (triage intelligent) ─────────────────────────────

  /**
   * Renvoie les patients ressemblant à l'identité saisie (même site), pour éviter
   * la création de doublons au triage. Rapprochement par : nom+prénom proches
   * (tolérance fautes), même date de naissance, ou nom/prénom identiques.
   */
  async findSimilar(
    input: {
      nom: string
      prenom: string
      dateNaissance?: string
      sexe?: string
    },
    siteId?: string,
  ) {
    const nom = normaliser(input.nom)
    const prenom = normaliser(input.prenom)
    if (nom.length < 2 || prenom.length < 2) return []

    // PRÉ-FILTRE EN BASE (constat 105). Avant : 1 000 dossiers pris au hasard (sans
    // tri), puis comparés — au-delà de 1 000 patients, un doublon pouvait tout simplement
    // ne jamais être examiné. On ne garde désormais que les dossiers plausibles : même
    // initiale de nom ou de prénom (dans les deux sens, pour l'inversion nom/prénom),
    // ou même date de naissance.
    const initiales = [
      ...new Set(
        [input.nom.trim()[0], input.prenom.trim()[0], nom[0], prenom[0]].filter(
          (c): c is string => !!c,
        ),
      ),
    ]
    const dobIso = input.dateNaissance ? isoDate(input.dateNaissance) : null
    const jour = dobIso ? new Date(`${dobIso}T00:00:00.000Z`) : null
    const lendemain = jour ? new Date(jour.getTime() + 86_400_000) : null
    const candidats = await this.prisma.patient.findMany({
      where: {
        statut: 'ACTIF',
        ...(siteId && { siteCreationId: siteId }),
        identite: {
          is: {
            OR: [
              ...initiales.flatMap((l) => [
                { nom: { startsWith: l, ...CI } },
                { prenom: { startsWith: l, ...CI } },
              ]),
              ...(jour && lendemain
                ? [{ dateNaissance: { gte: jour, lt: lendemain } }]
                : []),
            ],
          },
        },
      },
      include: {
        identite: true,
        categoriePatient: CATEGORIE_SELECT,
        siteCreation: SITE_SELECT,
      },
      take: 3000,
    })

    const cibleFull = `${prenom} ${nom}`
    const dobCible = input.dateNaissance ? isoDate(input.dateNaissance) : null

    const scored = candidats
      .map((p) => {
        const pNom = normaliser(p.identite?.nom)
        const pPrenom = normaliser(p.identite?.prenom)
        const full = `${pPrenom} ${pNom}`
        // Inversion nom/prénom (constat 105) : « Kevin MBEMBA » saisi « MBEMBA Kevin »
        // n'était jamais rapproché — on compare aussi dans l'autre sens.
        const dist = Math.min(
          levenshtein(cibleFull, full),
          levenshtein(cibleFull, `${pNom} ${pPrenom}`),
        )
        const sameDob =
          !!dobCible && isoDate(p.identite?.dateNaissance) === dobCible
        const nomEq = pNom === nom || pPrenom === nom
        const prenomEq = pPrenom === prenom || pNom === prenom
        const isMatch =
          dist <= 2 || (nomEq && prenomEq) || (sameDob && (nomEq || prenomEq))
        return { p, dist, sameDob, exact: nomEq && prenomEq, isMatch }
      })
      .filter((x) => x.isMatch)
      .sort((a, b) => a.dist - b.dist || Number(b.sameDob) - Number(a.sameDob))
      .slice(0, 6)

    return scored.map((x) => ({
      id: x.p.id,
      numeroPatient: x.p.numeroPatient,
      identite: x.p.identite,
      categoriePatient: x.p.categoriePatient,
      site: x.p.siteCreation,
      correspondanceDate: x.sameDob,
      correspondanceExacte: x.exact,
    }))
  }

  // ── Dossier complet ───────────────────────────────────────────────────────

  /** Rapprochement par matricule employeur (inscription d'un ayant droit). */
  async findByMatricule(matricule: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { matricule },
      select: {
        id: true,
        numeroPatient: true,
        matricule: true,
        statut: true,
        categoriePatient: { select: { code: true, libelle: true } },
        identite: {
          select: { nom: true, prenom: true, dateNaissance: true, sexe: true },
        },
      },
    })
    if (!patient)
      throw new NotFoundException('Aucun dossier patient pour ce matricule')
    return patient
  }

  /**
   * Ayants droit d'un travailleur CDI + leur activité médicale récente — traçabilité
   * dans le dossier du travailleur (l'assuré responsable). Les relations imbriquées
   * portent `deletedAt:null` (l'extension soft-delete ne filtre que le top-level).
   */
  async findAyantsDroits(
    cdiPatientId: string,
    scope?: {
      /** Supervision (medecin-chef, admin) : voit l'activite d'un dossier verrouille. */
      canViewLocked?: boolean
      /** Infirmier : l'historique d'un AUTRE patient ne le concerne pas. */
      restreindreHistorique?: boolean
      /** Lecture clinique (consultation.read) : un motif de visite est une donnee
       *  medicale, pas une donnee administrative. */
      canViewClinique?: boolean
    },
  ) {
    // Les ayants droit sont rattachés au DOSSIER du travailleur CDI (cdiId).
    // Rattachements CLOS compris (constat 51) : ils disparaissaient de la fiche du CDI,
    // qui ne gardait aucune trace de ses anciens ayants droit. Actifs d'abord
    // ('ACTIF' < 'INACTIF'), puis du plus récent au plus ancien.
    const liens = await this.prisma.rattachementAyantDroitCdi.findMany({
      where: { cdiId: cdiPatientId },
      orderBy: [{ statut: 'asc' }, { dateDebut: 'desc' }],
      select: {
        id: true,
        typeLien: true,
        dateDebut: true,
        dateFin: true,
        statut: true,
        patient: {
          select: {
            id: true,
            numeroPatient: true,
            verrouille: true,
            categoriePatient: { select: { code: true, libelle: true } },
            identite: {
              select: {
                nom: true,
                prenom: true,
                dateNaissance: true,
                sexe: true,
              },
            },
            visites: {
              where: { deletedAt: null }, // dossier centralisé : activité de l'ayant droit suit le patient (tous sites)
              orderBy: { dateOuverture: 'desc' },
              take: 5,
              select: {
                id: true,
                dateOuverture: true,
                statut: true,
                motifPrincipal: { select: { libelle: true } },
                consultations: {
                  where: { deletedAt: null },
                  select: { id: true, statut: true },
                },
              },
            },
          },
        },
      },
    })

    // VERROU ET CONFIDENTIALITE. Les motifs des dernieres visites d'un ayant droit
    // s'affichaient dans le dossier de son CDI sans jamais regarder si SON dossier etait
    // verrouille : le dossier d'un adolescent ferme par le medecin-chef laissait lire ses
    // motifs de visite dans celui de son parent. Ils s'affichaient aussi a tout porteur
    // de `patient.read`, droit administratif, alors qu'un motif de visite est clinique.
    //
    // On retire l'activite AVANT qu'elle ne quitte le serveur, et on le DIT
    // (`activiteMasquee`) : renvoyer une liste vide ferait afficher « aucune activite
    // recente », ce qui serait faux — la meme faute que les compteurs a zero d'un
    // dossier verrouille.
    return liens.map((l) => {
      const masquee =
        !scope?.canViewClinique ||
        !!scope?.restreindreHistorique ||
        (l.patient.verrouille && !scope?.canViewLocked)
      const { verrouille, ...patient } = l.patient
      return {
        ...l,
        patient: {
          ...patient,
          verrouille,
          activiteMasquee: masquee,
          visites: masquee ? [] : patient.visites,
        },
      }
    })
  }

  /** Confidentialité : un médecin restreint (hors supervision) ne peut accéder qu'aux
   *  patients qu'il SUIT (consultation ou visite dont il est le soignant). No-op sinon. */
  private async assertOwnPatient(
    patientId: string,
    scope?: { restrictToOwn: boolean; personnelMedicalId: string | null },
  ) {
    if (!scope?.restrictToOwn) return
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

  async findById(
    id: string,
    scope?: {
      restrictToOwn: boolean
      personnelMedicalId: string | null
      canViewLocked?: boolean
      restreindreHistorique?: boolean
      /** Sans `patient.confidentiel.read` : pathologies à confidentialité renforcée masquées. */
      masquerConfidentiel?: boolean
      /** `consultation.read` : antécédents et mode de vie sont des données CLINIQUES. */
      canViewClinique?: boolean
    },
  ) {
    const dossier = await this.prisma.patient.findUnique({
      where: { id },
      include: DOSSIER_INCLUDE,
    })
    if (!dossier) throw new NotFoundException(`Patient ${id} introuvable`)
    await this.assertOwnPatient(id, scope)

    // Confidentialité renforcée (VIH/SIDA, santé mentale, etc.) : un antécédent lié à
    // une pathologie marquée `confidentialiteRenforcee` est masqué à qui n'a pas la
    // permission `patient.confidentiel.read`, même si le reste des antécédents (sécurité
    // clinique de base) lui reste visible.
    const antecedents = scope?.masquerConfidentiel
      ? dossier.antecedents.filter(
          (a) => !a.pathologie?.confidentialiteRenforcee,
        )
      : dossier.antecedents

    // Le CDI rattaché à un ayant droit : `cdiId` = son dossier patient (sans relation
    // Prisma). On l'enrichit ici pour que la carte « Ayant droit CDI » affiche toujours
    // QUI est le CDI rattaché (nom, numéro de dossier), pas seulement un statut.
    const cdiIds = [
      ...new Set(
        dossier.rattachementsAD
          .map((r) => r.cdiId)
          .filter((v): v is string => !!v),
      ),
    ]
    const cdiPatients = await this.prisma.patient.findMany({
      where: { id: { in: cdiIds } },
      select: {
        id: true,
        numeroPatient: true,
        identite: { select: { nom: true, prenom: true } },
      },
    })
    // Historique de catégorie : l'ANCIENNE catégorie et l'AUTEUR n'ont pas de relation
    // Prisma (ids nus) — l'écran n'affichait donc ni d'où l'on venait, ni qui avait fait
    // le changement (constats 57, 58). On les résout ici, une fois pour toutes.
    const ancIds = [
      ...new Set(
        dossier.historiquesCateg
          .map((h) => h.ancienneCategId)
          .filter((v): v is string => !!v),
      ),
    ]
    const auteurIds = [
      ...new Set(
        dossier.historiquesCateg
          .map((h) => h.createdBy)
          .filter((v): v is string => !!v),
      ),
    ]
    const [ancCategs, auteurs] = await Promise.all([
      ancIds.length
        ? this.prisma.categoriePatient.findMany({
            where: { id: { in: ancIds } },
            select: { id: true, code: true, libelle: true },
          })
        : Promise.resolve([] as { id: string; code: string; libelle: string }[]),
      auteurIds.length
        ? this.prisma.utilisateur.findMany({
            where: { id: { in: auteurIds } },
            select: {
              id: true,
              login: true,
              personnelMedical: { select: { nom: true, prenom: true } },
            },
          })
        : Promise.resolve(
            [] as {
              id: string
              login: string
              personnelMedical: { nom: string; prenom: string } | null
            }[],
          ),
    ])
    const ancMap = new Map(ancCategs.map((c) => [c.id, c] as const))
    const auteurMap = new Map<string, string>(
      auteurs.map((u): [string, string] => [
        u.id,
        u.personnelMedical
          ? `${u.personnelMedical.prenom} ${u.personnelMedical.nom}`
          : u.login,
      ]),
    )
    const historiquesCateg = dossier.historiquesCateg.map((h) => ({
      ...h,
      ancienneCategorie: h.ancienneCategId
        ? (ancMap.get(h.ancienneCategId) ?? null)
        : null,
      auteur: h.createdBy ? (auteurMap.get(h.createdBy) ?? null) : null,
    }))

    const cdiPatientMap = new Map(cdiPatients.map((c) => [c.id, c]))
    const rattachementsAD = dossier.rattachementsAD.map((r) => {
      // patientId : le dossier du CDI, pour l'ouvrir d'un clic depuis celui de l'ayant
      // droit (aucun lien n'existait, dans un sens comme dans l'autre).
      let cdi: {
        nom: string
        prenom: string
        identifiant: string
        patientId: string | null
      } | null = null
      const parPatient = r.cdiId ? cdiPatientMap.get(r.cdiId) : null
      if (parPatient)
        cdi = {
          nom: parPatient.identite?.nom ?? '',
          prenom: parPatient.identite?.prenom ?? '',
          identifiant: parPatient.numeroPatient,
          patientId: parPatient.id,
        }
      return { ...r, cdi }
    })

    // Verrou de confidentialité (médecin-chef) : pour un utilisateur NON-supervision,
    // le dossier est renvoyé DÉPOUILLÉ de son contenu clinique (identité + indicateur
    // verrouille conservés → le front force le rideau ON, non-survolable). Le vrai
    // contenu ne quitte jamais le serveur.
    if (dossier.verrouille && !scope?.canViewLocked) {
      return {
        ...dossier,
        historiquesCateg,
        rattachementsAD,
        allergies: [],
        antecedents: [],
        alertesMedicales: [],
        modeVie: null,
        donneesEmploi: null,
      }
    }
    // Antécédents et mode de vie (tabac, alcool, drogues…) sont des données CLINIQUES :
    // `patient.read` (droit administratif, ex. un rôle d'accueil créé par l'administrateur)
    // ne suffit pas pour les recevoir. `false` explicite seulement : un appel interne sans
    // portée n'ampute rien.
    if (scope?.canViewClinique === false) {
      return { ...dossier, historiquesCateg, rattachementsAD, antecedents: [], modeVie: null }
    }
    return { ...dossier, historiquesCateg, rattachementsAD, antecedents }
  }

  /** Verrou (médecin-chef) : restreint l'accès au dossier à la supervision. */
  async setVerrou(
    id: string,
    verrouille: boolean,
    motif: string | null,
    userId: string | null,
  ) {
    await this.assertPatientExists(id)
    return this.prisma.patient.update({
      where: { id },
      data: verrouille
        ? {
            verrouille: true,
            verrouilleParId: userId,
            verrouilleLe: new Date(),
            motifVerrou: motif?.trim() || null,
          }
        : {
            verrouille: false,
            verrouilleParId: null,
            verrouilleLe: null,
            motifVerrou: null,
          },
      select: {
        id: true,
        verrouille: true,
        verrouilleLe: true,
        motifVerrou: true,
      },
    })
  }

  /** True si le dossier est verrouillé ET l'appelant n'est pas supervision → contenu clinique masqué. */
  private async isCliniqueMasque(
    patientId: string,
    canViewLocked?: boolean,
  ): Promise<boolean> {
    if (canViewLocked) return false
    const p = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { verrouille: true },
    })
    return !!p?.verrouille
  }

  /**
   * Historique des constantes vitales du patient (TOUTES visites, TOUS sites),
   * du plus récent au plus ancien. Le dossier patient est CENTRALISÉ (continuité
   * de soins) : l'historique suit le patient même s'il a été soigné sur un autre
   * site (ex. travailleur muté). Le cloisonnement ne s'applique plus au dossier.
   */
  async findConstantes(
    patientId: string,
    scope?: {
      restrictToOwn: boolean
      personnelMedicalId: string | null
      canViewLocked?: boolean
      restreindreHistorique?: boolean
    },
  ) {
    await this.assertOwnPatient(patientId, scope)
    if (await this.isCliniqueMasque(patientId, scope?.canViewLocked)) return []
    const constantes = await this.prisma.constanteVitale.findMany({
      // Confidentialité (recueil §5) : l'infirmier n'a accès qu'aux constantes du
      // parcours EN COURS, pas à l'historique complet (réservé au médecin chef).
      // PARCOURS_EN_COURS et non « visite EN_ATTENTE/EN_COURS » : sans quoi les
      // constantes disparaissaient a l'instant meme ou le patient entrait en consultation.
      where: scope?.restreindreHistorique
        ? { patientId, visite: PARCOURS_EN_COURS }
        : { patientId }, // suit le patient (tous sites)
      orderBy: { createdAt: 'desc' },
    })

    // Constantes prises dans les FICHES DE SUIVI de traitement (constat 75) : elles
    // n'apparaissaient nulle part ailleurs que dans la fiche elle-même. Elles rejoignent
    // l'historique, marquées « Suivi ». Jamais celles d'un épisode annulé ; pour
    // l'infirmier, celles des épisodes EN COURS (même règle que la liste des épisodes).
    const fiches = await this.prisma.ficheSuiviTraitement.findMany({
      where: {
        suiviTraitement: {
          consultation: { visite: { patientId } },
          statut: scope?.restreindreHistorique ? 'EN_COURS' : { not: 'ANNULE' },
        },
        OR: [
          { temperature: { not: null } },
          { tensionSystolique: { not: null } },
          { frequenceCardiaque: { not: null } },
          { frequenceRespiratoire: { not: null } },
          { saturationO2: { not: null } },
          { poids: { not: null } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })
    const toutes = [
      ...constantes.map((c) => ({ ...c, origine: 'TRIAGE' as const })),
      ...fiches.map((f) => ({
        id: f.id,
        visiteId: null,
        patientId,
        temperature: f.temperature,
        tensionSystolique: f.tensionSystolique,
        tensionDiastolique: f.tensionDiastolique,
        frequenceCardiaque: f.frequenceCardiaque,
        frequenceRespiratoire: f.frequenceRespiratoire,
        saturationO2: f.saturationO2,
        poids: f.poids,
        taille: null,
        imc: null,
        glycemie: null,
        etatConscience: null,
        scoreGlasgow: null,
        etatGeneral: null,
        hydratation: null,
        coloration: null,
        saisiePar: f.createdBy ?? '',
        createdAt: f.createdAt,
        updatedAt: f.createdAt,
        deletedAt: null,
        origine: 'SUIVI' as const,
        suiviTraitementId: f.suiviTraitementId,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    // `saisiePar` = id Utilisateur, sans relation Prisma directe sur ConstanteVitale
    // → résolu manuellement en nom lisible (soignant + login de secours).
    const userIds = [...new Set(toutes.map((c) => c.saisiePar).filter(Boolean))]
    const users = userIds.length
      ? await this.prisma.utilisateur.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            login: true,
            personnelMedical: { select: { nom: true, prenom: true } },
          },
        })
      : []
    const userMap = new Map(
      users.map((u) => [
        u.id,
        u.personnelMedical
          ? `${u.personnelMedical.prenom} ${u.personnelMedical.nom}`
          : u.login,
      ]),
    )
    return toutes.map((c) => ({
      ...c,
      saisieParNom: userMap.get(c.saisiePar) ?? null,
    }))
  }

  /**
   * Alertes cliniques CALCULÉES (non saisies) du patient. Trois règles :
   *  1. Allergie ↔ médicament prescrit (ordonnance validée correspondant à une allergie active)
   *  2. Constantes critiques (dernière mesure hors plage)
   *  3. Pathologie chronique diagnostiquée sans suivi chronique actif
   * NB : la règle 1 est un rapprochement textuel (nom générique/commercial/famille) —
   * elle ne remplace pas une base d'interactions médicamenteuses.
   */
  async findAlertesCliniques(
    patientId: string,
    scope?: {
      restrictToOwn: boolean
      personnelMedicalId: string | null
      canViewLocked?: boolean
      /** Infirmier (hors supervision) : les alertes RESTENT visibles — c'est de la
       *  securite clinique —, sauf ce qui touche une pathologie a confidentialite
       *  renforcee, exactement comme pour les antecedents. */
      restreindreHistorique?: boolean
      /** Sans `patient.confidentiel.read` : pathologies à confidentialité renforcée masquées. */
      masquerConfidentiel?: boolean
    },
  ): Promise<AlerteClinique[]> {
    await this.assertOwnPatient(patientId, scope)
    if (await this.isCliniqueMasque(patientId, scope?.canViewLocked)) return []
    // Dossier centralisé (tous sites), sans les consultations ANNULEES. L'infirmier garde
    // TOUTES les alertes (securite clinique) : pas de restriction d'historique ici.
    const consultScope = consultationsDuDossier(patientId)

    const [
      allergies,
      lignes,
      lastConstTriage,
      chronicDiags,
      suivisChroniques,
      lastConstEnCours,
    ] =
      await Promise.all([
        this.prisma.allergiePatient.findMany({
          where: { patientId, statut: 'ACTIVE' },
        }),
        this.prisma.ligneOrdonnance.findMany({
          // Règle allergie ↔ médicament : ne concerne que les lignes PHARMACEUTIQUE (une
          // ligne PRESCRIPTION_EXAMEN n'a pas de medicamentId).
          where: {
            medicamentId: { not: null },
            ordonnance: { statut: 'VALIDEE', consultation: consultScope },
          },
          include: {
            medicament: {
              select: {
                nomGenerique: true,
                nomCommercial: true,
                familleThera: true,
              },
            },
            ordonnance: {
              select: {
                createdAt: true,
                consultation: { select: { statut: true } },
              },
            },
          },
        }),
        this.prisma.constanteVitale.findFirst({
          where: { patientId },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.diagnosticConsultation.findMany({
          where: {
            consultation: consultScope,
            pathologie: {
              chronique: true,
              // CONFIDENTIALITE RENFORCEE. Les antecedents masquent deja ces pathologies a
              // l'infirmier (cf. findById). Sans ce filtre, l'alerte « X diagnostiquee sans
              // suivi » affichait le LIBELLE en clair — un diagnostic VIH, par exemple —
              // dans le bandeau de tete du dossier : la porte fermee d'un cote restait
              // grande ouverte de l'autre.
              ...(scope?.masquerConfidentiel
                ? { confidentialiteRenforcee: false }
                : {}),
            },
          },
          include: {
            pathologie: { select: { id: true, libelle: true } },
            consultation: { select: { createdAt: true } },
          },
          // Le plus recent d'abord : c'est sa date qui sera montree.
          orderBy: { consultation: { createdAt: 'desc' } },
        }),
        // ACTIF et CLÔTURÉ : une clôture postérieure au dernier diagnostic est une
        // décision (fin de suivi), pas un oubli — l'alerte ne doit pas revenir (constat 89).
        this.prisma.suiviChronique.findMany({
          where: {
            OR: [{ patientId }, { consultation: { visite: { patientId } } }],
            statut: { in: ['ACTIF', 'CLOTURE'] },
          },
          select: { pathologieId: true, statut: true, closedAt: true },
        }),
        this.prisma.constanteVitale.findFirst({
          where: { patientId, visite: PARCOURS_EN_COURS },
          orderBy: { createdAt: 'desc' },
        }),
      ])
    // Dernière fiche de suivi portant une constante (constat 75) : la règle « constante
    // critique » l'ignorait. Elle entre en compte comme mesure HISTORIQUE datée — le
    // rouge reste réservé à la visite en cours (décision de l'étape 2).
    const derniereFiche = await this.prisma.ficheSuiviTraitement.findFirst({
      where: {
        suiviTraitement: { consultation: { visite: { patientId } }, statut: { not: 'ANNULE' } },
        OR: [
          { temperature: { not: null } },
          { tensionSystolique: { not: null } },
          { frequenceCardiaque: { not: null } },
          { saturationO2: { not: null } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })
    const lastConst =
      derniereFiche && (!lastConstTriage || derniereFiche.createdAt > lastConstTriage.createdAt)
        ? derniereFiche
        : lastConstTriage

    const alertes: AlerteClinique[] = []

    // ── Règle 1 : allergie ↔ médicament prescrit ──────────────────────────────
    const seenAM = new Set<string>()
    // Une prescription de la consultation EN COURS prime sur la meme faite il y a deux
    // ans : c'est elle qui doit sortir, en couleur. On la presente donc en premier, et le
    // dedoublonnage ci-dessous garde la premiere rencontree.
    const enCours = (l: (typeof lignes)[number]) =>
      l.ordonnance.consultation?.statut === 'OUVERTE'
    const lignesTriees = [...lignes].sort(
      (x, y) =>
        Number(enCours(y)) - Number(enCours(x)) ||
        y.ordonnance.createdAt.getTime() - x.ordonnance.createdAt.getTime(),
    )
    for (const a of allergies) {
      const sub = normaliser(a.substance)
      if (sub.length < 4) continue
      for (const l of lignesTriees) {
        if (!l.medicament) continue // ligne PRESCRIPTION_EXAMEN (filtrée en amont par le where, garde défensive)
        const fields = [
          l.medicament.nomGenerique,
          l.medicament.nomCommercial,
          l.medicament.familleThera,
        ]
          .filter(Boolean)
          .map((s) => normaliser(s as string))
        const hit = fields.some(
          (f) => f.includes(sub) || (f.length >= 4 && sub.includes(f)),
        )
        if (!hit) continue
        const key = `${a.id}-${l.medicamentId}`
        if (seenAM.has(key)) continue
        seenAM.add(key)
        const medName = l.medicament.nomCommercial || l.medicament.nomGenerique
        alertes.push({
          type: 'ALLERGIE_MEDICAMENT',
          gravite: 'CRITIQUE',
          titre: 'Allergie vs médicament prescrit',
          sujet: medName,
          detail: `« ${medName} » prescrit alors que le patient est allergique à « ${a.substance} ».`,
          date: l.ordonnance.createdAt.toISOString(),
          portee: enCours(l) ? 'ACTUELLE' : 'HISTORIQUE',
        })
      }
    }

    // ── Règle 2 : constantes critiques ────────────────────────────────────────
    // En couleur UNIQUEMENT pour une mesure du parcours en cours (decision metier). Faute
    // de mesure en cours, la derniere connue est rappelee en HISTORIQUE, datee.
    const constRef = lastConstEnCours ?? lastConst
    if (constRef) {
      const c = constRef
      const quand = {
        date: c.createdAt.toISOString(),
        portee: (lastConstEnCours ? 'ACTUELLE' : 'HISTORIQUE') as AlerteClinique['portee'],
      }
      if (c.saturationO2 != null && c.saturationO2 < 90)
        alertes.push({
          type: 'CONSTANTE_CRITIQUE',
          ...quand,
          gravite: 'CRITIQUE',
          titre: 'Hypoxie',
          sujet: `SpO₂ ${c.saturationO2} %`,
          detail: `SpO₂ à ${c.saturationO2}% (< 90%).`,
        })
      if (c.temperature != null && c.temperature >= 38.5)
        alertes.push({
          type: 'CONSTANTE_CRITIQUE',
          ...quand,
          gravite: c.temperature >= 39.5 ? 'CRITIQUE' : 'ELEVE',
          titre: 'Fièvre élevée',
          sujet: `${c.temperature} °C`,
          detail: `Température à ${c.temperature}°C.`,
        })
      if (c.tensionSystolique != null && c.tensionSystolique >= 160)
        alertes.push({
          type: 'CONSTANTE_CRITIQUE',
          ...quand,
          gravite: c.tensionSystolique >= 180 ? 'CRITIQUE' : 'ELEVE',
          titre: 'Tension élevée',
          sujet: `${c.tensionSystolique} mmHg`,
          detail: `Tension systolique à ${c.tensionSystolique} mmHg.`,
        })
      if (c.frequenceCardiaque != null && c.frequenceCardiaque >= 120)
        alertes.push({
          type: 'CONSTANTE_CRITIQUE',
          ...quand,
          gravite: 'ELEVE',
          titre: 'Tachycardie',
          sujet: `${c.frequenceCardiaque} bpm`,
          detail: `Fréquence cardiaque à ${c.frequenceCardiaque} bpm.`,
        })
      if (c.frequenceCardiaque != null && c.frequenceCardiaque < 50)
        alertes.push({
          type: 'CONSTANTE_CRITIQUE',
          ...quand,
          gravite: 'ELEVE',
          titre: 'Bradycardie',
          sujet: `${c.frequenceCardiaque} bpm`,
          detail: `Fréquence cardiaque à ${c.frequenceCardiaque} bpm.`,
        })
    }

    // ── Règle 3 : pathologie chronique sans suivi actif ───────────────────────
    const suiviSet = new Set(
      suivisChroniques.filter((s) => s.statut === 'ACTIF').map((s) => s.pathologieId),
    )
    const derniereCloture = new Map<string, Date>()
    for (const s of suivisChroniques) {
      if (s.statut !== 'CLOTURE' || !s.closedAt) continue
      const prec = derniereCloture.get(s.pathologieId)
      if (!prec || s.closedAt > prec) derniereCloture.set(s.pathologieId, s.closedAt)
    }
    const seenPath = new Set<string>()
    // chronicDiags est trié du plus récent au plus ancien : la 1re occurrence d'une
    // pathologie est son DERNIER diagnostic.
    for (const d of chronicDiags) {
      if (suiviSet.has(d.pathologieId) || seenPath.has(d.pathologieId)) continue
      seenPath.add(d.pathologieId)
      const cloture = derniereCloture.get(d.pathologieId)
      if (cloture && cloture >= d.consultation.createdAt) continue
      alertes.push({
        type: 'CHRONIQUE_SANS_SUIVI',
        gravite: 'MODERE',
        titre: 'Chronique sans suivi',
        sujet: d.pathologie.libelle,
        detail: `« ${d.pathologie.libelle} » diagnostiquée sans suivi chronique actif.`,
        date: d.consultation.createdAt.toISOString(),
        // L'absence de suivi est un etat ACTUEL, meme si le diagnostic est ancien : c'est
        // aujourd'hui qu'il n'y a personne pour suivre cette pathologie.
        portee: 'ACTUELLE',
      })
    }

    // ── Règle 4 : contrôle de suivi en retard ─────────────────────────────────
    // Un épisode de suivi EN COURS dont la date de prochain contrôle est passée : le
    // patient n'a pas été revu quand il devait l'être.
    const enRetard = await this.prisma.suiviTraitement.findMany({
      where: {
        statut: 'EN_COURS',
        prochainControle: { lt: new Date() },
        consultation: { visite: { patientId } },
      },
      select: { motif: true, prochainControle: true },
    })
    for (const e of enRetard) {
      alertes.push({
        type: 'CONTROLE_EN_RETARD',
        gravite: 'MODERE',
        titre: 'Contrôle de suivi en retard',
        sujet: e.motif.length > 60 ? e.motif.slice(0, 60) + '…' : e.motif,
        detail: `Le patient devait être revu pour le suivi « ${e.motif} ».`,
        date: e.prochainControle!.toISOString(),
        portee: 'ACTUELLE',
      })
    }

    const order: Record<AlerteClinique['gravite'], number> = {
      CRITIQUE: 0,
      ELEVE: 1,
      MODERE: 2,
    }
    // L'actuel avant l'historique, puis par gravite.
    alertes.sort(
      (a, b) =>
        Number(b.portee === 'ACTUELLE') - Number(a.portee === 'ACTUELLE') ||
        order[a.gravite] - order[b.gravite],
    )
    return alertes
  }

  /**
   * Suivi du dossier (onglet Dossier médical → Suivi) — trois axes cliniques,
   * calculés sur l'historique COMPLET du patient (tous sites — dossier centralisé) :
   *   1. Évolution des pathologies chroniques (occurrences + suivi formel s'il existe)
   *   2. Traitement (historique des lignes d'ordonnances validées)
   *   3. Résultats d'examens (ResultatExamen, jamais exposés dans le dossier avant)
   *
   * Confidentialité alignée sur findConstantes/findAlertesCliniques : verrou
   * médecin-chef (retourne un résultat vide) + restriction infirmier (recueil §5,
   * limité à la visite EN_ATTENTE/EN_COURS).
   */
  async findSuivi(
    patientId: string,
    scope?: {
      restrictToOwn: boolean
      personnelMedicalId: string | null
      canViewLocked?: boolean
      restreindreHistorique?: boolean
      /** Sans `patient.confidentiel.read` : pathologies à confidentialité renforcée masquées. */
      masquerConfidentiel?: boolean
    },
  ) {
    await this.assertPatientExists(patientId)
    await this.assertOwnPatient(patientId, scope)
    if (await this.isCliniqueMasque(patientId, scope?.canViewLocked)) {
      return {
        chroniques: [],
        traitements: [],
        resultatsExamens: [],
        resultatsEnAttente: [],
      }
    }

    const [
      diagnosticsChroniques,
      suivis,
      lignesOrdonnance,
      resultats,
      bonsEnAttente,
    ] = await Promise.all([
      this.prisma.diagnosticConsultation.findMany({
        where: scope?.restreindreHistorique
          ? {
              // Meme exception que les antecedents et les alertes : une pathologie a
              // confidentialite renforcee n'apparait jamais a l'infirmier, meme
              // diagnostiquee pendant la visite en cours.
              pathologie: {
                chronique: true,
                ...(scope?.masquerConfidentiel ? { confidentialiteRenforcee: false } : {}),
              },
              consultation: consultationsDuDossier(patientId, true),
            }
          : {
              pathologie: {
                chronique: true,
                ...(scope?.masquerConfidentiel ? { confidentialiteRenforcee: false } : {}),
              },
              consultation: consultationsDuDossier(patientId),
            },
        select: {
          pathologieId: true,
          pathologie: { select: { id: true, libelle: true } },
          consultationId: true,
          consultation: { select: { createdAt: true } },
        },
        orderBy: { consultation: { createdAt: 'desc' } },
      }),
      this.prisma.suiviChronique.findMany({
        where: {
          OR: [{ patientId }, { consultation: { visite: { patientId } } }],
        },
        select: {
          id: true,
          pathologieId: true,
          frequenceSuivi: true,
          objectifs: true,
          statut: true,
          createdAt: true,
          closedAt: true,
          motifCloture: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ligneOrdonnance.findMany({
        // Traitements : ne concerne que les lignes PHARMACEUTIQUE (medicamentId non nul).
        // Pour l'infirmier : le traitement prescrit pendant la consultation EN COURS.
        // L'ancien filtre (visite EN_ATTENTE/EN_COURS) ne pouvait RIEN trouver : une
        // ordonnance n'existe que dans une consultation, donc sur une visite deja CLOTUREE.
        // L'infirmier lisait « Aucun traitement prescrit » au moment meme ou il devait
        // l'administrer.
        where: {
          medicamentId: { not: null },
          ordonnance: {
            statut: 'VALIDEE',
            consultation: consultationsDuDossier(
              patientId,
              scope?.restreindreHistorique,
            ),
          },
        },
        select: {
          id: true,
          posologie: true,
          duree: true,
          voieAdmin: true,
          arreteLe: true,
          motifArret: true,
          remplaceParId: true,
          medicament: { select: { nomGenerique: true, nomCommercial: true } },
          ordonnance: {
            select: {
              id: true,
              statut: true,
              consultationId: true,
              createdAt: true,
              prescripteurId: true,
              // Délivrance en pharmacie (constat 82) : le bon lié dit si le traitement a
              // été remis au patient.
              bonsPharmacie: {
                where: { deletedAt: null, statut: { not: 'ANNULE' } },
                select: { statut: true, delivreLe: true },
              },
            },
          },
        },
        orderBy: { ordonnance: { createdAt: 'desc' } },
      }),
      this.prisma.resultatExamen.findMany({
        where: {
          // La version EN VIGUEUR seulement : un résultat corrigé (REMPLACE) reste
          // consultable sur son bon, mais ne compte plus comme résultat du patient.
          statut: 'RECU',
          bon: {
            consultation: consultationsDuDossier(
              patientId,
              scope?.restreindreHistorique,
            ),
          },
        },
        select: {
          id: true,
          bonId: true,
          laboratoire: true,
          contenu: true,
          interpretation: true,
          statut: true,
          createdAt: true,
          dateRealisation: true,
          anormal: true,
          corrigeId: true,
          ligneExamenId: true,
          ligneExamen: { select: { typeExamen: { select: { libelle: true } } } },
          bon: {
            select: {
              consultationId: true,
              lignes: { select: { typeExamen: { select: { libelle: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Bons d'examen SANS résultat saisi — validés (résultat attendu) ou encore à
      // valider : un bon non validé à la clôture de la consultation n'apparaissait nulle
      // part, et son résultat ne pouvait plus jamais être saisi.
      this.prisma.bonExamen.findMany({
        where: {
          statut: { in: ['EN_ATTENTE', 'VALIDE'] },
          consultation: consultationsDuDossier(
            patientId,
            scope?.restreindreHistorique,
          ),
        },
        select: {
          id: true,
          consultationId: true,
          createdAt: true,
          statut: true,
          lignes: { select: { id: true, typeExamen: { select: { libelle: true } } } },
          resultats: { where: { statut: 'RECU' }, select: { ligneExamenId: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    // Regrouper les diagnostics chroniques par pathologie (occurrences = évolution).
    const parPathologie = new Map<
      string,
      { pathologie: { id: string; libelle: string }; dates: Date[] }
    >()
    for (const d of diagnosticsChroniques) {
      const entry = parPathologie.get(d.pathologieId) ?? {
        pathologie: d.pathologie,
        dates: [],
      }
      entry.dates.push(d.consultation.createdAt)
      parPathologie.set(d.pathologieId, entry)
    }
    // On n'expose que le suivi ACTIF par pathologie (un seul garanti par la garde
    // de création) → la carte propose « Définir un suivi » si aucun n'est actif.
    const suiviMap = new Map(
      suivis
        .filter((s) => s.statut === 'ACTIF')
        .map((s) => [s.pathologieId, s]),
    )

    // Dernier suivi CLÔTURÉ par pathologie (suivis triés du plus récent) : sans lui, la
    // carte revenait à « Aucun suivi formel » comme si rien n'avait jamais été fait.
    const dernierClos = new Map<string, (typeof suivis)[number]>()
    for (const s of suivis)
      if (s.statut === 'CLOTURE' && !dernierClos.has(s.pathologieId)) dernierClos.set(s.pathologieId, s)

    const chroniques = [...parPathologie.entries()].map(
      ([pathologieId, v]) => ({
        pathologieId,
        pathologie: v.pathologie,
        suivi: suiviMap.get(pathologieId) ?? null,
        dernierSuiviClos: dernierClos.get(pathologieId) ?? null,
        occurrences: v.dates.length,
        premierDiagnostic: v.dates[v.dates.length - 1],
        dernierDiagnostic: v.dates[0],
      }),
    )

    // Prescripteur de chaque ordonnance (pas de relation Prisma : id nu).
    const prescripteurIds = [
      ...new Set(lignesOrdonnance.map((l) => l.ordonnance.prescripteurId)),
    ]
    const prescripteurs = prescripteurIds.length
      ? await this.prisma.personnelMedical.findMany({
          where: { id: { in: prescripteurIds } },
          select: { id: true, nom: true, prenom: true, role: true },
        })
      : []
    const prescripteurMap = new Map(prescripteurs.map((p) => [p.id, p] as const))

    const traitements = lignesOrdonnance.map((l) => {
      const bon = l.ordonnance.bonsPharmacie[0] ?? null
      const pr = prescripteurMap.get(l.ordonnance.prescripteurId) ?? null
      return {
        ligneId: l.id,
        ordonnanceId: l.ordonnance.id,
        consultationId: l.ordonnance.consultationId,
        date: l.ordonnance.createdAt,
        statutOrdonnance: l.ordonnance.statut,
        // Le where (medicamentId: { not: null }) garantit l.medicament non nul ici.
        medicament: l.medicament!.nomCommercial || l.medicament!.nomGenerique,
        posologie: l.posologie,
        duree: l.duree,
        voieAdmin: l.voieAdmin,
        prescripteur: pr ? { nom: pr.nom, prenom: pr.prenom, role: pr.role } : null,
        delivrance: bon ? bon.statut : null,
        delivreLe: bon?.delivreLe ?? null,
        // Fin estimée quand la durée est lisible (« 30 jours », « 2 semaines »…) :
        // c'est elle qui permet de distinguer un traitement EN COURS d'un traitement fini.
        finEstimee: finDeTraitement(l.ordonnance.createdAt, l.duree),
        // Arrêté avant sa fin prévue (suivi de traitement) — et remplacé, le cas échéant.
        arreteLe: l.arreteLe,
        motifArret: l.motifArret,
        remplace: !!l.remplaceParId,
      }
    })

    const resultatsExamens = resultats.map((r) => ({
      id: r.id,
      bonId: r.bonId,
      consultationId: r.bon.consultationId,
      date: r.createdAt,
      dateRealisation: r.dateRealisation,
      laboratoire: r.laboratoire,
      contenu: r.contenu,
      interpretation: r.interpretation,
      statut: r.statut,
      anormal: r.anormal,
      corrige: !!r.corrigeId,
      // Résultat d'UN examen ; un ancien résultat global vaut pour tous les examens du bon.
      examens: r.ligneExamen
        ? [r.ligneExamen.typeExamen.libelle]
        : r.bon.lignes.map((l) => l.typeExamen.libelle),
    }))

    // Un bon reste « en attente » tant qu'un de ses examens n'a pas son résultat (un ancien
    // résultat global, sans examen précis, le couvre en entier).
    const resultatsEnAttente = bonsEnAttente
      .map((b) => {
        const global = b.resultats.some((r) => r.ligneExamenId === null)
        const recues = new Set(b.resultats.map((r) => r.ligneExamenId).filter(Boolean))
        const manquants = global ? [] : b.lignes.filter((l) => !recues.has(l.id))
        return {
          bonId: b.id,
          consultationId: b.consultationId,
          date: b.createdAt,
          examens: (manquants.length ? manquants : b.lignes).map((l) => l.typeExamen.libelle),
          recus: b.lignes.length - manquants.length,
          total: b.lignes.length,
          aValider: b.statut === 'EN_ATTENTE',
          complet: manquants.length === 0,
        }
      })
      .filter((b) => !b.complet)
      .map(({ complet: _c, ...b }) => b)

    return { chroniques, traitements, resultatsExamens, resultatsEnAttente }
  }

  // ── Suivi chronique (onglet Suivi → définir / modifier / clôturer) ───────────
  // Sélection SANS filtre site (dossier centralisé, cohérent avec findSuivi).

  private readonly suiviSelect = {
    id: true,
    pathologieId: true,
    frequenceSuivi: true,
    objectifs: true,
    statut: true,
    createdAt: true,
  } as const

  async createSuiviChronique(patientId: string, dto: CreateSuiviChroniqueDto) {
    await this.assertPatientExists(patientId)
    const patho = await this.prisma.pathologieReference.findFirst({
      where: { id: dto.pathologieId },
      select: { id: true, chronique: true },
    })
    if (!patho) throw new NotFoundException('Pathologie introuvable')
    // Un suivi ne se définit que sur une pathologie chronique (sinon il ne serait
    // jamais restitué par findSuivi, qui n'agrège que les pathologies chroniques).
    if (!patho.chronique)
      throw new BadRequestException(
        'Un suivi ne peut être défini que sur une pathologie chronique',
      )
    // Un seul suivi ACTIF par (patient, pathologie).
    const dejaActif = await this.prisma.suiviChronique.findFirst({
      where: {
        statut: 'ACTIF',
        pathologieId: dto.pathologieId,
        OR: [{ patientId }, { consultation: { visite: { patientId } } }],
      },
      select: { id: true },
    })
    if (dejaActif)
      throw new ConflictException(
        'Un suivi actif existe déjà pour cette pathologie',
      )
    return this.prisma.suiviChronique.create({
      data: {
        patientId,
        pathologieId: dto.pathologieId,
        frequenceSuivi: dto.frequenceSuivi,
        objectifs: dto.objectifs ?? null,
        statut: 'ACTIF',
      },
      select: this.suiviSelect,
    })
  }

  /** Vérifie qu'un suivi appartient bien au patient (lien direct OU via consultation). */
  private async assertSuiviDuPatient(patientId: string, suiviId: string) {
    const s = await this.prisma.suiviChronique.findFirst({
      where: {
        id: suiviId,
        OR: [{ patientId }, { consultation: { visite: { patientId } } }],
      },
      select: { id: true, pathologieId: true },
    })
    if (!s) throw new NotFoundException('Suivi chronique introuvable')
    return s
  }

  async updateSuiviChronique(
    patientId: string,
    suiviId: string,
    dto: UpdateSuiviChroniqueDto,
  ) {
    const s = await this.assertSuiviDuPatient(patientId, suiviId)
    // Réactivation : refuser s'il existe déjà un autre suivi actif sur la pathologie.
    if (dto.statut === 'ACTIF') {
      const autreActif = await this.prisma.suiviChronique.findFirst({
        where: {
          statut: 'ACTIF',
          pathologieId: s.pathologieId,
          id: { not: suiviId },
          OR: [{ patientId }, { consultation: { visite: { patientId } } }],
        },
        select: { id: true },
      })
      if (autreActif)
        throw new ConflictException(
          'Un suivi actif existe déjà pour cette pathologie',
        )
    }
    return this.prisma.suiviChronique.update({
      where: { id: suiviId },
      data: {
        ...(dto.frequenceSuivi !== undefined
          ? { frequenceSuivi: dto.frequenceSuivi }
          : {}),
        ...(dto.objectifs !== undefined
          ? { objectifs: dto.objectifs || null }
          : {}),
        ...(dto.statut === 'CLOTURE'
          ? {
              statut: 'CLOTURE',
              motifCloture: dto.motifCloture || null,
              closedAt: new Date(),
            }
          : {}),
        ...(dto.statut === 'ACTIF'
          ? { statut: 'ACTIF', motifCloture: null, closedAt: null }
          : {}),
      },
      select: this.suiviSelect,
    })
  }

  // ── Photo du patient ──────────────────────────────────────────────────────

  /**
   * Redimensionne/compresse la photo puis l'enregistre en Base64 (data URL) dans
   * la base — aucun fichier disque. La normalisation (carré 512px, JPEG q80)
   * garde la base légère quel que soit le fichier d'origine.
   */
  async setPhoto(id: string, buffer: Buffer) {
    await this.assertPatientExists(id)

    const jpeg = await sharp(buffer)
      .rotate() // respecte l'orientation EXIF
      .resize(512, 512, { fit: 'cover', position: 'centre' }) // carré recadré centré
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()

    const photoUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`
    await this.prisma.identitePatient.update({
      where: { patientId: id },
      data: { photoUrl },
    })
    return { photoUrl }
  }

  /** Retire la photo du patient (repli sur les initiales — cf. setPhoto). */
  async removePhoto(id: string) {
    await this.assertPatientExists(id)
    await this.prisma.identitePatient.update({
      where: { patientId: id },
      data: { photoUrl: null },
    })
    return { photoUrl: null }
  }

  // ── Création patient ──────────────────────────────────────────────────────

  async create(dto: CreatePatientDto, createdBy?: string) {
    const {
      nom,
      prenom,
      dateNaissance,
      sexe,
      telephone,
      adresse,
      categoriePatientId,
      siteCreationId,
      contactUrgence,
      matricule,
      fonction,
      sectionPaie,
      service,
      departement,
      cdiMatricule,
      typeLien,
      societeId,
      nouveauTravailleur,
    } = dto

    // La CATÉGORIE pilote les données administratives obligatoires (recueil §5).
    const categorie = await this.prisma.categoriePatient.findUnique({
      where: { id: categoriePatientId },
      select: { code: true, libelle: true },
    })
    if (!categorie)
      throw new BadRequestException('Catégorie de patient invalide')
    const code = categorie.code
    const isCdiCdd = code === 'ASSURE_CDI' || code === 'ASSURE_CDD'

    // CDI / CDD : matricule + fonction + section + service + département obligatoires
    if (isCdiCdd) {
      const manquants: string[] = []
      if (!matricule?.trim()) manquants.push('matricule')
      if (!fonction?.trim()) manquants.push('fonction')
      if (!sectionPaie?.trim()) manquants.push('section de paie')
      if (!service?.trim()) manquants.push('service')
      if (!departement?.trim()) manquants.push('département')
      if (manquants.length) {
        throw new BadRequestException(
          `Données obligatoires manquantes pour « ${categorie.libelle} » : ${manquants.join(', ')}`,
        )
      }
    }

    // Sous-traitant : société sous-traitante obligatoire
    if (code === 'SOUS_TRAITANT') {
      if (!societeId)
        throw new BadRequestException(
          'La société sous-traitante est obligatoire',
        )
      const societe = await this.prisma.societeSousTraitante.findFirst({
        where: { id: societeId, statut: 'ACTIVE' },
        select: { id: true },
      })
      if (!societe)
        throw new BadRequestException(
          'Société sous-traitante introuvable ou inactive',
        )
    }

    // Ayant droit : le travailleur CDI rattaché est VÉRIFIÉ avant la transaction ; s'il
    // n'a pas encore de dossier, celui-ci est créé DEDANS (cf. planifierCdiRattachement /
    // materialiserCdi). Le dossier du travailleur fait foi — il n'y a pas de registre.
    let planCdi: PlanCdi | null = null
    if (code === 'AYANT_DROIT_CDI') {
      if (!fonction?.trim())
        throw new BadRequestException(
          "L'occupation de l'ayant droit est obligatoire (ex. : élève, sans emploi, enfant en bas âge)",
        )
      if (!cdiMatricule?.trim())
        throw new BadRequestException(
          'Le matricule du CDI rattaché est obligatoire',
        )
      if (!typeLien)
        throw new BadRequestException('Le lien de parenté est obligatoire')
      planCdi = await this.planifierCdiRattachement(cdiMatricule, nouveauTravailleur)
    }

    const numeroPatient = await this.generateNumeroPatient(siteCreationId)

    // Matricule employeur : propre au CDI/CDD uniquement (l'ayant droit utilise celui du CDI).
    const matriculePropre = isCdiCdd ? matricule?.trim() || null : null
    if (matriculePropre) {
      const exists = await this.prisma.patient.findUnique({
        where: { matricule: matriculePropre },
        select: { id: true },
      })
      if (exists)
        throw new ConflictException(
          `Le matricule ${matriculePropre} est déjà attribué à un patient`,
        )
    }

    // donneesEmploi : 4 champs pour CDI/CDD, fonction seule pour l'ayant droit (le reste vient du CDI).
    const donneesEmploiData = isCdiCdd
      ? {
          fonction: fonction!.trim(),
          sectionPaie: sectionPaie!.trim(),
          service: service!.trim(),
          departement: departement!.trim(),
        }
      : code === 'AYANT_DROIT_CDI'
        ? {
            fonction: fonction!.trim(),
            sectionPaie: null,
            service: null,
            departement: null,
          }
        : null

    const dossier = await this.prisma.$transaction(async (tx) => {
      const p = await tx.patient.create({
        data: {
          numeroPatient,
          matricule: matriculePropre,
          siteCreationId,
          categoriePatientId,
          createdBy: createdBy ?? null,
          identite: {
            create: {
              nom,
              prenom,
              dateNaissance: new Date(dateNaissance),
              sexe,
              telephone: telephone ?? null,
              adresse: adresse ?? null,
            },
          },
          ...(contactUrgence
            ? { contactUrgence: { create: contactUrgence } }
            : {}),
          ...(donneesEmploiData
            ? { donneesEmploi: { create: donneesEmploiData } }
            : {}),
        },
      })

      // Rattachement ayant droit → DOSSIER du travailleur CDI (recueil §5). S'il n'en a
      // pas encore, il est créé ici (naissance/sexe inconnus tant qu'il ne se présente
      // pas en personne). floorNum = numéro du patient qu'on vient de créer (p) : encore
      // invisible à `generateNumeroPatient` (lecture `.raw`, hors transaction) tant que
      // cette transaction n'a pas validé — sans ce plancher les deux dossiers
      // calculeraient le même « prochain numéro » et entreraient en collision.
      if (planCdi) {
        const cdi = await this.materialiserCdi(
          planCdi,
          tx,
          siteCreationId,
          createdBy,
          parseInt(numeroPatient.slice(-5), 10) || 0,
        )
        const ratt = await tx.rattachementAyantDroitCdi.create({
          data: {
            patientId: p.id,
            cdiId: cdi.id,
            typeLien: typeLien!,
            dateDebut: new Date(),
          },
        })
        await tx.historiqueRattachementAyantDroit.create({
          data: { rattachementId: ratt.id, evenement: 'CREATION', createdBy: createdBy ?? null },
        })
      }
      if (code === 'SOUS_TRAITANT' && societeId) {
        const ratt = await tx.rattachementSousTraitant.create({
          data: { patientId: p.id, societeId, dateDebut: new Date() },
        })
        await tx.historiqueRattachementSousTraitant.create({
          data: { rattachementId: ratt.id, evenement: 'CREATION', createdBy: createdBy ?? null },
        })
      }

      return tx.patient.findUniqueOrThrow({
        where: { id: p.id },
        include: DOSSIER_INCLUDE,
      })
    })

    await this.notif.emit({
      type: 'PATIENT_CREE',
      niveau: 'INFO',
      category: 'clinique',
      titre: 'Nouveau patient enregistré',
      message: `${prenom} ${nom} · ${numeroPatient}`,
      siteId: null,
      requiredPermission: 'patient.read',
      entiteType: 'patient',
      entiteId: dossier.id,
      lien: `/patients/${dossier.id}`,
      createdById: createdBy ?? null,
    })

    return dossier
  }

  /**
   * Dossier (minimal) d'un travailleur CDI auquel on rattache un ayant droit alors qu'il
   * n'est jamais venu lui-même : il doit être trouvable comme patient — par son matricule
   * ou son nom — dès l'enregistrement de son ayant droit. Naissance et sexe restent
   * inconnus tant qu'il ne se présente pas en personne.
   *
   * Appelé DANS la transaction de l'ayant droit : si son enregistrement échoue, aucun
   * dossier orphelin, saisi à la hâte, ne reste derrière.
   */
  private async creerDossierTravailleurCdi(
    saisie: TravailleurCdiSaisie & { matricule: string },
    siteId: string,
    createdBy: string | undefined,
    client: Prisma.TransactionClient,
    floorNum = 0,
  ): Promise<TravailleurCdi> {
    const categorie = await client.categoriePatient.findFirst({
      where: { code: 'ASSURE_CDI' },
      select: { id: true },
    })
    if (!categorie)
      throw new BadRequestException('Catégorie « Personnel CDI » absente du référentiel')
    const nom = saisie.nom.trim()
    const prenom = saisie.prenom.trim()
    const numeroPatient = await this.generateNumeroPatient(siteId, floorNum)
    const dossier = await client.patient.create({
      data: {
        numeroPatient,
        matricule: saisie.matricule,
        siteCreationId: siteId,
        categoriePatientId: categorie.id,
        createdBy: createdBy ?? null,
        identite: {
          create: {
            nom,
            prenom,
            dateNaissance: saisie.dateNaissance ? new Date(saisie.dateNaissance) : null,
            sexe: saisie.sexe ?? null,
          },
        },
        donneesEmploi: {
          create: {
            fonction: saisie.fonction?.trim() || null,
            sectionPaie: saisie.sectionPaie?.trim() || null,
            service: saisie.service?.trim() || null,
            departement: saisie.departement?.trim() || null,
          },
        },
      },
    })

    await this.notif.emit({
      type: 'PATIENT_CREE',
      niveau: 'INFO',
      category: 'clinique',
      titre: 'Dossier du travailleur CDI créé (ayant droit)',
      message: `${prenom} ${nom} · ${numeroPatient}`,
      siteId: null,
      requiredPermission: 'patient.read',
      entiteType: 'patient',
      entiteId: dossier.id,
      lien: `/patients/${dossier.id}`,
      createdById: createdBy ?? null,
    })

    return { id: dossier.id, nom, prenom, matricule: saisie.matricule }
  }

  // ── Personnel du centre à l'accueil ───────────────────────────────────────
  //
  // Employé = personnel = utilisateur. Il n'a PAS de dossier patient tant qu'il ne
  // vient pas se soigner : la première fois qu'il passe à l'accueil, on le retrouve
  // par son nom ou son matricule et son dossier s'ouvre à partir de sa fiche, sans
  // rien ressaisir. Son matricule est la clé : un seul dossier par matricule.

  /** Personnel ACTIF correspondant à la recherche et qui n'a pas encore de dossier. */
  async personnelSansDossier(search: string) {
    const q = search.trim()
    if (q.length < 2) return []
    const personnes = await this.prisma.personnelMedical.findMany({
      where: {
        statut: 'ACTIF',
        OR: [
          { nom: { contains: q, ...CI } },
          { prenom: { contains: q, ...CI } },
          { matricule: { contains: q, ...CI } },
        ],
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      take: 20,
    })
    if (personnes.length === 0) return []
    // Client BRUT : un dossier supprimé garde son matricule, la personne n'est donc pas
    // « sans dossier » — l'ouverture l'expliquerait par un refus.
    const pris = await this.prisma.raw.patient.findMany({
      where: { matricule: { in: personnes.map((p) => p.matricule) } },
      select: { matricule: true },
    })
    const avecDossier = new Set(pris.map((p) => p.matricule))
    return personnes
      .filter((p) => !avecDossier.has(p.matricule))
      .map((p) => ({
        id: p.id,
        nom: p.nom,
        prenom: p.prenom,
        matricule: p.matricule,
        fonction: libelleFonction(p.role),
        typeContrat: p.typeContrat,
        // Seuls les MANQUES sont dits : l'accueil n'a pas à lire la fiche entière.
        manquants: champsManquants(p),
      }))
  }

  /**
   * Ouvre (ou reprend) le dossier patient d'un membre du personnel, à partir de sa fiche.
   * Jamais de second dossier : si son matricule en a déjà un, c'est celui-là qui est
   * renvoyé — y compris quand deux postes l'ouvrent au même instant.
   */
  async ouvrirDossierPersonnel(
    personnelId: string,
    dto: OuvrirDossierPersonnelDto,
    createdBy?: string,
  ): Promise<{ id: string; cree: boolean }> {
    const agent = await this.prisma.personnelMedical.findUnique({
      where: { id: personnelId },
    })
    if (!agent) throw new NotFoundException('Membre du personnel introuvable')

    const dejaOuvert = await this.dossierDuMatricule(agent.matricule)
    if (dejaOuvert) return { id: dejaOuvert, cree: false }

    // Fiche + ce que l'accueil vient de compléter (seulement là où la fiche est vide).
    const fiche = {
      dateNaissance:
        agent.dateNaissance ??
        (dto.dateNaissance ? new Date(dto.dateNaissance) : null),
      sexe: agent.sexe ?? dto.sexe ?? null,
      sectionPaie: agent.sectionPaie ?? (dto.sectionPaie?.trim() || null),
      departement: agent.departement ?? (dto.departement?.trim() || null),
    }
    const manquants = champsManquants(fiche).map((c) => LIBELLE_CHAMP[c])
    if (manquants.length)
      throw new BadRequestException(
        `Pour ouvrir son dossier, il manque : ${manquants.join(', ')}`,
      )
    if (fiche.dateNaissance! > new Date())
      throw new BadRequestException(
        'La date de naissance ne peut pas être dans le futur',
      )

    const categorie = await this.prisma.categoriePatient.findFirst({
      where: {
        code: agent.typeContrat === 'CDD' ? 'ASSURE_CDD' : 'ASSURE_CDI',
      },
      select: { id: true },
    })
    if (!categorie)
      throw new BadRequestException(
        `Catégorie ${agent.typeContrat} introuvable dans les référentiels`,
      )

    let dossier: { id: string }
    try {
      dossier = await this.create(
        {
          nom: agent.nom,
          prenom: agent.prenom,
          dateNaissance: fiche.dateNaissance!.toISOString(),
          sexe: fiche.sexe!,
          categoriePatientId: categorie.id,
          siteCreationId: dto.siteCreationId,
          matricule: agent.matricule,
          fonction: libelleFonction(agent.role),
          sectionPaie: fiche.sectionPaie!,
          service: agent.service,
          departement: fiche.departement!,
        },
        createdBy,
      )
    } catch (e) {
      // Ouvert entre-temps par un autre poste : on reprend celui-là.
      const entreTemps = await this.dossierDuMatricule(agent.matricule)
      if (entreTemps) return { id: entreTemps, cree: false }
      throw e
    }

    // Ce que l'accueil a complété reste sur la fiche : on ne le redemandera pas.
    const completes = {
      ...(!agent.dateNaissance && { dateNaissance: fiche.dateNaissance }),
      ...(!agent.sexe && { sexe: fiche.sexe }),
      ...(!agent.sectionPaie && { sectionPaie: fiche.sectionPaie }),
      ...(!agent.departement && { departement: fiche.departement }),
    }
    if (Object.keys(completes).length)
      await this.prisma.personnelMedical.update({
        where: { id: agent.id },
        data: completes,
      })

    return { id: dossier.id, cree: true }
  }

  /** Dossier vivant portant ce matricule ; refus net s'il appartient à un dossier supprimé. */
  private async dossierDuMatricule(matricule: string) {
    const d = await this.prisma.raw.patient.findUnique({
      where: { matricule },
      select: { id: true, deletedAt: true },
    })
    if (d?.deletedAt)
      throw new ConflictException(
        `Le matricule ${matricule} appartient à un dossier supprimé`,
      )
    return d?.id ?? null
  }

  // ── Mise à jour identité ──────────────────────────────────────────────────

  async updateIdentite(id: string, dto: UpdateIdentiteDto) {
    await this.assertPatientExists(id)
    const {
      contactUrgence,
      dateNaissance,
      matricule,
      fonction,
      sectionPaie,
      service,
      departement,
      ...identiteFields
    } = dto

    // Matricule employeur (unicité)
    if (matricule !== undefined) {
      if (matricule) {
        const exists = await this.prisma.patient.findFirst({
          where: { matricule, id: { not: id } },
          select: { id: true },
        })
        if (exists)
          throw new ConflictException(
            `Le matricule ${matricule} est déjà attribué à un patient`,
          )
      }
      await this.prisma.patient.update({
        where: { id },
        data: { matricule: matricule || null },
      })
    }

    // Données professionnelles (CDI/CDD)
    if (
      fonction !== undefined ||
      sectionPaie !== undefined ||
      service !== undefined ||
      departement !== undefined
    ) {
      await this.prisma.donneesEmploi.upsert({
        where: { patientId: id },
        update: {
          ...(fonction !== undefined && { fonction: fonction || null }),
          ...(sectionPaie !== undefined && {
            sectionPaie: sectionPaie || null,
          }),
          ...(service !== undefined && { service: service || null }),
          ...(departement !== undefined && {
            departement: departement || null,
          }),
        },
        create: {
          patientId: id,
          fonction: fonction ?? null,
          sectionPaie: sectionPaie ?? null,
          service: service ?? null,
          departement: departement ?? null,
        },
      })
    }

    // Mise à jour identité civile
    if (Object.keys(identiteFields).length > 0 || dateNaissance) {
      // Téléphone / adresse : une chaîne VIDE efface (null). Avant, elle était écrite
      // telle quelle et le formulaire, qui omettait le champ vidé, laissait l'ancienne
      // valeur en base.
      const identite = {
        ...identiteFields,
        ...(identiteFields.telephone !== undefined && { telephone: identiteFields.telephone || null }),
        ...(identiteFields.adresse !== undefined && { adresse: identiteFields.adresse || null }),
      }
      await this.prisma.identitePatient.upsert({
        where: { patientId: id },
        update: {
          ...identite,
          ...(dateNaissance && { dateNaissance: new Date(dateNaissance) }),
        },
        create: {
          patientId: id,
          nom: identite.nom ?? '',
          prenom: identite.prenom ?? '',
          // Inconnu = NULL (colonnes nullables), jamais « aujourd'hui » ni « M » inventés.
          dateNaissance: dateNaissance ? new Date(dateNaissance) : null,
          sexe: identite.sexe ?? null,
          telephone: identite.telephone ?? null,
          adresse: identite.adresse ?? null,
        },
      })
    }

    // Mise à jour contact urgence
    if (contactUrgence) {
      await this.prisma.contactUrgence.upsert({
        where: { patientId: id },
        update: contactUrgence,
        create: {
          patientId: id,
          nom: '',
          prenom: '',
          telephone: '',
          lien: '',
          ...contactUrgence,
        },
      })
    }

    return this.findById(id)
  }

  // ── Mode de vie (recueil) ──────────────────────────────────────────────────

  async upsertModeVie(id: string, dto: UpsertModeVieDto) {
    await this.assertPatientExists(id)
    const data = {
      tabac: dto.tabac ?? null,
      alcool: dto.alcool ?? null,
      drogues: dto.drogues ?? null,
      activitePhysique: dto.activitePhysique ?? null,
      alimentation: dto.alimentation ?? null,
      sommeil: dto.sommeil ?? null,
      troublesSommeil: dto.troublesSommeil ?? null,
      sedentarite: dto.sedentarite ?? null,
      portCharges: dto.portCharges ?? null,
      automedication: dto.automedication ?? null,
      observations: dto.observations ?? null,
    }
    await this.prisma.modeViePatient.upsert({
      where: { patientId: id },
      update: data,
      create: { patientId: id, ...data },
    })
    return this.findById(id)
  }

  // ── Changement de catégorie ───────────────────────────────────────────────
  // Règles (alignées sur create() — la visite reste le seul point d'entrée pour
  // les rattachements) :
  //  1. AYANT_DROIT_CDI / SOUS_TRAITANT sont des destinations INTERDITES ici —
  //     elles exigent un matricule de CDI rattaché / une société, jamais collectés
  //     par ce formulaire ; les créer sans ça reproduirait l'incohérence corrigée
  //     dans create() (ayant droit sans sponsor, etc.).
  //  2. Un CDI/CDD qui sponsorise encore des ayants droit actifs (lien cdiId)
  //     ne peut pas changer de catégorie tant que ces rattachements existent —
  //     sinon des ayants droit se retrouveraient couverts par quelqu'un qui n'est
  //     plus CDI, sans que personne ne le voie (le rattachement, lui, resterait actif).
  //  3. À l'inverse, quitter AYANT_DROIT_CDI/SOUS_TRAITANT clôture automatiquement
  //     le rattachement PROPRE au patient (celui qui ne concerne que lui) — pas
  //     besoin de bloquer, juste de ne pas laisser un rattachement actif orphelin.
  //  4. Devenir ASSURE_CDI/ASSURE_CDD exige les mêmes données obligatoires qu'à la
  //     visite (matricule/fonction/section/service/département), pour que ce
  //     patient devienne un sponsor valide, retrouvable par son matricule.

  async changerCategorie(
    id: string,
    dto: ChangerCategorieDto,
    userId?: string,
  ) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: { categoriePatient: { select: { code: true } }, identite: true },
    })
    if (!patient) throw new NotFoundException(`Patient ${id} introuvable`)

    const nouvelleCategorie = await this.prisma.categoriePatient.findUnique({
      where: { id: dto.nouvelleCategId },
      select: { code: true },
    })
    if (!nouvelleCategorie)
      throw new BadRequestException('Catégorie de patient invalide')

    const ancienCode = patient.categoriePatient.code
    const nouveauCode = nouvelleCategorie.code

    if (nouveauCode === 'AYANT_DROIT_CDI' || nouveauCode === 'SOUS_TRAITANT') {
      throw new ConflictException(
        'Pour rattacher ce patient à un travailleur CDI ou à une société, passez par une nouvelle visite (« Rattacher à un travailleur CDI » sous le patient sélectionné) — ce statut ne peut pas être attribué depuis le changement de catégorie.',
      )
    }

    if (ancienCode === 'ASSURE_CDI' || ancienCode === 'ASSURE_CDD') {
      const liens = await this.prisma.rattachementAyantDroitCdi.findMany({
        where: { statut: 'ACTIF', cdiId: id },
        select: {
          patient: {
            select: {
              numeroPatient: true,
              identite: { select: { prenom: true, nom: true } },
            },
          },
        },
      })
      if (liens.length > 0) {
        // On NOMME les ayants droit : l'écran du CDI ne permet pas de clôturer leurs
        // rattachements, il faut ouvrir leur dossier — encore faut-il savoir lesquels.
        const noms = liens
          .slice(0, 5)
          .map(
            (l) =>
              `${l.patient.identite ? `${l.patient.identite.prenom} ${l.patient.identite.nom}` : ''} (${l.patient.numeroPatient})`.trim(),
          )
          .join(', ')
        throw new ConflictException(
          `Ce patient a encore ${liens.length} ayant(s) droit rattaché(s) : ${noms}${liens.length > 5 ? '…' : ''}. Clôturez leurs rattachements depuis leur dossier (Administratif › Rattachements) avant de changer sa catégorie.`,
        )
      }
    }

    // Devenir CDI/CDD : mêmes données obligatoires qu'à la visite (recueil §5).
    let matriculePropre = patient.matricule
    const isCdiCdd =
      nouveauCode === 'ASSURE_CDI' || nouveauCode === 'ASSURE_CDD'
    if (isCdiCdd) {
      const manquants: string[] = []
      if (!dto.matricule?.trim()) manquants.push('matricule')
      if (!dto.fonction?.trim()) manquants.push('fonction')
      if (!dto.sectionPaie?.trim()) manquants.push('section de paie')
      if (!dto.service?.trim()) manquants.push('service')
      if (!dto.departement?.trim()) manquants.push('département')
      if (manquants.length) {
        throw new BadRequestException(
          `Données obligatoires manquantes pour « ${nouvelleCategorie.code} » : ${manquants.join(', ')}`,
        )
      }
      matriculePropre = dto.matricule!.trim()
      if (matriculePropre !== patient.matricule) {
        const clash = await this.prisma.patient.findFirst({
          where: { matricule: matriculePropre, id: { not: id } },
          select: { id: true },
        })
        if (clash)
          throw new ConflictException(
            `Le matricule ${matriculePropre} est déjà attribué à un patient`,
          )
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.historiqueCategoriePatient.create({
        data: {
          patientId: id,
          ancienneCategId: patient.categoriePatientId,
          nouvelleCategId: dto.nouvelleCategId,
          dateEffet: new Date(),
          motif: dto.motif,
          createdBy: userId ?? null,
        },
      })

      if (ancienCode === 'AYANT_DROIT_CDI') {
        // TOUS les rattachements actifs : un ayant droit peut en avoir deux (ses deux
        // parents CDI). N'en clôturer qu'un laissait l'autre ouvrir encore des droits.
        const actifs = await tx.rattachementAyantDroitCdi.findMany({
          where: { patientId: id, statut: 'ACTIF' },
          select: { id: true },
        })
        for (const ratt of actifs) {
          await tx.rattachementAyantDroitCdi.update({
            where: { id: ratt.id },
            data: { statut: 'INACTIF' },
          })
          await tx.historiqueRattachementAyantDroit.create({
            data: { rattachementId: ratt.id, evenement: 'CLOTURE', createdBy: userId ?? null },
          })
        }
      }
      if (ancienCode === 'SOUS_TRAITANT') {
        const ratt = await tx.rattachementSousTraitant.findFirst({
          where: { patientId: id, statut: 'ACTIF' },
        })
        if (ratt) {
          await tx.rattachementSousTraitant.update({
            where: { id: ratt.id },
            data: { statut: 'INACTIF' },
          })
          await tx.historiqueRattachementSousTraitant.create({
            data: { rattachementId: ratt.id, evenement: 'CLOTURE', createdBy: userId ?? null },
          })
        }
      }

      if (isCdiCdd) {
        await tx.donneesEmploi.upsert({
          where: { patientId: id },
          update: {
            fonction: dto.fonction!.trim(),
            sectionPaie: dto.sectionPaie!.trim(),
            service: dto.service!.trim(),
            departement: dto.departement!.trim(),
          },
          create: {
            patientId: id,
            fonction: dto.fonction!.trim(),
            sectionPaie: dto.sectionPaie!.trim(),
            service: dto.service!.trim(),
            departement: dto.departement!.trim(),
          },
        })
      }

      return tx.patient.update({
        where: { id },
        data: {
          categoriePatientId: dto.nouvelleCategId,
          ...(isCdiCdd ? { matricule: matriculePropre } : {}),
        },
        include: {
          categoriePatient: CATEGORIE_SELECT,
          siteCreation: SITE_SELECT,
          identite: true,
        },
      })
    })
  }

  // ── Statut patient ────────────────────────────────────────────────────────

  async updateStatut(id: string, dto: ToggleStatutPatientDto) {
    await this.assertPatientExists(id)
    return this.prisma.patient.update({
      where: { id },
      data: { statut: dto.statut as any },
    })
  }

  // ── Allergies ─────────────────────────────────────────────────────────────

  async createAllergie(patientId: string, dto: CreateAllergieDto) {
    await this.assertPatientExists(patientId)
    return this.prisma.allergiePatient.create({
      data: { patientId, ...dto },
    })
  }

  async updateAllergie(
    patientId: string,
    allergieId: string,
    dto: UpdateAllergieDto,
  ) {
    const allergie = await this.prisma.allergiePatient.findFirst({
      where: { id: allergieId, patientId },
    })
    if (!allergie) throw new NotFoundException('Allergie introuvable')
    return this.prisma.allergiePatient.update({
      where: { id: allergieId },
      data: dto,
    })
  }

  // ── Antécédents ───────────────────────────────────────────────────────────

  async createAntecedent(patientId: string, dto: CreateAntecedentDto) {
    await this.assertPatientExists(patientId)
    return this.prisma.antecedentPatient.create({
      data: { patientId, ...dto },
      include: { pathologie: { select: { id: true, libelle: true } } },
    })
  }

  async updateAntecedent(
    patientId: string,
    antecedentId: string,
    dto: UpdateAntecedentDto,
  ) {
    const ant = await this.prisma.antecedentPatient.findFirst({
      where: { id: antecedentId, patientId },
    })
    if (!ant) throw new NotFoundException('Antécédent introuvable')
    return this.prisma.antecedentPatient.update({
      where: { id: antecedentId },
      data: dto,
      include: { pathologie: { select: { id: true, libelle: true } } },
    })
  }

  // ── Alertes médicales ─────────────────────────────────────────────────────

  async createAlerte(patientId: string, dto: CreateAlerteMedicaleDto) {
    await this.assertPatientExists(patientId)
    return this.prisma.alerteMedicale.create({
      data: { patientId, ...dto },
    })
  }

  async updateAlerte(
    patientId: string,
    alerteId: string,
    dto: UpdateAlerteMedicaleDto,
  ) {
    const alerte = await this.prisma.alerteMedicale.findFirst({
      where: { id: alerteId, patientId },
    })
    if (!alerte) throw new NotFoundException('Alerte introuvable')
    return this.prisma.alerteMedicale.update({
      where: { id: alerteId },
      data: {
        ...dto,
        ...(dto.statut === 'INACTIVE' && { resolvedAt: new Date() }),
        ...(dto.statut === 'ACTIVE' && { resolvedAt: null }),
      },
    })
  }

  /** Droits réels du patient — même calcul que la garde de génération des bons. */
  findCouverture(patientId: string) {
    return couverturePatient(this.prisma, patientId)
  }

  // ── Rattachements Ayant Droit CDI ─────────────────────────────────────────
  // Création réservée à la VISITE (un seul point d'entrée, cf. plan validé avec
  // l'utilisateur) : à la création du dossier (create()), ou pour un patient déjà
  // enregistré (rattacherAyantDroit ci-dessous). Rien depuis le dossier lui-même.

  /**
   * Travailleur CDI auquel rattacher un ayant droit — ÉTAPE 1, hors transaction :
   * retrouvé par le matricule de son DOSSIER patient, ou à créer si le matricule est
   * inconnu (il n'existe pas de registre des employés : le dossier fait foi).
   *
   * Un matricule CONNU doit désigner un travailleur CDI ACTIF : le matricule d'un CDD, ou
   * d'un dossier passé dans une autre catégorie (retraité, départ…), ne crée pas d'ayant
   * droit avec la gratuité complète. Une faute de frappe sur un matricule existant reste
   * possible — c'est pourquoi l'écran affiche le NOM du travailleur reconnu avant
   * validation.
   */
  private async planifierCdiRattachement(
    cdiMatricule: string,
    nouveauTravailleur?: TravailleurCdiSaisie,
  ): Promise<PlanCdi> {
    const mat = cdiMatricule.trim()
    // Client BRUT : un dossier supprimé (soft-delete) garde son matricule (@unique).
    const dossier = await this.prisma.raw.patient.findUnique({
      where: { matricule: mat },
      select: {
        id: true,
        statut: true,
        deletedAt: true,
        categoriePatient: { select: { code: true, libelle: true } },
        identite: { select: { nom: true, prenom: true } },
      },
    })
    if (dossier) {
      const nom = [dossier.identite?.prenom, dossier.identite?.nom].filter(Boolean).join(' ')
      if (dossier.deletedAt) {
        throw new ConflictException(
          `Le matricule ${mat} appartient à un dossier supprimé (${nom}) : aucun ayant droit ne peut lui être rattaché.`,
        )
      }
      if (dossier.categoriePatient.code !== 'ASSURE_CDI') {
        throw new ConflictException(
          `Le matricule ${mat} est celui de ${nom}, dont le dossier est en catégorie « ${dossier.categoriePatient.libelle} » : seul un travailleur CDI peut avoir des ayants droit.`,
        )
      }
      if (dossier.statut !== 'ACTIF') {
        throw new ConflictException(
          `Le dossier de ${nom} (matricule ${mat}) n'est plus actif : aucun ayant droit ne peut lui être rattaché.`,
        )
      }
      return {
        existant: {
          id: dossier.id,
          nom: dossier.identite?.nom ?? '',
          prenom: dossier.identite?.prenom ?? '',
          matricule: mat,
        },
      }
    }
    // Travailleur CDI sans dossier → il sera créé avec l'identité fournie.
    if (!nouveauTravailleur?.nom?.trim() || !nouveauTravailleur?.prenom?.trim()) {
      throw new BadRequestException(
        `Matricule CDI « ${mat} » inconnu — renseignez l'identité du travailleur CDI rattaché`,
      )
    }
    return { aCreer: { matricule: mat, ...nouveauTravailleur } }
  }

  /**
   * ÉTAPE 2, DANS la transaction : crée le dossier du travailleur planifié s'il n'existe
   * pas. Hors transaction, un échec de l'enregistrement de l'ayant droit laissait derrière
   * lui un travailleur orphelin, saisi à la hâte, « reconnu » au nouvel essai.
   */
  private async materialiserCdi(
    plan: PlanCdi,
    client: Prisma.TransactionClient,
    siteId: string,
    createdBy?: string,
    floorNum = 0,
  ): Promise<TravailleurCdi> {
    if ('existant' in plan) return plan.existant
    return this.creerDossierTravailleurCdi(plan.aCreer, siteId, createdBy, client, floorNum)
  }

  /**
   * Rattache un patient DÉJÀ ENREGISTRÉ à un travailleur CDI (accueil, nouvelle visite).
   *
   *  - Patient d'une autre catégorie (population, sous-traitant…) : il DEVIENT ayant droit,
   *    avec trace dans l'historique de catégorie ; un rattachement sous-traitant actif est
   *    clôturé (on ne cumule pas deux statuts).
   *  - Patient déjà ayant droit : un rattachement de plus — le cas du 2e parent CDI. Ses
   *    droits survivent alors au départ de l'un des deux (cf. couverturePatient).
   *  - Jamais deux rattachements actifs vers le même travailleur (pas de doublon).
   *  - Un employé (CDI/CDD) n'est jamais l'ayant droit d'un autre : sa prise en charge
   *    suit son propre contrat.
   */
  async rattacherAyantDroit(
    patientId: string,
    dto: RattacherAyantDroitDto,
    userId?: string,
    siteId?: string,
  ) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        siteCreationId: true,
        categoriePatientId: true,
        categoriePatient: { select: { code: true } },
      },
    })
    if (!patient) throw new NotFoundException(`Patient ${patientId} introuvable`)
    const code = patient.categoriePatient.code
    if (code === 'ASSURE_CDI' || code === 'ASSURE_CDD') {
      throw new ConflictException(
        "Ce patient est lui-même employé : sa prise en charge suit son propre contrat, pas un rattachement d'ayant droit.",
      )
    }

    const plan = await this.planifierCdiRattachement(
      dto.cdiMatricule,
      dto.nouveauTravailleur,
    )

    if ('existant' in plan) {
      const cdiConnu = plan.existant
      const dejaRattache = await this.prisma.rattachementAyantDroitCdi.findFirst({
        where: { patientId, cdiId: cdiConnu.id, statut: 'ACTIF' },
        select: { id: true },
      })
      if (dejaRattache) {
        throw new ConflictException(
          `Ce patient est déjà rattaché à ${cdiConnu.prenom} ${cdiConnu.nom} (matricule ${cdiConnu.matricule}).`,
        )
      }
    }

    const categAD = await this.prisma.categoriePatient.findUnique({
      where: { code: 'AYANT_DROIT_CDI' },
      select: { id: true },
    })
    if (!categAD)
      throw new BadRequestException(
        'Catégorie « Ayant droit CDI » absente du référentiel',
      )

    const site = siteId ?? patient.siteCreationId
    return this.prisma.$transaction(async (tx) => {
      const cdi = await this.materialiserCdi(plan, tx, site, userId)
      if (code !== 'AYANT_DROIT_CDI') {
        await tx.historiqueCategoriePatient.create({
          data: {
            patientId,
            ancienneCategId: patient.categoriePatientId,
            nouvelleCategId: categAD.id,
            dateEffet: new Date(),
            motif: `Rattachement comme ayant droit de ${cdi.prenom} ${cdi.nom} (matricule ${cdi.matricule})`,
            createdBy: userId ?? null,
          },
        })
        if (code === 'SOUS_TRAITANT') {
          const actifs = await tx.rattachementSousTraitant.findMany({
            where: { patientId, statut: 'ACTIF' },
            select: { id: true },
          })
          for (const r of actifs) {
            await tx.rattachementSousTraitant.update({
              where: { id: r.id },
              data: { statut: 'INACTIF', dateFin: new Date() },
            })
            await tx.historiqueRattachementSousTraitant.create({
              data: { rattachementId: r.id, evenement: 'CLOTURE', createdBy: userId ?? null },
            })
          }
        }
        await tx.patient.update({
          where: { id: patientId },
          data: { categoriePatientId: categAD.id },
        })
      }

      const ratt = await tx.rattachementAyantDroitCdi.create({
        data: {
          patientId,
          cdiId: cdi.id,
          typeLien: dto.typeLien,
          dateDebut: new Date(),
        },
      })
      await tx.historiqueRattachementAyantDroit.create({
        data: {
          rattachementId: ratt.id,
          evenement: 'CREATION',
          createdBy: userId ?? null,
        },
      })
      return ratt
    })
  }

  async updateRattachementAD(
    patientId: string,
    rattId: string,
    dto: UpdateRattachementADDto,
    userId?: string,
  ) {
    const ratt = await this.prisma.rattachementAyantDroitCdi.findFirst({
      where: { id: rattId, patientId },
      include: {
        patient: { select: { categoriePatient: { select: { code: true } } } },
      },
    })
    if (!ratt)
      throw new NotFoundException('Rattachement ayant droit introuvable')

    // RÉACTIVATION : mêmes garde-fous qu'à la création. Sans eux, un ancien ayant droit
    // devenu CDI (son lien clôturé reste affiché avec « Réactiver ») redevenait l'ayant
    // droit ACTIF de son parent — et la réactivation d'un lien vers un CDI parti rendait
    // la gratuité.
    if (dto.statut === 'ACTIF' && ratt.statut !== 'ACTIF') {
      if (ratt.patient.categoriePatient.code !== 'AYANT_DROIT_CDI') {
        throw new ConflictException(
          "Ce patient n'est plus ayant droit : son ancien rattachement reste dans l'historique mais ne peut pas être réactivé.",
        )
      }
      if (ratt.cdiId) {
        const cdi = await this.prisma.patient.findUnique({
          where: { id: ratt.cdiId },
          select: {
            statut: true,
            categoriePatient: { select: { code: true } },
            identite: { select: { nom: true, prenom: true } },
          },
        })
        if (!cdi || cdi.categoriePatient.code !== 'ASSURE_CDI' || cdi.statut !== 'ACTIF') {
          const nom = cdi?.identite ? `${cdi.identite.prenom} ${cdi.identite.nom}` : 'Le travailleur'
          throw new ConflictException(
            `${nom} n'est plus un travailleur CDI actif : ce rattachement ne peut pas être réactivé.`,
          )
        }
        const doublon = await this.prisma.rattachementAyantDroitCdi.findFirst({
          where: { patientId, cdiId: ratt.cdiId, statut: 'ACTIF', id: { not: rattId } },
          select: { id: true },
        })
        if (doublon) {
          throw new ConflictException(
            'Un rattachement actif vers ce même travailleur existe déjà.',
          )
        }
      }
    }
    const { dateDebut, dateFin, ...rest } = dto
    const updated = await this.prisma.rattachementAyantDroitCdi.update({
      where: { id: rattId },
      data: {
        ...rest,
        ...(dateDebut && { dateDebut: new Date(dateDebut) }),
        ...(dateFin !== undefined && {
          dateFin: dateFin ? new Date(dateFin) : null,
        }),
      },
    })
    // L'événement dit ce qui s'est passé, et QUI l'a fait (auteur jamais renseigné avant).
    await this.prisma.historiqueRattachementAyantDroit.create({
      data: {
        rattachementId: rattId,
        evenement:
          dto.statut === 'INACTIF'
            ? 'CLOTURE'
            : dto.statut === 'ACTIF' && ratt.statut !== 'ACTIF'
              ? 'REACTIVATION'
              : 'MODIFICATION',
        createdBy: userId ?? null,
      },
    })
    return updated
  }

  // Rattachements Sous-Traitant : gestion manuelle retirée. Le lien se crée
  // automatiquement à la visite (create(), catégorie SOUS_TRAITANT). L'onglet
  // Administratif reste visible pour tous (historique de catégorie) ; seul son
  // sous-onglet Rattachements est réservé au CDI et à ses ayants droit (DossierPage.tsx), et la
  // société d'un sous-traitant est montrée dans la colonne du dossier — aucune UI ne
  // consomme create/update/delete pour ce rattachement.

  // ── Suppression des sous-entités du dossier (perm patient.update) ──────────

  async deleteAllergie(patientId: string, allergieId: string) {
    const a = await this.prisma.allergiePatient.findFirst({
      where: { id: allergieId, patientId },
    })
    if (!a) throw new NotFoundException('Allergie introuvable')
    await this.prisma.allergiePatient.delete({ where: { id: allergieId } })
    return { id: allergieId, deleted: true }
  }

  async deleteAntecedent(patientId: string, antecedentId: string) {
    const a = await this.prisma.antecedentPatient.findFirst({
      where: { id: antecedentId, patientId },
    })
    if (!a) throw new NotFoundException('Antécédent introuvable')
    await this.prisma.antecedentPatient.delete({ where: { id: antecedentId } })
    return { id: antecedentId, deleted: true }
  }

  async deleteAlerte(patientId: string, alerteId: string) {
    const a = await this.prisma.alerteMedicale.findFirst({
      where: { id: alerteId, patientId },
    })
    if (!a) throw new NotFoundException('Alerte introuvable')
    await this.prisma.alerteMedicale.delete({ where: { id: alerteId } })
    return { id: alerteId, deleted: true }
  }

  /**
   * Suppression d'un rattachement (droit dédié patient.rattachement.delete).
   *
   * L'HISTORIQUE n'est plus jamais effacé : il était supprimé physiquement avec le lien
   * (HistoriqueRattachementAyantDroit n'est pas un modèle à suppression logique), si bien
   * qu'on ne pouvait plus dire qui avait rattaché qui, ni quand. On ajoute à la place
   * l'événement SUPPRESSION ; le lien, lui, est retiré logiquement (pierre tombale
   * synchronisée). Sans rattachement en vigueur, les droits de l'ayant droit sont
   * suspendus (couverturePatient) et il peut être rattaché à nouveau depuis la visite.
   */
  async deleteRattachementAD(patientId: string, rattId: string, userId?: string) {
    const r = await this.prisma.rattachementAyantDroitCdi.findFirst({
      where: { id: rattId, patientId },
    })
    if (!r) throw new NotFoundException('Rattachement ayant droit introuvable')
    await this.prisma.$transaction([
      this.prisma.historiqueRattachementAyantDroit.create({
        data: {
          rattachementId: rattId,
          evenement: 'SUPPRESSION',
          createdBy: userId ?? null,
        },
      }),
      this.prisma.rattachementAyantDroitCdi.delete({ where: { id: rattId } }),
    ])
    return { id: rattId, deleted: true }
  }

  // ── Suppression définitive du dossier (perm patient.delete) ────────────────
  // Bloquée si le patient a un historique clinique (visites) : on archive alors.

  async deletePatient(id: string) {
    await this.assertPatientExists(id)
    // Le count via le client filtré masquerait les visites soft-supprimées (tombstones) :
    // on bloque dès qu'un historique clinique a JAMAIS existé → client BRUT non filtré.
    const nbVisites = await this.prisma.raw.visite.count({
      where: { patientId: id },
    })
    if (nbVisites > 0) {
      throw new ConflictException(
        'Ce dossier possède un historique clinique (visites/consultations) : il ne peut être supprimé. Archivez-le plutôt.',
      )
    }
    // Purge des données administratives rattachées puis du dossier.
    const adIds = (
      await this.prisma.rattachementAyantDroitCdi.findMany({
        where: { patientId: id },
        select: { id: true },
      })
    ).map((r) => r.id)
    const stIds = (
      await this.prisma.rattachementSousTraitant.findMany({
        where: { patientId: id },
        select: { id: true },
      })
    ).map((r) => r.id)
    try {
      await this.prisma.$transaction([
        this.prisma.historiqueRattachementAyantDroit.deleteMany({
          where: { rattachementId: { in: adIds } },
        }),
        this.prisma.historiqueRattachementSousTraitant.deleteMany({
          where: { rattachementId: { in: stIds } },
        }),
        this.prisma.rattachementAyantDroitCdi.deleteMany({
          where: { patientId: id },
        }),
        this.prisma.rattachementSousTraitant.deleteMany({
          where: { patientId: id },
        }),
        this.prisma.allergiePatient.deleteMany({ where: { patientId: id } }),
        this.prisma.antecedentPatient.deleteMany({ where: { patientId: id } }),
        this.prisma.alerteMedicale.deleteMany({ where: { patientId: id } }),
        this.prisma.historiqueCategoriePatient.deleteMany({
          where: { patientId: id },
        }),
        this.prisma.contactUrgence.deleteMany({ where: { patientId: id } }),
        this.prisma.identitePatient.deleteMany({ where: { patientId: id } }),
        this.prisma.patient.delete({ where: { id } }),
      ])
    } catch (e: any) {
      if (e?.code === 'P2003' || e?.code === 'P2014') {
        throw new ConflictException(
          "Ce dossier est référencé par d'autres données : suppression impossible. Archivez-le plutôt.",
        )
      }
      throw e
    }
    return { id, deleted: true }
  }
}
