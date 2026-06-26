/**
 * ParametresService — paramètres SYSTÈME (clé-valeur typée, appliqués pour de vrai).
 *
 * Principe : chaque paramètre du catalogue est RÉELLEMENT lu par le code métier
 * (sécurité, politique de mot de passe…). Pas de paramètre décoratif.
 *
 * Lecture mise en cache courte (évite un accès BDD à chaque login) ; le cache
 * est invalidé à chaque update/reset.
 */

import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

// ── Définition d'un paramètre ─────────────────────────────────────────────────

export interface ParametreOption { value: string; label: string }

export interface ParametreDef {
  cle:         string
  type:        'number' | 'boolean' | 'string' | 'duration_minutes' | 'enum'
  defaultVal:  string
  description: string
  group:       string
  min?:        number              // bornes (number / duration)
  max?:        number
  options?:    ParametreOption[]   // valeurs autorisées (enum)
}

/**
 * Clé de traduction STABLE d'un paramètre, dérivée de sa clé technique.
 * Le frontend l'utilise pour résoudre la description via i18n (`t(descriptionKey)`),
 * avec repli sur la `description` FR du catalogue si la clé n'est pas traduite.
 * @example 'mdp.longueur_min' → 'params.mdp.longueur_min'
 */
export function descriptionKeyFor(cle: string): string {
  return `params.${cle}`
}

// ── Catalogue — UNIQUEMENT des paramètres réellement appliqués ────────────────

export const PARAMETRES_CATALOGUE: ParametreDef[] = [
  // ── Sécurité & authentification (lues par SecurityService) ──
  {
    cle: 'auth.tentatives_max', type: 'number', defaultVal: '5', min: 3, max: 10,
    description: 'Tentatives de connexion échouées avant blocage automatique du compte',
    group: 'Sécurité & authentification',
  },
  {
    cle: 'auth.duree_blocage_minutes', type: 'duration_minutes', defaultVal: '15', min: 1, max: 1440,
    description: 'Durée du blocage initial après dépassement du seuil (minutes)',
    group: 'Sécurité & authentification',
  },
  {
    cle: 'auth.session_timeout_minutes', type: 'duration_minutes', defaultVal: '480', min: 5, max: 10080,
    description: 'Durée de validité d\'une session (token d\'accès) en minutes',
    group: 'Sécurité & authentification',
  },

  // ── Politique de mot de passe (appliquée à la création / reset / changement) ──
  {
    cle: 'mdp.longueur_min', type: 'number', defaultVal: '10', min: 8, max: 64,
    description: 'Longueur minimale exigée pour un mot de passe',
    group: 'Politique de mot de passe',
  },
  {
    cle: 'mdp.exiger_majuscule', type: 'boolean', defaultVal: 'true',
    description: 'Exiger au moins une lettre majuscule',
    group: 'Politique de mot de passe',
  },
  {
    cle: 'mdp.exiger_minuscule', type: 'boolean', defaultVal: 'true',
    description: 'Exiger au moins une lettre minuscule',
    group: 'Politique de mot de passe',
  },
  {
    cle: 'mdp.exiger_chiffre', type: 'boolean', defaultVal: 'true',
    description: 'Exiger au moins un chiffre',
    group: 'Politique de mot de passe',
  },
  {
    cle: 'mdp.exiger_special', type: 'boolean', defaultVal: 'false',
    description: 'Exiger au moins un caractère spécial (!@#$…)',
    group: 'Politique de mot de passe',
  },

  // ── Notifications (système) ──
  {
    cle: 'notif.app_enabled', type: 'boolean', defaultVal: 'true',
    description: 'Activer les notifications dans l\'application (cloche, temps réel)',
    group: 'Notifications',
  },
  {
    cle: 'notif.evenements_cliniques', type: 'boolean', defaultVal: 'true',
    description: 'Notifier les événements cliniques (visites, consultations, ordonnances, examens…) aux utilisateurs autorisés',
    group: 'Notifications',
  },
  {
    cle: 'notif.sorties_critiques', type: 'boolean', defaultVal: 'true',
    description: 'Notifier en priorité les sorties critiques (évacuations, accidents du travail)',
    group: 'Notifications',
  },
  {
    cle: 'notif.evenements_administratifs', type: 'boolean', defaultVal: 'true',
    description: 'Notifier les événements administratifs sensibles (comptes, rôles, permissions, paramètres) aux administrateurs',
    group: 'Notifications',
  },
  {
    cle: 'notif.retention_jours', type: 'number', defaultVal: '30', min: 7, max: 365,
    description: 'Durée de conservation des notifications (jours)',
    group: 'Notifications',
  },
]

const CATALOGUE_MAP = new Map(PARAMETRES_CATALOGUE.map(d => [d.cle, d]))

