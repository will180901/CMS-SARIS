/**
 * Recherche insensible à la casse — compatible PostgreSQL (serveur) ET SQLite (backend
 * embarqué desktop).
 *
 * `mode: 'insensitive'` est une option PostgreSQL-ONLY : le moteur SQLite la REJETTE
 * (« Unknown argument `mode` »). Or SQLite fait déjà un `LIKE` insensible à la casse
 * (ASCII) par défaut. On injecte donc `mode: 'insensitive'` uniquement hors SQLite.
 *
 * Usage : `{ nom: { contains: q, ...CI } }` au lieu de `{ nom: { contains: q, mode: 'insensitive' } }`.
 *
 * NB : évalué une fois au chargement du module — `DATABASE_PROVIDER` est figé au démarrage
 * du process (postgresql pour le serveur, sqlite pour le backend embarqué).
 */
export const CI: { mode?: 'insensitive' } =
  process.env['DATABASE_PROVIDER'] === 'sqlite' ? {} : { mode: 'insensitive' }

/**
 * Recherche PAR MOTS d'une personne : « Jean Dupont » (ou « Dupont Jean ») trouve celui dont
 * le prénom contient « Jean » ET le nom « Dupont ». Chaque mot doit se retrouver dans l'un
 * des champs proposés par `champsPourUnMot`, dans n'importe quel ordre.
 *
 * Avant, la saisie ENTIÈRE devait tenir dans UN SEUL champ : un nom complet ne trouvait
 * personne (« Aucun patient trouvé » devant un patient qui existe), et il fallait deviner
 * qu'on ne tape qu'un mot. Pour un seul mot, le résultat est inchangé.
 *
 * Usage : `where: { ...parMots(q, (mot) => [{ nom: { contains: mot, ...CI } }, …]) }`.
 */
export function parMots<C>(
  recherche: string | undefined | null,
  champsPourUnMot: (mot: string) => C[],
): { AND?: { OR: C[] }[] } {
  const mots = (recherche ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 6) // au-delà, la saisie n'est plus un nom
  return mots.length
    ? { AND: mots.map((mot) => ({ OR: champsPourUnMot(mot) })) }
    : {}
}
