/**
 * VidageService — vider TOUTES les données métier du centre (dossiers, visites, consultations,
 * ordonnances, bons, résultats, évacuations, suivis), d'un seul geste, sans retour possible.
 *
 * C'est le geste de la mise en service : le centre a vécu en mode Test (données fictives mêlées à
 * quelques essais réels), il repart à neuf avant d'ouvrir pour de bon. Ce qui reste : les comptes,
 * le personnel, les référentiels, la messagerie, les paramètres, les journaux (cf. vidage-metier.ts).
 *
 * Les protections, dans l'ordre où elles s'appliquent :
 *  - serveur central seulement (un poste reçoit l'ordre du central, il ne le donne pas) ;
 *  - mode TEST seulement : en production, ce geste n'existe pas — et le verrou de mise en service
 *    (`MODE_TEST_AUTORISE=false`) le rend définitivement impossible ;
 *  - jamais pendant une génération de données de test ;
 *  - une phrase à recopier, deux accusés (irréversible, restauration vérifiée), et le MOT DE PASSE de
 *    l'administrateur redemandé — un échec est refusé ET tracé ;
 *  - une seule transaction : tout part ou rien ne part ;
 *  - les envois des postes sont arrêtés le temps du vidage, puis refusés tant que le poste n'a pas
 *    vidé sa copie : sans cela, un poste qui avait déjà ses lignes les renverrait au centre.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationService } from '../notification/notification.service'
import { ModeSystemeService } from '../systeme/mode-systeme.service'
import { motDePasseCorrect } from '../systeme/mot-de-passe-admin'
import { PortierVidage } from '../sync/portier-vidage'
import {
  NIVEAU_CONTROLE_VIDAGE,
  ONLINE_WINDOW_MS,
} from '../sync/sync-supervision.service'
import {
  AUTRES_DONNEES_METIER,
  compterDonneesMetier,
  delegueMetier,
  TABLES_METIER,
  viderDonneesMetier,
} from '../sync/vidage-metier'
import {
  CLE_ETAT_DONNEES_TEST,
  DonneesTestService,
} from './donnees-test.service'
import { MODELES_TEST } from './registre'

/** Ligne RÉSERVÉE de `ParametreSysteme` : le dernier vidage (quand, par qui, combien). */
export const CLE_VIDAGE = 'systeme.vidage'

/**
 * La phrase à recopier. Sans accent, à dessein : on ne doit pas pouvoir échouer à confirmer un geste
 * irréversible parce que le clavier ne fait pas « É ».
 */
export const PHRASE_VIDAGE = 'VIDER LES DONNEES'

/**
 * Combien de temps attendre la fin des envois de postes en route avant de renoncer (20 s). Relu à
 * chaque vidage : `VIDAGE_ATTENTE_ENVOIS_MS` ne sert qu'aux tests, qui n'ont pas 20 secondes à perdre.
 */
function delaiEnvoisMs(): number {
  const v = Number(process.env['VIDAGE_ATTENTE_ENVOIS_MS'])
  return Number.isFinite(v) && v > 0 ? v : 20_000
}

/**
 * Les journaux que le GÉNÉRATEUR a remplis de fausses connexions et de fausses traces (sessions,
 * journal des connexions, journal d'audit). Ils restent après un vidage — ce sont des journaux — SAUF
 * les lignes que le générateur y a fabriquées, reconnaissables à leur marque : un centre qui ouvre
 * pour de bon n'a pas à garder trois mois de connexions fictives dans son historique réel.
 */
const JOURNAUX_DE_TEST = new Set([
  'SessionUtilisateur',
  'JournalAuthentification',
  'JournalAudit',
])

interface DelegueJournal {
  count: (a: { where: unknown }) => Promise<number>
  deleteMany: (a: { where: unknown }) => Prisma.PrismaPromise<{ count: number }>
}

/** Libellés des tables qui n'ont pas de ligne dans le registre des données de test. */
const LIBELLES_COMPLEMENTAIRES: Record<string, string> = {
  FusionDossierPatient: 'Fusions de dossiers',
}

export interface DemandeVidage {
  motDePasse: string
  confirmation: string
  irreversible: boolean
  restaurationVerifiee: boolean
}

export interface DernierVidage {
  at: string
  parNom: string | null
  lignes: number
}

