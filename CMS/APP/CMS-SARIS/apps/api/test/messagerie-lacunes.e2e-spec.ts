/**
 * Messagerie : conduite d'une vraie messagerie, à la façon de WhatsApp — les lacunes relevées
 * à la relecture critique du 2026-10-21, une par une. Chaque test décrit ce que ferait
 * WhatsApp ; avant les corrections, ils échouaient.
 *
 *  1. supprimer une conversation directe = la supprimer POUR SOI ;
 *  2. un seul fil direct par paire, même ouvert en même temps par les deux ;
 *  3. un nouveau membre d'un groupe ne voit pas l'historique d'avant son arrivée ;
 *  4. la lecture se déclare, message par message : un message arrivé en retard reste non lu ;
 *  5. la synchronisation de la messagerie est globale et propage les départs de groupe ;
 *  6. modification diffusée, envoi sans doublon, compte désactivé, transfert, pagination ;
 *  7. liste (aperçu, non-lus), recherche, archivage, favoris.
 */
import * as bcrypt from 'bcrypt'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import { encryptMessage } from '../src/common/crypto/message-crypto'
import { SYNC_MODELS } from '../src/modules/sync/sync-models'
import { SyncService } from '../src/modules/sync/sync.service'
import { NotificationService } from '../src/modules/notification/notification.service'
import { PresenceService } from '../src/modules/notification/presence.service'

interface Conversation {
  id: string
  type: string
  nonLus: number
  archivee: boolean
  dernierMessage?: { apercu: string | null; supprime: boolean } | null
  interlocuteur?: { actif: boolean } | null
}
interface Message {
  id: string
  contenu: string
  deMoi: boolean
  luPar: number
  vu: boolean
  nonLu: boolean
  favori: boolean
  supprime: boolean
  createdAt: string
}

