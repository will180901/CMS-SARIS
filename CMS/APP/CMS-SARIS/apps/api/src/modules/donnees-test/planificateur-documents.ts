/**
 * Ce qui se passe AUTOUR d'une consultation clôturée : l'ordonnance de médicaments et celle des
 * examens, leurs bons (examen, pharmacie), la remise des médicaments, les résultats qui reviennent,
 * la décision du médecin (évacuation ou suivi de traitement) et ce qui s'ensuit, le suivi chronique
 * d'une maladie qui se soigne dans la durée.
 *
 * Il ne parle pas à la base, comme le reste du planificateur : il ajoute des LIGNES à la journée en
 * cours, et reproduit ce que fait le parcours réel — dans le même ordre, par les mêmes personnes
 * (le médecin prescrit et décide, l'infirmier saisit les résultats et les fiches de suivi), avec les
 * mêmes droits (un bon d'examen ou de pharmacie n'existe que pour un patient dont la catégorie le
 * couvre) et les mêmes règles (une allergie interdit le médicament, une évacuation et un suivi de
 * traitement ne se cumulent pas, une consultation clôturée a son document de décision).
 *
 * Certaines suites tombent les jours suivants (un résultat qui revient demain, une fiche de suivi la
 * semaine prochaine) : elles sont écrites avec la journée de la consultation, datées dans le futur de
 * celle-ci, et seulement jusqu'à la fin de la période — on ne fabrique pas d'avenir. Ce qui n'est pas
 * encore arrivé reste « en attente », comme dans un centre réel.
 */
import type { Alea } from './alea'
import {
  ajouterJours,
  apresDelaiOuvre,
  auDela,
  estOuvert,
  horairesDuJour,
  instantSecondes,
  jourOuvertSuivant,
  joursEntre,
  type Moment,
} from './calendrier'
import type { CasClinique, ProfilClinique } from './catalogue-clinique'
import {
  ALLERGIES_CROISEES,
  DOSES_ADMINISTRATION,
  LABORATOIRES,
  MOTIFS_ANNULATION_BON_PHARMACIE,
  MOTIFS_ANNULATION_EVACUATION,
  MOTIFS_ANNULATION_SUIVI,
  MOTIFS_ARRET_TRAITEMENT,
  MOTIFS_CLOTURE_SUIVI,
  MOTIFS_CORRECTION_RESULTAT,
  NOTES_FICHE,
  NOTES_SUIVI_EVACUATION,
  PRESCRIPTIONS,
  PRESCRIPTION_NEUTRE,
  type LigneTraitement,
  type PrescriptionProfil,
  type SchemaTraitement,
} from './catalogue-prescriptions'
import {
  genererConstantes,
  type ConstantesGenerees,
} from './constantes-vitales'
import {
  tracer,
  type ContexteJour,
  type EquipeSite,
  type MedicamentTest,
  type Soignant,
} from './contexte'
import { cleNom } from './fabrique-identites'
import { nouvelIdTest } from './marque-test'
import type { PatientSim } from './population'
import type { LignesJour } from './registre'

export type DecisionMedicale = 'EVACUATION' | 'SUIVI_TRAITEMENT'

export interface EntreeDocuments {
  ctx: ContexteJour
  lignes: LignesJour
  equipe: EquipeSite
  patient: PatientSim
  profil: ProfilClinique
  age: number
  cas: CasClinique
  /** Constantes prises à l'accueil (absentes pour un triage allégé). */
  cst: ConstantesGenerees | null
  /** Jours d'évolution racontés par le patient. */
  jours: number
  /** Certitude du diagnostic principal posé : un diagnostic confirmé s'appuie sur des examens qui le confirment. */
  certitude: string
  consultationId: string
  medecin: Soignant
  /** Ouverture et clôture de la consultation, en secondes locales du jour. */
  tOuv: number
  tFin: number
  /** La maladie suivie est découverte à cette consultation. */
  nouvelleChronique: boolean
}

export interface SortieDocuments {
  decision: DecisionMedicale | null
}

type Ligne<T extends keyof LignesJour> = LignesJour[T][number]

/** Remplace « {j} jours » par la durée bien accordée : « 1 jour », « 5 jours ». */
export function avecJours(texte: string, jours: number): string {
  return texte
    .replace('{j} jours', jours === 1 ? '1 jour' : `${jours} jours`)
    .replace('{j}', String(jours))
}

/** Le nom d'un médicament « ramené à ses lettres » : sans accents, sans casse, sans ponctuation. */
export function cleMedicament(nom: string): string {
  return cleNom(nom, '')
}

/** La prescription type d'un profil clinique (un profil neutre pour les diagnostics propres au centre). */
export function prescriptionDe(
  profil: ProfilClinique,
): PrescriptionProfil | null {
  return (
    PRESCRIPTIONS[profil.code] ??
    (profil.code.startsWith('GENERIQUE_') ? PRESCRIPTION_NEUTRE : null)
  )
}

// ── Les moments ──────────────────────────────────────────────────────────────

const avant = (a: Moment, b: Moment) =>
  a.jour < b.jour || (a.jour === b.jour && a.s < b.s)

/**
 * `n` instants croissants répartis entre `debut` et `fin` (secondes), avec un léger écart : les
 * gestes du médecin se succèdent, ils ne tombent pas à la même seconde.
 */
function repartir(alea: Alea, debut: number, fin: number, n: number): number[] {
  const pas = (fin - debut) / (n + 1)
  const instants: number[] = []
  for (let i = 1; i <= n; i++) {
    let t = Math.round(debut + pas * i + alea.entier(-2, 2))
    if (i > 1 && t <= instants[i - 2]) t = instants[i - 2] + 1
    instants.push(t)
  }
  return instants
}

/** Un jour à `pas` jours du suivant, le premier jour d'ouverture à partir de là. */
function jourOuvertApres(jour: string, pas: number): string {
  const j = ajouterJours(jour, Math.max(1, pas))
  return estOuvert(j) ? j : jourOuvertSuivant(j)
}

/** « 7 jours » → 7 ; une durée sans nombre de jours (« en continu ») compte pour une semaine. */
function joursPrescrits(duree: string | null | undefined): number {
  const m = /(\d+)\s*jour/i.exec(duree ?? '')
  return m ? Number(m[1]) : 7
}

// ── Les personnes ────────────────────────────────────────────────────────────

