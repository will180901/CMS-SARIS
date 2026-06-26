/**
 * SynchronisationService — état du système, sauvegardes & restauration.
 *
 * Sauvegarde RÉELLE de la CONFIGURATION (périmètre sûr) :
 *   référentiels (sites, motifs, pathologies, médicaments, catégories, types
 *   d'examen) + matrice rôles→permissions + paramètres système.
 *
 * ⚠️ Les données CLINIQUES / patients ne sont JAMAIS incluses ni restaurées
 *    (intégrité + confidentialité). La restauration est NON destructive :
 *    elle ré-applique les valeurs du snapshot (upsert) sans supprimer les
 *    lignes créées depuis.
 *
 * Planification : sauvegarde automatique quotidienne + rétention (30 dernières).
 */

import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationService } from '../notification/notification.service'
import { currentKeyId, reencryptToCurrent } from '../../common/crypto/message-crypto'

const SNAPSHOT_VERSION = 1
const RETENTION_MAX = 30          // nombre de sauvegardes conservées
export const AUTO_BACKUP_CRON = CronExpression.EVERY_DAY_AT_2AM

// Tables de référentiel : snapshot/restauration générique par `id`.
const CONFIG_TABLES = [
  'site', 'categoriePatient', 'motifConsultation',
  'pathologieReference', 'medicamentReference', 'typeExamen',
  'parametreSysteme',
] as const

function stripMeta<T extends Record<string, any>>(row: T): Omit<T, 'createdAt' | 'updatedAt'> {
  const { createdAt, updatedAt, ...rest } = row as any
  return rest
}

@Injectable()
export class SynchronisationService {
  private readonly logger = new Logger('Synchronisation')
  constructor(
    private readonly prisma: PrismaService,
    private readonly notif: NotificationService,
  ) {}

  async getStatus() {
    const [
      utilisateurs, patients, visites, consultations,
      ordonnances, bonsExamen, evacuations,
      sites, personnel, totalAudit, totalAuth, derniereSauvegarde,
    ] = await Promise.all([
      this.prisma.utilisateur.count(),
      this.prisma.patient.count(),
      this.prisma.visite.count(),
      this.prisma.consultation.count(),
      this.prisma.ordonnance.count(),
      this.prisma.bonExamen.count(),
      this.prisma.evacuation.count(),
      this.prisma.site.count(),
      this.prisma.personnelMedical.count(),
      this.prisma.journalAudit.count(),
      this.prisma.journalAuthentification.count(),
      this.prisma.sauvegardeSysteme.findFirst({
        orderBy: { createdAt: 'desc' },
        select: SAUVEGARDE_SELECT,
      }),
    ])

    return {
      modules: [
        { module: 'utilisateurs',  count: utilisateurs },
        { module: 'sites',         count: sites },
        { module: 'personnel',     count: personnel },
        { module: 'patients',      count: patients },
        { module: 'visites',       count: visites },
        { module: 'consultations', count: consultations },
        { module: 'ordonnances',   count: ordonnances },
        { module: 'bons_examen',   count: bonsExamen },
        { module: 'evacuations',   count: evacuations },
      ],
      journaux: { audit: totalAudit, authentifications: totalAuth },
      derniereSauvegarde,
      // Planification automatique (informe l'UI). Données STRUCTURÉES pour que
      // l'UI compose la phrase traduite ; `expression` conservé pour compat.
      planification: {
        actif: true,
        frequence: 'DAILY' as const,
        heure: '02:00',
        expression: 'Tous les jours à 02h00',
        retention: RETENTION_MAX,
      },
    }
  }

