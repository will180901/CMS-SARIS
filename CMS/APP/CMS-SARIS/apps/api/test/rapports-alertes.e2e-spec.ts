/**
 * Les constats d'un rapport (`POST /rapports/generer`, `GET /rapports/:id`) — par les vraies routes
 * et la vraie base de test, sur des périodes de l'an 2001 (la base de test est partagée : rien d'autre
 * n'y écrit à cette date) :
 *  - un mois ENTAMÉ (du 1er à « demain ») n'est pas comparable au mois plein : il porte
 *    `partielle: true` et ne déclenche JAMAIS « activité en baisse » (face au mois plein, il baisse
 *    toujours — « -39 % » le 16 du mois) ;
 *  - la même chute sur une période COMPLÈTE est, elle, signalée ;
 *  - les accidents du travail « concentrés » désignent un vrai département : « Non renseigné » (les
 *    patients qui n'en ont pas) n'en est pas un.
 */
import { randomUUID } from 'node:crypto'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { baseDe, demarrerApp } from './support/app-test'
import { COMPTES, connecter, type Client } from './support/client'
import { referentiels, type Referentiels } from './support/donnees'

interface Alerte {
  code: string
  niveau: string
  params: Record<string, string | number>
}
interface Rapport {
  id: string
  contenu: {
    partielle?: boolean
    totalConsultations: number
    precedent: { totalConsultations: number } | null
    alertes: Alerte[]
  }
}

