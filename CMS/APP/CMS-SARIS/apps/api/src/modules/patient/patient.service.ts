/**
 * PatientService — Module 4 · Dossier Patient CMS SARIS
 *
 * Gère : patients, identités, allergies, antécédents,
 *        alertes médicales, rattachements CDI + sous-traitants.
 */

import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { StatutPatient } from '@prisma/client'
import sharp from 'sharp'
import { PrismaService } from '../../prisma/prisma.service'
import { CI } from '../../common/prisma/search'
import { NotificationService } from '../notification/notification.service'
import { EmployeService } from '../employe/employe.service'
import {
  CreatePatientDto, UpdateIdentiteDto, UpsertModeVieDto,
  ChangerCategorieDto, ToggleStatutPatientDto, PatientQueryDto,
} from './dto/patient.dto'
import { CreateAllergieDto, UpdateAllergieDto } from './dto/medical.dto'
import { CreateAntecedentDto, UpdateAntecedentDto } from './dto/medical.dto'
import { CreateAlerteMedicaleDto, UpdateAlerteMedicaleDto } from './dto/medical.dto'
import { CreateRattachementADDto, UpdateRattachementADDto } from './dto/rattachement.dto'
import { CreateRattachementSTDto, UpdateRattachementSTDto } from './dto/rattachement.dto'

// ── Alertes cliniques calculées ─────────────────────────────────────────────────

export interface AlerteClinique {
  type:    'ALLERGIE_MEDICAMENT' | 'CONSTANTE_CRITIQUE' | 'CHRONIQUE_SANS_SUIVI'
  gravite: 'CRITIQUE' | 'ELEVE' | 'MODERE'
  titre:   string
  detail:  string
}

// ── Helpers de rapprochement (détection de doublons) ───────────────────────────

/** Minuscule, sans accents, espaces normalisés — pour comparer des noms. */
function normaliser(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Distance de Levenshtein (tolérance aux fautes de frappe). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length, n = b.length
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
    [prev, cur] = [cur, prev]
  }
  return prev[n]
}

function isoDate(d: Date | string | null | undefined): string | null {
  if (!d) return null
  const dt = typeof d === 'string' ? new Date(d) : d
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10)
}

// ── Includes Prisma ───────────────────────────────────────────────────────────

const CATEGORIE_SELECT  = { select: { id: true, code: true, libelle: true } } as const
const SITE_SELECT       = { select: { id: true, code: true, libelle: true } } as const

const LISTE_INCLUDE = {
  identite:         true,
  categoriePatient: CATEGORIE_SELECT,
  siteCreation:     SITE_SELECT,
  allergies: {
    where:  { statut: 'ACTIVE', gravite: 'SEVERE' },
    select: { id: true, substance: true, gravite: true, confirme: true, statut: true, createdAt: true, patientId: true },
  },
  alertesMedicales: {
    where:  { statut: 'ACTIVE' },
    select: { id: true, type: true, gravite: true, message: true, statut: true, createdAt: true, resolvedAt: true, patientId: true },
  },
} as const

