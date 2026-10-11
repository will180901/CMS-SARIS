/**
 * Ce qui se prescrit, s'examine et se décide à la suite d'une consultation, profil clinique par
 * profil clinique : traitements, examens demandés, évacuation, suivi de traitement, suivi chronique,
 * et les phrases qui les accompagnent.
 *
 * Les médicaments sont désignés par leur NOM GÉNÉRIQUE (le référentiel du centre n'a pas de code) :
 * un médicament absent de la liste du centre est simplement écarté, et une prescription dont le
 * médicament principal manque ne se fait pas. Les types d'examen sont désignés par leur code.
 *
 * Les phrases sont écrites pour que les écrans aient un contenu crédible ; ce ne sont pas des
 * recommandations médicales.
 */
import type { PoidsParCode } from './catalogue-clinique'

/** Une ligne d'ordonnance. */
export interface LigneTraitement {
  /** Nom générique du médicament. */
  medicament: string
  posologie: string
  duree: string
  /** Voie d'administration, dans les termes de la liste de l'application. */
  voie: string
  quantite?: string
  instructions?: string
  /** Probabilité d'être prescrite avec la ligne principale (1 par défaut). La PREMIÈRE ligne est la principale. */
  proba?: number
}

/** Un traitement complet : la ligne principale, éventuellement des lignes d'accompagnement. */
export interface SchemaTraitement {
  poids: number
  /** Âge (années révolues) des patients concernés. */
  ages?: readonly [number, number]
  /** Pour une maladie suivie : ne s'applique qu'à ce contrôle. */
  niveau?: 'equilibre' | 'desequilibre'
  lignes: readonly LigneTraitement[]
}

export interface ExamensPrescrits {
  /** Probabilité qu'une prescription d'examens soit faite à cette consultation. */
  proba: number
  /** [code du type d'examen, probabilité qu'il soit demandé] — au moins un est toujours demandé. */
  examens: PoidsParCode
  /** Indication clinique ; {j} = jours d'évolution. */
  indication: string
}

export interface EvacuationType {
  /** Probabilité, parmi les consultations de ce profil. */
  proba: number
  /** Niveaux d'urgence possibles : [niveau, poids]. */
  urgence: PoidsParCode
  /** Raison de l'évacuation (une phrase). */
  raisons: readonly string[]
}

export interface SuiviTraitementType {
  proba: number
  motif: string
  /** Durée prévue de l'épisode, en jours. */
  jours: readonly [number, number]
  /** Nombre de fiches de suivi prévues. */
  fiches: readonly [number, number]
  /** La personne a besoin de ses constantes à chaque fiche. */
  constantes?: boolean
}

export interface SuiviChroniqueType {
  /** [fréquence, poids] — dans les termes de la liste de l'application. */
  frequences: PoidsParCode
  objectifs: readonly string[]
}

export interface PrescriptionProfil {
  medicaments?: { proba: number; schemas: readonly SchemaTraitement[] }
  examens?: ExamensPrescrits
  evacuation?: EvacuationType
  suivi?: SuiviTraitementType
  chronique?: SuiviChroniqueType
}

const PO = 'PO (oral)'
const INHALATION = 'Inhalation'

/** Le paracétamol, présent dans presque toutes les ordonnances de fièvre ou de douleur. */
const paracetamolAdulte = (
  duree: string,
  quantite: string,
  proba = 1,
): LigneTraitement => ({
  medicament: 'Paracétamol',
  posologie: '1 comprimé de 1 g, 3 fois par jour si fièvre ou douleur',
  duree,
  voie: PO,
  quantite,
  proba,
})
const paracetamolEnfant = (duree: string, proba = 1): LigneTraitement => ({
  medicament: 'Paracétamol',
  posologie: '15 mg par kg, 3 fois par jour si fièvre (sirop)',
  duree,
  voie: PO,
  quantite: '1 flacon',
  proba,
})