  /** Historique (métadonnées uniquement — le contenu JSON n'est pas renvoyé en liste). */
  async findSauvegardes() {
    return this.prisma.sauvegardeSysteme.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: SAUVEGARDE_SELECT,
    })
  }

  // ── Construction du snapshot de configuration ──────────────────────────────

  private async buildSnapshot() {
    const data: Record<string, unknown> = {}
    for (const table of CONFIG_TABLES) {
      data[table] = await (this.prisma as any)[table].findMany()
    }
    // Rôles + leurs permissions (par code) — la matrice de gouvernance.
    const roles = await this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
    })
    data['roles'] = roles.map(r => ({
      code: r.code,
      libelle: r.libelle,
      permissions: r.permissions.map(rp => rp.permission.code),
    }))
    return { version: SNAPSHOT_VERSION, perimetre: 'CONFIGURATION', data }
  }

  /** Déclenche une sauvegarde réelle de la configuration. */
  async declencherSauvegarde(acteurId: string | null, type = 'MANUELLE') {
    const sauvegarde = await this.prisma.sauvegardeSysteme.create({
      data: { type, statut: 'EN_COURS', declenchePar: acteurId ?? null, perimetre: 'CONFIGURATION' },
    })

    try {
      const snapshot = await this.buildSnapshot()
      const contenuJson = JSON.stringify(snapshot)
      const updated = await this.prisma.sauvegardeSysteme.update({
        where: { id: sauvegarde.id },
        data: {
          statut: 'REUSSIE',
          contenuJson,
          taille: Buffer.byteLength(contenuJson, 'utf8'),
          finishedAt: new Date(),
        },
        select: SAUVEGARDE_SELECT,
      })
      await this.audit(acteurId, 'EXECUTE', sauvegarde.id, { type, statut: 'REUSSIE' }, 'SUCCES')
      await this.appliquerRetention()
      this.notif.broadcastLive('LIVE_SYNC') // rafraîchit l'écran Synchronisation en direct
      return updated
    } catch (e: any) {
      await this.prisma.sauvegardeSysteme.update({
        where: { id: sauvegarde.id },
        data: { statut: 'ECHEC', message: e?.message ?? 'Erreur inconnue', finishedAt: new Date() },
      }).catch(() => {})
      await this.audit(acteurId, 'EXECUTE', sauvegarde.id, { type, statut: 'ECHEC' }, 'ECHEC')
      throw new ConflictException('La sauvegarde a échoué : ' + (e?.message ?? 'erreur inconnue'))
    }
  }

  // ── Restauration ───────────────────────────────────────────────────────────

  /** Restaure la configuration depuis une sauvegarde (perm synchronisation.restore). */
  async restaurerSauvegarde(id: string, acteurId: string | null) {
    const sauvegarde = await this.prisma.sauvegardeSysteme.findUnique({ where: { id } })
    if (!sauvegarde) throw new NotFoundException('Sauvegarde introuvable')
    if (!sauvegarde.contenuJson) {
      throw new BadRequestException(
        'Cette sauvegarde ne contient pas de données restaurables (entrée historique sans contenu). Lancez une nouvelle sauvegarde.',
      )
    }

    let snapshot: { version: number; data: Record<string, any[]> }
    try {
      snapshot = JSON.parse(sauvegarde.contenuJson)
    } catch {
      throw new BadRequestException('Contenu de sauvegarde illisible (corrompu).')
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Référentiels + paramètres : upsert par id (ré-applique les valeurs).
      for (const table of CONFIG_TABLES) {
        const rows = snapshot.data[table] ?? []
        for (const row of rows) {
          const clean = stripMeta(row)
          const { id: rowId, ...vals } = clean as any
          await (tx as any)[table].upsert({ where: { id: rowId }, create: clean, update: vals })
        }
      }
      // 2. Matrice rôles → permissions (réinitialise par rôle existant, par code).
      for (const r of (snapshot.data['roles'] ?? [])) {
        const role = await tx.role.findUnique({ where: { code: r.code } })
        if (!role) continue
        await tx.rolePermission.deleteMany({ where: { roleId: role.id } })
        const perms = await tx.permission.findMany({ where: { code: { in: r.permissions ?? [] } } })
        if (perms.length > 0) {
          await tx.rolePermission.createMany({
            data: perms.map(p => ({ roleId: role.id, permissionId: p.id })),
          })
        }
      }
    }, { timeout: 30_000 })

    await this.audit(acteurId, 'RESTORE', id, { sauvegardeId: id }, 'SUCCES')
    // La restauration ré-applique référentiels + matrice rôles → rafraîchir en direct.
    this.notif.broadcastLive('LIVE_SYNC')
    this.notif.broadcastLive('LIVE_REFERENTIELS')
    return { id, restored: true }
  }

  // ── Ré-encryption des messages (nettoyage post-rotation de clé) ─────────────

  /**
   * Ré-encrypte les messages + pièces jointes chiffrés avec une ANCIENNE clé vers
   * la clé COURANTE. À lancer après une rotation pour pouvoir retirer l'ancienne
   * clé du trousseau. Opération NON destructive et idempotente : on ne ré-écrit
   * une ligne que si l'on a pu la déchiffrer ET qu'elle n'est pas déjà à jour.
   */
  async reencrypterMessages(acteurId: string | null) {
    const messages = await this.rechiffrerTable('message', 200)
    const pieces   = await this.rechiffrerTable('messagePieceJointe', 25) // base64 volumineux → lots plus petits
    const resultat = {
      cleCourante: currentKeyId(),
      messages, pieces,
      rechiffres: messages.rechiffres + pieces.rechiffres,
    }
    this.logger.log(`Ré-encryption messagerie → clé ${resultat.cleCourante} : ${resultat.rechiffres} élément(s) mis à jour`)
    await this.audit(acteurId, 'REENCRYPT', 'messagerie', resultat, 'SUCCES')
    return resultat
  }

  /** Parcourt une table (curseur par id) et ré-encrypte `contenuChiffre` vers la clé courante. */
  private async rechiffrerTable(table: 'message' | 'messagePieceJointe', lot: number) {
    const repo = (this.prisma as any)[table]
    let cursor: string | undefined
    let total = 0, rechiffres = 0, illisibles = 0
    for (;;) {
      const batch: { id: string; contenuChiffre: string }[] = await repo.findMany({
        take: lot,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        select: { id: true, contenuChiffre: true },
      })
      if (!batch.length) break
      for (const row of batch) {
        total++
        let next: string | null = null
        try { next = reencryptToCurrent(row.contenuChiffre) } catch { /* illisible : on ne touche pas */ }
        if (next) {
          await repo.update({ where: { id: row.id }, data: { contenuChiffre: next } })
          rechiffres++
        } else if (!row.contenuChiffre.startsWith('v')) {
          illisibles++ // format inattendu (ni v1 ni v2) : laissé tel quel, signalé
        }
      }
      cursor = batch[batch.length - 1]!.id
      if (batch.length < lot) break
    }
    return { total, rechiffres, illisibles }
  }

  // ── Planification automatique + rétention ──────────────────────────────────

  @Cron(AUTO_BACKUP_CRON, { name: 'sauvegarde-auto' })
  async sauvegardeAutomatique() {
    try {
      this.logger.log('Sauvegarde automatique quotidienne…')
      await this.declencherSauvegarde(null, 'AUTOMATIQUE')
    } catch (e: any) {
      this.logger.error('Échec sauvegarde automatique : ' + (e?.message ?? e))
    }
  }

  /** Conserve les RETENTION_MAX sauvegardes les plus récentes. */
  private async appliquerRetention() {
    const obsoletes = await this.prisma.sauvegardeSysteme.findMany({
      orderBy: { createdAt: 'desc' },
      skip: RETENTION_MAX,
      select: { id: true },
    })
    if (obsoletes.length > 0) {
      await this.prisma.sauvegardeSysteme.deleteMany({ where: { id: { in: obsoletes.map(o => o.id) } } })
    }
  }

  // ── Audit best-effort ───────────────────────────────────────────────────────

  private async audit(acteurId: string | null, action: string, entiteId: string, apresJson: unknown, statut: string) {
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
    } catch { /* best-effort */ }
  }
}

// Métadonnées renvoyées à l'UI (exclut le contenu JSON volumineux ; ajoute `restaurable`).
const SAUVEGARDE_SELECT = {
  id: true, type: true, statut: true, declenchePar: true, createdAt: true,
  perimetre: true, taille: true, finishedAt: true, message: true,
} as const
