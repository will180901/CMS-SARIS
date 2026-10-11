/**
 * Le planificateur d'une journée du centre : qui arrive, qui l'accueille, quel médecin le reçoit,
 * ce qui est consigné, et la trace laissée dans le journal d'audit.
 *
 * Il ne parle pas à la base : il rend, pour une journée, les LIGNES à écrire (cf. registre.ts). C'est
 * ce qui permet de le tester à fond sans base, et de produire exactement les lignes qu'écrirait le
 * parcours réel (accueil → triage → envoi en consultation → consultation → clôture, ou annulation).
 *
 * Le temps est tenu en SECONDES depuis minuit local : un seul infirmier ne triage qu'un patient à la
 * fois, un seul médecin ne tient qu'une consultation à la fois, et l'ordre des gestes (créer la
 * visite, saisir les constantes, envoyer, ouvrir, clôturer) est exact à la seconde.
 */
import { computeImc } from '../../common/clinical'
import type { Alea } from './alea'
import {
  MOTIFS_ANNULATION_CONSULTATION,
  MOTIFS_ANNULATION_VISITE,
  PART_PEDIATRIE,
  PROFILS_CLINIQUES,
  LIBELLE_CHRONIQUE,
  type CasClinique,
  type ProfilClinique,
} from './catalogue-clinique'
import {
  ajouterJours,
  facteurFrequentation,
  horairesDuJour,
  instantSecondes,
  jourLocalDe,
  minutesArrivees,
  saisonDesPluies,
  type Horaires,
} from './calendrier'
import {
  genererConstantes,
  type ConstantesGenerees,
} from './constantes-vitales'
import {
  leMoinsOccupe,
  resumeVide,
  tracer,
  type ContexteJour,
  type EquipeSite,
  type ReferentielsTest,
  type ResumeJour,
  type Soignant,
} from './contexte'
import { nouvelIdTest } from './marque-test'
import { avecJours, planifierDocuments } from './planificateur-documents'
import { ageA, UN_JOUR_MS, type PatientSim } from './population'
import {
  choisirCategorie,
  completerDossier,
  creerPatient,
  profilConvient,
} from './planificateur-patient'
import { lignesVides, type LignesJour } from './registre'

/** Un patient sur ~30 repart avant d'avoir été reçu par le médecin. */
const P_ANNULATION_TRIAGE = 0.035
const P_CONSULTATION_ANNULEE = 0.022
const P_AFFECTATION_TARDIVE = 0.45
const P_NOTES_MODIFIEES = 0.04
/** La dernière consultation s'ouvre au plus tard une heure après la fermeture du centre. */
const RETARD_MAX_S = 3600

const sec = (minutes: number) => minutes * 60

interface Creneau {
  s: Soignant
  /** Instant (secondes locales) où cette personne se libère. */
  libreA: number
}

interface Tentative {
  medecin: Creneau
  tEnvoi: number
  tOuv: number
  fin: number
  annulee: boolean
  motif: string | null
}

// ── Profils ──────────────────────────────────────────────────────────────────

const cacheProfils = new WeakMap<ReferentielsTest, readonly ProfilClinique[]>()

/**
 * Les profils cliniques utilisables avec les référentiels de CE centre : celui dont le diagnostic ou
 * les motifs n'existent pas dans ses listes est écarté. Si plus rien ne correspond (référentiels
 * entièrement personnalisés), on retombe sur un profil neutre par diagnostic de la liste.
 */
