/**
 * API du système : son MODE (production / test).
 *
 * Le mode ne change ni les données ni leur stockage : il avertit tout le monde (bandeau orange) et
 * ouvre des outils réservés à l'administrateur. Même base dans les deux cas.
 */
import { api } from '@/lib/api'

export type ModeSysteme = 'PRODUCTION' | 'TEST'

export interface EtatModeSysteme {
  /** Mode EFFECTIF : celui que le système applique et affiche. */
  mode: ModeSysteme
  /** Le serveur interdit le mode Test (verrou de mise en service, posé à l'hébergement). */
  verrouille: boolean
  /** Ce système peut-il changer de mode ? Non sur un poste de bureau : il suit le serveur central. */
  modifiable: boolean
  /** Depuis quand le mode Test est actif, et par qui — renseignés seulement alors. */
  depuis: string | null
  parNom: string | null
}

export const systemeApi = {
  /** Lisible par tout utilisateur connecté : c'est ce qui fait le bandeau chez tout le monde. */
  mode: () => api.get<EtatModeSysteme>('/systeme/mode'),
  /** Droit `systeme.mode` ET mot de passe redemandé : un mot de passe faux répond 403. */
  changerMode: (mode: ModeSysteme, motDePasse: string) =>
    api.put<EtatModeSysteme>('/systeme/mode', { mode, motDePasse }),
}
