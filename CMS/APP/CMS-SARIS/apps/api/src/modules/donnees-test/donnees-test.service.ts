/**
 * DonneesTestService — fabriquer plusieurs mois d'activité fictive du centre, en arrière-plan, et
 * la retirer.
 *
 * C'est le MÊME système et la MÊME base que la production : le mode Test ne sépare rien, il
 * l'annonce. Les lignes fabriquées sont donc reconnaissables à leur identifiant (cf. marque-test.ts)
 * et rien d'autre n'est touché — ni utilisateurs, ni référentiels, ni messagerie, ni paramètres.
 *
 * Une génération se découpe en JOURNÉES d'ouverture ; chacune entre en base d'un seul bloc. Une
 * génération interrompue (redémarrage du serveur, arrêt demandé, panne) laisse donc des journées
 * entières et cohérentes, et se REPREND là où elle s'est arrêtée.
 *
 * Réservé au serveur central (les postes reçoivent leurs données par la synchronisation) et au mode
 * Test : repasser en production arrête une génération en cours.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../prisma/prisma.service'
import { ModeSystemeService } from '../systeme/mode-systeme.service'
import { creerAlea } from './alea'
import { ipsDuSite } from './catalogue-reseau'
import { estOuvert, jourLocalDe, joursEntre, type Moment } from './calendrier'
import { nouvelleMorphologie } from './constantes-vitales'
import type {
  ContexteJour,
  EquipeSite,
  ReferentielsTest,
  Soignant,
} from './contexte'
import {
  cleNom,
  FabriqueIdentites,
  Numerotation,
  type Sexe,
} from './fabrique-identites'
import { compterMarquees, ecrireLignes, supprimerMarquees } from './ecriture'
import { FILTRE_MARQUE } from './marque-test'
import { planifierJour, profilsDisponibles } from './planificateur'
import { nombreFr } from '../../common/nombre'
import { cleMedicament } from './planificateur-documents'
import { Population, type PatientSim } from './population'
import {
  calculerPrevisions,
  periodeJusquaMaintenant,
  type EquipeEffectifs,
  type Previsions,
} from './previsions'
import { MODELES_TEST, cumuler } from './registre'

/** Ligne RÉSERVÉE de `ParametreSysteme` : l'état des générations (jamais listée dans les paramètres). */
export const CLE_ETAT_DONNEES_TEST = 'systeme.donnees_test'

/** On garde les derniers lots, pas toute l'histoire. */
const LOTS_CONSERVES = 5

export type StatutLot =
  | 'EN_COURS'
  | 'TERMINE'
  | 'INTERROMPU'
  | 'ANNULE'
  | 'ECHEC'

export interface ParametresLot {
  mois: number
  visitesParJour: number
  graine: string
  /** Premier et dernier jour de la période (« AAAA-MM-JJ »). */
  debut: string
  fin: string
  /**
   * « Maintenant » au lancement, quand le dernier jour est AUJOURD'HUI : ce jour-là n'est fabriqué que
   * jusqu'à deux heures avant, et rien n'est daté après. Fixé au lancement : une reprise le lendemain
   * refait la même journée. Absent des générations qui s'arrêtent à hier.
   */
  limite?: Moment | null
}

export interface ProgressionLot {
  /** Jours d'OUVERTURE à fabriquer, et déjà fabriqués. */
  joursTotal: number
  joursFaits: number
  jourCourant: string | null
  visites: number
  patients: number
  consultations: number
  visitesAnnulees: number
  consultationsAnnulees: number
  nonRecus: number
  /** Lignes écrites, par table. */
  lignes: Record<string, number>
}

/** Ce qui a été fabriqué, en une page : établi à la fin d'une génération menée à son terme. */
export interface BilanLot {
  /** Place prise dans la base par cette génération (octets) ; null si la base ne la mesure pas. */
  tailleOctets: number | null
  sites: { code: string; visites: number; patients: number }[]
  categories: { code: string; patients: number }[]
  connexions: {
    reussies: number
    echecs: number
    deconnexions: number
    questions: number
    appareils: number
  }
  documents: {
    ordonnances: number
    bonsExamen: number
    bonsPharmacie: number
    resultats: number
    evacuations: number
    suivisTraitement: number
    suivisChroniques: number
  }
}

export interface Lot {
  id: string
  creePar: string
  creeLe: string
  statut: StatutLot
  parametres: ParametresLot
  progression: ProgressionLot
  message: string | null
  termineLe: string | null
  derniereMaj: string
  bilan?: BilanLot | null
}

interface EtatPersiste {
  lots: Lot[]
}

/** Arrêt volontaire d'une génération (mode quitté, base trop pleine) — pas une panne. */
class ArretGeneration extends Error {}

export interface EtatDonneesTest {
  mode: 'PRODUCTION' | 'TEST'
  /** Peut-on générer / supprimer maintenant ? Sinon, pourquoi pas. */
  disponible: boolean
  raison: string | null
  lot: Lot | null
  enCours: boolean
  /** Lignes marquées, par table (libellé inclus). */
  existantes: {
    total: number
    tables: { modele: string; libelle: string; n: number }[]
  }
  base: { tailleMo: number | null; limiteMo: number }
  equipe: { sites: number; medecins: number; infirmiers: number }
}