export function profilsDisponibles(
  ref: ReferentielsTest,
): readonly ProfilClinique[] {
  const connu = cacheProfils.get(ref)
  if (connu) return connu
  let dispo: ProfilClinique[] = PROFILS_CLINIQUES.filter(
    (p) =>
      ref.pathologies.has(p.pathologie) &&
      p.motifs.some(([c]) => ref.motifs.has(c)),
  )
  if (dispo.length === 0) {
    const motifs = [...ref.motifs.keys()].map((c) => [c, 1] as const)
    dispo = [...ref.pathologies.keys()].map(
      (code): ProfilClinique => ({
        code: `GENERIQUE_${code}`,
        poids: 1,
        pathologie: code,
        motifs: motifs,
        constantes: {},
        dureeConsultation: [10, 18],
        jours: [1, 7],
        cas: [
          {
            notes: 'Consulte pour une plainte depuis {j} jours.',
            symptomes: 'Plaintes évoluant depuis {j} jours.',
            examen: 'Examen clinique sans particularité notable.',
            conclusion:
              'Prise en charge adaptée ; revoir en cas de persistance des signes.',
          },
        ],
      }),
    )
  }
  cacheProfils.set(ref, dispo)
  return dispo
}

function choisirProfil(
  ctx: ContexteJour,
  patient: PatientSim,
  age: number,
  maintenant: Date,
  profils: readonly ProfilClinique[],
): ProfilClinique {
  const { alea } = ctx
  const connus = patient.chroniques
    .map((c) => profils.find((p) => p.code === c))
    .filter((p): p is ProfilClinique => !!p)
  if (connus.length > 0) {
    const echu =
      patient.prochainSuivi != null && patient.prochainSuivi <= maintenant
    if (alea.proba(echu ? 0.9 : 0.3)) return alea.choisir(connus)
  }
  const pluies = saisonDesPluies(jourLocalDe(maintenant))
  const liste = profils
    .filter((p) => profilConvient(p, patient.sexe, age))
    .map((p) => {
      let poids = p.poids * (pluies && p.pluies ? p.pluies : 1)
      // Une maladie chronique n'est qu'exceptionnellement découverte ce jour-là.
      if (p.chronique) poids *= patient.chroniques.includes(p.code) ? 0.05 : 0.1
      return [p, poids] as const
    })
    .filter(([, poids]) => poids > 0)
  return liste.length > 0 ? alea.pondere(liste) : profils[0]
}

function choisirMotif(
  ctx: ContexteJour,
  profil: ProfilClinique,
  age: number,
): string {
  const { alea, ref } = ctx
  if (
    age < 15 &&
    profil.code !== 'GROSSESSE' &&
    ref.motifs.has('PEDIATRIE') &&
    alea.proba(PART_PEDIATRIE)
  )
    return 'PEDIATRIE'
  return alea.pondere(profil.motifs.filter(([c]) => ref.motifs.has(c)))
}

const TRAVAILLEURS = new Set(['ASSURE_CDI', 'ASSURE_CDD', 'SOUS_TRAITANT'])

/** Le type de consultation (obligatoire pour clôturer). Les types réservés aux employés le restent. */
function choisirType(
  ctx: ContexteJour,
  patient: PatientSim,
  profil: ProfilClinique,
): string | null {
  const { alea, ref } = ctx
  const t = ref.typesConsultation
  const employe =
    patient.categorieCode === 'ASSURE_CDI' ||
    patient.categorieCode === 'ASSURE_CDD'
  if (
    profil.travail &&
    TRAVAILLEURS.has(patient.categorieCode) &&
    t.has('ACCIDENT_TRAVAIL') &&
    alea.proba(0.7)
  )
    return t.get('ACCIDENT_TRAVAIL') as string
  if (employe && t.has('BILAN_OBLIGATOIRE') && alea.proba(0.04))
    return t.get('BILAN_OBLIGATOIRE') as string
  if (
    patient.categorieCode === 'ASSURE_CDD' &&
    t.has('VISITE_PRE_EMBAUCHE') &&
    alea.proba(0.03)
  )
    return t.get('VISITE_PRE_EMBAUCHE') as string
  if (
    (profil.code === 'HTA' || profil.code === 'CARDIOPATHIE') &&
    t.has('CARDIOLOGIE') &&
    alea.proba(0.05)
  )
    return t.get('CARDIOLOGIE') as string
  return t.get('MEDECINE_GENERALE') ?? [...t.values()][0] ?? null
}

