/**
 * Test d'INTÉGRATION CRUD (HTTP) contre l'API en cours d'exécution.
 * Prouve la pile COMPLÈTE : contrôleur → guards (JWT + permissions) → DTO/validation →
 * service → Prisma → PostgreSQL. Contrairement aux tests purs, il tape la vraie API.
 *
 * Prérequis : API démarrée (http://localhost:3000) + base seedée (admin / Admin123!).
 * Lancer :   pnpm --filter @cms-saris/db exec tsx "<ABSPATH>/apps/api/test/crud-integration.test.ts"
 *
 * Couvre, sur le référentiel « pathologies » (CRUD représentatif, sans chaîne de FK) :
 * authentification, sécurité (401 sans token), création, lecture, mise à jour,
 * changement de statut, validation (400), suppression, et vérification de l'absence.
 */
const BASE = process.env['API_URL'] || 'http://localhost:3000'

let passed = 0
let failed = 0
function ok(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  ✓ ' + name) }
  else { failed++; console.log('  ✗ ' + name) }
}
async function readJson(r: Response): Promise<any> {
  try { return await r.json() } catch { return null }
}

async function main(): Promise<void> {
  // 1. LOGIN (controller → bcrypt → JWT)
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'admin', password: 'Admin123!' }),
  })
  ok('LOGIN admin → 2xx', login.ok)
  const lb = await readJson(login)
  const token: string | undefined = lb && lb.accessToken
  ok('LOGIN renvoie un accessToken', !!token)
  if (!token) { console.log('  (TOTP actif sur admin ? impossible de continuer)'); return }
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }

  // SÉCURITÉ : accès sans jeton → 401
  const noauth = await fetch(BASE + '/referentiels/pathologies')
  ok('SÉCURITÉ : sans token → 401', noauth.status === 401)

  const code = 'ITEST' + Math.floor(Math.random() * 1e7)
  // 2. CREATE
  const cre = await fetch(BASE + '/referentiels/pathologies', {
    method: 'POST', headers: H,
    body: JSON.stringify({ code, libelle: 'Test intégration CRUD', chronique: false }),
  })
  ok('CREATE pathologie → 201', cre.status === 201)
  const cb = await readJson(cre)
  const id: string | undefined = cb && cb.id
  ok('CREATE renvoie un id', !!id)
  if (!id) { console.log('  (création échouée, arrêt)'); return }

  // 3. READ (liste filtrée)
  const list = await fetch(BASE + '/referentiels/pathologies?search=' + code, { headers: H })
  const arr = await readJson(list)
  ok('READ : la liste contient la pathologie créée', Array.isArray(arr) && arr.some((p: any) => p.id === id))

  // 4. UPDATE
  const upd = await fetch(BASE + '/referentiels/pathologies/' + id, {
    method: 'PATCH', headers: H, body: JSON.stringify({ libelle: 'Test intégration MODIFIÉ' }),
  })
  ok('UPDATE → 2xx', upd.ok)
  const ub = await readJson(upd)
  ok('UPDATE applique le nouveau libellé', !!ub && ub.libelle === 'Test intégration MODIFIÉ')

  // 5. TOGGLE statut
  const tog = await fetch(BASE + '/referentiels/pathologies/' + id + '/statut', {
    method: 'PATCH', headers: H, body: JSON.stringify({ statut: 'INACTIF' }),
  })
  ok('TOGGLE statut → 2xx', tog.ok)

  // 6. VALIDATION : création sans le champ requis « code » → 400
  const bad = await fetch(BASE + '/referentiels/pathologies', {
    method: 'POST', headers: H, body: JSON.stringify({ libelle: 'sans code' }),
  })
  ok('VALIDATION : create sans code → 400', bad.status === 400)

  // 7. DELETE
  const del = await fetch(BASE + '/referentiels/pathologies/' + id, { method: 'DELETE', headers: H })
  ok('DELETE → 2xx', del.ok)

  // 8. Vérification : la pathologie n'apparaît plus
  const list2 = await fetch(BASE + '/referentiels/pathologies?search=' + code, { headers: H })
  const arr2 = await readJson(list2)
  ok('DELETE : la pathologie n’apparaît plus', Array.isArray(arr2) && !arr2.some((p: any) => p.id === id))

  // ── MODULE CLINIQUE : PATIENTS (CRUD complet avec FK site + catégorie) ──────
  const sites = await readJson(await fetch(BASE + '/referentiels/sites', { headers: H }))
  const cats = await readJson(await fetch(BASE + '/referentiels/categories-patient', { headers: H }))
  const siteId = Array.isArray(sites) && sites[0] ? sites[0].id : null
  const catId = Array.isArray(cats) && cats[0] ? cats[0].id : null
  ok('PATIENTS : site + catégorie de référence disponibles', !!siteId && !!catId)
  if (siteId && catId) {
    const pcre = await fetch(BASE + '/patients', {
      method: 'POST', headers: H,
      body: JSON.stringify({
        nom: 'ZZTEST', prenom: 'Integration', dateNaissance: '1990-01-01', sexe: 'M',
        categoriePatientId: catId, siteCreationId: siteId,
      }),
    })
    ok('PATIENT CREATE → 201', pcre.status === 201)
    const pb = await readJson(pcre)
    const pid: string | undefined = pb && pb.id
    ok('PATIENT CREATE renvoie un id', !!pid)
    if (pid) {
      const pget = await readJson(await fetch(BASE + '/patients/' + pid, { headers: H }))
      ok('PATIENT READ → identité correcte', !!pget && JSON.stringify(pget).includes('ZZTEST'))
      const pupd = await fetch(BASE + '/patients/' + pid + '/identite', {
        method: 'PATCH', headers: H, body: JSON.stringify({ nom: 'ZZTESTMOD' }),
      })
      ok('PATIENT UPDATE identité → 2xx', pupd.ok)
      const pdel = await fetch(BASE + '/patients/' + pid, { method: 'DELETE', headers: H })
      ok('PATIENT DELETE (409-safe) → 2xx', pdel.ok)
      const pget2 = await fetch(BASE + '/patients/' + pid, { headers: H })
      ok('PATIENT DELETE : 404 ensuite', pget2.status === 404)
    }
  }
}

main()
  .then(() => {
    console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
    process.exit(failed ? 1 : 0)
  })
  .catch((e) => { console.error('ERREUR test:', e && e.message); process.exit(1) })
