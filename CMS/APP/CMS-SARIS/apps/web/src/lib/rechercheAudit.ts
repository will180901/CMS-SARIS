/**
 * Recherche dans le journal d'audit, par ce que l'écran AFFICHE.
 *
 * Le journal stocke des codes (CREATE, BonExamen, ECHEC_MOT_DE_PASSE) que l'écran montre en libellés
 * (« Création », « Bon d'examen », « Mot de passe incorrect ») : taper « création » ne trouvait rien, seul
 * « create » marchait. Chaque mot tapé est donc élargi aux codes dont le libellé, dans la langue de l'écran,
 * le contient — « création » devient « création|=CREATE » — et le serveur cherche l'un OU l'autre
 * (« = » : le code exact, une seule condition côté serveur, au lieu d'un « contient » par code).
 * Les mots restent liés par ET, comme avant.
 */
import i18n from '@/i18n/config'

export interface CodeLibelle { code: string; libelle: string }

/** Au plus ce nombre de codes ajoutés à un mot (le serveur borne la saisie entière). */
const MAX_CODES_PAR_MOT = 6

const sansAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Élargit chaque mot de `saisie` aux codes dont le libellé le contient (accents et casse ignorés).
 * Le mot tapé reste la première variante ; une espace d'un code est écrite en espace insécable, car l'espace
 * sépare les mots côté serveur.
 */
export function etendreRecherche(saisie: string, codes: CodeLibelle[]): string {
  return saisie
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((mot) => {
      const cherche = sansAccent(mot)
      // un mot d'une lettre trouverait presque tout : on ne l'élargit pas
      if (cherche.length < 2) return mot
      const variantes = [mot]
      for (const { code, libelle } of codes) {
        if (variantes.length > MAX_CODES_PAR_MOT) break
        if (sansAccent(libelle).includes(cherche) && sansAccent(code) !== cherche) variantes.push('=' + code.replace(/ /g, '\u00a0'))
      }
      return variantes.join('|')
    })
    .join(' ')
}

type Onglet = 'actions' | 'authentifications'

function entrees(dico: unknown): CodeLibelle[] {
  return dico && typeof dico === 'object'
    ? Object.entries(dico as Record<string, unknown>)
        .filter(([, v]) => typeof v === 'string')
        .map(([code, libelle]) => ({ code, libelle: libelle as string }))
    : []
}

/** Les codes que le journal affiche en libellés, selon l'onglet, dans la langue de l'écran. */
export function codesDeLOnglet(onglet: Onglet): CodeLibelle[] {
  const labels = (i18n.getResourceBundle(i18n.language, 'translation') as { labels?: Record<string, unknown> } | undefined)?.labels ?? {}
  const statut = (labels['statut'] ?? {}) as Record<string, unknown>
  return onglet === 'actions'
    ? [...entrees(labels['action']), ...entrees(labels['module']), ...entrees(labels['entite'])]
    : [...entrees(statut['auth_result']), ...entrees(statut['generique'])]
}

/** La saisie telle qu'elle part au serveur. */
export function rechercheAudit(saisie: string, onglet: Onglet): string {
  return saisie.trim() ? etendreRecherche(saisie, codesDeLOnglet(onglet)) : ''
}
