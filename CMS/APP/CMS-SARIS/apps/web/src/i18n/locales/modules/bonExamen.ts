/**
 * Namespace i18n — Bons d'examen complémentaires.
 * Clés préfixées `bonExamen.` (FR/EN strictement alignées).
 */
export const bonExamen = {
  fr: {
    // ── Carte / liste ───────────────────────────────────────────────
    cardTitle: 'Bons d\'examen complémentaires',
    loading: 'Chargement…',
    countOne: '{{count}} bon',
    countOther: '{{count}} bons',
    newBon: 'Nouveau bon',
    emptyTitle: 'Aucun bon d\'examen prescrit',
    emptyDescription: 'Créez un bon pour demander des examens complémentaires (biologie, imagerie).',
    createFirst: 'Créer le premier bon',

    // ── En-tête d'un bon ────────────────────────────────────────────
    bonNumber: 'Bon #{{numero}}',
    statusPending: 'En attente',
    statusValidated: 'Validé',
    statusCancelled: 'Annulé',

    // ── Corps d'un bon ──────────────────────────────────────────────
    clinicalIndication: 'Indication clinique',
    examsRequested: 'Examens demandés ({{count}})',
    resultsReceived: 'Résultats reçus ({{count}})',
    cancellationReason: 'Motif d\'annulation : {{motif}}',

    // ── Actions ─────────────────────────────────────────────────────
    cancelBon: 'Annuler le bon',
    validate: 'Valider',
    print: 'Imprimer',
    addResult: 'Ajouter résultat',

    // ── Dialogue d'annulation ───────────────────────────────────────
    cancelDialogTitle: 'Annuler le bon d\'examen',
    cancelDialogSubtitleValidated: 'Ce bon validé repassera au statut « Annulé ».',
    cancelDialogSubtitlePending: 'Ce bon d\'examen sera marqué comme annulé.',
    cancelDialogLabel: 'Motif d\'annulation',
    cancelDialogPlaceholder: 'ex: Erreur de prescription, examen non requis…',
    cancelDialogConfirm: 'Confirmer l\'annulation',

    // ── Saisie de résultat ──────────────────────────────────────────
    resultModalTitle: 'Saisie d\'un résultat',
    resultModalSubtitle: 'Compte-rendu d\'examen reçu',
    cancel: 'Annuler',
    saveResult: 'Enregistrer le résultat',
    labLabel: 'Laboratoire / lieu de réalisation',
    labPlaceholder: 'ex: Laboratoire CHU Brazzaville',
    resultLabel: 'Résultat',
    resultPlaceholder: 'Valeurs, observations…',
    interpretationLabel: 'Interprétation médicale',
    interpretationPlaceholder: 'Conclusion clinique…',

    // ── Création d'un bon ───────────────────────────────────────────
    createModalTitle: 'Nouveau bon d\'examen',
    createModalSubtitle: 'Prescription d\'examens complémentaires',
    createButtonOne: 'Créer le bon ({{count}} examen)',
    createButtonOther: 'Créer le bon ({{count}} examens)',
    indicationLabel: 'Indication clinique',
    indicationHint: 'Précisez la raison médicale de la prescription',
    indicationPlaceholder: 'ex: Suspicion de paludisme, fièvre persistante depuis 3 jours…',
    examsLabel: 'Examens à prescrire',
    examsHintOne: '{{count}} sélectionné',
    examsHintOther: '{{count}} sélectionnés',
    noExamSelected: 'Aucun examen — recherchez ci-dessous',
    removeExam: 'Retirer',
    examSearchPlaceholder: 'Rechercher un examen (libellé ou code)…',

    // ── Document imprimable ─────────────────────────────────────────
    printTitle: 'Bon d\'examen',
    printPreviewLabel: 'Aperçu du bon d\'examen',
    printSecondSignature: 'Cachet du laboratoire / centre réalisateur',
    printColNumber: '#',
    printColExam: 'Examen',
    printColDomain: 'Domaine',
    printCallout: 'Patient adressé par le CMS SARIS. Merci de transmettre les résultats au centre médico-social émetteur.',

    // ── Toasts (hooks runtime) ──────────────────────────────────────
    toastErrorGeneric: 'Erreur',
    toastCreated: 'Bon d\'examen créé',
    toastValidated: 'Bon validé',
    toastCancelledStatus: 'Bon annulé',
    toastBonCancelled: 'Bon d\'examen annulé',
    toastResultSaved: 'Résultat enregistré',
  },
  en: {
    // ── Card / list ─────────────────────────────────────────────────
    cardTitle: 'Additional examination orders',
    loading: 'Loading…',
    countOne: '{{count}} order',
    countOther: '{{count}} orders',
    newBon: 'New order',
    emptyTitle: 'No examination order prescribed',
    emptyDescription: 'Create an order to request additional examinations (laboratory, imaging).',
    createFirst: 'Create the first order',

    // ── Order header ────────────────────────────────────────────────
    bonNumber: 'Order #{{numero}}',
    statusPending: 'Pending',
    statusValidated: 'Validated',
    statusCancelled: 'Cancelled',

    // ── Order body ──────────────────────────────────────────────────
    clinicalIndication: 'Clinical indication',
    examsRequested: 'Examinations requested ({{count}})',
    resultsReceived: 'Results received ({{count}})',
    cancellationReason: 'Cancellation reason: {{motif}}',

    // ── Actions ─────────────────────────────────────────────────────
    cancelBon: 'Cancel order',
    validate: 'Validate',
    print: 'Print',
    addResult: 'Add result',

    // ── Cancellation dialog ─────────────────────────────────────────
    cancelDialogTitle: 'Cancel examination order',
    cancelDialogSubtitleValidated: 'This validated order will revert to “Cancelled” status.',
    cancelDialogSubtitlePending: 'This examination order will be marked as cancelled.',
    cancelDialogLabel: 'Cancellation reason',
    cancelDialogPlaceholder: 'e.g. Prescription error, examination not required…',
    cancelDialogConfirm: 'Confirm cancellation',

    // ── Result entry ────────────────────────────────────────────────
    resultModalTitle: 'Enter a result',
    resultModalSubtitle: 'Examination report received',
    cancel: 'Cancel',
    saveResult: 'Save result',
    labLabel: 'Laboratory / place of performance',
    labPlaceholder: 'e.g. CHU Brazzaville Laboratory',
    resultLabel: 'Result',
    resultPlaceholder: 'Values, observations…',
    interpretationLabel: 'Medical interpretation',
    interpretationPlaceholder: 'Clinical conclusion…',

    // ── Order creation ──────────────────────────────────────────────
    createModalTitle: 'New examination order',
    createModalSubtitle: 'Prescription of additional examinations',
    createButtonOne: 'Create order ({{count}} examination)',
    createButtonOther: 'Create order ({{count}} examinations)',
    indicationLabel: 'Clinical indication',
    indicationHint: 'Specify the medical reason for the prescription',
    indicationPlaceholder: 'e.g. Suspected malaria, persistent fever for 3 days…',
    examsLabel: 'Examinations to prescribe',
    examsHintOne: '{{count}} selected',
    examsHintOther: '{{count}} selected',
    noExamSelected: 'No examination — search below',
    removeExam: 'Remove',
    examSearchPlaceholder: 'Search for an examination (name or code)…',

    // ── Printable document ──────────────────────────────────────────
    printTitle: 'Examination order',
    printPreviewLabel: 'Examination order preview',
    printSecondSignature: 'Stamp of the performing laboratory / center',
    printColNumber: '#',
    printColExam: 'Examination',
    printColDomain: 'Domain',
    printCallout: 'Patient referred by CMS SARIS. Please send the results back to the issuing medico-social center.',

    // ── Toasts (runtime hooks) ──────────────────────────────────────
    toastErrorGeneric: 'Error',
    toastCreated: 'Examination order created',
    toastValidated: 'Order validated',
    toastCancelledStatus: 'Order cancelled',
    toastBonCancelled: 'Examination order cancelled',
    toastResultSaved: 'Result saved',
  },
}