/** Qui fait quoi dans le centre, d'après ses fonctions. */
export function classerSoignant(
  roles: readonly string[],
  fonction: string,
): 'MEDECIN' | 'INFIRMIER' | null {
  if (roles.includes('MEDECIN_CHEF') || fonction === 'MEDECIN') return 'MEDECIN'
  if (
    roles.includes('INFIRMIER') &&
    (fonction === 'INFIRMIER' || fonction === 'SAGE_FEMME')
  )
    return 'INFIRMIER'
  return null
}

@Injectable()
export class DonneesTestService implements OnApplicationBootstrap {
  private readonly logger = new Logger('DonneesTest')
  /** Génération en cours dans CE processus. */
  private execution: Promise<void> | null = null
  private arretDemande = false
  /** Sérialise les écritures de l'état persistant. */
  private chaine: Promise<unknown> = Promise.resolve()
  private tailleMemorisee: { valeur: number | null; jusqua: number } | null =
    null

  constructor(
    private readonly prisma: PrismaService,
    private readonly mode: ModeSystemeService,
  ) {}

  private get local(): boolean {
    return process.env['DATABASE_PROVIDER'] === 'sqlite'
  }

  /** Une génération tourne-t-elle dans ce processus ? Le vidage des données ne doit pas la croiser. */
  get generationEnCours(): boolean {
    return this.execution !== null
  }

  private limiteOctets(): number {
    const mo = Number(process.env['DONNEES_TEST_TAILLE_MAX_MO'])
    return (Number.isFinite(mo) && mo > 0 ? mo : 350) * 1024 * 1024
  }

  /** Un lot « en cours » trouvé au démarrage ne peut être que le reste d'un processus arrêté. */
  async onApplicationBootstrap(): Promise<void> {
    if (this.local) return
    try {
      await this.modifierEtat((e) => {
        for (const l of e.lots)
          if (l.statut === 'EN_COURS') {
            l.statut = 'INTERROMPU'
            l.message =
              'Le serveur a redémarré pendant la génération : elle peut être reprise.'
            l.derniereMaj = new Date().toISOString()
          }
      })
    } catch (e) {
      this.logger.warn(
        `État des données de test non relu au démarrage : ${(e as Error).message}`,
      )
    }
  }

  // ── État persistant ─────────────────────────────────────────────────────────

  /** `audit.retention_jours` (365 par défaut) ; null si la purge automatique n'a pas lieu ici (poste). */
  private async dureeConservationJournaux(): Promise<number | null> {
    if (this.local) return null
    const ligne = await this.prisma.parametreSysteme.findUnique({
      where: { cle: 'audit.retention_jours' },
    })
    const jours = ligne ? Number(ligne.valeur) : 365
    return Number.isFinite(jours) && jours >= 1 ? jours : null
  }

  private async lireEtat(): Promise<EtatPersiste> {
    const ligne = await this.prisma.parametreSysteme.findUnique({
      where: { cle: CLE_ETAT_DONNEES_TEST },
    })
    if (!ligne) return { lots: [] }
    try {
      const e = JSON.parse(ligne.valeur) as EtatPersiste
      return Array.isArray(e.lots) ? e : { lots: [] }
    } catch {
      return { lots: [] }
    }
  }

  private async modifierEtat<T>(
    fn: (e: EtatPersiste) => T | Promise<T>,
  ): Promise<T> {
    const suite = this.chaine.then(async () => {
      const etat = await this.lireEtat()
      const r = await fn(etat)
      etat.lots = etat.lots.slice(-LOTS_CONSERVES)
      await this.prisma.parametreSysteme.upsert({
        where: { cle: CLE_ETAT_DONNEES_TEST },
        update: { valeur: JSON.stringify(etat) },
        create: {
          cle: CLE_ETAT_DONNEES_TEST,
          valeur: JSON.stringify(etat),
          description: 'État de la génération de données de test',
        },
      })
      return r
    })
    this.chaine = suite.catch(() => undefined)
    return suite
  }

  // ── Garde-fous ──────────────────────────────────────────────────────────────

  /** Le générateur ne travaille que sur le serveur central, en mode Test. */
  private async exigerModeTest(): Promise<void> {
    if (this.local)
      throw new ConflictException({
        code: 'MODE_CENTRAL',
        message:
          'Les données de test se gèrent depuis le serveur central (version web), pas depuis un poste.',
      })
    const etat = await this.mode.lire()
    if (etat.mode !== 'TEST')
      throw new ConflictException({
        code: 'MODE_PRODUCTION',
        message: 'Les données de test ne se gèrent qu’en mode Test.',
      })
  }

  /**
   * Octets occupés par la base. La mesure parcourt les fichiers de la base (quelques centaines de
   * millisecondes) alors que la page relit l'état toutes les 1,5 s pendant une génération : on la
   * garde 10 secondes.
   */
  private async tailleBase(): Promise<number | null> {
    if (this.local) return null
    const maintenant = Date.now()
    if (this.tailleMemorisee && this.tailleMemorisee.jusqua > maintenant)
      return this.tailleMemorisee.valeur
    let valeur: number | null = null
    try {
      const r = await this.prisma.$queryRaw<
        { taille: bigint }[]
      >`SELECT pg_database_size(current_database()) AS taille`
      valeur = Number(r[0]?.taille ?? 0)
    } catch {
      valeur = null
    }
    this.tailleMemorisee = { valeur, jusqua: maintenant + 10_000 }
    return valeur
  }

  // ── Lecture ─────────────────────────────────────────────────────────────────

