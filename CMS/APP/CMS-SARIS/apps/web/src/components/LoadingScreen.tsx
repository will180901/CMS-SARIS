/**
 * Écran de chargement NEUTRE affiché pendant l'hydratation de la session (lecture du
 * stockage persistant : sessionStorage côté web, coffre DPAPI côté desktop). Évite le
 * FLASH de l'écran de connexion qui apparaissait avant que `isAuthenticated` soit connu.
 */
export function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div
        className="h-9 w-9 animate-spin rounded-full border-[3px] border-muted border-t-primary"
        role="status"
        aria-label="Chargement"
      />
    </div>
  )
}
