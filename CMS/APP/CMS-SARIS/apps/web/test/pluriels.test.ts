/**
 * Les pluriels des libellés d'âge et de compteurs : « 1 an » / « 2 ans », « 1 clôturée » /
 * « 3 clôturées ». Avec la vraie bibliothèque de traduction et les vrais textes — un libellé
 * « {{count}} ans » figé écrit « 1 ans ».
 *   pnpm --filter web exec tsx test/pluriels.test.ts
 */
import assert from 'node:assert/strict'
import i18next from 'i18next'
import { consultation } from '../src/i18n/locales/modules/consultation'
import { dashboard } from '../src/i18n/locales/modules/dashboard'
import { patients } from '../src/i18n/locales/modules/patients'
import { triage } from '../src/i18n/locales/modules/triage'

let passed = 0
let failed = 0
function test(name: string, fn: () => void): void {
  try {
    fn()
    passed++
    console.log('  ✓ ' + name)
  } catch (e) {
    failed++
    console.error('  ✗ ' + name + '\n     ' + (e as Error).message)
  }
}

async function main() {
  await i18next.init({
    lng: 'fr',
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
    resources: {
      fr: { translation: { consultation: consultation.fr, dashboard: dashboard.fr, patients: patients.fr, triage: triage.fr } },
      en: { translation: { consultation: consultation.en, dashboard: dashboard.en, patients: patients.en, triage: triage.en } },
    },
  })
  const t = (cle: string, count: number, lng = 'fr') => i18next.t(cle, { count, lng })

  console.log('Âge (trois libellés : consultation, triage, dossiers)')
  for (const cle of ['consultation.ageYears', 'triage.ageAns', 'patients.infoYears']) {
    test(`${cle} : « 1 an » au singulier, « ans » au pluriel`, () => {
      assert.equal(t(cle, 1), '1 an')
      assert.equal(t(cle, 2), '2 ans')
      assert.equal(t(cle, 51), '51 ans')
      assert.equal(t(cle, 100), '100 ans')
    })
  }
  test('en anglais : « 1 yr » / « 51 yrs » (consultation, triage)', () => {
    assert.equal(t('consultation.ageYears', 1, 'en'), '1 yr')
    assert.equal(t('consultation.ageYears', 51, 'en'), '51 yrs')
    assert.equal(t('triage.ageAns', 1, 'en'), '1 yr')
    assert.equal(t('triage.ageAns', 51, 'en'), '51 yrs')
  })
  test('en anglais, les dossiers disent « y.o. » quel que soit le nombre', () => {
    assert.equal(t('patients.infoYears', 1, 'en'), '1 y.o.')
    assert.equal(t('patients.infoYears', 51, 'en'), '51 y.o.')
  })

  console.log('Tableau de bord')
  test('« 0 / 1 clôturée aujourd’hui », « 3 clôturées aujourd’hui » (le français range 0 avec 1)', () => {
    assert.equal(t('dashboard.kpiClosedTodayHint', 1), '1 clôturée aujourd\'hui')
    assert.equal(t('dashboard.kpiClosedTodayHint', 3), '3 clôturées aujourd\'hui')
    assert.equal(t('dashboard.kpiClosedTodayHint', 0), '0 clôturée aujourd\'hui')
  })
  test('en anglais : « closed today » dans les deux cas', () => {
    assert.equal(t('dashboard.kpiClosedTodayHint', 1, 'en'), '1 closed today')
    assert.equal(t('dashboard.kpiClosedTodayHint', 3, 'en'), '3 closed today')
  })

  console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
  if (failed > 0) process.exit(1)
}
void main()