/** Les soignants du site (un site sans médecin ou sans infirmier emprunte ceux des autres). */
function personnelDuSite(
  ctx: ContexteJour,
  equipe: EquipeSite,
): { medecins: Soignant[]; infirmiers: Soignant[] } {
  return {
    medecins: equipe.medecins.length
      ? equipe.medecins
      : ctx.equipes.flatMap((x) => x.medecins),
    infirmiers: equipe.infirmiers.length
      ? equipe.infirmiers
      : ctx.equipes.flatMap((x) => x.infirmiers),
  }
}

// ── Les médicaments ──────────────────────────────────────────────────────────

/** Ce médicament est-il à éviter pour cette personne (allergie, même famille, contre-indication) ? */
export function medicamentIncompatible(
  patient: Pick<PatientSim, 'allergies' | 'alertes'>,
  med: MedicamentTest,
): boolean {
  const gen = med.nomGenerique.toLowerCase()
  const com = (med.nomCommercial ?? '').toLowerCase()
  const fam = (med.famille ?? '').toLowerCase()
  const cle = cleMedicament(med.nomGenerique)
  for (const allergie of patient.allergies) {
    const sub = allergie.toLowerCase().trim()
    if (
      (sub.length >= 4 &&
        (gen.includes(sub) || com.includes(sub) || fam.includes(sub))) ||
      (gen.length >= 4 && sub.includes(gen))
    )
      return true
    if (ALLERGIES_CROISEES[cleNom(allergie, '')]?.includes(cle)) return true
  }
  for (const ci of med.contreIndications) {
    const cond = ci.toLowerCase().trim()
    if (cond.length < 4) continue
    const touche = patient.alertes.some((a) => {
      const msg = a.toLowerCase()
      return msg.includes(cond) || (msg.length >= 4 && cond.includes(msg))
    })
    if (touche) return true
  }
  return false
}

interface LigneChoisie {
  medicament: MedicamentTest
  spec: LigneTraitement
}

/**
 * Le traitement du médecin : un schéma du profil adapté à l'âge et au contrôle constaté, dont le
 * médicament principal existe chez le centre et convient à la personne. Aucun schéma possible : pas
 * d'ordonnance de médicaments.
 */
function choisirTraitement(
  e: EntreeDocuments,
  prescription: PrescriptionProfil,
): LigneChoisie[] {
  const { alea, ref } = e.ctx
  const m = prescription.medicaments
  if (!m || !alea.proba(m.proba)) return []
  const disponible = (l: LigneTraitement): MedicamentTest | null => {
    const med = ref.medicaments.get(cleMedicament(l.medicament))
    return med && !medicamentIncompatible(e.patient, med) ? med : null
  }
  const convenables = m.schemas.filter(
    (s) =>
      (!s.ages || (e.age >= s.ages[0] && e.age <= s.ages[1])) &&
      disponible(s.lignes[0]) !== null,
  )
  const exacts = convenables.filter(
    (s) => s.niveau !== undefined && s.niveau === e.cas.niveau,
  )
  const generaux = convenables.filter((s) => s.niveau === undefined)
  const candidats: SchemaTraitement[] = exacts.length > 0 ? exacts : generaux
  if (candidats.length === 0) return []
  const schema = alea.pondere(candidats.map((s) => [s, s.poids] as const))
  const retenues: LigneChoisie[] = []
  const deja = new Set<string>()
  schema.lignes.forEach((spec, i) => {
    if (i > 0 && !alea.proba(spec.proba ?? 1)) return
    const medicament = disponible(spec)
    if (!medicament || deja.has(medicament.id)) return
    deja.add(medicament.id)
    retenues.push({ medicament, spec })
  })
  return retenues
}

// ── Les examens ──────────────────────────────────────────────────────────────

interface ExamenChoisi {
  code: string
  id: string
  domaine: string
}

function choisirExamens(
  e: EntreeDocuments,
  prescription: PrescriptionProfil,
  couvert: boolean,
): { examens: ExamenChoisi[]; indication: string } | null {
  const { alea, ref } = e.ctx
  const x = prescription.examens
  if (!x) return null
  // Un patient dont l'examen n'est pas pris en charge se le voit prescrire moins souvent.
  if (!alea.proba(x.proba * (couvert ? 1 : 0.6))) return null
  const dispo = x.examens.filter(([code]) => ref.typesExamen.has(code))
  if (dispo.length === 0) return null
  const examens: ExamenChoisi[] = []
  dispo.forEach(([code, proba], i) => {
    if (i > 0 && !alea.proba(proba)) return
    const t = ref.typesExamen.get(code) as { id: string; domaine: string }
    examens.push({ code, id: t.id, domaine: t.domaine })
  })
  return {
    examens,
    indication: avecJours(x.indication, Math.max(1, e.jours)),
  }
}

// ── Les résultats d'examen ───────────────────────────────────────────────────

interface ResultatFabrique {
  contenu: string
  anormal: boolean
  interpretation: string | null
}

const decimal = (n: number, chiffres: number) =>
  n.toFixed(chiffres).replace('.', ',')
const milliers = (n: number) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

/**
 * Ce que dit l'examen : cohérent avec ce que le patient est venu chercher (un test de paludisme est
 * souvent positif chez qui vient pour du paludisme, rarement chez les autres) et avec ce qui a été
 * mesuré à l'accueil (la glycémie, la tension).
 */
