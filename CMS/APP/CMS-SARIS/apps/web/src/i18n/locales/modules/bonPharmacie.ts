/**
 * Namespace i18n — Bon de pharmacie (recueil §4.3 étape 8).
 * Clés préfixées `bonPharmacie.` (FR/EN strictement alignées).
 */
export const bonPharmacie = {
  fr: {
    // ── Carte / liste ───────────────────────────────────────────────
    cardTitle: 'Bon de pharmacie',
    newBon: 'Nouveau bon',
    count_one: '{{count}} bon',
    count_other: '{{count}} bons',
    emptyTitle: 'Aucun bon de pharmacie',
    emptyDescription: 'Aucun médicament délivré pour cette consultation.',
    notEligibleTitle: 'Médicaments non pris en charge',
    notEligibleDesc: 'Cette catégorie de patient n’ouvre pas droit à la prise en charge des médicaments (réservé au personnel CDI et à leurs ayants droit).',
    createFirst: 'Créer un bon',

    // ── En-tête / statut d’un bon ───────────────────────────────────
    bonNumber: 'Bon {{numero}}',
    statusPending: 'En attente',
    statusDelivered: 'Délivré',
    statusCancelled: 'Annulé',
    qty: 'Qté {{q}}',
    deliveredOn: 'Délivré le {{date}}',
    cancelledReason: 'Annulé : {{motif}}',

    // ── Actions ─────────────────────────────────────────────────────
    print: 'Imprimer',
    markDelivered: 'Marquer délivré',
    cancelBon: 'Annuler',
    cancelDialogTitle: 'Annuler le bon de pharmacie',
    cancelDialogLabel: 'Motif d’annulation',
    cancelDialogPlaceholder: 'Préciser le motif…',
    cancelDialogConfirm: 'Annuler le bon',

    // ── Dialog de création ──────────────────────────────────────────
    newModalTitle: 'Nouveau bon de pharmacie',
    newModalSubtitle: 'Médicaments pris en charge (CDI et ayants droit)',
    medLabel: 'Médicament',
    posologie: 'Posologie',
    qtyShort: 'Qté',
    addMed: 'Ajouter un médicament',
    noMedHint: 'Aucun médicament au référentiel — ajoutez-en dans Référentiels.',
    observations: 'Observations',
    observationsPlaceholder: 'Remarques (optionnel)',
    createBon: 'Créer le bon',

    // ── Toasts ──────────────────────────────────────────────────────
    toastCreated: 'Bon de pharmacie créé',
    toastDelivered: 'Bon marqué délivré',
    toastCancelled: 'Bon annulé',
    toastDeleted: 'Bon supprimé',
    toastErrorGeneric: 'Erreur sur le bon de pharmacie',

    // ── Impression (gabarit A4) ─────────────────────────────────────
    printTitle: 'Bon de pharmacie',
    printPreviewLabel: 'Aperçu du bon de pharmacie',
    printSecondSignature: 'Pharmacie (délivrance)',
    printMedicaments: 'Médicaments à délivrer',
    printColNumber: 'N°',
    printColMedicament: 'Médicament',
    printColPosologie: 'Posologie',
    printColQuantite: 'Quantité',
    printObservations: 'Observations',
    printCallout: 'Médicaments pris en charge gratuitement — réservé au personnel CDI et à leurs ayants droit.',
  },
  en: {
    cardTitle: 'Pharmacy voucher',
    newBon: 'New voucher',
    count_one: '{{count}} voucher',
    count_other: '{{count}} vouchers',
    emptyTitle: 'No pharmacy voucher',
    emptyDescription: 'No medication issued for this consultation.',
    notEligibleTitle: 'Medication not covered',
    notEligibleDesc: 'This patient category is not entitled to medication coverage (reserved for permanent staff and their dependents).',
    createFirst: 'Create a voucher',

    bonNumber: 'Voucher {{numero}}',
    statusPending: 'Pending',
    statusDelivered: 'Delivered',
    statusCancelled: 'Cancelled',
    qty: 'Qty {{q}}',
    deliveredOn: 'Delivered on {{date}}',
    cancelledReason: 'Cancelled: {{motif}}',

    print: 'Print',
    markDelivered: 'Mark delivered',
    cancelBon: 'Cancel',
    cancelDialogTitle: 'Cancel the pharmacy voucher',
    cancelDialogLabel: 'Cancellation reason',
    cancelDialogPlaceholder: 'Specify the reason…',
    cancelDialogConfirm: 'Cancel voucher',

    newModalTitle: 'New pharmacy voucher',
    newModalSubtitle: 'Covered medication (permanent staff and dependents)',
    medLabel: 'Medication',
    posologie: 'Dosage',
    qtyShort: 'Qty',
    addMed: 'Add a medication',
    noMedHint: 'No medication in the catalog — add some under Referentials.',
    observations: 'Notes',
    observationsPlaceholder: 'Notes (optional)',
    createBon: 'Create voucher',

    toastCreated: 'Pharmacy voucher created',
    toastDelivered: 'Voucher marked delivered',
    toastCancelled: 'Voucher cancelled',
    toastDeleted: 'Voucher deleted',
    toastErrorGeneric: 'Pharmacy voucher error',

    printTitle: 'Pharmacy voucher',
    printPreviewLabel: 'Pharmacy voucher preview',
    printSecondSignature: 'Pharmacy (dispensing)',
    printMedicaments: 'Medication to dispense',
    printColNumber: 'No.',
    printColMedicament: 'Medication',
    printColPosologie: 'Dosage',
    printColQuantite: 'Quantity',
    printObservations: 'Notes',
    printCallout: 'Medication covered free of charge — reserved for permanent staff and their dependents.',
  },
}
