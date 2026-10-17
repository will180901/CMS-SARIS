/**
 * Chaque texte demandé à la traduction existe en FRANÇAIS ET en ANGLAIS.
 *   pnpm --filter web exec tsx test/cles-i18n.test.ts
 *
 * Pourquoi : `t('cle', { defaultValue: 'Texte français' })` ne casse JAMAIS — si la clé n'est écrite nulle
 * part, l'écran affiche le texte français par défaut, même en anglais. Plus de 100 textes étaient dans ce
 * cas sans que rien ne le signale. Ce test lit le code source, relève toutes les clés écrites en dur dans
 * un appel `t('…')` et vérifie qu'elles existent dans les DEUX langues. (Les clés construites à la volée,
 * `t(\`a.${b}\`)`, ne sont pas relevables : elles ont leurs propres tests, ex. libelles.test.ts.)
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import i18n from '../src/i18n/config'

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

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

function fichiers(dossier: string): string[] {
  const res: string[] = []
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) {
      if (nom === 'i18n' || nom === 'node_modules') continue // les textes eux-mêmes
      res.push(...fichiers(chemin))
    } else if (/\.(ts|tsx)$/.test(nom)) res.push(chemin)
  }
  return res
}

/** Toutes les clés « a.b.c » d'un paquet de traductions (les objets imbriqués sont aplatis). */
function aplatir(objet: unknown, prefixe = '', sortie = new Set<string>()): Set<string> {
  if (objet && typeof objet === 'object') {
    for (const [k, v] of Object.entries(objet as Record<string, unknown>)) aplatir(v, prefixe ? prefixe + '.' + k : k, sortie)
  } else sortie.add(prefixe)
  return sortie
}

const SUFFIXES_PLURIEL = ['_zero', '_one', '_two', '_few', '_many', '_other']
const existe = (cles: Set<string>, cle: string) => cles.has(cle) || SUFFIXES_PLURIEL.some(s => cles.has(cle + s))

type Appel = { fichier: string; ligne: number; cle: string; defaut: boolean }