const DOSSIER_INCLUDE = {
  identite:         true,
  contactUrgence:   true,
  donneesEmploi:    true,
  modeVie:          true,
  categoriePatient: CATEGORIE_SELECT,
  siteCreation:     SITE_SELECT,
  // ⚠️ `where: { deletedAt: null }` explicite sur les relations soft-deletables : les
  // include imbriqués Prisma ne reçoivent PAS le filtre de l'extension soft-delete, sinon
  // le dossier laisse fuiter les sous-ressources supprimées (tombstones).
  allergies:        { where: { deletedAt: null }, orderBy: { createdAt: 'desc' as const } },
  antecedents:      { where: { deletedAt: null } },   // AntecedentPatient n'a pas de createdAt
  alertesMedicales: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' as const } },
  historiquesCateg: {
    include:  { nouvelleCategorie: CATEGORIE_SELECT },
    orderBy:  { createdAt: 'desc' as const },
  },
  rattachementsAD: {
    where:    { deletedAt: null },
    include:  { historiques: { orderBy: { createdAt: 'desc' as const } } },
    orderBy:  { dateDebut: 'desc' as const },
  },
  rattachementsST: {
    where:   { deletedAt: null },
    include: {
      societe:     { select: { id: true, nom: true, statut: true } },
      historiques: { orderBy: { createdAt: 'desc' as const } },
    },
    orderBy: { dateDebut: 'desc' as const },
  },
} as const

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PatientService {
  constructor(
    private readonly prisma:   PrismaService,
    private readonly notif:    NotificationService,
    private readonly employes: EmployeService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async generateNumeroPatient(siteCreationId: string): Promise<string> {
    const site = await this.prisma.site.findUniqueOrThrow({
      where:  { id: siteCreationId },
      select: { code: true },
    })
    const prefix = site.code === 'MOUTELA' ? 'MOU' : 'NKA'
    // Numéro = (plus grand n° existant pour ce site) + 1. On lit sur le client BRUT
    // (`raw`) pour INCLURE les patients soft-supprimés : leur numeroPatient reste pris
    // (le @unique couvre les tombstones). Un `count` FILTRÉ par deletedAt collisionnerait
    // après une suppression ; baser sur le MAX évite aussi les trous de séquence.
    const last = await this.prisma.raw.patient.findFirst({
      where:   { siteCreationId, numeroPatient: { startsWith: `PAT-${prefix}-` } },
      orderBy: { numeroPatient: 'desc' },
      select:  { numeroPatient: true },
    })
    const lastNum = last ? (parseInt(last.numeroPatient.slice(-5), 10) || 0) : 0
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
        ...(statut      && { statut: statut as StatutPatient }),
        ...(categorieId && { categoriePatientId: categorieId }),
        ...(siteId      && { siteCreationId: siteId }),
        ...(search && {
          OR: [
            { numeroPatient: { contains: search, ...CI } },
            { identite: { nom:    { contains: search, ...CI } } },
            { identite: { prenom: { contains: search, ...CI } } },
          ],
        }),
      },
      include:  LISTE_INCLUDE,
      orderBy:  { createdAt: 'desc' },
    })
  }

  // ── Détection de doublons (triage intelligent) ─────────────────────────────

  /**
   * Renvoie les patients ressemblant à l'identité saisie (même site), pour éviter
   * la création de doublons au triage. Rapprochement par : nom+prénom proches
   * (tolérance fautes), même date de naissance, ou nom/prénom identiques.
   */
  async findSimilar(
    input: { nom: string; prenom: string; dateNaissance?: string; sexe?: string },
    siteId?: string,
  ) {
    const nom = normaliser(input.nom)
    const prenom = normaliser(input.prenom)
    if (nom.length < 2 || prenom.length < 2) return []

    const candidats = await this.prisma.patient.findMany({
      where: { statut: 'ACTIF', ...(siteId && { siteCreationId: siteId }) },
      include: { identite: true, categoriePatient: CATEGORIE_SELECT, siteCreation: SITE_SELECT },
      take: 1000,
    })

    const cibleFull = `${prenom} ${nom}`
    const dobCible  = input.dateNaissance ? isoDate(input.dateNaissance) : null

    const scored = candidats
      .map(p => {
        const pNom    = normaliser(p.identite?.nom)
        const pPrenom = normaliser(p.identite?.prenom)
        const full    = `${pPrenom} ${pNom}`
        const dist    = levenshtein(cibleFull, full)
        const sameDob = !!dobCible && isoDate(p.identite?.dateNaissance) === dobCible
        const nomEq    = pNom === nom
        const prenomEq = pPrenom === prenom
        const isMatch  = dist <= 2 || (nomEq && prenomEq) || (sameDob && (nomEq || prenomEq))
        return { p, dist, sameDob, exact: nomEq && prenomEq, isMatch }
      })
      .filter(x => x.isMatch)
      .sort((a, b) => (a.dist - b.dist) || (Number(b.sameDob) - Number(a.sameDob)))
      .slice(0, 6)

    return scored.map(x => ({
      id:               x.p.id,
      numeroPatient:    x.p.numeroPatient,
      identite:         x.p.identite,
      categoriePatient: x.p.categoriePatient,
      site:             x.p.siteCreation,
      correspondanceDate: x.sameDob,
      correspondanceExacte: x.exact,
    }))
  }

  // ── Dossier complet ───────────────────────────────────────────────────────

  /** Rapprochement par matricule employeur (inscription d'un ayant droit). */
  async findByMatricule(matricule: string) {
    const patient = await this.prisma.patient.findUnique({
      where:  { matricule },
      select: {
        id: true, numeroPatient: true, matricule: true,
        categoriePatient: { select: { code: true, libelle: true } },
        identite: { select: { nom: true, prenom: true, dateNaissance: true, sexe: true } },
      },
    })
    if (!patient) throw new NotFoundException('Aucun travailleur trouvé pour ce matricule')
    return patient
  }

  /**
   * Ayants droit d'un travailleur CDI + leur activité médicale récente — traçabilité
   * dans le dossier du travailleur (l'assuré responsable). Les relations imbriquées
   * portent `deletedAt:null` (l'extension soft-delete ne filtre que le top-level).
   */
  async findAyantsDroits(cdiPatientId: string) {
    // Les ayants droit pendent désormais de l'EMPLOYÉ CDI du registre (employeId) ; on garde
    // la compat avec l'ancien lien direct au patient CDI (cdiId).
    const cdi = await this.prisma.patient.findUnique({ where: { id: cdiPatientId }, select: { employeId: true } })
    const orConds: any[] = [{ cdiId: cdiPatientId }]
    if (cdi?.employeId) orConds.push({ employeId: cdi.employeId })
    return this.prisma.rattachementAyantDroitCdi.findMany({
      where:   { statut: 'ACTIF', OR: orConds },
      orderBy: { dateDebut: 'desc' },
      select: {
        id: true, typeLien: true, dateDebut: true,
        patient: {
          select: {
            id: true, numeroPatient: true,
            categoriePatient: { select: { code: true, libelle: true } },
            identite: { select: { nom: true, prenom: true, dateNaissance: true, sexe: true } },
            visites: {
              where:   { deletedAt: null },   // dossier centralisé : activité de l'ayant droit suit le patient (tous sites)
              orderBy: { dateOuverture: 'desc' },
              take:    5,
              select: {
                id: true, dateOuverture: true, statut: true,
                motifPrincipal: { select: { libelle: true } },
                consultations:  { where: { deletedAt: null }, select: { id: true, statut: true } },
              },
            },
          },
        },
      },
    })
  }

  /** Confidentialité : un médecin restreint (hors supervision) ne peut accéder qu'aux
   *  patients qu'il SUIT (consultation ou visite dont il est le soignant). No-op sinon. */
  private async assertOwnPatient(patientId: string, scope?: { restrictToOwn: boolean; personnelMedicalId: string | null }) {
    if (!scope?.restrictToOwn) return
    const soignantId = scope.personnelMedicalId ?? '__aucun_soignant__'
    const [conso, visite] = await Promise.all([
      this.prisma.consultation.findFirst({ where: { soignantId, visite: { patientId } }, select: { id: true } }),
      this.prisma.visite.findFirst({ where: { soignantId, patientId }, select: { id: true } }),
    ])
    if (!conso && !visite) {
      throw new ForbiddenException("Accès refusé : vous n'êtes pas le médecin de ce patient")
    }
  }

  async findById(id: string, scope?: { restrictToOwn: boolean; personnelMedicalId: string | null; canViewLocked?: boolean }) {
    const dossier = await this.prisma.patient.findUnique({
      where:   { id },
      include: DOSSIER_INCLUDE,
    })
    if (!dossier) throw new NotFoundException(`Patient ${id} introuvable`)
    await this.assertOwnPatient(id, scope)
    // Verrou de confidentialité (médecin-chef) : pour un utilisateur NON-supervision,
    // le dossier est renvoyé DÉPOUILLÉ de son contenu clinique (identité + indicateur
    // verrouille conservés → le front force le rideau ON, non-survolable). Le vrai
    // contenu ne quitte jamais le serveur.
    if (dossier.verrouille && !scope?.canViewLocked) {
      return { ...dossier, allergies: [], antecedents: [], alertesMedicales: [], modeVie: null, donneesEmploi: null }
    }
    return dossier
  }

  /** Verrou (médecin-chef) : restreint l'accès au dossier à la supervision. */
  async setVerrou(id: string, verrouille: boolean, motif: string | null, userId: string | null) {
    await this.assertPatientExists(id)
    return this.prisma.patient.update({
      where: { id },
      data:  verrouille
        ? { verrouille: true, verrouilleParId: userId, verrouilleLe: new Date(), motifVerrou: motif?.trim() || null }
        : { verrouille: false, verrouilleParId: null, verrouilleLe: null, motifVerrou: null },
      select: { id: true, verrouille: true, verrouilleLe: true, motifVerrou: true },
    })
  }

  /** True si le dossier est verrouillé ET l'appelant n'est pas supervision → contenu clinique masqué. */
  private async isCliniqueMasque(patientId: string, canViewLocked?: boolean): Promise<boolean> {
    if (canViewLocked) return false
    const p = await this.prisma.patient.findUnique({ where: { id: patientId }, select: { verrouille: true } })
    return !!p?.verrouille
  }

  /**
   * Historique des constantes vitales du patient (TOUTES visites, TOUS sites),
   * du plus récent au plus ancien. Le dossier patient est CENTRALISÉ (continuité
   * de soins) : l'historique suit le patient même s'il a été soigné sur un autre
   * site (ex. travailleur muté). Le cloisonnement ne s'applique plus au dossier.
   */
  async findConstantes(patientId: string, scope?: { restrictToOwn: boolean; personnelMedicalId: string | null; canViewLocked?: boolean }) {
    await this.assertOwnPatient(patientId, scope)
    if (await this.isCliniqueMasque(patientId, scope?.canViewLocked)) return []
    return this.prisma.constanteVitale.findMany({
      where:   { patientId },   // suit le patient (tous sites)
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Alertes cliniques CALCULÉES (non saisies) du patient. Trois règles :
   *  1. Allergie ↔ médicament prescrit (ordonnance validée correspondant à une allergie active)
   *  2. Constantes critiques (dernière mesure hors plage)
   *  3. Pathologie chronique diagnostiquée sans suivi chronique actif
   * NB : la règle 1 est un rapprochement textuel (nom générique/commercial/famille) —
   * elle ne remplace pas une base d'interactions médicamenteuses.
   */
  async findAlertesCliniques(patientId: string, scope?: { restrictToOwn: boolean; personnelMedicalId: string | null; canViewLocked?: boolean }): Promise<AlerteClinique[]> {
    await this.assertOwnPatient(patientId, scope)
    if (await this.isCliniqueMasque(patientId, scope?.canViewLocked)) return []
    const consultScope = { visite: { patientId } }   // dossier centralisé : suit le patient (tous sites)

    const [allergies, lignes, lastConst, chronicDiags, suivisActifs] = await Promise.all([
      this.prisma.allergiePatient.findMany({ where: { patientId, statut: 'ACTIVE' } }),
      this.prisma.ligneOrdonnance.findMany({
        where:   { ordonnance: { statut: 'VALIDEE', consultation: consultScope } },
        include: { medicament: { select: { nomGenerique: true, nomCommercial: true, familleThera: true } } },
      }),
      this.prisma.constanteVitale.findFirst({
        where:   { patientId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.diagnosticConsultation.findMany({
        where:   { consultation: consultScope, pathologie: { chronique: true } },
        include: { pathologie: { select: { id: true, libelle: true } } },
      }),
      this.prisma.suiviChronique.findMany({ where: { patientId, statut: 'ACTIF' }, select: { pathologieId: true } }),
    ])

    const alertes: AlerteClinique[] = []

    // ── Règle 1 : allergie ↔ médicament prescrit ──────────────────────────────
    const seenAM = new Set<string>()
    for (const a of allergies) {
      const sub = normaliser(a.substance)
      if (sub.length < 4) continue
      for (const l of lignes) {
        const fields = [l.medicament.nomGenerique, l.medicament.nomCommercial, l.medicament.familleThera]
          .filter(Boolean).map(s => normaliser(s as string))
        const hit = fields.some(f => f.includes(sub) || (f.length >= 4 && sub.includes(f)))
        if (!hit) continue
        const key = `${a.id}-${l.medicamentId}`
        if (seenAM.has(key)) continue
        seenAM.add(key)
        const medName = l.medicament.nomCommercial || l.medicament.nomGenerique
        alertes.push({
          type: 'ALLERGIE_MEDICAMENT', gravite: 'CRITIQUE',
          titre: 'Allergie vs médicament prescrit',
          detail: `« ${medName} » prescrit alors que le patient est allergique à « ${a.substance} ».`,
        })
      }
    }

    // ── Règle 2 : constantes critiques (dernière mesure) ──────────────────────
    if (lastConst) {
      const c = lastConst
      if (c.saturationO2 != null && c.saturationO2 < 90)
        alertes.push({ type: 'CONSTANTE_CRITIQUE', gravite: 'CRITIQUE', titre: 'Hypoxie', detail: `SpO₂ à ${c.saturationO2}% (< 90%).` })
      if (c.temperature != null && c.temperature >= 38.5)
        alertes.push({ type: 'CONSTANTE_CRITIQUE', gravite: c.temperature >= 39.5 ? 'CRITIQUE' : 'ELEVE', titre: 'Fièvre élevée', detail: `Température à ${c.temperature}°C.` })
      if (c.tensionSystolique != null && c.tensionSystolique >= 160)
        alertes.push({ type: 'CONSTANTE_CRITIQUE', gravite: c.tensionSystolique >= 180 ? 'CRITIQUE' : 'ELEVE', titre: 'Tension élevée', detail: `Tension systolique à ${c.tensionSystolique} mmHg.` })
      if (c.frequenceCardiaque != null && c.frequenceCardiaque >= 120)
        alertes.push({ type: 'CONSTANTE_CRITIQUE', gravite: 'ELEVE', titre: 'Tachycardie', detail: `Fréquence cardiaque à ${c.frequenceCardiaque} bpm.` })
      if (c.frequenceCardiaque != null && c.frequenceCardiaque < 50)
        alertes.push({ type: 'CONSTANTE_CRITIQUE', gravite: 'ELEVE', titre: 'Bradycardie', detail: `Fréquence cardiaque à ${c.frequenceCardiaque} bpm.` })
    }

    // ── Règle 3 : pathologie chronique sans suivi actif ───────────────────────
    const suiviSet = new Set(suivisActifs.map(s => s.pathologieId))
    const seenPath = new Set<string>()
    for (const d of chronicDiags) {
      if (suiviSet.has(d.pathologieId) || seenPath.has(d.pathologieId)) continue
      seenPath.add(d.pathologieId)
      alertes.push({
        type: 'CHRONIQUE_SANS_SUIVI', gravite: 'MODERE',
        titre: 'Chronique sans suivi',
        detail: `« ${d.pathologie.libelle} » diagnostiquée sans suivi chronique actif.`,
      })
    }

    const order: Record<AlerteClinique['gravite'], number> = { CRITIQUE: 0, ELEVE: 1, MODERE: 2 }
    alertes.sort((a, b) => order[a.gravite] - order[b.gravite])
    return alertes
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
      .rotate()                                    // respecte l'orientation EXIF
      .resize(512, 512, { fit: 'cover', position: 'centre' }) // carré recadré centré
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()

    const photoUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`
    await this.prisma.identitePatient.update({
      where: { patientId: id },
      data:  { photoUrl },
    })
    return { photoUrl }
  }

  // ── Création patient ──────────────────────────────────────────────────────

  async create(dto: CreatePatientDto, createdBy?: string) {
    const { nom, prenom, dateNaissance, sexe, telephone, adresse,
            categoriePatientId, siteCreationId, contactUrgence, matricule,
            fonction, sectionPaie, service, departement,
            cdiMatricule, typeLien, societeId, nouvelEmploye } = dto

    // La CATÉGORIE pilote les données administratives obligatoires (recueil §5).
    const categorie = await this.prisma.categoriePatient.findUnique({
      where: { id: categoriePatientId }, select: { code: true, libelle: true },
    })
    if (!categorie) throw new BadRequestException('Catégorie de patient invalide')
    const code = categorie.code
    const isCdiCdd = code === 'ASSURE_CDI' || code === 'ASSURE_CDD'

    // CDI / CDD : matricule + fonction + section + service + département obligatoires
    if (isCdiCdd) {
      const manquants: string[] = []
      if (!matricule?.trim())   manquants.push('matricule')
      if (!fonction?.trim())    manquants.push('fonction')
      if (!sectionPaie?.trim()) manquants.push('section de paie')
      if (!service?.trim())     manquants.push('service')
      if (!departement?.trim()) manquants.push('département')
      if (manquants.length) {
        throw new BadRequestException(`Données obligatoires manquantes pour « ${categorie.libelle} » : ${manquants.join(', ')}`)
      }
    }

    // Sous-traitant : société sous-traitante obligatoire
    if (code === 'SOUS_TRAITANT') {
      if (!societeId) throw new BadRequestException('La société sous-traitante est obligatoire')
      const societe = await this.prisma.societeSousTraitante.findFirst({ where: { id: societeId, statut: 'ACTIVE' }, select: { id: true } })
      if (!societe) throw new BadRequestException('Société sous-traitante introuvable ou inactive')
    }

    // ── Registre des employés SARIS : reconnaissance / enregistrement dynamique par matricule ──
    let patientEmployeId: string | null = null   // le patient EST un employé (CDI/CDD)
    let rattEmployeId:    string | null = null   // ayant droit : l'employé CDI rattaché
    if (isCdiCdd) {
      // Le patient est un employé : reconnu par matricule, ou enregistré au registre à la volée.
      const emp = await this.employes.ensureByMatricule({
        matricule: matricule!.trim(), nom, prenom, dateNaissance, sexe,
        fonction: fonction!.trim(), sectionPaie: sectionPaie!.trim(), service: service!.trim(), departement: departement!.trim(),
        categorie: code,
      })
      patientEmployeId = emp.id
    }
    if (code === 'AYANT_DROIT_CDI') {
      if (!fonction?.trim())     throw new BadRequestException('La fonction est obligatoire pour un ayant droit')
      if (!cdiMatricule?.trim()) throw new BadRequestException('Le matricule du CDI rattaché est obligatoire')
      if (!typeLien)             throw new BadRequestException('Le lien de parenté est obligatoire')
      const existing = await this.employes.findByMatricule(cdiMatricule.trim())
      if (existing) {
        rattEmployeId = existing.id   // CDI reconnu au registre
      } else {
        // CDI inconnu → on l'enregistre à la volée avec l'identité fournie.
        if (!nouvelEmploye?.nom?.trim() || !nouvelEmploye?.prenom?.trim()) {
          throw new BadRequestException(`Matricule CDI « ${cdiMatricule.trim()} » inconnu — renseignez l'identité du travailleur CDI rattaché`)
        }
        const emp = await this.employes.create({
          matricule:     cdiMatricule.trim(),
          nom:           nouvelEmploye.nom,
          prenom:        nouvelEmploye.prenom,
          dateNaissance: nouvelEmploye.dateNaissance,
          sexe:          nouvelEmploye.sexe,
          fonction:      nouvelEmploye.fonction,
          sectionPaie:   nouvelEmploye.sectionPaie,
          service:       nouvelEmploye.service,
          departement:   nouvelEmploye.departement,
          categorie:     'ASSURE_CDI',
        })
        rattEmployeId = emp.id
      }
    }

    const numeroPatient = await this.generateNumeroPatient(siteCreationId)

    // Matricule employeur : propre au CDI/CDD uniquement (l'ayant droit utilise celui du CDI).
    const matriculePropre = isCdiCdd ? (matricule?.trim() || null) : null
    if (matriculePropre) {
      const exists = await this.prisma.patient.findUnique({ where: { matricule: matriculePropre }, select: { id: true } })
      if (exists) throw new ConflictException(`Le matricule ${matriculePropre} est déjà attribué à un patient`)
    }

    // donneesEmploi : 4 champs pour CDI/CDD, fonction seule pour l'ayant droit (le reste vient du CDI).
    const donneesEmploiData =
        isCdiCdd                   ? { fonction: fonction!.trim(), sectionPaie: sectionPaie!.trim(), service: service!.trim(), departement: departement!.trim() }
      : code === 'AYANT_DROIT_CDI' ? { fonction: fonction!.trim(), sectionPaie: null, service: null, departement: null }
      : null

    const dossier = await this.prisma.$transaction(async tx => {
      const p = await tx.patient.create({
        data: {
          numeroPatient,
          matricule: matriculePropre,
          employeId: patientEmployeId,
          siteCreationId,
          categoriePatientId,
          createdBy: createdBy ?? null,
          identite: {
            create: {
              nom, prenom,
              dateNaissance: new Date(dateNaissance),
              sexe,
              telephone: telephone ?? null,
              adresse:   adresse   ?? null,
            },
          },
          ...(contactUrgence ? { contactUrgence: { create: contactUrgence } } : {}),
          ...(donneesEmploiData ? { donneesEmploi: { create: donneesEmploiData } } : {}),
        },
      })

      // Rattachement ayant droit → employé CDI du registre (recueil §5)
      if (rattEmployeId) {
        const ratt = await tx.rattachementAyantDroitCdi.create({
          data: { patientId: p.id, employeId: rattEmployeId, typeLien: typeLien!, dateDebut: new Date() },
        })
        await tx.historiqueRattachementAyantDroit.create({ data: { rattachementId: ratt.id, evenement: 'CREATION' } })
      }
      if (code === 'SOUS_TRAITANT' && societeId) {
        const ratt = await tx.rattachementSousTraitant.create({
          data: { patientId: p.id, societeId, dateDebut: new Date() },
        })
        await tx.historiqueRattachementSousTraitant.create({ data: { rattachementId: ratt.id, evenement: 'CREATION' } })
      }

      return tx.patient.findUniqueOrThrow({ where: { id: p.id }, include: DOSSIER_INCLUDE })
    })

    await this.notif.emit({
      type:               'PATIENT_CREE',
      niveau:             'INFO',
      category:           'clinique',
      titre:              'Nouveau patient enregistré',
      message:            `${prenom} ${nom} · ${numeroPatient}`,
      siteId:             siteCreationId,
      requiredPermission: 'patient.read',
      entiteType:         'patient',
      entiteId:           dossier.id,
      lien:               `/patients/${dossier.id}`,
      createdById:        createdBy ?? null,
    })

    return dossier
  }

  // ── Mise à jour identité ──────────────────────────────────────────────────

  async updateIdentite(id: string, dto: UpdateIdentiteDto) {
    await this.assertPatientExists(id)
    const { contactUrgence, dateNaissance, matricule,
            fonction, sectionPaie, service, departement, ...identiteFields } = dto

    // Matricule employeur (unicité)
    if (matricule !== undefined) {
      if (matricule) {
        const exists = await this.prisma.patient.findFirst({ where: { matricule, id: { not: id } }, select: { id: true } })
        if (exists) throw new ConflictException(`Le matricule ${matricule} est déjà attribué à un patient`)
      }
      await this.prisma.patient.update({ where: { id }, data: { matricule: matricule || null } })
    }

    // Données professionnelles (CDI/CDD)
    if (fonction !== undefined || sectionPaie !== undefined || service !== undefined || departement !== undefined) {
      await this.prisma.donneesEmploi.upsert({
        where:  { patientId: id },
        update: {
          ...(fonction    !== undefined && { fonction:    fonction    || null }),
          ...(sectionPaie !== undefined && { sectionPaie: sectionPaie || null }),
          ...(service     !== undefined && { service:     service     || null }),
          ...(departement !== undefined && { departement: departement || null }),
        },
        create: {
          patientId:   id,
          fonction:    fonction    ?? null,
          sectionPaie: sectionPaie ?? null,
          service:     service     ?? null,
          departement: departement ?? null,
        },
      })
    }

    // Mise à jour identité civile
    if (Object.keys(identiteFields).length > 0 || dateNaissance) {
      await this.prisma.identitePatient.upsert({
        where:  { patientId: id },
        update: {
          ...identiteFields,
          ...(dateNaissance && { dateNaissance: new Date(dateNaissance) }),
        },
        create: {
          patientId: id,
          nom:           identiteFields.nom     ?? '',
          prenom:        identiteFields.prenom  ?? '',
          dateNaissance: dateNaissance ? new Date(dateNaissance) : new Date(),
          sexe:          identiteFields.sexe    ?? 'M',
          telephone:     identiteFields.telephone ?? null,
          adresse:       identiteFields.adresse   ?? null,
        },
      })
    }

    // Mise à jour contact urgence
    if (contactUrgence) {
      await this.prisma.contactUrgence.upsert({
        where:  { patientId: id },
        update: contactUrgence,
        create: { patientId: id, nom: '', prenom: '', telephone: '', lien: '', ...contactUrgence },
      })
    }

    return this.findById(id)
  }

  // ── Mode de vie (recueil) ──────────────────────────────────────────────────

  async upsertModeVie(id: string, dto: UpsertModeVieDto) {
    await this.assertPatientExists(id)
    const data = {
      tabac:            dto.tabac            ?? null,
      alcool:           dto.alcool           ?? null,
      drogues:          dto.drogues          ?? null,
      activitePhysique: dto.activitePhysique ?? null,
      alimentation:     dto.alimentation     ?? null,
      sommeil:          dto.sommeil          ?? null,
      troublesSommeil:  dto.troublesSommeil  ?? null,
      sedentarite:      dto.sedentarite      ?? null,
      portCharges:      dto.portCharges      ?? null,
      observations:     dto.observations     ?? null,
    }
    await this.prisma.modeViePatient.upsert({
      where:  { patientId: id },
      update: data,
      create: { patientId: id, ...data },
    })
    return this.findById(id)
  }

  // ── Changement de catégorie ───────────────────────────────────────────────

  async changerCategorie(id: string, dto: ChangerCategorieDto, userId?: string) {
    await this.assertPatientExists(id)
    return this.prisma.$transaction(async (tx) => {
      const patient = await tx.patient.findUniqueOrThrow({ where: { id } })
      await tx.historiqueCategoriePatient.create({
        data: {
          patientId:       id,
          ancienneCategId: patient.categoriePatientId,
          nouvelleCategId: dto.nouvelleCategId,
          dateEffet:       new Date(),
          motif:           dto.motif,
          createdBy:       userId ?? null,
        },
      })
      return tx.patient.update({
        where:   { id },
        data:    { categoriePatientId: dto.nouvelleCategId },
        include: { categoriePatient: CATEGORIE_SELECT, siteCreation: SITE_SELECT, identite: true },
      })
    })
  }

  // ── Statut patient ────────────────────────────────────────────────────────

  async updateStatut(id: string, dto: ToggleStatutPatientDto) {
    await this.assertPatientExists(id)
    return this.prisma.patient.update({ where: { id }, data: { statut: dto.statut as any } })
  }

  // ── Allergies ─────────────────────────────────────────────────────────────

  async createAllergie(patientId: string, dto: CreateAllergieDto) {
    await this.assertPatientExists(patientId)
    return this.prisma.allergiePatient.create({
      data: { patientId, ...dto },
    })
  }

  async updateAllergie(patientId: string, allergieId: string, dto: UpdateAllergieDto) {
    const allergie = await this.prisma.allergiePatient.findFirst({ where: { id: allergieId, patientId } })
    if (!allergie) throw new NotFoundException('Allergie introuvable')
    return this.prisma.allergiePatient.update({ where: { id: allergieId }, data: dto })
  }

  // ── Antécédents ───────────────────────────────────────────────────────────

  async createAntecedent(patientId: string, dto: CreateAntecedentDto) {
    await this.assertPatientExists(patientId)
    return this.prisma.antecedentPatient.create({
      data: { patientId, ...dto },
    })
  }

  async updateAntecedent(patientId: string, antecedentId: string, dto: UpdateAntecedentDto) {
    const ant = await this.prisma.antecedentPatient.findFirst({ where: { id: antecedentId, patientId } })
    if (!ant) throw new NotFoundException('Antécédent introuvable')
    return this.prisma.antecedentPatient.update({ where: { id: antecedentId }, data: dto })
  }

  // ── Alertes médicales ─────────────────────────────────────────────────────

  async createAlerte(patientId: string, dto: CreateAlerteMedicaleDto) {
    await this.assertPatientExists(patientId)
    return this.prisma.alerteMedicale.create({
      data: { patientId, ...dto },
    })
  }

  async updateAlerte(patientId: string, alerteId: string, dto: UpdateAlerteMedicaleDto) {
    const alerte = await this.prisma.alerteMedicale.findFirst({ where: { id: alerteId, patientId } })
    if (!alerte) throw new NotFoundException('Alerte introuvable')
    return this.prisma.alerteMedicale.update({
      where: { id: alerteId },
      data: {
        ...dto,
        ...(dto.statut === 'INACTIVE' && { resolvedAt: new Date() }),
        ...(dto.statut === 'ACTIVE'   && { resolvedAt: null }),
      },
    })
  }

  // ── Rattachements Ayant Droit CDI ─────────────────────────────────────────

  async createRattachementAD(patientId: string, dto: CreateRattachementADDto) {
    await this.assertPatientExists(patientId)
    const { dateDebut, dateFin, ...rest } = dto
    const ratt = await this.prisma.rattachementAyantDroitCdi.create({
      data: {
        patientId,
        ...rest,
        dateDebut: new Date(dateDebut),
        dateFin:   dateFin ? new Date(dateFin) : null,
      },
    })
    await this.prisma.historiqueRattachementAyantDroit.create({
      data: { rattachementId: ratt.id, evenement: 'CREATION' },
    })
    return ratt
  }

  async updateRattachementAD(patientId: string, rattId: string, dto: UpdateRattachementADDto) {
    const ratt = await this.prisma.rattachementAyantDroitCdi.findFirst({ where: { id: rattId, patientId } })
    if (!ratt) throw new NotFoundException('Rattachement ayant droit introuvable')
    const { dateDebut, dateFin, ...rest } = dto
    const updated = await this.prisma.rattachementAyantDroitCdi.update({
      where: { id: rattId },
      data: {
        ...rest,
        ...(dateDebut && { dateDebut: new Date(dateDebut) }),
        ...(dateFin !== undefined && { dateFin: dateFin ? new Date(dateFin) : null }),
      },
    })
    await this.prisma.historiqueRattachementAyantDroit.create({
      data: { rattachementId: rattId, evenement: dto.statut === 'INACTIF' ? 'CLOTURE' : 'MODIFICATION' },
    })
    return updated
  }

  // ── Rattachements Sous-Traitant ───────────────────────────────────────────

  async createRattachementST(patientId: string, dto: CreateRattachementSTDto) {
    await this.assertPatientExists(patientId)
    // Vérifier que la société est active
    const societe = await this.prisma.societeSousTraitante.findFirst({
      where: { id: dto.societeId, statut: 'ACTIVE' },
    })
    if (!societe) throw new ConflictException('Société introuvable ou inactive')

    const { dateDebut, dateFin, ...rest } = dto
    const ratt = await this.prisma.rattachementSousTraitant.create({
      data: {
        patientId,
        ...rest,
        dateDebut: new Date(dateDebut),
        dateFin:   dateFin ? new Date(dateFin) : null,
      },
    })
    await this.prisma.historiqueRattachementSousTraitant.create({
      data: { rattachementId: ratt.id, evenement: 'CREATION' },
    })
    return ratt
  }

  async updateRattachementST(patientId: string, rattId: string, dto: UpdateRattachementSTDto) {
    const ratt = await this.prisma.rattachementSousTraitant.findFirst({ where: { id: rattId, patientId } })
    if (!ratt) throw new NotFoundException('Rattachement sous-traitant introuvable')
    const { dateDebut, dateFin, ...rest } = dto
    const updated = await this.prisma.rattachementSousTraitant.update({
      where: { id: rattId },
      data: {
        ...rest,
        ...(dateDebut && { dateDebut: new Date(dateDebut) }),
        ...(dateFin !== undefined && { dateFin: dateFin ? new Date(dateFin) : null }),
      },
    })
    await this.prisma.historiqueRattachementSousTraitant.create({
      data: { rattachementId: rattId, evenement: dto.statut === 'INACTIF' ? 'CLOTURE' : 'MODIFICATION' },
    })
    return updated
  }

  // ── Suppression des sous-entités du dossier (perm patient.update) ──────────

  async deleteAllergie(patientId: string, allergieId: string) {
    const a = await this.prisma.allergiePatient.findFirst({ where: { id: allergieId, patientId } })
    if (!a) throw new NotFoundException('Allergie introuvable')
    await this.prisma.allergiePatient.delete({ where: { id: allergieId } })
    return { id: allergieId, deleted: true }
  }

  async deleteAntecedent(patientId: string, antecedentId: string) {
    const a = await this.prisma.antecedentPatient.findFirst({ where: { id: antecedentId, patientId } })
    if (!a) throw new NotFoundException('Antécédent introuvable')
    await this.prisma.antecedentPatient.delete({ where: { id: antecedentId } })
    return { id: antecedentId, deleted: true }
  }

  async deleteAlerte(patientId: string, alerteId: string) {
    const a = await this.prisma.alerteMedicale.findFirst({ where: { id: alerteId, patientId } })
    if (!a) throw new NotFoundException('Alerte introuvable')
    await this.prisma.alerteMedicale.delete({ where: { id: alerteId } })
    return { id: alerteId, deleted: true }
  }

  async deleteRattachementAD(patientId: string, rattId: string) {
    const r = await this.prisma.rattachementAyantDroitCdi.findFirst({ where: { id: rattId, patientId } })
    if (!r) throw new NotFoundException('Rattachement ayant droit introuvable')
    await this.prisma.$transaction([
      this.prisma.historiqueRattachementAyantDroit.deleteMany({ where: { rattachementId: rattId } }),
      this.prisma.rattachementAyantDroitCdi.delete({ where: { id: rattId } }),
    ])
    return { id: rattId, deleted: true }
  }

  async deleteRattachementST(patientId: string, rattId: string) {
    const r = await this.prisma.rattachementSousTraitant.findFirst({ where: { id: rattId, patientId } })
    if (!r) throw new NotFoundException('Rattachement sous-traitant introuvable')
    await this.prisma.$transaction([
      this.prisma.historiqueRattachementSousTraitant.deleteMany({ where: { rattachementId: rattId } }),
      this.prisma.rattachementSousTraitant.delete({ where: { id: rattId } }),
    ])
    return { id: rattId, deleted: true }
  }

  // ── Suppression définitive du dossier (perm patient.delete) ────────────────
  // Bloquée si le patient a un historique clinique (visites) : on archive alors.

  async deletePatient(id: string) {
    await this.assertPatientExists(id)
    // Le count via le client filtré masquerait les visites soft-supprimées (tombstones) :
    // on bloque dès qu'un historique clinique a JAMAIS existé → client BRUT non filtré.
    const nbVisites = await this.prisma.raw.visite.count({ where: { patientId: id } })
    if (nbVisites > 0) {
      throw new ConflictException(
        'Ce dossier possède un historique clinique (visites/consultations) : il ne peut être supprimé. Archivez-le plutôt.',
      )
    }
    // Le soft-delete global ne lève plus de violation FK : on protège explicitement les
    // références vivantes (count filtré = on ne bloque que sur des références non archivées).
    const nbPreSaisies = await this.prisma.preSaisieMedicale.count({ where: { patientId: id } })
    const nbSuivisGrossesse = await this.prisma.suiviGrossesse.count({ where: { patientId: id } })
    if (nbPreSaisies > 0 || nbSuivisGrossesse > 0) {
      throw new ConflictException(
        'Ce dossier est référencé par un suivi de grossesse ou une pré-saisie médicale : suppression impossible. Archivez-le plutôt.',
      )
    }
    // Purge des données administratives rattachées puis du dossier.
    const adIds = (await this.prisma.rattachementAyantDroitCdi.findMany({ where: { patientId: id }, select: { id: true } })).map(r => r.id)
    const stIds = (await this.prisma.rattachementSousTraitant.findMany({ where: { patientId: id }, select: { id: true } })).map(r => r.id)
    try {
      await this.prisma.$transaction([
        this.prisma.historiqueRattachementAyantDroit.deleteMany({ where: { rattachementId: { in: adIds } } }),
        this.prisma.historiqueRattachementSousTraitant.deleteMany({ where: { rattachementId: { in: stIds } } }),
        this.prisma.rattachementAyantDroitCdi.deleteMany({ where: { patientId: id } }),
        this.prisma.rattachementSousTraitant.deleteMany({ where: { patientId: id } }),
        this.prisma.allergiePatient.deleteMany({ where: { patientId: id } }),
        this.prisma.antecedentPatient.deleteMany({ where: { patientId: id } }),
        this.prisma.alerteMedicale.deleteMany({ where: { patientId: id } }),
        this.prisma.historiqueCategoriePatient.deleteMany({ where: { patientId: id } }),
        this.prisma.contactUrgence.deleteMany({ where: { patientId: id } }),
        this.prisma.identitePatient.deleteMany({ where: { patientId: id } }),
        this.prisma.patient.delete({ where: { id } }),
      ])
    } catch (e: any) {
      if (e?.code === 'P2003' || e?.code === 'P2014') {
        throw new ConflictException(
          'Ce dossier est référencé par d\'autres données : suppression impossible. Archivez-le plutôt.',
        )
      }
      throw e
    }
    return { id, deleted: true }
  }
}
