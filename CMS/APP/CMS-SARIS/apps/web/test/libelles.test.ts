/**
 * Tests PURS : chaque permission, chaque module et chaque rôle du catalogue a son libellé affiché
 * en FRANÇAIS ET en ANGLAIS.
 *   pnpm --filter web exec tsx test/libelles.test.ts
 *
 * Pourquoi : la base ne stocke pas de libellé, l'écran des rôles lit `labels.permission.<code>` ; sans
 * entrée, il affiche le code « humanisé » (« Systeme vidage », « Rapport delete »). Le 16/10/2026,
 * cinq permissions ajoutées au catalogue n'avaient aucun libellé : rien ne le signalait.
 */
import assert from 'node:assert/strict'
import {
  ALL_PERMISSIONS,
  PERMISSION_META,
  ROLE_CATALOG,
} from '../../../packages/types/src/permissions'
import { labels } from '../src/i18n/locales/modules/labels'

let passed = 0
let failed = 0
function test(name: string, fn: () => void): void {
  try {
    fn()
    passed++
    console.log('  ✓ ' + name)
  } catch (e) {
    failed++
    console.error('  ✗ ' + name + '\n     ' + (e as Error).message)
  }
}

type Dict = Record<string, string>
const L = {
  fr: labels.fr as unknown as { permission: Dict; module: Dict; role: Dict },
  en: labels.en as unknown as { permission: Dict; module: Dict; role: Dict },
}
const modules = [...new Set(ALL_PERMISSIONS.map((c) => PERMISSION_META[c].module))]

for (const lang of ['fr', 'en'] as const) {
  console.log(`\n[${lang}]`)
  test('chaque permission du catalogue a un libellé non vide', () => {
    const sans = ALL_PERMISSIONS.filter((c) => !L[lang].permission[c]?.trim())
    assert.deepEqual(sans, [], `sans libellé : ${sans.join(', ')}`)
  })
  test('aucun libellé pour une permission qui n’existe plus', () => {
    const obsoletes = Object.keys(L[lang].permission).filter((c) => !ALL_PERMISSIONS.includes(c as never))
    assert.deepEqual(obsoletes, [], `obsolètes : ${obsoletes.join(', ')}`)
  })
  test('chaque module du catalogue a un libellé', () => {
    const sans = modules.filter((m) => !L[lang].module[m]?.trim())
    assert.deepEqual(sans, [], `modules sans libellé : ${sans.join(', ')}`)
  })
  test('chaque rôle système a un libellé', () => {
    const sans = ROLE_CATALOG.map((r) => r.code).filter((c) => !L[lang].role[c]?.trim())
    assert.deepEqual(sans, [], `rôles sans libellé : ${sans.join(', ')}`)
  })
}

console.log('\n[fr/en]')
test('mêmes permissions libellées en français et en anglais', () => {
  assert.deepEqual(Object.keys(L.fr.permission).sort(), Object.keys(L.en.permission).sort())
})
test('le catalogue lui-même : un libellé non vide et un module égal au préfixe du code', () => {
  for (const c of ALL_PERMISSIONS) {
    assert.ok(PERMISSION_META[c].libelle.trim(), `libellé vide : ${c}`)
    assert.equal(PERMISSION_META[c].module, c.split('.')[0], `module ≠ préfixe : ${c}`)
  }
})
test('deux permissions n’ont jamais le même libellé (on ne pourrait plus les distinguer à l’écran)', () => {
  for (const lang of ['fr', 'en'] as const) {
    const vus = new Map<string, string>()
    for (const c of ALL_PERMISSIONS) {
      const l = L[lang].permission[c]!
      assert.ok(!vus.has(l), `[${lang}] « ${l} » : ${vus.get(l)} et ${c}`)
      vus.set(l, c)
    }
  }
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
