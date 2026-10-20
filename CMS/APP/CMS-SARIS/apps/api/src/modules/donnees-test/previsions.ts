/**
 * Ce que va produire une génération, calculé AVANT de la lancer : combien de jours d'ouverture,
 * combien de visites et de dossiers, ce que l'équipe du centre peut réellement absorber, et la place
 * que cela prendra dans la base. Le tout sans rien écrire.
 */
import {
  ajouterJours,
  estOuvert,
  facteurFrequentation,
  fenetreFileAttente,
  horairesDuJour,
  horairesEffectifs,
  jourLocalDe,
  joursEntre,
  momentLocalDe,
  partDesArrivees,
  type Moment,
} from './calendrier'

/**
 * Place moyenne occupée dans la base par une visite et tout ce qui l'accompagne (visite,
 * évènements, constantes, consultation, diagnostics, ordonnances, bons, résultats, suivis,
 * journal d'audit, connexions du personnel, part des dossiers neufs), index compris. Mesurée sur une
 * génération réelle : 3 506 visites, 1 468 dossiers, 105 000 lignes → 42 Mo, soit ~12 100 octets par
 * visite.
 */
export const OCTETS_PAR_VISITE = 12_500

/** Temps moyen de triage et de consultation (minutes) : ils fixent ce que l'équipe peut absorber. */
const MINUTES_TRIAGE = 11
const MINUTES_CONSULTATION = 17

export interface EquipeEffectifs {
  medecins: number
  infirmiers: number
}

export interface Previsions {
  debut: string
  fin: string
  joursOuverts: number
  /** Visites par jour d'ouverture que l'équipe peut absorber en semaine. */
  capaciteParJour: number
  /** Visites attendues sur la période, capacité de l'équipe déduite. */
  visites: number
  /** Dossiers patients (nouveaux) attendus. */
  patients: number
  /** Lignes écrites en base (hors journal d'audit, à part). */
  lignes: number
  octets: number
  /** Ce que la demande dépasse de la capacité de l'équipe, par jour (0 si tout passe). */
  depassementParJour: number
  /**
   * AUJOURD'HUI est le dernier jour de la période ? Alors la journée est fabriquée jusqu'à deux heures
   * avant maintenant : `jusqua` est l'heure (« HH:MM », locale) de la dernière arrivée, ou `null` si le
   * centre est déjà fermé depuis assez longtemps pour que la journée soit entière.
   */
  aujourdhui: { inclus: boolean; jusqua: string | null }
  avertissements: string[]
}

/** Dernier jour = la veille de `aujourdhui`, premier = `mois` mois plus tôt. */
export function periode(
  aujourdhui: string,
  mois: number,
): { debut: string; fin: string } {
  return periodeJusqua(ajouterJours(aujourdhui, -1), mois)
}

/** `mois` mois jusqu'au jour `fin` INCLUS. */
export function periodeJusqua(
  fin: string,
  mois: number,
): { debut: string; fin: string } {
  const [a, m, j] = fin.split('-').map(Number) as [number, number, number]
  // `mois` mois avant `fin`, le lendemain de ce jour (4 mois avant le 10 oct. → du 11 juin au 10 oct.)
  const d = new Date(Date.UTC(a, m - 1 - mois, j))
  // 31 mars − 1 mois = « 31 février » = 3 mars en JS : on revient au dernier jour du mois voulu.
  if (d.getUTCDate() !== j) d.setUTCDate(0)
  const debut = ajouterJours(d.toISOString().slice(0, 10), 1)
  return { debut, fin }
}

/** La période d'une génération lancée à `maintenant`, et la coupure d'aujourd'hui s'il en est. */
export interface PeriodeGeneration {
  debut: string
  fin: string
  /** « Maintenant », quand la période va jusqu'à aujourd'hui ; `null` quand elle s'arrête à hier. */
  limite: Moment | null
}

/**
 * La période d'une génération lancée à `maintenant` : `mois` mois jusqu'à AUJOURD'HUI — la journée en
 * cours étant fabriquée jusqu'à deux heures avant maintenant — ou, quand aujourd'hui n'a rien à donner
 * (centre fermé : dimanche, jour férié ; ou trop tôt dans la matinée pour qu'un passage ait pu se
 * terminer), jusqu'à la veille, comme avant.
 */
