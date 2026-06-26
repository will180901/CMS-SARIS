/**
 * Test d'INTÉGRATION (HTTP) — « c'est le PREMIER message qui crée la conversation ».
 *
 * Prouve le correctif : ouvrir une conversation DIRECTE sans rien envoyer ne la fait
 * apparaître dans la liste de PERSONNE (ni l'émetteur, ni le destinataire) ; dès le
 * premier message, elle apparaît des DEUX côtés. + l'événement TYPING reste à 204.
 *
 * Lancer : packages/db/node_modules/.bin/tsx "<ABSPATH>/apps/api/test/conversation-firstmessage.test.ts"
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
async function listConvIds(token: string): Promise<string[]> {
  const r = await fetch(BASE + '/messagerie/conversations', { headers: { Authorization: 'Bearer ' + token } })
  const b = await r.json().catch(() => ([]))
  return Array.isArray(b) ? b.map((c: any) => c.id) : []
}

async function main(): Promise<void> {
  // Deux comptes de test du MÊME site, qui n'ont pas forcément déjà conversé.
  const U1 = await login('infirmier-delegue', 'Saris2026!')
  const U2 = await login('admin-medical', 'Saris2026!')
  ok('LOGIN U1 + U2 (comptes de test)', !!U1.token && !!U2.token)
  if (!U1.token || !U2.token) { console.log('  (login manquant — arrêt)'); return }
  ok('U1 et U2 sur le même site', U1.user?.siteId === U2.user?.siteId)

  // U1 OUVRE une conversation directe avec U2 (getOrCreateDirect) — sans message.
  const convR = await fetch(BASE + '/messagerie/conversations', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + U1.token },
    body: JSON.stringify({ destinataireId: U2.user.id }),
  })
  const convBody = await convR.json().catch(() => ({}))
  const convId: string | undefined = convBody.id
  ok('U1 ouvre une conversation avec U2 (id renvoyé)', !!convId)
  if (!convId) { console.log('  (ouverture échouée — arrêt)'); return }

  if (convBody.created === false) {
    console.log('  (conversation U1↔U2 déjà existante avec messages — test du filtre non concluant, on continue)')
  } else {
    await new Promise(r => setTimeout(r, 300))
    // CŒUR DU CORRECTIF : tant qu'aucun message n'est envoyé, la conversation
    // n'apparaît NI chez U1 NI chez U2.
    const u1Before = await listConvIds(U1.token)
    const u2Before = await listConvIds(U2.token)
    ok('AVANT 1er message : invisible chez l’ÉMETTEUR (U1)', !u1Before.includes(convId))
    ok('AVANT 1er message : invisible chez le DESTINATAIRE (U2)  ← bug corrigé', !u2Before.includes(convId))
  }

  // U1 envoie le PREMIER message (multipart, comme le frontend).
  const fd = new FormData()
  fd.append('contenu', 'Premier message — crée la conversation.')
  const sendR = await fetch(BASE + '/messagerie/conversations/' + convId + '/messages', {
    method: 'POST', headers: { Authorization: 'Bearer ' + U1.token }, body: fd,
  })
  ok('U1 envoie le 1er message → 201', sendR.status === 201)
  await new Promise(r => setTimeout(r, 400))

  // APRÈS le 1er message : visible des DEUX côtés.
  const u1After = await listConvIds(U1.token)
  const u2After = await listConvIds(U2.token)
  ok('APRÈS 1er message : visible chez U1', u1After.includes(convId))
  ok('APRÈS 1er message : visible chez U2', u2After.includes(convId))

  // TYPING reste fonctionnel (204).
  const typR = await fetch(BASE + '/messagerie/conversations/' + convId + '/typing', {
    method: 'POST', headers: { Authorization: 'Bearer ' + U1.token },
  })
  ok('TYPING : U1 « en train d’écrire » → 204', typR.status === 204)
}

main()
  .then(() => { console.log('\n' + passed + ' reussis, ' + failed + ' echoues'); process.exit(failed ? 1 : 0) })
  .catch((e) => { console.error('ERREUR test:', e && e.message); process.exit(1) })
