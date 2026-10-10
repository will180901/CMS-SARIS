/**
 * Messagerie interne entre deux personnes (chantier 7, étape 6 — reprise des anciens
 * tests d'intégration `messaging-integration` et `conversation-firstmessage`, qui
 * tapaient la base de DÉVELOPPEMENT avec des mots de passe écrits en dur).
 *
 *  - ouvrir une conversation sans rien envoyer ne la montre à PERSONNE ; le premier
 *    message la fait apparaître des deux côtés ;
 *  - le destinataire voit le message d'un autre (dernier message, non-lus) et le lit en
 *    clair, alors qu'il est CHIFFRÉ dans la base ;
 *  - rouvrir la même conversation ne la duplique pas ; un tiers ne la lit pas ;
 *  - « en train d'écrire » fonctionne, et pas sans être connecté.
 */
import { PrismaClient } from '@prisma/client'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { demarrerApp } from './support/app-test'
import { COMPTES, appelAnonyme, connecter, type Client } from './support/client'

interface Conversation {
  id: string
  created?: boolean
  dernierMessage?: { deMoi: boolean; apercu: string | null } | null
}

describe('Messagerie interne entre deux personnes', () => {
  let app: NestExpressApplication
  let base: PrismaClient
  /** Deux comptes qui ne servent à la messagerie dans aucun autre fichier de test. */
  let a: Client
  let b: Client
  let tiers: Client
  let conversationId: string
  const texte = `Message de test ${Date.now() % 100_000} — chiffré au repos`

  const conversationsDe = async (c: Client) =>
    (await c.get<Conversation[]>('/messagerie/conversations')).body

  beforeAll(async () => {
    app = await demarrerApp()
    base = new PrismaClient()
    a = await connecter(app, COMPTES.infirmierSansDelegation)
    b = await connecter(app, COMPTES.autreMedecin)
    tiers = await connecter(app, COMPTES.infirmier)
  })
  afterAll(async () => {
    await base.$disconnect()
    await app.close()
  })

  it('ouvrir une conversation sans rien envoyer ne la montre à personne', async () => {
    const r = await b.post<Conversation>('/messagerie/conversations', {
      destinataireId: a.user.id,
    })
    expect(r.status).toBe(200)
    expect(r.body.created).toBe(true)
    conversationId = r.body.id
    expect((await conversationsDe(b)).map((c) => c.id)).not.toContain(
      conversationId,
    )
    expect((await conversationsDe(a)).map((c) => c.id)).not.toContain(
      conversationId,
    )
  })

  it('le premier message la fait apparaître des deux côtés', async () => {
    const r = await b.formulaire(
      `/messagerie/conversations/${conversationId}/messages`,
      { contenu: texte },
    )
    expect(r.status).toBe(201)
    expect((await conversationsDe(b)).map((c) => c.id)).toContain(
      conversationId,
    )
    const chezA = (await conversationsDe(a)).find(
      (c) => c.id === conversationId,
    )
    expect(chezA?.dernierMessage).toMatchObject({ deMoi: false })
    expect(chezA?.dernierMessage?.apercu).toContain('Message de test')
  })

  it('le destinataire est prévenu (non-lus) et lit le message en clair', async () => {
    const nonLus = await a.get<{ count: number }>('/messagerie/unread-count')
    expect(nonLus.body.count).toBeGreaterThanOrEqual(1)
    const page = await a.get<{ messages: { contenu: string | null }[] }>(
      `/messagerie/conversations/${conversationId}/messages`,
    )
    expect(page.status).toBe(200)
    expect(page.body.messages.map((m) => m.contenu)).toContain(texte)
  })

  it('dans la base, le message est chiffré', async () => {
    const lignes = await base.message.findMany({
      where: { conversationId },
      select: { contenuChiffre: true },
    })
    expect(lignes).toHaveLength(1)
    expect(lignes[0].contenuChiffre).not.toContain('Message de test')
    expect(lignes[0].contenuChiffre).toMatch(/^v\d:/)
  })

  it('rouvrir la conversation ne la duplique pas ; un tiers ne la lit pas', async () => {
    const r = await a.post<Conversation>('/messagerie/conversations', {
      destinataireId: b.user.id,
    })
    expect(r.body).toMatchObject({ id: conversationId, created: false })
    const intrus = await tiers.get(
      `/messagerie/conversations/${conversationId}/messages`,
    )
    expect([403, 404]).toContain(intrus.status)
  })

  it('« en train d’écrire » : signalé par un participant, refusé sans connexion', async () => {
    const url = `/messagerie/conversations/${conversationId}/typing`
    expect((await b.post(url)).status).toBe(204)
    expect((await appelAnonyme(app, 'post', url)).status).toBe(401)
  })
})
