/**
 * L'ouverture d'un dossier : qui est cette personne (identité, famille, emploi, coordonnées) et ce
 * que l'accueil en consigne (allergies, antécédents, maladies chroniques, mode de vie).
 *
 * Les règles sont celles de l'accueil réel (`PatientService.create`) : un travailleur CDI/CDD a
 * matricule, fonction, section de paie, service et département ; un ayant droit est rattaché à un
 * travailleur CDI par un lien de parenté ; un sous-traitant, à une société. Les données
 * d'identification (nom complet, téléphone, matricule, numéro de dossier) ne se répètent jamais.
 */
import type { Alea } from './alea'
import {
  ALLERGIES,
  ANTECEDENTS_CHIRURGICAUX,
  ANTECEDENTS_FAMILIAUX,
  ANTECEDENTS_GYNECO,
  ANTECEDENTS_MEDICAUX,
  DEPARTEMENTS_EMPLOYES,
  FONCTIONS_EMPLOYES,
  LIENS_URGENCE,
  MODE_VIE,
  OCCUPATIONS_AYANT_DROIT,
  QUARTIERS,
  SECTIONS_PAIE,
  SERVICES_EMPLOYES,
} from './catalogue-identites'
import {
  LIBELLE_CHRONIQUE,
  probaChronique,
  type ProfilClinique,
} from './catalogue-clinique'
import { nouvelleMorphologie } from './constantes-vitales'
import { tracer, type ContexteJour, type Soignant } from './contexte'
import type { Sexe } from './fabrique-identites'
import { nouvelIdTest } from './marque-test'
import { ageA, type PatientSim, UN_JOUR_MS } from './population'
import type { LignesJour } from './registre'

/** Poids de chaque catégorie parmi les NOUVEAUX dossiers (celles que le centre n'a pas sont écartées). */
const POIDS_CATEGORIES: readonly (readonly [string, number])[] = [
  ['ASSURE_CDI', 27],
  ['AYANT_DROIT_CDI', 31],
  ['ASSURE_CDD', 8],
  ['SOUS_TRAITANT', 12],
  ['RIVERAIN', 10],
  ['RETRAITE', 4],
  ['AGENT_FONCTIONNAIRE', 3],
  ['PATIENT_EXTERNE', 5],
]

export function categorieDisponible(ctx: ContexteJour, code: string): boolean {
  if (!ctx.ref.categories.has(code)) return false
  if (code === 'SOUS_TRAITANT' && ctx.ref.societes.length === 0) return false
  if (code === 'AYANT_DROIT_CDI' && !ctx.ref.categories.has('ASSURE_CDI'))
    return false
  return true
}

/** La catégorie d'un nouveau dossier. */
export function choisirCategorie(ctx: ContexteJour): string {
  const liste: (readonly [string, number])[] = POIDS_CATEGORIES.filter(([c]) =>
    categorieDisponible(ctx, c),
  )
  // Les catégories que le centre a ajoutées lui-même pèsent un peu : elles existent pour servir.
  for (const code of ctx.ref.categories.keys())
    if (!POIDS_CATEGORIES.some(([c]) => c === code)) liste.push([code, 3])
  return ctx.alea.pondere(liste)
}

function tirerSexeAge(alea: Alea, code: string): { sexe: Sexe; age: number } {
  const homme = (p: number): Sexe => (alea.proba(p) ? 'M' : 'F')
  switch (code) {
    case 'ASSURE_CDI':
      return {
        sexe: homme(0.78),
        age: Math.round(alea.normaleBornee(39, 9, 21, 59)),
      }
    case 'ASSURE_CDD':
      return {
        sexe: homme(0.8),
        age: Math.round(alea.normaleBornee(32, 7, 20, 55)),
      }
    case 'SOUS_TRAITANT':
      return {
        sexe: homme(0.86),
        age: Math.round(alea.normaleBornee(34, 8, 19, 58)),
      }
    case 'RIVERAIN': {
      const [min, max] = alea.pondere<readonly [number, number]>([
        [[0, 14], 30],
        [[15, 39], 40],
        [[40, 64], 22],
        [[65, 85], 8],
      ])
      return { sexe: homme(0.47), age: alea.entier(min, max) }
    }
    case 'RETRAITE':
      return {
        sexe: homme(0.7),
        age: Math.round(alea.normaleBornee(66, 5, 58, 88)),
      }
    case 'AGENT_FONCTIONNAIRE':
      return {
        sexe: homme(0.6),
        age: Math.round(alea.normaleBornee(41, 9, 24, 59)),
      }
    case 'PATIENT_EXTERNE':
      return {
        sexe: homme(0.5),
        age: Math.round(alea.normaleBornee(36, 14, 15, 75)),
      }
    default:
      return {
        sexe: homme(0.5),
        age: Math.round(alea.normaleBornee(38, 13, 18, 70)),
      }
  }
}

