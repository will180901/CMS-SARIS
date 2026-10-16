/**
 * La borne de FIN d'une période de rapport est exclusive : le 1er du mois suivant pour un mois
 * entier, « demain » pour « Générer maintenant ». Affichée telle quelle, elle fait lire
 * « 1er → 1er octobre » pour septembre, ou « 17 octobre » un 16.
 *
 * On montre donc le dernier jour réellement couvert : la borne moins 12 heures. Ce n'est pas
 * « moins une milliseconde » : la borne est un minuit du serveur, et dès que l'écran n'est pas dans
 * le même fuseau, un décalage d'une milliseconde laisserait la date inchangée. Douze heures
 * ramènent à la veille quel que soit l'écart de fuseau (moins de douze heures).
 */
export function dernierJourCouvert(periodeFin: string): string {
  return new Date(new Date(periodeFin).getTime() - 12 * 3_600_000).toISOString()
}

/** Dernier jour couvert, au format de date ISO `YYYY-MM-DD` de l'écran (pour les tests et les clés). */
export function dernierJourCouvertISO(periodeFin: string): string {
  const d = new Date(dernierJourCouvert(periodeFin))
  const mois = String(d.getMonth() + 1).padStart(2, '0')
  const jour = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mois}-${jour}`
}
