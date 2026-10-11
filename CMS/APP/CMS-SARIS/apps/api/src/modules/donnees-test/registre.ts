/**
 * Registre des tables que le générateur écrit : DANS QUEL ORDRE (les parents avant les enfants, à
 * cause des clés étrangères), et QUE RETIRER pour chacune quand on supprime les données de test.
 *
 * Ce qui se retire n'est pas seulement ce qui porte la marque : c'est aussi ce qui en DÉPEND. Une
 * personne qui, en mode test, ajoute une allergie ou ouvre une visite sur un dossier fictif crée une
 * ligne ordinaire (identifiant normal) rattachée à ce dossier — la supprimer avec lui est la seule
 * issue qui n'échoue pas sur une clé étrangère et ne laisse pas d'orphelin. D'où, pour chaque table, un
 * périmètre qui suit les liens jusqu'au dossier patient.
 */
import type { Prisma } from '@prisma/client'
import { FILTRE_MARQUE } from './marque-test'

const M = FILTRE_MARQUE

type Lien = Record<string, unknown>

export interface ModeleTest {
  /** Nom du modèle Prisma. */
  modele: string
  /** Libellé affiché dans le bilan (« Visites », « Constantes vitales »…). */
  libelle: string
  /** Lignes à retirer : la marque, ou un lien (à n'importe quelle profondeur) vers un dossier de test. */
  perimetre: Lien
}

/** « porte la marque, ou appartient à un dossier qui la porte » */
const ouPatient = (chemin: Lien): Lien => ({ OR: [{ id: M }, chemin] })

/**
 * Dans l'ordre d'INSERTION. L'ordre de suppression est l'inverse.
 * Les journaux (audit) et la notification n'ont pas de parent à respecter : en queue.
 */
export const MODELES_TEST: readonly ModeleTest[] = [
  { modele: 'Patient', libelle: 'Dossiers patients', perimetre: { id: M } },
  {
    modele: 'IdentitePatient',
    libelle: 'Identités',
    perimetre: ouPatient({ patientId: M }),
  },
  {
    modele: 'ContactUrgence',
    libelle: 'Contacts d’urgence',
    perimetre: ouPatient({ patientId: M }),
  },
  {
    modele: 'DonneesEmploi',
    libelle: 'Données d’emploi',
    perimetre: ouPatient({ patientId: M }),
  },
  {
    modele: 'ModeViePatient',
    libelle: 'Modes de vie',
    perimetre: ouPatient({ patientId: M }),
  },
  {
    modele: 'AllergiePatient',
    libelle: 'Allergies',
    perimetre: ouPatient({ patientId: M }),
  },
  {
    modele: 'AntecedentPatient',
    libelle: 'Antécédents',
    perimetre: ouPatient({ patientId: M }),
  },
  {
    modele: 'AlerteMedicale',
    libelle: 'Alertes médicales',
    perimetre: ouPatient({ patientId: M }),
  },
  {
    modele: 'HistoriqueCategoriePatient',
    libelle: 'Historiques de catégorie',
    perimetre: ouPatient({ patientId: M }),
  },
  {
    modele: 'RattachementAyantDroitCdi',
    libelle: 'Rattachements d’ayants droit',
    perimetre: ouPatient({ OR: [{ patientId: M }, { cdiId: M }] }),
  },
  {
    modele: 'HistoriqueRattachementAyantDroit',
    libelle: 'Historiques de rattachement (ayants droit)',
    perimetre: ouPatient({
      rattachement: { OR: [{ patientId: M }, { cdiId: M }] },
    }),
  },
  {
    modele: 'RattachementSousTraitant',
    libelle: 'Rattachements de sous-traitants',
    perimetre: ouPatient({ patientId: M }),
  },
  {
    modele: 'HistoriqueRattachementSousTraitant',
    libelle: 'Historiques de rattachement (sous-traitants)',
    perimetre: ouPatient({ rattachement: { patientId: M } }),
  },
  {
    modele: 'Visite',
    libelle: 'Visites',
    perimetre: ouPatient({ patientId: M }),
  },
  {
    modele: 'VisiteEvenement',
    libelle: 'Évènements de visite',
    perimetre: ouPatient({ visite: { patientId: M } }),
  },
  {
    modele: 'ConstanteVitale',
    libelle: 'Constantes vitales',
    perimetre: ouPatient({
      OR: [{ patientId: M }, { visite: { patientId: M } }],
    }),
  },
  {
    modele: 'Consultation',
    libelle: 'Consultations',
    perimetre: ouPatient({ visite: { patientId: M } }),
  },
  {
    modele: 'DiagnosticConsultation',
    libelle: 'Diagnostics',
    perimetre: ouPatient({ consultation: { visite: { patientId: M } } }),
  },
  // ── Journaux : rattachés à un dossier par `entiteId`, sans clé étrangère ──────
  {
    modele: 'JournalAudit',
    libelle: 'Lignes du journal d’audit',
    perimetre: { OR: [{ id: M }, { entiteId: M }] },
  },
  // Jamais fabriquées par le générateur, mais l'application en crée quand on agit sur un dossier de
  // test (« nouveau patient enregistré »…) : elles partent avec lui.
  {
    modele: 'Notification',
    libelle: 'Notifications sur des dossiers de test',
    perimetre: { entiteId: M },
  },
]

