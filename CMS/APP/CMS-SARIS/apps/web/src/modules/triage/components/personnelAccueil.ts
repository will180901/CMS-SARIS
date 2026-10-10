/**
 * personnelAccueil — un membre du personnel qui passe à l'accueil pour la première fois.
 *
 * Il n'a pas encore de dossier : celui-ci s'ouvre à partir de sa fiche du personnel.
 * L'accueil ne saisit que ce qui manque à cette fiche (et c'est gardé sur la fiche).
 */

import { dateNaissance as dateNaissanceSchema } from '@/lib/validation'
import type { ChampOuverturePersonnel, OuvrirDossierPersonnelPayload } from '@/modules/patients/api/patients.api'

export interface ComplementsPersonnel {
  dateNaissance: string
  sexe:          '' | 'M' | 'F'
  sectionPaie:   string
  departement:   string
}

export const COMPLEMENTS_VIDES: ComplementsPersonnel = { dateNaissance: '', sexe: '', sectionPaie: '', departement: '' }

export function complementsValides(manquants: ChampOuverturePersonnel[], c: ComplementsPersonnel): boolean {
  return manquants.every(m =>
    m === 'dateNaissance' ? dateNaissanceSchema.safeParse(c.dateNaissance).success
    : m === 'sexe'        ? !!c.sexe
    : !!c[m].trim())
}

/** N'envoie que les champs réellement demandés : le reste vient de la fiche. */
export function complementsVersPayload(
  manquants: ChampOuverturePersonnel[], c: ComplementsPersonnel, siteCreationId: string,
  dossierARelier: string | null = null,
): OuvrirDossierPersonnelPayload {
  return {
    siteCreationId,
    ...(dossierARelier && { dossierExistantId: dossierARelier }),
    ...(manquants.includes('dateNaissance') && { dateNaissance: c.dateNaissance }),
    ...(manquants.includes('sexe') && c.sexe && { sexe: c.sexe }),
    ...(manquants.includes('sectionPaie') && { sectionPaie: c.sectionPaie.trim() }),
    ...(manquants.includes('departement') && { departement: c.departement.trim() }),
  }
}
