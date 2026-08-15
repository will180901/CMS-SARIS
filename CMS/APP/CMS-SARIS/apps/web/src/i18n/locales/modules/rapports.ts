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
    genererMaintenant: 'Generer maintenant',
    genereOk: 'Rapport du mois en cours genere.',
    genereErreur: 'La generation a echoue.',
    syntheseTitle: 'Ce qu\'il faut retenir',
    tendanceTitle: 'Tendance sur les 6 dernieres periodes',
    syntheseActes: '{{count}} consultation(s) sur la periode.',
    syntheseEvolution: 'Soit {{signe}}{{pct}} % par rapport a la periode precedente ({{avant}}).',
    synthesePremiere: 'Premiere periode mesuree : aucun point de comparaison disponible.',
    syntheseDominant: '{{libelle}} represente {{pct}} % des actes.',
    syntheseRepos: '{{jours}} jour(s) de repos prescrits, sur {{count}} consultation(s).',
    syntheseSansRepos: 'Aucun jour de repos prescrit.',
    alerte: {
      ACTIVITE_HAUSSE: 'Activite en hausse de {{pct}} % : {{apres}} consultations contre {{avant}} sur la periode precedente.',
      ACTIVITE_BAISSE: 'Activite en baisse de {{pct}} % : {{apres}} consultations contre {{avant}} sur la periode precedente.',
      AT_CONCENTRATION: 'Accidents du travail concentres : {{cas}} actes au departement {{departement}}, pour {{accidents}} accident(s) declares.',
      PATHOLOGIE_HAUSSE: '{{libelle}} en forte hausse : {{apres}} cas contre {{avant}} sur la periode precedente.',
      REPOS_HAUSSE: 'Absenteisme prescrit en hausse : {{apres}} jours contre {{avant}} sur la periode precedente.',
    },
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
    genererMaintenant: 'Generate now',
    genereOk: 'Report for the current month generated.',
    genereErreur: 'Generation failed.',
    syntheseTitle: 'Key takeaways',
    tendanceTitle: 'Trend over the last 6 periods',
    syntheseActes: '{{count}} consultation(s) over the period.',
    syntheseEvolution: 'That is {{signe}}{{pct}}% compared with the previous period ({{avant}}).',
    synthesePremiere: 'First measured period: no comparison available yet.',
    syntheseDominant: '{{libelle}} accounts for {{pct}}% of all visits.',
    syntheseRepos: '{{jours}} day(s) of prescribed rest, across {{count}} consultation(s).',
    syntheseSansRepos: 'No rest days prescribed.',
    alerte: {
      ACTIVITE_HAUSSE: 'Activity up {{pct}}%: {{apres}} consultations versus {{avant}} in the previous period.',
      ACTIVITE_BAISSE: 'Activity down {{pct}}%: {{apres}} consultations versus {{avant}} in the previous period.',
      AT_CONCENTRATION: 'Work accidents concentrated: {{cas}} visits in the {{departement}} department, for {{accidents}} reported accident(s).',
      PATHOLOGIE_HAUSSE: '{{libelle}} rising sharply: {{apres}} cases versus {{avant}} in the previous period.',
      REPOS_HAUSSE: 'Prescribed absence up: {{apres}} days versus {{avant}} in the previous period.',
    },
    byType: 'By consultation type',
    byCategory: 'By patient category',
    byDepartment: 'By department / division',
    topPathologies: 'Top conditions (primary diagnosis)',
    donutCenter: 'acts',
    noDataPeriod: 'No data for this period.',
  },
}