export interface EtatVidage {
  mode: 'PRODUCTION' | 'TEST'
  /** Peut-on vider maintenant ? Sinon, pourquoi pas. */
  disponible: boolean
  raison: string | null
  phrase: string
  /** Ce qui partirait si l'on videait maintenant. */
  lignes: {
    total: number
    tables: { modele: string; libelle: string; n: number }[]
    autres: { cle: string; libelle: string; n: number }[]
  }
  postes: {
    total: number
    /** Ont donné signe de vie il y a moins de 90 secondes : ils recevront l'ordre tout de suite. */
    enLigne: number
    /** Version trop ancienne pour vider leur copie : leurs échanges seront refusés jusqu'à leur mise à jour. */
    anciens: number
    /** Ont déjà reçu un vidage qu'ils n'ont pas encore accompli. */
    enAttente: number
    liste: {
      id: string
      libelle: string
      siteLibelle: string | null
      enLigne: boolean
      versionApp: string | null
      comprend: boolean
      enAttente: boolean
    }[]
  }
  dernier: DernierVidage | null
}

export interface ResultatVidageCentral {
  lignes: number
  tables: Record<string, number>
  autres: Record<string, number>
  /** Fausses connexions et fausses traces fabriquées par le générateur, retirées des journaux. */
  journauxDeTest: number
  /** Postes à qui l'ordre de vider leur copie a été donné. */
  postes: number
}

