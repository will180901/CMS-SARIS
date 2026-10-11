/**
 * Tests unitaires du générateur de données de test — la partie sans base :
 *  - la marque des identifiants (UUID valides, reconnaissables, jamais confondus avec un vrai) ;
 *  - le générateur pseudo-aléatoire (reproductible), le calendrier (jours d'ouverture, heures) ;
 *  - les identités (jamais deux fois le même nom complet, téléphone, matricule, numéro de dossier) ;
 *  - le planificateur d'une période entière : les lignes obéissent aux règles du parcours réel
 *    (un médecin ne tient pas deux consultations à la fois, une visite clôturée a sa consultation
 *    clôturée et ses diagnostics, les données de catégorie sont complètes, les clés étrangères se
 *    referment, les dates se suivent…).
 *   pnpm --filter api exec tsx test/donnees-test.test.ts
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { creerAlea } from '../src/modules/donnees-test/alea'
import {
  apresDelaiOuvre,
  estFerie,
  estOuvert,
  horairesDuJour,
  instantLocal,
  instantSecondes,
  jourLocalDe,
  joursEntre,
  jourOuvertSuivant,
  minutesArrivees,
} from '../src/modules/donnees-test/calendrier'
import {
  genererConstantes,
  nouvelleMorphologie,
} from '../src/modules/donnees-test/constantes-vitales'
import {
  DEPARTEMENTS_EMPLOYES,
  NOMS_DE_FAMILLE,
  PRENOMS_FEMININS,
  PRENOMS_MASCULINS,
} from '../src/modules/donnees-test/catalogue-identites'
import {
  FabriqueIdentites,
  Numerotation,
  chiffres,
  cleNom,
} from '../src/modules/donnees-test/fabrique-identites'
import {
  MARQUE_ID,
  estIdTest,
  nouvelIdTest,
} from '../src/modules/donnees-test/marque-test'
import {
  planifierJour,
  profilsDisponibles,
} from '../src/modules/donnees-test/planificateur'
import { Population } from '../src/modules/donnees-test/population'
import {
  avecJours,
  cleMedicament,
  medicamentIncompatible,
} from '../src/modules/donnees-test/planificateur-documents'
import { classerSoignant } from '../src/modules/donnees-test/donnees-test.service'
import {
  ipCongolaise,
  ipsDuSite,
} from '../src/modules/donnees-test/catalogue-reseau'
import {
  calculerPrevisions,
  capaciteSite,
  periode,
} from '../src/modules/donnees-test/previsions'
import {
  MODELES_TEST,
  lignesVides,
  type LignesJour,
} from '../src/modules/donnees-test/registre'
import type {
  ContexteJour,
  EquipeSite,
  MedicamentTest,
  ReferentielsTest,
  Soignant,
} from '../src/modules/donnees-test/contexte'

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

// ── La marque ────────────────────────────────────────────────────────────────

console.log('marque des identifiants')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
test('un identifiant de test est un UUID version 4 valide (les routes et DTO l’acceptent)', () => {
  for (let i = 0; i < 2000; i++) {
    const id = nouvelIdTest()
    assert.match(id, UUID)
    assert.match(id, UUID_V4)
  }
})
test('il porte la marque, et seulement lui', () => {
  assert.equal(MARQUE_ID.length, 15)
  assert.ok(estIdTest(nouvelIdTest()))
  assert.equal(estIdTest(randomUUID()), false)
  assert.equal(estIdTest(''), false)
  assert.equal(estIdTest(null), false)
  assert.equal(estIdTest(undefined), false)
  // Une marque tronquée ou décalée n’en est pas une.
  assert.equal(estIdTest(MARQUE_ID.slice(1) + '0abc-8def-0123456789ab'), false)
})
test('100 000 identifiants : aucun doublon', () => {
  const vus = new Set<string>()
  for (let i = 0; i < 100_000; i++) vus.add(nouvelIdTest())
  assert.equal(vus.size, 100_000)
})
test('un UUID aléatoire ordinaire ne porte jamais la marque (20 000 tirages)', () => {
  for (let i = 0; i < 20_000; i++) assert.equal(estIdTest(randomUUID()), false)
})

// ── Le hasard semé ───────────────────────────────────────────────────────────

console.log('générateur pseudo-aléatoire')
test('la même graine redonne la même suite, une autre graine une autre', () => {
  const a = creerAlea('graine-1')
  const b = creerAlea('graine-1')
  const c = creerAlea('graine-2')
  const sa = Array.from({ length: 20 }, () => a.float())
  const sb = Array.from({ length: 20 }, () => b.float())
  const sc = Array.from({ length: 20 }, () => c.float())
  assert.deepEqual(sa, sb)
  assert.notDeepEqual(sa, sc)
})
test('entier : bornes comprises, et toutes les valeurs sortent', () => {
  const a = creerAlea('entiers')
  const vus = new Set<number>()
  for (let i = 0; i < 2000; i++) {
    const n = a.entier(3, 8)
    assert.ok(n >= 3 && n <= 8)
    vus.add(n)
  }
  assert.equal(vus.size, 6)
})
test('pondere respecte les poids (un poids nul ne sort jamais)', () => {
  const a = creerAlea('poids')
  const n = { rare: 0, courant: 0, jamais: 0 }
  for (let i = 0; i < 20_000; i++)
    n[
      a.pondere([
        ['rare', 1],
        ['courant', 9],
        ['jamais', 0],
      ] as const)
    ]++
  assert.equal(n.jamais, 0)
  assert.ok(
    n.courant / n.rare > 6 && n.courant / n.rare < 13,
    `rapport ${n.courant / n.rare}`,
  )
})
test('normaleBornee reste dans ses bornes, centrée sur la moyenne', () => {
  const a = creerAlea('normale')
  let somme = 0
  for (let i = 0; i < 5000; i++) {
    const x = a.normaleBornee(100, 15, 60, 140)
    assert.ok(x >= 60 && x <= 140)
    somme += x
  }
  assert.ok(Math.abs(somme / 5000 - 100) < 2)
})
test('sousFlux : indépendant du flux parent, et reproductible', () => {
  const p1 = creerAlea('p')
  const p2 = creerAlea('p')
  p1.float()
  assert.equal(p1.sousFlux('x').float(), p2.sousFlux('x').float())
  assert.notEqual(p1.sousFlux('x').float(), p1.sousFlux('y').float())
})
test('choisir / melanger : liste vide refusée, mélange = mêmes éléments', () => {
  const a = creerAlea('liste')
  assert.throws(() => a.choisir([]))
  const m = a.melanger([1, 2, 3, 4, 5, 6])
  assert.deepEqual([...m].sort(), [1, 2, 3, 4, 5, 6])
})

// ── Le calendrier ────────────────────────────────────────────────────────────

console.log('calendrier')
test('le centre est fermé le dimanche et les jours fériés, demi-journée le samedi', () => {
  assert.equal(estOuvert('2026-10-11'), false) // dimanche
  assert.equal(estOuvert('2026-08-15'), false) // Fête de l’Indépendance (samedi férié)
  assert.equal(estOuvert('2026-12-25'), false)
  assert.equal(estFerie('2026-05-01'), true)
  const lundi = horairesDuJour('2026-10-12')
  const samedi = horairesDuJour('2026-10-10')
  assert.ok(
    lundi &&
      !lundi.demiJournee &&
      lundi.ouverture === 450 &&
      lundi.fermeture === 990,
  )
  assert.ok(samedi && samedi.demiJournee && samedi.fermeture < lundi.fermeture)
})
test('joursEntre : bornes comprises, mois et années franchis', () => {
  const j = joursEntre('2026-12-30', '2027-01-02')
  assert.deepEqual(j, ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  assert.equal(joursEntre('2026-06-11', '2026-10-10').length, 122)
})
test('heure locale → UTC : Brazzaville est à UTC+1', () => {
  // 08:00 à Brazzaville = 07:00 UTC
  assert.equal(
    instantLocal('2026-10-12', 8 * 60).toISOString(),
    '2026-10-12T07:00:00.000Z',
  )
  // 00:30 local est encore la veille en UTC
  assert.equal(
    instantLocal('2026-10-12', 30).toISOString(),
    '2026-10-11T23:30:00.000Z',
  )
  assert.equal(jourLocalDe(new Date('2026-10-11T23:30:00.000Z')), '2026-10-12')
})
test('les arrivées sont triées, dans les heures d’ouverture, et se concentrent matin et après-midi', () => {
  const h = horairesDuJour('2026-10-12')!
  const m = minutesArrivees(creerAlea('arrivees'), 400, h)
  assert.equal(m.length, 400)
  for (let i = 0; i < m.length; i++) {
    assert.ok(m[i] >= h.ouverture && m[i] <= h.fermeture - 30)
    if (i > 0) assert.ok(m[i] >= m[i - 1])
  }
  const matin = m.filter((x) => x < 12 * 60).length
  assert.ok(matin > 160 && matin < 300, `matin : ${matin}`)
})

// ── Les identités ────────────────────────────────────────────────────────────

console.log('identités')
test('les listes de prénoms et de noms n’ont pas de doublon', () => {
  for (const l of [PRENOMS_MASCULINS, PRENOMS_FEMININS, NOMS_DE_FAMILLE])
    assert.equal(new Set(l).size, l.length)
  assert.equal(
    new Set(PRENOMS_MASCULINS.map((p) => cleNom(p, 'X'))).size,
    PRENOMS_MASCULINS.length,
  )
})
test('5 000 personnes : jamais deux fois le même nom complet, téléphone ni matricule', () => {
  const f = new FabriqueIdentites(creerAlea('unicite'))
  const noms = new Set<string>()
  const tels = new Set<string>()
  const mats = new Set<string>()
  for (let i = 0; i < 5000; i++) {
    const { nom, prenom } = f.nomComplet(i % 3 === 0 ? 'F' : 'M')
    const cle = cleNom(prenom, nom)
    assert.equal(noms.has(cle), false, `${prenom} ${nom}`)
    noms.add(cle)
    const t = chiffres(f.telephone())
    assert.equal(tels.has(t), false)
    tels.add(t)
    const m = f.matricule(i % 2 ? 'CDI' : 'CDD')
    assert.equal(mats.has(m), false)
    mats.add(m)
  }
})
test('ce qui existe déjà en base n’est jamais refabriqué', () => {
  const alea = creerAlea('deja')
  const premier = new FabriqueIdentites(alea.sousFlux('a'))
  const pris = premier.nomComplet('M')
  // même graine : sans la liste des noms déjà pris, la fabrique retomberait sur le même
  const rejoue = new FabriqueIdentites(alea.sousFlux('a'), {
    noms: [cleNom(pris.prenom, pris.nom)],
  })
  const autre = rejoue.nomComplet('M')
  assert.notEqual(
    cleNom(autre.prenom, autre.nom),
    cleNom(pris.prenom, pris.nom),
  )
})
test('un enfant garde le nom de sa famille, mais jamais le même prénom qu’un frère', () => {
  const f = new FabriqueIdentites(creerAlea('famille'))
  const prenoms = new Set<string>()
  for (let i = 0; i < 40; i++) {
    const e = f.nomComplet(i % 2 ? 'M' : 'F', 'MOUKOKO')
    assert.equal(e.nom, 'MOUKOKO')
    assert.equal(prenoms.has(e.prenom), false)
    prenoms.add(e.prenom)
  }
})
test('numéros de dossier : à la suite de l’existant, par site, sur 5 chiffres', () => {
  const n = new Numerotation(new Map([['MOU', 41]]))
  assert.equal(n.prochain('MOU'), 'PAT-MOU-00042')
  assert.equal(n.prochain('MOU'), 'PAT-MOU-00043')
  assert.equal(n.prochain('NKA'), 'PAT-NKA-00001')
})
test('le téléphone suit le format du dossier et passe la règle du serveur (9 à 12 chiffres)', () => {
  const f = new FabriqueIdentites(creerAlea('tel'))
  const regle = /^$|^(?=(?:\D*\d){9,12}\D*$)\+?[0-9\s.\-()]+$/
  for (let i = 0; i < 500; i++) {
    const t = f.telephone()
    assert.match(t, /^\+242 0[456] \d{3} \d{4}$/)
    assert.match(t, regle)
  }
})

// ── Les constantes vitales ───────────────────────────────────────────────────

console.log('constantes vitales')
test('toutes les valeurs restent dans les plages que le serveur accepte', () => {
  const a = creerAlea('constantes')
  for (let i = 0; i < 3000; i++) {
    const age = a.entier(0, 88)
    const sexe = a.proba(0.5) ? 'M' : 'F'
    const c = genererConstantes({
      alea: a,
      age,
      morphologie: nouvelleMorphologie(a, sexe, a.proba(0.2) ? 2 : 0),
      profil: {},
    })
    if (!c) continue
    const dans = (v: number | null, min: number, max: number) =>
      v === null || (v >= min && v <= max)
    assert.ok(dans(c.temperature, 30, 45))
    assert.ok(dans(c.tensionSystolique, 50, 300))
    assert.ok(dans(c.tensionDiastolique, 30, 200))
    assert.ok(dans(c.frequenceCardiaque, 20, 300))
    assert.ok(dans(c.frequenceRespiratoire, 4, 80))
    assert.ok(dans(c.saturationO2, 50, 100))
    assert.ok(dans(c.poids, 0.5, 300))
    assert.ok(dans(c.taille, 30, 250))
    assert.ok(dans(c.glycemie, 0.1, 10))
    if (c.tensionSystolique !== null && c.tensionDiastolique !== null)
      assert.ok(
        c.tensionSystolique - c.tensionDiastolique >= 17,
        `${c.tensionSystolique}/${c.tensionDiastolique}`,
      )
  }
})
test('une personne garde sa taille d’une visite à l’autre ; un enfant grandit', () => {
  const a = creerAlea('morpho')
  const m = nouvelleMorphologie(a, 'M')
  const tailles = new Set<number>()
  for (let i = 0; i < 20; i++) {
    const c = genererConstantes({
      alea: a,
      age: 35,
      morphologie: m,
      profil: {},
    })
    if (c?.taille) tailles.add(c.taille)
  }
  assert.equal(tailles.size, 1)
  const e = nouvelleMorphologie(a, 'F')
  const taille = (age: number) => {
    for (let i = 0; i < 50; i++) {
      const c = genererConstantes({ alea: a, age, morphologie: e, profil: {} })
      if (c?.taille) return c.taille
    }
    return 0
  }
  assert.ok(taille(12) > taille(4) + 25)
})

// ── La période entière ───────────────────────────────────────────────────────

console.log('planificateur : une période de plusieurs mois')

function uuid(): string {
  return randomUUID()
}

interface Banc {
  ctx: (jour: string, indexJour: number, totalJours: number) => ContexteJour
  medecins: Soignant[]
  infirmiers: Soignant[]
  ref: ReferentielsTest
  population: Population
  deja: Set<string>
}

function bancDeTest(
  graine: string,
  visitesParJour: number,
  finPeriode: string,
): Banc {
  const alea = creerAlea(graine)
  const siteM = uuid()
  const siteN = uuid()
  const faire = (siteId: string): Soignant => ({
    utilisateurId: uuid(),
    personnelId: uuid(),
    siteId,
  })
  const medecinsM = [faire(siteM), faire(siteM)]
  const infirmiersM = [faire(siteM), faire(siteM)]
  const medecinsN = [faire(siteN)]
  const infirmiersN = [faire(siteN)]
  const equipes: EquipeSite[] = [
    {
      siteId: siteM,
      siteCode: 'MOUTELA',
      medecins: medecinsM,
      infirmiers: infirmiersM,
    },
    {
      siteId: siteN,
      siteCode: 'NKAYI',
      medecins: medecinsN,
      infirmiers: infirmiersN,
    },
  ]
  const codes = (liste: string[]) =>
    new Map(liste.map((c) => [c, uuid()] as const))
  const pathologies = codes([
    'PALUDISME',
    'DIABETE_TYPE2',
    'HTA',
    'TUBERCULOSE',
    'VIH_SIDA',
    'DREPANOCYTOSE',
    'ANEMIE',
    'GASTROENTERITE',
    'PNEUMONIE',
    'INSUFFISANCE_CARD',
    'GROSSESSE',
    'TRAUMATISME_PHYSIQUE',
    'ASTHME',
    'MALADIE_CARDIAQUE',
    'ALLERGIE_CHRONIQUE',
  ])
  const ref: ReferentielsTest = {
    categories: codes([
      'ASSURE_CDI',
      'AYANT_DROIT_CDI',
      'ASSURE_CDD',
      'SOUS_TRAITANT',
      'RIVERAIN',
      'RETRAITE',
      'AGENT_FONCTIONNAIRE',
      'PATIENT_EXTERNE',
    ]),
    motifs: new Map(
      [
        'URGENCE_VITALE',
        'DIFFICULTES_RESPI',
        'TRAUMATISME',
        'PALUDISME_SUSPECT',
        'FIEVRE_FORTE',
        'DOULEUR_ABDOMINALE',
        'SUIVI_GROSSESSE',
        'SUIVI_CHRONIQUE',
        'DIARRHEE',
        'PEDIATRIE',
        'HYPERTENSION_CONTROLE',
        'CONSULTATION_GENERALE',
        'DERMATOLOGIE',
        'OPHTALMOLOGIE',
        'VACCINATION',
      ].map(
        (c) =>
          [c, { id: uuid(), triageAllege: c === 'OPHTALMOLOGIE' }] as const,
      ),
    ),
    pathologies,
    pathologiesChroniques: new Set(
      [
        'DIABETE_TYPE2',
        'HTA',
        'VIH_SIDA',
        'DREPANOCYTOSE',
        'INSUFFISANCE_CARD',
        'ASTHME',
        'MALADIE_CARDIAQUE',
        'ALLERGIE_CHRONIQUE',
      ].map((c) => pathologies.get(c) as string),
    ),
    medicaments: new Map(
      [
        ['Arteméther + Luméfantrine', 'Coartem', 'Antipaludéen'],
        ['Amoxicilline', 'Amoxil', 'Antibiotique'],
        ['Paracétamol', 'Doliprane', 'Antalgique/Antipyrétique'],
        ['Metformine', 'Glucophage', 'Antidiabétique'],
        ['Amlodipine', 'Amlor', 'Antihypertenseur'],
        ['Cotrimoxazole', 'Bactrim', 'Antibiotique'],
        ['Oméprazole', 'Mopral', 'Antiulcéreux'],
        ['Ibuprofène', 'Advil', 'Anti-inflammatoire'],
        ['Sels de réhydratation orale', 'SRO', 'Réhydratation'],
        ['Acide folique', null, 'Vitamines/Suppléments'],
      ].map(
        ([nom, commercial, famille]) =>
          [
            cleMedicament(nom as string),
            {
              id: uuid(),
              nomGenerique: nom as string,
              nomCommercial: commercial,
              famille: famille as string,
              contreIndications: [],
            },
          ] as const,
      ),
    ),
    typesExamen: new Map(
      [
        ['NFS', 'BIOLOGIE'],
        ['GLYCEMIE', 'BIOLOGIE'],
        ['PALUDISME_TDR', 'BIOLOGIE'],
        ['URINE_BU', 'BIOLOGIE'],
        ['RADIO_THORAX', 'IMAGERIE'],
        ['ECHO_ABDO', 'IMAGERIE'],
        ['TENSION_ARTERIELLE', 'SPECIALISE'],
      ].map(([code, domaine]) => [code, { id: uuid(), domaine }] as const),
    ),
    // La matrice du seed : seuls le personnel CDI et ses ayants droit ont médicaments et examens couverts.
    droits: new Map([
      ['ASSURE_CDI', new Set(['MEDICAMENT', 'EXAMEN'])],
      ['AYANT_DROIT_CDI', new Set(['MEDICAMENT', 'EXAMEN'])],
    ]),
    etablissements: [uuid(), uuid()],
    typesConsultation: codes([
      'MEDECINE_GENERALE',
      'BILAN_OBLIGATOIRE',
      'VISITE_PRE_EMBAUCHE',
      'ACCIDENT_TRAVAIL',
      'VACCINATION',
      'CARDIOLOGIE',
    ]),
    societes: [uuid(), uuid(), uuid()],
  }
  const population = new Population()
  const fabrique = new FabriqueIdentites(alea.sousFlux('identites'))
  const numerotation = new Numerotation()
  const ips = new Map<string, readonly string[]>([
    [siteM, ['41.75.64.12', '41.75.64.13']],
    [siteN, ['102.129.70.5']],
  ])
  return {
    medecins: [...medecinsM, ...medecinsN],
    infirmiers: [...infirmiersM, ...infirmiersN],
    ref,
    population,
    deja: new Set(),
    ctx: (jour, indexJour, totalJours) => ({
      jour,
      alea: alea.sousFlux(jour),
      equipes,
      ref,
      etat: { population, fabrique, numerotation },
      params: { visitesParJour, indexJour, totalJours, finPeriode },
      ips,
    }),
  }
}

type Cumul = { [K in keyof LignesJour]: LignesJour[K] }

function simuler(
  graine: string,
  debut: string,
  fin: string,
  visitesParJour: number,
): {
  banc: Banc
  cumul: Cumul
  visites: number
  nonRecus: number
  parJour: Map<string, LignesJour>
} {
  const banc = bancDeTest(graine, visitesParJour, fin)
  const cumul = lignesVides() as Cumul
  const parJour = new Map<string, LignesJour>()
  const jours = joursEntre(debut, fin)
  let visites = 0
  let nonRecus = 0
  jours.forEach((jour, i) => {
    if (!estOuvert(jour)) return
    const { lignes, resume } = planifierJour(banc.ctx(jour, i, jours.length))
    visites += resume.visites
    nonRecus += resume.nonRecus
    parJour.set(jour, lignes)
    for (const m of MODELES_TEST) {
      const cible = cumul as unknown as Record<string, unknown[]>
      cible[m.modele] = (cible[m.modele] ?? []).concat(
        (lignes as unknown as Record<string, unknown[]>)[m.modele] ?? [],
      )
    }
  })
  return { banc, cumul, visites, nonRecus, parJour }
}

// ~4 mois, 30 visites par jour d’ouverture : ~2 500 visites, quelques secondes.
const SIM = simuler('periode-1', '2026-06-11', '2026-10-10', 30)
const C = SIM.cumul
const ids = (lignes: { id?: unknown }[]) => lignes.map((l) => l.id as string)

test('la période produit un volume crédible, avec de vrais patients qui reviennent', () => {
  assert.ok(
    SIM.visites > 1800 && SIM.visites < 3600,
    `visites : ${SIM.visites}`,
  )
  assert.ok(
    C.Patient.length > 700 && C.Patient.length < SIM.visites,
    `patients : ${C.Patient.length}`,
  )
  assert.equal(C.Visite.length, SIM.visites)
  assert.ok(C.Consultation.length > SIM.visites * 0.9)
  assert.ok(C.JournalAudit.length > SIM.visites * 7)
})

test('tout identifiant fabriqué porte la marque et aucun n’est répété', () => {
  const tous = new Set<string>()
  for (const m of MODELES_TEST) {
    for (const l of (C as unknown as Record<string, { id: string }[]>)[
      m.modele
    ] ?? []) {
      assert.ok(estIdTest(l.id), `${m.modele} ${l.id}`)
      assert.equal(tous.has(l.id), false, `doublon ${l.id}`)
      tous.add(l.id)
    }
  }
})

test('AUCUNE donnée d’identification répétée : nom complet, téléphone, matricule, numéro de dossier', () => {
  const noms = new Set<string>()
  const tels = new Set<string>()
  const mats = new Set<string>()
  const numeros = new Set<string>()
  const verifier = (ens: Set<string>, v: string, quoi: string) => {
    assert.equal(ens.has(v), false, `${quoi} répété : ${v}`)
    ens.add(v)
  }
  for (const i of C.IdentitePatient) {
    verifier(noms, cleNom(i.prenom, i.nom), 'nom complet')
    if (i.telephone) verifier(tels, chiffres(i.telephone), 'téléphone')
  }
  for (const c of C.ContactUrgence) {
    verifier(noms, cleNom(c.prenom, c.nom), 'nom du contact')
    verifier(tels, chiffres(c.telephone), 'téléphone du contact')
  }
  for (const p of C.Patient) {
    verifier(numeros, p.numeroPatient, 'numéro de dossier')
    if (p.matricule) verifier(mats, p.matricule, 'matricule')
  }
})

test('les numéros de dossier se suivent sans trou, site par site, dans l’ordre des ouvertures', () => {
  const parPrefixe = new Map<string, { n: number; quand: number }[]>()
  for (const p of C.Patient) {
    const m = /^PAT-([A-Z]{3})-(\d{5})$/.exec(p.numeroPatient)
    assert.ok(m, p.numeroPatient)
    const l = parPrefixe.get(m[1]) ?? []
    l.push({ n: Number(m[2]), quand: +(p.createdAt as Date) })
    parPrefixe.set(m[1], l)
  }
  assert.deepEqual([...parPrefixe.keys()].sort(), ['MOU', 'NKA'])
  for (const [prefixe, l] of parPrefixe) {
    l.sort((a, b) => a.n - b.n)
    l.forEach((x, i) => {
      assert.equal(x.n, i + 1, `${prefixe} : trou dans la suite`)
      // le dossier suivant n'a jamais été ouvert AVANT le précédent
      if (i > 0)
        assert.ok(
          x.quand >= (l[i - 1] as { quand: number }).quand,
          `${prefixe}-${x.n} ouvert avant ${prefixe}-${x.n - 1}`,
        )
    })
  }
})

test('les clés étrangères se referment : chaque ligne renvoie à une ligne fabriquée ou à un référentiel connu', () => {
  const patients = new Set(ids(C.Patient))
  const visites = new Set(ids(C.Visite))
  const consultations = new Set(ids(C.Consultation))
  const rattAD = new Set(ids(C.RattachementAyantDroitCdi))
  const rattST = new Set(ids(C.RattachementSousTraitant))
  const utilisateurs = new Set(
    SIM.banc.medecins.concat(SIM.banc.infirmiers).map((s) => s.utilisateurId),
  )
  const personnels = new Set(SIM.banc.medecins.map((s) => s.personnelId))
  const motifs = new Set([...SIM.banc.ref.motifs.values()].map((m) => m.id))
  const pathologies = new Set(SIM.banc.ref.pathologies.values())
  const types = new Set(SIM.banc.ref.typesConsultation.values())
  const categories = new Set(SIM.banc.ref.categories.values())
  const societes = new Set(SIM.banc.ref.societes)
  const dans = (ens: Set<string>, v: unknown, quoi: string) =>
    assert.ok(
      typeof v === 'string' && ens.has(v),
      `${quoi} orphelin : ${String(v)}`,
    )
  for (const x of C.Patient) dans(categories, x.categoriePatientId, 'catégorie')
  for (const x of C.IdentitePatient) dans(patients, x.patientId, 'identité')
  for (const x of C.ContactUrgence) dans(patients, x.patientId, 'contact')
  for (const x of C.DonneesEmploi) dans(patients, x.patientId, 'emploi')
  for (const x of C.ModeViePatient) dans(patients, x.patientId, 'mode de vie')
  for (const x of C.AllergiePatient) dans(patients, x.patientId, 'allergie')
  for (const x of C.AntecedentPatient) {
    dans(patients, x.patientId, 'antécédent')
    if (x.pathologieId)
      dans(pathologies, x.pathologieId, 'pathologie d’antécédent')
  }
  for (const x of C.AlerteMedicale) dans(patients, x.patientId, 'alerte')
  for (const x of C.RattachementAyantDroitCdi) {
    dans(patients, x.patientId, 'ayant droit')
    dans(patients, x.cdiId, 'CDI rattaché')
  }
  for (const x of C.HistoriqueRattachementAyantDroit)
    dans(rattAD, x.rattachementId, 'historique AD')
  for (const x of C.RattachementSousTraitant) {
    dans(patients, x.patientId, 'sous-traitant')
    dans(societes, x.societeId, 'société')
  }
  for (const x of C.HistoriqueRattachementSousTraitant)
    dans(rattST, x.rattachementId, 'historique ST')
  for (const x of C.Visite) {
    dans(patients, x.patientId, 'visite')
    dans(motifs, x.motifPrincipalId, 'motif')
    if (x.soignantId) dans(personnels, x.soignantId, 'soignant de la visite')
  }
  for (const x of C.VisiteEvenement) {
    dans(visites, x.visiteId, 'évènement')
    dans(utilisateurs, x.acteurId, 'acteur')
  }
  for (const x of C.ConstanteVitale) {
    dans(visites, x.visiteId, 'constantes')
    dans(patients, x.patientId, 'patient des constantes')
    dans(utilisateurs, x.saisiePar, 'infirmier des constantes')
  }
  for (const x of C.Consultation) {
    dans(visites, x.visiteId, 'consultation')
    dans(personnels, x.soignantId, 'médecin')
    if (x.typeConsultationId)
      dans(types, x.typeConsultationId, 'type de consultation')
  }
  for (const x of C.DiagnosticConsultation) {
    dans(consultations, x.consultationId, 'diagnostic')
    dans(pathologies, x.pathologieId, 'pathologie')
  }
  for (const x of C.JournalAudit)
    dans(utilisateurs, x.utilisateurId, 'auteur d’audit')
})

test('un médecin ne tient jamais deux consultations en même temps', () => {
  const parMedecin = new Map<string, { debut: number; fin: number }[]>()
  for (const c of C.Consultation) {
    const l = parMedecin.get(c.soignantId) ?? []
    l.push({ debut: +(c.createdAt as Date), fin: +(c.closedAt as Date) })
    parMedecin.set(c.soignantId, l)
  }
  for (const [medecin, l] of parMedecin) {
    l.sort((a, b) => a.debut - b.debut)
    for (let i = 1; i < l.length; i++)
      assert.ok(
        (l[i] as { debut: number }).debut >= (l[i - 1] as { fin: number }).fin,
        `médecin ${medecin} : chevauchement`,
      )
  }
})

test('un infirmier ne reçoit jamais deux patients en même temps : deux ouvertures de visite, au moins une minute d’écart', () => {
  const parInfirmier = new Map<string, number[]>()
  for (const a of C.JournalAudit) {
    if (a.module !== 'visite' || a.action !== 'CREATE' || a.entiteId !== null)
      continue
    const l = parInfirmier.get(a.utilisateurId as string) ?? []
    l.push(+(a.createdAt as Date))
    parInfirmier.set(a.utilisateurId as string, l)
  }
  assert.ok(parInfirmier.size >= 3)
  for (const [infirmier, l] of parInfirmier) {
    l.sort((x, y) => x - y)
    for (let i = 1; i < l.length; i++)
      assert.ok(
        l[i] - l[i - 1] >= 60_000,
        `infirmier ${infirmier} : deux visites à ${(l[i] - l[i - 1]) / 1000} s`,
      )
  }
})

test('une visite ne passe jamais « en cours » chez un médecin déjà occupé', () => {
  // L’envoi en consultation est refusé par le serveur si le médecin a déjà une visite en cours ou
  // une consultation ouverte : entre l’envoi et l’ouverture (quelques minutes), personne d’autre.
  const envois = C.VisiteEvenement.filter(
    (e) => e.type === 'STATUT_CHANGE' && e.nouvelleVal === 'EN_COURS',
  )
  const visiteParId = new Map(C.Visite.map((v) => [v.id as string, v]))
  const consultationsParVisite = new Map<string, typeof C.Consultation>()
  for (const c of C.Consultation) {
    const l = consultationsParVisite.get(c.visiteId) ?? []
    l.push(c)
    consultationsParVisite.set(c.visiteId, l)
  }
  assert.ok(envois.length > 0)
  for (const e of envois) {
    // la consultation qui suit cet envoi : la première ouverte après lui
    const suivantes = (consultationsParVisite.get(e.visiteId) ?? [])
      .filter((c) => +(c.createdAt as Date) >= +(e.createdAt as Date))
      .sort((a, b) => +(a.createdAt as Date) - +(b.createdAt as Date))
    const c = suivantes[0]
    assert.ok(
      c,
      `envoi sans consultation (${visiteParId.get(e.visiteId)?.statut})`,
    )
    const delai = +(c.createdAt as Date) - +(e.createdAt as Date)
    assert.ok(
      delai >= 25_000 && delai <= 160_000,
      `délai envoi → ouverture : ${delai} ms`,
    )
  }
})

test('les dates se suivent : ouverture ≤ clôture, constantes pendant le triage, consultation après l’envoi', () => {
  const vis = new Map(C.Visite.map((v) => [v.id as string, v]))
  for (const v of C.Visite) {
    assert.ok(
      +(v.dateCloture as Date) > +(v.dateOuverture as Date),
      `visite ${v.id}`,
    )
    assert.equal(+(v.createdAt as Date), +(v.dateOuverture as Date))
  }
  for (const k of C.ConstanteVitale) {
    const v = vis.get(k.visiteId)!
    assert.ok(
      +(k.createdAt as Date) >= +(v.dateOuverture as Date),
      'constantes avant la visite',
    )
    assert.ok(
      +(k.createdAt as Date) <= +(v.dateCloture as Date),
      'constantes après la clôture',
    )
  }
  for (const c of C.Consultation) {
    const v = vis.get(c.visiteId)!
    assert.ok(+(c.createdAt as Date) > +(v.dateOuverture as Date))
    assert.ok(+(c.closedAt as Date) > +(c.createdAt as Date))
    assert.equal(+(c.updatedAt as Date), +(c.closedAt as Date))
  }
  const dossier = new Map(C.Patient.map((p) => [p.id as string, p]))
  for (const v of C.Visite)
    assert.ok(
      +(v.dateOuverture as Date) >
        +(dossier.get(v.patientId)!.createdAt as Date),
      'visite avant l’ouverture du dossier',
    )
})

test('une visite clôturée a une consultation clôturée avec diagnostic principal et type ; une annulée n’en a pas', () => {
  const consultations = new Map<string, typeof C.Consultation>()
  for (const c of C.Consultation) {
    const l = consultations.get(c.visiteId) ?? []
    l.push(c)
    consultations.set(c.visiteId, l)
  }
  const diagnostics = new Map<string, typeof C.DiagnosticConsultation>()
  for (const d of C.DiagnosticConsultation) {
    const l = diagnostics.get(d.consultationId) ?? []
    l.push(d)
    diagnostics.set(d.consultationId, l)
  }
  let clotures = 0
  let annulees = 0
  for (const v of C.Visite) {
    const cs = consultations.get(v.id as string) ?? []
    const closes = cs.filter((c) => c.statut === 'CLOTUREE')
    if (v.statut === 'CLOTUREE') {
      clotures++
      assert.equal(v.typeCloture, 'AVEC_CONSULTATION')
      assert.equal(v.motifAnnulation, null)
      assert.equal(closes.length, 1, `visite ${v.id}`)
      const c = closes[0]
      const d = diagnostics.get(c.id as string) ?? []
      assert.equal(d.filter((x) => x.type === 'PRINCIPAL').length, 1)
      assert.ok(
        c.typeConsultationId,
        'type de consultation requis pour clôturer',
      )
      assert.equal(+(v.dateCloture as Date), +(c.closedAt as Date))
      assert.equal(v.soignantId, c.soignantId)
      assert.equal(
        new Set(d.map((x) => x.pathologieId)).size,
        d.length,
        'pathologie en double',
      )
    } else {
      annulees++
      assert.equal(v.statut, 'ANNULEE')
      assert.ok(v.motifAnnulation && String(v.motifAnnulation).length > 5)
      assert.equal(closes.length, 0)
    }
    // une consultation annulée n’a ni diagnostic ni contenu clinique
    for (const c of cs.filter((x) => x.statut === 'ANNULEE')) {
      assert.ok(c.motifAnnulation)
      assert.equal((diagnostics.get(c.id as string) ?? []).length, 0)
      assert.equal(c.examenClinique ?? null, null)
    }
  }
  assert.ok(
    clotures > 0 && annulees > 0,
    `${clotures} clôturées, ${annulees} annulées`,
  )
  assert.ok(
    annulees / SIM.visites < 0.15,
    `${annulees} annulées sur ${SIM.visites}`,
  )
})

test('chaque catégorie a les données que l’accueil exige', () => {
  const categorieDe = new Map<string, string>()
  const parId = new Map<string, string>()
  for (const [code, id] of SIM.banc.ref.categories) parId.set(id, code)
  for (const p of C.Patient)
    categorieDe.set(p.id as string, parId.get(p.categoriePatientId) as string)
  const emploi = new Map(C.DonneesEmploi.map((e) => [e.patientId, e]))
  const rattAD = new Map(
    C.RattachementAyantDroitCdi.map((r) => [r.patientId, r]),
  )
  const rattST = new Map(
    C.RattachementSousTraitant.map((r) => [r.patientId, r]),
  )
  const comptes = new Map<string, number>()
  for (const p of C.Patient) {
    const code = categorieDe.get(p.id as string) as string
    comptes.set(code, (comptes.get(code) ?? 0) + 1)
    if (code === 'ASSURE_CDI' || code === 'ASSURE_CDD') {
      assert.ok(p.matricule, `matricule manquant (${code})`)
      const e = emploi.get(p.id as string)
      assert.ok(
        e && e.fonction && e.sectionPaie && e.service && e.departement,
        `emploi incomplet (${code})`,
      )
      assert.ok(DEPARTEMENTS_EMPLOYES.includes(e.departement))
    } else {
      assert.equal(p.matricule, null, `matricule sur ${code}`)
    }
    if (code === 'AYANT_DROIT_CDI') {
      const r = rattAD.get(p.id as string)
      assert.ok(r, 'ayant droit sans rattachement')
      assert.ok(['CONJOINT', 'ENFANT', 'PARENT', 'AUTRE'].includes(r.typeLien))
      assert.equal(
        categorieDe.get(r.cdiId as string),
        'ASSURE_CDI',
        'rattaché à un non-CDI',
      )
      assert.ok(
        emploi.get(p.id as string)?.fonction,
        'occupation de l’ayant droit manquante',
      )
    } else {
      assert.equal(rattAD.has(p.id as string), false)
    }
    if (code === 'SOUS_TRAITANT')
      assert.ok(rattST.get(p.id as string), 'sous-traitant sans société')
    else assert.equal(rattST.has(p.id as string), false)
  }
  // toutes les catégories sont représentées
  for (const code of SIM.banc.ref.categories.keys())
    assert.ok((comptes.get(code) ?? 0) > 0, `catégorie absente : ${code}`)
})

test('les types de consultation réservés aux employés ne vont qu’aux employés', () => {
  const reserve = [
    SIM.banc.ref.typesConsultation.get('BILAN_OBLIGATOIRE'),
    SIM.banc.ref.typesConsultation.get('VISITE_PRE_EMBAUCHE'),
  ]
  const cat = new Map<string, string>()
  const parId = new Map<string, string>()
  for (const [code, id] of SIM.banc.ref.categories) parId.set(id, code)
  for (const p of C.Patient)
    cat.set(p.id as string, parId.get(p.categoriePatientId) as string)
  const patientDeVisite = new Map(
    C.Visite.map((v) => [v.id as string, v.patientId]),
  )
  let n = 0
  for (const c of C.Consultation) {
    if (!reserve.includes(c.typeConsultationId as string)) continue
    n++
    const code = cat.get(patientDeVisite.get(c.visiteId) as string)
    assert.ok(
      code === 'ASSURE_CDI' || code === 'ASSURE_CDD',
      `type réservé donné à ${code}`,
    )
  }
  assert.ok(n > 0, 'aucun bilan obligatoire généré')
})

test('âges et sexes plausibles par catégorie ; grossesse = femme en âge de procréer', () => {
  const idPatient = new Map(C.IdentitePatient.map((i) => [i.patientId, i]))
  const parId = new Map<string, string>()
  for (const [code, id] of SIM.banc.ref.categories) parId.set(id, code)
  const fin = new Date('2026-10-11T00:00:00Z')
  const age = (n: Date) => (+fin - +n) / 31_557_600_000
  for (const p of C.Patient) {
    const i = idPatient.get(p.id as string)!
    assert.ok(
      +(i.dateNaissance as Date) < +(p.createdAt as Date),
      'née après son dossier',
    )
    const code = parId.get(p.categoriePatientId)
    const a = age(i.dateNaissance as Date)
    if (code === 'ASSURE_CDI') assert.ok(a >= 20 && a <= 65, `CDI de ${a} ans`)
    if (code === 'RETRAITE') assert.ok(a >= 57, `retraité de ${a} ans`)
  }
  const pathoGrossesse = SIM.banc.ref.pathologies.get('GROSSESSE')
  const consultationVisite = new Map(
    C.Consultation.map((c) => [c.id as string, c.visiteId]),
  )
  const patientVisite = new Map(
    C.Visite.map((v) => [v.id as string, v.patientId]),
  )
  for (const d of C.DiagnosticConsultation) {
    if (d.pathologieId !== pathoGrossesse) continue
    const pid = patientVisite.get(
      consultationVisite.get(d.consultationId) as string,
    ) as string
    const i = idPatient.get(pid)!
    assert.equal(i.sexe, 'F')
    const a = age(i.dateNaissance as Date)
    assert.ok(a >= 17 && a <= 44, `grossesse à ${a} ans`)
  }
})

test('le journal d’audit : des personnes réelles du centre, des gestes plausibles, des heures cohérentes', () => {
  const actions = new Set(C.JournalAudit.map((a) => `${a.action}:${a.module}`))
  for (const attendu of [
    'CREATE:patient',
    'CREATE:visite',
    'UPDATE:visite',
    'CREATE:consultation',
    'UPDATE:consultation',
  ])
    assert.ok(actions.has(attendu), `geste absent : ${attendu}`)
  const types = new Set(C.JournalAudit.map((a) => a.entiteType))
  assert.deepEqual([...types].sort(), [
    "Bon d'examen",
    'Bon de pharmacie',
    'Consultation',
    'Patient',
    'Suivi de traitement',
    'Visite',
    'Évacuation',
  ])
  const ips = new Set(C.JournalAudit.map((a) => a.ipAdresse))
  assert.ok(ips.size >= 2 && ips.size <= 3, `adresses : ${[...ips].join(' ')}`)
  for (const a of C.JournalAudit) {
    assert.equal(a.statut, 'SUCCES')
    // un geste de consultation est celui d’un médecin, un geste de visite celui d’un infirmier
    const medecin = SIM.banc.medecins.some(
      (m) => m.utilisateurId === a.utilisateurId,
    )
    if (['consultation', 'evacuation', 'bon_pharmacie'].includes(a.module))
      assert.ok(medecin, `${a.module} par un non-médecin`)
    if (a.module === 'visite')
      assert.equal(medecin, false, 'visite par un médecin')
  }
})

test('les heures sont celles d’un centre ouvert : jamais la nuit, jamais le dimanche', () => {
  for (const a of C.JournalAudit) {
    const quand = a.createdAt as Date
    const jour = jourLocalDe(quand)
    assert.ok(estOuvert(jour), `geste un jour de fermeture : ${jour}`)
    const minutes = (+quand - +instantLocal(jour, 0)) / 60_000
    assert.ok(
      minutes >= 7 * 60 && minutes <= 18 * 60 + 5,
      `geste à ${Math.round(minutes / 60)} h ${jour}`,
    )
  }
})

test('chaque jour, les patients ne sont vus qu’une fois', () => {
  for (const [jour, lignes] of SIM.parJour) {
    const vus = new Set<string>()
    for (const v of lignes.Visite) {
      assert.equal(
        vus.has(v.patientId),
        false,
        `${jour} : deux visites pour un patient`,
      )
      vus.add(v.patientId)
    }
  }
})

test('les maladies chroniques reviennent à intervalle régulier ; les nouveaux dossiers se raréfient avec le temps', () => {
  const parPatient = new Map<string, Date[]>()
  const visitesParPatient = new Map<string, number>()
  for (const v of C.Visite) {
    const l = parPatient.get(v.patientId) ?? []
    l.push(v.dateOuverture as Date)
    parPatient.set(v.patientId, l)
    visitesParPatient.set(
      v.patientId,
      (visitesParPatient.get(v.patientId) ?? 0) + 1,
    )
  }
  const multi = [...visitesParPatient.values()].filter((n) => n >= 2).length
  assert.ok(
    multi > C.Patient.length * 0.25,
    `${multi} patients revenus sur ${C.Patient.length}`,
  )
  const moisDe = (d: Date) => d.toISOString().slice(0, 7)
  const nouveauxParMois = new Map<string, number>()
  for (const p of C.Patient) {
    const m = moisDe(p.createdAt as Date)
    nouveauxParMois.set(m, (nouveauxParMois.get(m) ?? 0) + 1)
  }
  const mois = [...nouveauxParMois.entries()].sort()
  const premier = mois[0][1]
  const dernier = mois[mois.length - 1][1]
  assert.ok(
    premier > dernier,
    `nouveaux dossiers : ${mois.map((m) => m.join('=')).join(' ')}`,
  )
})

test('la même graine rend la même population (noms, téléphones), une autre graine une autre', () => {
  const profil = (s: ReturnType<typeof simuler>) =>
    s.cumul.IdentitePatient.slice(0, 40)
      .map((i) => `${i.prenom} ${i.nom} ${i.telephone ?? '-'}`)
      .join('|')
  const a = simuler('rejeu', '2026-09-01', '2026-09-20', 20)
  const b = simuler('rejeu', '2026-09-01', '2026-09-20', 20)
  const c = simuler('autre-graine', '2026-09-01', '2026-09-20', 20)
  assert.equal(profil(a), profil(b))
  assert.equal(a.cumul.Visite.length, b.cumul.Visite.length)
  assert.notEqual(profil(a), profil(c))
})

test('au-delà de la capacité, les patients en trop sont comptés, pas inventés', () => {
  const s = simuler('saturation', '2026-09-14', '2026-09-19', 400)
  assert.ok(
    s.nonRecus > 0,
    'aucun refus alors que 400 par jour dépasse largement la capacité',
  )
  // les consultations restent tenables malgré la saturation
  const parMedecin = new Map<string, { debut: number; fin: number }[]>()
  for (const c of s.cumul.Consultation) {
    const l = parMedecin.get(c.soignantId) ?? []
    l.push({ debut: +(c.createdAt as Date), fin: +(c.closedAt as Date) })
    parMedecin.set(c.soignantId, l)
  }
  for (const l of parMedecin.values()) {
    l.sort((a, b) => a.debut - b.debut)
    for (let i = 1; i < l.length; i++)
      assert.ok(
        (l[i] as { debut: number }).debut >= (l[i - 1] as { fin: number }).fin,
      )
  }
  // beaucoup de patients partent sans attendre
  const parties = s.cumul.Visite.filter((v) => v.statut === 'ANNULEE').length
  assert.ok(
    parties > s.cumul.Visite.length * 0.15,
    `${parties} annulées sur ${s.cumul.Visite.length}`,
  )
})

test('des référentiels très différents ne cassent pas la génération (profils neutres)', () => {
  const banc = bancDeTest('referentiels-neufs', 15, '2026-10-30')
  const autre: ReferentielsTest = {
    ...banc.ref,
    motifs: new Map([['AUTRE_MOTIF', { id: uuid(), triageAllege: false }]]),
    pathologies: new Map([
      ['AFFECTION_X', uuid()],
      ['AFFECTION_Y', uuid()],
    ]),
  }
  assert.equal(profilsDisponibles(autre).length, 2)
  const ctx = { ...banc.ctx('2026-10-12', 0, 10), ref: autre }
  const { lignes } = planifierJour(ctx)
  assert.ok(lignes.Visite.length > 0)
  const motifs = new Set(lignes.Visite.map((v) => v.motifPrincipalId))
  assert.deepEqual([...motifs], [autre.motifs.get('AUTRE_MOTIF')!.id])
})

test('un centre sans médecin ou sans infirmier ne génère rien (au lieu de lignes incohérentes)', () => {
  const banc = bancDeTest('sans-medecin', 20, '2026-10-30')
  const ctx = banc.ctx('2026-10-12', 0, 10)
  const sansMedecin: ContexteJour = {
    ...ctx,
    equipes: ctx.equipes.map((e) => ({ ...e, medecins: [] })),
  }
  const { lignes } = planifierJour(sansMedecin)
  assert.equal(lignes.Visite.length, 0)
  assert.equal(lignes.Patient.length, 0)
})

test('un jour de fermeture ne produit rien', () => {
  const banc = bancDeTest('ferme', 40, '2026-12-31')
  for (const jour of ['2026-10-11', '2026-08-15', '2026-12-25']) {
    const { lignes, resume } = planifierJour(banc.ctx(jour, 0, 10))
    assert.equal(resume.visites, 0, jour)
    assert.equal(
      lignes.Visite.length + lignes.Patient.length + lignes.JournalAudit.length,
      0,
    )
  }
})

// ── Livraison 2 : ordonnances, bons, résultats, décisions, suivis ─────────────

console.log('livraison 2 : prescriptions, bons, résultats, décisions, suivis')

const FIN_PERIODE = instantSecondes('2026-10-10', 86_399)
const consultationParId = new Map(
  C.Consultation.map((c) => [c.id as string, c]),
)
const visiteParId2 = new Map(C.Visite.map((v) => [v.id as string, v]))
const patientParId = new Map(C.Patient.map((p) => [p.id as string, p]))
const codeCategorie = new Map(
  [...SIM.banc.ref.categories].map(([code, id]) => [id, code] as const),
)
const codePathologie = new Map(
  [...SIM.banc.ref.pathologies].map(([code, id]) => [id, code] as const),
)
const medecinsIds = new Set(SIM.banc.medecins.map((m) => m.utilisateurId))
const infirmiersIds = new Set(SIM.banc.infirmiers.map((m) => m.utilisateurId))
const ordonnanceParId = new Map(C.Ordonnance.map((o) => [o.id as string, o]))
const bonExamenParId = new Map(C.BonExamen.map((b) => [b.id as string, b]))
const medicamentParId = new Map(
  [...SIM.banc.ref.medicaments.values()].map((m) => [m.id, m] as const),
)
const typeExamenParId = new Map(
  [...SIM.banc.ref.typesExamen].map(([code, t]) => [t.id, code] as const),
)
const categorieDeConsultation = (consultationId: string): string => {
  const c = consultationParId.get(consultationId) as { visiteId: string }
  const v = visiteParId2.get(c.visiteId) as { patientId: string }
  const p = patientParId.get(v.patientId) as { categoriePatientId: string }
  return codeCategorie.get(p.categoriePatientId) as string
}
const patientDeConsultation = (consultationId: string): string => {
  const c = consultationParId.get(consultationId) as { visiteId: string }
  return (visiteParId2.get(c.visiteId) as { patientId: string }).patientId
}
const couvert = (categorie: string, prestation: string) =>
  SIM.banc.ref.droits.get(categorie)?.has(prestation) ?? false
const lignesDe = <T extends { ordonnanceId?: string }>(liste: T[]) => {
  const m = new Map<string, T[]>()
  for (const l of liste) {
    const k = l.ordonnanceId as string
    m.set(k, [...(m.get(k) ?? []), l])
  }
  return m
}
const lignesParOrdonnance = lignesDe(C.LigneOrdonnance)

test('la période produit des ordonnances, des bons, des résultats, des évacuations et des suivis en proportions crédibles', () => {
  const clotures = C.Consultation.filter((c) => c.statut === 'CLOTUREE').length
  const part = (n: number) => n / clotures
  const med = C.Ordonnance.filter((o) => o.typeOrdonnance === 'PHARMACEUTIQUE')
  const exa = C.Ordonnance.filter(
    (o) => o.typeOrdonnance === 'PRESCRIPTION_EXAMEN',
  )
  assert.ok(
    part(med.length) > 0.6 && part(med.length) < 0.95,
    `médicaments ${part(med.length)}`,
  )
  assert.ok(
    part(exa.length) > 0.15 && part(exa.length) < 0.5,
    `examens ${part(exa.length)}`,
  )
  assert.ok(C.BonExamen.length > 150 && C.BonPharmacie.length > 300)
  assert.ok(C.ResultatExamen.length > 150)
  assert.ok(
    part(C.Evacuation.length) > 0.005 && part(C.Evacuation.length) < 0.03,
  )
  assert.ok(
    part(C.SuiviTraitement.length) > 0.02 &&
      part(C.SuiviTraitement.length) < 0.08,
  )
  assert.ok(C.SuiviChronique.length > 30)
  assert.ok(C.FicheSuiviTraitement.length > C.SuiviTraitement.length)
  assert.ok(C.AdministrationTraitement.length > 30)
})

test('une ordonnance est celle du médecin de la consultation, validée, avec ses lignes complètes', () => {
  for (const o of C.Ordonnance) {
    const c = consultationParId.get(
      o.consultationId,
    ) as (typeof C.Consultation)[number]
    assert.ok(c, 'consultation de l’ordonnance')
    assert.equal(c.statut, 'CLOTUREE')
    assert.equal(o.prescripteurId, c.soignantId)
    assert.equal(o.delegationId, null)
    assert.ok(
      o.statut === 'VALIDEE' || o.statut === 'ANNULEE',
      String(o.statut),
    )
    assert.ok(
      +(o.createdAt as Date) >= +(c.createdAt as Date),
      'ordonnance avant la consultation',
    )
    const lignes = lignesParOrdonnance.get(o.id as string) ?? []
    assert.ok(lignes.length >= 1, 'ordonnance sans ligne')
    if (o.typeOrdonnance === 'PHARMACEUTIQUE') {
      assert.equal(o.indicationClinik, null)
      const meds = new Set<string>()
      for (const l of lignes) {
        assert.ok(
          l.medicamentId && medicamentParId.has(l.medicamentId),
          'médicament inconnu',
        )
        assert.ok(
          l.posologie && l.duree && l.voieAdmin,
          'ligne de médicament incomplète',
        )
        assert.equal(l.typeExamenId, null)
        assert.equal(
          meds.has(l.medicamentId),
          false,
          'même médicament deux fois',
        )
        meds.add(l.medicamentId)
      }
    } else {
      assert.equal(o.typeOrdonnance, 'PRESCRIPTION_EXAMEN')
      assert.ok(o.indicationClinik, 'indication clinique requise')
      const examens = new Set<string>()
      for (const l of lignes) {
        assert.ok(
          l.typeExamenId && typeExamenParId.has(l.typeExamenId),
          'examen inconnu',
        )
        assert.equal(l.medicamentId, null)
        assert.equal(
          examens.has(l.typeExamenId),
          false,
          'même examen deux fois',
        )
        examens.add(l.typeExamenId)
      }
    }
  }
  // les lignes renvoient toutes à une ordonnance fabriquée
  for (const l of C.LigneOrdonnance)
    assert.ok(ordonnanceParId.has(l.ordonnanceId), 'ligne orpheline')
})

test('une ordonnance est signée pendant la consultation : création, lignes, validation dans l’ordre', () => {
  // le journal d’audit porte les gestes du médecin sur la consultation : création de l’ordonnance,
  // une ligne par médicament ou examen, validation (et génération du bon quand il y en a un)
  const gestes = new Map<string, number>()
  for (const a of C.JournalAudit)
    if (a.module === 'consultation' && a.entiteId)
      gestes.set(a.entiteId, (gestes.get(a.entiteId) ?? 0) + 1)
  for (const o of C.Ordonnance) {
    const n = (lignesParOrdonnance.get(o.id as string) ?? []).length
    assert.ok(
      (gestes.get(o.consultationId) ?? 0) >= 2 + n,
      'gestes de prescription absents du journal',
    )
    assert.ok(+(o.updatedAt as Date) >= +(o.createdAt as Date))
    const c = consultationParId.get(
      o.consultationId,
    ) as (typeof C.Consultation)[number]
    // validée avant la clôture (sauf annulation postérieure : alors updatedAt est celui de l’annulation)
    if (o.statut === 'VALIDEE')
      assert.ok(
        +(o.updatedAt as Date) <= +(c.closedAt as Date),
        'validée après la clôture',
      )
  }
})

test('les médicaments prescrits respectent les allergies de la personne (et celles de la même famille)', () => {
  const allergies = new Map<string, string[]>()
  for (const a of C.AllergiePatient)
    allergies.set(a.patientId, [
      ...(allergies.get(a.patientId) ?? []),
      a.substance,
    ])
  const alertes = new Map<string, string[]>()
  for (const a of C.AlerteMedicale)
    alertes.set(a.patientId, [...(alertes.get(a.patientId) ?? []), a.message])
  let controles = 0
  for (const l of C.LigneOrdonnance) {
    if (!l.medicamentId) continue
    const o = ordonnanceParId.get(
      l.ordonnanceId,
    ) as (typeof C.Ordonnance)[number]
    const patientId = patientDeConsultation(o.consultationId)
    const med = medicamentParId.get(l.medicamentId) as MedicamentTest
    if (allergies.has(patientId)) controles++
    assert.equal(
      medicamentIncompatible(
        {
          allergies: allergies.get(patientId) ?? [],
          alertes: alertes.get(patientId) ?? [],
        },
        med,
      ),
      false,
      `${med.nomGenerique} prescrit à une personne allergique`,
    )
  }
  assert.ok(
    controles > 5,
    `trop peu de personnes allergiques contrôlées : ${controles}`,
  )
})

test('medicamentIncompatible : allergie directe, même famille, contre-indication déclarée', () => {
  const medicament = (nom: string) =>
    SIM.banc.ref.medicaments.get(cleMedicament(nom)) as MedicamentTest
  const amox = medicament('Amoxicilline')
  const ibu = medicament('Ibuprofène')
  const para = medicament('Paracétamol')
  const sans = { allergies: [], alertes: [] }
  assert.equal(medicamentIncompatible(sans, amox), false)
  assert.equal(
    medicamentIncompatible({ allergies: ['Amoxicilline'], alertes: [] }, amox),
    true,
  )
  assert.equal(
    medicamentIncompatible({ allergies: ['Pénicilline'], alertes: [] }, amox),
    true,
  )
  assert.equal(
    medicamentIncompatible({ allergies: ['Aspirine'], alertes: [] }, ibu),
    true,
  )
  assert.equal(
    medicamentIncompatible(
      { allergies: ['Pénicilline', 'Pollen'], alertes: [] },
      para,
    ),
    false,
  )
  const avecCI: MedicamentTest = {
    ...para,
    contreIndications: ['Insuffisance hépatique'],
  }
  assert.equal(
    medicamentIncompatible(
      { allergies: [], alertes: ['Insuffisance hépatique sévère connue'] },
      avecCI,
    ),
    true,
  )
  assert.equal(
    medicamentIncompatible(
      { allergies: [], alertes: ['Diabète suivi'] },
      avecCI,
    ),
    false,
  )
})

test('un bon n’existe que pour un patient dont la catégorie le couvre, et reprend son ordonnance', () => {
  const actifsExamen = new Map<string, number>()
  for (const b of C.BonExamen) {
    const o = ordonnanceParId.get(
      b.ordonnanceId as string,
    ) as (typeof C.Ordonnance)[number]
    assert.ok(o, 'bon d’examen sans ordonnance')
    assert.equal(o.typeOrdonnance, 'PRESCRIPTION_EXAMEN')
    assert.equal(b.consultationId, o.consultationId)
    assert.ok(
      couvert(categorieDeConsultation(b.consultationId), 'EXAMEN'),
      'bon d’examen pour un patient non couvert',
    )
    assert.equal(b.statut, 'VALIDE')
    assert.equal(b.indicationClinik, o.indicationClinik)
    assert.ok(+(b.createdAt as Date) >= +(o.createdAt as Date))
    const voulus = (lignesParOrdonnance.get(o.id as string) ?? [])
      .map((l) => l.typeExamenId)
      .sort()
    const lignes = C.LigneExamen.filter((l) => l.bonId === b.id)
      .map((l) => l.typeExamenId)
      .sort()
    assert.deepEqual(lignes, voulus)
    actifsExamen.set(
      o.id as string,
      (actifsExamen.get(o.id as string) ?? 0) + 1,
    )
  }
  for (const [, n] of actifsExamen)
    assert.equal(n, 1, 'deux bons d’examen pour une ordonnance')
  const actifsPharmacie = new Map<string, number>()
  for (const b of C.BonPharmacie) {
    const o = ordonnanceParId.get(
      b.ordonnanceId as string,
    ) as (typeof C.Ordonnance)[number]
    assert.ok(o, 'bon de pharmacie sans ordonnance')
    assert.equal(o.typeOrdonnance, 'PHARMACEUTIQUE')
    assert.equal(b.prescripteurId, o.prescripteurId)
    assert.ok(
      couvert(categorieDeConsultation(b.consultationId), 'MEDICAMENT'),
      'bon de pharmacie pour un patient non couvert',
    )
    const voulus = (lignesParOrdonnance.get(o.id as string) ?? [])
      .map((l) => l.medicamentId)
      .sort()
    const lignes = C.LigneBonPharmacie.filter((l) => l.bonId === b.id)
    assert.deepEqual(lignes.map((l) => l.medicamentId).sort(), voulus)
    for (const l of lignes)
      assert.equal(
        l.libelle,
        (
          medicamentParId.get(l.medicamentId as string) as {
            nomGenerique: string
          }
        ).nomGenerique,
      )
    if (b.statut !== 'ANNULE')
      actifsPharmacie.set(
        o.id as string,
        (actifsPharmacie.get(o.id as string) ?? 0) + 1,
      )
  }
  for (const [, n] of actifsPharmacie)
    assert.equal(n, 1, 'deux bons de pharmacie actifs pour une ordonnance')
})

test('les patients non couverts reçoivent leurs ordonnances, sans bon', () => {
  const sansBon = C.Ordonnance.filter((o) => {
    const cat = categorieDeConsultation(o.consultationId)
    const prestation =
      o.typeOrdonnance === 'PHARMACEUTIQUE' ? 'MEDICAMENT' : 'EXAMEN'
    return !couvert(cat, prestation)
  })
  assert.ok(
    sansBon.length > 100,
    `ordonnances de patients non couverts : ${sansBon.length}`,
  )
  const idsBons = new Set([
    ...C.BonExamen.map((b) => b.ordonnanceId as string),
    ...C.BonPharmacie.map((b) => b.ordonnanceId as string),
  ])
  for (const o of sansBon)
    assert.equal(
      idsBons.has(o.id as string),
      false,
      'bon pour un patient non couvert',
    )
})

test('un bon de pharmacie : délivré par un médecin, après sa création ; en attente sans délivrance ; annulé avec son motif', () => {
  const bons = C.BonPharmacie
  const livres = bons.filter((b) => b.statut === 'DELIVRE')
  assert.ok(
    livres.length > bons.length * 0.6,
    `délivrés : ${livres.length}/${bons.length}`,
  )
  assert.ok(
    bons.some((b) => b.statut === 'EN_ATTENTE'),
    'aucun bon en attente',
  )
  assert.ok(
    bons.some((b) => b.statut === 'ANNULE'),
    'aucun bon annulé',
  )
  for (const b of bons) {
    if (b.statut === 'DELIVRE') {
      assert.ok(
        medecinsIds.has(b.delivrePar as string),
        'délivré par un non-médecin',
      )
      assert.ok(+(b.delivreLe as Date) >= +(b.createdAt as Date))
      assert.equal(b.motifAnnulation, null)
    } else {
      assert.equal(b.delivreLe, null)
      assert.equal(b.delivrePar, null)
    }
    if (b.statut === 'ANNULE')
      assert.ok(b.motifAnnulation, 'bon annulé sans motif')
  }
  // chaque remise est tracée : qui, quand
  for (const b of livres) {
    const trace = C.JournalAudit.find(
      (a) => a.module === 'bon_pharmacie' && a.entiteId === b.id,
    )
    assert.ok(trace, 'remise non tracée')
    assert.equal(trace.utilisateurId, b.delivrePar)
    assert.equal(+(trace.createdAt as Date), +(b.delivreLe as Date))
  }
})

test('une ordonnance annulée emporte son bon en attente, mais pas un bon déjà délivré', () => {
  const annulees = new Set(
    C.Ordonnance.filter((o) => o.statut === 'ANNULEE').map(
      (o) => o.id as string,
    ),
  )
  assert.ok(annulees.size > 5)
  let emportes = 0
  let gardes = 0
  for (const b of C.BonPharmacie) {
    if (!annulees.has(b.ordonnanceId as string)) continue
    if (b.statut === 'ANNULE') emportes++
    else {
      assert.equal(
        b.statut,
        'DELIVRE',
        'bon resté en attente sous une ordonnance annulée',
      )
      const o = ordonnanceParId.get(
        b.ordonnanceId as string,
      ) as (typeof C.Ordonnance)[number]
      assert.ok(
        +(b.delivreLe as Date) < +(o.updatedAt as Date),
        'délivré après l’annulation de son ordonnance',
      )
      gardes++
    }
  }
  assert.ok(
    emportes > 0,
    'aucun bon emporté par l’annulation de son ordonnance',
  )
  assert.ok(gardes >= 0)
})

test('les résultats : sur un bon validé, un par examen, saisis après la prescription par une personne du centre', () => {
  const lignesDuBon = new Map<string, Set<string>>()
  for (const l of C.LigneExamen)
    lignesDuBon.set(
      l.bonId,
      (lignesDuBon.get(l.bonId) ?? new Set<string>()).add(l.id as string),
    )
  const recus = new Map<string, number>()
  const remplaces = new Map<string, (typeof C.ResultatExamen)[number]>()
  for (const r of C.ResultatExamen) {
    const bon = bonExamenParId.get(r.bonId) as (typeof C.BonExamen)[number]
    assert.ok(bon, 'résultat sans bon')
    assert.equal(bon.statut, 'VALIDE')
    assert.ok(
      lignesDuBon.get(r.bonId)?.has(r.ligneExamenId as string),
      'résultat d’un examen non prescrit',
    )
    assert.ok(
      infirmiersIds.has(r.saisiePar) || medecinsIds.has(r.saisiePar),
      'saisi par un inconnu',
    )
    assert.ok(
      +(r.createdAt as Date) >= +(bon.createdAt as Date),
      'résultat avant le bon',
    )
    assert.ok(r.contenu.length > 5)
    assert.ok(r.anormal === true || r.anormal === false)
    assert.ok(
      +(r.dateRealisation as Date) >= +(bon.createdAt as Date) &&
        +(r.dateRealisation as Date) <= +(r.createdAt as Date),
      'examen réalisé hors de la fenêtre prescription → saisie',
    )
    if (r.statut === 'RECU')
      recus.set(
        r.ligneExamenId as string,
        (recus.get(r.ligneExamenId as string) ?? 0) + 1,
      )
    else {
      assert.equal(r.statut, 'REMPLACE')
      remplaces.set(r.id as string, r)
    }
  }
  for (const [, n] of recus)
    assert.equal(n, 1, 'deux résultats actifs pour un même examen')
  // un résultat corrigé : l’ancien est gardé, remplacé par UN seul nouveau qui dit pourquoi
  assert.ok(remplaces.size > 3, 'aucune correction de résultat')
  for (const [id, ancien] of remplaces) {
    const suite = C.ResultatExamen.filter((r) => r.corrigeId === id)
    assert.equal(suite.length, 1)
    assert.equal(suite[0].statut, 'RECU')
    assert.ok(suite[0].motifCorrection)
    assert.ok(+(suite[0].createdAt as Date) >= +(ancien.createdAt as Date))
  }
  // des bons restent sans résultat (examen pas encore fait, ou jamais fait)
  const avecResultat = new Set(C.ResultatExamen.map((r) => r.bonId))
  const sans = C.BonExamen.filter(
    (b) => !avecResultat.has(b.id as string),
  ).length
  assert.ok(
    sans > C.BonExamen.length * 0.05 && sans < C.BonExamen.length * 0.3,
    `sans résultat : ${sans}/${C.BonExamen.length}`,
  )
})

test('un test de paludisme est positif chez qui a un paludisme confirmé, rarement chez les autres', () => {
  const diagnostic = new Map<string, { code: string; certitude: string }>()
  for (const d of C.DiagnosticConsultation)
    if (d.type === 'PRINCIPAL')
      diagnostic.set(d.consultationId, {
        code: codePathologie.get(d.pathologieId) as string,
        certitude: d.certitude as string,
      })
  const confirmes = { n: 0, positifs: 0 }
  const autres = { n: 0, positifs: 0 }
  for (const r of C.ResultatExamen) {
    if (r.statut !== 'RECU') continue
    const ligne = C.LigneExamen.find(
      (l) => l.id === r.ligneExamenId,
    ) as (typeof C.LigneExamen)[number]
    if (typeExamenParId.get(ligne.typeExamenId) !== 'PALUDISME_TDR') continue
    const bon = bonExamenParId.get(r.bonId) as (typeof C.BonExamen)[number]
    const d = diagnostic.get(bon.consultationId)
    const positif = r.contenu.includes('positif')
    const groupe =
      d?.code === 'PALUDISME' && d.certitude === 'CONFIRME' ? confirmes : autres
    groupe.n++
    if (positif) groupe.positifs++
  }
  assert.ok(confirmes.n > 20 && autres.n > 5, `${confirmes.n} / ${autres.n}`)
  assert.ok(
    confirmes.positifs / confirmes.n > 0.8,
    `confirmés : ${confirmes.positifs}/${confirmes.n}`,
  )
  assert.ok(
    autres.positifs / autres.n < 0.5,
    `autres : ${autres.positifs}/${autres.n}`,
  )
})

test('la décision du médecin : évacuation ou suivi de traitement, jamais les deux, jamais sur une consultation annulée', () => {
  const evac = new Map<string, number>()
  for (const e of C.Evacuation)
    evac.set(e.consultationId, (evac.get(e.consultationId) ?? 0) + 1)
  const suivi = new Map<string, number>()
  for (const s of C.SuiviTraitement)
    suivi.set(s.consultationId, (suivi.get(s.consultationId) ?? 0) + 1)
  for (const c of C.Consultation) {
    const id = c.id as string
    if (c.statut !== 'CLOTUREE') {
      assert.equal(c.decisionMedicale ?? null, null)
      assert.equal(
        evac.has(id) || suivi.has(id),
        false,
        'document de décision sur une consultation non clôturée',
      )
      assert.equal(
        C.Ordonnance.some((o) => o.consultationId === id),
        false,
      )
      continue
    }
    assert.ok(
      c.decisionMedicale == null ||
        c.decisionMedicale === 'EVACUATION' ||
        c.decisionMedicale === 'SUIVI_TRAITEMENT',
    )
    assert.equal(evac.get(id) ?? 0, c.decisionMedicale === 'EVACUATION' ? 1 : 0)
    assert.equal(
      suivi.get(id) ?? 0,
      c.decisionMedicale === 'SUIVI_TRAITEMENT' ? 1 : 0,
    )
  }
})

test('une évacuation : créée avant la clôture par le médecin, des étapes dans l’ordre, close seulement après son admission', () => {
  const ordre = {
    EN_COURS: 0,
    EN_TRANSPORT: 1,
    ADMIS: 2,
    CLOTURE: 3,
  } as Record<string, number>
  const statuts = new Set<string>()
  for (const e of C.Evacuation) {
    statuts.add(e.statut as string)
    const c = consultationParId.get(
      e.consultationId,
    ) as (typeof C.Consultation)[number]
    assert.ok(
      +(e.createdAt as Date) >= +(c.createdAt as Date) &&
        +(e.createdAt as Date) <= +(c.closedAt as Date),
      'évacuation hors de la consultation',
    )
    assert.ok(
      ['BASSE', 'MOYENNE', 'HAUTE', 'CRITIQUE'].includes(e.niveauUrgence),
    )
    assert.ok(e.infosCliniques && e.infosCliniques.length > 30)
    const etapes = C.SuiviEvacuation.filter(
      (s) => s.evacuationId === e.id,
    ).sort((a, b) => +(a.createdAt as Date) - +(b.createdAt as Date))
    let rang = -1
    for (const s of etapes) {
      assert.ok(medecinsIds.has(s.createdBy as string))
      assert.ok(+(s.createdAt as Date) >= +(e.createdAt as Date))
      assert.ok(ordre[s.statut] >= rang, 'étapes d’évacuation dans le désordre')
      rang = ordre[s.statut]
      assert.ok(s.notes.length > 10)
    }
    const cloturee = etapes.some((s) => s.statut === 'CLOTURE')
    assert.equal(e.statut === 'CLOTURE', cloturee)
    if (e.statut === 'ANNULE') {
      assert.ok(e.motifAnnulation)
      assert.equal(cloturee, false)
    } else assert.equal(e.motifAnnulation, null)
  }
  assert.ok(
    statuts.has('CLOTURE') && statuts.has('EN_COURS'),
    [...statuts].join(' '),
  )
})

test('un suivi de traitement : ouvert avant la clôture, des fiches datées après lui, clos ou encore en cours ou abandonné', () => {
  const statuts = new Set<string>()
  let enRetard = 0
  for (const s of C.SuiviTraitement) {
    statuts.add(s.statut as string)
    const c = consultationParId.get(
      s.consultationId,
    ) as (typeof C.Consultation)[number]
    assert.ok(
      +(s.createdAt as Date) >= +(c.createdAt as Date) &&
        +(s.createdAt as Date) <= +(c.closedAt as Date),
      'suivi hors de la consultation',
    )
    assert.ok(s.motif.length > 10)
    const fiches = C.FicheSuiviTraitement.filter(
      (f) => f.suiviTraitementId === s.id,
    ).sort((a, b) => +(a.createdAt as Date) - +(b.createdAt as Date))
    for (const f of fiches) {
      assert.ok(
        +(f.createdAt as Date) >= +(c.closedAt as Date),
        'fiche avant la clôture de la consultation',
      )
      assert.ok(+(f.createdAt as Date) >= +(s.createdAt as Date))
      assert.ok(
        +(f.createdAt as Date) <= +FIN_PERIODE,
        'fiche après la fin de la période',
      )
      assert.ok(
        infirmiersIds.has(f.createdBy as string) ||
          medecinsIds.has(f.createdBy as string),
      )
      const info = [
        f.temperature,
        f.tensionSystolique,
        f.frequenceCardiaque,
        f.saturationO2,
        f.poids,
        f.noteEvolution,
      ].some((v) => v != null && v !== '')
      assert.ok(info, 'fiche vide')
    }
    if (s.statut === 'CLOTURE') {
      assert.ok(s.motifCloture && s.closedAt)
      assert.equal(s.prochainControle, null)
      assert.ok(fiches.length > 0)
      assert.ok(
        +(s.closedAt as Date) >= +(fiches[fiches.length - 1].createdAt as Date),
        'clos avant la dernière fiche',
      )
    } else if (s.statut === 'ANNULE') {
      assert.ok(s.motifAnnulation)
      assert.equal(fiches.length, 0)
      assert.equal(s.prochainControle, null)
    } else {
      assert.equal(s.statut, 'EN_COURS')
      assert.ok(s.prochainControle)
      if (+(s.prochainControle as Date) < +FIN_PERIODE) enRetard++
    }
  }
  assert.ok(
    statuts.has('CLOTURE') && statuts.has('EN_COURS') && statuts.has('ANNULE'),
    [...statuts].join(' '),
  )
  assert.ok(enRetard > 0, 'aucun contrôle en retard')
})

test('les administrations se notent sur un traitement prescrit dans la consultation, pendant sa durée, avant son arrêt', () => {
  const ligneParId = new Map(C.LigneOrdonnance.map((l) => [l.id as string, l]))
  const fiches = new Map(C.FicheSuiviTraitement.map((f) => [f.id as string, f]))
  const suivis = new Map(C.SuiviTraitement.map((s) => [s.id as string, s]))
  for (const a of C.AdministrationTraitement) {
    const l = ligneParId.get(
      a.ligneOrdonnanceId,
    ) as (typeof C.LigneOrdonnance)[number]
    assert.ok(
      l && l.medicamentId,
      'administration d’autre chose qu’un médicament',
    )
    const o = ordonnanceParId.get(
      l.ordonnanceId,
    ) as (typeof C.Ordonnance)[number]
    const s = suivis.get(
      a.suiviTraitementId as string,
    ) as (typeof C.SuiviTraitement)[number]
    assert.ok(s, 'administration sans suivi')
    assert.equal(o.consultationId, s.consultationId)
    // une ordonnance annulée plus tard n'autorise plus d'administration après son annulation
    if (o.statut === 'ANNULEE')
      assert.ok(
        +(a.administreLe as Date) < +(o.updatedAt as Date),
        'administré sous une ordonnance annulée',
      )
    else assert.equal(o.statut, 'VALIDEE')
    const f = fiches.get(
      a.ficheId as string,
    ) as (typeof C.FicheSuiviTraitement)[number]
    assert.equal(f.suiviTraitementId, a.suiviTraitementId)
    assert.equal(+(a.administreLe as Date), +(f.createdAt as Date))
    assert.ok(+(a.administreLe as Date) >= +(o.createdAt as Date))
    if (l.arreteLe)
      assert.ok(
        +(a.administreLe as Date) <= +(l.arreteLe as Date),
        'administré après l’arrêt',
      )
  }
  const arretees = C.LigneOrdonnance.filter((l) => l.arreteLe)
  for (const l of arretees) {
    assert.ok(l.motifArret && l.arretePar)
    assert.ok(infirmiersIds.has(l.arretePar) || medecinsIds.has(l.arretePar))
  }
})

test('un suivi chronique : une seule fois par personne et par maladie, sur une pathologie que le centre déclare chronique', () => {
  const vus = new Set<string>()
  for (const s of C.SuiviChronique) {
    assert.ok(patientParId.has(s.patientId as string))
    assert.ok(SIM.banc.ref.pathologiesChroniques.has(s.pathologieId))
    assert.ok(
      [
        'Hebdomadaire',
        'Mensuel',
        'Trimestriel',
        'Semestriel',
        'Annuel',
      ].includes(s.frequenceSuivi as string),
    )
    assert.ok(s.objectifs && s.objectifs.length > 10)
    assert.equal(s.statut, 'ACTIF')
    const cle = `${s.patientId}|${s.pathologieId}`
    assert.equal(vus.has(cle), false, 'deux suivis actifs pour la même maladie')
    vus.add(cle)
    // la personne a bien cette maladie dans son dossier
    assert.ok(
      C.AntecedentPatient.some(
        (a) => a.patientId === s.patientId && a.pathologieId === s.pathologieId,
      ),
      'suivi chronique sans antécédent',
    )
    // défini par un médecin, tracé sur le dossier
    const trace = C.JournalAudit.find(
      (a) =>
        a.module === 'patient' &&
        a.entiteId === s.patientId &&
        +(a.createdAt as Date) === +(s.createdAt as Date),
    )
    assert.ok(
      trace && medecinsIds.has(trace.utilisateurId as string),
      'suivi chronique non tracé',
    )
  }
})

test('rien n’est daté après la fin de la période : pas d’avenir fabriqué', () => {
  const dates: [string, unknown][] = []
  for (const o of C.Ordonnance) dates.push(['ordonnance', o.updatedAt])
  for (const b of C.BonPharmacie)
    dates.push(['bon pharmacie', b.updatedAt], ['remise', b.delivreLe])
  for (const r of C.ResultatExamen)
    dates.push(['résultat', r.createdAt], ['réalisation', r.dateRealisation])
  for (const e of C.Evacuation) dates.push(['évacuation', e.updatedAt])
  for (const s of C.SuiviEvacuation) dates.push(['étape', s.createdAt])
  for (const s of C.SuiviTraitement)
    dates.push(['suivi', s.updatedAt], ['clôture', s.closedAt])
  for (const f of C.FicheSuiviTraitement) dates.push(['fiche', f.createdAt])
  for (const l of C.LigneOrdonnance) dates.push(['arrêt', l.arreteLe])
  for (const a of C.JournalAudit) dates.push(['audit', a.createdAt])
  for (const [quoi, d] of dates)
    if (d)
      assert.ok(
        +(d as Date) <= +FIN_PERIODE,
        `${quoi} après la fin de la période : ${(d as Date).toISOString()}`,
      )
})

test('chaque geste de la suite d’une consultation est tracé au nom de la bonne personne', () => {
  const trouver = (
    module: string,
    entiteId: string | null,
    quand: Date,
    action: string,
  ) =>
    C.JournalAudit.find(
      (a) =>
        a.module === module &&
        a.entiteId === entiteId &&
        a.action === action &&
        +(a.createdAt as Date) === +quand,
    )
  for (const e of C.Evacuation) {
    const t = trouver('evacuation', null, e.createdAt as Date, 'CREATE')
    assert.ok(t, 'création d’évacuation non tracée')
    const c = consultationParId.get(
      e.consultationId,
    ) as (typeof C.Consultation)[number]
    assert.ok(
      SIM.banc.medecins.some(
        (m) =>
          m.utilisateurId === t.utilisateurId && m.personnelId === c.soignantId,
      ),
    )
  }
  for (const s of C.SuiviTraitement) {
    const t = trouver('suivi_traitement', null, s.createdAt as Date, 'CREATE')
    assert.ok(t, 'ouverture de suivi non tracée')
  }
  for (const f of C.FicheSuiviTraitement) {
    const t = trouver(
      'suivi_traitement',
      f.suiviTraitementId,
      f.createdAt as Date,
      'CREATE',
    )
    assert.ok(t, 'fiche non tracée')
    assert.equal(t.utilisateurId, f.createdBy)
  }
  for (const r of C.ResultatExamen) {
    if (r.corrigeId) continue
    const t = trouver('bon_examen', r.bonId, r.createdAt as Date, 'CREATE')
    assert.ok(t, 'résultat non tracé')
    assert.equal(t.utilisateurId, r.saisiePar)
  }
  const modules = new Set(C.JournalAudit.map((a) => a.module))
  for (const m of [
    'bon_pharmacie',
    'bon_examen',
    'evacuation',
    'suivi_traitement',
  ])
    assert.ok(modules.has(m), `aucun geste ${m}`)
  // le médecin prescrit, décide, délivre ; l’infirmier ne le fait pas
  for (const a of C.JournalAudit)
    if (['consultation', 'evacuation', 'bon_pharmacie'].includes(a.module))
      assert.ok(
        medecinsIds.has(a.utilisateurId as string),
        `${a.module} par un non-médecin`,
      )
})

test('un centre sans médicaments ni examens, ou sans aucun droit de catégorie : le parcours continue, sans bons ni ordonnances impossibles', () => {
  const banc = bancDeTest('sans-prescription', 25, '2026-10-30')
  const vide: ReferentielsTest = {
    ...banc.ref,
    medicaments: new Map(),
    typesExamen: new Map(),
  }
  let ordonnances = 0
  let consultations = 0
  for (const jour of ['2026-10-12', '2026-10-13', '2026-10-14']) {
    const ctx = { ...banc.ctx(jour, 0, 20), ref: vide }
    const { lignes } = planifierJour(ctx)
    ordonnances += lignes.Ordonnance.length
    consultations += lignes.Consultation.length
    assert.equal(lignes.BonExamen.length + lignes.BonPharmacie.length, 0)
  }
  assert.ok(consultations > 10)
  assert.equal(ordonnances, 0)
  // personne n’est couvert : des ordonnances, jamais de bon
  const sansDroits: ReferentielsTest = { ...banc.ref, droits: new Map() }
  let avecOrd = 0
  for (const jour of ['2026-10-12', '2026-10-13', '2026-10-14']) {
    const ctx = { ...banc.ctx(jour, 0, 20), ref: sansDroits }
    const { lignes } = planifierJour(ctx)
    avecOrd += lignes.Ordonnance.length
    assert.equal(lignes.BonExamen.length + lignes.BonPharmacie.length, 0)
  }
  assert.ok(avecOrd > 10)
  // aucune pathologie chronique côté centre : aucun suivi chronique
  const sansChronique: ReferentielsTest = {
    ...banc.ref,
    pathologiesChroniques: new Set(),
  }
  let suivis = 0
  for (const jour of [
    '2026-10-12',
    '2026-10-13',
    '2026-10-14',
    '2026-10-15',
    '2026-10-16',
  ]) {
    const ctx = { ...banc.ctx(jour, 0, 20), ref: sansChronique }
    suivis += planifierJour(ctx).lignes.SuiviChronique.length
  }
  assert.equal(suivis, 0)
})

test('les phrases s’accordent : « 1 jour », jamais « 1 jours » ni « 0 jours »', () => {
  assert.equal(avecJours('depuis {j} jours.', 1), 'depuis 1 jour.')
  assert.equal(avecJours('depuis {j} jours.', 4), 'depuis 4 jours.')
  assert.equal(avecJours('il y a {j} jours', 12), 'il y a 12 jours')
  const textes = [
    ...C.Visite.map((v) => v.notesAccueil),
    ...C.Consultation.map((c) => c.anamneseSymptomes),
    ...C.Ordonnance.map((o) => o.indicationClinik),
    ...C.Evacuation.map((e) => e.infosCliniques),
  ].filter((t): t is string => !!t)
  assert.ok(textes.length > 1000)
  for (const t of textes) {
    assert.equal(/\b[01] jours/.test(t), false, t)
    assert.equal(t.includes('{j}'), false, t)
  }
})

test('qui est évacué ne reçoit ni médicaments ni résultats les jours suivants', () => {
  const evacuees = new Map(
    C.Consultation.filter((c) => c.decisionMedicale === 'EVACUATION').map(
      (c) => [c.id as string, c] as const,
    ),
  )
  assert.ok(evacuees.size > 5, `évacuations : ${evacuees.size}`)
  const jourDe = (d: Date) => jourLocalDe(d)
  for (const b of C.BonPharmacie) {
    const c = evacuees.get(b.consultationId)
    if (c && b.delivreLe)
      assert.equal(
        jourDe(b.delivreLe as Date),
        jourDe(c.createdAt as Date),
        'médicaments remis un autre jour à un patient évacué',
      )
  }
  for (const r of C.ResultatExamen) {
    const bon = bonExamenParId.get(r.bonId) as (typeof C.BonExamen)[number]
    const c = evacuees.get(bon.consultationId)
    if (c)
      assert.equal(
        jourDe(r.createdAt as Date),
        jourDe(c.createdAt as Date),
        'résultat saisi un autre jour pour un patient évacué',
      )
  }
})

test('un traitement ne s’administre que pendant sa durée prescrite', () => {
  const ligneParId = new Map(C.LigneOrdonnance.map((l) => [l.id as string, l]))
  let longues = 0
  for (const a of C.AdministrationTraitement) {
    const l = ligneParId.get(
      a.ligneOrdonnanceId,
    ) as (typeof C.LigneOrdonnance)[number]
    const o = ordonnanceParId.get(
      l.ordonnanceId,
    ) as (typeof C.Ordonnance)[number]
    const jours = /(\d+)\s*jour/.exec(l.duree ?? '')
    const duree = jours ? Number(jours[1]) : 7
    const ecart =
      joursEntre(
        jourLocalDe(o.createdAt as Date),
        jourLocalDe(a.administreLe as Date),
      ).length - 1
    assert.ok(
      ecart < duree,
      `administré ${ecart} jours après la prescription d’un traitement de ${duree} jours`,
    )
    if (duree >= 30 && ecart >= 5) longues++
  }
  assert.ok(longues > 0 || C.AdministrationTraitement.length > 0)
})

console.log('délais en heures d’ouverture')
const hm = (m: { jour: string; s: number }) =>
  `${m.jour} ${String(Math.floor(m.s / 3600)).padStart(2, '0')}:${String(Math.floor((m.s % 3600) / 60)).padStart(2, '0')}`
test('apresDelaiOuvre : dans la journée, rien ne change ; au-delà de la fermeture, on reprend à l’ouverture', () => {
  // lundi 12 octobre 2026
  assert.equal(
    hm(apresDelaiOuvre({ jour: '2026-10-12', s: 10 * 3600 }, 3600)),
    '2026-10-12 11:00',
  )
  // vendredi 16 h, 1 h de délai, fermeture 16 h 30 : 30 min vendredi, 30 min samedi à 8 h → samedi 8 h 30
  assert.equal(
    hm(apresDelaiOuvre({ jour: '2026-10-16', s: 16 * 3600 }, 3600)),
    '2026-10-17 08:30',
  )
  // samedi 12 h, fermeture 12 h 30 : 30 min, puis le lundi à 7 h 30 → lundi 8 h
  assert.equal(
    hm(apresDelaiOuvre({ jour: '2026-10-17', s: 12 * 3600 }, 3600)),
    '2026-10-19 08:00',
  )
  // départ un dimanche : on part de l’ouverture du lundi
  assert.equal(
    hm(apresDelaiOuvre({ jour: '2026-10-18', s: 10 * 3600 }, 1800)),
    '2026-10-19 08:00',
  )
  // départ la nuit : à l’ouverture
  assert.equal(
    hm(apresDelaiOuvre({ jour: '2026-10-13', s: 2 * 3600 }, 0)),
    '2026-10-13 07:30',
  )
  assert.equal(
    hm(apresDelaiOuvre({ jour: '2026-10-13', s: 20 * 3600 }, 0)),
    '2026-10-14 07:30',
  )
  // jeudi 13 août 16 h, 2 h de délai : 30 min jeudi, puis vendredi 14 août dès 7 h 30 → 9 h
  assert.equal(
    hm(apresDelaiOuvre({ jour: '2026-08-13', s: 16 * 3600 }, 2 * 3600)),
    '2026-08-14 09:00',
  )
  // plusieurs jours de délai : jamais hors des heures d’ouverture
  for (let delai = 0; delai < 60 * 3600; delai += 7777) {
    const m = apresDelaiOuvre({ jour: '2026-10-14', s: 9 * 3600 }, delai)
    const h = horairesDuJour(m.jour)
    assert.ok(h && m.s >= h.ouverture * 60 && m.s <= h.fermeture * 60, hm(m))
  }
})
test('jourOuvertSuivant : saute le dimanche et les jours fériés', () => {
  assert.equal(jourOuvertSuivant('2026-10-12'), '2026-10-13')
  assert.equal(jourOuvertSuivant('2026-10-16'), '2026-10-17') // vendredi → samedi (demi-journée)
  assert.equal(jourOuvertSuivant('2026-10-17'), '2026-10-19') // samedi → lundi
  assert.equal(jourOuvertSuivant('2026-08-14'), '2026-08-17') // veille d’un samedi férié → lundi
})

console.log('prévisions, équipe, réseau')
test('periode : quatre mois jusqu’à la veille, fins de mois comprises', () => {
  assert.deepEqual(periode('2026-10-11', 4), {
    debut: '2026-06-11',
    fin: '2026-10-10',
  })
  assert.deepEqual(periode('2026-04-01', 1), {
    debut: '2026-03-01',
    fin: '2026-03-31',
  })
  // « 31 mars − 1 mois » n'existe pas : on tombe sur le dernier jour de février
  assert.equal(periode('2026-04-01', 1).fin, '2026-03-31')
  assert.equal(periode('2026-03-31', 1).debut, '2026-03-01')
  assert.equal(periode('2027-01-02', 12).fin, '2027-01-01')
})
test('capaciteSite : le goulot est l’infirmier ou le médecin, jamais un jour fermé', () => {
  assert.equal(capaciteSite({ medecins: 1, infirmiers: 5 }, '2026-10-11'), 0)
  const un = capaciteSite({ medecins: 1, infirmiers: 3 }, '2026-10-12')
  const deux = capaciteSite({ medecins: 2, infirmiers: 3 }, '2026-10-12')
  assert.ok(un > 20 && un < 45, `${un}`)
  assert.ok(deux > un)
  // sans infirmier, ou sans médecin : aucune capacité
  assert.equal(capaciteSite({ medecins: 2, infirmiers: 0 }, '2026-10-12'), 0)
  assert.equal(capaciteSite({ medecins: 0, infirmiers: 3 }, '2026-10-12'), 0)
  assert.ok(
    capaciteSite({ medecins: 2, infirmiers: 3 }, '2026-10-10') < deux,
    'le samedi est une demi-journée',
  )
})
test('calculerPrevisions : la capacité plafonne la demande, et le dépassement est annoncé', () => {
  const equipes = [
    { medecins: 2, infirmiers: 3 },
    { medecins: 1, infirmiers: 2 },
  ]
  const p = calculerPrevisions({
    debut: '2026-06-11',
    fin: '2026-10-10',
    visitesParJour: 40,
    equipes,
  })
  assert.ok(p.joursOuverts > 95 && p.joursOuverts < 110)
  assert.ok(p.visites > 3000 && p.visites < 4300, `${p.visites}`)
  assert.equal(p.avertissements.length, 0)
  const trop = calculerPrevisions({
    debut: '2026-06-11',
    fin: '2026-10-10',
    visitesParJour: 400,
    equipes,
  })
  assert.ok(trop.visites < p.visites * 3)
  assert.ok(trop.depassementParJour > 100)
  assert.match(trop.avertissements.join(' '), /absorbe/)
  const vide = calculerPrevisions({
    debut: '2026-06-11',
    fin: '2026-10-10',
    visitesParJour: 40,
    equipes: [],
  })
  assert.equal(vide.visites, 0)
  assert.match(vide.avertissements.join(' '), /médecin et un infirmier/)
  assert.ok(p.octets > 25_000_000 && p.octets < 60_000_000, `${p.octets}`)
})
test('classerSoignant : médecin = médecin chef ou fonction médecin ; infirmier = infirmier ou sage-femme', () => {
  assert.equal(classerSoignant(['MEDECIN_CHEF'], 'MEDECIN'), 'MEDECIN')
  assert.equal(classerSoignant(['MEDECIN_CHEF'], ''), 'MEDECIN')
  assert.equal(classerSoignant(['INFIRMIER'], 'INFIRMIER'), 'INFIRMIER')
  assert.equal(classerSoignant(['INFIRMIER'], 'SAGE_FEMME'), 'INFIRMIER')
  // un technicien de laboratoire a le rôle infirmier mais ne reçoit pas les patients
  assert.equal(classerSoignant(['INFIRMIER'], 'TECHNICIEN_LAB'), null)
  assert.equal(classerSoignant(['ADMIN_SYSTEME'], ''), null)
  assert.equal(classerSoignant([], 'INFIRMIER'), null)
})
test('adresses IP : valides, congolaises, stables par site, villes connues de la base de géolocalisation', () => {
  const a = creerAlea('ips')
  const valide = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  for (let i = 0; i < 200; i++) {
    const ip = ipCongolaise(a)
    const m = valide.exec(ip)
    assert.ok(m, ip)
    assert.ok(m.slice(1).every((x) => Number(x) <= 255))
  }
  const mou = ipsDuSite(creerAlea('m'), 'MOUTELA')
  const nka = ipsDuSite(creerAlea('n'), 'NKAYI')
  assert.ok(
    mou.length >= 1 && mou.length <= 2 && new Set(mou).size === mou.length,
  )
  assert.ok(
    mou.every((x) => /^5\.62\.6[13]\./.test(x)),
    mou.join(' '),
  ) // Brazzaville
  assert.ok(
    nka.every((x) => x.startsWith('169.255.')),
    nka.join(' '),
  ) // Dolisie
  assert.deepEqual(ipsDuSite(creerAlea('m'), 'MOUTELA'), mou, 'reproductible')
})

console.log(`\n${passed} réussis, ${failed} échoués`)
if (failed > 0) process.exit(1)
