/**
 * Mise à niveau de la base locale d'un poste de bureau (chantier 7, étape 5).
 *
 * Un poste garde sa base SQLite d'une version à l'autre — elle peut contenir des saisies
 * pas encore envoyées au central — et la met à niveau au démarrage
 * (src/prisma/mise-a-niveau-locale.ts). Ces tests le font sur de VRAIES bases SQLite,
 * construites à partir des migrations du dépôt, telles qu'un poste les aurait à chaque
 * version intermédiaire :
 *  - un poste neuf ne rejoue rien (une migration rejouée efface des colonnes remplies) ;
 *  - depuis n'importe quelle version, il rejoint EXACTEMENT le schéma actuel ;
 *  - ses données survivent (dont la reprise du registre des employés) ;
 *  - une migration en échec ne laisse rien à moitié fait.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import type { Logger } from '@nestjs/common'
import {
  instructionsDeMigration,
  mettreANiveauBaseLocale,
} from '../src/prisma/mise-a-niveau-locale'

const DB = path.resolve(__dirname, '../../../packages/db/prisma/sqlite')
const MIGRATIONS = path.join(DB, 'migrations')

/** Le client SQLite généré, tel que la mise à niveau l'utilise au démarrage d'un poste. */
type ClientSqlite = Parameters<typeof mettreANiveauBaseLocale>[0] & {
  $disconnect(): Promise<void>
}
const { PrismaClient } = createRequire(__filename)(
  path.join(DB, 'generated'),
) as {
  PrismaClient: new (o: object) => ClientSqlite
}
const silencieux = {
  log: () => undefined,
  warn: () => undefined,
} as unknown as Logger

const noms = fs
  .readdirSync(MIGRATIONS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d{14}_/.test(d.name))
  .map((d) => d.name)
  .sort()
const sqlDe = (dossier: string, nom: string) =>
  fs
    .readFileSync(path.join(dossier, nom, 'migration.sql'), 'utf8')
    .replace(/\r\n/g, '\n')

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-saris-postes-'))
let numero = 0
const ouverts: ClientSqlite[] = []

/** Base d'un poste resté à la version qui s'arrête avant la migration n° `jusqua`. */
async function poste(jusqua = noms.length): Promise<ClientSqlite> {
  numero += 1
  const fichier = path.join(TMP, `poste-${numero}.db`).replace(/\\/g, '/')
  const c = new PrismaClient({
    datasources: { db: { url: `file:${fichier}?connection_limit=1` } },
  })
  ouverts.push(c)
  await c.$executeRawUnsafe('PRAGMA foreign_keys = OFF')
  for (const nom of noms.slice(0, jusqua))
    for (const instruction of instructionsDeMigration(sqlDe(MIGRATIONS, nom)))
      await c.$executeRawUnsafe(instruction)
  return c
}

/** Schéma comparable : tables → colonnes (nom, type, obligatoire, défaut), et index. */
async function schema(c: ClientSqlite) {
  const tables = await c.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_MiseANiveauPoste' ORDER BY name`,
  )
  const colonnes: Record<string, string[]> = {}
  for (const { name } of tables) {
    const cols = await c.$queryRawUnsafe<
      {
        name: string
        type: string
        notnull: number | bigint
        dflt_value: string | null
      }[]
    >(`PRAGMA table_info("${name}")`)
    colonnes[name] = cols
      .map(
        (x) => `${x.name} ${x.type} ${Number(x.notnull)} ${x.dflt_value ?? ''}`,
      )
      .sort()
  }
  const index = (
    await c.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    )
  ).map((x) => x.name)
  return { colonnes, index }
}

const journal = async (c: ClientSqlite) =>
  (
    await c.$queryRawUnsafe<{ nom: string; mode: string }[]>(
      `SELECT "nom", "mode" FROM "_MiseANiveauPoste" ORDER BY "nom"`,
    )
  ).map((l) => `${l.nom} ${l.mode}`)

