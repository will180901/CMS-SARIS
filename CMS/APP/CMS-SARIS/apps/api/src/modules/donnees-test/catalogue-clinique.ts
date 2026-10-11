/**
 * Profils cliniques : ce que viennent chercher les patients et comment cela se passe, de l'accueil
 * à la conclusion du médecin.
 *
 * Un profil relie un MOTIF d'accueil, un DIAGNOSTIC (code de la liste de référence du centre), des
 * constantes vitales plausibles et des CAS : chaque cas est un récit COMPLET et cohérent — ce que
 * dit l'infirmier à l'accueil, l'histoire racontée au médecin, l'examen et la conclusion. On tire un
 * cas entier, jamais une phrase de chaque colonne (une plaie de la main ne finit pas en « entorse de
 * la cheville »). Les codes (motifs, pathologies, types de consultation) sont ceux du référentiel
 * livré avec le système : un profil dont le diagnostic n'existe pas dans le référentiel du centre est
 * simplement écarté.
 *
 * Les phrases sont écrites pour que les écrans aient un contenu crédible ; ce ne sont pas des
 * recommandations médicales.
 */

/** [code, poids ou probabilité selon l'usage]. */
export type PoidsParCode = readonly (readonly [string, number])[]

export interface Gaussienne {
  moyenne: number
  ecartType: number
  min: number
  max: number
}

/** Ce qu'un profil change aux constantes d'une personne en bonne santé. */
export interface ModifConstantes {
  temperature?: Gaussienne
  tensionSystolique?: Gaussienne
  tensionDiastolique?: Gaussienne
  frequenceCardiaque?: Gaussienne
  frequenceRespiratoire?: Gaussienne
  saturationO2?: Gaussienne
  glycemie?: Gaussienne
  /** Constante systématiquement prise pour ce profil (diabète : la glycémie). */
  glycemieSystematique?: boolean
  hydratation?: readonly (readonly [string, number])[]
  coloration?: readonly (readonly [string, number])[]
  etatGeneral?: readonly (readonly [string, number])[]
}

/** Un récit complet : de la phrase de l'infirmier à la conclusion du médecin. {j} = jours d'évolution. */
export interface CasClinique {
  /** Ce que l'infirmier note à l'accueil. */
  notes: string
  /** L'histoire racontée au médecin (anamnèse). */
  symptomes: string
  /** L'examen clinique. */
  examen: string
  conclusion: string
  modeDebut?: string
  /** Maladie suivie : ce cas décrit un contrôle équilibré ou non. */
  niveau?: 'equilibre' | 'desequilibre'
}

export interface ProfilClinique {
  code: string
  /** Fréquence relative parmi les passages. */
  poids: number
  /** Code du diagnostic principal (liste de référence des pathologies). */
  pathologie: string
  /** Diagnostics associés possibles : [code, probabilité 0–1]. */
  associes?: PoidsParCode
  /** Motifs d'accueil qui mènent à ce profil : [code, poids]. */
  motifs: PoidsParCode
  sexe?: 'M' | 'F'
  /** Âge (en années) des personnes concernées. */
  ages?: readonly [number, number]
  /** Maladie qui se suit : la personne revient régulièrement. */
  chronique?: boolean
  /** Multiplicateur du poids en saison des pluies. */
  pluies?: number
  constantes: ModifConstantes
  /** Durée de la consultation, en minutes. */
  dureeConsultation: readonly [number, number]
  /** Évolution avant la venue, en jours — remplace {j} dans les phrases. */
  jours: readonly [number, number]
  cas: readonly CasClinique[]
  /** Pour une maladie suivie : le contrôle est-il équilibré, d'après les constantes prises ? */
  niveau?: (c: {
    tensionSystolique: number | null
    tensionDiastolique: number | null
    glycemie: number | null
  }) => 'equilibre' | 'desequilibre' | null
  /** Arrêt de travail : probabilité et nombre de jours. */
  repos?: { proba: number; jours: readonly [number, number] }
  /** Peut être un accident du travail (type de consultation dédié). */
  travail?: boolean
  /** Diagnostic évident à l'examen (traumatisme, grossesse…) : presque toujours « confirmé ». */
  diagnosticCertain?: boolean
}