function fabriquerResultat(e: EntreeDocuments, code: string): ResultatFabrique {
  const { alea } = e.ctx
  const p = e.profil.code
  const homme = e.patient.sexe === 'M'
  // Plus le diagnostic est assuré, plus l'examen qui le concerne le montre.
  const fiable =
    e.certitude === 'CONFIRME' ? 1 : e.certitude === 'PROBABLE' ? 0.75 : 0.45
  switch (code) {
    case 'PALUDISME_TDR': {
      const positif = alea.proba(
        p === 'PALUDISME'
          ? e.certitude === 'CONFIRME'
            ? 0.93
            : e.certitude === 'PROBABLE'
              ? 0.5
              : 0.2
          : 0.06,
      )
      return positif
        ? {
            contenu: 'Test rapide positif — Plasmodium falciparum.',
            anormal: true,
            interpretation: 'Paludisme confirmé.',
          }
        : {
            contenu: 'Test rapide négatif.',
            anormal: false,
            interpretation: null,
          }
    }
    case 'NFS': {
      let hb = homme
        ? alea.normaleBornee(14.6, 1.1, 12.8, 17)
        : alea.normaleBornee(12.9, 1, 11.2, 15.2)
      let gb = alea.normaleBornee(7000, 1300, 4500, 10500)
      let plaquettes = alea.normaleBornee(260000, 55000, 170000, 400000)
      let interpretation: string | null = null
      const touche = (proba: number) => alea.proba(proba * fiable)
      if (p === 'ANEMIE' && touche(0.9)) {
        hb = alea.normaleBornee(8.3, 1.3, 5.6, 10.4)
        interpretation = hb < 7 ? 'Anémie sévère.' : 'Anémie modérée.'
      } else if (p === 'DREPANOCYTOSE' && touche(0.9)) {
        hb = alea.normaleBornee(7.9, 1, 6, 9.6)
        gb = alea.normaleBornee(12500, 2200, 9500, 17000)
        interpretation =
          'Anémie hémolytique chronique compatible avec la drépanocytose.'
      } else if (p === 'PALUDISME' && touche(0.55)) {
        plaquettes = alea.normaleBornee(105000, 22000, 60000, 145000)
        hb = Math.min(hb, alea.normaleBornee(10.6, 1, 8.5, 12))
        interpretation =
          'Thrombopénie modérée, fréquente au cours du paludisme.'
      } else if (p === 'INFECTION_RESPIRATOIRE' && touche(0.6)) {
        gb = alea.normaleBornee(15200, 2200, 11500, 20000)
        interpretation = 'Hyperleucocytose à polynucléaires neutrophiles.'
      }
      const anormal = interpretation !== null
      return {
        contenu: `Hémoglobine ${decimal(hb, 1)} g/dL ; leucocytes ${milliers(gb)}/mm³ ; plaquettes ${milliers(plaquettes)}/mm³.`,
        anormal,
        interpretation,
      }
    }
    case 'GLYCEMIE': {
      const g =
        e.cst?.glycemie ??
        (p === 'DIABETE'
          ? alea.normaleBornee(1.7, 0.5, 0.9, 3.8)
          : alea.normaleBornee(0.93, 0.12, 0.7, 1.25))
      const anormal = g > 1.26 || g < 0.6
      return {
        contenu: `Glycémie : ${decimal(g, 2)} g/L.`,
        anormal,
        interpretation: anormal
          ? g > 1.26
            ? 'Hyperglycémie.'
            : 'Hypoglycémie.'
          : null,
      }
    }
    case 'URINE_BU': {
      if (p === 'DIABETE' && alea.proba(0.45))
        return {
          contenu:
            'Glucose ++, leucocytes négatifs, nitrites négatifs, protéines négatives.',
          anormal: true,
          interpretation: 'Glycosurie.',
        }
      if ((p === 'GROSSESSE' || p === 'HTA') && alea.proba(0.15))
        return {
          contenu:
            'Protéines ++, leucocytes négatifs, nitrites négatifs, glucose négatif.',
          anormal: true,
          interpretation: 'Protéinurie à contrôler.',
        }
      if (alea.proba(0.14))
        return {
          contenu: 'Leucocytes ++, nitrites positifs, protéines traces.',
          anormal: true,
          interpretation: 'Infection urinaire probable.',
        }
      return {
        contenu:
          'Leucocytes négatifs, nitrites négatifs, protéines négatives, glucose négatif.',
        anormal: false,
        interpretation: null,
      }
    }
    case 'RADIO_THORAX': {
      if (p === 'INFECTION_RESPIRATOIRE' && alea.proba(0.65 * fiable))
        return {
          contenu:
            'Opacité alvéolaire systématisée de la base droite, sans épanchement pleural.',
          anormal: true,
          interpretation: 'Aspect compatible avec une pneumopathie.',
        }
      if (p === 'TUBERCULOSE' && alea.proba(0.6 * fiable))
        return {
          contenu:
            'Infiltrat micronodulaire du sommet droit avec une image de cavité.',
          anormal: true,
          interpretation: 'Lésions évocatrices de tuberculose pulmonaire.',
        }
      if (p === 'CARDIOPATHIE' && alea.proba(0.6 * fiable))
        return {
          contenu:
            'Cardiomégalie : index cardio-thoracique à 0,58 ; discrète surcharge vasculaire.',
          anormal: true,
          interpretation: 'Cardiomégalie.',
        }
      if (p === 'ASTHME' && alea.proba(0.3))
        return {
          contenu: 'Distension thoracique ; pas de foyer parenchymateux.',
          anormal: true,
          interpretation: 'Distension compatible avec un asthme.',
        }
      return {
        contenu:
          'Parenchyme pulmonaire sans anomalie ; silhouette cardiaque de taille normale.',
        anormal: false,
        interpretation: null,
      }
    }
    case 'ECHO_ABDO': {
      if (p === 'GROSSESSE') {
        const sa = alea.entier(8, 38)
        return {
          contenu: `Grossesse intra-utérine évolutive, fœtus unique, activité cardiaque présente ; âge gestationnel estimé à ${sa} SA.`,
          anormal: false,
          interpretation: null,
        }
      }
      if (alea.proba(0.18))
        return {
          contenu: 'Stéatose hépatique modérée ; reins et rate normaux.',
          anormal: true,
          interpretation: 'Stéatose hépatique.',
        }
      return {
        contenu:
          'Foie, rate, reins et vessie d’échostructure normale ; pas d’épanchement.',
        anormal: false,
        interpretation: null,
      }
    }
    case 'TENSION_ARTERIELLE': {
      const hta = p === 'HTA' || p === 'CARDIOPATHIE'
      const sys =
        e.cst?.tensionSystolique ??
        Math.round(
          hta
            ? alea.normaleBornee(152, 12, 128, 185)
            : alea.normaleBornee(120, 9, 100, 138),
        )
      const dia =
        e.cst?.tensionDiastolique ??
        Math.round(
          hta
            ? alea.normaleBornee(94, 8, 78, 112)
            : alea.normaleBornee(77, 6, 62, 88),
        )
      const anormal = sys >= 140 || dia >= 90
      return {
        contenu: `Pression artérielle moyenne : ${sys}/${dia} mmHg (moyenne de trois mesures).`,
        anormal,
        interpretation: anormal ? 'Tension élevée.' : null,
      }
    }
    default:
      return {
        contenu: 'Résultat dans les limites de la normale.',
        anormal: false,
        interpretation: null,
      }
  }
}

// ── Les ordonnances ──────────────────────────────────────────────────────────

type LigneOrdonnanceSaisie = Omit<
  Ligne<'LigneOrdonnance'>,
  'id' | 'ordonnanceId' | 'updatedAt'
>