@Injectable()
export class ParametresService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Cache court (clé → { valeur, expire }) ──────────────────────────────────
  private cache = new Map<string, { valeur: string; expire: number }>()
  private readonly TTL_MS = 30_000

  private invalidate(cle?: string) {
    if (cle) this.cache.delete(cle)
    else this.cache.clear()
  }

  /** Valeur effective d'un paramètre (BDD sinon défaut), avec cache. */
  async getValue(cle: string): Promise<string> {
    const def = CATALOGUE_MAP.get(cle)
    const now = Date.now()
    const hit = this.cache.get(cle)
    if (hit && hit.expire > now) return hit.valeur

    const ligne = await this.prisma.parametreSysteme.findUnique({ where: { cle } })
    const valeur = ligne?.valeur ?? def?.defaultVal ?? ''
    this.cache.set(cle, { valeur, expire: now + this.TTL_MS })
    return valeur
  }

  async getNumber(cle: string): Promise<number> {
    const n = Number(await this.getValue(cle))
    return Number.isFinite(n) ? n : Number(CATALOGUE_MAP.get(cle)?.defaultVal ?? 0)
  }
  async getBool(cle: string): Promise<boolean> {
    return (await this.getValue(cle)) === 'true'
  }

  // ── API publique ────────────────────────────────────────────────────────────

  /** Tous les paramètres avec leur valeur effective + métadonnées. */
  async findAll() {
    const enBdd = await this.prisma.parametreSysteme.findMany()
    const map = new Map(enBdd.map(p => [p.cle, p]))

    return PARAMETRES_CATALOGUE.map(def => {
      const ligne = map.get(def.cle)
      return {
        cle:            def.cle,
        type:           def.type,
        group:          def.group,
        description:    def.description,
        descriptionKey: descriptionKeyFor(def.cle),
        valeur:         ligne?.valeur ?? def.defaultVal,
        defaultVal:     def.defaultVal,
        min:            def.min ?? null,
        max:            def.max ?? null,
        options:        def.options ?? null,
        modifie:        !!ligne,
        updatedAt:      ligne?.updatedAt ?? null,
        updatedBy:      ligne?.updatedBy ?? null,
      }
    })
  }

  /** Met à jour une valeur (validation par type + bornes). */
  async update(cle: string, valeur: string, acteurId: string | null) {
    const def = CATALOGUE_MAP.get(cle)
    if (!def) throw new BadRequestException(`Paramètre inconnu : ${cle}`)

    this.validate(def, valeur)

    const previous = await this.prisma.parametreSysteme.findUnique({ where: { cle } })
    const updated = await this.prisma.parametreSysteme.upsert({
      where:  { cle },
      update: { valeur, updatedBy: acteurId ?? null },
      create: { cle, valeur, description: def.description, updatedBy: acteurId ?? null },
    })
    this.invalidate(cle)

    try {
      await this.prisma.journalAudit.create({
        data: {
          utilisateurId: acteurId, action: 'UPDATE', module: 'parametre',
          entiteType: 'ParametreSysteme', entiteId: updated.id,
          avantJson: { cle, valeur: previous?.valeur ?? def.defaultVal },
          apresJson: { cle, valeur }, statut: 'SUCCES',
        },
      })
    } catch { /* l'audit ne bloque jamais */ }

    return updated
  }

  /** Réinitialise un paramètre à sa valeur par défaut. */
  async reset(cle: string, acteurId: string | null) {
    const def = CATALOGUE_MAP.get(cle)
    if (!def) throw new BadRequestException(`Paramètre inconnu : ${cle}`)

    await this.prisma.parametreSysteme.deleteMany({ where: { cle } })
    this.invalidate(cle)

    try {
      await this.prisma.journalAudit.create({
        data: {
          utilisateurId: acteurId, action: 'RESET', module: 'parametre',
          entiteType: 'ParametreSysteme', apresJson: { cle, valeur: def.defaultVal },
          statut: 'SUCCES',
        },
      })
    } catch { /* silent */ }

    return { success: true, valeur: def.defaultVal }
  }

  // ── Validation ────────────────────────────────────────────────────────────

  private validate(def: ParametreDef, valeur: string) {
    if (def.type === 'number' || def.type === 'duration_minutes') {
      const n = Number(valeur)
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        throw new BadRequestException('Valeur entière attendue')
      }
      if (def.min != null && n < def.min) throw new BadRequestException(`Valeur minimale : ${def.min}`)
      if (def.max != null && n > def.max) throw new BadRequestException(`Valeur maximale : ${def.max}`)
    } else if (def.type === 'boolean') {
      if (valeur !== 'true' && valeur !== 'false') {
        throw new BadRequestException('Valeur booléenne attendue (true/false)')
      }
    } else if (def.type === 'enum') {
      const ok = (def.options ?? []).some(o => o.value === valeur)
      if (!ok) throw new BadRequestException('Valeur non autorisée pour ce paramètre')
    } else {
      if (valeur.length > 200) throw new BadRequestException('Texte trop long (max 200)')
    }
  }

  // ── Politique de mot de passe (réellement appliquée) ────────────────────────

  /** Renvoie la politique de mot de passe effective. */
  async getPasswordPolicy() {
    return {
      longueurMin:     await this.getNumber('mdp.longueur_min'),
      exigerMajuscule: await this.getBool('mdp.exiger_majuscule'),
      exigerMinuscule: await this.getBool('mdp.exiger_minuscule'),
      exigerChiffre:   await this.getBool('mdp.exiger_chiffre'),
      exigerSpecial:   await this.getBool('mdp.exiger_special'),
    }
  }

  /** Valide un mot de passe contre la politique live. Lève 400 sinon. */
  async assertPasswordValid(mdp: string) {
    const p = await this.getPasswordPolicy()
    const fails: string[] = []
    if (mdp.length < p.longueurMin)                 fails.push(`au moins ${p.longueurMin} caractères`)
    if (p.exigerMajuscule && !/[A-Z]/.test(mdp))    fails.push('une majuscule')
    if (p.exigerMinuscule && !/[a-z]/.test(mdp))    fails.push('une minuscule')
    if (p.exigerChiffre   && !/\d/.test(mdp))        fails.push('un chiffre')
    if (p.exigerSpecial   && !/[^A-Za-z0-9]/.test(mdp)) fails.push('un caractère spécial')
    if (fails.length) {
      throw new BadRequestException(`Le mot de passe doit contenir : ${fails.join(', ')}.`)
    }
  }
}
