/**
 * CguGate — porte d'acceptation des Conditions d'utilisation.
 *
 * Monté dans la zone AUTHENTIFIÉE. Si l'utilisateur n'a pas accepté la version
 * courante des CGU (champ serveur `cguAJour === false`), affiche la charte en
 * mode BLOQUANT : il doit l'accepter pour continuer. L'acceptation est tracée
 * côté serveur (date + version) puis les préférences sont rafraîchies.
 */
import { ConditionsModal } from './ConditionsModal'
import { useMyPreferences, useAcceptCgu } from '@/modules/admin/hooks/useAdmin'

export function CguGate() {
  const { data: pref } = useMyPreferences()
  const accept = useAcceptCgu()

  // N'affiche qu'une fois les préférences chargées ET les CGU non à jour.
  if (!pref || pref.cguAJour !== false) return null

  return (
    <ConditionsModal
      open
      onClose={() => { /* bloquant : pas de fermeture sans acceptation */ }}
      onAccept={() => accept.mutate()}
      accepting={accept.isPending}
    />
  )
}