  async etat(): Promise<EtatDonneesTest> {
    const mode = await this.mode.lire()
    const equipes = await this.chargerEquipes()
    const etat = await this.lireEtat()
    const lot = etat.lots[etat.lots.length - 1] ?? null
    const marquees = await compterMarquees(this.prisma)
    const libelles = new Map(MODELES_TEST.map((m) => [m.modele, m.libelle]))
    const tables = Object.entries(marquees).map(([modele, n]) => ({
      modele,
      libelle: libelles.get(modele) ?? modele,
      n,
    }))
    const taille = await this.tailleBase()
    let raison: string | null = null
    if (this.local)
      raison = 'Les données de test se gèrent depuis le serveur central.'
    else if (mode.mode !== 'TEST')
      raison = 'Disponible uniquement en mode Test.'
    return {
      mode: mode.mode,
      disponible: raison === null,
      raison,
      lot,
      enCours: this.execution !== null && lot?.statut === 'EN_COURS',
      existantes: { total: tables.reduce((s, t) => s + t.n, 0), tables },
      base: {
        tailleMo: taille === null ? null : Math.round(taille / 1048576),
        limiteMo: Math.round(this.limiteOctets() / 1048576),
      },
      equipe: {
        sites: equipes.length,
        medecins: equipes.reduce((s, e) => s + e.medecins.length, 0),
        infirmiers: equipes.reduce((s, e) => s + e.infirmiers.length, 0),
      },
    }
  }

  /**
   * L'heure du serveur. Un point d'entrée À PART pour que les tests rejouent « il est 14 h un lundi » :
   * la période d'une génération en dépend (aujourd'hui y est inclus, ou pas, selon l'heure).
   */
  maintenant(): Date {
    return new Date()
  }

  async previsions(
    mois: number,
    visitesParJour: number,
  ): Promise<Previsions & { baseMo: number | null; limiteMo: number }> {
    const equipes = await this.chargerEquipes()
    const { debut, fin, limite: coupure } = periodeJusquaMaintenant(this.maintenant(), mois)
    const p = calculerPrevisions({
      debut,
      fin,
      visitesParJour,
      equipes: effectifs(equipes),
      limite: coupure,
    })
    const taille = await this.tailleBase()
    const limite = this.limiteOctets()
    if (taille !== null && taille + p.octets > limite)
      p.avertissements.push(
        `La base occupe déjà ${nombreFr(taille / 1048576)} Mo : ajouter ~${nombreFr(p.octets / 1048576)} Mo dépasserait la limite de ${nombreFr(limite / 1048576)} Mo. Réduisez la durée ou le nombre de visites.`,
      )
    // La purge de la nuit supprime les journaux plus vieux que leur durée de conservation : elle
    // effacerait, sans distinction, ce que cette génération fabrique de plus ancien.
    const conservation = await this.dureeConservationJournaux()
    const age = joursEntre(debut, jourLocalDe(this.maintenant())).length
    if (conservation !== null && age > conservation)
      p.avertissements.push(
        `Les journaux d'audit sont conservés ${nombreFr(conservation)} jours (Paramètres système) : la purge automatique de la nuit supprimera les lignes d'audit et de connexions de plus de ${nombreFr(conservation)} jours fabriquées ici, soit les ${nombreFr(age - conservation)} premiers jours de la période. Allongez la durée de conservation ou réduisez la durée.`,
      )
    return {
      ...p,
      baseMo: taille === null ? null : Math.round(taille / 1048576),
      limiteMo: Math.round(limite / 1048576),
    }
  }

  // ── Démarrer, reprendre, arrêter ───────────────────────────────────────────

  async demarrer(
    params: { mois: number; visitesParJour: number; graine?: string },
    auteurId: string,
    ip: string | null,
  ): Promise<Lot> {
    await this.exigerModeTest()
    if (this.execution) throw this.dejaEnCours()
    const marquees = await compterMarquees(this.prisma)
    const existant = Object.values(marquees).reduce((s, n) => s + n, 0)
    if (existant > 0)
      throw new ConflictException({
        code: 'DONNEES_EXISTANTES',
        message:
          'Des données de test existent déjà. Supprimez-les d’abord, ou reprenez la génération interrompue.',
      })
    const equipes = await this.chargerEquipes()
    this.exigerEquipe(equipes)
    await this.exigerReferentiels()

    const { debut, fin, limite } = periodeJusquaMaintenant(this.maintenant(), params.mois)
    const prev = calculerPrevisions({
      debut,
      fin,
      visitesParJour: params.visitesParJour,
      equipes: effectifs(equipes),
      limite,
    })
    const taille = await this.tailleBase()
    if (taille !== null && taille + prev.octets > this.limiteOctets())
      throw new ConflictException({
        code: 'TAILLE_TROP_GRANDE',
        message: `La base occupe déjà ${nombreFr(taille / 1048576)} Mo : ajouter environ ${nombreFr(prev.octets / 1048576)} Mo dépasserait la limite de ${nombreFr(this.limiteOctets() / 1048576)} Mo. Réduisez la durée ou le nombre de visites.`,
      })

    const lot: Lot = {
      id: randomUUID(),
      creePar: auteurId,
      creeLe: new Date().toISOString(),
      statut: 'EN_COURS',
      parametres: {
        mois: params.mois,
        visitesParJour: params.visitesParJour,
        graine: params.graine?.trim() || `${Date.now()}`,
        debut,
        fin,
        ...(limite ? { limite } : {}),
      },
      progression: {
        joursTotal: joursEntre(debut, fin).filter(estOuvert).length,
        joursFaits: 0,
        jourCourant: null,
        visites: 0,
        patients: 0,
        consultations: 0,
        visitesAnnulees: 0,
        consultationsAnnulees: 0,
        nonRecus: 0,
        lignes: {},
      },
      message: null,
      termineLe: null,
      derniereMaj: new Date().toISOString(),
      bilan: null,
    }
    await this.modifierEtat((e) => {
      e.lots.push(lot)
    })
    await this.tracer('DONNEES_TEST_DEMARRAGE', auteurId, ip, null, {
      lot: lot.id,
      ...lot.parametres,
      joursOuverts: lot.progression.joursTotal,
    })
    this.lancer(lot.id)
    return lot
  }