/** Un cas complet du profil ; pour une maladie suivie, un cas qui correspond au contrôle constaté. */
function choisirCas(
  alea: Alea,
  profil: ProfilClinique,
  cst: ConstantesGenerees | null,
): CasClinique {
  const niveau = profil.niveau
    ? profil.niveau({
        tensionSystolique: cst?.tensionSystolique ?? null,
        tensionDiastolique: cst?.tensionDiastolique ?? null,
        glycemie: cst?.glycemie ?? null,
      })
    : null
  const conformes = niveau
    ? profil.cas.filter((c) => c.niveau === niveau)
    : profil.cas
  return alea.choisir(conformes.length > 0 ? conformes : profil.cas)
}

function dureeAnamnese(j: number): string {
  if (j <= 0) return 'Aujourd’hui'
  if (j === 1) return '1 jour'
  if (j < 7) return `${j} jours`
  if (j < 30)
    return `${Math.round(j / 7)} semaine${Math.round(j / 7) > 1 ? 's' : ''}`
  return `${Math.round(j / 30)} mois`
}

/** Jour de reprise du travail : minuit (UTC, comme le serveur) du jour de reprise. */
function dateReprise(
  jourConsultation: string,
  reposJours: number,
  inclutLeJour: boolean,
): Date {
  const n = inclutLeJour ? reposJours : reposJours + 1
  const [a, m, j] = ajouterJours(jourConsultation, n).split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, j))
}

// ── Une journée ──────────────────────────────────────────────────────────────

/** Les lignes d'une journée d'ouverture, et ce qui s'y est passé. */
export function planifierJour(ctx: ContexteJour): {
  lignes: LignesJour
  resume: ResumeJour
} {
  const lignes = lignesVides()
  const resume = resumeVide()
  const h = horairesDuJour(ctx.jour)
  if (!h || ctx.equipes.length === 0) return { lignes, resume }

  // Les dossiers ouverts ce jour-là sont suivis ici pour être numérotés dans l'ordre exact des ouvertures.
  ctx = { ...ctx, nouveaux: [] }
  const facteur = facteurFrequentation(ctx.jour)
  const poidsTotal = ctx.equipes.reduce(
    (s, e) => s + Math.max(1, e.medecins.length),
    0,
  )
  const vus = new Set<string>()
  for (const equipe of ctx.equipes) {
    const part = Math.max(1, equipe.medecins.length) / poidsTotal
    const cible = Math.max(
      0,
      Math.round(
        ctx.params.visitesParJour *
          part *
          facteur *
          ctx.alea.normaleBornee(1, 0.12, 0.7, 1.3),
      ),
    )
    planifierSite(ctx, equipe, h, cible, lignes, resume, vus)
  }
  numeroterDossiers(ctx, lignes)
  return { lignes, resume }
}

/**
 * Numéros de dossier de la journée, à la suite de ceux du site, dans l'ordre CHRONOLOGIQUE des
 * ouvertures : les ordres de traitement et les heures ne coïncident pas toujours (deux infirmiers
 * en parallèle), le numéro, lui, doit suivre l'heure.
 */
function numeroterDossiers(ctx: ContexteJour, lignes: LignesJour): void {
  const prefixeDuSite = new Map(
    ctx.equipes.map(
      (e) => [e.siteId, e.siteCode.slice(0, 3).toUpperCase()] as const,
    ),
  )
  const simDe = new Map((ctx.nouveaux ?? []).map((p) => [p.id, p] as const))
  const ordre = [...lignes.Patient].sort(
    (x, y) =>
      +(x.createdAt as Date) - +(y.createdAt as Date) ||
      String(x.id).localeCompare(String(y.id)),
  )
  for (const row of ordre) {
    const prefixe = prefixeDuSite.get(row.siteCreationId) ?? 'PAT'
    const numero = ctx.etat.numerotation.prochain(prefixe)
    row.numeroPatient = numero
    const sim = simDe.get(row.id as string)
    if (sim) sim.numeroPatient = numero
  }
}

