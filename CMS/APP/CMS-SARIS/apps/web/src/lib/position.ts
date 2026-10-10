/**
 * Relevé de position par le navigateur. Deux usages :
 *  1. situer un POSTE de travail, une fois, à son installation (sur demande de
 *     l'administrateur) ;
 *  2. situer l'APPAREIL d'une connexion web, à chaque connexion, en arrière-plan
 *     (décision du centre, 2026-10-10 : « il faut qu'on trace bien les activités ») —
 *     cf. components/PositionConnexion.tsx.
 *
 * CE QUE ÇA VAUT. Le navigateur n'a pas toujours de GPS : sur un téléphone, il en a
 * un (précision ~10 m) ; sur un portable, il déduit la position des bornes Wi-Fi
 * environnantes (quelques dizaines à quelques centaines de mètres) ; sur un poste
 * fixe en Ethernet sans Wi-Fi, il retombe sur l'adresse IP et la marge se compte en
 * kilomètres. C'est pourquoi la marge annoncée (`precisionM`) est TOUJOURS conservée
 * et affichée : une position sans sa marge laisse croire à une exactitude qu'elle n'a pas.
 *
 * CE QUE ÇA N'EST PAS. Une preuve : la position vient de l'appareil, qui peut la
 * falsifier. Elle TRACE (avec sa marge d'erreur, toujours conservée) ; l'adresse IP
 * constatée par le serveur, elle, reste la seule donnée que le client ne fabrique pas.
 * Et ce n'est pas un suivi : un seul relevé par connexion.
 */

export interface PositionRelevee {
  latitude: number
  longitude: number
  /** Marge annoncée par le navigateur, en mètres. */
  precisionM: number
}

/** Code d'échec exploitable par l'appelant pour choisir son message. */
export type EchecPosition =
  | 'non_supporte'
  | 'refuse'
  | 'indisponible'
  | 'delai_depasse'

export class ErreurPosition extends Error {
  readonly code: EchecPosition

  constructor(code: EchecPosition) {
    super(code)
    this.name = 'ErreurPosition'
    this.code = code
  }
}

/**
 * Demande la position au navigateur. La permission est demandée par le navigateur
 * lui-même : nous ne pouvons ni la contourner, ni la redemander après un refus —
 * l'utilisateur doit alors la rétablir dans les réglages de son navigateur.
 *
 * `enableHighAccuracy` : on accepte d'attendre un peu et de solliciter le GPS quand
 * il existe ; c'est un relevé unique, pas un suivi continu, donc le coût en batterie
 * n'a pas d'importance ici.
 */
export function releverPosition(timeoutMs = 15_000, precise = true): Promise<PositionRelevee> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new ErreurPosition('non_supporte'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precisionM: Math.round(pos.coords.accuracy),
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new ErreurPosition('refuse'))
        else if (err.code === err.TIMEOUT) reject(new ErreurPosition('delai_depasse'))
        else reject(new ErreurPosition('indisponible'))
      },
      { enableHighAccuracy: precise, timeout: timeoutMs, maximumAge: 0 },
    )
  })
}

/** État de l'autorisation de position, SANS déclencher l'invite du navigateur. */
export async function etatPermissionPosition(): Promise<'granted' | 'prompt' | 'denied' | 'inconnu'> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'inconnu'
    return (await navigator.permissions.query({ name: 'geolocation' })).state
  } catch {
    return 'inconnu'
  }
}

/** Clé i18n du message à afficher pour un échec donné. */
export function messageErreurPosition(e: unknown): string {
  const code = e instanceof ErreurPosition ? e.code : 'indisponible'
  return `admin.postePosition.echec.${code}`
}