  /** Reprend la dernière génération interrompue, arrêtée ou tombée en panne. */
  async reprendre(auteurId: string, ip: string | null): Promise<Lot> {
    await this.exigerModeTest()
    if (this.execution) throw this.dejaEnCours()
    const etat = await this.lireEtat()
    const lot = etat.lots[etat.lots.length - 1]
    if (!lot || lot.statut === 'EN_COURS' || lot.statut === 'TERMINE')
      throw new ConflictException({
        code: 'RIEN_A_REPRENDRE',
        message: 'Aucune génération interrompue à reprendre.',
      })
    this.exigerEquipe(await this.chargerEquipes())
    await this.exigerReferentiels()
    await this.modifierEtat((e) => {
      const l = e.lots.find((x) => x.id === lot.id)
      if (!l) return
      l.statut = 'EN_COURS'
      l.message = null
      l.derniereMaj = new Date().toISOString()
    })
    await this.tracer('DONNEES_TEST_REPRISE', auteurId, ip, null, {
      lot: lot.id,
      joursFaits: lot.progression.joursFaits,
      joursTotal: lot.progression.joursTotal,
    })
    this.lancer(lot.id)
    return { ...lot, statut: 'EN_COURS', message: null }
  }

  /** Demande l'arrêt : la journée en cours se termine, puis plus rien ne s'écrit. */
  async arreter(auteurId: string, ip: string | null): Promise<Lot> {
    const etat = await this.lireEtat()
    const lot = etat.lots[etat.lots.length - 1]
    if (!lot || lot.statut !== 'EN_COURS' || !this.execution)
      throw new ConflictException({
        code: 'AUCUNE_GENERATION',
        message: 'Aucune génération en cours.',
      })
    this.arretDemande = true
    await this.tracer('DONNEES_TEST_ARRET', auteurId, ip, null, {
      lot: lot.id,
      joursFaits: lot.progression.joursFaits,
    })
    return lot
  }

  /**
   * Supprime TOUTES les données de test : ce qui porte la marque, et ce qui en dépend. Refusé
   * pendant une génération.
   */
  async supprimer(
    auteurId: string,
    ip: string | null,
  ): Promise<{ lignes: number; tables: Record<string, number> }> {
    await this.exigerModeTest()
    if (this.execution) throw this.dejaEnCours()
    const tables = await supprimerMarquees(this.prisma)
    const lignes = Object.values(tables).reduce((s, n) => s + n, 0)
    await this.modifierEtat((e) => {
      e.lots = []
    })
    // Trace APRÈS coup, et non marquée : c'est la preuve que la suppression a eu lieu.
    await this.tracer('DONNEES_TEST_SUPPRESSION', auteurId, ip, null, {
      lignes,
      tables,
    })
    this.logger.log(`Données de test supprimées : ${lignes} lignes`)
    return { lignes, tables }
  }

  // ── Préparation ─────────────────────────────────────────────────────────────

  private dejaEnCours(): ConflictException {
    return new ConflictException({
      code: 'GENERATION_EN_COURS',
      message: 'Une génération est déjà en cours.',
    })
  }

  private exigerEquipe(equipes: EquipeSite[]): void {
    const medecins = equipes.reduce((s, e) => s + e.medecins.length, 0)
    const infirmiers = equipes.reduce((s, e) => s + e.infirmiers.length, 0)
    if (medecins === 0 || infirmiers === 0)
      throw new ConflictException({
        code: 'PERSONNEL_INSUFFISANT',
        message:
          'Il faut au moins un médecin et un infirmier actifs, avec un compte, pour leur attribuer les gestes.',
      })
  }

  private async exigerReferentiels(): Promise<void> {
    const ref = await this.chargerReferentiels()
    const manque: string[] = []
    if (ref.categories.size === 0) manque.push('catégories de patients')
    if (ref.motifs.size === 0) manque.push('motifs de consultation')
    if (ref.pathologies.size === 0) manque.push('pathologies')
    if (ref.typesConsultation.size === 0) manque.push('types de consultation')
    if (manque.length > 0)
      throw new ConflictException({
        code: 'REFERENTIELS_INCOMPLETS',
        message: `Les référentiels du centre sont incomplets (${manque.join(', ')}) : le générateur s’appuie sur eux sans jamais les modifier.`,
      })
    if (profilsDisponibles(ref).length === 0)
      throw new BadRequestException(
        'Aucun profil clinique ne correspond aux référentiels du centre.',
      )
  }

