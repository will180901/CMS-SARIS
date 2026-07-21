/**
 * Cohérence des permissions : « écrire implique consulter ».
 *
 * Un droit d'écriture SANS le droit de lecture correspondant est un droit MORT :
 * l'utilisateur ne voit ni la liste ni la fiche (403 sur le GET), donc il n'atteint
 * jamais le formulaire. La case cochée dans la matrice ne lui apporte rien, tout en
 * laissant croire à l'administrateur qu'il a accordé quelque chose.
 *
 * L'interface applique la même règle en direct (cocher « Créer » coche « Consulter »).
 * Ce fichier la REJOUE côté serveur pour qu'un appel HTTP direct — hors interface —
 * ne puisse pas installer une configuration incohérente.
 *
 * Résolution de la lecture impliquée par un code (structurelle : aucune table à tenir) :
 *   `module.action`      → `module.read`
 *   `module.sous.action` → `module.sous.read` s'il existe, sinon `module.read`
 *   `module.sous.read`   → `module.read`  (accès au module parent, ex. Référentiels)
 * Appliquée en chaîne : referentiel.site.create → referentiel.site.read → referentiel.read
 *
 * ⚠️ MIROIR de `packages/types/src/permissions.ts` (PERMISSION_LECTURES_IMPLIQUEES,
 * completerLectures, completerRevocations). L'API ne peut pas value-importer
 * `@cms-saris/types` (cf. `common/governance.ts`) : toute évolution de la règle doit
 * être faite des deux côtés. Le catalogue n'est PAS dupliqué ici — il est passé en
 * paramètre, lu en base, ce qui garde une source unique pour la liste des codes.
 */

/** Lecture directement impliquée par un code, ou null s'il n'y en a pas. */
function lectureDirecte(code: string, catalogue: ReadonlySet<string>): string | null {
  const segments = code.split('.')
  const action = segments[segments.length - 1]!

  if (segments.length >= 3) {
    if (action !== 'read') {
      const sous = `${segments[0]}.${segments[1]}.read`
      if (catalogue.has(sous)) return sous
    }
    // Sous-entité sans lecture propre (ex. patient.rattachement.manage) ou lecture
    // de sous-entité (ex. referentiel.site.read) → on remonte au module parent.
    const module = `${segments[0]}.read`
    return module !== code && catalogue.has(module) ? module : null
  }

  if (action === 'read') return null
  const module = `${segments[0]}.read`
  return catalogue.has(module) ? module : null
}

/** Toutes les lectures impliquées par un code (chaîne complète, code exclu). */
export function chaineDeLectures(code: string, catalogue: ReadonlySet<string>): string[] {
  const out: string[] = []
  const vus = new Set<string>([code])
  let courant = lectureDirecte(code, catalogue)
  while (courant && !vus.has(courant)) {
    vus.add(courant)
    out.push(courant)
    courant = lectureDirecte(courant, catalogue)
  }
  return out
}

/** Lectures impliquées par l'ensemble mais absentes de celui-ci. */
export function lecturesManquantes(
  codes: readonly string[],
  catalogue: ReadonlySet<string>,
): string[] {
  const presents = new Set<string>(codes)
  const out = new Set<string>()
  for (const code of codes) {
    for (const lecture of chaineDeLectures(code, catalogue)) {
      if (!presents.has(lecture)) out.add(lecture)
    }
  }
  return [...out]
}

/**
 * Ensemble complété avec toutes les lectures impliquées (sens « on ACCORDE »).
 * Utilisé pour la matrice d'un rôle et pour les dérogations GRANT.
 */
export function completerLectures(
  codes: readonly string[],
  catalogue: ReadonlySet<string>,
): string[] {
  return [...new Set([...codes, ...lecturesManquantes(codes, catalogue)])]
}

/**
 * Ensemble étendu à tout ce qui en dépend (sens « on RETIRE »).
 * Utilisé pour les dérogations REVOKE : retirer une lecture rend inutilisables toutes
 * les écritures du même périmètre, on les retire donc aussi plutôt que de laisser des
 * droits morts. On ne réaccorde JAMAIS une lecture explicitement révoquée : l'action
 * la plus récente de l'administrateur fait foi.
 */
export function completerRevocations(
  codes: readonly string[],
  catalogue: ReadonlySet<string>,
): string[] {
  const out = new Set<string>(codes)
  for (const candidat of catalogue) {
    if (out.has(candidat)) continue
    const chaine = chaineDeLectures(candidat, catalogue)
    if (chaine.some((lecture) => codes.includes(lecture))) out.add(candidat)
  }
  return [...out]
}