function planifierSite(
  ctx: ContexteJour,
  equipe: EquipeSite,
  h: Horaires,
  cible: number,
  lignes: LignesJour,
  resume: ResumeJour,
  vus: Set<string>,
): void {
  const { alea, ref } = ctx
  // Un site sans médecin (ou sans infirmier) emprunte ceux des autres : le dossier est commun.
  const infirmiers = equipe.infirmiers.length
    ? equipe.infirmiers
    : ctx.equipes.flatMap((e) => e.infirmiers)
  const medecins = equipe.medecins.length
    ? equipe.medecins
    : ctx.equipes.flatMap((e) => e.medecins)
  if (infirmiers.length === 0 || medecins.length === 0) return

  const inf: Creneau[] = infirmiers.map((s) => ({
    s,
    libreA: sec(h.ouverture) + alea.entier(0, 300),
  }))
  const med: Creneau[] = medecins.map((s) => ({
    s,
    libreA: sec(h.ouverture) + alea.entier(0, 900),
  }))
  const profils = profilsDisponibles(ref)
  if (profils.length === 0) return

  for (const arrivee of minutesArrivees(alea, cible, h)) {
    passage(
      ctx,
      equipe,
      h,
      arrivee * 60 + alea.entier(0, 59),
      inf,
      med,
      profils,
      lignes,
      resume,
      vus,
    )
  }
}