  /** Les soignants ayant un compte actif, groupés par site. Les administrateurs sans fiche de personnel en sont exclus. */
  private async chargerEquipes(): Promise<EquipeSite[]> {
    const [comptes, sites] = await Promise.all([
      this.prisma.utilisateur.findMany({
        where: {
          statut: 'ACTIF',
          personnelMedicalId: { not: null },
          personnelMedical: { statut: 'ACTIF' },
        },
        select: {
          id: true,
          login: true,
          siteId: true,
          personnelMedicalId: true,
          roles: { select: { role: { select: { code: true } } } },
          personnelMedical: { select: { role: true } },
        },
      }),
      this.prisma.site.findMany({ select: { id: true, code: true } }),
    ])
    const siteCode = new Map(sites.map((s) => [s.id, s.code]))
    const parSite = new Map<string, EquipeSite>()
    for (const c of comptes) {
      const code = siteCode.get(c.siteId)
      if (!code || !c.personnelMedicalId) continue
      const fonction = classerSoignant(
        c.roles.map((r) => r.role.code),
        c.personnelMedical?.role ?? '',
      )
      if (!fonction) continue
      const soignant: Soignant = {
        utilisateurId: c.id,
        login: c.login,
        personnelId: c.personnelMedicalId,
        siteId: c.siteId,
      }
      const equipe = parSite.get(c.siteId) ?? {
        siteId: c.siteId,
        siteCode: code,
        medecins: [],
        infirmiers: [],
      }
      ;(fonction === 'MEDECIN' ? equipe.medecins : equipe.infirmiers).push(
        soignant,
      )
      parSite.set(c.siteId, equipe)
    }
    return [...parSite.values()].sort((a, b) =>
      a.siteCode.localeCompare(b.siteCode),
    )
  }

  private async chargerReferentiels(): Promise<ReferentielsTest> {
    const [
      categories,
      motifs,
      pathologies,
      types,
      societes,
      medicaments,
      examens,
      droits,
      etablissements,
    ] = await Promise.all([
      this.prisma.categoriePatient.findMany({
        where: { statut: 'ACTIVE' },
        select: { id: true, code: true },
      }),
      this.prisma.motifConsultation.findMany({
        where: { statut: 'ACTIF' },
        select: { id: true, code: true, triageAllege: true },
      }),
      this.prisma.pathologieReference.findMany({
        where: { statut: 'ACTIVE' },
        select: { id: true, code: true, chronique: true },
      }),
      this.prisma.typeConsultation.findMany({
        where: { statut: 'ACTIF' },
        select: { id: true, code: true },
      }),
      this.prisma.societeSousTraitante.findMany({
        where: { statut: 'ACTIVE' },
        select: { id: true },
      }),
      this.prisma.medicamentReference.findMany({
        where: { statut: 'ACTIF' },
        select: {
          id: true,
          nomGenerique: true,
          nomCommercial: true,
          familleThera: true,
          contreIndications: { select: { condition: true } },
        },
      }),
      this.prisma.typeExamen.findMany({
        where: { statut: 'ACTIF' },
        select: { id: true, code: true, domaine: true },
      }),
      this.prisma.droitCategoriePatient.findMany({
        where: {
          couvert: true,
          typePrestation: { in: ['MEDICAMENT', 'EXAMEN'] },
        },
        select: { typePrestation: true, categorie: { select: { code: true } } },
      }),
      this.prisma.etablissementReference.findMany({
        where: { statut: 'ACTIF' },
        select: { id: true },
      }),
    ])
    const droitsParCategorie = new Map<string, Set<string>>()
    for (const d of droits) {
      const l = droitsParCategorie.get(d.categorie.code) ?? new Set<string>()
      l.add(d.typePrestation)
      droitsParCategorie.set(d.categorie.code, l)
    }
    return {
      categories: new Map(categories.map((c) => [c.code, c.id])),
      motifs: new Map(
        motifs.map((m) => [m.code, { id: m.id, triageAllege: m.triageAllege }]),
      ),
      pathologies: new Map(pathologies.map((p) => [p.code, p.id])),
      pathologiesChroniques: new Set(
        pathologies.filter((p) => p.chronique).map((p) => p.id),
      ),
      typesConsultation: new Map(types.map((t) => [t.code, t.id])),
      societes: societes.map((s) => s.id),
      medicaments: new Map(
        medicaments.map((m) => [
          cleMedicament(m.nomGenerique),
          {
            id: m.id,
            nomGenerique: m.nomGenerique,
            nomCommercial: m.nomCommercial,
            famille: m.familleThera,
            contreIndications: m.contreIndications.map((c) => c.condition),
          },
        ]),
      ),
      typesExamen: new Map(
        examens.map((t) => [t.code, { id: t.id, domaine: t.domaine }]),
      ),
      droits: droitsParCategorie,
      etablissements: etablissements.map((e) => e.id),
    }
  }

  /** Tout ce qui existe déjà et que le générateur ne doit pas refabriquer : noms, téléphones, matricules, numéros. */
  private async chargerDejaPris(): Promise<{
    noms: string[]
    telephones: string[]
    matricules: string[]
  }> {
    const [identites, contacts, personnel, matricules] = await Promise.all([
      this.prisma.raw.identitePatient.findMany({
        select: { nom: true, prenom: true, telephone: true },
      }),
      this.prisma.raw.contactUrgence.findMany({
        select: { nom: true, prenom: true, telephone: true },
      }),
      this.prisma.raw.personnelMedical.findMany({
        select: { nom: true, prenom: true, matricule: true },
      }),
      this.prisma.raw.patient.findMany({
        where: { matricule: { not: null } },
        select: { matricule: true },
      }),
    ])
    return {
      noms: [...identites, ...contacts, ...personnel].map((x) =>
        cleNom(x.prenom, x.nom),
      ),
      telephones: [...identites, ...contacts]
        .map((x) => x.telephone)
        .filter((t): t is string => !!t),
      matricules: [
        ...personnel.map((p) => p.matricule),
        ...matricules.map((m) => m.matricule).filter((m): m is string => !!m),
      ],
    }
  }