export function periodeJusquaMaintenant(
  maintenant: Date,
  mois: number,
): PeriodeGeneration {
  const aujourdhui = jourLocalDe(maintenant)
  const limite = momentLocalDe(maintenant)
  if (horairesEffectifs(aujourdhui, limite))
    return { ...periodeJusqua(aujourdhui, mois), limite }
  return { ...periode(aujourdhui, mois), limite: null }
}

/** « 11:30 » pour 690 minutes depuis minuit. */
function heureDeMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Visites que peut absorber un site un jour donné : le goulot est l'infirmier d'accueil ou le médecin. */
export function capaciteSite(e: EquipeEffectifs, jour: string): number {
  const h = horairesDuJour(jour)
  if (!h) return 0
  const minutes = h.fermeture - h.ouverture + 60 // le médecin finit jusqu'à une heure après la fermeture
  return Math.floor(
    Math.min(
      (e.infirmiers * (h.fermeture - h.ouverture - 10)) / MINUTES_TRIAGE,
      (e.medecins * minutes) / MINUTES_CONSULTATION,
    ),
  )
}

export function calculerPrevisions(p: {
  debut: string
  fin: string
  visitesParJour: number
  /** Une entrée par site de l'équipe. */
  equipes: readonly EquipeEffectifs[]
  /** « Maintenant », quand la période va jusqu'à aujourd'hui (cf. `periodeJusquaMaintenant`). */
  limite?: Moment | null
}): Previsions {
  const jours = joursEntre(p.debut, p.fin).filter(estOuvert)
  const poidsTotal =
    p.equipes.reduce((s, e) => s + Math.max(1, e.medecins), 0) || 1
  const limite = p.limite ?? null
  let visites = 0
  let demande = 0
  let aujourdhui: Previsions['aujourdhui'] = { inclus: false, jusqua: null }
  for (const jour of jours) {
    // Aujourd'hui n'a reçu qu'une part des arrivées (et des heures de l'équipe) d'une journée entière.
    let part = 1
    let partHeures = 1
    if (limite && jour === limite.jour) {
      const plein = horairesDuJour(jour)
      const h = horairesEffectifs(jour, limite)
      if (plein && h) {
        // La journée coupée, prolongée par la file d'attente du moment (jusqu'à la dernière arrivée possible).
        const file = fenetreFileAttente(plein, h, limite)
        const derniere = file ? file.fin : h.fermeture - 30
        part = h.tronque
          ? partDesArrivees(plein, { ...plein, fermeture: derniere + 30 })
          : 1
        partHeures = Math.min(
          1,
          ((file ? derniere + 30 : h.fermeture) - h.ouverture) /
            (plein.fermeture - plein.ouverture),
        )
        aujourdhui = {
          inclus: true,
          jusqua: h.tronque ? heureDeMinutes(derniere) : null,
        }
      } else {
        part = 0
        partHeures = 0
      }
    }
    for (const e of p.equipes) {
      const cible =
        p.visitesParJour *
        (Math.max(1, e.medecins) / poidsTotal) *
        facteurFrequentation(jour) *
        part
      demande += cible
      visites += Math.min(cible, capaciteSite(e, jour) * partHeures)
    }
  }
  visites = Math.round(visites)
  const patients = Math.round(visites / 2.2)
  const capaciteParJour = p.equipes.reduce(
    (s, e) => s + capaciteSite(e, '2026-10-12' /* un lundi */),
    0,
  )
  const depassement =
    jours.length > 0
      ? Math.max(0, Math.round((demande - visites) / jours.length))
      : 0
  const avertissements: string[] = []
  if (p.equipes.length === 0 || capaciteParJour === 0)
    avertissements.push(
      'Aucune équipe disponible : il faut au moins un médecin et un infirmier actifs.',
    )
  else if (depassement >= 1)
    avertissements.push(
      `L’équipe actuelle absorbe environ ${capaciteParJour} visites par jour ; la demande en dépasse d’environ ${depassement} par jour, ces patients repartiront sans consultation.`,
    )
  return {
    debut: p.debut,
    fin: p.fin,
    joursOuverts: jours.length,
    capaciteParJour,
    visites,
    patients,
    // Lignes « métier » : ~11 par visite (visite, évènements, constantes, consultation, diagnostics,
    // ordonnances, bons, résultats…) et ~5 par dossier neuf (dossier, identité, contact, emploi…).
    lignes: visites * 11 + patients * 5,
    octets: visites * OCTETS_PAR_VISITE,
    depassementParJour: depassement,
    aujourdhui,
    avertissements,
  }
}
