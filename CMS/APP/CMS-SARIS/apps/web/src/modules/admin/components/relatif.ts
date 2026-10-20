/**
 * Aides d'affichage partagées par la page Synchronisation et la fiche d'un poste.
 */

import i18n from '@/i18n/config'
import { labelEntite } from '@/config/labels'

/**
 * Au-delà, un poste qui ne donne plus signe de vie est signalé « à surveiller ».
 * « À surveiller » n'est pas « hors ligne » : un poste éteint la nuit est normal. C'est le
 * silence PROLONGÉ d'une machine qui devrait travailler qui mérite l'alerte — d'où un seuil
 * en heures plutôt qu'en minutes.
 */
export const SEUIL_MUET_MS = 2 * 60 * 60 * 1000

/** « il y a 5 min » — texte relatif d'une date, dans la langue active. */
export function relative(d: Date | string | null | undefined): string {
  if (!d) return i18n.t('admin.relativeNever')
  const t = typeof d === 'string' ? new Date(d).getTime() : d.getTime()
  const diff = (Date.now() - t) / 1000
  if (diff < 10)     return i18n.t('admin.relativeNow')
  if (diff < 60)     return i18n.t('admin.relativeSeconds', { count: Math.floor(diff) })
  if (diff < 3600)   return i18n.t('admin.relativeMinutes', { count: Math.floor(diff / 60) })
  if (diff < 86400)  return i18n.t('admin.relativeHours', { count: Math.floor(diff / 3600) })
  return i18n.t('admin.relativeDays', { count: Math.floor(diff / 86400) })
}

/**
 * Nom lisible d'un modèle synchronisé : « IdentitePatient » → « Identité patient ».
 *
 * Les noms de modèles sont en CamelCase. Ceux qui sont répertoriés dans les libellés
 * d'entités passent par la traduction ; un modèle encore inconnu est au moins séparé en
 * mots (« LigneBonPharmacie » → « Ligne bon pharmacie ») plutôt que collé en un seul.
 */
export function libelleEntite(type: string): string {
  if (!type) return ''
  if (i18n.exists(`labels.entite.${type}`)) return labelEntite(type)
  const mots = type.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return mots.charAt(0).toUpperCase() + mots.slice(1)
}

export type EtatPoste = 'ligne' | 'horsligne' | 'attention' | 'suspendu'

/**
 * État d'un poste, tel que la supervision le dit partout (cartes, tableau d'activité, fiche) :
 *  - suspendu : un administrateur a coupé ses échanges. Cet état l'emporte sur les autres : un
 *    poste suspendu qui se tait n'est pas « à surveiller », son silence est voulu ;
 *  - en ligne : il a donné signe de vie il y a moins de 90 secondes ;
 *  - à surveiller : son silence n'a pas d'explication normale — muet depuis des heures, ou
 *    enregistré mais jamais synchronisé ;
 *  - hors ligne : simplement éteint ou fermé, un fonctionnement attendu (le soir, un site
 *    fermé) — ce n'est PAS un incident.
 *
 * `maintenant` est passé par l'appelant : lire l'horloge ici rendrait le rendu impur.
 */
export function etatDuPoste(
  p: { enLigne: boolean; derniereSyncAt: string | null; suspendu?: boolean },
  maintenant: number,
): EtatPoste {
  if (p.suspendu) return 'suspendu'
  if (p.enLigne) return 'ligne'
  if (!p.derniereSyncAt) return 'attention'
  return maintenant - new Date(p.derniereSyncAt).getTime() > SEUIL_MUET_MS ? 'attention' : 'horsligne'
}

/** Teinte et libellé (clé i18n) de la pastille d'état d'un poste — la même partout. */
export const PASTILLE_ETAT: Record<EtatPoste, { tone: 'success' | 'neutral' | 'warning'; cle: string }> = {
  ligne:     { tone: 'success', cle: 'admin.supOnline' },
  horsligne: { tone: 'neutral', cle: 'admin.supOffline' },
  attention: { tone: 'warning', cle: 'admin.supFilterAttention' },
  suspendu:  { tone: 'warning', cle: 'admin.supEtatSuspendu' },
}