/** Une date de naissance qui donne cet âge à la date de référence. */
export function naissanceDepuisAge(
  alea: Alea,
  age: number,
  reference: Date,
): Date {
  const debut = Date.UTC(
    reference.getUTCFullYear() - age - 1,
    reference.getUTCMonth(),
    reference.getUTCDate(),
  )
  // entre (age+1) ans et age ans avant la référence : la personne a bien `age` ans révolus
  return new Date(debut + alea.entier(1, 364) * UN_JOUR_MS)
}

function adresse(alea: Alea, prefixeSite: string): string {
  const villes =
    prefixeSite === 'NKA'
      ? ['Nkayi', 'Dolisie', 'Madingou', 'Mouyondzi']
      : prefixeSite === 'MOU'
        ? ['Brazzaville']
        : null
  const pool = villes
    ? QUARTIERS.filter(([, v]) => villes.includes(v))
    : QUARTIERS
  const [quartier, ville] = alea.choisir(pool.length ? pool : QUARTIERS)
  return /^(Centre|Cité|Quartier)/.test(quartier)
    ? `${quartier}, ${ville}`
    : `Quartier ${quartier}, ${ville}`
}

export interface DemandePatient {
  categorieCode: string
  siteId: string
  siteCode: string
  /** Quand le dossier est ouvert. */
  instant: Date
  auteur: Soignant
}

/**
 * Ouvre un dossier et l'ajoute à la population. Un ayant droit est rattaché à un travailleur CDI :
 * s'il n'en existe aucun avec de la place, le dossier du travailleur est ouvert d'abord (comme le
 * fait l'accueil quand un ayant droit se présente avant le travailleur lui-même).
 */