interface OrdonnanceEcrite {
  id: string
  row: Ligne<'Ordonnance'>
  lignes: Ligne<'LigneOrdonnance'>[]
  /** Moment de la validation (la consultation est encore ouverte). */
  tValidation: number
  /** Moment de la génération du bon, si elle a lieu. */
  tBon: number | null
}

/**
 * Le geste du médecin dans l'application : créer l'ordonnance, y ajouter les lignes une à une, la
 * valider, puis (si le patient est couvert) « Générer un bon ».
 */
function ecrireOrdonnance(
  e: EntreeDocuments,
  prochain: () => number,
  d: {
    type: 'PHARMACEUTIQUE' | 'PRESCRIPTION_EXAMEN'
    indication: string | null
    lignes: LigneOrdonnanceSaisie[]
    avecBon: boolean
  },
): OrdonnanceEcrite {
  const { ctx, lignes, medecin, consultationId } = e
  const at = (s: number) => instantSecondes(ctx.jour, s)
  const trace = (s: number, action: 'CREATE' | 'UPDATE') =>
    tracer(
      ctx,
      lignes,
      medecin,
      at(s),
      action,
      'consultation',
      'Consultation',
      consultationId,
    )
  const id = nouvelIdTest()
  const tCreation = prochain()
  trace(tCreation, 'CREATE')
  const rows: Ligne<'LigneOrdonnance'>[] = d.lignes.map((l) => {
    const t = prochain()
    trace(t, 'CREATE')
    const row: Ligne<'LigneOrdonnance'> = {
      id: nouvelIdTest(),
      ordonnanceId: id,
      ...l,
      updatedAt: at(t),
    }
    lignes.LigneOrdonnance.push(row)
    return row
  })
  const tValidation = prochain()
  trace(tValidation, 'UPDATE')
  const tBon = d.avecBon ? prochain() : null
  if (tBon !== null) trace(tBon, 'CREATE')
  const row: Ligne<'Ordonnance'> = {
    id,
    consultationId,
    prescripteurId: medecin.personnelId,
    delegationId: null,
    statut: 'VALIDEE',
    typeOrdonnance: d.type,
    indicationClinik: d.indication,
    etablissementId: null,
    motifAnnulation: null,
    createdAt: at(tCreation),
    updatedAt: at(tValidation),
  }
  lignes.Ordonnance.push(row)
  return { id, row, lignes: rows, tValidation, tBon }
}

/**
 * Une ordonnance annulée après coup (dans l'onglet Documents du dossier) : rare. Rend le moment de
 * l'annulation, ou `null` si elle a lieu après la fin de la période.
 */
function annulerOrdonnance(
  e: EntreeDocuments,
  ord: OrdonnanceEcrite,
): Moment | null {
  const { ctx, lignes, medecin, consultationId } = e
  const { alea } = ctx
  const m = apresDelaiOuvre(
    { jour: ctx.jour, s: e.tFin },
    alea.entier(15 * 60, 5 * 3600),
  )
  if (auDela(ctx.params, m)) return null
  const quand = instantSecondes(m.jour, m.s)
  ord.row.statut = 'ANNULEE'
  ord.row.updatedAt = quand
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
  return m
}

// ── Les bons de pharmacie ────────────────────────────────────────────────────

/**
 * Le bon de pharmacie généré depuis l'ordonnance, puis son sort : délivré le plus souvent (par un
 * médecin — c'est lui qui a ce droit), parfois jamais retiré, parfois annulé.
 */
function ecrireBonPharmacie(
  e: EntreeDocuments,
  ord: OrdonnanceEcrite,
  choisies: LigneChoisie[],
  tBon: number,
  annulationOrdonnance: Moment | null,
  evacue: boolean,
): void {
  const { ctx, lignes, medecin } = e
  const { alea } = ctx
  const at = (s: number) => instantSecondes(ctx.jour, s)
  // Hors de la période, ou un autre jour pour qui vient d'être évacué : cela n'arrive pas.
  const possible = (m: Moment) =>
    !auDela(ctx.params, m) && (!evacue || m.jour === ctx.jour)
  const bonId = nouvelIdTest()
  const bon: Ligne<'BonPharmacie'> = {
    id: bonId,
    consultationId: e.consultationId,
    prescripteurId: medecin.personnelId,
    ordonnanceId: ord.id,
    statut: 'EN_ATTENTE',
    observations: null,
    delivreLe: null,
    delivrePar: null,
    motifAnnulation: null,
    createdAt: at(tBon),
    updatedAt: at(tBon),
  }
  lignes.BonPharmacie.push(bon)
  for (const { medicament, spec } of choisies)
    lignes.LigneBonPharmacie.push({
      id: nouvelIdTest(),
      bonId,
      medicamentId: medicament.id,
      libelle: medicament.nomGenerique,
      posologie: spec.posologie,
      quantite: spec.quantite ?? null,
      updatedAt: at(tBon),
    })

  const { medecins } = personnelDuSite(ctx, e.equipe)
  const apresConsultation = (delai: number): Moment =>
    apresDelaiOuvre({ jour: ctx.jour, s: e.tFin }, delai)
  const pharmacien = () => alea.choisir(medecins)
  const trace = (qui: Soignant, m: Moment) =>
    tracer(
      ctx,
      lignes,
      qui,
      instantSecondes(m.jour, m.s),
      'UPDATE',
      'bon_pharmacie',
      'Bon de pharmacie',
      bonId,
    )

  const sort = alea.pondere([
    ['DELIVRE', 86],
    ['ATTENTE', 11],
    ['ANNULE', 3],
  ] as const)
  if (sort === 'DELIVRE') {
    const m = apresConsultation(
      alea.proba(0.85)
        ? alea.entier(10 * 60, 150 * 60)
        : alea.entier(4 * 3600, 22 * 3600),
    )
    // L'ordonnance a été annulée avant la remise : le bon part avec elle.
    if (annulationOrdonnance && avant(annulationOrdonnance, m)) {
      annulerBon(bon, annulationOrdonnance, "Ordonnance d'origine annulée")
      return
    }
    if (!possible(m)) return
    const qui = pharmacien()
    const quand = instantSecondes(m.jour, m.s)
    bon.statut = 'DELIVRE'
    bon.delivreLe = quand
    bon.delivrePar = qui.utilisateurId
    bon.updatedAt = quand
    trace(qui, m)
    return
  }
  // Un bon encore en attente quand l'ordonnance est annulée : annulé avec elle.
  if (annulationOrdonnance) {
    annulerBon(bon, annulationOrdonnance, "Ordonnance d'origine annulée")
    return
  }
  if (sort === 'ANNULE') {
    const m = apresConsultation(alea.entier(30 * 60, 6 * 3600))
    if (!possible(m)) return
    annulerBon(bon, m, alea.choisir(MOTIFS_ANNULATION_BON_PHARMACIE))
    trace(pharmacien(), m)
  }
}

