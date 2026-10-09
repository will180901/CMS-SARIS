/**
 * Base de données de la suite de tests — JAMAIS celle de développement ni de production.
 *
 * Par défaut : même serveur PostgreSQL local que la base de développement
 * (apps/api/.env), base `cms_saris_test`, remise à neuf à chaque lancement
 * (cf. preparer-base.ts). `TEST_DATABASE_URL` permet d'en désigner une autre
 * (intégration continue), sous les mêmes garde-fous.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const NOM_BASE_TEST = 'cms_saris_test'

const HOTES_LOCAUX = new Set(['localhost', '127.0.0.1', '[::1]'])

export function urlBaseTest(): string {
  const fournie = process.env['TEST_DATABASE_URL']
  let url: URL
  if (fournie) {
    url = new URL(fournie)
  } else {
    const ligne = readFileSync(join(__dirname, '..', '..', '.env'), 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('DATABASE_URL='))
    if (!ligne) throw new Error('DATABASE_URL absente de apps/api/.env')
    url = new URL(ligne.slice('DATABASE_URL='.length).replace(/^"|"$/g, ''))
    url.pathname = '/' + NOM_BASE_TEST
  }
  // Garde-fous : la suite VIDE cette base à chaque lancement.
  if (!HOTES_LOCAUX.has(url.hostname))
    throw new Error(`Base de test refusée : hôte « ${url.hostname} » non local`)
  if (!url.pathname.slice(1).endsWith('_test'))
    throw new Error(
      `Base de test refusée : « ${url.pathname.slice(1)} » ne finit pas par _test`,
    )
  return url.toString()
}

/** Même serveur, base de maintenance `postgres` : sert à créer la base de test. */
export function urlMaintenance(urlTest: string): string {
  const url = new URL(urlTest)
  url.pathname = '/postgres'
  return url.toString()
}
