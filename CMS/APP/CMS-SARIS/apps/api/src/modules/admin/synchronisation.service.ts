/**
 * SynchronisationService — maintenance de la messagerie chiffrée.
 *
 * La sauvegarde / restauration de la configuration et la volumétrie (page « Base de
 * données ») ont été retirées : elles reviendront dans une prochaine version. Il ne
 * reste ici que la ré-encryption de la messagerie vers la clé courante, utile après
 * une rotation de clé.
 */

import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentKeyId, reencryptToCurrent } from '../../common/crypto/message-crypto'

@Injectable()
export class SynchronisationService {
  private readonly logger = new Logger('Synchronisation')
  constructor(private readonly prisma: PrismaService) {}

  // ── Ré-encryption des messages (nettoyage post-rotation de clé) ─────────────

  /**
   * Ré-encrypte les messages + pièces jointes chiffrés avec une ANCIENNE clé vers
   * la clé COURANTE. À lancer après une rotation pour pouvoir retirer l'ancienne
   * clé du trousseau. Opération NON destructive et idempotente : on ne ré-écrit
   * une ligne que si l'on a pu la déchiffrer ET qu'elle n'est pas déjà à jour.
   */
  async reencrypterMessages(acteurId: string | null) {
    const messages = await this.rechiffrerTable('message', 200)
    const pieces = await this.rechiffrerTable('messagePieceJointe', 25) // base64 volumineux → lots plus petits
    const resultat = {
      cleCourante: currentKeyId(),
      messages,
      pieces,
      rechiffres: messages.rechiffres + pieces.rechiffres,
    }
    this.logger.log(
      `Ré-encryption messagerie → clé ${resultat.cleCourante} : ${resultat.rechiffres} élément(s) mis à jour`,
    )
    await this.audit(acteurId, 'REENCRYPT', 'messagerie', resultat, 'SUCCES')
    return resultat
  }

  /** Parcourt une table (curseur par id) et ré-encrypte `contenuChiffre` vers la clé courante. */
  private async rechiffrerTable(
    table: 'message' | 'messagePieceJointe',
    lot: number,
  ) {
    const repo = (this.prisma as any)[table]
    let cursor: string | undefined
    let total = 0,
      rechiffres = 0,
      illisibles = 0
    for (;;) {
      const batch: { id: string; contenuChiffre: string }[] =
        await repo.findMany({
          take: lot,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          orderBy: { id: 'asc' },
          select: { id: true, contenuChiffre: true },
        })
      if (!batch.length) break
      for (const row of batch) {
        total++
        let next: string | null = null
        try {
          next = reencryptToCurrent(row.contenuChiffre)
        } catch {
          /* illisible : on ne touche pas */
        }
        if (next) {
          await repo.update({
            where: { id: row.id },
            data: { contenuChiffre: next },
          })
          rechiffres++
        } else if (!row.contenuChiffre.startsWith('v')) {
          illisibles++ // format inattendu (ni v1 ni v2) : laissé tel quel, signalé
        }
      }
      cursor = batch[batch.length - 1].id
      if (batch.length < lot) break
    }
    return { total, rechiffres, illisibles }
  }

  // ── Audit best-effort ───────────────────────────────────────────────────────

  private async audit(
    acteurId: string | null,
    action: string,
    entiteId: string,
    apresJson: unknown,
    statut: string,
  ) {
    try {
      await this.prisma.journalAudit.create({
        data: {
          utilisateurId: acteurId,
          action,
          module: 'synchronisation',
          entiteType: 'SauvegardeSysteme',
          entiteId,
          apresJson: apresJson as any,
          statut,
        },
      })
    } catch {
      /* best-effort */
    }
  }
}