  private async chargerNumerotation(
    equipes: EquipeSite[],
  ): Promise<Numerotation> {
    const dernier = new Map<string, number>()
    for (const e of equipes) {
      const prefixe = e.siteCode.slice(0, 3).toUpperCase()
      if (dernier.has(prefixe)) continue
      const p = await this.prisma.raw.patient.findFirst({
        where: { numeroPatient: { startsWith: `PAT-${prefixe}-` } },
        orderBy: { numeroPatient: 'desc' },
        select: { numeroPatient: true },
      })
      dernier.set(prefixe, p ? parseInt(p.numeroPatient.slice(-5), 10) || 0 : 0)
    }
    return new Numerotation(dernier)
  }

  /** Reconstruit la population d'une génération reprise, d'après ce qui est déjà en base. */
  private async chargerPopulation(
    ref: ReferentielsTest,
    graine: string,
  ): Promise<Population> {
    const population = new Population()
    const codeCategorie = new Map([...ref.categories].map(([c, id]) => [id, c]))
    const patients = await this.prisma.raw.patient.findMany({
      where: { id: FILTRE_MARQUE },
      select: {
        id: true,
        numeroPatient: true,
        matricule: true,
        siteCreationId: true,
        categoriePatientId: true,
        identite: {
          select: { sexe: true, dateNaissance: true, nom: true, prenom: true },
        },
      },
    })
    const visites = await this.prisma.raw.visite.groupBy({
      by: ['patientId'],
      where: { patientId: FILTRE_MARQUE },
      _count: { _all: true },
      _max: { dateOuverture: true },
    })
    const parPatient = new Map(visites.map((v) => [v.patientId, v]))
    const dependants = await this.prisma.raw.rattachementAyantDroitCdi.groupBy({
      by: ['cdiId'],
      where: { cdiId: FILTRE_MARQUE },
      _count: { _all: true },
    })
    const nbDependants = new Map(
      dependants.map((d) => [d.cdiId as string, d._count._all]),
    )
    // Maladies suivies : les antécédents rattachés à la liste de référence, traduits en profils.
    const profils = profilsDisponibles(ref).filter((p) => p.chronique)
    const parPathologie = new Map(
      profils.map((p) => [ref.pathologies.get(p.pathologie) as string, p.code]),
    )
    const antecedents = await this.prisma.raw.antecedentPatient.findMany({
      where: {
        patientId: FILTRE_MARQUE,
        statut: 'ACTIF',
        pathologieId: { in: [...parPathologie.keys()] },
      },
      select: { patientId: true, pathologieId: true },
    })
    const chroniques = new Map<string, string[]>()
    for (const a of antecedents) {
      const code = parPathologie.get(a.pathologieId as string)
      if (!code) continue
      const l = chroniques.get(a.patientId) ?? []
      if (!l.includes(code)) l.push(code)
      chroniques.set(a.patientId, l)
    }
    // Ce que la prescription doit savoir de chaque personne : allergies, alertes, suivis déjà définis.
    const parPatientListe = <T extends { patientId: string }>(
      lignes: T[],
      valeur: (l: T) => string | null,
    ) => {
      const m = new Map<string, string[]>()
      for (const l of lignes) {
        const v = valeur(l)
        if (v === null) continue
        const liste = m.get(l.patientId) ?? []
        liste.push(v)
        m.set(l.patientId, liste)
      }
      return m
    }
    const allergies = parPatientListe(
      await this.prisma.raw.allergiePatient.findMany({
        where: { patientId: FILTRE_MARQUE, statut: 'ACTIVE' },
        select: { patientId: true, substance: true },
      }),
      (l) => l.substance,
    )
    const alertes = parPatientListe(
      await this.prisma.raw.alerteMedicale.findMany({
        where: { patientId: FILTRE_MARQUE, statut: 'ACTIVE' },
        select: { patientId: true, message: true },
      }),
      (l) => l.message,
    )
    const suivis = parPatientListe(
      (
        await this.prisma.raw.suiviChronique.findMany({
          where: {
            patientId: FILTRE_MARQUE,
            statut: 'ACTIF',
            deletedAt: null,
          },
          select: { patientId: true, pathologieId: true },
        })
      ).flatMap((l) =>
        l.patientId === null
          ? []
          : [{ patientId: l.patientId, pathologieId: l.pathologieId }],
      ),
      (l) => parPathologie.get(l.pathologieId) ?? null,
    )
    for (const p of patients) {
      if (!p.identite?.dateNaissance || !p.identite.sexe) continue
      const v = parPatient.get(p.id)
      const sexe = p.identite.sexe as Sexe
      const sim: PatientSim = {
        id: p.id,
        numeroPatient: p.numeroPatient,
        categorieCode: codeCategorie.get(p.categoriePatientId) ?? '',
        categorieId: p.categoriePatientId,
        sexe,
        naissance: p.identite.dateNaissance,
        nom: p.identite.nom,
        prenom: p.identite.prenom,
        siteId: p.siteCreationId,
        matricule: p.matricule,
        nbDependants: nbDependants.get(p.id) ?? 0,
        chroniques: chroniques.get(p.id) ?? [],
        // Contrôle dû très bientôt : les malades suivis reviennent peu après la reprise.
        prochainSuivi: chroniques.has(p.id) ? new Date() : null,
        derniereVisite: v?._max.dateOuverture ?? null,
        nbVisites: v?._count._all ?? 0,
        allergies: allergies.get(p.id) ?? [],
        alertes: alertes.get(p.id) ?? [],
        suivisChroniques: suivis.get(p.id) ?? [],
        morphologie: nouvelleMorphologie(creerAlea(`${graine}|${p.id}`), sexe),
      }
      population.ajouter(sim)
    }
    return population
  }

