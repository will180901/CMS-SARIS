/**
 * Les NOMBRES dans les textes traduits : « 3 475 consultations », pas « 3475 ».
 *
 * i18next ne formate une valeur que si le texte le demande (`{{count, number}}`) ; or une centaine de
 * textes écrivent `{{count}}`, `{{total}}`… tout court. Plutôt que de les réécrire un à un (et d'oublier
 * le suivant), ce formateur s'applique AUTOMATIQUEMENT aux variables qui portent un NOMBRE D'ÉLÉMENTS —
 * la liste ci-dessous — et à elles seules : une année (« 2026 »), un numéro de dossier, une heure ou une
 * version ne doivent jamais recevoir de séparateur de milliers.
 *
 * Une variable qui n'est pas dans la liste se formate explicitement : `{{value, nombre}}`.
 */

/** Variables d'interpolation qui portent un nombre d'éléments (jamais un identifiant, une année, une heure). */
export const CLES_NOMBRE: ReadonlySet<string> = new Set([
  // pagination, comptes, totaux
  'count', 'n', 'total', 'start', 'end', 'shown', 'loaded', 'reste',
  // activité du centre
  'visites', 'dossiers', 'jours', 'faits', 'cas', 'accidents', 'enCours', 'attente',
  // comparaison de deux périodes d'un rapport (« 535 consultations contre 876 »)
  'avant', 'apres',
  // résultats d'une opération (suppression, synchronisation, purge…)
  'ok', 'ko', 'recus', 'actions', 'auth', 'echanges', 'conflits', 'pushed', 'pulled',
  // postes de bureau
  'postes', 'enLigne', 'online',
  // taille (Mo) et distance (m)
  'mo', 'limite', 'metres',
])

/** Locale BCP-47 d'une langue i18next. */
function localeDe(lng?: string): string {
  return lng === 'en' ? 'en-GB' : 'fr-FR'
}

/**
 * Un nombre avec ses séparateurs de milliers, selon la langue. En français, Intl sépare les groupes par
 * l'espace FINE insécable (U+202F), que la plupart des polices dessinent presque invisible : « 3475 »
 * s'y lit comme avant. On y met l'espace insécable ordinaire (U+00A0) : visible, et le nombre ne se
 * coupe jamais en fin de ligne.
 */
export function formaterNombre(
  n: number,
  lng?: string,
  opts?: Intl.NumberFormatOptions,
): string {
  const texte = n.toLocaleString(localeDe(lng), opts)
  return lng === 'en' ? texte : texte.replace(/\u202f/g, '\u00a0')
}

/**
 * Le formateur d'i18next (module de type `formatter`) : formate les nombres des variables de
 * `CLES_NOMBRE`, et tout nombre dont le texte demande `nombre` (ou `number`).
 */
export const formateurNombres = {
  type: 'formatter' as const,
  init(): void {
    /* rien à préparer */
  },
  add(): void {
    /* pas de formateur nommé à ajouter */
  },
  addCached(): void {
    /* idem */
  },
  format(
    valeur: unknown,
    format: string | undefined,
    lng: string | undefined,
    options: { interpolationkey?: string } | undefined,
  ): unknown {
    if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return valeur
    if (format === 'nombre' || format === 'number') return formaterNombre(valeur, lng)
    if (format === undefined && CLES_NOMBRE.has(options?.interpolationkey ?? ''))
      return formaterNombre(valeur, lng)
    return valeur
  },
}
