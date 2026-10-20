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
  ajouterJours,
  apresDelaiOuvre,
  auDela,
  DELAI_AVANT_MAINTENANT_S,
  estFerie,
  estOuvert,
  horairesDuJour,
  horairesEffectifs,
  instantLocal,
  instantSecondes,
  jourLocalDe,
  joursEntre,
  jourOuvertSuivant,
  minutesArrivees,
  momentLocalDe,
  partDesArrivees,
  type Horaires,
  type Moment,
  fenetreFileAttente,
  minutesArriveesEntre,
  MARGE_FILE_ATTENTE_S,
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
  etatAMaintenant,
} from '../src/modules/donnees-test/planificateur'
import { Population } from '../src/modules/donnees-test/population'
import {
  departAvantMaintenant,
  jourOuvertPrecedent,
  planDeJournee,
} from '../src/modules/donnees-test/planificateur-connexions'
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
  periodeJusqua,
  periodeJusquaMaintenant,
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
  equipes: EquipeSite[]
  ctx: (
    jour: string,
    indexJour: number,
    totalJours: number,
    limite?: Moment | null,
  ) => ContexteJour
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
  let numero = 0
  const faire = (siteId: string): Soignant => ({
    utilisateurId: uuid(),
    login: `agent.${graine}.${++numero}`,
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
    equipes,
    medecins: [...medecinsM, ...medecinsN],
    infirmiers: [...infirmiersM, ...infirmiersN],
    ref,
    population,
    deja: new Set(),
    ctx: (jour, indexJour, totalJours, limite = null) => ({
      jour,
      alea: alea.sousFlux(jour),
      racine: alea,
      equipes,
      ref,
      etat: { population, fabrique, numerotation },
      params: { visitesParJour, indexJour, totalJours, finPeriode, limite },
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

// ── Livraison 3 : connexions du personnel ──────────────────────────────────────

console.log('livraison 3 : sessions et journal des connexions')

const PERSONNEL = [...SIM.banc.medecins, ...SIM.banc.infirmiers]
const personnelParId = new Map(PERSONNEL.map((p) => [p.utilisateurId, p]))
const SESSIONS = C.SessionUtilisateur
const JOURNAL = C.JournalAuthentification
const DIX_MIN = 10 * 60_000

interface ChaineTest {
  connexionId: string
  utilisateurId: string
  lignes: typeof SESSIONS
  debut: number
  /** Dernier instant où la connexion est tenue pour ouverte (cf. resumerConnexions). */
  fin: number
  revoquee: number | null
}
const chainesParConnexion = new Map<string, typeof SESSIONS>()
for (const s of SESSIONS)
  chainesParConnexion.set(s.connexionId as string, [
    ...(chainesParConnexion.get(s.connexionId as string) ?? []),
    s,
  ])
const CHAINES: ChaineTest[] = [...chainesParConnexion.entries()].map(
  ([id, l]) => {
    const lignes = [...l].sort(
      (a, b) => +(a.createdAt as Date) - +(b.createdAt as Date),
    )
    const derniere = lignes[lignes.length - 1]
    const activite = +(derniere.derniereActiviteAt as Date)
    const revoquee = derniere.revokedAt ? +(derniere.revokedAt as Date) : null
    return {
      connexionId: id,
      utilisateurId: derniere.utilisateurId,
      lignes,
      debut: +(lignes[0].createdAt as Date),
      fin:
        revoquee !== null && revoquee - activite <= DIX_MIN
          ? revoquee
          : activite,
      revoquee,
    }
  },
)
const chainesParUtilisateur = new Map<string, ChaineTest[]>()
for (const c of CHAINES)
  chainesParUtilisateur.set(
    c.utilisateurId,
    [...(chainesParUtilisateur.get(c.utilisateurId) ?? []), c].sort(
      (a, b) => a.debut - b.debut,
    ),
  )

test('chaque membre du personnel se connecte chaque jour d’ouverture, au rythme d’une journée de travail', () => {
  const joursOuverts = joursEntre('2026-06-11', '2026-10-10').filter(
    estOuvert,
  ).length
  const parJour = new Map<string, Set<string>>()
  for (const s of JOURNAL)
    if (s.connexionId && s.utilisateurId)
      parJour.set(
        jourLocalDe(s.createdAt as Date),
        (parJour.get(jourLocalDe(s.createdAt as Date)) ?? new Set()).add(
          s.utilisateurId,
        ),
      )
  for (const [jour, users] of parJour)
    assert.equal(
      users.size,
      PERSONNEL.length,
      `${jour} : tout le monde se connecte`,
    )
  assert.equal(parJour.size, joursOuverts)
  const connexions = JOURNAL.filter((j) => j.connexionId).length
  assert.ok(connexions >= PERSONNEL.length * joursOuverts)
  assert.ok(
    connexions < PERSONNEL.length * joursOuverts * 1.2,
    `${connexions} connexions`,
  )
  assert.equal(CHAINES.length, connexions)
})

test('aucun geste du personnel hors d’une connexion ouverte', () => {
  let controles = 0
  for (const a of C.JournalAudit) {
    const t = +(a.createdAt as Date)
    const chaines = chainesParUtilisateur.get(a.utilisateurId as string) ?? []
    const couvert = chaines.some((c) => c.debut <= t && t <= c.fin)
    assert.ok(
      couvert,
      `${a.module}/${a.action} à ${(a.createdAt as Date).toISOString()} sans connexion ouverte`,
    )
    controles++
  }
  assert.ok(controles > 10_000)
})

test('une connexion est une chaîne de sessions : chaque renouvellement ferme la session et en ouvre une neuve', () => {
  let renouvellements = 0
  for (const c of CHAINES) {
    assert.equal(
      c.lignes[0].id,
      c.connexionId,
      'la première session porte l’identifiant de la connexion',
    )
    const uas = new Set(c.lignes.map((l) => l.userAgent))
    const appareils = new Set(c.lignes.map((l) => l.appareilId))
    const ips = new Set(c.lignes.map((l) => l.ipAdresse))
    assert.equal(uas.size, 1)
    assert.equal(appareils.size, 1)
    assert.equal(ips.size, 1)
    assert.equal(new Set(c.lignes.map((l) => l.utilisateurId)).size, 1)
    c.lignes.forEach((l, i) => {
      assert.equal(
        +(l.expiresAt as Date) - +(l.createdAt as Date),
        7 * 24 * 3600_000,
      )
      assert.ok(
        typeof l.refreshTokenHash === 'string' &&
          l.refreshTokenHash.startsWith('$2b$10$') &&
          l.refreshTokenHash.length === 60,
      )
      assert.ok(
        +(l.derniereActiviteAt as Date) >= +(l.createdAt as Date),
        `activité avant l’ouverture : session ${i}/${c.lignes.length} créée ${(l.createdAt as Date).toISOString()}, activité ${(l.derniereActiviteAt as Date).toISOString()}, révoquée ${(l.revokedAt as Date | null)?.toISOString()}`,
      )
      const suivante = c.lignes[i + 1]
      if (suivante) {
        renouvellements++
        assert.equal(
          +(l.revokedAt as Date),
          +(suivante.createdAt as Date),
          'rotation : fermée à l’ouverture de la suivante',
        )
        assert.ok(+(l.derniereActiviteAt as Date) <= +(l.revokedAt as Date))
      } else if (l.revokedAt)
        assert.ok(+(l.revokedAt as Date) >= +(l.derniereActiviteAt as Date))
    })
    // un jeton d'accès vaut 8 h : une connexion plus longue est renouvelée, aucune session ne dure plus
    c.lignes.forEach((l, i) => {
      const suivante = c.lignes[i + 1]
      const finRang = suivante ? +(suivante.createdAt as Date) : c.fin
      assert.ok(
        finRang - +(l.createdAt as Date) <= (8 * 3600 + 16 * 60) * 1000,
        `une session reste ouverte ${Math.round((finRang - +(l.createdAt as Date)) / 60000)} minutes sans être renouvelée`,
      )
    })
    assert.ok(
      c.lignes.length <= 3,
      `${c.lignes.length} sessions pour une connexion`,
    )
  }
  assert.ok(renouvellements > 20, `renouvellements : ${renouvellements}`)
})

test('session unique : se connecter ferme la session précédente du compte, à l’instant même ; une seule reste ouverte, la dernière jour', () => {
  for (const [utilisateurId, chaines] of chainesParUtilisateur) {
    chaines.forEach((c, i) => {
      const suivante = chaines[i + 1]
      if (!suivante) {
        assert.notEqual(
          c.revoquee,
          null,
          `${utilisateurId} : dernière session laissée ouverte`,
        )
        return
      }
      assert.notEqual(
        c.revoquee,
        null,
        'connexion jamais fermée alors qu’une autre a suivi',
      )
      const fermee = c.revoquee as number
      assert.ok(
        fermee <= suivante.debut,
        'fermée après l’ouverture de la suivante',
      )
      // soit une déconnexion (peu avant), soit la connexion suivante qui la ferme (même instant)
      const parLaSuivante = fermee === suivante.debut
      const logout = JOURNAL.find(
        (j) =>
          j.resultat === 'SUCCES_LOGOUT' &&
          j.utilisateurId === utilisateurId &&
          +(j.createdAt as Date) === fermee,
      )
      assert.ok(
        parLaSuivante || logout,
        'fermeture sans déconnexion ni connexion suivante',
      )
    })
  }
})

test('depuis un AUTRE appareil, le serveur pose la question avant d’ouvrir ; depuis le même, il ouvre sans rien demander', () => {
  let questions = 0
  const parUtilisateur = new Map<string, typeof JOURNAL>()
  for (const j of JOURNAL)
    if (j.utilisateurId)
      parUtilisateur.set(j.utilisateurId, [
        ...(parUtilisateur.get(j.utilisateurId) ?? []),
        j,
      ])
  for (const [utilisateurId, chaines] of chainesParUtilisateur) {
    const journal = (parUtilisateur.get(utilisateurId) ?? []).sort(
      (a, b) => +(a.createdAt as Date) - +(b.createdAt as Date),
    )
    chaines.forEach((c, i) => {
      const ouverture = journal.find((j) => j.connexionId === c.connexionId)
      assert.ok(ouverture, 'connexion sans ligne de journal')
      const precedente = chaines[i - 1]
      const autreAppareil =
        !!precedente &&
        precedente.revoquee !== null &&
        precedente.revoquee >= c.debut &&
        precedente.lignes[0].appareilId !== c.lignes[0].appareilId
      if (autreAppareil) {
        assert.equal(
          ouverture.resultat,
          'SUCCES_LOGIN_SESSION_REMPLACEE',
          'changement d’appareil sans la question',
        )
        const question = journal.filter(
          (j) =>
            j.resultat === 'SUCCES_LOGIN_SESSION_ACTIVE' &&
            +(j.createdAt as Date) < +(ouverture.createdAt as Date) &&
            +(ouverture.createdAt as Date) - +(j.createdAt as Date) <= 120_000,
        )
        assert.equal(question.length, 1, 'la question précède la réponse')
        assert.equal(question[0].connexionId, null)
        questions++
      } else assert.equal(ouverture.resultat, 'SUCCES_LOGIN')
    })
  }
  assert.equal(
    JOURNAL.filter((j) => j.resultat === 'SUCCES_LOGIN_SESSION_ACTIVE').length,
    questions,
  )
  assert.ok(questions > 5, `questions : ${questions}`)
})

test('le journal des connexions et les sessions se répondent : même compte, même appareil, même instant', () => {
  const premieres = new Map(CHAINES.map((c) => [c.connexionId, c.lignes[0]]))
  for (const j of JOURNAL) {
    const p = personnelParId.get(j.utilisateurId as string)
    if (
      j.resultat.startsWith('SUCCES_LOGIN') &&
      j.resultat !== 'SUCCES_LOGIN_SESSION_ACTIVE'
    ) {
      const s = premieres.get(j.connexionId as string)
      assert.ok(s, 'ouverture sans session')
      assert.equal(+(s.createdAt as Date), +(j.createdAt as Date))
      assert.equal(s.userAgent, j.userAgent)
      assert.equal(s.ipAdresse, j.ipAdresse)
      assert.equal(s.utilisateurId, j.utilisateurId)
      assert.equal(p?.login, j.login)
      assert.equal(j.posteLocalId, null)
    } else if (j.resultat === 'SUCCES_LOGOUT') {
      assert.equal(j.connexionId, null)
      const c = (
        chainesParUtilisateur.get(j.utilisateurId as string) ?? []
      ).find((x) => x.revoquee === +(j.createdAt as Date))
      assert.ok(c, 'déconnexion sans session fermée')
      assert.equal(c.lignes[c.lignes.length - 1].userAgent, j.userAgent)
      assert.equal(p?.login, j.login)
    } else {
      // échecs et question : jamais de connexion ouverte
      assert.equal(j.connexionId, null)
    }
  }
  // chaque déconnexion ferme exactement une session
  const logouts = JOURNAL.filter((j) => j.resultat === 'SUCCES_LOGOUT')
  assert.ok(
    logouts.length > CHAINES.length * 0.5 &&
      logouts.length < CHAINES.length * 0.95,
    `${logouts.length}/${CHAINES.length}`,
  )
})

test('les échecs : mot de passe faux juste avant la connexion du même compte ; identifiant inconnu = faute de frappe', () => {
  const logins = new Set(PERSONNEL.map((p) => p.login))
  let faux = 0
  let inconnus = 0
  for (const j of JOURNAL) {
    if (j.resultat === 'ECHEC_MOT_DE_PASSE') {
      faux++
      assert.ok(logins.has(j.login))
      assert.equal(j.connexionId, null)
      const suite = JOURNAL.find(
        (x) =>
          x.utilisateurId === j.utilisateurId &&
          x.connexionId &&
          +(x.createdAt as Date) > +(j.createdAt as Date) &&
          +(x.createdAt as Date) - +(j.createdAt as Date) <= 5 * 60_000,
      )
      assert.ok(suite, 'échec sans connexion qui le suive')
      assert.equal(suite.userAgent, j.userAgent)
    } else if (j.resultat === 'ECHEC_LOGIN_INCONNU') {
      inconnus++
      assert.equal(j.utilisateurId, null)
      assert.equal(logins.has(j.login), false, 'l’identifiant tapé existe')
      assert.ok(
        PERSONNEL.some((p) => j.login.startsWith(p.login.slice(0, 4))),
        'faute sur un identifiant réel',
      )
    }
  }
  const succes = JOURNAL.filter((j) => j.connexionId).length
  assert.ok(faux > 0 && inconnus > 0)
  assert.ok(
    (faux + inconnus) / succes > 0.01 && (faux + inconnus) / succes < 0.09,
  )
})

test('la position de l’appareil : relevée près du site, avec sa marge d’erreur, ou refusée ; jamais sur une déconnexion ni un échec', () => {
  const sitesCoord: Record<string, [number, number]> = {
    MOUTELA: [-4.2509, 15.2347],
    NKAYI: [-4.1833, 13.2833],
  }
  const equipeDe = (utilisateurId: string) =>
    SIM.banc.equipes.find((e) =>
      [...e.medecins, ...e.infirmiers].some(
        (p) => p.utilisateurId === utilisateurId,
      ),
    )
  const parAppareil = new Map<string, Map<string, number>>()
  const statuts = new Map<string, number>()
  for (const j of JOURNAL) {
    const ouvre = !!j.connexionId
    if (!ouvre) {
      assert.equal(j.positionStatut ?? null, null)
      assert.equal(j.latitude ?? null, null)
      assert.equal(j.positionLe ?? null, null)
      continue
    }
    const statut = j.positionStatut ?? 'AUCUNE'
    statuts.set(statut, (statuts.get(statut) ?? 0) + 1)
    const appareil = premieresParConnexion(j.connexionId as string)
      .appareilId as string
    const m = parAppareil.get(appareil) ?? new Map<string, number>()
    m.set(statut, (m.get(statut) ?? 0) + 1)
    parAppareil.set(appareil, m)
    if (statut === 'OK') {
      const eq = equipeDe(j.utilisateurId as string) as EquipeSite
      const [lat, lon] = sitesCoord[eq.siteCode]
      assert.ok(
        Math.abs((j.latitude as number) - lat) < 0.02 &&
          Math.abs((j.longitude as number) - lon) < 0.02,
        'position loin du site',
      )
      assert.ok(
        (j.precisionM as number) >= 3 && (j.precisionM as number) <= 4000,
      )
      assert.ok(
        +(j.positionLe as Date) > +(j.createdAt as Date) &&
          +(j.positionLe as Date) - +(j.createdAt as Date) <= 60_000,
      )
    } else {
      assert.equal(j.latitude ?? null, null)
      assert.equal(j.longitude ?? null, null)
      assert.equal(j.precisionM ?? null, null)
      assert.equal(
        j.positionLe === null || j.positionLe === undefined,
        statut === 'AUCUNE',
      )
    }
  }
  for (const s of ['OK', 'REFUSEE', 'INDISPONIBLE', 'AUCUNE'])
    assert.ok((statuts.get(s) ?? 0) > 0, `aucune position « ${s} »`)
  // un appareil répond presque toujours la même chose (l’autorisation est mémorisée)
  for (const [, m] of parAppareil) {
    const total = [...m.values()].reduce((a, b) => a + b, 0)
    if (total >= 20)
      assert.ok(
        Math.max(...m.values()) / total >= 0.8,
        'réponses de position incohérentes pour un même appareil',
      )
  }
})
function premieresParConnexion(connexionId: string) {
  return (chainesParConnexion.get(connexionId) as typeof SESSIONS)[0]
}

test('chacun garde ses appareils : au plus un ordinateur et un téléphone, l’ordinateur toujours à la même adresse', () => {
  for (const [utilisateurId, chaines] of chainesParUtilisateur) {
    const appareils = new Map<string, Set<string | null | undefined>>()
    for (const c of chaines) {
      const l = c.lignes[0]
      appareils.set(
        l.appareilId as string,
        (appareils.get(l.appareilId as string) ?? new Set()).add(l.userAgent),
      )
    }
    assert.ok(
      appareils.size <= 2,
      `${utilisateurId} : ${appareils.size} appareils`,
    )
    for (const [, uas] of appareils)
      assert.equal(uas.size, 1, 'un appareil, deux navigateurs')
    const ordinateur = chaines.filter((c) =>
      /Windows/.test(c.lignes[0].userAgent as string),
    )
    const telephone = chaines.filter((c) =>
      /Android/.test(c.lignes[0].userAgent as string),
    )
    assert.equal(
      new Set(ordinateur.map((c) => c.lignes[0].ipAdresse)).size,
      1,
      'l’ordinateur change d’adresse',
    )
    assert.equal(ordinateur.length + telephone.length, chaines.length)
  }
  assert.ok(
    CHAINES.some((c) => /Android/.test(c.lignes[0].userAgent as string)),
    'aucune connexion depuis un téléphone',
  )
})

test('les heures de connexion sont celles d’un centre ouvert, et rien ne dépasse la fin de la période', () => {
  const tout: [string, Date | null | undefined][] = []
  for (const j of JOURNAL) tout.push(['journal', j.createdAt as Date])
  for (const s of SESSIONS)
    tout.push(
      ['session', s.createdAt as Date],
      ['révocation', s.revokedAt as Date | null | undefined],
      ['activité', s.derniereActiviteAt as Date | null | undefined],
    )
  for (const [quoi, d] of tout) {
    if (!d) continue
    const jour = jourLocalDe(d)
    assert.ok(estOuvert(jour), `${quoi} un jour de fermeture : ${jour}`)
    const minutes = (+d - +instantLocal(jour, 0)) / 60_000
    assert.ok(
      minutes >= 5 * 60 + 30 && minutes <= 19 * 60 + 30,
      `${quoi} à ${Math.round(minutes / 60)} h ${jour}`,
    )
    assert.ok(+d <= +FIN_PERIODE, `${quoi} après la fin de la période`)
  }
})

test('le plan d’une journée ne dépend que de la personne et du jour : deux appels, même réponse', () => {
  const racine = creerAlea('plan')
  const p = SIM.banc.infirmiers[0]
  const un = planDeJournee(racine, p, '2026-09-14', '2026-10-10')
  racine.float()
  racine.float()
  assert.deepEqual(planDeJournee(racine, p, '2026-09-14', '2026-10-10'), un)
  assert.notDeepEqual(planDeJournee(racine, p, '2026-09-15', '2026-10-10'), un)
  assert.notDeepEqual(
    planDeJournee(racine, SIM.banc.infirmiers[1], '2026-09-14', '2026-10-10'),
    un,
  )
  // le dernier jour d’ouverture de la période, tout le monde se déconnecte
  for (const personne of PERSONNEL)
    assert.equal(
      planDeJournee(racine, personne, '2026-10-10', '2026-10-10').deconnexion,
      true,
    )
  // arrivée avant l’ouverture du centre (7 h 30 en semaine)
  for (let i = 0; i < 200; i++) {
    const plan = planDeJournee(
      racine,
      p,
      ajouterJours('2026-06-15', i),
      '2027-12-31',
    )
    const h = horairesDuJour(ajouterJours('2026-06-15', i))
    if (h)
      assert.ok(
        plan.arriveeS < h.ouverture * 60 - 60,
        'arrivée après l’ouverture',
      )
  }
})
test('jourOuvertPrecedent : saute le dimanche et les jours fériés', () => {
  assert.equal(jourOuvertPrecedent('2026-10-12'), '2026-10-10') // lundi → samedi
  assert.equal(jourOuvertPrecedent('2026-10-13'), '2026-10-12')
  assert.equal(jourOuvertPrecedent('2026-08-17'), '2026-08-14') // lundi après le samedi férié
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

console.log('aujourd’hui : la période va jusqu’à maintenant, sans fabriquer d’avenir')

/** Un instant par son jour et son heure LOCALES (Brazzaville, UTC+1). */
const maintenantA = (jour: string, hh: number, mm = 0): Date =>
  instantLocal(jour, hh * 60 + mm)
const heures = (hh: number, mm = 0) => (hh * 60 + mm) * 60

test('periodeJusqua : n’exclut pas le dernier jour ; periode (« jusqu’à la veille ») en découle', () => {
  assert.deepEqual(periodeJusqua('2026-10-12', 4), {
    debut: '2026-06-13',
    fin: '2026-10-12',
  })
  assert.deepEqual(periodeJusqua('2026-10-10', 4), periode('2026-10-11', 4))
})

test('periodeJusquaMaintenant : aujourd’hui est le dernier jour dès qu’un passage a pu s’y terminer', () => {
  // lundi 12 octobre, 14 h
  const lundi14 = periodeJusquaMaintenant(maintenantA('2026-10-12', 14), 4)
  assert.deepEqual(lundi14, {
    debut: '2026-06-13',
    fin: '2026-10-12',
    limite: { jour: '2026-10-12', s: heures(14) },
  })
  // avant 11 h : trop tôt (ouverture 7 h 30 + 90 minutes d’arrivées + 2 h de marge) → la veille, comme avant
  const lundi1059 = periodeJusquaMaintenant(maintenantA('2026-10-12', 10, 59), 4)
  assert.deepEqual(lundi1059, { ...periode('2026-10-12', 4), limite: null })
  assert.equal(lundi1059.fin, '2026-10-11')
  // 11 h pile : la limite
  assert.equal(periodeJusquaMaintenant(maintenantA('2026-10-12', 11), 4).fin, '2026-10-12')
  // le soir, centre fermé depuis plus de deux heures : la journée entière
  const soir = periodeJusquaMaintenant(maintenantA('2026-10-12', 18, 45), 4)
  assert.equal(soir.fin, '2026-10-12')
  assert.deepEqual(soir.limite, { jour: '2026-10-12', s: heures(18, 45) })
})

test('periodeJusquaMaintenant : centre fermé ou demi-journée trop courte → jusqu’à la veille', () => {
  // dimanche : fermé
  const dimanche = periodeJusquaMaintenant(maintenantA('2026-10-11', 15), 4)
  assert.equal(dimanche.fin, '2026-10-10')
  assert.equal(dimanche.limite, null)
  // jour férié (25 décembre, un vendredi)
  assert.equal(periodeJusquaMaintenant(maintenantA('2026-12-25', 15), 4).fin, '2026-12-24')
  // samedi (8 h → 12 h 30) : à 11 h, 60 minutes seulement ; à 12 h, 120
  assert.equal(periodeJusquaMaintenant(maintenantA('2026-10-17', 11), 4).fin, '2026-10-16')
  assert.equal(periodeJusquaMaintenant(maintenantA('2026-10-17', 12), 4).fin, '2026-10-17')
})

test('periodeJusquaMaintenant : le jour est celui de Brazzaville, pas celui d’UTC', () => {
  // 23 h 30 UTC le dimanche = 0 h 30 le LUNDI à Brazzaville : trop tôt pour le lundi → jusqu’à dimanche
  const t = new Date('2026-10-11T23:30:00.000Z')
  assert.equal(jourLocalDe(t), '2026-10-12')
  assert.equal(periodeJusquaMaintenant(t, 4).fin, '2026-10-11')
  assert.deepEqual(momentLocalDe(t), { jour: '2026-10-12', s: 30 * 60 })
})

test('momentLocalDe : le jour local et les secondes depuis minuit local', () => {
  assert.deepEqual(momentLocalDe(maintenantA('2026-10-12', 14, 5)), {
    jour: '2026-10-12',
    s: heures(14, 5),
  })
})

test('horairesEffectifs : ses horaires un autre jour, coupés deux heures avant maintenant aujourd’hui', () => {
  const plein = horairesDuJour('2026-10-12') as Horaires
  const lim = (hh: number, mm = 0): Moment => ({ jour: '2026-10-12', s: heures(hh, mm) })
  // pas de coupure, ou un autre jour que celui de la coupure : horaires entiers
  assert.deepEqual(horairesEffectifs('2026-10-12', null), plein)
  assert.deepEqual(horairesEffectifs('2026-10-09', lim(14)), horairesDuJour('2026-10-09'))
  // fermé : rien
  assert.equal(horairesEffectifs('2026-10-11', null), null)
  // aujourd'hui, 14 h → fermeture fabriquée à 12 h, marquée coupée
  assert.deepEqual(horairesEffectifs('2026-10-12', lim(14)), {
    ...plein,
    fermeture: 12 * 60,
    tronque: true,
  })
  // 14 h 05 → 12 h 05 (les minutes sont gardées)
  assert.equal(horairesEffectifs('2026-10-12', lim(14, 5))?.fermeture, 12 * 60 + 5)
  // fermeture + 2 h dépassée : la journée est entière, non coupée
  assert.deepEqual(horairesEffectifs('2026-10-12', lim(18, 31)), plein)
  assert.equal(horairesEffectifs('2026-10-12', lim(18, 31))?.tronque, undefined)
  // pile à la fermeture du centre + 2 h : la journée est entière (pas coupée d'une minute)
  assert.equal(horairesEffectifs('2026-10-12', lim(18, 30))?.tronque, undefined)
  assert.equal(horairesEffectifs('2026-10-12', lim(18, 29))?.tronque, true)
  // trop tôt : 10 h 59 → rien
  assert.equal(horairesEffectifs('2026-10-12', lim(10, 59)), null)
  assert.equal(horairesEffectifs('2026-10-12', lim(11))?.tronque, true)
})

test('partDesArrivees : 1 pour une journée entière, 0 sans fenêtre, croissante, et juste par rapport au tirage réel', () => {
  for (const jour of ['2026-10-12', '2026-10-17']) {
    // lundi (deux pics) puis samedi (un pic)
    const plein = horairesDuJour(jour) as Horaires
    assert.equal(partDesArrivees(plein, plein), 1)
    assert.equal(partDesArrivees(plein, { ...plein, fermeture: plein.ouverture + 30 }), 0)
    let avant = 0
    for (let f = plein.ouverture + 120; f <= plein.fermeture; f += 20) {
      const p = partDesArrivees(plein, { ...plein, fermeture: f, tronque: true })
      assert.ok(p >= avant - 1e-9 && p >= 0 && p <= 1, `${jour} ${f} : ${p}`)
      avant = p
    }
    // la formule décrit ce que le tirage fait vraiment (tirage de la journée entière : combien avant la coupure ?)
    const alea = creerAlea(`part|${jour}`)
    const arrivees = minutesArrivees(alea, 20000, plein)
    for (const f of [plein.ouverture + 150, plein.ouverture + 240, plein.ouverture + 330]) {
      const coupure = { ...plein, fermeture: f, tronque: true }
      const mesuree = arrivees.filter((m) => m <= f - 30).length / arrivees.length
      const calculee = partDesArrivees(plein, coupure)
      assert.ok(
        Math.abs(mesuree - calculee) < 0.015,
        `${jour} coupure ${f} : mesuré ${mesuree.toFixed(3)}, calculé ${calculee.toFixed(3)}`,
      )
    }
  }
})

test('minutesArrivees d’une journée coupée : toutes avant la coupure, le même nombre, sans empilement à la coupure', () => {
  const plein = horairesDuJour('2026-10-12') as Horaires
  const coupee: Horaires = { ...plein, fermeture: 12 * 60, tronque: true } // dernière arrivée à 11 h 30
  const arrivees = minutesArrivees(creerAlea('coupure'), 3000, coupee)
  assert.equal(arrivees.length, 3000)
  assert.ok(arrivees.every((m) => m >= coupee.ouverture && m <= coupee.fermeture - 30))
  const parMinute = new Map<number, number>()
  for (const m of arrivees) parMinute.set(m, (parMinute.get(m) ?? 0) + 1)
  // ramenées à la coupure, ~40 % des arrivées (le second pic, tombé au-delà) s'empileraient sur UNE minute
  const aLaCoupure = parMinute.get(coupee.fermeture - 30) ?? 0
  assert.ok(aLaCoupure < 3000 * 0.01, `${aLaCoupure} arrivées à la minute de coupure`)
  // (l'ouverture a toujours son petit paquet : les arrivées d'avant l'ouverture y sont ramenées)
  assert.ok((parMinute.get(coupee.ouverture) ?? 0) < 3000 * 0.12)
  // le premier pic (ouverture + 90 min = 9 h) reste le plus fourni
  const matin = arrivees.filter((m) => m >= 8 * 60 + 30 && m <= 9 * 60 + 30).length
  const fin = arrivees.filter((m) => m >= 10 * 60 + 30).length
  assert.ok(matin > fin, `matin ${matin}, fin ${fin}`)
  // reproductible
  assert.deepEqual(minutesArrivees(creerAlea('coupure'), 3000, coupee), arrivees)
})

test('minutesArrivees d’une journée ordinaire : inchangée (aucun tirage de plus)', () => {
  const plein = horairesDuJour('2026-10-12') as Horaires
  assert.deepEqual(
    minutesArrivees(creerAlea('ordinaire'), 500, plein),
    minutesArrivees(creerAlea('ordinaire'), 500, { ...plein }),
  )
})

test('auDela : après le dernier jour, ou plus tard que maintenant ce jour-là', () => {
  const sans = { finPeriode: '2026-10-12' }
  const avec = { finPeriode: '2026-10-12', limite: { jour: '2026-10-12', s: heures(14) } }
  // sans coupure : on s'arrête à la fin de la journée du dernier jour
  assert.equal(auDela(sans, { jour: '2026-10-12', s: heures(23) }), false)
  assert.equal(auDela(sans, { jour: '2026-10-13', s: 0 }), true)
  // avec coupure : le jour de la coupure, rien après maintenant
  assert.equal(auDela(avec, { jour: '2026-10-12', s: heures(14) }), false)
  assert.equal(auDela(avec, { jour: '2026-10-12', s: heures(14) + 1 }), true)
  assert.equal(auDela(avec, { jour: '2026-10-12', s: heures(9) }), false)
  assert.equal(auDela(avec, { jour: '2026-10-09', s: heures(23) }), false)
  assert.equal(auDela(avec, { jour: '2026-10-13', s: 0 }), true)
  assert.equal(auDela({ ...avec, limite: null }, { jour: '2026-10-12', s: heures(20) }), false)
})

test('calculerPrevisions : aujourd’hui est compté pour la part déjà écoulée, et annoncé', () => {
  const equipes = [
    { medecins: 3, infirmiers: 4 },
    { medecins: 2, infirmiers: 3 },
  ]
  const base = { debut: '2026-10-05', fin: '2026-10-12', visitesParJour: 40, equipes }
  const hier = calculerPrevisions({ ...base, fin: '2026-10-10' })
  assert.deepEqual(hier.aujourdhui, { inclus: false, jusqua: null })
  // fin = aujourd'hui, mais sans coupure fournie : un jour entier
  const entier = calculerPrevisions(base)
  assert.deepEqual(entier.aujourdhui, { inclus: false, jusqua: null })
  // 14 h : la journée de lundi est fabriquée jusqu'à la dernière arrivée de la file d'attente, trois minutes avant
  const partiel = calculerPrevisions({ ...base, limite: { jour: '2026-10-12', s: heures(14) } })
  assert.deepEqual(partiel.aujourdhui, { inclus: true, jusqua: '13:57' })
  assert.ok(partiel.visites > hier.visites, 'aujourd’hui ajoute des visites')
  assert.ok(partiel.visites < entier.visites, 'mais moins qu’une journée entière')
  // la part écoulée croît avec l'heure
  const tard = calculerPrevisions({ ...base, limite: { jour: '2026-10-12', s: heures(17) } })
  assert.ok(tard.visites > partiel.visites)
  // le soir, la journée est entière : annoncée, sans heure d'arrêt
  const soir = calculerPrevisions({ ...base, limite: { jour: '2026-10-12', s: heures(19) } })
  assert.deepEqual(soir.aujourdhui, { inclus: true, jusqua: null })
  assert.equal(soir.visites, entier.visites)
  // un jour de fermeture n'est pas un jour : rien de plus
  const dimanche = calculerPrevisions({
    ...base,
    debut: '2026-10-05',
    fin: '2026-10-11',
    limite: { jour: '2026-10-11', s: heures(15) },
  })
  assert.deepEqual(dimanche.aujourdhui, { inclus: false, jusqua: null })
})

// ── Une semaine qui s'arrête aujourd'hui, 14 h ───────────────────────────────

const AUJOURDHUI = '2026-10-12'
const MAINTENANT: Moment = { jour: AUJOURDHUI, s: heures(14) }
const INSTANT_MAINTENANT = instantSecondes(AUJOURDHUI, MAINTENANT.s)

function simulerJusquaMaintenant(graine: string, visitesParJour: number) {
  const banc = bancDeTest(graine, visitesParJour, AUJOURDHUI)
  const jours = joursEntre('2026-10-05', AUJOURDHUI)
  const parJour = new Map<string, LignesJour>()
  const resumes = new Map<string, { visites: number }>()
  jours.forEach((jour, i) => {
    if (!estOuvert(jour)) return
    // « Maintenant » est un paramètre de TOUTE la génération (comme dans le service) : un résultat attendu
    // d'un vendredi tombe lundi, et c'est lundi qu'il doit s'arrêter à maintenant.
    const r = planifierJour(banc.ctx(jour, i, jours.length, MAINTENANT))
    parJour.set(jour, r.lignes)
    resumes.set(jour, { visites: r.resume.visites })
  })
  return { banc, parJour, resumes }
}

/** Champs de dates qui désignent l'AVENIR par nature (une échéance, une validité), pas un geste daté. */
const DATES_D_AVENIR = new Set([
  'expiresAt', // un jeton valable sept jours
  'prochainControle',
  'prochainSuivi',
  'dateReprise', // fin d'un repos prescrit : une date d'avenir
])

function datesDesGestes(
  lignes: LignesJour,
): { table: string; champ: string; date: Date }[] {
  const trouvees: { table: string; champ: string; date: Date }[] = []
  for (const [table, rows] of Object.entries(lignes)) {
    for (const row of rows as Record<string, unknown>[]) {
      for (const [champ, v] of Object.entries(row)) {
        if (v instanceof Date && !DATES_D_AVENIR.has(champ))
          trouvees.push({ table, champ, date: v })
      }
    }
  }
  return trouvees
}

const AUJ = simulerJusquaMaintenant('aujourd-hui-1', 40)
// Huit autres semaines (d'autres graines) : certains gestes ne tombent qu'une fois sur des centaines de visites
// (la clôture d'un suivi d'une seule fiche, un résultat attendu d'un vendredi et daté de lundi après-midi…).
const AUJ_AUTRES = Array.from({ length: 8 }, (_, k) =>
  simulerJusquaMaintenant(`aujourd-hui-part-${k}`, 40),
)

test('aujourd’hui à 14 h : AUCUN geste n’est daté après maintenant (visites, documents, suivis, connexions, audit…)', () => {
  let verifiees = 0
  for (const sim of [AUJ, ...AUJ_AUTRES]) {
    for (const [jour, lignes] of sim.parJour) {
      for (const { table, champ, date } of datesDesGestes(lignes)) {
        verifiees++
        assert.ok(
          +date <= +INSTANT_MAINTENANT,
          `${jour} ${table}.${champ} après maintenant : ${date.toISOString()}`,
        )
      }
    }
  }
  assert.ok(verifiees > 40_000, `${verifiees} dates vérifiées`)
})

test('aujourd’hui à 14 h : des passages ont eu lieu jusqu’à maintenant, la file d’attente comprise', () => {
  const lignes = AUJ.parJour.get(AUJOURDHUI) as LignesJour
  assert.ok(lignes.Visite.length > 5, `${lignes.Visite.length} visites`)
  // aucune visite n'est ouverte après maintenant ; la dernière arrivée précède maintenant d'au moins la marge
  for (const v of lignes.Visite)
    assert.ok(+(v.dateOuverture as Date) <= +INSTANT_MAINTENANT, `visite ouverte à ${(v.dateOuverture as Date).toISOString()}`)
  // et il y en a dans les deux dernières heures (ce que la journée coupée à elle seule ne fabriquait pas)
  const coupure = instantSecondes(AUJOURDHUI, MAINTENANT.s - DELAI_AVANT_MAINTENANT_S)
  let recentes = 0
  for (const sim of [AUJ, ...AUJ_AUTRES])
    recentes += (sim.parJour.get(AUJOURDHUI) as LignesJour).Visite.filter((v) => +(v.dateOuverture as Date) > +coupure).length
  assert.ok(recentes >= 20, `${recentes} visites dans les deux dernières heures, sur 9 semaines`)
  // le matin est bien là : la première visite est à l'heure d'ouverture
  const premiere = Math.min(...lignes.Visite.map((v) => +(v.dateOuverture as Date)))
  assert.ok(premiere >= +instantLocal(AUJOURDHUI, 7 * 60 + 30))
  assert.ok(premiere < +instantLocal(AUJOURDHUI, 9 * 60), 'le matin est fabriqué')
})

test('aujourd’hui à 14 h : le nombre de visites suit la part de la journée écoulée', () => {
  const plein = horairesDuJour(AUJOURDHUI) as Horaires
  const coupe = horairesEffectifs(AUJOURDHUI, MAINTENANT) as Horaires
  // la journée coupée, prolongée par la file d'attente : les arrivées vont jusqu'à maintenant moins la marge
  const file = fenetreFileAttente(plein, coupe, MAINTENANT) as { debut: number; fin: number }
  const part = partDesArrivees(plein, { ...plein, fermeture: file.fin + 30 })
  assert.ok(part > partDesArrivees(plein, coupe), 'la file ajoute des arrivées')
  assert.ok(part > 0.3 && part < 0.9, `part ${part}`)
  let aujourdhui = 0
  let normaux = 0
  let nbNormaux = 0
  for (const sim of AUJ_AUTRES) {
    aujourdhui += sim.resumes.get(AUJOURDHUI)?.visites ?? 0
    // un lundi ordinaire de la même semaine
    for (const j of ['2026-10-05']) {
      normaux += sim.resumes.get(j)?.visites ?? 0
      nbNormaux++
    }
  }
  const rapport = aujourdhui / 8 / (normaux / nbNormaux)
  assert.ok(
    rapport > part * 0.7 && rapport < part * 1.3,
    `aujourd’hui = ${(rapport * 100).toFixed(0)} % d’un lundi ordinaire, attendu ~${(part * 100).toFixed(0)} %`,
  )
})

test('aujourd’hui à 14 h : chacun s’est connecté ce matin et l’est encore (le centre est ouvert), après son dernier geste', () => {
  const lignes = AUJ.parJour.get(AUJOURDHUI) as LignesJour
  const personnel = [...AUJ.banc.medecins, ...AUJ.banc.infirmiers]
  for (const qui of personnel) {
    // il s'est connecté ce matin, et n'est pas parti
    const entrees = lignes.JournalAuthentification.filter(
      (l) => l.utilisateurId === qui.utilisateurId && /^SUCCES_LOGIN/.test(l.resultat as string),
    )
    assert.ok(entrees.length >= 1, `${qui.login} ne s’est pas connecté`)
    assert.ok(entrees.every((l) => +(l.createdAt as Date) < +INSTANT_MAINTENANT))
    assert.ok(
      !lignes.JournalAuthentification.some((l) => l.utilisateurId === qui.utilisateurId && l.resultat === 'SUCCES_LOGOUT'),
      `${qui.login} s’est déconnecté alors que le centre est ouvert`,
    )
  }
  // une session ouverte par personne : celle de maintenant ; les autres ont été fermées avant maintenant
  for (const qui of personnel) {
    const sessions = lignes.SessionUtilisateur.filter((s) => s.utilisateurId === qui.utilisateurId)
    assert.equal(sessions.filter((s) => !s.revokedAt).length, 1, qui.login)
    for (const s of sessions) if (s.revokedAt) assert.ok(+(s.revokedAt as Date) <= +INSTANT_MAINTENANT)
  }
})

test('aujourd’hui : la session laissée ouverte hier est fermée par la connexion de ce matin', () => {
  const hier = jourOuvertPrecedent(AUJOURDHUI)
  const sessionsHier = (AUJ.parJour.get(hier) as LignesJour).SessionUtilisateur
  assert.ok(sessionsHier.length > 0)
  for (const s of sessionsHier) {
    assert.ok(s.revokedAt, 'session d’hier jamais fermée')
    assert.ok(+(s.revokedAt as Date) <= +INSTANT_MAINTENANT)
  }
})

test('departAvantMaintenant : avant maintenant, jamais avant d’être arrivé ni d’avoir fini, jamais dans le futur', () => {
  const maintenant = heures(14)
  // un départ déjà passé (une journée entière, le soir d'avant) : inchangé
  assert.equal(departAvantMaintenant(heures(13, 30), maintenant, heures(7), heures(12), 300), heures(13, 30))
  assert.equal(departAvantMaintenant(maintenant - 60, maintenant, heures(7), heures(12), 300), maintenant - 60)
  // un départ du soir est ramené juste avant maintenant : tirage de 5 minutes
  assert.equal(departAvantMaintenant(heures(17), maintenant, heures(7), heures(12), 300), maintenant - 300)
  // pas avant le début de la dernière connexion + 2 minutes (le navigateur relancé il y a 5 minutes)
  assert.equal(
    departAvantMaintenant(heures(17), maintenant, maintenant - 300, heures(12), 600),
    maintenant - 300 + 120,
  )
  // pas avant le dernier geste + 2 minutes
  assert.equal(
    departAvantMaintenant(heures(17), maintenant, heures(7), maintenant - 400, 600),
    maintenant - 400 + 120,
  )
  // jamais après maintenant : le dernier geste est à une minute de maintenant → on part à maintenant
  assert.equal(departAvantMaintenant(heures(17), maintenant, heures(7), maintenant - 60, 60), maintenant)
  assert.equal(departAvantMaintenant(heures(17), maintenant, heures(7), maintenant, 60), maintenant)
})

test('calculerPrevisions : une petite équipe plafonne aussi la part d’aujourd’hui (ses heures écoulées seulement)', () => {
  // un médecin et un infirmier : ~35 visites par jour ; la demande (200) dépasse de loin
  const equipes = [{ medecins: 1, infirmiers: 1 }]
  const base = { debut: '2026-10-05', fin: '2026-10-12', visitesParJour: 200, equipes }
  const hier = calculerPrevisions({ ...base, fin: '2026-10-10' })
  const aujourdhui = calculerPrevisions({
    ...base,
    limite: { jour: '2026-10-12', s: heures(14) },
  })
  const plein = capaciteSite(equipes[0]!, '2026-10-12')
  const ajout = aujourdhui.visites - hier.visites
  // arrivées jusqu'à 13 h 57 (la file d'attente comprise) : 447 minutes des 540 de la journée → environ les
  // trois quarts de la capacité du jour
  assert.ok(ajout > plein * 0.65 && ajout < plein * 0.9, `ajout ${ajout}, capacité du jour ${plein}`)
})

test('aujourd’hui : sur des centaines de journées simulées, jamais un geste après maintenant (évacuations, suivis, annulations comprises)', () => {
  const coupures: Moment[] = [
    { jour: AUJOURDHUI, s: heures(11) },
    { jour: AUJOURDHUI, s: heures(13, 20) },
    { jour: AUJOURDHUI, s: heures(15) },
  ]
  const futurs: string[] = []
  let gestes = 0
  for (const limite of coupures) {
    const instantLimite = +instantSecondes(AUJOURDHUI, limite.s)
    for (let k = 0; k < 150; k++) {
      const banc = bancDeTest(`futur-${limite.s}-${k}`, 120, AUJOURDHUI)
      const r = planifierJour(banc.ctx(AUJOURDHUI, 0, 1, limite))
      for (const { table, champ, date } of datesDesGestes(r.lignes)) {
        gestes++
        if (+date > instantLimite)
          futurs.push(`${table}.${champ} ${date.toISOString()} (coupure ${limite.s / 3600} h)`)
      }
      // et la déconnexion de chacun suit son dernier geste
      for (const sortie of r.lignes.JournalAuthentification.filter((l) => l.resultat === 'SUCCES_LOGOUT')) {
        const t = +(sortie.createdAt as Date)
        const dernierGeste = Math.max(
          0,
          ...r.lignes.JournalAudit.filter((l) => l.utilisateurId === sortie.utilisateurId).map((l) => +(l.createdAt as Date)),
        )
        if (t < dernierGeste) futurs.push(`déconnexion de ${sortie.login} avant son dernier geste`)
        const connexions = r.lignes.JournalAuthentification.filter(
          (l) => l.utilisateurId === sortie.utilisateurId && /^SUCCES_LOGIN/.test(l.resultat as string),
        ).map((l) => +(l.createdAt as Date))
        if (t < Math.max(...connexions)) futurs.push(`déconnexion de ${sortie.login} avant sa dernière connexion`)
      }
    }
  }
  assert.deepEqual(futurs.slice(0, 5), [])
  assert.ok(gestes > 500_000, `${gestes} gestes vérifiés`)
})

test('aujourd’hui trop tôt ou en fin de journée : le même planificateur, sans surprise', () => {
  // coupure trop proche de l'ouverture : aucune visite, mais les connexions du personnel existent
  const banc = bancDeTest('trop-tot', 40, AUJOURDHUI)
  const tot = planifierJour(banc.ctx(AUJOURDHUI, 0, 1, { jour: AUJOURDHUI, s: heures(10, 30) }))
  assert.equal(tot.lignes.Visite.length, 0)
  assert.equal(tot.resume.visites, 0)
  // le soir (19 h) : la journée est entière — mêmes lignes qu'une génération arrêtée hier, mais datée aujourd'hui
  const soir = planifierJour(
    bancDeTest('soir', 40, AUJOURDHUI).ctx(AUJOURDHUI, 0, 1, { jour: AUJOURDHUI, s: heures(19) }),
  )
  const sansLimite = planifierJour(bancDeTest('soir', 40, AUJOURDHUI).ctx(AUJOURDHUI, 0, 1, null))
  assert.equal(soir.lignes.Visite.length, sansLimite.lignes.Visite.length)
  assert.equal(soir.lignes.Consultation.length, sansLimite.lignes.Consultation.length)
})


// ── La file d'attente du moment ───────────────────────────────────────────────

console.log('la file d’attente du moment : les passages pas finis à maintenant sont fabriqués tels qu’ils sont')

test('etatAMaintenant : fini, en attente, en consultation — selon l’instant', () => {
  const reussie = { tEnvoi: 1000, fin: 2000 }
  // hors file d'attente (fabrication d'un passage fini) : toujours fini
  assert.equal(etatAMaintenant(null, { annulee: false, tAnnulation: 0, reussie }), 'FINIE')
  // avant l'envoi au médecin : en attente
  assert.equal(etatAMaintenant(999, { annulee: false, tAnnulation: 0, reussie }), 'ATTENTE')
  // dès l'envoi et jusqu'à la clôture (exclue) : en consultation
  assert.equal(etatAMaintenant(1000, { annulee: false, tAnnulation: 0, reussie }), 'EN_COURS')
  assert.equal(etatAMaintenant(1999, { annulee: false, tAnnulation: 0, reussie }), 'EN_COURS')
  // à la seconde de la clôture, c'est fini
  assert.equal(etatAMaintenant(2000, { annulee: false, tAnnulation: 0, reussie }), 'FINIE')
  // une annulation encore à venir : la personne attend toujours
  assert.equal(etatAMaintenant(500, { annulee: true, tAnnulation: 600, reussie: null }), 'ATTENTE')
  assert.equal(etatAMaintenant(600, { annulee: true, tAnnulation: 600, reussie: null }), 'FINIE')
})

test('fenetreFileAttente : de la coupure à maintenant moins la marge, jamais au-delà des dernières arrivées du centre', () => {
  const plein = horairesDuJour(AUJOURDHUI) as Horaires // 7 h 30 – 16 h 30
  const h14 = horairesEffectifs(AUJOURDHUI, { jour: AUJOURDHUI, s: heures(14) }) as Horaires
  assert.deepEqual(fenetreFileAttente(plein, h14, { jour: AUJOURDHUI, s: heures(14) }), {
    debut: 12 * 60 - 30, // la journée coupée s'arrête aux arrivées de 11 h 30
    fin: 14 * 60 - MARGE_FILE_ATTENTE_S / 60, // 13 h 57
  })
  // centre ouvert tard : la dernière arrivée reste celle de la fermeture moins une demi-heure
  const h16 = horairesEffectifs(AUJOURDHUI, { jour: AUJOURDHUI, s: heures(18, 20) }) as Horaires
  assert.equal(fenetreFileAttente(plein, h16, { jour: AUJOURDHUI, s: heures(18, 20) })?.fin, plein.fermeture - 30)
  // journée entière (centre fermé depuis plus de deux heures), autre jour, ou pas de coupure : pas de file
  const h19 = horairesEffectifs(AUJOURDHUI, { jour: AUJOURDHUI, s: heures(19) }) as Horaires
  assert.equal(fenetreFileAttente(plein, h19, { jour: AUJOURDHUI, s: heures(19) }), null)
  assert.equal(fenetreFileAttente(plein, plein, null), null)
  assert.equal(fenetreFileAttente(plein, null, { jour: AUJOURDHUI, s: heures(14) }), null)
})

test('minutesArriveesEntre : triées, toutes dans la fenêtre, déterministes, sans empilement à la borne', () => {
  const plein = horairesDuJour(AUJOURDHUI) as Horaires
  const debut = 11 * 60 + 30
  const fin = 13 * 60 + 57
  const arrivees = minutesArriveesEntre(creerAlea('file'), 3000, plein, debut, fin)
  assert.equal(arrivees.length, 3000)
  assert.ok(arrivees.every((m, i) => m > debut && m <= fin && (i === 0 || m >= arrivees[i - 1]!)))
  assert.deepEqual(minutesArriveesEntre(creerAlea('file'), 3000, plein, debut, fin), arrivees)
  const parMinute = new Map<number, number>()
  for (const m of arrivees) parMinute.set(m, (parMinute.get(m) ?? 0) + 1)
  assert.ok((parMinute.get(fin) ?? 0) < 3000 * 0.03, 'arrivées empilées à la dernière minute')
  assert.ok((parMinute.get(debut + 1) ?? 0) < 3000 * 0.03, 'arrivées empilées à la première minute')
})

/** Les visites de la file d'attente d'une simulation d'aujourd'hui à 14 h, avec leurs consultations. */
function laFile(sim: { parJour: Map<string, LignesJour> }) {
  const lignes = sim.parJour.get(AUJOURDHUI) as LignesJour
  const ouvertes = lignes.Visite.filter((v) => v.statut === 'EN_ATTENTE' || v.statut === 'EN_COURS')
  return { lignes, ouvertes }
}

test('file d’attente à 14 h : il y en a une, de taille plausible, et seulement dans les dernières heures', () => {
  let enAttente = 0
  let enCours = 0
  let semainesAvecFile = 0
  for (const sim of [AUJ, ...AUJ_AUTRES]) {
    const { lignes, ouvertes } = laFile(sim)
    if (ouvertes.length > 0) semainesAvecFile++
    for (const v of ouvertes) {
      if (v.statut === 'EN_ATTENTE') enAttente++
      else enCours++
      // une visite pas finie est une visite RÉCENTE : jamais celle du matin
      assert.ok(
        +(v.dateOuverture as Date) > +INSTANT_MAINTENANT - 4 * 3600 * 1000,
        `visite ouverte à ${(v.dateOuverture as Date).toISOString()} et toujours ${v.statut}`,
      )
      assert.ok(+(v.dateOuverture as Date) <= +INSTANT_MAINTENANT)
    }
    // aucune file les autres jours
    for (const [jour, l] of sim.parJour)
      if (jour !== AUJOURDHUI)
        assert.equal(l.Visite.filter((v) => v.statut === 'EN_ATTENTE' || v.statut === 'EN_COURS').length, 0, jour)
  }
  const moyenne = (enAttente + enCours) / 9
  assert.ok(semainesAvecFile >= 8, `${semainesAvecFile} semaines sur 9 avec une file`)
  assert.ok(moyenne >= 0.8 && moyenne <= 6, `${moyenne.toFixed(1)} visites pas finies en moyenne`)
  assert.ok(enCours > 0, 'aucune consultation en cours')
})

test('file d’attente : chaque visite pas finie est cohérente (statut, médecin, consultation OUVERTE, évènements, constantes)', () => {
  let verifiees = 0
  for (const sim of [AUJ, ...AUJ_AUTRES]) {
    const { lignes, ouvertes } = laFile(sim)
    const ouvertesParVisite = new Map<string, Record<string, unknown>[]>()
    for (const c of lignes.Consultation.filter((c) => c.statut === 'OUVERTE'))
      ouvertesParVisite.set(c.visiteId as string, [...(ouvertesParVisite.get(c.visiteId as string) ?? []), c])
    for (const v of ouvertes) {
      verifiees++
      const id = v.id as string
      assert.equal(v.dateCloture, null, 'une visite pas finie n’est pas clôturée')
      assert.equal(v.typeCloture, null)
      assert.equal(v.motifAnnulation, null)
      const consultations = lignes.Consultation.filter((c) => c.visiteId === id)
      const evenements = lignes.VisiteEvenement.filter((e) => e.visiteId === id)
      const envoyee = evenements.some((e) => e.type === 'STATUT_CHANGE' && e.nouvelleVal === 'EN_COURS')
      if (v.statut === 'EN_ATTENTE') {
        assert.equal(consultations.length, 0, 'en attente : pas de consultation')
        assert.equal(envoyee, false, 'en attente : pas encore envoyée au médecin')
      } else {
        assert.ok(v.soignantId, 'en consultation : un médecin est désigné')
        assert.equal(envoyee, true, 'en consultation : l’envoi au médecin est consigné')
        // une consultation OUVERTE au plus, de ce médecin — ou aucune encore (le médecin ne l'a pas ouverte)
        assert.ok(consultations.length <= 1)
        for (const c of consultations) {
          assert.equal(c.statut, 'OUVERTE')
          assert.equal(c.closedAt ?? null, null, 'une consultation ouverte n’est pas clôturée')
          assert.equal(c.soignantId, v.soignantId)
          assert.ok(c.pickedUpById, 'le médecin a la consultation en main')
          assert.equal(c.conclusion ?? null, null)
          assert.equal(c.decisionMedicale ?? null, null)
          assert.ok(+(c.createdAt as Date) <= +INSTANT_MAINTENANT)
          assert.ok(+(c.createdAt as Date) >= +(v.dateOuverture as Date))
        }
      }
      // les constantes (si prises) précèdent maintenant et suivent l'ouverture de la visite
      for (const k of lignes.ConstanteVitale.filter((k) => k.visiteId === id)) {
        assert.ok(+(k.createdAt as Date) <= +INSTANT_MAINTENANT)
      }
      assert.ok(+(v.updatedAt as Date) <= +INSTANT_MAINTENANT)
      assert.ok(+(v.updatedAt as Date) >= +(v.dateOuverture as Date))
      // aucun document : ni diagnostic, ni ordonnance, ni bon — le médecin n'a rien décidé
      for (const c of consultations) {
        assert.equal(lignes.DiagnosticConsultation.filter((d) => d.consultationId === c.id).length, 0)
        assert.equal(lignes.Ordonnance.filter((o) => o.consultationId === c.id).length, 0)
      }
    }
    // jamais de consultation OUVERTE sans visite en consultation, ni deux ouvertes pour le même médecin
    const parMedecin = new Map<string, number>()
    for (const c of lignes.Consultation.filter((c) => c.statut === 'OUVERTE')) {
      const visite = lignes.Visite.find((v) => v.id === c.visiteId)
      assert.ok(visite && visite.statut === 'EN_COURS', 'consultation ouverte sans visite en consultation')
      parMedecin.set(c.soignantId as string, (parMedecin.get(c.soignantId as string) ?? 0) + 1)
    }
    for (const [medecin, n] of parMedecin) assert.equal(n, 1, `le médecin ${medecin} tient ${n} consultations ouvertes`)
    // et toute consultation dont la visite est finie est elle-même finie
    for (const c of lignes.Consultation) {
      const visite = lignes.Visite.find((v) => v.id === c.visiteId)
      if (visite && (visite.statut === 'CLOTUREE' || visite.statut === 'ANNULEE'))
        assert.notEqual(c.statut, 'OUVERTE', 'consultation ouverte sur une visite finie')
    }
  }
  assert.ok(verifiees >= 9, `${verifiees} visites pas finies vérifiées`)
})

test('file d’attente : ni visite ni consultation annulée dans les deux dernières heures (la file est celle de gens qui attendent ou qui sont reçus)', () => {
  const coupure = +instantSecondes(AUJOURDHUI, MAINTENANT.s - DELAI_AVANT_MAINTENANT_S)
  let recentes = 0
  for (const sim of [AUJ, ...AUJ_AUTRES, ...AUJ_AUTRES]) {
    const lignes = sim.parJour.get(AUJOURDHUI) as LignesJour
    for (const v of lignes.Visite.filter((v) => +(v.dateOuverture as Date) > coupure)) {
      recentes++
      assert.notEqual(v.statut, 'ANNULEE', 'visite annulée dans la file')
    }
    for (const c of lignes.Consultation.filter((c) => +(c.createdAt as Date) > coupure))
      assert.notEqual(c.statut, 'ANNULEE', 'consultation annulée dans la file')
  }
  assert.ok(recentes > 20, `${recentes} visites dans la file`)
})

test('file d’attente : le résumé du jour compte exactement ce qui est écrit', () => {
  for (const graine of ['file-resume-1', 'file-resume-2', 'file-resume-3', 'file-resume-4']) {
    const banc = bancDeTest(graine, 80, AUJOURDHUI)
    const r = planifierJour(banc.ctx(AUJOURDHUI, 0, 1, MAINTENANT))
    assert.equal(
      r.resume.visitesEnAttente,
      r.lignes.Visite.filter((v) => v.statut === 'EN_ATTENTE').length,
      graine,
    )
    assert.equal(
      r.resume.consultationsOuvertes,
      r.lignes.Consultation.filter((c) => c.statut === 'OUVERTE').length,
      graine,
    )
    assert.equal(r.resume.visites, r.lignes.Visite.length, graine)
  }
})

test('file d’attente : plus la fréquentation est forte, plus la file est longue', () => {
  const moyenne = (parJour: number) => {
    let total = 0
    for (let k = 0; k < 30; k++) {
      const banc = bancDeTest(`file-charge-${parJour}-${k}`, parJour, AUJOURDHUI)
      const r = planifierJour(banc.ctx(AUJOURDHUI, 0, 1, MAINTENANT))
      total += r.resume.visitesEnAttente + r.resume.consultationsOuvertes
    }
    return total / 30
  }
  const calme = moyenne(15)
  const dense = moyenne(80)
  assert.ok(dense > calme, `calme ${calme.toFixed(2)}, dense ${dense.toFixed(2)}`)
})

test('file d’attente : le personnel est connecté à maintenant — pas de déconnexion, session ouverte, activité de l’instant', () => {
  const lignes = AUJ.parJour.get(AUJOURDHUI) as LignesJour
  const personnel = [...AUJ.banc.medecins, ...AUJ.banc.infirmiers]
  assert.equal(
    lignes.JournalAuthentification.filter((l) => l.resultat === 'SUCCES_LOGOUT').length,
    0,
    'le centre est ouvert : personne ne s’est déconnecté',
  )
  for (const qui of personnel) {
    const gestes = lignes.JournalAudit.filter((l) => l.utilisateurId === qui.utilisateurId).map((l) => +(l.createdAt as Date))
    const sessions = lignes.SessionUtilisateur.filter((s) => s.utilisateurId === qui.utilisateurId)
    const ouverte = sessions.filter((s) => !s.revokedAt)
    assert.equal(ouverte.length, 1, `${qui.login} : ${ouverte.length} session(s) ouverte(s)`)
    const activite = +(ouverte[0]!.derniereActiviteAt as Date)
    assert.ok(activite <= +INSTANT_MAINTENANT, `${qui.login} : activité dans le futur`)
    assert.ok(activite >= +INSTANT_MAINTENANT - 130_000, `${qui.login} : dernière activité trop ancienne pour quelqu’un qui travaille`)
    if (gestes.length) assert.ok(activite >= Math.max(...gestes), `${qui.login} : activité avant son dernier geste`)
  }
  // celui qui tient une consultation ouverte est connecté
  for (const c of lignes.Consultation.filter((c) => c.statut === 'OUVERTE')) {
    const medecin = AUJ.banc.medecins.find((m) => m.personnelId === c.soignantId)
    assert.ok(medecin)
    assert.ok(lignes.SessionUtilisateur.some((s) => s.utilisateurId === medecin.utilisateurId && !s.revokedAt))
  }
})

test('file d’attente : après la fermeture du centre, chacun s’est déconnecté (rien ne reste ouvert à 17 h)', () => {
  const banc = bancDeTest('file-soir', 40, AUJOURDHUI)
  const r = planifierJour(banc.ctx(AUJOURDHUI, 0, 1, { jour: AUJOURDHUI, s: heures(17, 40) }))
  // 17 h 40 : le centre a fermé à 16 h 30, la dernière arrivée possible est à 16 h : tout est fini depuis longtemps
  // et plus personne n'est au travail
  assert.equal(
    r.lignes.Visite.filter((v) => v.statut === 'EN_ATTENTE' || v.statut === 'EN_COURS').length,
    0,
    'le centre est fermé : plus de file',
  )
  assert.ok(r.lignes.JournalAuthentification.some((l) => l.resultat === 'SUCCES_LOGOUT'))
})

console.log(`\n${passed} réussis, ${failed} échoués`)
if (failed > 0) process.exit(1)