/** Table → délégué du client Prisma (« IdentitePatient » → « identitePatient »). */
export function delegue(modele: string): string {
  return modele.charAt(0).toLowerCase() + modele.slice(1)
}

/** Les lignes fabriquées en un jour, rangées par table. */
export type LignesJour = {
  Patient: Prisma.PatientCreateManyInput[]
  IdentitePatient: Prisma.IdentitePatientCreateManyInput[]
  ContactUrgence: Prisma.ContactUrgenceCreateManyInput[]
  DonneesEmploi: Prisma.DonneesEmploiCreateManyInput[]
  ModeViePatient: Prisma.ModeViePatientCreateManyInput[]
  AllergiePatient: Prisma.AllergiePatientCreateManyInput[]
  AntecedentPatient: Prisma.AntecedentPatientCreateManyInput[]
  AlerteMedicale: Prisma.AlerteMedicaleCreateManyInput[]
  HistoriqueCategoriePatient: Prisma.HistoriqueCategoriePatientCreateManyInput[]
  RattachementAyantDroitCdi: Prisma.RattachementAyantDroitCdiCreateManyInput[]
  HistoriqueRattachementAyantDroit: Prisma.HistoriqueRattachementAyantDroitCreateManyInput[]
  RattachementSousTraitant: Prisma.RattachementSousTraitantCreateManyInput[]
  HistoriqueRattachementSousTraitant: Prisma.HistoriqueRattachementSousTraitantCreateManyInput[]
  Visite: Prisma.VisiteCreateManyInput[]
  VisiteEvenement: Prisma.VisiteEvenementCreateManyInput[]
  ConstanteVitale: Prisma.ConstanteVitaleCreateManyInput[]
  Consultation: Prisma.ConsultationCreateManyInput[]
  DiagnosticConsultation: Prisma.DiagnosticConsultationCreateManyInput[]
  JournalAudit: Prisma.JournalAuditCreateManyInput[]
}

export type NomTable = keyof LignesJour

export function lignesVides(): LignesJour {
  return {
    Patient: [],
    IdentitePatient: [],
    ContactUrgence: [],
    DonneesEmploi: [],
    ModeViePatient: [],
    AllergiePatient: [],
    AntecedentPatient: [],
    AlerteMedicale: [],
    HistoriqueCategoriePatient: [],
    RattachementAyantDroitCdi: [],
    HistoriqueRattachementAyantDroit: [],
    RattachementSousTraitant: [],
    HistoriqueRattachementSousTraitant: [],
    Visite: [],
    VisiteEvenement: [],
    ConstanteVitale: [],
    Consultation: [],
    DiagnosticConsultation: [],
    JournalAudit: [],
  }
}

/** Ajoute à `cumul` les lignes de `jour`. */
export function cumuler(cumul: Record<string, number>, jour: LignesJour): void {
  for (const m of MODELES_TEST) {
    const n = (jour as Record<string, unknown[]>)[m.modele]?.length ?? 0
    if (n) cumul[m.modele] = (cumul[m.modele] ?? 0) + n
  }
}