function annulerBon(
  bon: Ligne<'BonPharmacie'>,
  m: Moment,
  motif: string,
): void {
  bon.statut = 'ANNULE'
  bon.motifAnnulation = motif
  bon.updatedAt = instantSecondes(m.jour, m.s)
}

// ── Les bons d'examen et leurs résultats ─────────────────────────────────────

/**
 * Le bon d'examen (validé d'emblée : le médecin a le droit de valider), puis les résultats que
 * l'infirmier saisit quand ils reviennent : la biologie en quelques heures, l'imagerie un ou deux
 * jours plus tard, et parfois jamais (le patient n'est pas allé faire l'examen).
 */
function ecrireBonExamen(
  e: EntreeDocuments,
  ord: OrdonnanceEcrite,
  indication: string,
  examens: ExamenChoisi[],
  tBon: number,
  evacue: boolean,
): void {
  const { ctx, lignes } = e
  const { alea } = ctx
  const at = (s: number) => instantSecondes(ctx.jour, s)
  const possible = (m: Moment) =>
    !auDela(ctx.params, m) && (!evacue || m.jour === ctx.jour)
  const bonId = nouvelIdTest()
  lignes.BonExamen.push({
    id: bonId,
    consultationId: e.consultationId,
    ordonnanceId: ord.id,
    indicationClinik: indication,
    etablissementId: null,
    statut: 'VALIDE',
    motifAnnulation: null,
    createdAt: at(tBon),
    updatedAt: at(tBon),
  })
  const ligneParCode = new Map<string, string>()
  for (const x of examens) {
    const ligneId = nouvelIdTest()
    ligneParCode.set(x.code, ligneId)
    lignes.LigneExamen.push({
      id: ligneId,
      bonId,
      typeExamenId: x.id,
      updatedAt: at(tBon),
    })
  }

  const { medecins, infirmiers } = personnelDuSite(ctx, e.equipe)
  // La biologie et l'imagerie ne reviennent pas en même temps.
  const groupes: { examens: ExamenChoisi[]; delai: [number, number] }[] = [
    {
      examens: examens.filter((x) => x.domaine !== 'IMAGERIE'),
      delai: alea.proba(0.8) ? [20 * 60, 3 * 3600] : [4 * 3600, 20 * 3600],
    },
    {
      examens: examens.filter((x) => x.domaine === 'IMAGERIE'),
      delai: [5 * 3600, 30 * 3600],
    },
  ]
  for (const groupe of groupes) {
    if (groupe.examens.length === 0) continue
    if (!alea.proba(groupe.examens[0].domaine === 'IMAGERIE' ? 0.8 : 0.9))
      continue
    const m = apresDelaiOuvre(
      { jour: ctx.jour, s: tBon },
      alea.entier(groupe.delai[0], groupe.delai[1]),
    )
    if (!possible(m)) continue
    const quand = instantSecondes(m.jour, m.s)
    // L'infirmier saisit le plus souvent ; le médecin aussi, lui qui a tous les droits.
    const qui = alea.proba(0.78)
      ? alea.choisir(infirmiers)
      : alea.choisir(medecins)
    tracer(
      ctx,
      lignes,
      qui,
      quand,
      'CREATE',
      'bon_examen',
      "Bon d'examen",
      bonId,
    )
    for (const x of groupe.examens) {
      const r = fabriquerResultat(e, x.code)
      const resultatId = nouvelIdTest()
      const realisation = new Date(
        Math.max(+at(tBon), +quand - alea.entier(8, 80) * 60_000),
      )
      const ligne: Ligne<'ResultatExamen'> = {
        id: resultatId,
        bonId,
        laboratoire: LABORATOIRES[x.domaine] ?? null,
        contenu: r.contenu,
        interpretation: alea.proba(0.7) ? r.interpretation : null,
        statut: 'RECU',
        saisiePar: qui.utilisateurId,
        createdAt: quand,
        ligneExamenId: ligneParCode.get(x.code) as string,
        dateRealisation: realisation,
        anormal: r.anormal,
        corrigeId: null,
        motifCorrection: null,
        updatedAt: quand,
      }
      lignes.ResultatExamen.push(ligne)
      // Une erreur de saisie corrigée après coup : l'ancien résultat reste, marqué « remplacé ».
      if (alea.proba(0.03)) {
        const mc = apresDelaiOuvre(m, alea.entier(10 * 60, 2 * 3600))
        if (!possible(mc)) continue
        const corrige = instantSecondes(mc.jour, mc.s)
        const r2 = fabriquerResultat(e, x.code)
        ligne.statut = 'REMPLACE'
        ligne.updatedAt = corrige
        lignes.ResultatExamen.push({
          ...ligne,
          id: nouvelIdTest(),
          contenu: r2.contenu,
          interpretation: r2.interpretation,
          anormal: r2.anormal,
          statut: 'RECU',
          corrigeId: resultatId,
          motifCorrection: alea.choisir(MOTIFS_CORRECTION_RESULTAT),
          createdAt: corrige,
          updatedAt: corrige,
        })
        tracer(
          ctx,
          lignes,
          qui,
          corrige,
          'UPDATE',
          'bon_examen',
          "Bon d'examen",
          bonId,
        )
      }
    }
  }
}

// ── L'évacuation ─────────────────────────────────────────────────────────────

type EtapeEvacuation = 'EN_COURS' | 'EN_TRANSPORT' | 'ADMIS' | 'CLOTURE'

/**
 * Le moment qui suit `depuis` de `delaiS` secondes. Une évacuation s'organise tout de suite, sans
 * attendre l'ouverture, tant qu'on reste dans la journée du centre (à trois quarts d'heure de la
 * fermeture près) ; au-delà, et pour le travail de bureau (la clôture du dossier), on reprend à
 * l'ouverture suivante.
 */
function suite(depuis: Moment, delaiS: number, bureau: boolean): Moment {
  const h = horairesDuJour(depuis.jour)
  const limite = h ? h.fermeture * 60 + 45 * 60 : 0
  if (!bureau && h && depuis.s + delaiS <= limite)
    return { jour: depuis.jour, s: depuis.s + delaiS }
  return apresDelaiOuvre(depuis, delaiS)
}