function passage(
  ctx: ContexteJour,
  equipe: EquipeSite,
  h: Horaires,
  arriveeS: number,
  inf: Creneau[],
  med: Creneau[],
  profils: readonly ProfilClinique[],
  lignes: LignesJour,
  resume: ResumeJour,
  vus: Set<string>,
): void {
  const { alea, etat, ref, jour, params } = ctx
  const at = (s: number) => instantSecondes(jour, s)
  const S = (a: number, b: number) => alea.entier(a, b)

  // ── 1. L'accueil : un infirmier libre prend la personne ───────────────────────
  const infirmier = leMoinsOccupe(inf, (c) => c.libreA)
  const dTri = Math.max(arriveeS, infirmier.libreA)
  if (dTri > sec(h.fermeture - 10)) {
    resume.nonRecus++
    return
  }
  const accueil = infirmier.s

  // ── 2. Qui : un habitué qui revient, ou un nouveau dossier ──────────────────────
  const pNouveau = Math.max(
    0.12,
    0.62 - 0.42 * (params.indexJour / Math.max(1, params.totalJours)),
  )
  let patient: PatientSim | null = null
  if (etat.population.taille > 0 && !alea.proba(pNouveau))
    patient = etat.population.tirerExistant(alea, at(dTri), vus)
  let tVisite: number
  if (!patient) {
    const tPatient = dTri + S(20, 90)
    patient = creerPatient(ctx, lignes, {
      categorieCode: choisirCategorie(ctx),
      siteId: equipe.siteId,
      siteCode: equipe.siteCode,
      instant: at(tPatient),
      auteur: accueil,
    })
    resume.nouveauxPatients++
    tVisite = tPatient + S(180, 420)
  } else {
    tVisite = dTri + S(60, 180)
  }
  vus.add(patient.id)
  if (patient.nbVisites === 0)
    completerDossier(
      ctx,
      lignes,
      patient,
      at(tVisite - S(30, 120)),
      accueil,
      profils,
    )

  // ── 3. Pourquoi : le profil clinique, le motif d'accueil ──────────────────────
  const age = ageA(patient.naissance, at(dTri))
  const profil = choisirProfil(ctx, patient, age, at(dTri), profils)
  const motifCode = choisirMotif(ctx, profil, age)
  const motif = ref.motifs.get(motifCode) as {
    id: string
    triageAllege: boolean
  }
  const j = S(profil.jours[0], profil.jours[1])
  const remplacer = (t: string) => avecJours(t, Math.max(1, j))

  // ── 4. Le triage : constantes vitales, puis le patient est prêt ───────────────
  const cst = motif.triageAllege
    ? null
    : genererConstantes({
        alea,
        age,
        morphologie: patient.morphologie,
        profil: profil.constantes,
      })
  // Le récit de la visite : un cas complet, cohérent avec ce que les constantes ont montré.
  const cas = choisirCas(alea, profil, cst)
  const notesAccueil = alea.proba(0.93) ? remplacer(cas.notes) : null
  const constantesAvecLaVisite = alea.proba(0.7)
  const tConst = tVisite + (constantesAvecLaVisite ? 0 : S(120, 420))
  const tPret = (cst ? tConst : tVisite) + (cst ? S(90, 300) : S(60, 180))
  infirmier.libreA = tPret + S(0, 120)

  // ── 5. L'issue : consultation, départ, annulation ────────────────────────────
  const limite = sec(h.fermeture) + RETARD_MAX_S
  const tentatives: Tentative[] = []
  let annulee = false
  let tAnnulation = 0
  let motifAnnulation = ''

  if (alea.proba(P_ANNULATION_TRIAGE)) {
    annulee = true
    tAnnulation = tPret + S(120, 1500)
    motifAnnulation = alea.choisir(MOTIFS_ANNULATION_VISITE)
  } else {
    let pret = tPret
    for (let essai = 0; essai < 2; essai++) {
      const m = leMoinsOccupe(med, (c) => c.libreA)
      const tEnvoi = Math.max(
        pret + (essai === 0 ? S(20, 100) : S(120, 600)),
        m.libreA,
      )
      const tOuv = tEnvoi + S(25, 150)
      if (tOuv > limite) {
        // Le médecin n'est pas libre avant la fermeture : le patient est parti sans attendre.
        annulee = true
        tAnnulation = Math.max(
          pret + S(60, 300),
          Math.min(pret + S(1500, 4200), sec(h.fermeture) + S(0, 1500)),
        )
        motifAnnulation = 'Patient parti sans attendre la consultation.'
        break
      }
      if (essai === 0 && alea.proba(P_CONSULTATION_ANNULEE)) {
        const fin = tOuv + S(60, 420)
        m.libreA = fin + S(30, 120)
        tentatives.push({
          medecin: m,
          tEnvoi,
          tOuv,
          fin,
          annulee: true,
          motif: alea.choisir(MOTIFS_ANNULATION_CONSULTATION),
        })
        pret = fin
        continue
      }
      const minutes = alea.normaleBornee(
        (profil.dureeConsultation[0] + profil.dureeConsultation[1]) / 2,
        (profil.dureeConsultation[1] - profil.dureeConsultation[0]) / 4,
        profil.dureeConsultation[0],
        profil.dureeConsultation[1],
      )
      // Un premier passage demande un peu plus de temps (dossier à découvrir).
      const fin =
        tOuv + Math.round((minutes + (patient.nbVisites === 0 ? 3 : 0)) * 60)
      m.libreA = fin + S(60, 180)
      tentatives.push({
        medecin: m,
        tEnvoi,
        tOuv,
        fin,
        annulee: false,
        motif: null,
      })
      break
    }
  }
  const reussie = tentatives.find((t) => !t.annulee)
  const consultee = !annulee && !!reussie

  // ── 6. La visite ──────────────────────────────────────────────────────────────
  const visiteId = nouvelIdTest()
  const premierMedecin = tentatives[0]?.medecin.s
  const dernierMedecin = reussie?.medecin.s
  // Une visite annulée garde parfois le médecin qu'on lui avait assigné.
  const medecinAssigne = consultee
    ? (dernierMedecin as Soignant)
    : (premierMedecin ?? (alea.proba(0.3) ? alea.choisir(med).s : undefined))
  const tFin = consultee ? reussie.fin : tAnnulation

  lignes.Visite.push({
    id: visiteId,
    patientId: patient.id,
    siteId: equipe.siteId,
    motifPrincipalId: motif.id,
    statut: consultee ? 'CLOTUREE' : 'ANNULEE',
    soignantId: medecinAssigne?.personnelId ?? null,
    notesAccueil,
    motifAnnulation: consultee ? null : motifAnnulation,
    typeCloture: consultee ? 'AVEC_CONSULTATION' : null,
    dateOuverture: at(tVisite),
    dateCloture: at(tFin),
    creerHorsLigne: false,
    version: 1,
    createdAt: at(tVisite),
    updatedAt: at(tFin),
  })
  tracer(ctx, lignes, accueil, at(tVisite), 'CREATE', 'visite', 'Visite', null)

  const evenement = (
    t: number,
    type: 'STATUT_CHANGE' | 'SOIGNANT_CHANGE' | 'NOTES_UPDATE',
    ancienne: string | null,
    nouvelle: string | null,
    commentaire: string | null = null,
  ) => {
    lignes.VisiteEvenement.push({
      id: nouvelIdTest(),
      visiteId,
      type,
      ancienneVal: ancienne,
      nouvelleVal: nouvelle,
      acteurId: accueil.utilisateurId,
      commentaire,
      createdAt: at(t),
      updatedAt: at(t),
    })
    tracer(ctx, lignes, accueil, at(t), 'UPDATE', 'visite', 'Visite', visiteId)
  }

  if (cst) {
    lignes.ConstanteVitale.push({
      id: nouvelIdTest(),
      visiteId,
      patientId: patient.id,
      ...cst,
      imc: computeImc(cst.poids, cst.taille),
      saisiePar: accueil.utilisateurId,
      createdAt: at(tConst),
      updatedAt: at(tConst),
    })
    if (!constantesAvecLaVisite)
      tracer(
        ctx,
        lignes,
        accueil,
        at(tConst),
        'CREATE',
        'visite',
        'Visite',
        visiteId,
      )
  }
  if (notesAccueil && alea.proba(P_NOTES_MODIFIEES))
    evenement(tVisite + S(60, 240), 'NOTES_UPDATE', '(modifiées)', '(saisies)')

  // Le médecin est désigné à la création de la visite ou, plus tard, par l'infirmier.
  if (premierMedecin && alea.proba(P_AFFECTATION_TARDIVE))
    evenement(
      Math.max(tVisite + 1, tPret - S(5, 60)),
      'SOIGNANT_CHANGE',
      null,
      premierMedecin.personnelId,
    )
  for (const [k, t] of tentatives.entries()) {
    const precedent = tentatives[k - 1]
    if (
      precedent &&
      precedent.medecin.s.personnelId !== t.medecin.s.personnelId
    )
      evenement(
        t.tEnvoi - S(5, 40),
        'SOIGNANT_CHANGE',
        precedent.medecin.s.personnelId,
        t.medecin.s.personnelId,
      )
    evenement(t.tEnvoi, 'STATUT_CHANGE', 'EN_ATTENTE', 'EN_COURS')
  }
  if (annulee) {
    evenement(
      tAnnulation,
      'STATUT_CHANGE',
      'EN_ATTENTE',
      'ANNULEE',
      motifAnnulation,
    )
    resume.visitesAnnulees++
  }

  // ── 7. Les consultations ──────────────────────────────────────────────────────
  for (const t of tentatives) {
    const medecin = t.medecin.s
    const consultationId = nouvelIdTest()
    tracer(
      ctx,
      lignes,
      medecin,
      at(t.tOuv),
      'CREATE',
      'consultation',
      'Consultation',
      null,
    )

    if (t.annulee) {
      lignes.Consultation.push({
        id: consultationId,
        visiteId,
        soignantId: medecin.personnelId,
        statut: 'ANNULEE',
        motifAnnulation: t.motif,
        version: 1,
        createdAt: at(t.tOuv),
        closedAt: at(t.fin),
        updatedAt: at(t.fin),
      })
      tracer(
        ctx,
        lignes,
        medecin,
        at(t.fin),
        'UPDATE',
        'consultation',
        'Consultation',
        consultationId,
      )
      resume.consultationsAnnulees++
      continue
    }

    const diagnostics = choisirDiagnostics(
      ctx,
      profil,
      patient.chroniques.includes(profil.code),
    )
    // Pas de début de symptômes pour un suivi de grossesse ; « aujourd'hui » pour un accident du jour.
    const debutAnamnese = profil.jours[1] > 0
    const repos =
      profil.repos && alea.proba(profil.repos.proba)
        ? S(profil.repos.jours[0], profil.repos.jours[1])
        : null
    const reposInclutJour = repos != null ? alea.proba(0.6) : false
    const priseEnCharge = alea.proba(0.7)
    const tPrise = t.tOuv + S(3, 25)
    // Les gestes du médecin, répartis entre l'ouverture et la clôture.
    const gestes: (
      | 'examen'
      | 'type'
      | 'diagnostic'
      | 'repos'
      | 'antecedent'
    )[] = [
      'examen',
      ...(alea.proba(0.4) ? (['examen'] as const) : []),
      'type',
      ...diagnostics.map(() => 'diagnostic' as const),
      ...(repos != null ? (['repos'] as const) : []),
    ]
    const nouvelleChronique =
      !!profil.chronique && !patient.chroniques.includes(profil.code)
    if (nouvelleChronique) gestes.push('antecedent')
    const debutGestes = t.tOuv + 20
    const finGestes = t.fin - 10
    const horaires = gestes.map(
      (_, i) =>
        Math.round(
          debutGestes +
            ((finGestes - debutGestes) * (i + 1)) / (gestes.length + 1),
        ) + S(-4, 4),
    )
    let iDiagnostic = 0
    gestes.forEach((geste, i) => {
      const quand = at(horaires[i])
      if (geste === 'diagnostic') {
        const d = diagnostics[iDiagnostic++] as {
          pathologieId: string
          type: string
          certitude: string
        }
        lignes.DiagnosticConsultation.push({
          id: nouvelIdTest(),
          consultationId,
          pathologieId: d.pathologieId,
          type: d.type,
          certitude: d.certitude,
          updatedAt: quand,
        })
        tracer(
          ctx,
          lignes,
          medecin,
          quand,
          'CREATE',
          'consultation',
          'Consultation',
          consultationId,
        )
      } else if (geste === 'antecedent') {
        lignes.AntecedentPatient.push({
          id: nouvelIdTest(),
          patientId: patient.id,
          type: 'MEDICAL',
          pathologieId: ref.pathologies.get(profil.pathologie) ?? null,
          description: `${LIBELLE_CHRONIQUE[profil.code] ?? profil.code}, découverte lors de cette consultation.`,
          statut: 'ACTIF',
          updatedAt: quand,
        })
        tracer(
          ctx,
          lignes,
          medecin,
          quand,
          'CREATE',
          'patient',
          'Patient',
          patient.id,
        )
      } else {
        tracer(
          ctx,
          lignes,
          medecin,
          quand,
          'UPDATE',
          'consultation',
          'Consultation',
          consultationId,
        )
      }
    })
    if (priseEnCharge)
      tracer(
        ctx,
        lignes,
        medecin,
        at(tPrise),
        'CREATE',
        'consultation',
        'Consultation',
        consultationId,
      )

    // Ordonnances, bons, résultats, évacuation ou suivi, suivi chronique : tout ce que le médecin
    // prescrit et décide avant de clôturer.
    const { decision } = planifierDocuments({
      ctx,
      lignes,
      equipe,
      patient,
      profil,
      age,
      cas,
      cst,
      jours: j,
      certitude: diagnostics[0]?.certitude ?? 'CONFIRME',
      consultationId,
      medecin,
      tOuv: t.tOuv,
      tFin: t.fin,
      nouvelleChronique,
    })

    lignes.Consultation.push({
      id: consultationId,
      visiteId,
      soignantId: medecin.personnelId,
      statut: 'CLOTUREE',
      anamneseDateDebut: debutAnamnese
        ? new Date(at(t.tOuv).getTime() - j * UN_JOUR_MS)
        : null,
      anamneseDuree: debutAnamnese ? dureeAnamnese(j) : null,
      anamneseModeDebut: debutAnamnese ? (cas.modeDebut ?? 'Progressif') : null,
      anamneseSymptomes: remplacer(cas.symptomes),
      examenClinique: cas.examen,
      conclusion: cas.conclusion,
      decisionMedicale: decision,
      typeConsultationId: choisirType(ctx, patient, profil),
      reposJours: repos,
      reposInclutJour,
      dateReprise:
        repos != null
          ? dateReprise(jourLocalDe(at(t.tOuv)), repos, reposInclutJour)
          : null,
      version: 1,
      createdAt: at(t.tOuv),
      closedAt: at(t.fin),
      pickedUpById: priseEnCharge ? medecin.utilisateurId : null,
      pickedUpAt: priseEnCharge ? at(tPrise) : null,
      updatedAt: at(t.fin),
    })
    tracer(
      ctx,
      lignes,
      medecin,
      at(t.fin),
      'UPDATE',
      'consultation',
      'Consultation',
      consultationId,
    )
    resume.consultations++
    if (nouvelleChronique) patient.chroniques.push(profil.code)
  }

  // ── 8. Ce que la population retient de ce passage ───────────────────────────────
  resume.visites++
  patient.nbVisites++
  patient.derniereVisite = at(tVisite)
  if (consultee && profil.chronique && patient.chroniques.includes(profil.code))
    patient.prochainSuivi = new Date(
      at(tVisite).getTime() + S(24, 36) * UN_JOUR_MS,
    )
}

