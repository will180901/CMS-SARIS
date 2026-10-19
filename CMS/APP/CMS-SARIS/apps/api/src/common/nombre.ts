/**
 * Un nombre dans un texte composé par le serveur : « 1 234 », « 54 502 ».
 *
 * L'interface met une espace insécable ordinaire entre les milliers (pas l'espace fine d'`Intl`, presque
 * invisible) : un texte écrit ici — qui s'affiche tel quel à l'écran — suit la même règle. Un entier est
 * arrondi ; au-dessous de 1 000 rien n'est inséré.
 */
export function nombreFr(n: number): string {
  const entier = Math.round(n)
  const signe = entier < 0 ? '-' : ''
  return signe + String(Math.abs(entier)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}
