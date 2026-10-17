/**
 * Les nombres dans les textes : « 3 475 consultations », « 54 502 actions » — avec la VRAIE configuration
 * de traduction (celle de l'application : formateur branché, `alwaysFormat`) et les vrais textes. Les
 * années, numéros et heures ne reçoivent JAMAIS de séparateur.
 *   pnpm --filter web exec tsx test/nombres.test.ts
 */
import assert from 'node:assert/strict'
import i18n from '../src/i18n/config'
import { formatNumber } from '../src/lib/intl'
import { CLES_NOMBRE, formaterNombre } from '../src/i18n/formatNombres'

let passed = 0
let failed = 0
const attente: Promise<void>[] = []
function test(name: string, fn: () => void | Promise<void>): void {
  const fin = (e?: unknown) => {
    if (e) {
      failed++
      console.error('  ✗ ' + name + '\n     ' + (e as Error).message)
    } else {
      passed++
      console.log('  ✓ ' + name)
    }
  }
  try {
    const r = fn()
    if (r) attente.push(r.then(() => fin(), fin))
    else fin()
  } catch (e) {
    fin(e)
  }
}

const NBSP = ' '
const t = (cle: string, opts: Record<string, unknown>, lng = 'fr') => i18n.t(cle, { ...opts, lng }) as string

console.log('formaterNombre')
test('français : espace insécable ordinaire entre les milliers (pas l’espace fine, presque invisible)', () => {
  assert.equal(formaterNombre(3475, 'fr'), `3${NBSP}475`)
  assert.equal(formaterNombre(54502, 'fr'), `54${NBSP}502`)
  assert.equal(formaterNombre(1234567, 'fr'), `1${NBSP}234${NBSP}567`)
  assert.ok(!formaterNombre(54502, 'fr').includes(' '))
})
test('rien à séparer sous 1 000 ; les décimales suivent la langue', () => {
  assert.equal(formaterNombre(0, 'fr'), '0')
  assert.equal(formaterNombre(999, 'fr'), '999')
  assert.equal(formaterNombre(1.5, 'fr'), '1,5')
  assert.equal(formaterNombre(1000, 'fr'), `1${NBSP}000`)
})
test('anglais : virgule', () => {
  assert.equal(formaterNombre(3475, 'en'), '3,475')
  assert.equal(formaterNombre(1234567, 'en'), '1,234,567')
})

console.log('formatNumber (nombres affichés directement dans les écrans)')
test('suit la langue active : « 54 502 » en français, « 54,502 » en anglais', async () => {
  const une = { minimumFractionDigits: 1, maximumFractionDigits: 1 }
  await i18n.changeLanguage('fr')
  assert.equal(formatNumber(54502), `54${NBSP}502`)
  assert.equal(formatNumber(21.7, une), '21,7')
  await i18n.changeLanguage('en')
  assert.equal(formatNumber(54502), '54,502')
  assert.equal(formatNumber(21.7, une), '21.7')
  await i18n.changeLanguage('fr')
})

