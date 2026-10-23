/**
 * Lecture du fichier de déploiement (cf. electron/deploiement.ts) — logique pure, sans Electron.
 *   pnpm --filter @cms-saris/desktop test
 */
import assert from 'node:assert/strict'
import { analyserDeploiement, decoderFichier, retirerCode, trouverSite } from '../electron/deploiement.ts'

let reussis = 0
let echoues = 0
function test(nom: string, fn: () => void): void {
  try {
    fn()
    reussis++
    console.log('  ✓ ' + nom)
  } catch (e) {
    echoues++
    console.error('  ✗ ' + nom + '\n     ' + (e as Error).message)
  }
}

console.log('analyserDeploiement')
test('lit les trois valeurs et remplace {MACHINE} par le nom de l’ordinateur', () => {
  const d = analyserDeploiement('[deploiement]\r\nserveur=https://cms.exemple.org/\r\nsite=BZV-01\r\nposte=Accueil {MACHINE}\r\n', 'PC-07')
  assert.deepEqual(d, { serveur: 'https://cms.exemple.org', site: 'BZV-01', poste: 'Accueil PC-07' })
})
test('ignore la casse des clés et du marqueur, les commentaires, les guillemets et le BOM', () => {
  const d = analyserDeploiement('\uFEFF; préparé le 22/10\n[Deploiement]\n# note\nSERVEUR = "http://192.168.1.10:3000"\nSite="Pointe-Noire"\n', 'X')
  assert.deepEqual(d, { serveur: 'http://192.168.1.10:3000', site: 'Pointe-Noire' })
})
test('une adresse sans http(s):// est ignorée (jamais devinée)', () => {
  assert.deepEqual(analyserDeploiement('serveur=cms.exemple.org\nsite=A', 'X'), { site: 'A' })
  assert.deepEqual(analyserDeploiement('serveur=ftp://x\nserveur=', 'X'), {})
})
test('les valeurs vides, les clés inconnues et les autres sections sont ignorées', () => {
  const d = analyserDeploiement('[autre]\nserveur=http://non\n[deploiement]\nsite=\nmotdepasse=secret\nposte=P1', 'X')
  assert.deepEqual(d, { poste: 'P1' })
})
test('un texte vide ou illisible donne un déploiement vide', () => {
  assert.deepEqual(analyserDeploiement('', 'X'), {})
  assert.deepEqual(analyserDeploiement('n\'importe quoi\n===\n[', 'X'), {})
})
test('un nom trop long est tronqué à 80 caractères', () => {
  assert.equal(analyserDeploiement('poste=' + 'a'.repeat(200), 'X').poste?.length, 80)
})

test('lit le code d’appairage (lettres, chiffres, tirets, espaces)', () => {
  assert.deepEqual(analyserDeploiement('[deploiement]\ncode=K7QM-4XPD\n', 'X'), { code: 'K7QM-4XPD' })
  assert.deepEqual(analyserDeploiement('code = "k7qm 4xpd"', 'X'), { code: 'k7qm 4xpd' })
})
test('un code avec des caractères étranges, ou trop long, est ignoré', () => {
  assert.deepEqual(analyserDeploiement('code=K7QM;4XPD', 'X'), {})
  assert.deepEqual(analyserDeploiement('code=<script>', 'X'), {})
  assert.deepEqual(analyserDeploiement('code=' + 'A'.repeat(41), 'X'), {})
})

console.log('retirerCode')
test('retire la ligne code= et garde tout le reste', () => {
  const avant = '[deploiement]\r\nserveur=https://cms.exemple.org\r\ncode=K7QM-4XPD\r\nsite=BZV-01\r\n'
  const apres = retirerCode(avant)
  assert.equal(apres, '[deploiement]\r\nserveur=https://cms.exemple.org\r\nsite=BZV-01\r\n')
  assert.deepEqual(analyserDeploiement(apres, 'X'), { serveur: 'https://cms.exemple.org', site: 'BZV-01' })
})
test('ignore la casse de la clé et les espaces autour du signe égal', () => {
  assert.equal(retirerCode('[Deploiement]\nCODE = K7QM-4XPD\nposte=P1'), '[Deploiement]\r\nposte=P1')
})
test('ne touche ni aux commentaires, ni aux autres sections', () => {
  const texte = '; code=ABC\n[autre]\ncode=NON\n[deploiement]\nposte=P1'
  assert.equal(retirerCode(texte), texte)
})
test('sans ligne code=, le texte est rendu tel quel (octet pour octet)', () => {
  const texte = '[deploiement]\nserveur=http://x\n'
  assert.equal(retirerCode(texte), texte)
})

console.log('decoderFichier')
test('lit l’UTF-8 (Bloc-notes)', () => {
  assert.equal(decoderFichier(new TextEncoder().encode('poste=Accueil é')), 'poste=Accueil é')
})
test('lit le Windows-1252 écrit par les fonctions INI de l’installateur (« é » = 0xE9)', () => {
  assert.equal(decoderFichier(Uint8Array.from([0x70, 0x6f, 0x73, 0x74, 0x65, 0x3d, 0x41, 0xe9])), 'poste=Aé')
})
test('un fichier MIXTE (ligne UTF-8 du Bloc-notes + ligne Windows-1252 de l’installateur) est lu ligne par ligne', () => {
  const mixte = Buffer.concat([Buffer.from('poste=Salle é\r\n', 'utf8'), Buffer.from([0x73, 0x69, 0x74, 0x65, 0x3d, 0x4c, 0xe9, 0x6f, 0x0d, 0x0a])])
  assert.deepEqual(analyserDeploiement(decoderFichier(mixte), 'X'), { poste: 'Salle é', site: 'Léo' })
})
test('lit l’UTF-16 « Unicode » du Bloc-notes', () => {
  const u16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('site=BZV é', 'utf16le')])
  assert.equal(decoderFichier(u16).replace(/^\uFEFF/, ''), 'site=BZV é')
})

console.log('trouverSite')
const sites = [
  { id: '1', code: 'BZV-01', libelle: 'Brazzaville Centre' },
  { id: '2', code: 'PNR-02', libelle: 'Pointe-Noire' },
  { id: '3', code: 'PNR', libelle: 'Pointe-Noire Nord' },
]
test('trouve par code, sans tenir compte de la casse', () => {
  assert.equal(trouverSite(sites, 'bzv-01')?.id, '1')
})
test('trouve par libellé exact', () => {
  assert.equal(trouverSite(sites, 'pointe-noire')?.id, '2')
})
test('le code l’emporte sur un libellé qui lui ressemble', () => {
  assert.equal(trouverSite(sites, 'PNR')?.id, '3')
})
test('jamais de correspondance approximative : « Pointe » ne désigne aucun site', () => {
  assert.equal(trouverSite(sites, 'Pointe'), null)
})
test('rien de demandé, ou rien de trouvé : null', () => {
  assert.equal(trouverSite(sites, undefined), null)
  assert.equal(trouverSite(sites, '  '), null)
  assert.equal(trouverSite([], 'BZV-01'), null)
})

console.log(`\n${reussis} reussis, ${echoues} echoues`)
if (echoues > 0) process.exit(1)