/** Les appels `t('cle'…)` / `i18n.t('cle'…)` à clé écrite en dur. */
function appels(): Appel[] {
  const res: Appel[] = []
  const re = /(?<![\w.$])(?:i18n\.|i18next\.)?t\(\s*(['"])([A-Za-z][\w-]*(?:\.[\w-]+)+)\1/g
  for (const f of fichiers(SRC)) {
    const source = readFileSync(f, 'utf8')
    let m: RegExpExecArray | null
    while ((m = re.exec(source))) {
      // le reste de l'appel, jusqu'à la parenthèse fermante qui lui correspond
      let profondeur = 1
      let i = m.index + m[0].length
      for (; i < source.length && profondeur > 0; i++) {
        if (source[i] === '(') profondeur++
        else if (source[i] === ')') profondeur--
      }
      const appel = source.slice(m.index, i)
      res.push({
        fichier: relative(SRC, f).replace(/\\/g, '/'),
        ligne: source.slice(0, m.index).split('\n').length,
        cle: m[2],
        defaut: /defaultValue/.test(appel),
      })
    }
  }
  return res
}

const fr = aplatir(i18n.getResourceBundle('fr', 'translation'))
const en = aplatir(i18n.getResourceBundle('en', 'translation'))
const tous = appels()
const decrire = (a: Appel) => `${a.fichier}:${a.ligne}  ${a.cle}${a.defaut ? '  (defaultValue)' : ''}`

console.log('Clés de traduction écrites dans le code (' + tous.length + ' appels relevés)')
test('le relevé trouve bien les appels (garde-fou du test lui-même)', () => {
  assert.ok(tous.length > 500, 'seulement ' + tous.length + ' appels relevés')
})
test('chaque clé existe en français', () => {
  const manquantes = [...new Map(tous.filter(a => !existe(fr, a.cle)).map(a => [a.cle, a])).values()]
  assert.equal(manquantes.length, 0, manquantes.length + ' clé(s) absente(s) du français :\n     ' + manquantes.map(decrire).join('\n     '))
})
test('chaque clé existe en anglais (sinon l’écran reste en français)', () => {
  const manquantes = [...new Map(tous.filter(a => !existe(en, a.cle)).map(a => [a.cle, a])).values()]
  assert.equal(manquantes.length, 0, manquantes.length + ' clé(s) absente(s) de l’anglais :\n     ' + manquantes.map(decrire).join('\n     '))
})
test('tout texte français a son pendant anglais (même sans appel relevable dans le code)', () => {
  const sansSuffixe = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, '')
  const anglais = new Set([...en].map(sansSuffixe))
  const manquantes = [...new Set([...fr].map(sansSuffixe))].filter(k => !anglais.has(k))
  assert.equal(manquantes.length, 0, manquantes.length + ' texte(s) français sans équivalent anglais :\n     ' + manquantes.slice(0, 60).join('\n     '))
})

console.log('\nParamètres du système (décrits par le serveur, traduits ici)')
test('chaque paramètre du serveur a sa description française ET anglaise (sinon la description française du serveur s’affiche telle quelle)', () => {
  const catalogue = readFileSync(join(SRC, '..', '..', 'api', 'src', 'modules', 'parametres', 'parametres.service.ts'), 'utf8')
  const cles = [...catalogue.matchAll(/^\s+cle:\s*'([a-z_]+\.[a-z_]+)',/gm)].map(m => m[1])
  assert.ok(cles.length >= 15, 'seulement ' + cles.length + ' paramètres relevés dans le catalogue du serveur')
  const sansFr = cles.filter(c => !fr.has('params.' + c))
  const sansEn = cles.filter(c => !en.has('params.' + c))
  assert.deepEqual({ sansFr, sansEn }, { sansFr: [], sansEn: [] })
})

console.log('\nGénérateur de données de test et vidage (libellés envoyés par le serveur, traduits ici)')
test('chaque table du registre, du vidage et chaque « autre donnée » a son libellé en français ET en anglais', () => {
  const api = join(SRC, '..', '..', 'api', 'src', 'modules')
  const registre = readFileSync(join(api, 'donnees-test', 'registre.ts'), 'utf8')
  const vidage = readFileSync(join(api, 'donnees-test', 'vidage.service.ts'), 'utf8')
  const metier = readFileSync(join(api, 'sync', 'vidage-metier.ts'), 'utf8')
  const modeles = [...registre.matchAll(/modele:\s*'(\w+)'/g)].map(m => m[1])
  const complementaires = [...(/LIBELLES_COMPLEMENTAIRES[^{]*\{([^}]*)\}/.exec(vidage)?.[1] ?? '').matchAll(/(\w+):\s*'/g)].map(m => m[1])
  const autres = [...(/AUTRES_DONNEES_METIER\s*=\s*\{([^}]*)\}/.exec(metier)?.[1] ?? '').matchAll(/(\w+):\s*'/g)].map(m => m[1])
  assert.ok(modeles.length >= 30, 'seulement ' + modeles.length + ' modèles relevés dans le registre')
  assert.ok(complementaires.length >= 1 && autres.length >= 3, 'relevé des libellés complémentaires / autres données en panne')
  const attendues = [
    ...[...modeles, ...complementaires].map(m => 'donneesTest.modeles.' + m),
    ...[...autres, 'journauxDeTest'].map(c => 'donneesTest.autres.' + c),
  ]
  const sansFr = attendues.filter(c => !fr.has(c))
  const sansEn = attendues.filter(c => !en.has(c))
  assert.deepEqual({ sansFr, sansEn }, { sansFr: [], sansEn: [] })
})

console.log('\nMode de vie du patient (valeurs enregistrées en français, affichées dans la langue de l’écran)')
test('chaque choix proposé a sa traduction, et chaque rubrique son libellé', () => {
  const carte = readFileSync(join(SRC, 'modules', 'patients', 'components', 'dossier', 'ModeVieCard.tsx'), 'utf8')
  const cleValeur = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+(\S)/g, (_, c: string) => c.toUpperCase())
  const choix = [...new Set([...carte.matchAll(/choix:\s*\[([^\]]*)\]/g)].flatMap(m => [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1])))]
  const rubriques = [...carte.matchAll(/\{\s*key:\s*'(\w+)',\s*label:/g)].map(m => m[1])
  assert.ok(choix.length >= 12 && rubriques.length === 10, choix.length + ' choix et ' + rubriques.length + ' rubriques relevés')
  const attendues = [...choix.map(c => 'patients.modeVie.val.' + cleValeur(c)), ...rubriques.map(r => 'patients.modeVie.' + r)]
  const sansFr = attendues.filter(c => !fr.has(c))
  const sansEn = attendues.filter(c => !en.has(c))
  assert.deepEqual({ sansFr, sansEn }, { sansFr: [], sansEn: [] })
})

console.log('\nLibellés de repli écrits par le serveur dans les statistiques')
test('« Non précisé » et « Non renseigné » ont leur traduction, et le serveur envoie bien ces deux textes', () => {
  const repli = readFileSync(join(SRC, 'lib', 'libellesStat.ts'), 'utf8')
  const cles = [...repli.matchAll(/'([a-z]+\.[A-Za-z]+)'/g)].map(m => m[1])
  assert.equal(cles.length, 2, 'deux clés attendues, ' + cles.length + ' relevées')
  assert.deepEqual({ sansFr: cles.filter(c => !fr.has(c)), sansEn: cles.filter(c => !en.has(c)) }, { sansFr: [], sansEn: [] })
  // le texte français que le serveur écrit doit être EXACTEMENT celui que le client reconnaît
  const dashboard = readFileSync(join(SRC, '..', '..', 'api', 'src', 'modules', 'dashboard', 'dashboard.service.ts'), 'utf8')
  for (const texte of [...repli.matchAll(/^\s+'([^']+)':\s*'/gm)].map(m => m[1]))
    assert.ok(dashboard.includes("'" + texte + "'"), 'le serveur n’écrit plus « ' + texte + ' »')
})

console.log('\nJournal d’audit : types d’entité écrits par le serveur')
test('chaque libellé donné à @Audit(…) par un contrôleur est traduit en français ET en anglais', () => {
  const modules = join(SRC, '..', '..', 'api', 'src', 'modules')
  const sources: string[] = []
  const parcourir = (d: string) => {
    for (const nom of readdirSync(d)) {
      const c = join(d, nom)
      if (statSync(c).isDirectory()) parcourir(c)
      else if (nom.endsWith('.controller.ts')) sources.push(readFileSync(c, 'utf8'))
    }
  }
  parcourir(modules)
  const entites = new Set<string>()
  for (const s of sources)
    for (const m of s.matchAll(/@Audit\(\s*'[a-z_]+'\s*,\s*(['"])(.+?)\1\s*\)/g)) entites.add(m[2])
  assert.ok(entites.size >= 8, 'seulement ' + entites.size + ' types d’entité relevés')
  // un libellé qui est déjà un NOM DE MODÈLE (« Patient ») passe par la table des entités ; les autres sont des phrases
  const attendues = [...entites].map(e => 'labels.entite.' + e)
  const sansFr = attendues.filter(c => !fr.has(c))
  const sansEn = attendues.filter(c => !en.has(c))
  assert.deepEqual({ sansFr, sansEn }, { sansFr: [], sansEn: [] })
})

console.log('\n' + passed + ' reussis, ' + failed + ' echoues')
if (failed > 0) process.exit(1)
