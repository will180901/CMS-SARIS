/**
 * Namespace i18n — Module Rapports statistiques.
 * Clés préfixées `rapports.` (FR/EN strictement alignées).
 */
export const rapports = {
  fr: {
    // ── En-tête ──────────────────────────────────────────────────────
    pageTitle: 'Rapports',
    countAndOrigin_one: '{{count}} rapport · Générés automatiquement',
    countAndOrigin_other: '{{count}} rapports · Générés automatiquement',

    // ── Types de période ─────────────────────────────────────────────
    typeAll: 'Tous',
    typeHEBDOMADAIRE: 'Hebdomadaire',
    typeMENSUEL: 'Mensuel',
    typeANNUEL: 'Annuel',
    filterAria: 'Type de rapport',

    // ── Liste ────────────────────────────────────────────────────────
    generatedOn: 'Généré le {{date}}',
    emptyTitle: 'Aucun rapport',
    emptyDesc: 'Le premier rapport apparaîtra après la prochaine génération planifiée.',
    resizeHint: 'Glisser pour redimensionner — double-clic pour réinitialiser',
    back: 'Retour',

    // ── Détail ───────────────────────────────────────────────────────
    noSelectionTitle: 'Sélectionnez un rapport',
    noSelectionDesc: 'Choisissez un rapport dans la liste pour en voir le contenu.',
    // Le titre assemble le type et la période : « Mensuel — 01 juillet 2026 → 31 juillet 2026 ».
    detailTitle: '{{type}} — {{debut}} → {{fin}}',
    detailSubtitle_one: '{{count}} consultation · {{jours}} jour(s) de repos prescrits',
    detailSubtitle_other: '{{count}} consultations · {{jours}} jour(s) de repos prescrits',
    export: 'Excel',

    // ── Indicateurs ──────────────────────────────────────────────────
    statConsultations: 'Consultations',
    statReposDays: 'Jours de repos prescrits',
    statReposHint: '{{count}} consultation(s) avec repos',

    // ── Blocs d'analyse ──────────────────────────────────────────────
    byType: 'Par type de consultation',
    byCategory: 'Par catégorie de patient',
    byDepartment: 'Par département / direction',
    topPathologies: 'Top pathologies (diagnostic principal)',
    donutCenter: 'actes',
    noDataPeriod: 'Aucune donnée sur la période.',
  },
  en: {
    // ── Header ───────────────────────────────────────────────────────
    pageTitle: 'Reports',
    countAndOrigin_one: '{{count}} report · Generated automatically',
    countAndOrigin_other: '{{count}} reports · Generated automatically',

    // ── Period types ─────────────────────────────────────────────────
    typeAll: 'All',
    typeHEBDOMADAIRE: 'Weekly',
    typeMENSUEL: 'Monthly',
    typeANNUEL: 'Yearly',
    filterAria: 'Report type',

    // ── List ─────────────────────────────────────────────────────────
    generatedOn: 'Generated on {{date}}',
    emptyTitle: 'No report',
    emptyDesc: 'The first report will appear after the next scheduled generation.',
    resizeHint: 'Drag to resize — double-click to reset',
    back: 'Back',

    // ── Detail ───────────────────────────────────────────────────────
    noSelectionTitle: 'Select a report',
    noSelectionDesc: 'Pick a report from the list to see its contents.',
    detailTitle: '{{type}} — {{debut}} → {{fin}}',
    detailSubtitle_one: '{{count}} consultation · {{jours}} day(s) of prescribed rest',
    detailSubtitle_other: '{{count}} consultations · {{jours}} day(s) of prescribed rest',
    export: 'Excel',

    // ── Indicators ───────────────────────────────────────────────────
    statConsultations: 'Consultations',
    statReposDays: 'Days of prescribed rest',
    statReposHint: '{{count}} consultation(s) with rest',

    // ── Analysis blocks ──────────────────────────────────────────────
    byType: 'By consultation type',
    byCategory: 'By patient category',
    byDepartment: 'By department / division',
    topPathologies: 'Top conditions (primary diagnosis)',
    donutCenter: 'acts',
    noDataPeriod: 'No data for this period.',
  },
}
