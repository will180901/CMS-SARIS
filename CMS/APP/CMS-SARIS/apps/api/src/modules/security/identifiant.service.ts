import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationService } from '../notification/notification.service'
import {
  dateFrancaise,
  erreurIdentifiant,
  identifiantPris,
  identifiantReserve,
  normaliserIdentifiant,
} from './identifiant'

export interface DemandeChangementIdentifiant {
  /** Le compte dont l'identifiant change. */
  utilisateurId: string
  /** Ce qui a été saisi (normalisé ici). */
  nouveau: string
  /** Qui le fait : la personne elle-même, ou un administrateur. */
  acteurId: string
  ip?: string | null
  userAgent?: string | null
}

/**
 * Changer l'identifiant de connexion d'un compte — par la personne elle-même ou par un administrateur
 * qui le corrige. Les mêmes règles pour les deux :
 *  - jamais depuis un poste de bureau : la base locale n'est pas la référence, et deux appareils
 *    changeraient des valeurs différentes ;
 *  - forme valide, jamais celui d'un autre compte (supprimé compris, sans tenir compte de la casse),
 *    jamais un identifiant libéré depuis moins de 90 jours par quelqu'un d'autre ;
 *  - tracé (« ancien → nouveau », par qui, d'où) dans le journal d'audit ET dans le journal des
 *    connexions ; la personne est prévenue.
 * Le compte reste le même (son `id` ne change pas) : rôles, historique et sessions suivent.
 */
@Injectable()
export class IdentifiantService {
  private readonly logger = new Logger('Identifiant')

  constructor(
    private readonly prisma: PrismaService,
    // Résolu à l'exécution (évite la dépendance circulaire SecurityModule ⇄ NotificationModule).
    private readonly moduleRef: ModuleRef,
  ) {}

  /** Refuse (409) hors du serveur central : un poste de bureau ne change pas d'identifiant. */
  exigerCentral(): void {
    if (process.env['DATABASE_PROVIDER'] === 'sqlite')
      throw new ConflictException({
        code: 'MODE_CENTRAL',
        message:
          'L’identifiant se change depuis le serveur central (version web), pas depuis un poste de bureau.',
      })
  }

  async changer(
    d: DemandeChangementIdentifiant,
  ): Promise<{ ancien: string; login: string }> {
    this.exigerCentral()
    const login = normaliserIdentifiant(d.nouveau)
    const erreur = erreurIdentifiant(login)
    if (erreur)
      throw new BadRequestException({
        code: 'IDENTIFIANT_INVALIDE',
        message: erreur,
      })

    const user = await this.prisma.utilisateur.findUnique({
      where: { id: d.utilisateurId },
      select: { id: true, login: true },
    })
    if (!user) throw new NotFoundException('Compte introuvable')
    if (user.login === login)
      throw new BadRequestException({
        code: 'IDENTIFIANT_INCHANGE',
        message: 'C’est déjà cet identifiant.',
      })

    const pris = await identifiantPris(this.prisma, login, user.id)
    if (pris)
      throw new ConflictException({
        code: 'IDENTIFIANT_PRIS',
        message: pris.supprime
          ? 'Cet identifiant appartient à un compte supprimé.'
          : 'Cet identifiant est déjà utilisé.',
      })
    const reserve = await identifiantReserve(this.prisma, login, user.id)
    if (reserve)
      throw new ConflictException({
        code: 'IDENTIFIANT_RESERVE',
        message: `Cet identifiant vient d’être libéré par son ancien titulaire : il est mis de côté jusqu’au ${dateFrancaise(reserve)}.`,
      })

    try {
      await this.prisma.utilisateur.update({
        where: { id: user.id },
        data: { login, updatedBy: d.acteurId },
      })
    } catch (e) {
      // Deux demandes simultanées pour le même identifiant : la base tranche (@unique).
      if ((e as { code?: string }).code === 'P2002')
        throw new ConflictException({
          code: 'IDENTIFIANT_PRIS',
          message: 'Cet identifiant est déjà utilisé.',
        })
      throw e
    }

    const parAdmin = d.acteurId !== user.id
    await this.tracer(user.id, user.login, login, d, parAdmin)
    await this.prevenir(user.id, user.login, login, parAdmin)
    return { ancien: user.login, login }
  }

  /** Une ligne du journal d'audit ET une du journal des connexions — jamais bloquant. */
  private async tracer(
    utilisateurId: string,
    ancien: string,
    login: string,
    d: DemandeChangementIdentifiant,
    parAdmin: boolean,
  ): Promise<void> {
    try {
      await this.prisma.journalAudit.create({
        data: {
          utilisateurId: d.acteurId,
          action: 'CHANGE_LOGIN',
          module: 'utilisateur',
          entiteType: 'Utilisateur',
          entiteId: utilisateurId,
          ipAdresse: d.ip ?? null,
          statut: 'SUCCES',
          // `loginMin` : de quoi retrouver, sans tenir compte de la casse, qui a libéré un identifiant.
          avantJson: { login: ancien, loginMin: ancien.toLowerCase() },
          apresJson: { login, parAdmin },
        },
      })
      await this.prisma.journalAuthentification.create({
        data: {
          utilisateurId,
          login,
          resultat: 'SUCCES_CHANGEMENT_IDENTIFIANT',
          ipAdresse: d.ip ?? null,
          userAgent: d.userAgent ?? null,
        },
      })
    } catch (e) {
      this.logger.error(
        `Changement d'identifiant non tracé : ${(e as Error).message}`,
      )
    }
  }

  private async prevenir(
    utilisateurId: string,
    ancien: string,
    login: string,
    parAdmin: boolean,
  ): Promise<void> {
    try {
      await this.moduleRef
        .get(NotificationService, { strict: false })
        .emit({
          type: 'IDENTIFIANT_CHANGE',
          niveau: 'AVERTISSEMENT',
          category: 'systeme',
          titre: 'Votre identifiant a été modifié',
          message: parAdmin
            ? `Votre identifiant de connexion est maintenant « ${login} » (ancien : « ${ancien} »). Il a été modifié par un administrateur ; utilisez-le dès votre prochaine connexion.`
            : `Votre identifiant de connexion est maintenant « ${login} » (ancien : « ${ancien} »). Si ce n’est pas vous, prévenez immédiatement votre administrateur.`,
          destinataireId: utilisateurId,
          entiteType: 'utilisateur',
          entiteId: utilisateurId,
          lien: '/admin/parametres',
        })
    } catch {
      /* notification best-effort : ne défait jamais un changement fait */
    }
  }
}