export const PRESCRIPTIONS: Readonly<Record<string, PrescriptionProfil>> = {
  PALUDISME: {
    medicaments: {
      proba: 0.97,
      schemas: [
        {
          poids: 1,
          ages: [15, 120],
          lignes: [
            {
              medicament: 'Arteméther + Luméfantrine',
              posologie: '4 comprimés le matin et 4 le soir',
              duree: '3 jours',
              voie: PO,
              quantite: '24 comprimés',
              instructions: 'À prendre pendant un repas ou avec du lait.',
            },
            paracetamolAdulte('3 jours', '9 comprimés', 0.9),
          ],
        },
        {
          poids: 1,
          ages: [5, 14],
          lignes: [
            {
              medicament: 'Arteméther + Luméfantrine',
              posologie: '2 comprimés le matin et 2 le soir',
              duree: '3 jours',
              voie: PO,
              quantite: '12 comprimés',
              instructions: 'À écraser dans un peu d’eau pour les plus jeunes.',
            },
            paracetamolEnfant('3 jours', 0.9),
          ],
        },
        {
          poids: 1,
          ages: [0, 4],
          lignes: [
            {
              medicament: 'Arteméther + Luméfantrine',
              posologie: '1 comprimé le matin et 1 le soir',
              duree: '3 jours',
              voie: PO,
              quantite: '6 comprimés',
              instructions: 'À écraser dans un peu d’eau.',
            },
            paracetamolEnfant('3 jours', 0.95),
          ],
        },
      ],
    },
    examens: {
      proba: 0.85,
      examens: [
        ['PALUDISME_TDR', 1],
        ['NFS', 0.25],
      ],
      indication: 'Fièvre depuis {j} jours : recherche d’un paludisme.',
    },
    evacuation: {
      proba: 0.008,
      urgence: [
        ['HAUTE', 55],
        ['CRITIQUE', 35],
        ['MOYENNE', 10],
      ],
      raisons: [
        'Paludisme grave avec signes neurologiques : prise en charge en réanimation.',
        'Paludisme avec vomissements incoercibles et déshydratation sévère : perfusion et surveillance continue.',
      ],
    },
    suivi: {
      proba: 0.04,
      motif:
        'Surveillance d’un paludisme avec vomissements : contrôle de la fièvre et de la tolérance du traitement.',
      jours: [2, 4],
      fiches: [2, 3],
      constantes: true,
    },
  },

  INFECTION_RESPIRATOIRE: {
    medicaments: {
      proba: 0.95,
      schemas: [
        {
          poids: 3,
          ages: [15, 120],
          lignes: [
            {
              medicament: 'Amoxicilline',
              posologie: '2 gélules de 500 mg, matin et soir',
              duree: '7 jours',
              voie: PO,
              quantite: '28 gélules',
              instructions: 'À prendre en début de repas.',
            },
            paracetamolAdulte('5 jours', '15 comprimés', 0.85),
          ],
        },
        {
          poids: 1,
          ages: [15, 120],
          lignes: [
            {
              medicament: 'Cotrimoxazole',
              posologie: '2 comprimés de 480 mg, matin et soir',
              duree: '7 jours',
              voie: PO,
              quantite: '28 comprimés',
              instructions: 'Boire beaucoup d’eau pendant le traitement.',
            },
            paracetamolAdulte('5 jours', '15 comprimés', 0.8),
          ],
        },
        {
          poids: 1,
          ages: [0, 14],
          lignes: [
            {
              medicament: 'Amoxicilline',
              posologie: '25 mg par kg, 2 fois par jour (sirop)',
              duree: '7 jours',
              voie: PO,
              quantite: '1 flacon',
            },
            paracetamolEnfant('5 jours', 0.9),
          ],
        },
      ],
    },
    examens: {
      proba: 0.4,
      examens: [
        ['RADIO_THORAX', 1],
        ['NFS', 0.3],
      ],
      indication:
        'Toux et fièvre depuis {j} jours : recherche d’une atteinte pulmonaire.',
    },
    evacuation: {
      proba: 0.015,
      urgence: [
        ['HAUTE', 60],
        ['CRITIQUE', 25],
        ['MOYENNE', 15],
      ],
      raisons: [
        'Détresse respiratoire avec saturation basse : oxygénothérapie et hospitalisation.',
        'Pneumopathie sévère ne répondant pas au traitement ambulatoire.',
      ],
    },
    suivi: {
      proba: 0.06,
      motif:
        'Suivi d’une pneumopathie sous antibiotique : contrôle clinique à 48 h.',
      jours: [4, 8],
      fiches: [2, 4],
      constantes: true,
    },
  },

  HTA: {
    medicaments: {
      proba: 0.9,
      schemas: [
        {
          poids: 1,
          niveau: 'equilibre',
          lignes: [
            {
              medicament: 'Amlodipine',
              posologie: '1 comprimé de 5 mg le matin',
              duree: '30 jours',
              voie: PO,
              quantite: '30 comprimés',
              instructions: 'Traitement à poursuivre sans interruption.',
            },
          ],
        },
        {
          poids: 1,
          niveau: 'desequilibre',
          lignes: [
            {
              medicament: 'Amlodipine',
              posologie: '1 comprimé de 10 mg le matin',
              duree: '30 jours',
              voie: PO,
              quantite: '30 comprimés',
              instructions:
                'Dose augmentée : contrôle de la tension dans un mois.',
            },
          ],
        },
        {
          poids: 1,
          lignes: [
            {
              medicament: 'Amlodipine',
              posologie: '1 comprimé de 5 mg le matin',
              duree: '30 jours',
              voie: PO,
              quantite: '30 comprimés',
            },
          ],
        },
      ],
    },
    examens: {
      proba: 0.18,
      examens: [
        ['GLYCEMIE', 1],
        ['URINE_BU', 0.3],
        ['TENSION_ARTERIELLE', 0.25],
      ],
      indication: 'Bilan d’un patient hypertendu suivi.',
    },
    evacuation: {
      proba: 0.008,
      urgence: [
        ['HAUTE', 60],
        ['CRITIQUE', 40],
      ],
      raisons: [
        'Urgence hypertensive avec céphalées intenses et troubles visuels.',
      ],
    },
    suivi: {
      proba: 0.05,
      motif:
        'Contrôle de la tension artérielle après adaptation du traitement.',
      jours: [10, 28],
      fiches: [3, 4],
      constantes: true,
    },
    chronique: {
      frequences: [
        ['Mensuel', 60],
        ['Trimestriel', 40],
      ],
      objectifs: [
        'Maintenir la tension artérielle sous 140/90 mmHg.',
        'Tension artérielle sous 130/80 mmHg et traitement pris sans interruption.',
        'Contrôler la tension et limiter le sel dans l’alimentation.',
      ],
    },
  },

  DIABETE: {
    medicaments: {
      proba: 0.9,
      schemas: [
        {
          poids: 1,
          niveau: 'equilibre',
          lignes: [
            {
              medicament: 'Metformine',
              posologie:
                '1 comprimé de 850 mg, matin et soir pendant les repas',
              duree: '30 jours',
              voie: PO,
              quantite: '60 comprimés',
            },
          ],
        },
        {
          poids: 1,
          niveau: 'desequilibre',
          lignes: [
            {
              medicament: 'Metformine',
              posologie:
                '1 comprimé de 850 mg, matin, midi et soir pendant les repas',
              duree: '30 jours',
              voie: PO,
              quantite: '90 comprimés',
              instructions: 'Dose augmentée : revoir la glycémie dans un mois.',
            },
          ],
        },
        {
          poids: 1,
          lignes: [
            {
              medicament: 'Metformine',
              posologie:
                '1 comprimé de 850 mg, matin et soir pendant les repas',
              duree: '30 jours',
              voie: PO,
              quantite: '60 comprimés',
            },
          ],
        },
      ],
    },
    examens: {
      proba: 0.4,
      examens: [
        ['GLYCEMIE', 1],
        ['URINE_BU', 0.4],
      ],
      indication: 'Contrôle de l’équilibre du diabète.',
    },
    evacuation: {
      proba: 0.01,
      urgence: [
        ['HAUTE', 55],
        ['CRITIQUE', 45],
      ],
      raisons: [
        'Décompensation du diabète avec acidocétose suspectée : hospitalisation.',
      ],
    },
    suivi: {
      proba: 0.05,
      motif: 'Surveillance de la glycémie après adaptation du traitement.',
      jours: [10, 28],
      fiches: [3, 4],
      constantes: true,
    },
    chronique: {
      frequences: [
        ['Mensuel', 70],
        ['Trimestriel', 30],
      ],
      objectifs: [
        'Glycémie à jeun inférieure à 1,26 g/L.',
        'Équilibrer la glycémie : régime adapté et traitement pris sans interruption.',
        'Prévenir les complications : surveiller les pieds, les yeux et les reins.',
      ],
    },
  },

  GASTRO_ENTERITE: {
    medicaments: {
      proba: 0.92,
      schemas: [
        {
          poids: 1,
          lignes: [
            {
              medicament: 'Sels de réhydratation orale',
              posologie:
                '1 sachet dilué dans 1 litre d’eau, à boire par petites gorgées après chaque selle liquide',
              duree: '3 jours',
              voie: PO,
              quantite: '9 sachets',
            },
            paracetamolAdulte('3 jours', '9 comprimés', 0.4),
          ],
        },
      ],
    },
    examens: {
      proba: 0.06,
      examens: [['NFS', 1]],
      indication: 'Diarrhée avec déshydratation : bilan sanguin.',
    },
    evacuation: {
      proba: 0.006,
      urgence: [
        ['HAUTE', 70],
        ['CRITIQUE', 30],
      ],
      raisons: [
        'Déshydratation sévère nécessitant une réhydratation intraveineuse.',
      ],
    },
    suivi: {
      proba: 0.05,
      motif: 'Surveillance de l’hydratation sous réhydratation orale.',
      jours: [2, 3],
      fiches: [2, 3],
      constantes: true,
    },
  },

  TRAUMATISME: {
    medicaments: {
      proba: 0.9,
      schemas: [
        {
          poids: 3,
          ages: [15, 120],
          lignes: [
            {
              medicament: 'Ibuprofène',
              posologie:
                '1 comprimé de 400 mg, 3 fois par jour pendant les repas',
              duree: '5 jours',
              voie: PO,
              quantite: '15 comprimés',
            },
            paracetamolAdulte('5 jours', '15 comprimés', 0.7),
            {
              medicament: 'Oméprazole',
              posologie: '1 gélule de 20 mg le matin à jeun',
              duree: '5 jours',
              voie: PO,
              quantite: '5 gélules',
              proba: 0.3,
            },
          ],
        },
        {
          poids: 1,
          ages: [0, 14],
          lignes: [paracetamolEnfant('5 jours')],
        },
      ],
    },
    evacuation: {
      proba: 0.03,
      urgence: [
        ['MOYENNE', 30],
        ['HAUTE', 50],
        ['CRITIQUE', 20],
      ],
      raisons: [
        'Suspicion de fracture nécessitant une radiographie et une prise en charge orthopédique.',
        'Plaie profonde avec lésion probable d’un tendon : avis chirurgical.',
        'Traumatisme crânien avec perte de connaissance initiale : scanner cérébral.',
      ],
    },
    suivi: {
      proba: 0.04,
      motif:
        'Suivi d’une plaie : surveillance du pansement et de la cicatrisation.',
      jours: [6, 14],
      fiches: [2, 4],
    },
  },

  ANEMIE: {
    medicaments: {
      proba: 0.9,
      schemas: [
        {
          poids: 1,
          lignes: [
            {
              medicament: 'Acide folique',
              posologie: '1 comprimé de 5 mg par jour',
              duree: '30 jours',
              voie: PO,
              quantite: '30 comprimés',
            },
          ],
        },
      ],
    },
    examens: {
      proba: 0.9,
      examens: [['NFS', 1]],
      indication:
        'Pâleur et fatigue depuis {j} jours : recherche d’une anémie.',
    },
    evacuation: {
      proba: 0.015,
      urgence: [
        ['HAUTE', 70],
        ['CRITIQUE', 30],
      ],
      raisons: ['Anémie sévère mal tolérée : transfusion à envisager.'],
    },
    suivi: {
      proba: 0.06,
      motif: 'Contrôle de l’anémie sous supplémentation.',
      jours: [14, 30],
      fiches: [2, 3],
      constantes: true,
    },
  },

  ASTHME: {
    medicaments: {
      proba: 0.8,
      schemas: [
        {
          poids: 1,
          lignes: [
            {
              medicament: 'Salbutamol',
              posologie:
                '2 bouffées en cas de crise, 4 fois par jour au maximum',
              duree: '30 jours',
              voie: INHALATION,
              quantite: '1 flacon',
              instructions: 'Rincer la bouche après chaque utilisation.',
            },
          ],
        },
      ],
    },
    examens: {
      proba: 0.05,
      examens: [['RADIO_THORAX', 1]],
      indication:
        'Crises répétées : radiographie à la recherche d’une complication.',
    },
    evacuation: {
      proba: 0.03,
      urgence: [
        ['HAUTE', 60],
        ['CRITIQUE', 40],
      ],
      raisons: ['Crise d’asthme sévère ne cédant pas au traitement.'],
    },
    chronique: {
      frequences: [
        ['Trimestriel', 70],
        ['Mensuel', 30],
      ],
      objectifs: [
        'Réduire la fréquence des crises et éviter les facteurs déclenchants.',
        'Vérifier la bonne utilisation de l’inhalateur à chaque contrôle.',
      ],
    },
  },

  DREPANOCYTOSE: {
    medicaments: {
      proba: 0.9,
      schemas: [
        {
          poids: 1,
          lignes: [
            {
              medicament: 'Acide folique',
              posologie: '1 comprimé de 5 mg par jour',
              duree: '30 jours',
              voie: PO,
              quantite: '30 comprimés',
            },
            paracetamolAdulte('5 jours', '15 comprimés', 0.7),
          ],
        },
      ],
    },
    examens: {
      proba: 0.5,
      examens: [
        ['NFS', 1],
        ['URINE_BU', 0.2],
      ],
      indication: 'Contrôle d’un patient drépanocytaire.',
    },
    evacuation: {
      proba: 0.05,
      urgence: [
        ['HAUTE', 55],
        ['CRITIQUE', 45],
      ],
      raisons: [
        'Crise vaso-occlusive hyperalgique résistante aux antalgiques : hospitalisation.',
        'Syndrome thoracique aigu suspecté : prise en charge en milieu hospitalier.',
      ],
    },
    suivi: {
      proba: 0.06,
      motif:
        'Suivi après une crise douloureuse : contrôle de la douleur et de la tolérance.',
      jours: [3, 10],
      fiches: [2, 3],
      constantes: true,
    },
    chronique: {
      frequences: [
        ['Trimestriel', 70],
        ['Mensuel', 30],
      ],
      objectifs: [
        'Prévenir les crises : bonne hydratation, supplémentation en acide folique.',
        'Surveiller le taux d’hémoglobine et la croissance chez l’enfant.',
      ],
    },
  },

  TUBERCULOSE: {
    examens: {
      proba: 0.7,
      examens: [
        ['RADIO_THORAX', 1],
        ['NFS', 0.3],
      ],
      indication:
        'Toux prolongée depuis {j} jours avec amaigrissement : recherche d’une tuberculose pulmonaire.',
    },
    evacuation: {
      proba: 0.015,
      urgence: [
        ['HAUTE', 70],
        ['CRITIQUE', 30],
      ],
      raisons: [
        'Hémoptysie abondante : prise en charge dans un centre spécialisé.',
      ],
    },
    suivi: {
      proba: 0.2,
      motif:
        'Suivi du traitement antituberculeux : prises supervisées et poids.',
      jours: [30, 60],
      fiches: [3, 5],
      constantes: true,
    },
  },

  VIH_SUIVI: {
    medicaments: {
      proba: 0.85,
      schemas: [
        {
          poids: 1,
          lignes: [
            {
              medicament: 'Cotrimoxazole',
              posologie: '1 comprimé de 480 mg par jour',
              duree: '30 jours',
              voie: PO,
              quantite: '30 comprimés',
              instructions: 'Prophylaxie des infections : ne pas interrompre.',
            },
          ],
        },
      ],
    },
    examens: {
      proba: 0.35,
      examens: [['NFS', 1]],
      indication: 'Bilan de suivi.',
    },
    suivi: {
      proba: 0.08,
      motif: 'Suivi de la tolérance du traitement et de l’observance.',
      jours: [14, 30],
      fiches: [2, 3],
      constantes: true,
    },
    chronique: {
      frequences: [
        ['Mensuel', 60],
        ['Trimestriel', 40],
      ],
      objectifs: [
        'Observance du traitement et suivi de la charge virale.',
        'Prévenir les infections opportunistes.',
      ],
    },
  },

  GROSSESSE: {
    medicaments: {
      proba: 0.85,
      schemas: [
        {
          poids: 1,
          lignes: [
            {
              medicament: 'Acide folique',
              posologie: '1 comprimé de 5 mg par jour',
              duree: '30 jours',
              voie: PO,
              quantite: '30 comprimés',
            },
            paracetamolAdulte('3 jours', '9 comprimés', 0.15),
          ],
        },
      ],
    },
    examens: {
      proba: 0.55,
      examens: [
        ['ECHO_ABDO', 0.7],
        ['URINE_BU', 0.6],
        ['NFS', 0.5],
        ['GLYCEMIE', 0.2],
      ],
      indication: 'Suivi de grossesse : bilan de la consultation prénatale.',
    },
    evacuation: {
      proba: 0.015,
      urgence: [
        ['HAUTE', 60],
        ['CRITIQUE', 40],
      ],
      raisons: [
        'Saignements au troisième trimestre : prise en charge obstétricale urgente.',
        'Pré-éclampsie suspectée (tension élevée, céphalées) : hospitalisation.',
      ],
    },
    suivi: {
      proba: 0.03,
      motif:
        'Surveillance d’une grossesse à risque : tension, poids et mouvements du fœtus.',
      jours: [14, 30],
      fiches: [2, 4],
      constantes: true,
    },
  },

  DERMATOLOGIE: {
    medicaments: {
      proba: 0.8,
      schemas: [
        {
          poids: 1,
          lignes: [
            {
              medicament: 'Cétirizine',
              posologie: '1 comprimé de 10 mg le soir',
              duree: '7 jours',
              voie: PO,
              quantite: '7 comprimés',
            },
          ],
        },
      ],
    },
  },

  CARDIOPATHIE: {
    medicaments: {
      proba: 0.9,
      schemas: [
        {
          poids: 1,
          lignes: [
            {
              medicament: 'Amlodipine',
              posologie: '1 comprimé de 5 mg le matin',
              duree: '30 jours',
              voie: PO,
              quantite: '30 comprimés',
            },
          ],
        },
      ],
    },
    examens: {
      proba: 0.45,
      examens: [
        ['TENSION_ARTERIELLE', 0.5],
        ['RADIO_THORAX', 0.5],
        ['NFS', 0.2],
      ],
      indication: 'Contrôle d’une cardiopathie suivie.',
    },
    evacuation: {
      proba: 0.03,
      urgence: [
        ['HAUTE', 55],
        ['CRITIQUE', 45],
      ],
      raisons: [
        'Décompensation cardiaque avec œdème aigu du poumon : hospitalisation en urgence.',
        'Douleur thoracique avec troubles du rythme : avis cardiologique urgent.',
      ],
    },
    suivi: {
      proba: 0.08,
      motif:
        'Surveillance d’une insuffisance cardiaque : poids, tension et œdèmes.',
      jours: [10, 30],
      fiches: [3, 4],
      constantes: true,
    },
    chronique: {
      frequences: [
        ['Trimestriel', 60],
        ['Mensuel', 40],
      ],
      objectifs: [
        'Surveiller le poids et les œdèmes, limiter le sel.',
        'Équilibrer le traitement et contrôler régulièrement la tension.',
      ],
    },
  },
}

