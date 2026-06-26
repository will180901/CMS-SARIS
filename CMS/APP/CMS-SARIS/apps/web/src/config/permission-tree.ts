/**
 * permission-tree.ts — Hiérarchisation des permissions pour un affichage clair.
 *
 * Les codes suivent la convention `module.action` ou `module.sousentite.action` :
 *   - patient.update                  → module=patient,   sous=∅,     action=update
 *   - referentiel.site.create         → module=referentiel, sous=site, action=create
 *   - patient.rattachement.manage     → module=patient,   sous=rattachement, action=manage
 *
 * On construit un arbre Module → Sous-section → actions pour que les permissions
 * d'un même service (Sites, Motifs…) ne soient plus mélangées en vrac.
 */

import { labelModule } from './labels'
import type { PermissionCode } from '@cms-saris/types'

export interface PermLeaf {
  code:   PermissionCode
  action: string
}
export interface PermSubGroup {
  /** clé stable : `module` (général) ou `module.sous` */
  key:    string
  /** sous-entité (`site`, `rattachement`…) ou null pour le groupe général */
  sub:    string | null
  label:  string
  leaves: PermLeaf[]
  codes:  PermissionCode[]
}
export interface PermModuleNode {
  module:    string
  label:     string
  subgroups: PermSubGroup[]
  codes:     PermissionCode[]
}

interface RawPerm { code: string; module: string }

// ── Parsing ────────────────────────────────────────────────────────────────────

export function parsePermCode(code: string): { module: string; sub: string | null; action: string } {
  const parts = code.split('.')
  if (parts.length >= 3) return { module: parts[0]!, sub: parts[1]!, action: parts.slice(2).join('.') }
  return { module: parts[0]!, sub: null, action: parts[1] ?? '' }
}

// ── Libellés courts des actions ────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  read:            'Consulter',
  create:          'Créer',
  update:          'Modifier',
  delete:          'Désactiver',
  manage:          'Gérer',
  validate:        'Valider',
  revoke:          'Révoquer',
  print:           'Imprimer',
  close:           'Clôturer',
  cancel:          'Annuler',
  archive:         'Archiver',
  merge:           'Fusionner',
  diagnose:        'Diagnostiquer',
  examen:          'Examen clinique',
  result:          'Saisir un résultat',
  execute:         'Exécuter',
  assign_role:     'Attribuer des rôles',
  reset_password:  'Réinitialiser le mot de passe',
  manage_permissions: 'Gérer les dérogations',
  change_category: 'Changer la catégorie',
  assign_soignant: 'Assigner un soignant',
}

function humanize(s: string): string {
  const t = s.replace(/[_.]/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function labelPermAction(action: string): string {
  return ACTION_LABELS[action] ?? humanize(action)
}

// ── Libellés des sous-sections ─────────────────────────────────────────────────

const SUBGROUP_LABELS: Record<string, string> = {
  'referentiel.site':         'Sites',
  'referentiel.motif':        'Motifs de consultation',
  'referentiel.pathologie':   'Pathologies',
  'referentiel.medicament':   'Médicaments',
  'referentiel.categorie':    'Catégories de patient',
  'referentiel.examen':       'Types d\'examen',
  'patient.rattachement':     'Rattachements (CDI / sous-traitants)',
}

export function labelSubGroup(module: string, sub: string): string {
  return SUBGROUP_LABELS[`${module}.${sub}`] ?? humanize(sub)
}

/** Libellé du groupe « général » (permissions sans sous-entité) d'un module. */
export function labelGeneral(module: string): string {
  return `${labelModule(module)} — général`
}

// ── Construction de l'arbre ─────────────────────────────────────────────────────

const GENERAL_KEY = '__general__'

/**
 * Construit l'arbre Module → Sous-section → actions.
 * Les permissions 2-segments (module.action) vont dans un sous-groupe « général ».
 * Les modules sont triés par libellé ; à l'intérieur, le groupe général d'abord,
 * puis les sous-sections par ordre alphabétique de libellé.
 */
export function buildPermissionTree(perms: RawPerm[]): PermModuleNode[] {
  const byModule = new Map<string, RawPerm[]>()
  for (const p of perms) {
    const arr = byModule.get(p.module) ?? []
    arr.push(p)
    byModule.set(p.module, arr)
  }

  const nodes: PermModuleNode[] = []
  for (const [module, list] of byModule) {
    const subMap = new Map<string, PermLeaf[]>()
    for (const p of list) {
      const { sub, action } = parsePermCode(p.code)
      const key = sub ?? GENERAL_KEY
      const arr = subMap.get(key) ?? []
      arr.push({ code: p.code as PermissionCode, action })
      subMap.set(key, arr)
    }

    const subgroups: PermSubGroup[] = [...subMap.entries()].map(([key, leaves]) => {
      const sub = key === GENERAL_KEY ? null : key
      return {
        key:    key === GENERAL_KEY ? module : `${module}.${key}`,
        sub,
        label:  sub ? labelSubGroup(module, sub) : labelGeneral(module),
        leaves: leaves.sort((a, b) => a.action.localeCompare(b.action)),
        codes:  leaves.map(l => l.code),
      }
    }).sort((a, b) => {
      // Groupe général en premier, puis tri alphabétique
      if (a.sub === null) return -1
      if (b.sub === null) return 1
      return a.label.localeCompare(b.label)
    })

    nodes.push({
      module,
      label: labelModule(module),
      subgroups,
      codes: list.map(p => p.code as PermissionCode),
    })
  }

  return nodes.sort((a, b) => a.label.localeCompare(b.label))
}