export function creerPatient(
  ctx: ContexteJour,
  lignes: LignesJour,
  d: DemandePatient,
): PatientSim {
  const { alea, ref, etat } = ctx
  const code = d.categorieCode
  let sexe: Sexe
  let age: number
  let nomImpose: string | undefined
  let cdi: PatientSim | null = null
  let typeLien: string | null = null

  if (code === 'AYANT_DROIT_CDI') {
    cdi = etat.population.cdiAvecPlace(alea)
    if (!cdi)
      cdi = creerPatient(ctx, lignes, {
        ...d,
        categorieCode: 'ASSURE_CDI',
        instant: new Date(d.instant.getTime() - 45_000),
      })
    const ageCdi = ageA(cdi.naissance, d.instant)
    typeLien = alea.pondere([
      ['ENFANT', ageCdi >= 22 ? 52 : 0],
      ['CONJOINT', 34],
      ['PARENT', 11],
      ['AUTRE', 3],
    ])
    const autreSexe = (s: Sexe): Sexe => (s === 'M' ? 'F' : 'M')
    switch (typeLien) {
      case 'ENFANT':
        age = Math.min(
          Math.floor(24 * alea.float() ** 1.4),
          Math.max(0, ageCdi - 18),
        )
        sexe = alea.proba(0.5) ? 'M' : 'F'
        if (alea.proba(0.9)) nomImpose = cdi.nom
        break
      case 'CONJOINT':
        age = Math.round(alea.normaleBornee(ageCdi - 1, 5, 19, 75))
        sexe = alea.proba(0.92) ? autreSexe(cdi.sexe) : cdi.sexe
        if (alea.proba(0.4)) nomImpose = cdi.nom
        break
      case 'PARENT':
        age = Math.min(88, Math.max(50, ageCdi + alea.entier(20, 32)))
        sexe = alea.proba(0.5) ? 'M' : 'F'
        if (alea.proba(0.6)) nomImpose = cdi.nom
        break
      default:
        age = alea.entier(8, 60)
        sexe = alea.proba(0.5) ? 'M' : 'F'
        if (alea.proba(0.3)) nomImpose = cdi.nom
    }
    cdi.nbDependants++
  } else {
    ;({ sexe, age } = tirerSexeAge(alea, code))
  }

  const { nom, prenom } = etat.fabrique.nomComplet(sexe, nomImpose)
  const naissance = naissanceDepuisAge(alea, age, d.instant)
  const employe = code === 'ASSURE_CDI' || code === 'ASSURE_CDD'
  const matricule = employe
    ? etat.fabrique.matricule(code === 'ASSURE_CDI' ? 'CDI' : 'CDD')
    : null
  const id = nouvelIdTest()
  const prefixe = d.siteCode.slice(0, 3).toUpperCase()
  // Le numéro définitif est attribué en fin de journée, dans l'ordre exact des ouvertures de
  // dossier (cf. planifierJour) : deux infirmiers qui travaillent en parallèle n'inversent pas la suite.
  const numeroPatient = 'PROVISOIRE'
  const categorieId = ref.categories.get(code) as string
  const quand = d.instant

  lignes.Patient.push({
    id,
    numeroPatient,
    matricule,
    siteCreationId: d.siteId,
    categoriePatientId: categorieId,
    statut: 'ACTIF',
    version: 1,
    createdAt: quand,
    createdBy: d.auteur.utilisateurId,
    updatedAt: quand,
  })
  lignes.IdentitePatient.push({
    id: nouvelIdTest(),
    patientId: id,
    nom,
    prenom,
    dateNaissance: naissance,
    sexe,
    telephone: age >= 16 && alea.proba(0.88) ? etat.fabrique.telephone() : null,
    adresse: alea.proba(0.68) ? adresse(alea, prefixe) : null,
    updatedAt: quand,
  })

  // Contact à prévenir : presque toujours un parent pour un enfant, souvent un proche pour un adulte.
  if (alea.proba(age < 18 ? 0.95 : 0.7)) {
    const lien =
      age < 18
        ? alea.proba(0.5)
          ? 'Père'
          : 'Mère'
        : alea.choisir(LIENS_URGENCE)
    const sexeContact: Sexe =
      lien === 'Père'
        ? 'M'
        : lien === 'Mère'
          ? 'F'
          : lien === 'Conjoint(e)'
            ? sexe === 'M'
              ? 'F'
              : 'M'
            : alea.proba(0.5)
              ? 'M'
              : 'F'
    const memeNom =
      age < 18 || lien === 'Conjoint(e)' ? alea.proba(0.85) : alea.proba(0.5)
    const contact = etat.fabrique.nomComplet(
      sexeContact,
      memeNom ? nom : undefined,
    )
    lignes.ContactUrgence.push({
      id: nouvelIdTest(),
      patientId: id,
      nom: contact.nom,
      prenom: contact.prenom,
      telephone: etat.fabrique.telephone(),
      lien,
      updatedAt: quand,
    })
  }

  if (employe) {
    lignes.DonneesEmploi.push({
      id: nouvelIdTest(),
      patientId: id,
      fonction: alea.choisir(FONCTIONS_EMPLOYES),
      sectionPaie: alea.choisir(SECTIONS_PAIE),
      service: alea.choisir(SERVICES_EMPLOYES),
      departement: alea.choisir(DEPARTEMENTS_EMPLOYES),
      updatedAt: quand,
    })
  } else if (code === 'AYANT_DROIT_CDI') {
    const o = OCCUPATIONS_AYANT_DROIT
    const liste =
      age < 6 ? o.petit : age < 24 ? o.enfant : age >= 60 ? o.ancien : o.adulte
    lignes.DonneesEmploi.push({
      id: nouvelIdTest(),
      patientId: id,
      fonction: alea.choisir(liste),
      updatedAt: quand,
    })
  }

  if (cdi && typeLien) {
    const rattachement = nouvelIdTest()
    lignes.RattachementAyantDroitCdi.push({
      id: rattachement,
      patientId: id,
      cdiId: cdi.id,
      typeLien,
      statut: 'ACTIF',
      dateDebut: quand,
      updatedAt: quand,
    })
    lignes.HistoriqueRattachementAyantDroit.push({
      id: nouvelIdTest(),
      rattachementId: rattachement,
      evenement: 'CREATION',
      createdAt: quand,
      createdBy: d.auteur.utilisateurId,
      updatedAt: quand,
    })
  }
  if (code === 'SOUS_TRAITANT') {
    const rattachement = nouvelIdTest()
    lignes.RattachementSousTraitant.push({
      id: rattachement,
      patientId: id,
      societeId: alea.choisir(ref.societes),
      statut: 'ACTIF',
      dateDebut: quand,
      updatedAt: quand,
    })
    lignes.HistoriqueRattachementSousTraitant.push({
      id: nouvelIdTest(),
      rattachementId: rattachement,
      evenement: 'CREATION',
      createdAt: quand,
      createdBy: d.auteur.utilisateurId,
      updatedAt: quand,
    })
  }

  tracer(ctx, lignes, d.auteur, quand, 'CREATE', 'patient', 'Patient', null)

  const patient: PatientSim = {
    id,
    numeroPatient,
    categorieCode: code,
    categorieId,
    sexe,
    naissance,
    nom,
    prenom,
    siteId: d.siteId,
    matricule,
    nbDependants: 0,
    chroniques: [],
    prochainSuivi: null,
    derniereVisite: null,
    nbVisites: 0,
    allergies: [],
    alertes: [],
    suivisChroniques: [],
    morphologie: nouvelleMorphologie(alea, sexe, 0),
  }
  etat.population.ajouter(patient)
  ctx.nouveaux?.push(patient)
  return patient
}