  // ── Exécution ───────────────────────────────────────────────────────────────

  private lancer(lotId: string): void {
    this.arretDemande = false
    this.execution = this.executer(lotId)
      .catch((e: unknown) =>
        this.logger.error(`Génération ${lotId} : ${(e as Error).message}`),
      )
      .finally(() => {
        this.execution = null
        this.arretDemande = false
      })
  }

  private async executer(lotId: string): Promise<void> {
    const miseAJour = (fn: (l: Lot) => void) =>
      this.modifierEtat((e) => {
        const l = e.lots.find((x) => x.id === lotId)
        if (!l) return
        fn(l)
        l.derniereMaj = new Date().toISOString()
      })
    try {
      const etat = await this.lireEtat()
      const lot = etat.lots.find((l) => l.id === lotId)
      if (!lot) return
      const equipes = await this.chargerEquipes()
      const ref = await this.chargerReferentiels()
      const alea = creerAlea(lot.parametres.graine)
      const deja = await this.chargerDejaPris()
      const fabrique = new FabriqueIdentites(alea.sousFlux('identites'), deja)
      const numerotation = await this.chargerNumerotation(equipes)
      const population =
        lot.progression.joursFaits > 0
          ? await this.chargerPopulation(ref, lot.parametres.graine)
          : new Population()
      const ips = new Map<string, readonly string[]>(
        equipes.map((e) => [
          e.siteId,
          ipsDuSite(alea.sousFlux(`ip|${e.siteCode}`), e.siteCode),
        ]),
      )
      const tousLesJours = joursEntre(lot.parametres.debut, lot.parametres.fin)
      const ouverts = tousLesJours.filter(estOuvert)

      for (let i = lot.progression.joursFaits; i < ouverts.length; i++) {
        if (this.arretDemande) {
          await miseAJour((l) => {
            l.statut = 'ANNULE'
            l.message = 'Arrêtée à votre demande. Vous pouvez la reprendre.'
          })
          return
        }
        await this.verifierGardes()
        const jour = ouverts[i]
        const ctx: ContexteJour = {
          jour,
          alea: alea.sousFlux(jour),
          racine: alea,
          equipes,
          ref,
          etat: { population, fabrique, numerotation },
          params: {
            visitesParJour: lot.parametres.visitesParJour,
            indexJour: tousLesJours.indexOf(jour),
            totalJours: tousLesJours.length,
            finPeriode: lot.parametres.fin,
            limite: lot.parametres.limite ?? null,
          },
          ips,
        }
        const { lignes, resume } = planifierJour(ctx)
        await ecrireLignes(this.prisma, lignes)
        await miseAJour((l) => {
          const p = l.progression
          p.joursFaits = i + 1
          p.jourCourant = jour
          p.visites += resume.visites
          p.patients += resume.nouveauxPatients
          p.consultations += resume.consultations
          p.visitesAnnulees += resume.visitesAnnulees
          p.consultationsAnnulees += resume.consultationsAnnulees
          p.nonRecus += resume.nonRecus
          cumuler(p.lignes, lignes)
        })
        // On rend la main : les requêtes des utilisateurs passent entre deux journées.
        await new Promise<void>((r) => setImmediate(r))
      }
      // Le lot lu au départ ne connaît pas la progression : on relit l'état d'aujourd'hui.
      const courant =
        (await this.lireEtat()).lots.find((x) => x.id === lotId) ?? lot
      const bilan = await this.calculerBilan(courant).catch((e: unknown) => {
        this.logger.warn(`Bilan non établi : ${(e as Error).message}`)
        return null
      })
      await miseAJour((l) => {
        l.statut = 'TERMINE'
        l.termineLe = new Date().toISOString()
        l.message = null
        l.bilan = bilan
      })
      this.logger.log(`Génération ${lotId} terminée`)
    } catch (e) {
      const message =
        e instanceof ArretGeneration
          ? e.message
          : `Échec : ${(e as Error).message.split('\n').pop()}`
      this.logger.warn(`Génération ${lotId} arrêtée — ${message}`)
      await miseAJour((l) => {
        l.statut = e instanceof ArretGeneration ? 'INTERROMPU' : 'ECHEC'
        l.message = message
      }).catch(() => undefined)
    }
  }

  /**
   * La place que les lignes fabriquées occupent : pour chaque table, sa taille (index compris) au
   * prorata des lignes marquées qu'elle contient. Comparer la taille de la base avant et après
   * sous-estimerait : une base qui réemploie l'espace libéré par des suppressions ne grossit pas.
   * Nulle sur un poste (SQLite).
   */
  private async placePrise(
    lignes: Record<string, number>,
  ): Promise<number | null> {
    if (this.local) return null
    let total = 0
    for (const m of MODELES_TEST) {
      const marquees = lignes[m.modele] ?? 0
      if (marquees === 0) continue
      // Les noms viennent du registre (jamais d'une saisie) : la requête ne reçoit rien d'extérieur.
      const r = await this.prisma.raw.$queryRawUnsafe<
        { o: bigint | number; n: bigint | number }[]
      >(
        `SELECT pg_total_relation_size('"${m.modele}"') AS o, (SELECT count(*) FROM "${m.modele}") AS n`,
      )
      const n = Number(r[0]?.n ?? 0)
      if (n > 0) total += (Number(r[0]?.o ?? 0) * marquees) / n
    }
    return Math.round(total)
  }

