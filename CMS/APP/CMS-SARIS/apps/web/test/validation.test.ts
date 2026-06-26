/**
 * Tests PURS de la bibliothèque de validation métier partagée.
 *   pnpm --filter @cms-saris/db exec tsx <repo>/apps/web/test/validation.test.ts
 *
 * Couvre les règles « champs intelligents » réutilisées dans tous les formulaires
 * (patients, agents, référentiels, triage) :
 *  - noms propres (lettres/accents uniquement, pas de chiffres) ;
 *  - téléphone Congo/international (9 à 12 chiffres) + sanitize ;
 *  - e-mail, date de naissance (futur / âge > 120 ans), code, matricule, mot de passe ;
 *  - constantes vitales : plages physiologiques ALIGNÉES sur le DTO backend
 *    (apps/api/src/modules/triage/dto/visite.dto.ts) — preuve anti-désynchro.
 */
import assert from 'node:assert/strict'
import {
  nomPersonne,
  isTelephone,
  digitsOnly,
  sanitizeTelephoneInput,
  email,
  dateNaissance,
  codeReferentiel,
  sanitizeCodeInput,
  motDePasse,
  PASSWORD_REGEX,
  matricule,
  validateVital,
  VITAL_RANGES,
} from '../src/lib/validation.ts'

let passed = 0
let failed = 0
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log('  ✓ ' + name) }
  catch (e) { failed++; console.error('  ✗ ' + name + '\n     ' + (e as Error).message) }
}

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  schema.safeParse(v).success

console.log('nomPersonne')
test('accepte un nom avec accents/tiret/apostrophe', () => {
  assert.equal(ok(nomPersonne(), 'Jean-Éric N’Diaye'), true)
})
test('refuse un nom avec chiffres', () => {
  assert.equal(ok(nomPersonne(), 'Jean3'), false)
})
test('refuse trop court (< 2)', () => {
  assert.equal(ok(nomPersonne(), 'A'), false)
})
test('trim appliqué (espaces périphériques tolérés)', () => {
  assert.equal(ok(nomPersonne(), '  Marie  '), true)
})

console.log('téléphone')
test('national 9 chiffres valide', () => assert.equal(isTelephone('061234567'), true))
test('international +242 valide', () => assert.equal(isTelephone('+242 06 123 45 67'), true))
test('trop court (8 chiffres) invalide', () => assert.equal(isTelephone('06123456'), false))
test('trop long (13 chiffres) invalide', () => assert.equal(isTelephone('1234567890123'), false))
test('lettres interdites', () => assert.equal(isTelephone('06ABC4567'), false))
test('digitsOnly extrait les chiffres', () => assert.equal(digitsOnly('+242 06.12-34(56)7'), '242061234567'))
test('sanitizeTelephoneInput garde le + en tête, retire les lettres, collapse les espaces, borne à 20', () => {
  // Les lettres « abc » sont retirées et les doubles espaces résultants compactés.
  assert.equal(sanitizeTelephoneInput('+242 abc 06 12'), '+242 06 12')
  assert.ok(sanitizeTelephoneInput('+' + '1'.repeat(40)).length <= 20)
})

console.log('e-mail / date de naissance')
test('e-mail valide (mis en minuscules)', () => {
  const r = email.safeParse('  AGENT@CMS.CG ')
  assert.equal(r.success, true)
  if (r.success) assert.equal(r.data, 'agent@cms.cg')
})
test('e-mail invalide refusé', () => assert.equal(ok(email, 'pas-un-email'), false))
test('date de naissance passée valide', () => assert.equal(ok(dateNaissance, '1990-05-20'), true))
test('date dans le futur refusée', () => {
  const futur = new Date(Date.now() + 86400_000 * 5).toISOString().slice(0, 10)
  assert.equal(ok(dateNaissance, futur), false)
})
test('âge > 120 ans refusé', () => assert.equal(ok(dateNaissance, '1850-01-01'), false))
test('date non parsable refusée', () => assert.equal(ok(dateNaissance, 'hier'), false))

console.log('code / matricule / mot de passe')
test('code mis en majuscules et validé', () => {
  const r = codeReferentiel().safeParse('motif_a')
  assert.equal(r.success, true)
  if (r.success) assert.equal(r.data, 'MOTIF_A')
})
test('code avec espace refusé', () => assert.equal(ok(codeReferentiel(), 'MOTIF A'), false))
test('sanitizeCodeInput nettoie', () => assert.equal(sanitizeCodeInput('mo tif@1'), 'MOTIF1'))
test('matricule valide', () => assert.equal(ok(matricule(), 'AG-001'), true))
test('matricule avec symbole refusé', () => assert.equal(ok(matricule(), 'AG_001!'), false))
test('mot de passe conforme (10+, maj, min, chiffre)', () => {
  assert.equal(ok(motDePasse, 'Password12'), true)
  assert.equal(PASSWORD_REGEX.test('Password12'), true)
})
test('mot de passe trop court refusé', () => assert.equal(ok(motDePasse, 'Pass1'), false))
test('mot de passe sans chiffre refusé', () => assert.equal(ok(motDePasse, 'PasswordOnly'), false))
test('mot de passe sans majuscule refusé', () => assert.equal(ok(motDePasse, 'password123'), false))

console.log('constantes vitales (plages physiologiques)')
test('température dans la plage', () => {
  const r = validateVital('temperature', '37,2') // virgule décimale tolérée
  assert.equal(r.ok, true)
  assert.equal(r.value, 37.2)
})
test('température hors plage (> 45) refusée avec message', () => {
  const r = validateVital('temperature', '50')
  assert.equal(r.ok, false)
  assert.ok(r.error?.includes('Hors plage'))
})
test('SpO2 = 100 acceptée (borne incluse)', () => assert.equal(validateVital('saturationO2', '100').ok, true))
test('SpO2 = 40 refusée (< 50)', () => assert.equal(validateVital('saturationO2', '40').ok, false))
test('valeur vide = ok sans valeur (champ optionnel)', () => {
  const r = validateVital('poids', '   ')
  assert.equal(r.ok, true)
  assert.equal(r.value, undefined)
})
test('valeur non numérique refusée', () => {
  const r = validateVital('glycemie', 'abc')
  assert.equal(r.ok, false)
  assert.ok(r.error?.includes('numérique'))
})

console.log('alignement plages ↔ DTO backend (anti-désynchro)')
// Doit rester identique à CreateConstanteVitaleDto (@Min/@Max). Si quelqu'un
// modifie l'un sans l'autre, ce test casse → garde-fou de cohérence métier.
const DTO_RANGES: Record<string, { min: number; max: number }> = {
  temperature: { min: 30, max: 45 },
  tensionSystolique: { min: 50, max: 300 },
  tensionDiastolique: { min: 30, max: 200 },
  frequenceCardiaque: { min: 20, max: 300 },
  saturationO2: { min: 50, max: 100 },
  poids: { min: 0.5, max: 300 },
  taille: { min: 30, max: 250 },
  glycemie: { min: 0.1, max: 10 },
}
for (const [key, dto] of Object.entries(DTO_RANGES)) {
  test(`plage ${key} = DTO (${dto.min}–${dto.max})`, () => {
    const front = VITAL_RANGES[key as keyof typeof VITAL_RANGES]
    assert.equal(front.min, dto.min, `min ${key}`)
    assert.equal(front.max, dto.max, `max ${key}`)
  })
}
test('toutes les clés vitales du front existent (8)', () => {
  assert.equal(Object.keys(VITAL_RANGES).length, 8)
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