describe('Messagerie : conduite d’une vraie messagerie (lacunes corrigées)', () => {
  let app: NestExpressApplication
  const s = `${Date.now() % 100_000}`
  const MDP = 'Messagerie-2026!'
  const logins: string[] = []
  const matricules: string[] = []
  const base = () => baseDe(app)

  /** Un compte infirmier neuf (mot de passe connu), connecté. */
  const compte = async (nom: string): Promise<Client> => {
    const login = `msg.${nom}${s}`
    logins.push(login)
    const admin = await connecter(app, COMPTES.admin)
    const role = await base().role.findFirstOrThrow({ where: { code: 'INFIRMIER' } })
    const matricule = `MS-${nom.toUpperCase()}${s}`
    matricules.push(matricule)
    const r = await admin.post<{ id: string }>('/admin/utilisateurs', {
      login,
      email: `${login}@test.local`,
      roleIds: [role.id],
      nom: `Msg${nom}`,
      prenom: 'Essai',
      matricule,
    })
    expect(r.status).toBe(201)
    await base().raw.utilisateur.update({
      where: { id: r.body.id },
      data: { passwordHash: await bcrypt.hash(MDP, 4), motDePasseTemp: false },
    })
    return connecter(app, { login, motDePasse: MDP })
  }

  const ouvrir = async (de: Client, vers: Client) =>
    (await de.post<{ id: string; created: boolean }>('/messagerie/conversations', { destinataireId: vers.user.id })).body
  const ecrire = async (de: Client, conv: string, contenu: string, extra: Record<string, string> = {}) => {
    const r = await de.formulaire<{ id: string; createdAt: string }>(`/messagerie/conversations/${conv}/messages`, { contenu, ...extra })
    expect(r.status).toBe(201)
    return r.body
  }
  const liste = async (c: Client) => (await c.get<Conversation[]>('/messagerie/conversations')).body
  const fil = async (c: Client, conv: string, avant = '') =>
    (await c.get<{ messages: Message[]; hasMore: boolean }>(`/messagerie/conversations/${conv}/messages${avant ? `?before=${encodeURIComponent(avant)}` : ''}`)).body
  const lire = (c: Client, conv: string, messageIds: string[] = []) =>
    c.post<{ lus: number; nonLus: number }>(`/messagerie/conversations/${conv}/lire`, { messageIds })
  const nonLusDe = async (c: Client, conv: string) => (await liste(c)).find((x) => x.id === conv)?.nonLus ?? 0
  const groupe = async (createur: Client, membres: Client[], titre = `Groupe ${s}`) => {
    const r = await createur.post<{ id: string }>('/messagerie/groupes', { titre, participantIds: membres.map((m) => m.user.id) })
    expect(r.status).toBe(201)
    return r.body.id
  }

  beforeAll(async () => {
    app = await demarrerApp()
  })
  afterAll(async () => {
    const users = await base().raw.utilisateur.findMany({ where: { login: { in: logins } }, select: { id: true } })
    const ids = users.map((u) => u.id)
    const convs = await base().raw.conversationParticipant.findMany({ where: { utilisateurId: { in: ids } }, select: { conversationId: true } })
    const cids = [...new Set(convs.map((c) => c.conversationId))]
    const msgs = await base().raw.message.findMany({ where: { conversationId: { in: cids } }, select: { id: true } })
    const mids = msgs.map((m) => m.id)
    await base().raw.messageLecture.deleteMany({ where: { messageId: { in: mids } } })
    await base().raw.messageFavori.deleteMany({ where: { messageId: { in: mids } } })
    await base().raw.messageMasque.deleteMany({ where: { messageId: { in: mids } } })
    await base().raw.message.deleteMany({ where: { conversationId: { in: cids } } })
    await base().raw.conversationParticipant.deleteMany({ where: { conversationId: { in: cids } } })
    await base().raw.conversation.deleteMany({ where: { id: { in: cids } } })
    await base().raw.notification.deleteMany({ where: { OR: [{ destinataireId: { in: ids } }, { createdById: { in: ids } }] } })
    await base().raw.sessionUtilisateur.deleteMany({ where: { utilisateurId: { in: ids } } })
    await base().raw.journalAuthentification.deleteMany({ where: { login: { in: logins } } })
    await base().raw.journalAudit.deleteMany({ where: { OR: [{ utilisateurId: { in: ids } }, { entiteId: { in: ids } }] } })
    await base().raw.utilisateurRole.deleteMany({ where: { utilisateurId: { in: ids } } })
    await base().raw.utilisateur.deleteMany({ where: { id: { in: ids } } })
    await base().raw.personnelMedical.deleteMany({ where: { matricule: { in: matricules } } })
    await app.close()
  })

  // ── 1. Supprimer une conversation directe ────────────────────────────────────
  describe('1. supprimer une conversation directe', () => {
    let a: Client, b: Client, conv: string
    beforeAll(async () => {
      a = await compte('a1')
      b = await compte('b1')
      conv = (await ouvrir(a, b)).id
      await ecrire(a, conv, 'avant la suppression')
    })

    it('la supprimer chez soi ne la retire pas à l’autre', async () => {
      expect((await b.post(`/messagerie/conversations/${conv}/quitter`, {})).status).toBeLessThan(300)
      expect((await liste(a)).map((c) => c.id)).toContain(conv)
      expect((await liste(b)).map((c) => c.id)).not.toContain(conv)
    })

    it('un nouveau message de l’autre la fait revenir, avec les seuls nouveaux messages', async () => {
      await ecrire(a, conv, 'après la suppression')
      const chezB = (await liste(b)).find((c) => c.id === conv)
      expect(chezB).toBeDefined()
      expect(chezB!.nonLus).toBe(1)
      expect((await fil(b, conv)).messages.map((m) => m.contenu)).toEqual(['après la suppression'])
    })

    it('rouvrir la discussion donne le MÊME fil, jamais un second', async () => {
      const r = await ouvrir(b, a)
      expect(r.id).toBe(conv)
      expect(r.created).toBe(false)
      expect((await liste(a)).filter((c) => c.type === 'DIRECT')).toHaveLength(1)
    })

    it('ses propres messages d’avant la suppression restent chez l’autre, intacts', async () => {
      const chezA = (await fil(a, conv)).messages.map((m) => m.contenu)
      expect(chezA).toEqual(['avant la suppression', 'après la suppression'])
    })

    it('une ancienne conversation « abandonnée » (la ligne de l’autre a été retirée) est reprise', async () => {
      const c = await compte('c1')
      const d = await compte('d1')
      // Reproduit l'ancien comportement : conversation ancienne (identifiant aléatoire), d a vu sa
      // ligne de participation DÉTRUITE ; c continuait d'y écrire sans que personne ne reçoive rien.
      const ancienne = await base().raw.conversation.create({
        data: {
          type: 'DIRECT',
          createdById: d.user.id,
          participants: { create: [{ utilisateurId: c.user.id }, { utilisateurId: d.user.id }] },
        },
      })
      await base().raw.message.create({ data: { conversationId: ancienne.id, expediteurId: d.user.id, contenuChiffre: encryptMessage('mot de d, avant') } })
      await base().raw.message.create({ data: { conversationId: ancienne.id, expediteurId: c.user.id, contenuChiffre: encryptMessage('réponse de c') } })
      await base().raw.conversationParticipant.deleteMany({ where: { conversationId: ancienne.id, utilisateurId: d.user.id } })

      // c écrit dans cette conversation : d est rattaché de nouveau et reçoit le message.
      await ecrire(c, ancienne.id, 'c écrit après l’abandon')
      const chezD = (await liste(d)).find((x) => x.id === ancienne.id)
      expect(chezD).toBeDefined()
      expect(chezD!.nonLus).toBe(1)
      expect((await fil(d, ancienne.id)).messages.map((m) => m.contenu)).toEqual(['c écrit après l’abandon'])
      // et rouvrir depuis les contacts ne crée pas de second fil
      expect((await ouvrir(d, c)).id).toBe(ancienne.id)
    })
  })

  // ── 2. Un seul fil par paire, même en parallèle ──────────────────────────────
  describe('2. un seul fil direct par paire', () => {
    it('cinq ouvertures simultanées, dans les deux sens, donnent un seul fil', async () => {
      const c = await compte('c2')
      const d = await compte('d2')
      const resultats = await Promise.all([ouvrir(c, d), ouvrir(d, c), ouvrir(c, d), ouvrir(d, c), ouvrir(c, d)])
      expect(new Set(resultats.map((r) => r.id)).size).toBe(1)
      expect(resultats.filter((r) => r.created)).toHaveLength(1)
      const nb = await base().raw.conversation.count({
        where: { type: 'DIRECT', AND: [{ participants: { some: { utilisateurId: c.user.id } } }, { participants: { some: { utilisateurId: d.user.id } } }] },
      })
      expect(nb).toBe(1)
    })
  })

  // ── 3. Historique d'un groupe ────────────────────────────────────────────────
  describe('3. historique d’un groupe', () => {
    it('un membre ajouté plus tard ne voit rien d’antérieur, et n’a pas de non-lus d’avant', async () => {
      const e = await compte('e3')
      const f = await compte('f3')
      const g = await compte('g3')
      const gr = await groupe(e, [f])
      await ecrire(e, gr, 'secret d’avant 1')
      await ecrire(f, gr, 'secret d’avant 2')
      expect((await e.post(`/messagerie/conversations/${gr}/participants`, { participantIds: [g.user.id] })).status).toBeLessThan(300)
      await ecrire(e, gr, 'après l’arrivée')

      const vus = (await fil(g, gr)).messages.filter((m) => !m.contenu.includes('a ajouté'))
      expect(vus.map((m) => m.contenu)).toEqual(['après l’arrivée'])
      expect(await nonLusDe(g, gr)).toBe(1)
      // La recherche, les épinglés et le détail respectent la même frontière.
      expect((await g.get<{ resultats: unknown[] }>(`/messagerie/conversations/${gr}/recherche?q=secret`)).body.resultats).toHaveLength(0)
    })

    it('quitter puis être rajouté : rien de ce qui s’est dit pendant l’absence', async () => {
      const h = await compte('h3')
      const i = await compte('i3')
      const j = await compte('j3')
      const gr = await groupe(h, [i, j])
      await ecrire(h, gr, 'avant le départ')
      expect((await j.post(`/messagerie/conversations/${gr}/quitter`, {})).status).toBeLessThan(300)
      await ecrire(h, gr, 'pendant l’absence de j')
      expect((await h.post(`/messagerie/conversations/${gr}/participants`, { participantIds: [j.user.id] })).status).toBeLessThan(300)
      await ecrire(h, gr, 'après le retour de j')
      const vus = (await fil(j, gr)).messages.filter((m) => !m.contenu.includes('a ajouté') && !m.contenu.includes('a quitté'))
      expect(vus.map((m) => m.contenu)).toEqual(['après le retour de j'])
    })
  })

  // ── 4. La lecture se déclare, message par message ────────────────────────────
  describe('4. lecture message par message', () => {
    it('charger le fil ne marque rien comme lu ; seul ce que l’écran déclare l’est', async () => {
      const a = await compte('a4')
      const b = await compte('b4')
      const conv = (await ouvrir(a, b)).id
      const m1 = await ecrire(a, conv, 'un')
      const m2 = await ecrire(a, conv, 'deux')
      expect(await nonLusDe(b, conv)).toBe(2)

      const apercu = await fil(b, conv)
      expect(apercu.messages.map((m) => m.nonLu)).toEqual([true, true])
      expect(await nonLusDe(b, conv)).toBe(2) // lire le fil n'a rien changé
      const vuParA = (await fil(a, conv)).messages.find((m) => m.id === m1.id)!
      expect(vuParA.luPar).toBe(0)

      const r = await lire(b, conv, [m1.id])
      expect(r.body).toEqual({ lus: 1, nonLus: 1 })
      expect(await nonLusDe(b, conv)).toBe(1)
      const chezA = (await fil(a, conv)).messages
      expect(chezA.find((m) => m.id === m1.id)!.vu).toBe(true)
      expect(chezA.find((m) => m.id === m2.id)!.vu).toBe(false)

      // Déclarer deux fois, ou un message qui n'est pas dans la conversation : sans effet.
      expect((await lire(b, conv, [m1.id, '00000000-0000-4000-8000-000000000000'])).body.lus).toBe(0)
      expect((await lire(b, conv, [m2.id])).body).toEqual({ lus: 1, nonLus: 0 })
    })

    it('un message arrivé en retard (écrit hors ligne) reste « non lu » pour le destinataire, et pas « lu » pour l’expéditeur', async () => {
      const h = await compte('h4')
      const i = await compte('i4')
      const conv = (await ouvrir(h, i)).id
      const m1 = await ecrire(h, conv, 'message normal')
      const depuis = new Date(new Date(m1.createdAt).getTime() + 1)
      await lire(i, conv, [m1.id]) // i lit la conversation « maintenant »
      await new Promise((r) => setTimeout(r, 30))

      // Un poste hors ligne avait écrit un message, daté d'AVANT cette lecture, qui n'arrive qu'ensuite.
      const enRetard = await base().raw.message.create({
        data: { conversationId: conv, expediteurId: h.user.id, contenuChiffre: encryptMessage('écrit hors ligne, arrivé après'), createdAt: depuis },
      })

      expect(await nonLusDe(i, conv)).toBe(1)
      const chezH = (await fil(h, conv)).messages.find((m) => m.id === enRetard.id)!
      expect(chezH.luPar).toBe(0)
      expect(chezH.vu).toBe(false)
      const chezI = (await fil(i, conv)).messages.find((m) => m.id === enRetard.id)!
      expect(chezI.nonLu).toBe(true)
    })

    it('« je regarde cette conversation » ne dure que tant qu’on la regarde', async () => {
      const a = await compte('a4b')
      const b = await compte('b4b')
      const conv = (await ouvrir(a, b)).id
      await ecrire(a, conv, 'bonjour')
      const presence = app.get(PresenceService)
      expect((await lire(b, conv)).status).toBe(200)
      expect(presence.isViewing(b.user.id, conv)).toBe(true)
      expect((await b.delete(`/messagerie/conversations/${conv}/vue`)).status).toBe(200)
      expect(presence.isViewing(b.user.id, conv)).toBe(false)
      // charger le fil, lui, ne déclare pas qu'on regarde
      await fil(b, conv)
      expect(presence.isViewing(b.user.id, conv)).toBe(false)
    })

    it('les événements de groupe, les messages masqués et les messages supprimés ne comptent pas comme non lus', async () => {
      const a = await compte('a4c')
      const b = await compte('b4c')
      const c = await compte('c4c')
      const gr = await groupe(a, [b])
      expect(await nonLusDe(b, gr)).toBe(0) // la création du groupe ne fait rien de « non lu »
      const x = await ecrire(a, gr, 'masqué par b')
      const y = await ecrire(a, gr, 'supprimé pour tous')
      await ecrire(a, gr, 'compte')
      expect(await nonLusDe(b, gr)).toBe(3)
      await b.post(`/messagerie/messages/${x.id}/masquer`, {})
      await a.delete(`/messagerie/messages/${y.id}`)
      expect(await nonLusDe(b, gr)).toBe(1)
      // un ajout est un événement de groupe : il ne se compte pas
      await a.post(`/messagerie/conversations/${gr}/participants`, { participantIds: [c.user.id] })
      expect(await nonLusDe(b, gr)).toBe(1)
      expect((await b.get<{ count: number }>('/messagerie/unread-count')).body.count).toBe(1)
    })
  })

  // ── 5. Synchronisation ───────────────────────────────────────────────────────
  describe('5. synchronisation de la messagerie', () => {
    it('aucune table de messagerie n’est limitée à un site (conversations entre sites)', () => {
      const noms = ['Conversation', 'ConversationParticipant', 'Message', 'MessageReaction', 'MessageMasque', 'MessagePieceJointe', 'MessageLecture', 'MessageFavori']
      for (const nom of noms) {
        const def = SYNC_MODELS.find((d) => d.model === nom)
        expect(def).toBeDefined()
        expect(def!.scopeWhere('UN-SITE')).toEqual({})
      }
    })

    it('quitter un groupe se propage aux postes (suppression logique, pas une ligne qui disparaît sans trace)', async () => {
      const a = await compte('a5')
      const b = await compte('b5')
      const c = await compte('c5')
      const gr = await groupe(a, [b, c])
      const avant = new Date(Date.now() - 1000).toISOString()
      expect((await c.post(`/messagerie/conversations/${gr}/quitter`, {})).status).toBeLessThan(300)
      const ligne = await base().raw.conversationParticipant.findFirstOrThrow({ where: { conversationId: gr, utilisateurId: c.user.id } })
      expect(ligne.deletedAt).not.toBeNull()
      const page = await app.get(SyncService).pull('UN-SITE', avant, 500)
      const tombstone = page.changes.find((e) => e.model === 'ConversationParticipant' && e.id === ligne.id)
      expect(tombstone).toBeDefined()
      expect(tombstone!.op).toBe('delete')
    })

    it('les accusés de lecture et les favoris font partie de ce que la synchro transporte', async () => {
      const a = await compte('a5b')
      const b = await compte('b5b')
      const conv = (await ouvrir(a, b)).id
      const m = await ecrire(a, conv, 'à lire et à garder')
      const avant = new Date(Date.now() - 1000).toISOString()
      await lire(b, conv, [m.id])
      await b.post(`/messagerie/messages/${m.id}/favori`, {})
      const modeles = new Set((await app.get(SyncService).pull('UN-SITE', avant, 500)).changes.map((e) => e.model))
      expect(modeles.has('MessageLecture')).toBe(true)
      expect(modeles.has('MessageFavori')).toBe(true)
    })
  })

  // ── 6. Envoi, modification, transfert, pagination ────────────────────────────
  describe('6. envoi et modification', () => {
    it('modifier un message est diffusé en direct aux autres participants', async () => {
      const a = await compte('a6')
      const b = await compte('b6')
      const conv = (await ouvrir(a, b)).id
      const m = await ecrire(a, conv, 'texte initial')
      const espion = jest.spyOn(app.get(NotificationService), 'pushLive')
      const r = await a.patch(`/messagerie/messages/${m.id}`, { contenu: 'texte corrigé' })
      expect(r.status).toBe(200)
      // La diffusion part en tâche de fond, après la réponse : on lui laisse un instant.
      for (let k = 0; k < 40 && !espion.mock.calls.some((c) => c[0] === b.user.id && c[1] === 'LIVE_MESSAGERIE'); k++)
        await new Promise((res) => setTimeout(res, 50))
      expect(espion).toHaveBeenCalledWith(b.user.id, 'LIVE_MESSAGERIE', conv)
      espion.mockRestore()
    })

    it('un renvoi du même message (même clientId) ne crée pas de doublon, même en parallèle', async () => {
      const a = await compte('a6b')
      const b = await compte('b6b')
      const conv = (await ouvrir(a, b)).id
      const clientId = '11111111-2222-4333-8444-555555555555'
      const envois = await Promise.all([1, 2, 3, 4, 5].map(() => a.formulaire<{ id: string }>(`/messagerie/conversations/${conv}/messages`, { contenu: 'envoyé plusieurs fois', clientId })))
      expect(envois.every((r) => r.status === 201)).toBe(true)
      expect(new Set(envois.map((r) => r.body.id)).size).toBe(1)
      expect(await base().raw.message.count({ where: { conversationId: conv } })).toBe(1)
      expect(await nonLusDe(b, conv)).toBe(1)
    })

    it('quitté le groupe, on ne modifie ni ne supprime plus ce qu’on y avait écrit', async () => {
      const a = await compte('a6c')
      const b = await compte('b6c')
      const gr = await groupe(a, [b])
      const m = await ecrire(b, gr, 'écrit par b')
      await b.post(`/messagerie/conversations/${gr}/quitter`, {})
      expect((await b.patch(`/messagerie/messages/${m.id}`, { contenu: 'modifié après départ' })).status).toBe(403)
      expect((await b.delete(`/messagerie/messages/${m.id}`)).status).toBe(403)
    })

    it('écrire à un compte désactivé est refusé, avec la raison', async () => {
      const a = await compte('a6d')
      const b = await compte('b6d')
      const conv = (await ouvrir(a, b)).id
      await ecrire(a, conv, 'avant désactivation')
      await base().raw.utilisateur.update({ where: { id: b.user.id }, data: { statut: 'DESACTIVE' } })
      const r = await a.formulaire<{ code?: string }>(`/messagerie/conversations/${conv}/messages`, { contenu: 'après' })
      expect(r.status).toBe(403)
      expect(r.body.code).toBe('COMPTE_DESACTIVE')
      expect((await liste(a)).find((c) => c.id === conv)!.interlocuteur!.actif).toBe(false)
    })

    it('un événement de groupe ne se transfère pas', async () => {
      const a = await compte('a6e')
      const b = await compte('b6e')
      const c = await compte('c6e')
      const gr = await groupe(a, [b])
      await a.post(`/messagerie/conversations/${gr}/participants`, { participantIds: [c.user.id] })
      const evenement = await base().raw.message.findFirstOrThrow({ where: { conversationId: gr, type: 'SYSTEME' } })
      const autre = (await ouvrir(a, c)).id
      const r = await a.post(`/messagerie/messages/${evenement.id}/transferer`, { conversationIds: [autre] })
      expect(r.status).toBe(400)
    })

    it('la pagination ne perd aucun message quand plusieurs partagent la même milliseconde', async () => {
      const a = await compte('a6f')
      const b = await compte('b6f')
      const conv = (await ouvrir(a, b)).id
      const meme = new Date(Date.now() - 5 * 60_000)
      const crees: string[] = []
      for (let k = 0; k < 120; k++) {
        const m = await base().raw.message.create({
          data: { conversationId: conv, expediteurId: a.user.id, contenuChiffre: encryptMessage(`m${k}`), createdAt: k < 60 ? meme : new Date(meme.getTime() + 1 + k) },
        })
        crees.push(m.id)
      }
      // La conversation doit exister avant ces messages datés : on rend les participants plus anciens.
      await base().raw.conversationParticipant.updateMany({ where: { conversationId: conv }, data: { joinedAt: new Date(meme.getTime() - 60_000) } })
      const vus = new Set<string>()
      let curseur = ''
      for (let page = 0; page < 10; page++) {
        const { messages, hasMore } = await fil(b, conv, curseur)
        for (const m of messages) vus.add(m.id)
        if (!hasMore) break
        const premier = messages[0]
        curseur = `${premier.createdAt}~${premier.id}`
      }
      expect(vus.size).toBe(120)
    })
  })

  // ── 7. Liste, recherche, archivage, favoris ──────────────────────────────────
  describe('7. liste, recherche, archivage, favoris', () => {
    it('l’aperçu de la liste ignore ce qu’on a masqué pour soi', async () => {
      const a = await compte('a7')
      const b = await compte('b7')
      const conv = (await ouvrir(a, b)).id
      await ecrire(a, conv, 'visible')
      const secret = await ecrire(a, conv, 'à masquer')
      expect((await liste(b)).find((c) => c.id === conv)!.dernierMessage!.apercu).toBe('à masquer')
      await b.post(`/messagerie/messages/${secret.id}/masquer`, {})
      expect((await liste(b)).find((c) => c.id === conv)!.dernierMessage!.apercu).toBe('visible')
    })

    it('un message supprimé pour tous laisse sa trace : la conversation reste dans la liste', async () => {
      const a = await compte('a7b')
      const b = await compte('b7b')
      const conv = (await ouvrir(a, b)).id
      const seul = await ecrire(a, conv, 'je me ravise')
      await a.delete(`/messagerie/messages/${seul.id}`)
      for (const c of [a, b]) {
        const l = (await liste(c)).find((x) => x.id === conv)
        expect(l).toBeDefined()
        expect(l!.dernierMessage).toMatchObject({ apercu: 'Message supprimé', supprime: true })
      }
    })

    it('la recherche trouve sans tenir compte des accents ni des majuscules, et seulement ce qu’on peut voir', async () => {
      const a = await compte('a7c')
      const b = await compte('b7c')
      const conv = (await ouvrir(a, b)).id
      await ecrire(a, conv, 'La RÉUNION de lundi est reportée')
      await ecrire(b, conv, 'D’accord pour mardi')
      const secret = await ecrire(a, conv, 'réunion secrète')
      await b.post(`/messagerie/messages/${secret.id}/masquer`, {})
      const r = await b.get<{ resultats: { extrait: string }[] }>(`/messagerie/conversations/${conv}/recherche?q=reunion`)
      expect(r.status).toBe(200)
      expect(r.body.resultats).toHaveLength(1)
      expect(r.body.resultats[0].extrait).toContain('RÉUNION')
      expect((await b.get(`/messagerie/conversations/${conv}/recherche?q=r`)).status).toBe(400)
      const tiers = await compte('t7c')
      expect((await tiers.get(`/messagerie/conversations/${conv}/recherche?q=reunion`)).status).toBe(403)
    })

    it('archiver une conversation : propre à soi, et un nouveau message la désarchive', async () => {
      const a = await compte('a7d')
      const b = await compte('b7d')
      const conv = (await ouvrir(a, b)).id
      await ecrire(a, conv, 'un premier message')
      expect((await b.patch(`/messagerie/conversations/${conv}/archiver`, { archivee: true })).status).toBe(200)
      expect((await liste(b)).find((c) => c.id === conv)!.archivee).toBe(true)
      expect((await liste(a)).find((c) => c.id === conv)!.archivee).toBe(false)
      await ecrire(a, conv, 'un second')
      expect((await liste(b)).find((c) => c.id === conv)!.archivee).toBe(false)
    })

    it('favoris : propres à chacun, retirables, et ils suivent le message', async () => {
      const a = await compte('a7e')
      const b = await compte('b7e')
      const conv = (await ouvrir(a, b)).id
      const m = await ecrire(a, conv, 'à garder précieusement')
      expect((await b.post<{ favori: boolean }>(`/messagerie/messages/${m.id}/favori`, {})).body.favori).toBe(true)
      expect((await fil(b, conv)).messages.find((x) => x.id === m.id)!.favori).toBe(true)
      expect((await fil(a, conv)).messages.find((x) => x.id === m.id)!.favori).toBe(false)
      const favoris = (await b.get<{ id: string; apercu: string; conversationId: string }[]>('/messagerie/favoris')).body
      expect(favoris.map((f) => f.id)).toContain(m.id)
      expect((await a.get<unknown[]>('/messagerie/favoris')).body).toHaveLength(0)
      // un tiers ne peut pas mettre en favori un message qu'il ne voit pas
      const tiers = await compte('t7e')
      expect((await tiers.post(`/messagerie/messages/${m.id}/favori`, {})).status).toBe(403)
      // retirer, puis remettre (la ligne supprimée logiquement est ressuscitée)
      expect((await b.post<{ favori: boolean }>(`/messagerie/messages/${m.id}/favori`, {})).body.favori).toBe(false)
      expect((await b.get<unknown[]>('/messagerie/favoris')).body).toHaveLength(0)
      expect((await b.post<{ favori: boolean }>(`/messagerie/messages/${m.id}/favori`, {})).body.favori).toBe(true)
      // supprimé pour tous, il sort des favoris
      await a.delete(`/messagerie/messages/${m.id}`)
      expect((await b.get<unknown[]>('/messagerie/favoris')).body).toHaveLength(0)
    })
  })
})
