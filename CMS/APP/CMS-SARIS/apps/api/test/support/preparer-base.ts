/**
 * Préparation de la base de test (globalSetup jest), avant TOUS les fichiers de test :
 *   1. crée la base si elle n'existe pas ;
 *   2. la vide (schéma public recréé) — elle seule, garde-fous dans base-test.ts ;
 *   3. applique toutes les migrations, comme un déploiement (`prisma migrate deploy`) ;
 *   4. l'amorce avec le seed du projet en mode E2E (admin déterministe, référentiels,
 *      comptes cliniques de démonstration).
 * Chaque lancement repart donc du même état, sans rien laisser derrière lui ailleurs.
 */
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { NOM_BASE_TEST, urlBaseTest, urlMaintenance } from './base-test'

const DOSSIER_DB = join(__dirname, '..', '..', '..', '..', 'packages', 'db')

async function sql(
  url: string,
  requete: (p: PrismaClient) => Promise<unknown>,
) {
  const p = new PrismaClient({ datasources: { db: { url } } })
  try {
    await requete(p)
  } finally {
    await p.$disconnect()
  }
}

export default async function preparerBase(): Promise<void> {
  const url = urlBaseTest()
  const nom = new URL(url).pathname.slice(1) || NOM_BASE_TEST
  const debut = Date.now()

  await sql(urlMaintenance(url), async (p) => {
    const existe = await p.$queryRawUnsafe<unknown[]>(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      nom,
    )
    if (existe.length === 0)
      await p.$executeRawUnsafe(`CREATE DATABASE "${nom}"`)
  })
  await sql(url, async (p) => {
    await p.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE')
    await p.$executeRawUnsafe('CREATE SCHEMA public')
  })

  const env = { ...process.env, DATABASE_URL: url, SEED_E2E: '1' }
  const lancer = (commande: string) => {
    try {
      execSync(commande, { cwd: DOSSIER_DB, env, stdio: 'pipe' })
    } catch (e) {
      const err = e as { stdout?: Buffer; stderr?: Buffer }
      throw new Error(
        `Préparation de la base de test : « ${commande} » a échoué\n` +
          `${err.stdout?.toString() ?? ''}${err.stderr?.toString() ?? ''}`,
      )
    }
  }
  lancer('pnpm exec prisma migrate deploy')
  lancer('pnpm exec tsx prisma/seed.ts')
  console.log(
    `\n  Base de test « ${nom} » prête en ${Math.round((Date.now() - debut) / 1000)} s`,
  )
}