console.log('Textes traduits (les vrais, avec la configuration de l’application)')
test('pagination : « 1 – 10 sur 3 475 résultats »', () => {
  assert.equal(t('pagination.range', { start: 1, end: 10, count: 3475 }), `1 – 10 sur 3${NBSP}475 résultats`)
  assert.equal(t('pagination.range', { start: 1001, end: 1010, count: 54502 }), `1${NBSP}001 – 1${NBSP}010 sur 54${NBSP}502 résultats`)
  assert.equal(t('pagination.range', { start: 1, end: 1, count: 1 }), '1 – 1 sur 1 résultat')
})
test('le pluriel suit le nombre BRUT : 1 000 est un pluriel, 1 un singulier', () => {
  assert.equal(t('pagination.range', { start: 1, end: 1, count: 1000 }), `1 – 1 sur 1${NBSP}000 résultats`)
})
test('en anglais : « of 3,475 results »', () => {
  assert.equal(t('pagination.range', { start: 1, end: 10, count: 3475 }, 'en'), '1 – 10 of 3,475 results')
})
test('chargées sur un total ; compteurs du tableau de bord ; confirmation de purge', () => {
  assert.equal(t('consultation.loadedOf', { loaded: 1200, total: 54502 }), `1${NBSP}200 affichées sur 54${NBSP}502`)
  assert.equal(t('dashboard.kpiClosedTodayHint', { count: 1500 }), `1${NBSP}500 clôturées aujourd'hui`)
  assert.equal(
    t('admin.auditPurgeSubtitle', { actions: 54502, auth: 1733 }),
    `54${NBSP}502 action(s) et 1${NBSP}733 authentification(s) seront effacées`,
  )
  assert.equal(t('rapports.syntheseActes', { count: 3475 }), `3${NBSP}475 consultation(s) sur la période.`)
})
test('tableau de bord : « 3 486 consultations sur 2026. » — l’année reste sans espace', () => {
  assert.equal(t('dashboard.evolutionTotal', { count: 3486, annee: 2026 }), `3${NBSP}486 consultations sur 2026.`)
  assert.equal(t('dashboard.evolutionTotal', { count: 1, annee: 2026 }), '1 consultation sur 2026.')
  assert.equal(t('dashboard.evolutionTotal', { count: 3486, annee: 2026 }, 'en'), '3,486 consultations in 2026.')
})
test('rapports : la comparaison de deux périodes (« 1 535 consultations contre 2 876 »)', () => {
  assert.equal(
    t('rapports.syntheseEnCours', { avant: 2876 }),
    `Période encore en cours : elle ne se compare pas à la période précédente, complète (2${NBSP}876 consultations).`,
  )
  assert.equal(
    t('rapports.alerte.ACTIVITE_BAISSE', { pct: 39, apres: 1535, avant: 2876 }),
    `Activité en baisse de 39 % : 1${NBSP}535 consultations contre 2${NBSP}876 sur la période précédente.`,
  )
})
test('les mêmes variables portant du TEXTE (une taille « 1,2 Mo ») ne sont pas touchées', () => {
  assert.equal(t('messagerie.compressedNote', { avant: '12,0 Mo', apres: '1,2 Mo' }), 'compressée · 12,0 Mo → 1,2 Mo')
})

console.log('Ce qui ne doit JAMAIS être séparé')
test('année, numéro, heure, version : aucune variable de la liste ne les porte', () => {
  for (const interdite of ['annee', 'year', 'numero', 'numeroPatient', 'matricule', 'heure', 'time', 'date', 'code', 'id', 'version', 'phone', 'tel', 'value', 'pct', 'taux', 'duree'])
    assert.equal(CLES_NOMBRE.has(interdite), false, interdite)
  // un nombre sous une variable hors liste n'est pas touché
  i18n.addResource('fr', 'translation', 'essai.annee', 'Rapport {{annee}} n° {{numero}} à {{heure}}')
  assert.equal(t('essai.annee', { annee: 2026, numero: 12345, heure: 1430 }), 'Rapport 2026 n° 12345 à 1430')
})
test('le format explicite « nombre » s’applique à toute variable', () => {
  i18n.addResource('fr', 'translation', 'essai.explicite', '{{value, nombre}} enregistrements')
  assert.equal(t('essai.explicite', { value: 54502 }), `54${NBSP}502 enregistrements`)
  i18n.addResource('en', 'translation', 'essai.explicite', '{{value, nombre}} records')
  assert.equal(t('essai.explicite', { value: 54502 }, 'en'), '54,502 records')
})
test('une valeur qui n’est pas un nombre passe telle quelle (texte, vide)', () => {
  assert.equal(t('consultation.loadedOf', { loaded: '1200', total: '54502' }), '1200 affichées sur 54502')
})
test('les autres traductions (pluriels d’âge) ne sont pas abîmées', () => {
  assert.equal(t('triage.ageAns', { count: 51 }), '51 ans')
  assert.equal(t('triage.ageAns', { count: 1 }), '1 an')
})

// Les tests asynchrones (changement de langue) se terminent avant le bilan.
void Promise.all(attente).then(() => {
  console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
  if (failed > 0) process.exit(1)
})
