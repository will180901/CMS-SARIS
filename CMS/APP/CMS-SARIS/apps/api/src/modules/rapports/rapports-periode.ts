/**
 * Une période est PARTIELLE quand elle est nettement plus courte que celle d'avant (le mois en
 * cours, du 1er à aujourd'hui, face à un mois entier) ou qu'elle court encore. La comparer à la
 * précédente fausserait la lecture : elle paraîtrait toujours en chute (« -39 % » le 16 du mois).
 * La borne de fin est exclusive ; « Générer maintenant » la pose à demain minuit, ce qui inclut
 * aujourd'hui sans que la période soit « en cours » : on tolère donc un jour d'avance.
 */
export function periodeEstPartielle(
  debut: Date,
  fin: Date,
  precedente: { debut: Date; fin: Date },
  maintenant: Date = new Date(),
): boolean {
  const duree = fin.getTime() - debut.getTime()
  const dureePrecedente = precedente.fin.getTime() - precedente.debut.getTime()
  const plusCourte = dureePrecedente > 0 && duree < dureePrecedente * 0.85
  const encoreEnCours = fin.getTime() > maintenant.getTime() + 86_400_000
  return plusCourte || encoreEnCours
}