/** Ce qu'on prescrit quand le centre a ses propres diagnostics (profil neutre) : de quoi soulager. */
export const PRESCRIPTION_NEUTRE: PrescriptionProfil = {
  medicaments: {
    proba: 0.5,
    schemas: [
      {
        poids: 1,
        ages: [15, 120],
        lignes: [paracetamolAdulte('3 jours', '9 comprimés')],
      },
      { poids: 1, ages: [0, 14], lignes: [paracetamolEnfant('3 jours')] },
    ],
  },
}

// ── Les phrases ───────────────────────────────────────────────────────────────

export const MOTIFS_ANNULATION_BON_PHARMACIE: readonly string[] = [
  'Le patient a acheté ses médicaments à l’extérieur.',
  'Bon établi par erreur.',
  'Patient transféré avant la délivrance.',
]

export const MOTIFS_CORRECTION_RESULTAT: readonly string[] = [
  'Erreur de saisie de la valeur.',
  'Résultat transcrit sur le mauvais examen, corrigé.',
  'Valeur confirmée après contrôle du laboratoire.',
]

export const MOTIFS_ANNULATION_EVACUATION: readonly string[] = [
  'Le patient s’est stabilisé : évacuation jugée non nécessaire.',
  'Évacuation refusée par la famille.',
  'Prise en charge assurée sur place après avis du médecin chef.',
]

