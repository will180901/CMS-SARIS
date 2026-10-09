/**
 * donneesEmploye — ce qu'on sait d'une personne du centre en tant qu'EMPLOYÉ de
 * la SARIS, sous la forme qu'utilisent les formulaires (cf. ChampsEmploye).
 */

import { dateNaissance as dateNaissanceSchema } from '@/lib/validation'
import type { PersonnelMedical, PersonnelPayload, TypeContratPersonnel } from '@/modules/acteurs/api/personnel.api'

/** Service d'un membre du personnel quand rien d'autre n'est précisé : le centre. */
export const SERVICE_CMS = 'Centre Médico-Sanitaire'

export interface DonneesEmploye {
  dateNaissance: string            // yyyy-MM-dd, '' = non renseignée
  sexe:          '' | 'M' | 'F'
  typeContrat:   TypeContratPersonnel
  sectionPaie:   string
  service:       string
  departement:   string
}

export function employeDepuisFiche(p?: Partial<PersonnelMedical> | null): DonneesEmploye {
  return {
    dateNaissance: p?.dateNaissance ? p.dateNaissance.slice(0, 10) : '',
    sexe:          p?.sexe ?? '',
    typeContrat:   p?.typeContrat ?? 'CDI',
    sectionPaie:   p?.sectionPaie ?? '',
    service:       p?.service || SERVICE_CMS,
    departement:   p?.departement ?? '',
  }
}

export function naissanceValide(v: string) {
  return dateNaissanceSchema.safeParse(v).success
}

/** Tout ce qu'il faut pour ouvrir son dossier patient sans ressaisie. */
export function employeComplet(d: DonneesEmploye): boolean {
  return naissanceValide(d.dateNaissance) && !!d.sexe
    && !!d.sectionPaie.trim() && !!d.service.trim() && !!d.departement.trim()
}

/** Une date saisie mais incorrecte bloque l'enregistrement, même si le reste est facultatif. */
export function employeCoherent(d: DonneesEmploye): boolean {
  return !d.dateNaissance || naissanceValide(d.dateNaissance)
}

export function employeVersPayload(d: DonneesEmploye): Partial<PersonnelPayload> {
  return {
    dateNaissance: d.dateNaissance || null,
    sexe:          d.sexe || null,
    typeContrat:   d.typeContrat,
    sectionPaie:   d.sectionPaie.trim(),
    service:       d.service.trim() || SERVICE_CMS,
    departement:   d.departement.trim(),
  }
}

export function employeModifie(a: DonneesEmploye, b: DonneesEmploye): boolean {
  return (Object.keys(a) as (keyof DonneesEmploye)[]).some(k => a[k] !== b[k])
}