/**
 * La décision « évacuation médicale » : la fiche d'évacuation (créée avant la clôture), puis son
 * suivi — départ, transport, admission, clôture — rédigé par le médecin au fil des heures.
 */
function ecrireEvacuation(
  e: EntreeDocuments,
  prescription: PrescriptionProfil,
  prochain: () => number,
): void {
  const { ctx, lignes, medecin, patient, cst } = e
  const { alea, ref } = ctx
  const x = prescription.evacuation
  if (!x) return
  const evacuationId = nouvelIdTest()
  const tCreation = prochain()
  const at = (m: Moment) => instantSecondes(m.jour, m.s)
  const depart: Moment = { jour: ctx.jour, s: tCreation }
  const niveau = alea.pondere(x.urgence)
  const resume: string[] = [
    `${e.age} ans, ${patient.sexe === 'M' ? 'sexe masculin' : 'sexe féminin'}. ${avecJours(e.cas.symptomes, Math.max(1, e.jours))}`,
  ]
  if (cst) {
    const mesures = [
      cst.temperature !== null
        ? `température ${decimal(cst.temperature, 1)} °C`
        : null,
      cst.tensionSystolique !== null && cst.tensionDiastolique !== null
        ? `tension ${cst.tensionSystolique}/${cst.tensionDiastolique} mmHg`
        : null,
      cst.frequenceCardiaque !== null
        ? `pouls ${cst.frequenceCardiaque}/min`
        : null,
      cst.saturationO2 !== null ? `saturation ${cst.saturationO2} %` : null,
    ].filter((v): v is string => v !== null)
    if (mesures.length > 0) resume.push(`À l’accueil : ${mesures.join(', ')}.`)
  }
  resume.push(alea.choisir(x.raisons))

  // Jusqu'où l'évacuation va-t-elle ?
  const issue = alea.pondere([
    ['CLOTURE', 60],
    ['ADMIS', 12],
    ['EN_TRANSPORT', 6],
    ['EN_COURS', 14],
    ['ANNULE', 8],
  ] as const)
  const etapes: { statut: EtapeEvacuation; delai: [number, number] }[] = []
  if (issue === 'ANNULE') {
    if (alea.proba(0.5)) etapes.push({ statut: 'EN_COURS', delai: [300, 1200] })
  } else {
    if (issue === 'EN_COURS') {
      if (alea.proba(0.7))
        etapes.push({ statut: 'EN_COURS', delai: [300, 1800] })
    } else {
      etapes.push({ statut: 'EN_COURS', delai: [300, 1200] })
      etapes.push({ statut: 'EN_TRANSPORT', delai: [1200, 5400] })
      if (issue === 'ADMIS' || issue === 'CLOTURE')
        etapes.push({ statut: 'ADMIS', delai: [2400, 9000] })
      if (issue === 'CLOTURE')
        etapes.push({ statut: 'CLOTURE', delai: [4 * 3600, 30 * 3600] })
    }
  }
  const row: Ligne<'Evacuation'> = {
    id: evacuationId,
    consultationId: e.consultationId,
    motifId: null,
    niveauUrgence: niveau,
    etablissementId:
      ref.etablissements.length > 0 && alea.proba(0.85)
        ? alea.choisir(ref.etablissements)
        : null,
    infosCliniques: resume.join(' '),
    statut: 'EN_COURS',
    motifAnnulation: null,
    createdAt: at(depart),
    updatedAt: at(depart),
  }
  lignes.Evacuation.push(row)
  tracer(
    ctx,
    lignes,
    medecin,
    at(depart),
    'CREATE',
    'evacuation',
    'Évacuation',
    null,
  )

  let courant = depart
  for (const etape of etapes) {
    const delai = alea.entier(etape.delai[0], etape.delai[1])
    courant = suite(courant, delai, etape.statut === 'CLOTURE')
    if (auDela(ctx.params, courant)) return
    lignes.SuiviEvacuation.push({
      id: nouvelIdTest(),
      evacuationId,
      notes: alea.choisir(NOTES_SUIVI_EVACUATION[etape.statut]),
      statut: etape.statut,
      createdAt: at(courant),
      createdBy: medecin.utilisateurId,
      updatedAt: at(courant),
    })
    row.updatedAt = at(courant)
    if (etape.statut === 'CLOTURE') row.statut = 'CLOTURE'
    tracer(
      ctx,
      lignes,
      medecin,
      at(courant),
      'CREATE',
      'evacuation',
      'Évacuation',
      evacuationId,
    )
  }
  if (issue === 'ANNULE') {
    courant = suite(courant, alea.entier(10 * 60, 90 * 60), false)
    if (auDela(ctx.params, courant)) return
    row.statut = 'ANNULE'
    row.motifAnnulation = alea.choisir(MOTIFS_ANNULATION_EVACUATION)
    row.updatedAt = at(courant)
    tracer(
      ctx,
      lignes,
      medecin,
      at(courant),
      'UPDATE',
      'evacuation',
      'Évacuation',
      evacuationId,
    )
  }
}

// ── Le suivi de traitement ───────────────────────────────────────────────────

/**
 * La décision « suivi de traitement » : l'épisode ouvert avant la clôture, puis des fiches datées —
 * constantes, note d'évolution, médicaments administrés — que l'infirmier (ou le médecin) saisit
 * au fil des jours, avant la clôture de l'épisode quand tout va bien. Un traitement est parfois
 * arrêté en route.
 */
