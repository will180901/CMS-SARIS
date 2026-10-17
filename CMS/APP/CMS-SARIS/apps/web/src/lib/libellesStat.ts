/**
 * Les deux libellés de repli que le serveur écrit lui-même dans les statistiques — « Non précisé » (une
 * consultation sans type) et « Non renseigné » (un employé sans département) — sont affichés dans la
 * langue de l'écran. Tout autre libellé (type, catégorie, département, pathologie : des données saisies
 * par le centre) passe tel quel.
 */
import i18n from '@/i18n/config'

const REPLIS: Record<string, string> = {
  'Non précisé': 'dashboard.nonPrecise',
  'Non renseigné': 'dashboard.nonRenseigne',
}

export function libelleStat(libelle: string): string {
  const cle = REPLIS[libelle]
  return cle ? i18n.t(cle) : libelle
}
