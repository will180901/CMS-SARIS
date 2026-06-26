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