function ecrireSuiviTraitement(
  e: EntreeDocuments,
  prescription: PrescriptionProfil,
  prochain: () => number,
  ordonnance: OrdonnanceEcrite | null,
): void {
  const { ctx, lignes, medecin, patient, profil } = e
  const { alea } = ctx
  const type = prescription.suivi
  if (!type) return
  const at = (m: Moment) => instantSecondes(m.jour, m.s)
  const { infirmiers } = personnelDuSite(ctx, e.equipe)
  const suiviId = nouvelIdTest()
  const tCreation = prochain()
  const creation: Moment = { jour: ctx.jour, s: tCreation }
  const nbFiches = alea.entier(type.fiches[0], type.fiches[1])
  const duree = alea.entier(type.jours[0], type.jours[1])
  const pas = Math.max(1, Math.round(duree / nbFiches))

  // Les rendez-vous de fiche : le premier peu après la consultation, les autres de plus en plus loin.
  const rendezVous: Moment[] = []
  let m = apresDelaiOuvre(
    { jour: ctx.jour, s: e.tFin },
    alea.entier(20 * 60, 100 * 60),
  )
  rendezVous.push(m)
  for (let i = 1; i < nbFiches; i++) {
    const jour = jourOuvertApres(m.jour, pas)
    const h = horairesDuJour(jour)
    m = {
      jour,
      s: (h ? h.ouverture : 450) * 60 + alea.entier(20 * 60, 4 * 3600),
    }
    rendezVous.push(m)
  }
  const dateControle = (r: Moment): Date => {
    const h = horairesDuJour(r.jour)
    return instantSecondes(r.jour, (h ? h.ouverture : 450) * 60)
  }

  // Clôturé quand tout va bien ; encore en cours ; abandonné par le patient (les contrôles cessent,
  // le suivi reste ouvert et son contrôle est « en retard ») ; ou ouvert par erreur.
  const issue = alea.pondere([
    ['CLOTURE', 74],
    ['EN_COURS', 14],
    ['ABANDON', 8],
    ['ANNULE', 4],
  ] as const)
  const row: Ligne<'SuiviTraitement'> = {
    id: suiviId,
    consultationId: e.consultationId,
    motif: type.motif,
    statut: 'EN_COURS',
    motifCloture: null,
    motifAnnulation: null,
    createdAt: at(creation),
    closedAt: null,
    prochainControle: dateControle(rendezVous[0]),
    updatedAt: at(creation),
  }
  lignes.SuiviTraitement.push(row)
  tracer(
    ctx,
    lignes,
    medecin,
    at(creation),
    'CREATE',
    'suivi_traitement',
    'Suivi de traitement',
    null,
  )
  // Le prochain contrôle est fixé tout de suite.
  tracer(
    ctx,
    lignes,
    medecin,
    instantSecondes(ctx.jour, prochain()),
    'UPDATE',
    'suivi_traitement',
    'Suivi de traitement',
    suiviId,
  )

  // Annulé d'emblée : ouvert par erreur ou devenu sans objet, aucune fiche.
  if (issue === 'ANNULE') {
    const ma = apresDelaiOuvre(creation, alea.entier(10 * 60, 60 * 60))
    if (auDela(ctx.params, ma)) return
    row.statut = 'ANNULE'
    row.motifAnnulation = alea.choisir(MOTIFS_ANNULATION_SUIVI)
    row.prochainControle = null
    row.updatedAt = at(ma)
    tracer(
      ctx,
      lignes,
      medecin,
      at(ma),
      'UPDATE',
      'suivi_traitement',
      'Suivi de traitement',
      suiviId,
    )
    return
  }

  const traitees = (ordonnance?.lignes ?? []).filter((l) => l.medicamentId)
  let faites = 0
  let arrete = false
  let dernier: Moment = creation
  const limite =
    issue === 'ABANDON'
      ? Math.max(1, Math.floor(rendezVous.length / 2))
      : rendezVous.length
  for (let i = 0; i < limite; i++) {
    const r = rendezVous[i]
    if (auDela(ctx.params, r)) break
    const quand = at(r)
    const auteur = alea.proba(0.85) ? alea.choisir(infirmiers) : medecin
    const avancement = rendezVous.length > 1 ? i / (rendezVous.length - 1) : 1
    const mesure =
      type.constantes === true
        ? genererConstantes({
            alea,
            age: e.age,
            morphologie: patient.morphologie,
            // Les premiers contrôles ressemblent encore à la maladie, les derniers à une personne guérie.
            profil: alea.proba(avancement) ? {} : profil.constantes,
          })
        : null
    const ficheId = nouvelIdTest()
    lignes.FicheSuiviTraitement.push({
      id: ficheId,
      suiviTraitementId: suiviId,
      temperature: mesure?.temperature ?? null,
      tensionSystolique: mesure?.tensionSystolique ?? null,
      tensionDiastolique: mesure?.tensionDiastolique ?? null,
      frequenceCardiaque: mesure?.frequenceCardiaque ?? null,
      frequenceRespiratoire: mesure?.frequenceRespiratoire ?? null,
      saturationO2: mesure?.saturationO2 ?? null,
      poids: mesure?.poids ?? null,
      noteEvolution: alea.choisir(
        NOTES_FICHE[
          i === 0 ? 'DEBUT' : i === rendezVous.length - 1 ? 'FIN' : 'MILIEU'
        ],
      ),
      medicamentsAdministres: null,
      resultatExamen: null,
      createdAt: quand,
      createdBy: auteur.utilisateurId,
      updatedAt: quand,
    })
    tracer(
      ctx,
      lignes,
      auteur,
      quand,
      'CREATE',
      'suivi_traitement',
      'Suivi de traitement',
      suiviId,
    )

    // Les traitements pris pendant la période couverte par la fiche.
    // Une ordonnance annulée n'autorise plus aucune administration (le serveur la refuse).
    const valide =
      ordonnance === null ||
      ordonnance.row.statut !== 'ANNULEE' ||
      +quand < +(ordonnance.row.updatedAt as Date)
    const actifs = traitees.filter(
      (l) =>
        valide &&
        !l.arreteLe &&
        joursEntre(ctx.jour, r.jour).length - 1 < joursPrescrits(l.duree),
    )
    if (actifs.length > 0) {
      const nb = Math.min(actifs.length, alea.entier(1, 2))
      for (const l of alea.melanger(actifs).slice(0, nb))
        lignes.AdministrationTraitement.push({
          id: nouvelIdTest(),
          ligneOrdonnanceId: l.id as string,
          suiviTraitementId: suiviId,
          ficheId,
          administreLe: quand,
          dose: alea.choisir(DOSES_ADMINISTRATION),
          observation: null,
          createdBy: auteur.utilisateurId,
          createdAt: quand,
          updatedAt: quand,
        })
    }
    // Un traitement arrêté en route (effet indésirable, inefficacité) : rare.
    if (!arrete && i > 0 && actifs.length > 0 && alea.proba(0.05)) {
      const l = alea.choisir(actifs)
      const t = new Date(+quand + alea.entier(2, 12) * 60_000)
      l.arreteLe = t
      l.motifArret = alea.choisir(MOTIFS_ARRET_TRAITEMENT)
      l.arretePar = auteur.utilisateurId
      l.updatedAt = t
      arrete = true
      tracer(
        ctx,
        lignes,
        auteur,
        t,
        'UPDATE',
        'suivi_traitement',
        'Suivi de traitement',
        suiviId,
      )
    }
    row.updatedAt = quand
    dernier = r
    faites++
  }

  const toutFait = faites === rendezVous.length
  if (issue === 'CLOTURE' && toutFait) {
    const mc = apresDelaiOuvre(dernier, alea.entier(0, 4 * 3600))
    if (!auDela(ctx.params, mc)) {
      const quand = at(mc)
      const qui = alea.proba(0.6) ? alea.choisir(infirmiers) : medecin
      row.statut = 'CLOTURE'
      row.motifCloture = alea.choisir(MOTIFS_CLOTURE_SUIVI)
      row.closedAt = quand
      row.prochainControle = null
      row.updatedAt = quand
      tracer(
        ctx,
        lignes,
        qui,
        quand,
        'UPDATE',
        'suivi_traitement',
        'Suivi de traitement',
        suiviId,
      )
      return
    }
  }
  // Toujours en cours : le prochain contrôle est la prochaine fiche prévue, ou, si tout est fait,
  // un contrôle de plus à une semaine.
  row.prochainControle = toutFait
    ? dateControle({ jour: jourOuvertApres(dernier.jour, 7), s: 0 })
    : dateControle(rendezVous[faites])
}

