/**
 * Namespace i18n — Module Suivi de traitement (contrôle d'état de santé,
 * évolution d'une maladie, traitement en cours). Clés préfixées `suiviTraitement.`
 * (FR/EN strictement alignées).
 */
export const suiviTraitement = {
  fr: {
    // ── Sous-onglets (onglet dossier « Suivi de traitement ») ────────
    subTabEpisodes: 'Épisodes',
    subTabConstantes: 'Constantes',
    subTabChroniques: 'Pathologies chroniques',
    subTabTraitement: 'Traitement',
    subTabResultats: 'Résultats d\'examens',

    // ── Carte (consultation + dossier) ───────────────────────────────
    cardTitle: 'Suivi de traitement',
    cardNone: 'Aucun suivi en cours',
    loading: 'Chargement…',
    initiate: 'Ouvrir un suivi',
    emptyTitle: 'Aucun suivi de traitement',
    emptyDesc: 'Ouvrez un suivi pour ce patient (contrôle d\'état de santé, évolution d\'une maladie, traitement en cours).',

    statutEnCours: 'En cours',
    statutCloture: 'Clôturé',
    statutAnnule: 'Annulé',

    motifTitle: 'Motif du suivi',
    clotureLabel: 'Clôturé — {{motif}}',
    annuleLabel: 'Annulé — {{motif}}',

    fichesTitle: 'Fiches de suivi',

    fieldTemperature: 'Température',
    fieldTensionSys: 'Tension sys.',
    fieldTensionDia: 'Tension dia.',
    fieldFc: 'Fréq. card.',
    fieldSpo2: 'SpO₂',
    fieldPoids: 'Poids',
    fieldEvolution: 'Évolution / état de santé',
    evolutionPlaceholder: 'Évolution de l\'état de santé, tolérance au traitement…',
    fieldMedicaments: 'Médicaments administrés',
    medicamentsPlaceholder: 'Médicament(s) administré(s) aujourd\'hui, posologie, heure…',
    fieldResultat: 'Résultat d\'examen',
    resultatPlaceholder: 'Résultat d\'un examen de contrôle réalisé ce jour…',

    addFiche: 'Ajouter une fiche',
    editFiche: 'Modifier',
    editFicheTitle: 'Modifier cette fiche',
    newFicheConstantes: 'Constantes (facultatif)',
    cancelForm: 'Annuler',
    save: 'Enregistrer',

    cancel: 'Annuler le suivi',
    close: 'Clôturer',

    closeDialogTitle: 'Clôturer ce suivi de traitement ?',
    closeDialogBody: 'Le suivi ne sera plus modifiable après clôture. Précisez le motif si besoin (guérison, fin de traitement…).',
    closeDialogPlaceholder: 'Motif de clôture (facultatif)…',

    cancelDialogTitle: 'Annuler ce suivi de traitement ?',
    cancelDialogSubtitle: 'Cette action est réversible : un nouveau suivi pourra être ouvert pour cette consultation.',
    cancelDialogLabel: 'Motif de l\'annulation',
    cancelDialogPlaceholder: 'Pourquoi annuler ce suivi ?',
    cancelDialogConfirm: 'Annuler le suivi',

    deletePermanently: 'Supprimer définitivement',
    deleteTitle: 'Supprimer ce suivi de traitement ?',
    deleteBody: 'Cette action est définitive : le suivi et toutes ses fiches seront supprimés.',
    deleteConfirm: 'Supprimer définitivement',

    createTitle: 'Ouvrir un suivi de traitement',
    createSubtitle: 'Contrôle d\'état de santé, évolution d\'une maladie, ou traitement en cours',
    fieldMotifSuivi: 'Motif du suivi',
    fieldMotifSuiviHint: 'Ex. « Traitement palu — injections », « Suivi post-opératoire »…',
    createMotifPlaceholder: 'Décrivez ce qui doit être suivi…',
    createConfirm: 'Ouvrir le suivi',

    toastErreur: 'Une erreur est survenue.',
    toastOuvert: 'Suivi de traitement ouvert.',
    toastFicheAjoutee: 'Fiche de suivi ajoutée.',
    toastFicheModifiee: 'Fiche de suivi modifiée.',
    toastCloture: 'Suivi de traitement clôturé.',
    toastAnnule: 'Suivi de traitement annulé.',
    toastSupprime: 'Suivi de traitement supprimé.',
  },
  en: {
    // ── Sub-tabs (dossier tab "Treatment follow-up") ─────────────────
    subTabEpisodes: 'Episodes',
    subTabConstantes: 'Vitals',
    subTabChroniques: 'Chronic conditions',
    subTabTraitement: 'Treatment',
    subTabResultats: 'Test results',

    cardTitle: 'Treatment follow-up',
    cardNone: 'No follow-up in progress',
    loading: 'Loading…',
    initiate: 'Open a follow-up',
    emptyTitle: 'No treatment follow-up',
    emptyDesc: 'Open a follow-up for this patient (health check, disease progression, ongoing treatment).',

    statutEnCours: 'In progress',
    statutCloture: 'Closed',
    statutAnnule: 'Cancelled',

    motifTitle: 'Follow-up reason',
    clotureLabel: 'Closed — {{motif}}',
    annuleLabel: 'Cancelled — {{motif}}',

    fichesTitle: 'Follow-up entries',

    fieldTemperature: 'Temperature',
    fieldTensionSys: 'Systolic BP',
    fieldTensionDia: 'Diastolic BP',
    fieldFc: 'Heart rate',
    fieldSpo2: 'SpO₂',
    fieldPoids: 'Weight',
    fieldEvolution: 'Evolution / health status',
    evolutionPlaceholder: 'Evolution of health status, treatment tolerance…',
    fieldMedicaments: 'Medications administered',
    medicamentsPlaceholder: 'Medication(s) administered today, dosage, time…',
    fieldResultat: 'Test result',
    resultatPlaceholder: 'Result of a check-up test performed today…',

    addFiche: 'Add entry',
    editFiche: 'Edit',
    editFicheTitle: 'Edit this entry',
    newFicheConstantes: 'Vital signs (optional)',
    cancelForm: 'Cancel',
    save: 'Save',

    cancel: 'Cancel follow-up',
    close: 'Close',

    closeDialogTitle: 'Close this treatment follow-up?',
    closeDialogBody: 'The follow-up can no longer be edited once closed. State the reason if relevant (recovery, end of treatment…).',
    closeDialogPlaceholder: 'Reason for closing (optional)…',

    cancelDialogTitle: 'Cancel this treatment follow-up?',
    cancelDialogSubtitle: 'This is reversible: a new follow-up can be opened for this consultation.',
    cancelDialogLabel: 'Reason for cancellation',
    cancelDialogPlaceholder: 'Why cancel this follow-up?',
    cancelDialogConfirm: 'Cancel follow-up',

    deletePermanently: 'Permanently delete',
    deleteTitle: 'Delete this treatment follow-up?',
    deleteBody: 'This is permanent: the follow-up and all its entries will be deleted.',
    deleteConfirm: 'Permanently delete',

    createTitle: 'Open a treatment follow-up',
    createSubtitle: 'Health check, disease progression, or ongoing treatment',
    fieldMotifSuivi: 'Follow-up reason',
    fieldMotifSuiviHint: 'E.g. "Malaria treatment — injections", "Post-op follow-up"…',
    createMotifPlaceholder: 'Describe what needs to be followed up…',
    createConfirm: 'Open follow-up',

    toastErreur: 'An error occurred.',
    toastOuvert: 'Treatment follow-up opened.',
    toastFicheAjoutee: 'Follow-up entry added.',
    toastFicheModifiee: 'Follow-up entry updated.',
    toastCloture: 'Treatment follow-up closed.',
    toastAnnule: 'Treatment follow-up cancelled.',
    toastSupprime: 'Treatment follow-up deleted.',
  },
}
