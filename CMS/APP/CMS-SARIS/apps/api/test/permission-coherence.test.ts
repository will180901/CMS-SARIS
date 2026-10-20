/**
 * Tests PURS : l'API ne peut pas importer de VALEUR du paquet partagé (`@cms-saris/types`), elle en
 * garde donc des COPIES (règle « écrire implique consulter », rôles système, permissions vitales).
 * Ce fichier garantit que ces copies restent IDENTIQUES au paquet — et que les droits par défaut des
 * trois rôles système sont cohérents avec le catalogue.
 *   pnpm --filter api exec tsx test/permission-coherence.test.ts
 */
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_LECTURES_IMPLIQUEES,
  PERMISSION_META,
  ROLE_CATALOG,
  SYSTEM_ROLES,
  completerLectures as completerLecturesPaquet,
  completerRevocations as completerRevocationsPaquet,
  lecturesManquantes as lecturesManquantesPaquet,
} from '../../../packages/types/src/permissions'
import {
  chaineDeLectures,
  completerLectures,
  completerRevocations,
  lecturesManquantes,
} from '../src/common/permission-coherence'
import { VITAL_GOVERNANCE_PERMISSIONS } from '../src/common/governance'

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
const catalogue = new Set<string>(ALL_PERMISSIONS)
const trie = (xs: readonly string[]) => [...xs].sort()

console.log('la règle « écrire implique consulter » : copie de l’API = paquet')
test('la chaîne de lectures impliquées est identique pour CHACUN des codes du catalogue', () => {
  for (const c of ALL_PERMISSIONS) {
    assert.deepEqual(trie(chaineDeLectures(c, catalogue)), trie(PERMISSION_LECTURES_IMPLIQUEES[c]), c)
  }
})
test('compléter une sélection par les lectures qu’elle implique : même résultat', () => {
  const echantillons: string[][] = [
    ['ordonnance.create'],
    ['referentiel.site.create'],
    ['patient.rattachement.manage', 'bon_pharmacie.deliver'],
    ['systeme.vidage'],
    ALL_PERMISSIONS.filter((_, i) => i % 3 === 0),
    ALL_PERMISSIONS.filter((_, i) => i % 7 === 0),
  ]
  for (const e of echantillons) {
    assert.deepEqual(trie(completerLectures(e, catalogue)), trie(completerLecturesPaquet(e)))
    assert.deepEqual(trie(lecturesManquantes(e, catalogue)), trie(lecturesManquantesPaquet(e)))
  }
})
test('retirer une lecture retire ce qui en dépend : même résultat', () => {
  for (const e of [['patient.read'], ['referentiel.read'], ['consultation.read', 'ordonnance.read']]) {
    assert.deepEqual(trie(completerRevocations(e, catalogue)), trie(completerRevocationsPaquet(e)))
  }
})
test('une écriture implique bien sa lecture (exemples)', () => {
  assert.deepEqual(completerLectures(['ordonnance.create'], catalogue).sort(), ['ordonnance.create', 'ordonnance.read'])
  assert.ok(completerLectures(['referentiel.site.create'], catalogue).includes('referentiel.site.read'))
  assert.ok(completerLectures(['referentiel.site.create'], catalogue).includes('referentiel.read'))
})

console.log('\nles trois rôles système')
test('la liste des rôles système de roles.service est la même que celle du paquet', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/modules/admin/roles.service.ts'), 'utf8')
  const m = source.match(/const SYSTEM_ROLES = \[([^\]]*)\]/)
  assert.ok(m, 'SYSTEM_ROLES introuvable dans roles.service.ts')
  const copie = m![1]!.split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean)
  assert.deepEqual(trie(copie), trie(SYSTEM_ROLES))
  assert.deepEqual(trie(ROLE_CATALOG.map((r) => r.code)), trie(SYSTEM_ROLES))
})
test('chaque rôle système a des droits par défaut, tous dans le catalogue, sans doublon', () => {
  for (const r of SYSTEM_ROLES) {
    const p = DEFAULT_ROLE_PERMISSIONS[r]
    assert.ok(p && p.length > 0, `${r} sans droits`)
    assert.equal(new Set(p).size, p.length, `${r} : doublons`)
    assert.deepEqual(p.filter((c) => !catalogue.has(c)), [], `${r} : codes hors catalogue`)
  }
})
test('aucun droit par défaut n’est « mort » : toute écriture accordée a sa lecture', () => {
  for (const r of SYSTEM_ROLES) {
    assert.deepEqual(lecturesManquantes(DEFAULT_ROLE_PERMISSIONS[r]!, catalogue), [], r)
  }
})
test('l’administrateur système a TOUT le catalogue', () => {
  assert.deepEqual(trie(DEFAULT_ROLE_PERMISSIONS['ADMIN_SYSTEME']!), trie(ALL_PERMISSIONS))
})
test('la charte : l’infirmier n’a rien que le médecin chef n’ait pas, et le médecin chef rien que l’administrateur n’ait pas', () => {
  const med = new Set(DEFAULT_ROLE_PERMISSIONS['MEDECIN_CHEF'])
  const adm = new Set(DEFAULT_ROLE_PERMISSIONS['ADMIN_SYSTEME'])
  assert.deepEqual(DEFAULT_ROLE_PERMISSIONS['INFIRMIER']!.filter((c) => !med.has(c)), [])
  assert.deepEqual(DEFAULT_ROLE_PERMISSIONS['MEDECIN_CHEF']!.filter((c) => !adm.has(c)), [])
})
test('seul l’administrateur système gère les comptes, les rôles et le système', () => {
  const gouvernance = ALL_PERMISSIONS.filter((c) => /^(utilisateur|role|systeme|parametre|synchronisation)\./.test(c))
  for (const r of ['MEDECIN_CHEF', 'INFIRMIER']) {
    const a = gouvernance.filter((c) => DEFAULT_ROLE_PERMISSIONS[r]!.includes(c))
    assert.deepEqual(a, [], `${r} possède : ${a.join(', ')}`)
  }
})

console.log('\nles permissions vitales (garde-fou anti auto-blocage)')
test('toutes existent dans le catalogue et l’administrateur système les possède', () => {
  for (const c of VITAL_GOVERNANCE_PERMISSIONS) {
    assert.ok(catalogue.has(c), `hors catalogue : ${c}`)
    assert.ok(DEFAULT_ROLE_PERMISSIONS['ADMIN_SYSTEME']!.includes(c as never), `absente de l’admin : ${c}`)
  }
})
test('elles couvrent la gestion des rôles ET des comptes', () => {
  for (const c of ['role.read', 'role.update', 'utilisateur.update', 'utilisateur.assign_role', 'utilisateur.manage_permissions']) {
    assert.ok(VITAL_GOVERNANCE_PERMISSIONS.includes(c), c)
  }
})

console.log('\nle catalogue')
test('132 permissions au moins, uniques, chacune dans un module égal à son préfixe', () => {
  assert.ok(ALL_PERMISSIONS.length >= 132)
  assert.equal(new Set(ALL_PERMISSIONS).size, ALL_PERMISSIONS.length)
  for (const c of ALL_PERMISSIONS) assert.equal(PERMISSION_META[c].module, c.split('.')[0], c)
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