const g = (
  moyenne: number,
  ecartType: number,
  min: number,
  max: number,
): Gaussienne => ({
  moyenne,
  ecartType,
  min,
  max,
})

export const PROFILS_CLINIQUES: readonly ProfilClinique[] = [
  {
    code: 'PALUDISME',
    poids: 22,
    pluies: 1.45,
    pathologie: 'PALUDISME',
    associes: [['ANEMIE', 0.06]],
    motifs: [
      ['PALUDISME_SUSPECT', 52],
      ['FIEVRE_FORTE', 36],
      ['CONSULTATION_GENERALE', 12],
    ],
    constantes: {
      temperature: g(38.9, 0.65, 37.6, 40.6),
      frequenceCardiaque: g(98, 11, 72, 135),
      frequenceRespiratoire: g(20, 3, 14, 30),
      saturationO2: g(97, 1.3, 92, 100),
      etatGeneral: [
        ['Bon', 55],
        ['Altéré', 42],
        ['Mauvais', 3],
      ],
      hydratation: [
        ['Normale', 85],
        ['Déshydratation modérée', 14],
        ['Déshydratation sévère', 1],
      ],
      coloration: [
        ['Normale', 82],
        ['Pâleur', 16],
        ['Ictère', 2],
      ],
    },
    dureeConsultation: [10, 19],
    jours: [1, 6],
    repos: { proba: 0.45, jours: [2, 3] },
    cas: [
      {
        notes: 'Fièvre et maux de tête depuis {j} jours.',
        symptomes:
          'Fièvre depuis {j} jours avec frissons, céphalées et courbatures.',
        examen:
          'Patient fébrile, asthénique. Conjonctives légèrement pâles. Abdomen souple, pas d’hépatosplénomégalie. Pas de signe de gravité.',
        conclusion:
          'Paludisme simple. Antipaludique oral prescrit, hydratation abondante et repos. Reconsulter si la fièvre persiste au-delà de 48 heures.',
        modeDebut: 'Brutal',
      },
      {
        notes: 'Fièvre, frissons et courbatures depuis {j} jours.',
        symptomes:
          'Fièvre intermittente, sueurs nocturnes, asthénie et douleurs articulaires depuis {j} jours.',
        examen:
          'Fièvre confirmée à l’examen, faciès fatigué, pas de raideur de nuque. Auscultation pulmonaire normale. Abdomen souple.',
        conclusion:
          'Accès palustre non compliqué. Traitement ambulatoire, antipyrétique en cas de fièvre. Revoir en cas d’aggravation.',
        modeDebut: 'Progressif',
      },
      {
        notes: 'Vient pour une fièvre persistante depuis {j} jours.',
        symptomes:
          'Fièvre élevée, vomissements, perte d’appétit et maux de tête depuis {j} jours.',
        examen:
          'Patient algique et fébrile, bien hydraté, pas de signe neurologique. Rate non palpable.',
        conclusion:
          'Paludisme probable, bien toléré. Traitement antipaludique et antalgique. Conseils de prévention : moustiquaire imprégnée.',
        modeDebut: 'Brutal',
      },
      {
        notes: 'Frissons et fièvre.',
        symptomes:
          'Frissons et fièvre, sans toux ni diarrhée, évoluant depuis {j} jours.',
        examen:
          'Température élevée, sueurs profuses, examen cardio-pulmonaire normal. Abdomen souple et indolore.',
        conclusion:
          'Accès palustre simple. Antipaludique oral, antalgique, repos et boissons abondantes.',
        modeDebut: 'Brutal',
      },
    ],
  },
  {
    code: 'INFECTION_RESPIRATOIRE',
    poids: 9,
    pluies: 1.35,
    pathologie: 'PNEUMONIE',
    associes: [['ASTHME', 0.04]],
    motifs: [
      ['DIFFICULTES_RESPI', 52],
      ['FIEVRE_FORTE', 20],
      ['CONSULTATION_GENERALE', 28],
    ],
    constantes: {
      temperature: g(38.3, 0.7, 36.9, 40.2),
      frequenceCardiaque: g(100, 12, 74, 140),
      frequenceRespiratoire: g(26, 4, 18, 38),
      saturationO2: g(94, 2.6, 84, 99),
      etatGeneral: [
        ['Bon', 50],
        ['Altéré', 45],
        ['Mauvais', 5],
      ],
    },
    dureeConsultation: [14, 25],
    jours: [2, 10],
    repos: { proba: 0.5, jours: [3, 5] },
    cas: [
      {
        notes: 'Toux et fièvre depuis {j} jours.',
        symptomes:
          'Toux productive depuis {j} jours, fièvre et douleur thoracique à l’inspiration.',
        examen:
          'Polypnée modérée. Râles crépitants à la base droite. Fièvre. Saturation légèrement diminuée.',
        conclusion:
          'Infection respiratoire basse. Antibiotique oral, antipyrétique, hydratation. Contrôle sous 72 heures, ou avant en cas de gêne respiratoire.',
        modeDebut: 'Progressif',
      },
      {
        notes: 'Gêne respiratoire et toux depuis {j} jours.',
        symptomes:
          'Toux grasse, essoufflement à l’effort et fièvre depuis {j} jours.',
        examen:
          'Fièvre, toux fréquente. Auscultation : sous-crépitants bilatéraux. Pas de signe de détresse respiratoire.',
        conclusion:
          'Pneumopathie probable, état général conservé. Traitement ambulatoire ; radiographie si absence d’amélioration.',
        modeDebut: 'Progressif',
      },
      {
        notes: 'Toux grasse, fatigue, fièvre.',
        symptomes:
          'Toux persistante, expectorations jaunâtres et gêne respiratoire depuis {j} jours.',
        examen:
          'Pas de tirage. Murmure vésiculaire diminué à gauche, quelques râles ronflants.',
        conclusion:
          'Bronchopneumopathie aiguë non compliquée. Repos et traitement symptomatique.',
        modeDebut: 'Brutal',
      },
    ],
  },
  {
    code: 'HTA',
    poids: 13,
    pathologie: 'HTA',
    motifs: [
      ['HYPERTENSION_CONTROLE', 65],
      ['SUIVI_CHRONIQUE', 25],
      ['CONSULTATION_GENERALE', 10],
    ],
    ages: [35, 85],
    chronique: true,
    constantes: {
      tensionSystolique: g(152, 19, 118, 210),
      tensionDiastolique: g(94, 11, 72, 126),
      frequenceCardiaque: g(80, 9, 58, 108),
      etatGeneral: [
        ['Bon', 92],
        ['Altéré', 8],
      ],
    },
    niveau: (c) =>
      c.tensionSystolique === null
        ? null
        : c.tensionSystolique >= 150 || (c.tensionDiastolique ?? 0) >= 95
          ? 'desequilibre'
          : 'equilibre',
    dureeConsultation: [8, 15],
    jours: [1, 20],
    cas: [
      {
        niveau: 'equilibre',
        notes: 'Contrôle de la tension.',
        symptomes: 'Contrôle tensionnel de routine, asymptomatique.',
        examen:
          'Bon état général, auscultation cardiaque normale, pouls régulier.',
        conclusion:
          'HTA équilibrée, bonne observance. Poursuite du traitement.',
      },
      {
        niveau: 'equilibre',
        notes: 'Vient pour le renouvellement et le contrôle tensionnel.',
        symptomes:
          'Palpitations occasionnelles ; traitement habituel pris régulièrement.',
        examen:
          'Tension correcte sous traitement, bruits du cœur réguliers, pas d’œdème.',
        conclusion:
          'Hypertension artérielle suivie et bien contrôlée. Traitement poursuivi, régime pauvre en sel. Prochain contrôle dans un mois.',
      },
      {
        niveau: 'desequilibre',
        notes: 'Céphalées et tension élevée.',
        symptomes:
          'Céphalées matinales et vertiges, tension élevée relevée à domicile.',
        examen:
          'Tension artérielle élevée à la prise, bruits du cœur réguliers, pas d’œdème des membres inférieurs.',
        conclusion:
          'HTA insuffisamment contrôlée : ajustement du traitement et mesures hygiéno-diététiques. Revoir dans 15 jours.',
      },
      {
        niveau: 'desequilibre',
        notes: 'Maux de tête, bourdonnements d’oreille.',
        symptomes:
          'Bourdonnements d’oreille et céphalées occipitales depuis {j} jours.',
        examen:
          'Tension élevée de façon persistante. Pas de signe d’insuffisance cardiaque.',
        conclusion:
          'Poussée hypertensive modérée sans signe de gravité. Traitement renforcé, contrôle tensionnel rapproché.',
      },
    ],
  },
  {
    code: 'DIABETE',
    poids: 7,
    pathologie: 'DIABETE_TYPE2',
    associes: [['HTA', 0.25]],
    motifs: [
      ['SUIVI_CHRONIQUE', 72],
      ['CONSULTATION_GENERALE', 28],
    ],
    ages: [38, 85],
    chronique: true,
    constantes: {
      glycemie: g(1.75, 0.55, 0.8, 4.3),
      glycemieSystematique: true,
      tensionSystolique: g(138, 15, 110, 190),
      tensionDiastolique: g(85, 9, 65, 110),
      etatGeneral: [
        ['Bon', 90],
        ['Altéré', 10],
      ],
    },
    niveau: (c) =>
      c.glycemie === null
        ? null
        : c.glycemie >= 1.4
          ? 'desequilibre'
          : 'equilibre',
    dureeConsultation: [10, 18],
    jours: [1, 14],
    cas: [
      {
        niveau: 'equilibre',
        notes: 'Suivi du diabète.',
        symptomes:
          'Suivi du diabète ; glycémies capillaires correctes, traitement pris régulièrement.',
        examen: 'Pas de plaie du pied, sensibilité conservée. Poids stable.',
        conclusion:
          'Diabète équilibré. Traitement inchangé, glycémie de contrôle dans un mois.',
      },
      {
        niveau: 'desequilibre',
        notes: 'Soif et fatigue.',
        symptomes: 'Soif intense et polyurie depuis {j} jours.',
        examen:
          'Légère prise de poids. Examen général sans particularité ; pieds normaux.',
        conclusion:
          'Diabète déséquilibré : conseils diététiques renforcés et ajustement du traitement. Contrôle rapproché.',
      },
      {
        niveau: 'desequilibre',
        notes: 'Contrôle de la glycémie.',
        symptomes:
          'Fatigue, vision floue intermittente ; glycémies élevées à jeun.',
        examen: 'Examen cardio-pulmonaire normal. Pas de signe d’hypoglycémie.',
        conclusion:
          'Diabète de type 2 insuffisamment contrôlé. Poursuite de la metformine, régime et activité physique, bilan à prévoir.',
      },
    ],
  },
  {
    code: 'GASTRO_ENTERITE',
    poids: 10,
    pluies: 1.1,
    pathologie: 'GASTROENTERITE',
    motifs: [
      ['DIARRHEE', 55],
      ['DOULEUR_ABDOMINALE', 45],
    ],
    constantes: {
      temperature: g(37.6, 0.55, 36.5, 39.4),
      frequenceCardiaque: g(92, 10, 66, 126),
      hydratation: [
        ['Normale', 55],
        ['Déshydratation modérée', 38],
        ['Déshydratation sévère', 7],
      ],
      etatGeneral: [
        ['Bon', 62],
        ['Altéré', 35],
        ['Mauvais', 3],
      ],
    },
    dureeConsultation: [9, 16],
    jours: [1, 4],
    repos: { proba: 0.3, jours: [1, 3] },
    cas: [
      {
        notes: 'Diarrhée et douleurs au ventre depuis {j} jours.',
        symptomes:
          'Diarrhée liquide depuis {j} jours avec douleurs abdominales et nausées.',
        examen:
          'Abdomen souple, douloureux à la palpation diffuse, bruits hydro-aériques augmentés. Déshydratation modérée.',
        conclusion:
          'Gastro-entérite aiguë. Réhydratation orale, régime adapté, traitement symptomatique. Reconsulter si les selles persistent au-delà de 3 jours.',
        modeDebut: 'Brutal',
      },
      {
        notes: 'Vomissements et diarrhée.',
        symptomes:
          'Selles liquides fréquentes, vomissements et soif depuis {j} jours.',
        examen:
          'Pas de défense abdominale, muqueuses sèches, pli cutané peu persistant.',
        conclusion:
          'Gastro-entérite sans signe de gravité. SRO et surveillance à domicile.',
        modeDebut: 'Brutal',
      },
      {
        notes: 'Douleurs abdominales depuis hier.',
        symptomes:
          'Douleurs abdominales et ballonnements après les repas depuis {j} jours.',
        examen:
          'Abdomen souple, sensibilité épigastrique, pas de masse palpable.',
        conclusion:
          'Syndrome dyspeptique. Traitement antiulcéreux et conseils alimentaires.',
        modeDebut: 'Progressif',
      },
    ],
  },
  {
    code: 'TRAUMATISME',
    diagnosticCertain: true,
    poids: 9,
    pathologie: 'TRAUMATISME_PHYSIQUE',
    motifs: [['TRAUMATISME', 100]],
    ages: [4, 70],
    travail: true,
    constantes: {
      tensionSystolique: g(132, 14, 100, 175),
      tensionDiastolique: g(82, 9, 62, 108),
      frequenceCardiaque: g(88, 11, 62, 125),
      etatGeneral: [
        ['Bon', 88],
        ['Altéré', 11],
        ['Mauvais', 1],
      ],
    },
    dureeConsultation: [14, 28],
    jours: [0, 2],
    repos: { proba: 0.55, jours: [3, 10] },
    cas: [
      {
        notes: 'Chute au travail, douleur au poignet.',
        symptomes: 'Chute d’une échelle avec douleur et gonflement du poignet.',
        examen:
          'Tuméfaction douloureuse du poignet, mobilité limitée, pas de déformation évidente. Pouls et sensibilité conservés.',
        conclusion:
          'Traumatisme du poignet sans signe de fracture évidente. Immobilisation, antalgiques et anti-inflammatoires. Radiographie si la douleur persiste.',
        modeDebut: 'Brutal',
      },
      {
        notes: 'Plaie à la main, saignement.',
        symptomes:
          'Plaie de la main par un outil, saignement contrôlé sur place.',
        examen:
          'Plaie nette de la paume, hémostase effective, pas d’atteinte tendineuse apparente. Nettoyage et suture.',
        conclusion:
          'Plaie suturée, pansement et antibiothérapie. Retrait des fils dans 8 jours. Rappel antitétanique.',
        modeDebut: 'Brutal',
      },
      {
        notes: 'Douleur à la cheville après une chute.',
        symptomes:
          'Entorse de la cheville en descendant d’un engin, douleur à l’appui.',
        examen:
          'Œdème périmalléolaire, douleur à la palpation du ligament externe, appui possible avec douleur.',
        conclusion:
          'Entorse bénigne de la cheville. Contention, repos et glaçage. Revoir dans une semaine.',
        modeDebut: 'Brutal',
      },
      {
        notes: 'Choc sur le thorax.',
        symptomes: 'Contusion du thorax suite à un choc avec un objet lourd.',
        examen:
          'Ecchymose thoracique, douleur à la palpation costale, murmure vésiculaire normal.',
        conclusion:
          'Contusion thoracique simple. Antalgiques et surveillance ; reconsulter en cas de gêne respiratoire.',
        modeDebut: 'Brutal',
      },
      {
        notes: 'Douleur à l’épaule après un chargement.',
        symptomes:
          'Coup reçu à l’épaule lors d’un chargement, mobilité limitée.',
        examen:
          'Épaule douloureuse, mobilité active limitée, pas de déformation, pouls radial perçu.',
        conclusion:
          'Contusion de l’épaule. Antalgiques, anti-inflammatoires et repos relatif ; radiographie en cas de persistance.',
        modeDebut: 'Brutal',
      },
    ],
  },
  {
    code: 'ANEMIE',
    poids: 4,
    pathologie: 'ANEMIE',
    motifs: [
      ['CONSULTATION_GENERALE', 60],
      ['PEDIATRIE', 25],
      ['PALUDISME_SUSPECT', 15],
    ],
    constantes: {
      frequenceCardiaque: g(98, 10, 72, 130),
      saturationO2: g(97.5, 1.2, 93, 100),
      coloration: [
        ['Pâleur', 82],
        ['Normale', 14],
        ['Ictère', 4],
      ],
      etatGeneral: [
        ['Bon', 55],
        ['Altéré', 43],
        ['Mauvais', 2],
      ],
    },
    dureeConsultation: [10, 17],
    jours: [5, 30],
    cas: [
      {
        notes: 'Fatigue et pâleur.',
        symptomes:
          'Fatigue importante, vertiges et essoufflement à l’effort depuis {j} jours.',
        examen:
          'Pâleur conjonctivale et palmaire, tachycardie légère, souffle fonctionnel.',
        conclusion:
          'Anémie probable. Supplémentation en fer et acide folique, bilan sanguin à prévoir. Revoir dans 3 semaines.',
        modeDebut: 'Progressif',
      },
      {
        notes: 'Vertiges et essoufflement.',
        symptomes:
          'Pâleur remarquée par l’entourage, palpitations et maux de tête.',
        examen:
          'Pâleur marquée, pas de signe de décompensation, rate non palpable.',
        conclusion:
          'Anémie par carence probable. Conseils alimentaires et traitement martial.',
        modeDebut: 'Progressif',
      },
    ],
  },
  {
    code: 'ASTHME',
    poids: 3,
    pathologie: 'ASTHME',
    motifs: [
      ['DIFFICULTES_RESPI', 55],
      ['SUIVI_CHRONIQUE', 45],
    ],
    chronique: true,
    constantes: {
      frequenceRespiratoire: g(23, 3.5, 16, 34),
      saturationO2: g(95, 2, 88, 99),
      frequenceCardiaque: g(94, 11, 68, 130),
    },
    dureeConsultation: [10, 18],
    jours: [0, 3],
    cas: [
      {
        notes: 'Gêne respiratoire, sifflements.',
        symptomes:
          'Crises de gêne respiratoire avec sifflements, surtout la nuit, depuis {j} jours.',
        examen:
          'Sibilants diffus à l’auscultation, expiration prolongée, pas de signe de détresse.',
        conclusion:
          'Crise d’asthme modérée, bien améliorée. Traitement de fond rappelé, éviter les facteurs déclenchants.',
        modeDebut: 'Brutal',
      },
      {
        notes: 'Suivi de l’asthme.',
        symptomes:
          'Toux sèche et oppression thoracique après un effort ou à l’exposition à la poussière.',
        examen: 'Auscultation normale entre les crises, pas de tirage.',
        conclusion:
          'Asthme persistant léger. Bronchodilatateur à la demande, contrôle dans un mois.',
        modeDebut: 'Progressif',
      },
    ],
  },
  {
    code: 'DREPANOCYTOSE',
    poids: 1.6,
    pathologie: 'DREPANOCYTOSE',
    motifs: [
      ['SUIVI_CHRONIQUE', 50],
      ['DOULEUR_ABDOMINALE', 25],
      ['FIEVRE_FORTE', 25],
    ],
    chronique: true,
    ages: [3, 50],
    constantes: {
      temperature: g(37.7, 0.7, 36.5, 39.8),
      coloration: [
        ['Pâleur', 55],
        ['Ictère', 35],
        ['Normale', 10],
      ],
      saturationO2: g(95.5, 2, 89, 99),
    },
    dureeConsultation: [12, 22],
    jours: [0, 3],
    cas: [
      {
        notes: 'Douleurs dans les os.',
        symptomes:
          'Douleurs osseuses et articulaires diffuses, évoluant par crises, depuis {j} jours.',
        examen:
          'Pâleur et subictère conjonctival. Douleurs à la palpation des os longs. Pas de signe de gravité.',
        conclusion:
          'Drépanocytose, crise vaso-occlusive modérée. Antalgiques, hydratation, acide folique. Surveillance rapprochée.',
        modeDebut: 'Brutal',
      },
      {
        notes: 'Suivi de la drépanocytose.',
        symptomes:
          'Suivi de drépanocytose ; fatigue et pâleur, sans crise douloureuse récente.',
        examen:
          'État général conservé. Rate non palpable. Examen cardio-pulmonaire normal.',
        conclusion:
          'Drépanocytose stable. Traitement de fond poursuivi, bilan à programmer.',
        modeDebut: 'Progressif',
      },
    ],
  },
  {
    code: 'TUBERCULOSE',
    poids: 0.9,
    pathologie: 'TUBERCULOSE',
    motifs: [
      ['CONSULTATION_GENERALE', 60],
      ['DIFFICULTES_RESPI', 40],
    ],
    ages: [15, 65],
    constantes: {
      temperature: g(37.9, 0.6, 36.8, 39.5),
      saturationO2: g(95, 2, 89, 99),
      etatGeneral: [
        ['Altéré', 70],
        ['Bon', 25],
        ['Mauvais', 5],
      ],
    },
    dureeConsultation: [14, 24],
    jours: [14, 60],
    cas: [
      {
        notes: 'Toux depuis plus de deux semaines.',
        symptomes:
          'Toux persistante depuis {j} jours, sueurs nocturnes et amaigrissement.',
        examen:
          'Amaigrissement visible, toux, râles localisés au sommet droit. Fièvre modérée.',
        conclusion:
          'Suspicion de tuberculose pulmonaire : bilan complémentaire demandé et prise en charge spécialisée.',
        modeDebut: 'Progressif',
      },
      {
        notes: 'Toux, fièvre le soir, amaigrissement.',
        symptomes:
          'Toux chronique avec expectorations, fièvre vespérale et perte de poids.',
        examen:
          'Patient amaigri, auscultation : souffle amphorique discret. Pas de détresse.',
        conclusion:
          'Tuberculose probable. Orientation vers le programme de lutte et mesures de protection.',
        modeDebut: 'Progressif',
      },
    ],
  },
  {
    code: 'VIH_SUIVI',
    poids: 1.1,
    pathologie: 'VIH_SIDA',
    motifs: [['SUIVI_CHRONIQUE', 100]],
    chronique: true,
    ages: [20, 60],
    constantes: {
      etatGeneral: [
        ['Bon', 90],
        ['Altéré', 10],
      ],
    },
    dureeConsultation: [10, 18],
    jours: [1, 14],
    cas: [
      {
        notes: 'Rendez-vous de suivi.',
        symptomes: 'Consultation de suivi programmée, bien portant.',
        examen: 'Bon état général, examen sans particularité.',
        conclusion:
          'Suivi spécialisé poursuivi, observance du traitement rappelée.',
        modeDebut: 'Progressif',
      },
    ],
  },
  {
    code: 'GROSSESSE',
    diagnosticCertain: true,
    poids: 6,
    pathologie: 'GROSSESSE',
    motifs: [['SUIVI_GROSSESSE', 100]],
    sexe: 'F',
    ages: [18, 42],
    constantes: {
      tensionSystolique: g(112, 11, 92, 145),
      tensionDiastolique: g(70, 8, 55, 95),
      frequenceCardiaque: g(86, 9, 64, 115),
    },
    dureeConsultation: [14, 24],
    jours: [0, 0],
    cas: [
      {
        notes: 'Consultation prénatale.',
        symptomes:
          'Consultation prénatale de suivi, mouvements actifs du fœtus.',
        examen:
          'Hauteur utérine correspondant au terme, bruits du cœur fœtal perçus, pas d’œdème.',
        conclusion:
          'Grossesse évoluant normalement. Supplémentation en fer et acide folique, prochaine consultation dans 4 semaines.',
      },
      {
        notes: 'Suivi de grossesse, nausées.',
        symptomes: 'Nausées matinales et fatigue en début de grossesse.',
        examen:
          'Examen général normal, tension correcte, col fermé au toucher.',
        conclusion:
          'Grossesse sans complication. Bilan prénatal à jour, conseils d’hygiène de vie.',
      },
      {
        notes: 'Suivi de grossesse, douleurs dans le dos.',
        symptomes:
          'Lombalgies et pesanteur pelvienne, grossesse évoluant normalement.',
        examen:
          'Hauteur utérine normale, pas de contraction, bruits du cœur fœtal réguliers.',
        conclusion:
          'Lombalgies de grossesse sans signe de gravité. Repos relatif, ceinture de maintien, surveillance.',
      },
    ],
  },
  {
    code: 'DERMATOLOGIE',
    diagnosticCertain: true,
    poids: 3.5,
    pathologie: 'ALLERGIE_CHRONIQUE',
    motifs: [['DERMATOLOGIE', 100]],
    constantes: {},
    dureeConsultation: [8, 14],
    jours: [2, 15],
    cas: [
      {
        notes: 'Boutons et démangeaisons.',
        symptomes:
          'Démangeaisons et éruption cutanée apparues il y a {j} jours.',
        examen:
          'Éruption érythémateuse prurigineuse, sans signe de surinfection.',
        conclusion:
          'Dermatose allergique. Antihistaminique et émollient, éviction du facteur déclenchant.',
        modeDebut: 'Progressif',
      },
      {
        notes: 'Éruption sur les bras.',
        symptomes:
          'Lésions prurigineuses des avant-bras, aggravées par la chaleur.',
        examen: 'Lésions de grattage, peau sèche, pas de fièvre.',
        conclusion:
          'Eczéma de contact probable. Dermocorticoïde court et conseils d’hygiène.',
        modeDebut: 'Progressif',
      },
    ],
  },
  {
    code: 'CARDIOPATHIE',
    poids: 1.4,
    pathologie: 'MALADIE_CARDIAQUE',
    associes: [['HTA', 0.4]],
    motifs: [
      ['SUIVI_CHRONIQUE', 70],
      ['CONSULTATION_GENERALE', 30],
    ],
    chronique: true,
    ages: [50, 88],
    constantes: {
      tensionSystolique: g(145, 18, 105, 195),
      frequenceCardiaque: g(78, 12, 50, 118),
      saturationO2: g(95.5, 2, 89, 99),
      frequenceRespiratoire: g(19, 3, 13, 28),
    },
    dureeConsultation: [12, 20],
    jours: [3, 30],
    cas: [
      {
        notes: 'Essoufflement et chevilles gonflées.',
        symptomes:
          'Essoufflement à l’effort et gonflement des chevilles en fin de journée.',
        examen:
          'Souffle systolique connu, discrets œdèmes des chevilles, pas de crépitants.',
        conclusion:
          'Cardiopathie avec signes congestifs discrets : diurétique ajusté, contrôle sous 10 jours.',
        modeDebut: 'Progressif',
      },
      {
        notes: 'Suivi du cœur.',
        symptomes: 'Palpitations et fatigue, suivi cardiologique habituel.',
        examen:
          'Pouls irrégulier, bruits du cœur assourdis, pas de signe de décompensation.',
        conclusion:
          'Cardiopathie suivie, état stable. Traitement poursuivi, surveillance du poids et du sel.',
        modeDebut: 'Progressif',
      },
    ],
  },
]

