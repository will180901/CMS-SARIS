/**
 * Purge du cache quand une permission de lecture est retirée.
 *
 * `invalidateQueries()` ne suffit pas : il marque les données comme périmées et
 * relance les requêtes ACTIVES. Or un hook devenu `enabled: false` ne relance rien —
 * ses données restent donc dans le cache, intactes et lisibles par n'importe quel
 * composant qui appelle le même hook. Un référentiel dont on vient de retirer la
 * lecture continuerait à s'afficher jusqu'au rechargement de la page.
 *
 * `removeQueries()` les efface pour de bon. C'est la différence entre « ne plus
 * rafraîchir » et « ne plus détenir ».
 *
 * Ne couvre que les données de RÉFÉRENTIEL, seules à être chargées globalement et
 * réutilisées loin de leur écran d'origine (la liste des médicaments sert aussi à
 * prescrire, celle des pathologies à diagnostiquer). Les données cliniques, elles,
 * sont déjà cloisonnées par leur propre écran.
 */
import type { QueryClient } from '@tanstack/react-query'
import type { PermissionCode } from '@cms-saris/types'

/** Permission de lecture → préfixes de clés de cache à effacer si elle disparaît. */
const CACHE_PAR_PERMISSION: Partial<Record<PermissionCode, readonly (readonly unknown[])[]>> = {
  'referentiel.site.read':              [['referentiels', 'sites']],
  'referentiel.motif.read':             [['referentiels', 'motifs']],
  'referentiel.pathologie.read':        [['referentiels', 'pathologies']],
  'referentiel.medicament.read':        [['referentiels', 'medicaments']],
  // `categories` couvre aussi ['referentiels','categories','droits'] (préfixe commun).
  'referentiel.categorie.read':         [['referentiels', 'categories']],
  'referentiel.examen.read':            [['referentiels', 'examens']],
  'referentiel.type_consultation.read': [['referentiels', 'types-consultation']],
  'sous_traitant.read':                 [['sous-traitants']],
  'employe.read':                       [['employes']],
}

/**
 * Efface du cache tout ce que l'utilisateur n'a plus le droit de lire.
 * Appelé après un renouvellement de session ayant changé les permissions.
 */
export function purgerCachePermissionsPerdues(
  queryClient: QueryClient,
  avant: readonly string[],
  apres: readonly string[],
): void {
  const detenues = new Set(apres)
  for (const perm of avant) {
    if (detenues.has(perm)) continue
    const cles = CACHE_PAR_PERMISSION[perm as PermissionCode]
    if (!cles) continue
    for (const queryKey of cles) queryClient.removeQueries({ queryKey })
  }
}