/** Le diagnostic principal du profil, et ses diagnostics associés éventuels. */
function choisirDiagnostics(
  ctx: ContexteJour,
  profil: ProfilClinique,
  dejaConnue: boolean,
): { pathologieId: string; type: string; certitude: string }[] {
  const { alea, ref } = ctx
  const principal = ref.pathologies.get(profil.pathologie) as string
  const resultat = [
    {
      pathologieId: principal,
      type: 'PRINCIPAL',
      // Une maladie déjà suivie est confirmée ; découverte ce jour-là, elle peut n'être que probable.
      certitude: profil.chronique
        ? dejaConnue
          ? ('CONFIRME' as const)
          : alea.pondere([
              ['CONFIRME', 70],
              ['PROBABLE', 30],
            ] as const)
        : profil.diagnosticCertain
          ? alea.pondere([
              ['CONFIRME', 97],
              ['PROBABLE', 3],
            ] as const)
          : alea.pondere([
              ['CONFIRME', 74],
              ['PROBABLE', 20],
              ['SUSPECTE', 6],
            ] as const),
    },
  ]
  for (const [code, proba] of profil.associes ?? []) {
    const id = ref.pathologies.get(code)
    if (!id || id === principal || !alea.proba(proba)) continue
    resultat.push({
      pathologieId: id,
      type: 'ASSOCIE',
      certitude: alea.pondere([
        ['CONFIRME', 60],
        ['PROBABLE', 30],
        ['SUSPECTE', 10],
      ] as const),
    })
  }
  return resultat
}