@Injectable()
export class VidageService {
  private readonly logger = new Logger('Vidage')
  /** Deux vidages ne se croisent jamais. */
  private enCours = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly mode: ModeSystemeService,
    private readonly donneesTest: DonneesTestService,
    private readonly portier: PortierVidage,
    private readonly notifications: NotificationService,
  ) {}

  private get local(): boolean {
    return process.env['DATABASE_PROVIDER'] === 'sqlite'
  }

  /**
   * Pourquoi on ne peut pas vider maintenant (null = on peut).
   * `pourVider` : appelé par le vidage lui-même, qui a déjà posé `enCours` — il ne doit pas s'y heurter.
   */
  private async empechement(pourVider = false): Promise<{
    mode: 'PRODUCTION' | 'TEST'
    code: string | null
    raison: string | null
  }> {
    if (this.local)
      return {
        mode: 'PRODUCTION',
        code: 'MODE_CENTRAL',
        raison:
          'Les données se vident depuis le serveur central (version web).',
      }
    const mode = (await this.mode.lire()).mode
    if (mode !== 'TEST')
      return {
        mode,
        code: 'MODE_PRODUCTION',
        raison:
          'Disponible uniquement en mode Test : en production, les données du centre sont protégées.',
      }
    if (this.enCours && !pourVider)
      return {
        mode,
        code: 'VIDAGE_EN_COURS',
        raison: 'Un vidage est déjà en cours.',
      }
    if (this.donneesTest.generationEnCours)
      return {
        mode,
        code: 'GENERATION_EN_COURS',
        raison:
          'Une génération de données de test est en cours : arrêtez-la d’abord.',
      }
    return { mode, code: null, raison: null }
  }

  async etat(): Promise<EtatVidage> {
    const e = await this.empechement()
    const comptes = await compterDonneesMetier(this.prisma.raw)
    const libelles = new Map(MODELES_TEST.map((m) => [m.modele, m.libelle]))
    const tables = TABLES_METIER.filter((m) => comptes.tables[m]).map((m) => ({
      modele: m,
      libelle: libelles.get(m) ?? LIBELLES_COMPLEMENTAIRES[m] ?? m,
      n: comptes.tables[m] ?? 0,
    }))
    const autres: { cle: string; libelle: string; n: number }[] =
      Object.entries(comptes.autres).map(([cle, n]) => ({
        cle,
        libelle:
          AUTRES_DONNEES_METIER[cle as keyof typeof AUTRES_DONNEES_METIER],
        n,
      }))
    const nJournaux = await this.compterJournauxDeTest()
    if (nJournaux > 0)
      autres.push({
        cle: 'journauxDeTest',
        libelle: 'Fausses connexions et traces fabriquées par le générateur',
        n: nJournaux,
      })
    const total =
      tables.reduce((s, t) => s + t.n, 0) + autres.reduce((s, t) => s + t.n, 0)

    const postesBruts = this.local
      ? []
      : await this.prisma.posteLocal.findMany({
          where: { masque: false },
          orderBy: { libelle: 'asc' },
          select: {
            id: true,
            libelle: true,
            siteId: true,
            derniereSyncAt: true,
            versionApp: true,
            niveauControle: true,
            vidageDemandeAt: true,
          },
        })
    const sites = postesBruts.length
      ? await this.prisma.site.findMany({
          where: { id: { in: [...new Set(postesBruts.map((p) => p.siteId))] } },
          select: { id: true, libelle: true },
        })
      : []
    const siteDe = new Map(sites.map((s) => [s.id, s.libelle] as const))
    const maintenant = Date.now()
    const liste = postesBruts.map((p) => ({
      id: p.id,
      libelle: p.libelle,
      siteLibelle: siteDe.get(p.siteId) ?? null,
      enLigne:
        !!p.derniereSyncAt && maintenant - +p.derniereSyncAt < ONLINE_WINDOW_MS,
      versionApp: p.versionApp,
      comprend: (p.niveauControle ?? 0) >= NIVEAU_CONTROLE_VIDAGE,
      enAttente: !!p.vidageDemandeAt,
    }))

    return {
      mode: e.mode,
      disponible: e.code === null,
      raison: e.raison,
      phrase: PHRASE_VIDAGE,
      lignes: { total, tables, autres },
      postes: {
        total: liste.length,
        enLigne: liste.filter((p) => p.enLigne).length,
        anciens: liste.filter((p) => !p.comprend).length,
        enAttente: liste.filter((p) => p.enAttente).length,
        liste,
      },
      dernier: await this.lireDernier(),
    }
  }

  /** Les modèles des journaux du générateur, dans l'ordre d'insertion du registre. */
  private get modelesJournaux() {
    return MODELES_TEST.filter((m) => JOURNAUX_DE_TEST.has(m.modele))
  }

  private delegueJournal(modele: string): DelegueJournal {
    return (this.prisma.raw as unknown as Record<string, DelegueJournal>)[
      delegueMetier(modele)
    ]
  }

  private async compterJournauxDeTest(): Promise<number> {
    let n = 0
    for (const m of this.modelesJournaux)
      n += await this.delegueJournal(m.modele).count({ where: m.perimetre })
    return n
  }

  private async lireDernier(): Promise<DernierVidage | null> {
    const ligne = await this.prisma.parametreSysteme.findUnique({
      where: { cle: CLE_VIDAGE },
    })
    if (!ligne) return null
    try {
      const v = JSON.parse(ligne.valeur) as {
        at?: string
        lignes?: number
      }
      if (typeof v.at !== 'string') return null
      return {
        at: v.at,
        lignes: typeof v.lignes === 'number' ? v.lignes : 0,
        parNom: await this.nomDe(ligne.updatedBy),
      }
    } catch {
      return null
    }
  }

  /**
   * Vide les données métier du centre et ordonne aux postes de vider leur copie.
   * Irréversible : la seule issue est une restauration de la base elle-même.
   */
  async vider(
    demande: DemandeVidage,
    auteurId: string,
    ip: string | null,
  ): Promise<ResultatVidageCentral> {
    // Test ET pose, sans le moindre `await` entre les deux : deux demandes simultanées ne peuvent pas
    // passer toutes deux (la seconde trouve le vidage déjà en cours).
    if (this.enCours)
      throw new ConflictException({
        code: 'VIDAGE_EN_COURS',
        message: 'Un vidage est déjà en cours.',
      })
    this.enCours = true
    try {
      const e = await this.empechement(true)
      if (e.code)
        throw new ConflictException({ code: e.code, message: e.raison })

      if (demande.confirmation.trim() !== PHRASE_VIDAGE)
        throw new BadRequestException({
          code: 'PHRASE_INCORRECTE',
          message: `Recopiez exactement la phrase « ${PHRASE_VIDAGE} ».`,
        })
      if (!demande.irreversible || !demande.restaurationVerifiee)
        throw new BadRequestException({
          code: 'ACCUSES_MANQUANTS',
          message:
            'Les deux accusés (geste irréversible, restauration de la base vérifiée) sont obligatoires.',
        })

      if (
        !(await motDePasseCorrect(this.prisma, auteurId, demande.motDePasse))
      ) {
        await this.tracer('VIDAGE_ECHEC', auteurId, ip, 'ERREUR', {
          raison: 'mot de passe incorrect',
        })
        // 403 et non 401 : un 401 déclencherait un renouvellement de la session côté web, alors que
        // la session est valide et que c'est le MOT DE PASSE saisi qui est faux.
        throw new ForbiddenException({
          code: 'MOT_DE_PASSE_INCORRECT',
          message: 'Mot de passe incorrect.',
        })
      }

      // Les postes n'envoient plus rien le temps du vidage, et ceux déjà en route ont fini.
      if (!(await this.portier.fermer(delaiEnvoisMs())))
        throw new ConflictException({
          code: 'ECHANGES_EN_COURS',
          message:
            'Des échanges avec les postes sont en cours : réessayez dans un instant.',
        })
      try {
        return await this.accomplir(auteurId, ip, demande)
      } finally {
        this.portier.rouvrir()
      }
    } finally {
      this.enCours = false
    }
  }

  private async accomplir(
    auteurId: string,
    ip: string | null,
    demande: DemandeVidage,
  ): Promise<ResultatVidageCentral> {
    const raw = this.prisma.raw
    const quand = new Date()
    const nbPostes = await raw.posteLocal.count()
    // Tout dans UNE transaction : le vidage lui-même, l'ordre donné à chaque poste, l'oubli des
    // générations de données de test (leurs lignes n'existent plus) et la trace du vidage. Un
    // poste qui envoie après le vidage est donc TOUJOURS déjà refusé (423) — il n'y a pas
    // d'instant où le centre est vide et où les postes ne le savent pas encore.
    const journaux = [...this.modelesJournaux].reverse()
    const r = await viderDonneesMetier(raw, [
      raw.posteLocal.updateMany({ data: { vidageDemandeAt: quand } }),
      raw.parametreSysteme.upsert({
        where: { cle: CLE_ETAT_DONNEES_TEST },
        update: { valeur: JSON.stringify({ lots: [] }) },
        create: {
          cle: CLE_ETAT_DONNEES_TEST,
          valeur: JSON.stringify({ lots: [] }),
          description: 'État de la génération de données de test',
        },
      }),
      raw.parametreSysteme.upsert({
        where: { cle: CLE_VIDAGE },
        update: {
          valeur: JSON.stringify({ at: quand.toISOString(), lignes: 0 }),
          updatedBy: auteurId,
        },
        create: {
          cle: CLE_VIDAGE,
          valeur: JSON.stringify({ at: quand.toISOString(), lignes: 0 }),
          description: 'Dernier vidage des données métier',
          updatedBy: auteurId,
        },
      }),
      // Enfants avant parents, comme partout : ce que le générateur a fabriqué dans les journaux.
      ...journaux.map((m) =>
        this.delegueJournal(m.modele).deleteMany({ where: m.perimetre }),
      ),
    ])
    const journauxDeTest = r.avec
      .slice(3)
      .reduce<number>((n, x) => n + ((x as { count: number }).count ?? 0), 0)
    const lignes = r.total + journauxDeTest
    // Le nombre de lignes n'est connu qu'une fois la transaction faite : on le range ensuite (la
    // ligne existe déjà, et sa date aussi — le geste est accompli même si cette mise à jour échoue).
    try {
      await raw.parametreSysteme.update({
        where: { cle: CLE_VIDAGE },
        data: {
          valeur: JSON.stringify({ at: quand.toISOString(), lignes }),
        },
      })
    } catch (e) {
      this.logger.warn(
        `Nombre de lignes du vidage non rangé : ${(e as Error).message}`,
      )
    }

    await this.tracer('DONNEES_VIDAGE', auteurId, ip, 'SUCCES', {
      lignes,
      tables: r.tables,
      autres: r.autres,
      journauxDeTest,
      postes: nbPostes,
      irreversible: demande.irreversible,
      restaurationVerifiee: demande.restaurationVerifiee,
    })
    this.logger.warn(
      `Données métier vidées : ${lignes} ligne(s), ordre donné à ${nbPostes} poste(s)`,
    )
    // Tous les écrans ouverts se rechargent : ce qu'ils affichent n'existe plus.
    this.notifications.broadcastLive('SYSTEME_VIDAGE')
    return {
      lignes,
      tables: r.tables,
      autres: r.autres,
      journauxDeTest,
      postes: nbPostes,
    }
  }

  // ── Privé ───────────────────────────────────────────────────────────────────

  private async nomDe(utilisateurId: string | null): Promise<string | null> {
    if (!utilisateurId) return null
    const u = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId },
      select: {
        login: true,
        personnelMedical: { select: { nom: true, prenom: true } },
      },
    })
    if (!u) return null
    return u.personnelMedical
      ? `${u.personnelMedical.prenom} ${u.personnelMedical.nom}`
      : u.login
  }

  /** Une ligne ORDINAIRE du journal d'audit : qui a vidé le centre, d'où, et ce qui est parti. */
  private async tracer(
    action: string,
    auteurId: string,
    ip: string | null,
    statut: 'SUCCES' | 'ERREUR',
    apres: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.journalAudit.create({
        data: {
          utilisateurId: auteurId,
          action,
          module: 'systeme',
          entiteType: 'DonneesMetier',
          ipAdresse: ip,
          statut,
          apresJson: apres as object,
        },
      })
    } catch (e) {
      this.logger.error(`Vidage non tracé : ${(e as Error).message}`)
    }
  }
}
