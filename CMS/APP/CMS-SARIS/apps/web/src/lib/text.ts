/**
 * Normalisation de chaîne pour la RECHERCHE : retire les accents (NFD + signes
 * diacritiques combinants), passe en minuscule, réduit les espaces multiples.
 *
 * Source UNIQUE de vérité — était dupliquée à l'identique dans OrdonnanceCard
 * (recherche médicament) et DiagnosticsCard (recherche pathologie).
 */
export function normaliser(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}