export const NOTES_SUIVI_EVACUATION: Readonly<
  Record<'EN_COURS' | 'EN_TRANSPORT' | 'ADMIS' | 'CLOTURE', readonly string[]>
> = {
  EN_COURS: [
    'Ambulance demandée ; patient surveillé au centre en attendant le départ.',
    'Établissement d’accueil prévenu par téléphone ; dossier remis à l’accompagnant.',
    'Voie veineuse posée, constantes surveillées toutes les 15 minutes avant le départ.',
  ],
  EN_TRANSPORT: [
    'Départ du centre en ambulance, accompagné d’un infirmier.',
    'Transfert en cours ; état stable pendant le trajet.',
    'Départ avec un membre de la famille ; lettre de liaison remise.',
  ],
  ADMIS: [
    'Patient admis aux urgences de l’établissement d’accueil.',
    'Prise en charge confirmée par l’équipe d’accueil.',
    'Hospitalisation décidée à l’arrivée ; famille informée.',
  ],
  CLOTURE: [
    'Évacuation clôturée : prise en charge confirmée par l’établissement d’accueil.',
    'Dossier clôturé après retour de la lettre de sortie.',
    'Patient hospitalisé ; suite du suivi assurée par l’établissement.',
  ],
}

export const MOTIFS_CLOTURE_SUIVI: readonly string[] = [
  'Guérison clinique, plus de signes à l’examen.',
  'Fin du traitement prévu ; évolution favorable.',
  'Contrôle satisfaisant ; reprise des activités habituelles.',
  'Objectif du suivi atteint.',
]