  /**
   * Le bilan d'une génération terminée : où, qui, combien de documents, combien de connexions et la
   * place prise. Lu dans la base d'après la marque (ce qui est écrit fait foi, pas le compteur).
   */
  private async calculerBilan(lot: Lot): Promise<BilanLot> {
    const m = FILTRE_MARQUE
    const raw = this.prisma.raw
    const [
      sites,
      categories,
      visites,
      patients,
      parCategorie,
      journal,
      appareils,
    ] = await Promise.all([
      this.prisma.site.findMany({ select: { id: true, code: true } }),
      this.prisma.categoriePatient.findMany({
        select: { id: true, code: true },
      }),
      raw.visite.groupBy({
        by: ['siteId'],
        where: { id: m },
        _count: { _all: true },
      }),
      raw.patient.groupBy({
        by: ['siteCreationId'],
        where: { id: m },
        _count: { _all: true },
      }),
      raw.patient.groupBy({
        by: ['categoriePatientId'],
        where: { id: m },
        _count: { _all: true },
      }),
      raw.journalAuthentification.groupBy({
        by: ['resultat'],
        where: { id: m },
        _count: { _all: true },
      }),
      raw.sessionUtilisateur.groupBy({
        by: ['appareilId'],
        where: { id: m },
        _count: { _all: true },
      }),
    ])
    const codeSite = new Map(sites.map((s) => [s.id, s.code]))
    const codeCategorie = new Map(categories.map((c) => [c.id, c.code]))
    const nb = (resultat: string) =>
      journal.find((j) => j.resultat === resultat)?._count._all ?? 0
    const total = (prefixe: string) =>
      journal
        .filter((j) => j.resultat.startsWith(prefixe))
        .reduce((s, j) => s + j._count._all, 0)
    const l = lot.progression.lignes
    const lignes = (modele: string) => l[modele] ?? 0
    const sitesLus = new Map<string, { visites: number; patients: number }>()
    for (const v of visites) {
      const code = codeSite.get(v.siteId) ?? '?'
      sitesLus.set(code, {
        patients: sitesLus.get(code)?.patients ?? 0,
        visites: v._count._all,
      })
    }
    for (const p of patients) {
      const code = codeSite.get(p.siteCreationId) ?? '?'
      sitesLus.set(code, {
        visites: sitesLus.get(code)?.visites ?? 0,
        patients: p._count._all,
      })
    }
    return {
      tailleOctets: await this.placePrise(l),
      sites: [...sitesLus.entries()]
        .map(([code, v]) => ({ code, ...v }))
        .sort((a, b) => b.visites - a.visites),
      categories: parCategorie
        .map((c) => ({
          code: codeCategorie.get(c.categoriePatientId) ?? '?',
          patients: c._count._all,
        }))
        .sort((a, b) => b.patients - a.patients),
      connexions: {
        reussies: nb('SUCCES_LOGIN') + nb('SUCCES_LOGIN_SESSION_REMPLACEE'),
        echecs: total('ECHEC_'),
        deconnexions: nb('SUCCES_LOGOUT'),
        questions: nb('SUCCES_LOGIN_SESSION_ACTIVE'),
        appareils: appareils.length,
      },
      documents: {
        ordonnances: lignes('Ordonnance'),
        bonsExamen: lignes('BonExamen'),
        bonsPharmacie: lignes('BonPharmacie'),
        resultats: lignes('ResultatExamen'),
        evacuations: lignes('Evacuation'),
        suivisTraitement: lignes('SuiviTraitement'),
        suivisChroniques: lignes('SuiviChronique'),
      },
    }
  }

  /** Avant chaque journée : le mode est-il toujours Test ? la base a-t-elle encore de la place ? */
  private async verifierGardes(): Promise<void> {
    const mode = await this.mode.lire()
    if (mode.mode !== 'TEST')
      throw new ArretGeneration(
        'Le mode Test a été désactivé : la génération est arrêtée.',
      )
    const taille = await this.tailleBase()
    if (taille !== null && taille > this.limiteOctets())
      throw new ArretGeneration(
        `La base atteint ${nombreFr(taille / 1048576)} Mo, la limite fixée à ${nombreFr(this.limiteOctets() / 1048576)} Mo : la génération est arrêtée.`,
      )
  }

  // ── Trace ───────────────────────────────────────────────────────────────────

  /** Une ligne ORDINAIRE du journal d'audit (non marquée) : qui a fait quoi à la base. */
  private async tracer(
    action: string,
    auteurId: string,
    ip: string | null,
    avant: Record<string, unknown> | null,
    apres: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.journalAudit.create({
        data: {
          utilisateurId: auteurId,
          action,
          module: 'systeme',
          entiteType: 'DonneesTest',
          ipAdresse: ip,
          statut: 'SUCCES',
          ...(avant ? { avantJson: avant as object } : {}),
          apresJson: apres as object,
        },
      })
    } catch (e) {
      this.logger.error(
        `Opération sur les données de test non tracée : ${(e as Error).message}`,
      )
    }
  }
}

function effectifs(equipes: readonly EquipeSite[]): EquipeEffectifs[] {
  return equipes.map((e) => ({
    medecins: e.medecins.length,
    infirmiers: e.infirmiers.length,
  }))
}
