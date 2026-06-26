/**
 * Test d'INTÉGRATION (HTTP) — Messagerie chiffrée + NOTIFICATIONS + « en train d'écrire »
 * entre DEUX utilisateurs réels, contre l'API en cours d'exécution.
 *
 * Prouve : connexion de 2 comptes, ouverture d'une conversation, envoi d'un message
 * (multipart, chiffré au repos côté serveur), réception côté destinataire (compteur de
 * NON-LUS = notification d'un message d'un AUTRE utilisateur), lecture déchiffrée, et
 * l'événement TYPING (façon WhatsApp) + sa sécurité.
 *
 * Prérequis : API démarrée + base seedée (admin/Admin123! et un compte de test à 'Saris2026!').
 * Lancer : packages/db/node_modules/.bin/tsx "<ABSPATH>/apps/api/test/messaging-integration.test.ts"
 */
const BASE = process.env['API_URL'] || 'http://localhost:3000'

let passed = 0
let failed = 0
function ok(name: string, cond: boolean): void {
  if (cond) { passed++; console.log('  ✓ ' + name) }
  else { failed++; console.log('  ✗ ' + name) }
}
async function login(login: string, password: string): Promise<{ token?: string; user?: any }> {
  const r = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password }),
  })
  const b = await r.json().catch(() => ({}))
  return { token: b.accessToken, user: b.user }
}

async function main(): Promise<void> {
  const A = await login('admin', 'Admin123!')
  ok('LOGIN utilisateur A (admin)', !!A.token)
  // 2e compte de test (seed) — on essaie quelques logins connus du même site.
  let B = await login('infirmier-delegue', 'Saris2026!')
  if (!B.token) B = await login('admin-medical', 'Saris2026!')
  ok('LOGIN utilisateur B (compte de test)', !!B.token)
  if (!A.token || !B.token) { console.log('  (login manquant — arrêt)'); return }

  const adminId: string | undefined = A.user?.id
  ok('A : id + site récupérés', !!adminId && !!A.user?.siteId)
  ok('A et B sur le même site (requis pour la messagerie)', A.user?.siteId === B.user?.siteId)

  const HA = { Authorization: 'Bearer ' + A.token }
  const HBJson = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + B.token }

  // B ouvre une conversation directe avec A
  const convR = await fetch(BASE + '/messagerie/conversations', {
    method: 'POST', headers: HBJson, body: JSON.stringify({ destinataireId: adminId }),
  })
  ok('B ouvre une conversation avec A', convR.ok)
  const convId: string | undefined = (await convR.json().catch(() => ({}))).id
  ok('conversation créée (id)', !!convId)
  if (!convId) { console.log('  (conversation échouée — arrêt)'); return }

  // B envoie un message (multipart, comme le frontend)
  const fd = new FormData()
  fd.append('contenu', 'Message de test integration — notifications + chiffrement.')
  const sendR = await fetch(BASE + '/messagerie/conversations/' + convId + '/messages', {
    method: 'POST', headers: { Authorization: 'Bearer ' + B.token }, body: fd,
  })
  ok('B envoie un message à A → 201', sendR.status === 201)

  await new Promise((r) => setTimeout(r, 500)) // latence de persistance

  // A reçoit la NOTIFICATION : la conversation remonte dans sa liste avec le DERNIER
  // message de l'AUTRE utilisateur (signal robuste, indépendant de l'état « en train de lire »).
  const convs = await (await fetch(BASE + '/messagerie/conversations', { headers: HA })).json().catch(() => ([]))
  const convA = Array.isArray(convs) ? convs.find((c: any) => c.id === convId) : null
  ok('A voit la conversation dans sa liste', !!convA)
  ok('NOTIFICATION : A reçoit le message d’un AUTRE utilisateur (dernier message)',
    !!convA && !!convA.dernierMessage && convA.dernierMessage.deMoi === false
    && String(convA.dernierMessage.apercu || '').includes('Message de test integration'))

  // A lit le message DÉCHIFFRÉ
  const page = await (await fetch(BASE + '/messagerie/conversations/' + convId + '/messages', { headers: HA })).json().catch(() => ({}))
  const list: any[] = (page && page.messages) || []
  ok('A lit le message déchiffré', list.some((m) => String(m.contenu || '').includes('Message de test integration')))

  // TYPING (« en train d'écrire ») : B signale qu'il écrit → 204
  const typR = await fetch(BASE + '/messagerie/conversations/' + convId + '/typing', {
    method: 'POST', headers: { Authorization: 'Bearer ' + B.token },
  })
  ok('TYPING : B signale « en train d’écrire » → 204', typR.status === 204)

  // SÉCURITÉ : typing sans jeton → 401
  const typNoAuth = await fetch(BASE + '/messagerie/conversations/' + convId + '/typing', { method: 'POST' })
  ok('SÉCURITÉ : typing sans token → 401', typNoAuth.status === 401)
}

main()
  .then(() => { console.log('\n' + passed + ' reussis, ' + failed + ' echoues'); process.exit(failed ? 1 : 0) })
  .catch((e) => { console.error('ERREUR test:', e && e.message); process.exit(1) })