/** Retire de la liste les profils qui ne concernent pas cette personne (sexe, âge). */
export function profilConvient(
  p: ProfilClinique,
  sexe: Sexe,
  age: number,
): boolean {
  if (p.sexe && p.sexe !== sexe) return false
  if (p.ages && (age < p.ages[0] || age > p.ages[1])) return false
  return true
}

/**
 * Ce que l'infirmier consigne au dossier d'un nouveau patient lors de son premier triage :
 * maladies chroniques déjà connues, allergies, antécédents, mode de vie. `instant` : l'heure du
 * triage ; chaque saisie est tracée.
 */
export function completerDossier(
  ctx: ContexteJour,
  lignes: LignesJour,
  patient: PatientSim,
  instant: Date,
  auteur: Soignant,
  profils: readonly ProfilClinique[],
): void {
  const { alea, ref } = ctx
  const age = ageA(patient.naissance, instant)
  const quand = (decalageS: number) =>
    new Date(instant.getTime() + decalageS * 1000)
  let decalage = 20

  // Maladies chroniques déjà connues : un antécédent médical rattaché à la liste de référence.
  for (const p of profils) {
    if (!p.chronique || !profilConvient(p, patient.sexe, age)) continue
    if (!alea.proba(probaChronique(p.code, age))) continue
    patient.chroniques.push(p.code)
    patient.prochainSuivi = new Date(
      instant.getTime() + alea.entier(0, 20) * UN_JOUR_MS,
    )
    // Une maladie qui se suit s'accompagne souvent d'un surpoids.
    if (p.code === 'HTA' || p.code === 'DIABETE') patient.morphologie.imc += 2.2
    const annee = instant.getUTCFullYear() - alea.entier(1, 9)
    lignes.AntecedentPatient.push({
      id: nouvelIdTest(),
      patientId: patient.id,
      type: 'MEDICAL',
      pathologieId: ref.pathologies.get(p.pathologie) ?? null,
      description: `${LIBELLE_CHRONIQUE[p.code] ?? p.code}, suivie depuis ${annee}.`,
      statut: 'ACTIF',
      updatedAt: quand(decalage),
    })
    tracer(
      ctx,
      lignes,
      auteur,
      quand(decalage),
      'CREATE',
      'patient',
      'Patient',
      patient.id,
    )
    decalage += 25
    if (alea.proba(0.4)) {
      const message = `${LIBELLE_CHRONIQUE[p.code] ?? p.code} suivie — contrôler à chaque visite.`
      patient.alertes.push(message)
      lignes.AlerteMedicale.push({
        id: nouvelIdTest(),
        patientId: patient.id,
        type: 'PATHOLOGIE_CHRONIQUE',
        message,
        gravite: 'IMPORTANT',
        statut: 'ACTIVE',
        createdAt: quand(decalage),
        updatedAt: quand(decalage),
      })
      tracer(
        ctx,
        lignes,
        auteur,
        quand(decalage),
        'CREATE',
        'patient',
        'Patient',
        patient.id,
      )
      decalage += 20
    }
  }

  // Allergies : peu de monde, une fois sur dix deux.
  if (alea.proba(0.07)) {
    const n = alea.proba(0.1) ? 2 : 1
    const prises = new Set<string>()
    for (let i = 0; i < n; i++) {
      const [substance, gravite] = alea.pondere(
        ALLERGIES.map((a) => [a, a[2]] as const),
      )
      if (prises.has(substance)) continue
      prises.add(substance)
      patient.allergies.push(substance)
      lignes.AllergiePatient.push({
        id: nouvelIdTest(),
        patientId: patient.id,
        substance,
        gravite,
        confirme: alea.proba(0.6),
        statut: 'ACTIVE',
        createdAt: quand(decalage),
        updatedAt: quand(decalage),
      })
      tracer(
        ctx,
        lignes,
        auteur,
        quand(decalage),
        'CREATE',
        'patient',
        'Patient',
        patient.id,
      )
      decalage += 20
      if (gravite === 'SEVERE') {
        const message = `Allergie sévère : ${substance} — à éviter absolument.`
        patient.alertes.push(message)
        lignes.AlerteMedicale.push({
          id: nouvelIdTest(),
          patientId: patient.id,
          type: 'ALLERGIE',
          message,
          gravite: 'CRITIQUE',
          statut: 'ACTIVE',
          createdAt: quand(decalage),
          updatedAt: quand(decalage),
        })
        tracer(
          ctx,
          lignes,
          auteur,
          quand(decalage),
          'CREATE',
          'patient',
          'Patient',
          patient.id,
        )
        decalage += 15
      }
    }
  }

  // Antécédents hors maladie chronique.
  if (alea.proba(0.12)) {
    const type = alea.pondere<
      'MEDICAL' | 'CHIRURGICAL' | 'FAMILIAL' | 'GYNECO_OBSTETRICAL'
    >([
      ['MEDICAL', 50],
      ['CHIRURGICAL', 25],
      ['FAMILIAL', 20],
      ['GYNECO_OBSTETRICAL', patient.sexe === 'F' && age >= 18 ? 12 : 0],
    ])
    const liste =
      type === 'MEDICAL'
        ? ANTECEDENTS_MEDICAUX
        : type === 'CHIRURGICAL'
          ? ANTECEDENTS_CHIRURGICAUX
          : type === 'FAMILIAL'
            ? ANTECEDENTS_FAMILIAUX
            : ANTECEDENTS_GYNECO
    lignes.AntecedentPatient.push({
      id: nouvelIdTest(),
      patientId: patient.id,
      type,
      pathologieId: null,
      description: alea.choisir(liste),
      statut: alea.proba(0.85) ? 'ACTIF' : 'RESOLU',
      updatedAt: quand(decalage),
    })
    tracer(
      ctx,
      lignes,
      auteur,
      quand(decalage),
      'CREATE',
      'patient',
      'Patient',
      patient.id,
    )
    decalage += 20
  }

  // Mode de vie : renseigné pour un patient sur cinq environ, jamais pour un jeune enfant.
  if (age >= 12 && alea.proba(0.22)) {
    lignes.ModeViePatient.push({
      id: nouvelIdTest(),
      patientId: patient.id,
      tabac: alea.choisir(MODE_VIE.tabac),
      alcool: alea.choisir(MODE_VIE.alcool),
      drogues: alea.choisir(MODE_VIE.drogues),
      activitePhysique: alea.choisir(MODE_VIE.activitePhysique),
      alimentation: alea.choisir(MODE_VIE.alimentation),
      sommeil: alea.choisir(MODE_VIE.sommeil),
      troublesSommeil: alea.choisir(MODE_VIE.troublesSommeil),
      sedentarite: alea.choisir(MODE_VIE.sedentarite),
      portCharges: alea.choisir(MODE_VIE.portCharges),
      automedication: alea.choisir(MODE_VIE.automedication),
      updatedAt: quand(decalage),
    })
    tracer(
      ctx,
      lignes,
      auteur,
      quand(decalage),
      'UPDATE',
      'patient',
      'Patient',
      patient.id,
    )
  }
}
