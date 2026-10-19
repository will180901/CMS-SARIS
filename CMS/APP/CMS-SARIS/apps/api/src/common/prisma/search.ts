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

/**
 * Les VARIANTES d'un mot de recherche : « création|=CREATE » se cherche comme « création » (contient) OU comme
 * le code exact « CREATE ».
 *
 * Le journal d'audit stocke des CODES (CREATE, BonExamen) que l'écran affiche en LIBELLÉS (« Création »,
 * « Bon d'examen ») : la saisie « création » ne correspond à aucun code. Le client, qui connaît les libellés de la
 * langue de l'écran, ajoute au mot tapé les codes qui le portent, précédés de « = » ; le serveur reste générique.
 *
 * - la PREMIÈRE variante est le mot tapé : toujours « contient », même si elle commence par « = » ;
 * - les suivantes préfixées par « = » sont des codes EXACTS (comparés en une seule condition `in`, bien moins
 *   chère qu'un « contient » par code : 7 codes en « contient » coûtaient près de 9 s sur 54 000 lignes) ;
 * - une espace insécable (U+00A0) représente une espace du code (« Bon d'examen »), car l'espace sépare les mots ;
 * - au plus 25 variantes ; un mot réduit à des barres (« | ») se cherche tel quel.
 */
export function variantes(mot: string): { contient: string[]; exacts: string[] } {
  const net = (v: string) => v.replace(/\u00a0/g, ' ').trim()
  const brut = mot.split('|').slice(0, 25)
  const contient: string[] = []
  const exacts: string[] = []
  brut.forEach((v, i) => {
    const n = net(v)
    if (!n) return
    if (i > 0 && n.startsWith('=')) {
      const code = n.slice(1).trim()
      if (code) exacts.push(code)
    } else contient.push(n)
  })
  return contient.length || exacts.length ? { contient, exacts } : { contient: [mot], exacts: [] }
}