export const MOTIFS_ANNULATION_SUIVI: readonly string[] = [
  'Suivi ouvert par erreur.',
  'Suivi ouvert sur le mauvais dossier.',
  'Suivi inutile : une consultation de contrôle suffit.',
]

export const MOTIFS_ARRET_TRAITEMENT: readonly string[] = [
  'Effet indésirable : nausées et vomissements.',
  'Traitement arrêté à la demande du médecin après amélioration.',
  'Intolérance digestive.',
  'Inefficacité constatée au contrôle.',
]

export const MOTIFS_CLOTURE_CHRONIQUE: readonly string[] = [
  'Patient transféré vers un autre centre.',
  'Suivi repris par le médecin traitant du patient.',
]

/** Notes d'évolution des fiches de suivi, selon l'avancement de l'épisode. */
export const NOTES_FICHE: Readonly<
  Record<'DEBUT' | 'MILIEU' | 'FIN', readonly string[]>
> = {
  DEBUT: [
    'État général conservé ; traitement bien toléré. Surveillance poursuivie.',
    'Patient fatigué mais stable ; consignes rappelées à l’accompagnant.',
    'Première fiche du suivi : constantes prises, traitement expliqué.',
  ],
  MILIEU: [
    'Amélioration progressive ; le patient dit se sentir mieux.',
    'Évolution lente mais favorable ; traitement poursuivi.',
    'Pas de nouvelle plainte ; observance correcte.',
    'Légère gêne digestive sous traitement, sans gravité.',
  ],
  FIN: [
    'Évolution favorable, constantes normalisées.',
    'Patient en bonne forme ; fin du suivi proposée.',
    'Guérison clinique, pas de signe d’alerte.',
  ],
}

export const DOSES_ADMINISTRATION: readonly string[] = [
  '1 prise',
  'Dose habituelle',
  '1 comprimé',
  'Dose du jour',
]

export const LABORATOIRES: Readonly<Record<string, string | null>> = {
  BIOLOGIE: 'Laboratoire du centre',
  IMAGERIE: 'Imagerie — centre partenaire',
  SPECIALISE: null,
}

/**
 * Allergie → médicaments à éviter par précaution clinique (même famille). Les clés sont des noms
 * « ramenés à leurs lettres » (sans accents ni casse), comme `cleMedicament`.
 */
export const ALLERGIES_CROISEES: Readonly<Record<string, readonly string[]>> = {
  penicilline: ['amoxicilline'],
  amoxicilline: ['amoxicilline'],
  aspirine: ['ibuprofene'],
  ibuprofene: ['ibuprofene'],
  sulfamides: ['cotrimoxazole'],
}
