/**
 * ModeSystemeService — le mode du système (production / test) : sa lecture par tous, son
 * changement par l'administrateur seul, mot de passe redemandé, verrou de configuration,
 * trace d'audit, et diffusion immédiate à tous les écrans.
 *
 * Stockage : une ligne RÉSERVÉE de `ParametreSysteme` (clé `systeme.mode`, jamais listée dans le
 * catalogue des paramètres). L'auteur et la date viennent de `updatedBy` / `updatedAt`.
 *
 * Sur un POSTE (base locale SQLite), le mode n'est pas le sien : il le reçoit du serveur central
 * dans la réponse de son battement de vie, et le range dans la même ligne — `lire()` marche alors
 * partout à l'identique. Un poste ne PEUT pas changer de mode (409) : il divergerait du central,
 * qui reste le seul à faire foi.
 */

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationService } from '../notification/notification.service'
import { motDePasseCorrect } from './mot-de-passe-admin'
import {
  CLE_MODE,
  modeEffectif,
  modeEnregistre,
  modeTestVerrouille,
  type ModeSysteme,
} from './mode-systeme'

export interface EtatMode {
  /** Mode EFFECTIF : celui que le système applique et affiche. */
  mode: ModeSysteme
  /** La configuration du serveur interdit le mode Test (`MODE_TEST_AUTORISE=false`). */
  verrouille: boolean
  /** Ce système peut-il changer de mode ? Non sur un poste : il suit le serveur central. */
  modifiable: boolean
  /** Depuis quand le mode Test est actif, et par qui (renseignés seulement alors). */
  depuis: Date | null
  parNom: string | null
}

@Injectable()
export class ModeSystemeService {
  private readonly logger = new Logger('ModeSysteme')

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  /** Lu à CHAQUE appel (jamais figé au démarrage) : le verrou doit suivre la configuration. */
  private get verrouille(): boolean {
    return modeTestVerrouille(process.env['MODE_TEST_AUTORISE'])
  }
  private get local(): boolean {
    return process.env['DATABASE_PROVIDER'] === 'sqlite'
  }

  /** Le mode du système — visible de tout utilisateur connecté (c'est ce qui fait le bandeau). */
  async lire(): Promise<EtatMode> {
    const verrouille = this.verrouille
    const modifiable = !this.local
    const ligne = await this.prisma.parametreSysteme.findUnique({
      where: { cle: CLE_MODE },
    })
    const mode = modeEffectif(ligne?.valeur, verrouille)
    if (mode !== 'TEST' || !ligne || !modifiable)
      return { mode, verrouille, modifiable, depuis: null, parNom: null }
    return {
      mode,
      verrouille,
      modifiable,
      depuis: ligne.updatedAt,
      parNom: await this.nomDe(ligne.updatedBy),
    }
  }

  /**
   * Change le mode.
   *
   * Dans cet ordre : un poste ne change rien ; le mot de passe de l'administrateur est
   * redemandé (un échec est tracé) ; le verrou de configuration interdit d'ENTRER en mode test
   * (REVENIR en production reste toujours permis) ; changer vers le mode déjà en place n'écrit
   * rien et ne trace rien.
   */
  async changer(
    mode: ModeSysteme,
    motDePasse: string,
    auteurId: string,
    ip: string | null,
  ): Promise<EtatMode> {
    if (this.local)
      throw new ConflictException({
        code: 'MODE_CENTRAL',
        message:
          'Le mode se change depuis le serveur central (version web), pas depuis un poste.',
      })

    await this.confirmerMotDePasse(auteurId, motDePasse, mode, ip)

    if (mode === 'TEST' && this.verrouille)
      throw new ForbiddenException({
        code: 'MODE_TEST_VERROUILLE',
        message:
          'Le mode Test est verrouillé par la configuration de ce serveur (MODE_TEST_AUTORISE).',
      })

    // On compare à la valeur ENREGISTRÉE, pas au mode effectif : revenir en production alors
    // que la base dit encore « TEST » (centre verrouillé entre-temps) doit corriger la base —
    // sinon le jour où le verrou est levé, le centre retomberait en mode test sans que personne
    // l'ait décidé.
    const ligne = await this.prisma.parametreSysteme.findUnique({
      where: { cle: CLE_MODE },
    })
    const avant = modeEnregistre(ligne?.valeur)
    if (avant === mode) return this.lire()

    await this.prisma.parametreSysteme.upsert({
      where: { cle: CLE_MODE },
      update: { valeur: mode, updatedBy: auteurId },
      create: {
        cle: CLE_MODE,
        valeur: mode,
        description: 'Mode du système (production ou test)',
        updatedBy: auteurId,
      },
    })
    await this.tracer(
      mode === 'TEST' ? 'MODE_TEST_ON' : 'MODE_TEST_OFF',
      auteurId,
      ip,
      'SUCCES',
      { mode: avant },
      { mode },
    )
    this.logger.log(`Mode du système : ${avant} → ${mode}`)
    // Tous les écrans ouverts (bandeau) se mettent à jour sans attendre leur prochain relevé.
    this.notifications.broadcastLive('SYSTEME_MODE')
    return this.lire()
  }

  /**
   * POSTE : range le mode annoncé par le serveur central. Appelé par le client de
   * synchronisation à chaque battement de vie ; sans effet si rien ne change.
   */
  async memoriserDuCentral(mode: ModeSysteme): Promise<void> {
    await this.prisma.parametreSysteme.upsert({
      where: { cle: CLE_MODE },
      update: { valeur: mode },
      create: { cle: CLE_MODE, valeur: mode },
    })
  }

  // ── Privé ───────────────────────────────────────────────────────────────────

  /** Redemande le mot de passe de l'administrateur : un échec est refusé (403) ET tracé. */
  private async confirmerMotDePasse(
    auteurId: string,
    motDePasse: string,
    demande: ModeSysteme,
    ip: string | null,
  ): Promise<void> {
    // 403 et non 401 : un 401 déclencherait, côté application web, un renouvellement de la
    // session — alors que la session est valide, et que c'est le MOT DE PASSE saisi qui est faux.
    if (!(await motDePasseCorrect(this.prisma, auteurId, motDePasse))) {
      await this.tracer('MODE_ECHEC', auteurId, ip, 'ERREUR', null, {
        demande,
        raison: 'mot de passe incorrect',
      })
      throw new ForbiddenException({
        code: 'MOT_DE_PASSE_INCORRECT',
        message: 'Mot de passe incorrect.',
      })
    }
  }

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

  /** Trace dans le journal d'audit : qui, d'où, quoi — jamais bloquant. */
  private async tracer(
    action: string,
    auteurId: string,
    ip: string | null,
    statut: 'SUCCES' | 'ERREUR',
    avant: Record<string, string> | null,
    apres: Record<string, string>,
  ): Promise<void> {
    try {
      await this.prisma.journalAudit.create({
        data: {
          utilisateurId: auteurId,
          action,
          module: 'systeme',
          entiteType: 'ModeSysteme',
          ipAdresse: ip,
          statut,
          ...(avant ? { avantJson: avant } : {}),
          apresJson: apres,
        },
      })
    } catch (e) {
      this.logger.error(
        `Changement de mode non tracé : ${(e as Error).message}`,
      )
    }
  }
}