/**
 * Pour un enfant, un motif de « consultation pédiatrique » remplace le motif habituel dans cette
 * proportion des cas (s'il existe dans le référentiel).
 */
export const PART_PEDIATRIE = 0.4

/** Raisons d'annulation d'une visite à l'accueil. */
export const MOTIFS_ANNULATION_VISITE: readonly string[] = [
  'Patient parti sans attendre la consultation.',
  'Enregistré par erreur, pas de besoin de consultation.',
  'Doublon : la personne a déjà une visite ouverte.',
  'Patient reparti, souhaite revenir un autre jour.',
  'Orienté vers un autre établissement.',
]

/** Raisons d'annulation d'une consultation déjà ouverte. */
export const MOTIFS_ANNULATION_CONSULTATION: readonly string[] = [
  'Ouverte par erreur sur le mauvais dossier.',
  'Patient absent au moment de l’appel.',
  'Consultation réaffectée à un autre médecin.',
  'Interrompue : le patient a dû quitter le centre.',
]

/** Nom d'une maladie chronique dans le dossier (antécédent), par code de profil. */
export const LIBELLE_CHRONIQUE: Readonly<Record<string, string>> = {
  HTA: 'Hypertension artérielle',
  DIABETE: 'Diabète de type 2',
  ASTHME: 'Asthme',
  DREPANOCYTOSE: 'Drépanocytose',
  VIH_SUIVI: 'Infection par le VIH',
  CARDIOPATHIE: 'Cardiopathie',
}

/** Chances qu'une personne de cet âge soit déjà suivie pour cette maladie chronique. */
export function probaChronique(code: string, age: number): number {
  switch (code) {
    case 'HTA':
      return age >= 35 ? Math.min(0.3, 0.04 + 0.006 * (age - 35)) : 0
    case 'DIABETE':
      return age >= 38 ? Math.min(0.12, 0.02 + 0.003 * (age - 38)) : 0
    case 'ASTHME':
      return 0.035
    case 'DREPANOCYTOSE':
      return age < 50 ? 0.012 : 0
    case 'VIH_SUIVI':
      return age >= 20 && age <= 60 ? 0.01 : 0
    case 'CARDIOPATHIE':
      return age >= 50 ? Math.min(0.1, 0.03 + 0.003 * (age - 50)) : 0
    default:
      return 0
  }
}