describe('Mise à niveau de la base locale des postes', () => {
  let schemaActuel: Awaited<ReturnType<typeof schema>>

  beforeAll(async () => {
    schemaActuel = await schema(await poste())
  })
  afterAll(async () => {
    for (const c of ouverts) await c.$disconnect()
    fs.rmSync(TMP, { recursive: true, force: true })
  })

  it('le dépôt contient bien des migrations de poste', () => {
    expect(noms.length).toBeGreaterThan(5)
    expect(noms).toContain('20261009210000_suppression_registre_employes')
  })

  it('un poste neuf (base déjà au dernier schéma) ne rejoue rien : ses données restent', async () => {
    const c = await poste()
    await c.$executeRawUnsafe(
      `INSERT INTO "PersonnelMedical" ("id","nom","prenom","matricule","role","statut","sectionPaie","departement","updatedAt") VALUES ('PM1','NEUF','Poste','N-1','INFIRMIER','ACTIF','S7','Santé','2026-10-01T10:00:00.000Z')`,
    )
    await mettreANiveauBaseLocale(c, MIGRATIONS, silencieux)
    expect(await schema(c)).toEqual(schemaActuel)
    // Rejouer la dernière migration (recréation de la table) aurait vidé ces colonnes.
    const [f] = await c.$queryRawUnsafe<
      { sectionPaie: string | null; departement: string | null }[]
    >(
      `SELECT "sectionPaie", "departement" FROM "PersonnelMedical" WHERE "id" = 'PM1'`,
    )
    expect(f).toEqual({ sectionPaie: 'S7', departement: 'Santé' })
    expect((await journal(c)).filter((l) => l.endsWith('APPLIQUEE'))).toEqual(
      [],
    )
  })

  it.each(Array.from({ length: noms.length }, (_, k) => k))(
    'un poste resté avant la migration n° %i rejoint exactement le schéma actuel',
    async (k) => {
      const c = await poste(k)
      await mettreANiveauBaseLocale(c, MIGRATIONS, silencieux)
      expect(await schema(c)).toEqual(schemaActuel)
      const j = await journal(c)
      expect(j).toHaveLength(noms.length)
      // Tout ce qui manquait a été réellement appliqué (pas « constaté » à tort).
      for (const nom of noms.slice(k)) expect(j).toContain(`${nom} APPLIQUEE`)
    },
  )

  it("les données d'un ancien poste survivent : registre repris, fiche complétée, réception relancée", async () => {
    const avantRegistre = noms.indexOf(
      '20261009210000_suppression_registre_employes',
    )
    const c = await poste(avantRegistre)
    const x = (sql: string) => c.$executeRawUnsafe(sql)
    const T = "'2026-07-01T10:00:00.000Z'"
    await x(
      `INSERT INTO "Site" ("id","code","libelle","statut","updatedAt") VALUES ('s1','MOUTELA','CMS Moutela','ACTIF',${T})`,
    )
    await x(
      `INSERT INTO "CategoriePatient" ("id","code","libelle","statut","updatedAt") VALUES ('c-cdi','ASSURE_CDI','CDI','ACTIF',${T})`,
    )
    await x(
      `INSERT INTO "CategoriePatient" ("id","code","libelle","statut","updatedAt") VALUES ('c-ad','AYANT_DROIT_CDI','AD','ACTIF',${T})`,
    )
    await x(
      `INSERT INTO "EmployeSaris" ("id","matricule","nom","prenom","categorie","statut","updatedAt") VALUES ('E1','MAT-1','TRAV','Jean','ASSURE_CDI','ACTIF',${T})`,
    )
    await x(
      `INSERT INTO "Patient" ("id","numeroPatient","matricule","employeId","siteCreationId","categoriePatientId","statut","updatedAt") VALUES ('P1','PAT-MOU-00001',NULL,'E1','s1','c-cdi','ACTIF',${T})`,
    )
    // Ayant droit saisi HORS LIGNE, rattaché au registre, pas encore envoyé au central.
    await x(
      `INSERT INTO "Patient" ("id","numeroPatient","siteCreationId","categoriePatientId","statut","updatedAt") VALUES ('AD1','PAT-MOU-00002','s1','c-ad','ACTIF',${T})`,
    )
    await x(
      `INSERT INTO "RattachementAyantDroitCdi" ("id","patientId","employeId","typeLien","statut","dateDebut","updatedAt") VALUES ('R1','AD1','E1','ENFANT','ACTIF',${T},${T})`,
    )
    await x(
      `INSERT INTO "PersonnelMedical" ("id","nom","prenom","matricule","role","statut","updatedAt") VALUES ('PM2','ANCIEN','Agent','INF-9','INFIRMIER','ACTIF',${T})`,
    )
    await x(
      `INSERT INTO "SyncState" ("id","posteLocalId","siteId","lastPulledAt","updatedAt") VALUES ('ss','poste-1','s1','2026-10-01T00:00:00.000Z',${T})`,
    )

    await mettreANiveauBaseLocale(c, MIGRATIONS, silencieux)

    const q = <T>(sql: string) => c.$queryRawUnsafe<T[]>(sql)
    expect(
      (
        await q<{ cdiId: string }>(
          `SELECT "cdiId" FROM "RattachementAyantDroitCdi" WHERE "id" = 'R1'`,
        )
      )[0].cdiId,
    ).toBe('P1')
    expect(
      (
        await q<{ matricule: string }>(
          `SELECT "matricule" FROM "Patient" WHERE "id" = 'P1'`,
        )
      )[0].matricule,
    ).toBe('MAT-1')
    expect(
      await q(`SELECT name FROM sqlite_master WHERE name = 'EmployeSaris'`),
    ).toEqual([])
    expect(
      (
        await q<{ typeContrat: string; service: string }>(
          `SELECT "typeContrat","service" FROM "PersonnelMedical" WHERE "id" = 'PM2'`,
        )
      )[0],
    ).toEqual({
      typeContrat: 'CDI',
      service: 'Centre Médico-Sanitaire',
    })
    // De nouvelles tables sont devenues synchronisables : la réception repart du début.
    const [s] = await q<{ lastPulledAt: string | number | Date }>(
      `SELECT "lastPulledAt" FROM "SyncState"`,
    )
    expect(new Date(s.lastPulledAt).getTime()).toBe(0)
    expect(await schema(c)).toEqual(schemaActuel)
  })

  it('une seconde mise à niveau ne fait rien', async () => {
    const c = await poste(3)
    await mettreANiveauBaseLocale(c, MIGRATIONS, silencieux)
    const j = await journal(c)
    await mettreANiveauBaseLocale(c, MIGRATIONS, silencieux)
    expect(await journal(c)).toEqual(j)
    expect(await schema(c)).toEqual(schemaActuel)
  })

  it('une migration qui échoue ne laisse rien à moitié fait, et le poste refuse de démarrer', async () => {
    const dossier = path.join(TMP, 'migrations-cassees')
    fs.cpSync(MIGRATIONS, dossier, { recursive: true })
    fs.mkdirSync(path.join(dossier, '29991231000000_cassee'))
    fs.writeFileSync(
      path.join(dossier, '29991231000000_cassee', 'migration.sql'),
      'ALTER TABLE "Patient" ADD COLUMN "essai" TEXT;\nALTER TABLE "TableInexistante" ADD COLUMN "x" TEXT;\n',
    )
    const c = await poste()
    await expect(
      mettreANiveauBaseLocale(c, dossier, silencieux),
    ).rejects.toThrow(/29991231000000_cassee a échoué, rien n'a été modifié/)
    const cols = await c.$queryRawUnsafe<{ name: string }[]>(
      `PRAGMA table_info("Patient")`,
    )
    expect(cols.map((l) => l.name)).not.toContain('essai')
    expect(await journal(c)).not.toContainEqual(
      expect.stringContaining('cassee'),
    )
  })
})
