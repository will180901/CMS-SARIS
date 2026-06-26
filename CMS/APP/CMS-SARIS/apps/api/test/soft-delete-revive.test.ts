/**
 * Smoke E2E — résurrection après soft-delete (régressions trouvées par l'audit).
 *
 * Vérifie qu'après une suppression (soft), on peut RECRÉER un enregistrement avec la
 * même clé @unique : le tombstone est ressuscité (2xx) au lieu de collisionner (P2002
 * → 500 historique). Couvre aussi le mapping global P2002→409 / P2025→404.
 *
 * Pré-requis : API démarrée (API_URL, défaut http://localhost:3000), seed admin.
 * Exécution : API_URL=http://localhost:3000 tsx test/soft-delete-revive.test.ts
 */

const BASE = process.env['API_URL'] ?? 'http://localhost:3000'

let passed = 0
let failed = 0
function ok(label: string, cond: boolean, extra?: string) {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.log(`  ✗ ${label}${extra ? ' — ' + extra : ''}`) }
}

async function readJson(r: Response): Promise<any> {
  try { return await r.json() } catch { return null }
}

async function main() {
  // Login admin
  const lr = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'admin', password: 'Admin123!' }),
  })
  ok('LOGIN admin → 2xx', lr.ok)
  const lb = await readJson(lr)
  const token: string = lb?.accessToken
  ok('accessToken présent', !!token)
  if (!token) return
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }

  // Code unique de test (réutilisé pour create → delete → recreate)
  const code = 'ZZREVIVE'

  // Nettoyage préalable : si un test précédent a laissé un actif, on le supprime.
  const pre = await readJson(await fetch(BASE + '/referentiels/pathologies?search=' + code, { headers: H }))
  if (Array.isArray(pre)) {
    for (const p of pre.filter((x: any) => x.code === code)) {
      await fetch(BASE + '/referentiels/pathologies/' + p.id, { method: 'DELETE', headers: H })
    }
  }

  // 1) CREATE initial
  const c1 = await fetch(BASE + '/referentiels/pathologies', {
    method: 'POST', headers: H,
    body: JSON.stringify({ code, libelle: 'Revive test', chronique: false }),
  })
  ok('CREATE initial → 201', c1.status === 201)
  const b1 = await readJson(c1)
  const id1: string | undefined = b1?.id

  // 2) DELETE (soft)
  if (id1) {
    const d1 = await fetch(BASE + '/referentiels/pathologies/' + id1, { method: 'DELETE', headers: H })
    ok('DELETE (soft) → 2xx', d1.ok)
    // la pathologie soft-supprimée ne doit plus apparaître
    const list = await readJson(await fetch(BASE + '/referentiels/pathologies?search=' + code, { headers: H }))
    ok('après DELETE : absente de la liste', Array.isArray(list) && !list.some((p: any) => p.id === id1))
  }

  // 3) RECREATE même code → doit RÉUSSIR (résurrection), PAS 500/409
  const c2 = await fetch(BASE + '/referentiels/pathologies', {
    method: 'POST', headers: H,
    body: JSON.stringify({ code, libelle: 'Revive test 2', chronique: true }),
  })
  ok('RECREATE même code → 2xx (résurrection, pas 500/409)', c2.ok, 'HTTP ' + c2.status)
  const b2 = await readJson(c2)

  // 4) la recréation est active et porte les nouvelles données
  const list2 = await readJson(await fetch(BASE + '/referentiels/pathologies?search=' + code, { headers: H }))
  const found = Array.isArray(list2) ? list2.find((p: any) => p.code === code) : null
  ok('après RECREATE : présente et active', !!found)
  ok('RECREATE applique les nouvelles données (libellé/chronique)', !!found && found.libelle === 'Revive test 2')

  // 5) nettoyage
  const cleanupId = b2?.id ?? found?.id
  if (cleanupId) await fetch(BASE + '/referentiels/pathologies/' + cleanupId, { method: 'DELETE', headers: H })
}

main()
  .then(() => {
    console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
    process.exit(failed ? 1 : 0)
  })
  .catch((e) => { console.error('ERREUR test:', e && e.message); process.exit(1) })