// ── Le suivi chronique ───────────────────────────────────────────────────────

/** Le médecin définit, depuis le dossier, le suivi d'une maladie qui dure : fréquence et objectifs. */
function ecrireSuiviChronique(
  e: EntreeDocuments,
  prescription: PrescriptionProfil,
  tSuivi: number,
): void {
  const { ctx, lignes, medecin, patient, profil } = e
  const { alea, ref } = ctx
  const c = prescription.chronique
  if (!c) return
  const quand = instantSecondes(ctx.jour, tSuivi)
  lignes.SuiviChronique.push({
    id: nouvelIdTest(),
    patientId: patient.id,
    consultationId: null,
    pathologieId: ref.pathologies.get(profil.pathologie) as string,
    frequenceSuivi: alea.pondere(c.frequences),
    objectifs: alea.choisir(c.objectifs),
    statut: 'ACTIF',
    motifCloture: null,
    motifAnnulation: null,
    createdAt: quand,
    closedAt: null,
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
  patient.suivisChroniques.push(profil.code)
}

// ── L'ensemble ───────────────────────────────────────────────────────────────

/** Ajoute à la journée tout ce qui suit la consultation, et rend la décision du médecin (à consigner à la clôture). */
export function planifierDocuments(e: EntreeDocuments): SortieDocuments {
  const { ctx, patient, profil } = e
  const { alea, ref } = ctx
  const prescription = prescriptionDe(profil)
  if (!prescription) return { decision: null }
  const couvre = (prestation: string) =>
    ref.droits.get(patient.categorieCode)?.has(prestation) ?? false

  const traitement = choisirTraitement(e, prescription)
  const examens = choisirExamens(e, prescription, couvre('EXAMEN'))
  const decision: DecisionMedicale | null =
    prescription.evacuation && alea.proba(prescription.evacuation.proba)
      ? 'EVACUATION'
      : prescription.suivi && alea.proba(prescription.suivi.proba)
        ? 'SUIVI_TRAITEMENT'
        : null
  const pathologieId = ref.pathologies.get(profil.pathologie)
  const suiviChronique =
    !!prescription.chronique &&
    !!profil.chronique &&
    pathologieId !== undefined &&
    ref.pathologiesChroniques.has(pathologieId) &&
    !patient.suivisChroniques.includes(profil.code) &&
    alea.proba(e.nouvelleChronique ? 0.75 : 0.35)
  const bonMedicaments =
    traitement.length > 0 && couvre('MEDICAMENT') && alea.proba(0.9)
  const bonExamens = !!examens && couvre('EXAMEN') && alea.proba(0.92)

  // Les gestes du médecin se répartissent dans la seconde moitié de la consultation.
  const duree = e.tFin - e.tOuv
  let n = 0
  if (traitement.length > 0)
    n += 2 + traitement.length + (bonMedicaments ? 1 : 0)
  if (examens) n += 2 + examens.examens.length + (bonExamens ? 1 : 0)
  if (decision) n += decision === 'SUIVI_TRAITEMENT' ? 2 : 1
  if (suiviChronique) n += 1
  if (n === 0) return { decision: null }
  const instants = repartir(alea, e.tOuv + duree * 0.4, e.tFin - 8, n)
  let k = 0
  const prochain = () => instants[k++]

  let ordMedicaments: OrdonnanceEcrite | null = null
  if (traitement.length > 0) {
    ordMedicaments = ecrireOrdonnance(e, prochain, {
      type: 'PHARMACEUTIQUE',
      indication: null,
      avecBon: bonMedicaments,
      lignes: traitement.map(({ medicament, spec }) => ({
        medicamentId: medicament.id,
        posologie: spec.posologie,
        duree: spec.duree,
        voieAdmin: spec.voie,
        quantite: spec.quantite ?? null,
        instructions: spec.instructions ?? null,
        justification: null,
        typeExamenId: null,
        arreteLe: null,
        motifArret: null,
        arretePar: null,
        remplaceParId: null,
      })),
    })
    const annulation = alea.proba(0.015)
      ? annulerOrdonnance(e, ordMedicaments)
      : null
    if (ordMedicaments.tBon !== null)
      ecrireBonPharmacie(
        e,
        ordMedicaments,
        traitement,
        ordMedicaments.tBon,
        annulation,
        decision === 'EVACUATION',
      )
  }
  if (examens) {
    const ord = ecrireOrdonnance(e, prochain, {
      type: 'PRESCRIPTION_EXAMEN',
      indication: examens.indication,
      avecBon: bonExamens,
      lignes: examens.examens.map((x) => ({
        medicamentId: null,
        posologie: null,
        duree: null,
        voieAdmin: null,
        quantite: null,
        instructions: null,
        justification: null,
        typeExamenId: x.id,
        arreteLe: null,
        motifArret: null,
        arretePar: null,
        remplaceParId: null,
      })),
    })
    if (ord.tBon !== null)
      ecrireBonExamen(
        e,
        ord,
        examens.indication,
        examens.examens,
        ord.tBon,
        decision === 'EVACUATION',
      )
  }
  if (decision === 'EVACUATION') ecrireEvacuation(e, prescription, prochain)
  if (decision === 'SUIVI_TRAITEMENT')
    ecrireSuiviTraitement(e, prescription, prochain, ordMedicaments)
  if (suiviChronique) ecrireSuiviChronique(e, prescription, prochain())
  return { decision }
}
