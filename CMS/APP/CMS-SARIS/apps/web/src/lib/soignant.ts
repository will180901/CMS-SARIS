/**
 * Nom affiché d'un soignant, avec le titre qui correspond à SON métier.
 *
 * « Dr. … » était écrit devant tout soignant — y compris l'infirmier qui conduit une
 * consultation déléguée (recueil §3.2). Le titre suit désormais `PersonnelMedical.role`.
 */
import type { TFunction } from 'i18next'

export function nomSoignant(
  s: { nom: string; prenom?: string | null; role?: string | null },
  t: TFunction,
): string {
  const nom = [s.prenom, s.nom].filter(Boolean).join(' ')
  if (s.role === 'MEDECIN' || s.role === 'MEDECIN_CHEF') return t('consultation.doctorPrefix', { name: nom })
  if (s.role === 'INFIRMIER') return t('consultation.nursePrefix', { name: nom })
  if (s.role === 'SAGE_FEMME') return t('consultation.midwifePrefix', { name: nom })
  return nom
}