describe('Constats des rapports', () => {
  let app: NestExpressApplication
  let admin: Client
  let ref: Referentiels
  const base = () => baseDe(app)

  const patientIds: string[] = []
  const visiteIds: string[] = []
  const consultationIds: string[] = []
  let pSansDepartement: string
  let pUsine: string
  let pAtelier: string
  let typeAccidentId: string
  let typeOrdinaireId: string
  let soignantId: string
  const departement = `Usine-${Date.now() % 100_000}`
  const atelier = `Atelier-${Date.now() % 100_000}`

  /** Midnight du serveur (le même processus : même fuseau). */
  const jour = (m: number, j: number) => new Date(2001, m - 1, j)

  async function ecrire(
    patientId: string,
    quand: Date,
    typeConsultationId: string | null = null,
  ) {
    const raw = base().raw
    const visiteId = randomUUID()
    const id = randomUUID()
    visiteIds.push(visiteId)
    consultationIds.push(id)
    await raw.visite.create({
      data: {
        id: visiteId,
        patientId,
        siteId: ref.siteId,
        motifPrincipalId: ref.motifId,
        statut: 'CLOTUREE',
      },
    })
    await raw.consultation.create({
      data: {
        id,
        visiteId,
        soignantId,
        statut: 'CLOTUREE',
        createdAt: quand,
        ...(typeConsultationId ? { typeConsultationId } : {}),
      },
    })
  }

  async function generer(type: 'MENSUEL', debut: Date, fin: Date): Promise<Rapport> {
    const r = await admin.post<{ id: string }>('/rapports/generer', {
      type,
      debut: debut.toISOString(),
      fin: fin.toISOString(),
    })
    expect(r.status).toBeLessThan(300)
    const detail = await admin.get<Rapport>(`/rapports/${r.body.id}`)
    expect(detail.status).toBe(200)
    return detail.body
  }
  const codes = (r: Rapport) => r.contenu.alertes.map((a) => a.code)

  beforeAll(async () => {
    app = await demarrerApp()
    admin = await connecter(app, COMPTES.admin)
    ref = await referentiels(admin)
    const raw = base().raw

    const u = await raw.utilisateur.findFirstOrThrow({
      where: { login: COMPTES.medecinChef.login },
      select: { personnelMedicalId: true },
    })
    soignantId = u.personnelMedicalId!
    typeAccidentId = (
      await raw.typeConsultation.findFirstOrThrow({
        where: { libelle: { contains: 'ccident' } },
      })
    ).id

    // un type de consultation qui n'est PAS un accident : ses consultations ne comptent pas parmi les accidents
    typeOrdinaireId = (
      await raw.typeConsultation.findFirstOrThrow({
        where: { NOT: { libelle: { contains: 'ccident', mode: 'insensitive' } } },
      })
    ).id

    for (const [nom, emploi] of [
      ['A', null],
      ['B', departement],
      ['C', atelier],
    ] as const) {
      const id = randomUUID()
      patientIds.push(id)
      await raw.patient.create({
        data: {
          id,
          numeroPatient: `PAT-RAL-${nom}-${id.slice(0, 6)}`,
          siteCreationId: ref.siteId,
          categoriePatientId: ref.categories['ASSURE_CDI']!,
          identite: { create: { nom: `Rapport${nom}`, prenom: 'Constat' } },
          ...(emploi ? { donneesEmploi: { create: { departement: emploi } } } : {}),
        },
      })
      if (nom === 'A') pSansDepartement = id
      else if (nom === 'B') pUsine = id
      else pAtelier = id
    }

    // Janvier 2001 : 8 consultations (la période « d'avant » de février)
    for (let i = 0; i < 8; i++) await ecrire(pSansDepartement, jour(1, 3 + i))
    // Février 2001 : 2 consultations seulement (une chute de 75 %)
    await ecrire(pSansDepartement, jour(2, 2))
    await ecrire(pSansDepartement, jour(2, 5))
    // Avril 2001 : 3 accidents du travail, tous sur des patients SANS département
    for (let i = 0; i < 3; i++) await ecrire(pSansDepartement, jour(4, 2 + i), typeAccidentId)
    // Juin 2001 : 3 accidents du travail, tous dans le même département
    for (let i = 0; i < 3; i++) await ecrire(pUsine, jour(6, 2 + i), typeAccidentId)
    // Août 2001 : l'Usine porte l'essentiel des consultations (6 ordinaires) mais UN seul accident, comme l'Atelier
    // et les sans-département : les accidents sont éparpillés, rien n'est « concentré »
    for (let i = 0; i < 6; i++) await ecrire(pUsine, jour(8, 2 + i), typeOrdinaireId)
    await ecrire(pUsine, jour(8, 10), typeAccidentId)
    await ecrire(pAtelier, jour(8, 11), typeAccidentId)
    await ecrire(pSansDepartement, jour(8, 12), typeAccidentId)
    // Septembre 2001 : tous les accidents (4) sont à l'Atelier, noyés dans 10 consultations ordinaires ailleurs
    for (let i = 0; i < 10; i++) await ecrire(pSansDepartement, jour(9, 2 + i))
    for (let i = 0; i < 4; i++) await ecrire(pAtelier, jour(9, 15 + i), typeAccidentId)
    // Octobre 2001 : 3 accidents dans chacun des trois ensembles (Usine, Atelier, sans département) : diffus
    for (const p of [pUsine, pAtelier, pSansDepartement])
      for (let i = 0; i < 3; i++) await ecrire(p, jour(10, 2 + i), typeAccidentId)
    // Novembre 2001 : 3 accidents à l'Atelier sur 5 (les 2 autres, sans département) : la majorité, donc concentré
    for (let i = 0; i < 3; i++) await ecrire(pAtelier, jour(11, 2 + i), typeAccidentId)
    for (let i = 0; i < 2; i++) await ecrire(pSansDepartement, jour(11, 6 + i), typeAccidentId)
  })

  afterAll(async () => {
    const raw = base().raw
    await raw.rapportGenere.deleteMany({
      where: { periodeDebut: { gte: jour(1, 1), lt: new Date(2002, 0, 1) } },
    })
    await raw.consultation.deleteMany({ where: { id: { in: consultationIds } } })
    await raw.visite.deleteMany({ where: { id: { in: visiteIds } } })
    await raw.donneesEmploi.deleteMany({ where: { patientId: { in: patientIds } } })
    await raw.identitePatient.deleteMany({ where: { patientId: { in: patientIds } } })
    await raw.patient.deleteMany({ where: { id: { in: patientIds } } })
    await app.close()
  })

  describe('Période partielle ou complète', () => {
    it('un mois ENTAMÉ face au mois plein : marqué partiel, jamais « activité en baisse »', async () => {
      // Du 1er février au 11 : 10 jours face aux 31 de janvier, 2 consultations face à 8 (-75 %).
      const r = await generer('MENSUEL', jour(2, 1), jour(2, 11))
      expect(r.contenu.totalConsultations).toBe(2)
      expect(r.contenu.precedent?.totalConsultations).toBe(8)
      expect(r.contenu.partielle).toBe(true)
      expect(codes(r)).not.toContain('ACTIVITE_BAISSE')
    })

    it('la même chute sur une période COMPLÈTE est signalée', async () => {
      // Février entier (28 jours) face à janvier entier (31 jours) : 2 face à 8, la chute est réelle.
      const r = await generer('MENSUEL', jour(2, 1), jour(3, 1))
      expect(r.contenu.totalConsultations).toBe(2)
      expect(r.contenu.precedent?.totalConsultations).toBe(8)
      expect(r.contenu.partielle).toBe(false)
      const baisse = r.contenu.alertes.find((a) => a.code === 'ACTIVITE_BAISSE')
      expect(baisse).toBeDefined()
      expect(baisse!.params).toMatchObject({ pct: 75, avant: 8, apres: 2 })
    })
  })

  describe('Accidents du travail concentrés', () => {
    it('sur des patients sans département : pas de constat sur « Non renseigné »', async () => {
      const r = await generer('MENSUEL', jour(4, 1), jour(5, 1))
      expect(r.contenu.totalConsultations).toBe(3)
      expect(codes(r)).not.toContain('AT_CONCENTRATION')
    })

    it('dans un vrai département : le constat le désigne', async () => {
      const r = await generer('MENSUEL', jour(6, 1), jour(7, 1))
      expect(r.contenu.totalConsultations).toBe(3)
      const at = r.contenu.alertes.find((a) => a.code === 'AT_CONCENTRATION')
      expect(at).toBeDefined()
      expect(at!.niveau).toBe('critique')
      expect(at!.params).toMatchObject({ departement, cas: 3, accidents: 3 })
    })

    it('la concentration se mesure ENTRE LES ACCIDENTS : l\'Usine a la moitié des consultations mais un accident sur trois — pas de constat', async () => {
      const r = await generer('MENSUEL', jour(8, 1), jour(9, 1))
      expect(r.contenu.totalConsultations).toBe(9) // 6 ordinaires + 3 accidents
      expect(codes(r)).not.toContain('AT_CONCENTRATION')
    })

    it('tous les accidents dans un petit département, noyés dans de nombreuses consultations ailleurs : constaté (avant, jamais)', async () => {
      const r = await generer('MENSUEL', jour(9, 1), jour(10, 1))
      expect(r.contenu.totalConsultations).toBe(14) // 10 ordinaires + 4 accidents : l'Atelier = 29 % des consultations
      const at = r.contenu.alertes.find((a) => a.code === 'AT_CONCENTRATION')
      expect(at).toBeDefined()
      expect(at!.params).toMatchObject({ departement: atelier, cas: 4, accidents: 4 })
    })

    it('des accidents répartis à parts égales entre trois ensembles : diffus, pas de constat', async () => {
      const r = await generer('MENSUEL', jour(10, 1), jour(11, 1))
      expect(r.contenu.totalConsultations).toBe(9)
      expect(codes(r)).not.toContain('AT_CONCENTRATION')
    })

    it('la majorité des accidents dans un département (3 sur 5) : constaté, avec les deux nombres', async () => {
      const r = await generer('MENSUEL', jour(11, 1), jour(12, 1))
      const at = r.contenu.alertes.find((a) => a.code === 'AT_CONCENTRATION')
      expect(at).toBeDefined()
      expect(at!.params).toMatchObject({ departement: atelier, cas: 3, accidents: 5 })
    })
  })
})
