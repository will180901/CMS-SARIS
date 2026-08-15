/**
 * RapportPrintModal — l'imprimé du rapport, miroir exact de l'écran.
 *
 * POURQUOI PAS `MedicalPrintSheet`. Ce gabarit-là imprime un acte concernant UNE
 * personne : il impose un en-tête « PATIENT » (nom, naissance, sexe, n° dossier) et
 * un signataire. Un rapport statistique n'a ni l'un ni l'autre — on obtenait donc
 * quatre tirets et la période fourrée dans le champ « Nom & prénom », faute d'un
 * endroit où la mettre. Le gabarit faisait son travail ; c'est le choix du gabarit
 * qui était faux.
 *
 * Un rapport est une SUITE DE TABLEAUX : il relève de `ListePrintSheet`, celui du
 * registre des employés, avec son aperçu paginé et son bouton Imprimer / PDF.
 *
 * COHÉRENCE AVEC L'ÉCRAN. Le papier reprend les blocs de la page dans le MÊME ORDRE
 * et avec les MÊMES LIBELLÉS : synthèse, alertes, tendance, puis les cinq volets avec
 * leurs répartitions, puis les trois répartitions de consultations et les pathologies.
 * Un lecteur qui a la page sous les yeux retrouve l'imprimé ligne à ligne.
 *
 * Seule liberté prise, et elle va dans le bon sens : les répartitions sont imprimées
 * ENTIÈRES là où l'écran s'arrête aux huit ou dix premières lignes. Le papier n'a pas
 * la contrainte de place, et un rapport tronqué sans le dire serait pire.
 */
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ListePrintSheet, type BlocImprimable, type BlocTableau } from '@/components/print/ListePrintSheet'
import { formatDate } from '@/lib/intl'
import type { RapportDetail, Repartition } from '../api/rapports.api'

const ROOT_ID = 'rapport-print-sheet'

/** Au-delà, une répartition prend toute la largeur (et devient découpable sur
 *  plusieurs pages) plutôt que de tenir dans une demi-colonne. */
const MAX_LIGNES_DEMI = 12

/** Une répartition en tableau : libellé, nombre, et la part — pour lire sans calculatrice. */
function tableauRepartition(
  titre: string, hint: string | undefined, colLibelle: string, colNombre: string, rows: Repartition[],
): BlocTableau {
  const total = rows.reduce((s, r) => s + r.count, 0)
  return {
    type: 'tableau',
    titre,
    hint,
    colonnes: [
      { libelle: colLibelle },
      { libelle: colNombre, align: 'right', largeur: 70 },
      { libelle: '%', align: 'right', largeur: 54 },
    ],
    lignes: rows.map(r => [
      r.libelle,
      r.count,
      total > 0 ? `${Math.round((r.count / total) * 100)} %` : '—',
    ]),
  }
}

/** Place les répartitions deux par deux quand elles sont courtes, seules sinon. */
function poserRepartitions(tableaux: BlocTableau[]): BlocImprimable[] {
  const blocs: BlocImprimable[] = []

  let attente: BlocTableau | null = null

  const vider = () => {
    if (attente) { blocs.push({ type: 'paire', gauche: attente }); attente = null }
  }

  for (const t of tableaux) {
    if (t.lignes.length > MAX_LIGNES_DEMI) {
      vider()
      blocs.push(t)          // pleine largeur, découpable par le gabarit
      continue
    }
    if (attente) { blocs.push({ type: 'paire', gauche: attente, droite: t }); attente = null }
    else attente = t
  }
  vider()
  return blocs
}

/** Reprend, mot pour mot, les phrases composées par `SyntheseRapport` à l'écran. */
function phrasesSynthese(rapport: RapportDetail, t: TFunction): string {
  const c = rapport.contenu
  const total = c.totalConsultations
  const avant = c.precedent?.totalConsultations ?? null
  const ecart = avant !== null && avant >= 3 ? Math.round(((total - avant) / avant) * 100) : null

  const phrases: string[] = [t('rapports.syntheseActes', { count: total })]
  if (ecart !== null) {
    phrases.push(t('rapports.syntheseEvolution', {
      signe: ecart > 0 ? '+' : ecart < 0 ? '−' : '', pct: Math.abs(ecart), avant,
    }))
  } else if (avant === null) {
    phrases.push(t('rapports.synthesePremiere'))
  }
  const dominant = [...c.parType].sort((a, b) => b.count - a.count)[0]
  if (dominant && total > 0) {
    phrases.push(t('rapports.syntheseDominant', {
      libelle: dominant.libelle, pct: Math.round((dominant.count / total) * 100),
    }))
  }
  phrases.push(c.repos.totalJours > 0
    ? t('rapports.syntheseRepos', { jours: c.repos.totalJours, count: c.repos.consultationsAvecRepos })
    : t('rapports.syntheseSansRepos'))
  return phrases.join(' ')
}

export function RapportPrintModal({ rapport, onClose }: { rapport: RapportDetail; onClose: () => void }) {
  const { t } = useTranslation()
  const c = rapport.contenu
  const v = c.volets

  const periode = `${formatDate(rapport.periodeDebut, { day: '2-digit', month: 'long', year: 'numeric' })} → ${formatDate(rapport.periodeFin, { day: '2-digit', month: 'long', year: 'numeric' })}`
  const at = c.parType.find(x => /accident/i.test(x.libelle))?.count ?? 0
  const visites = v?.activite.visites ?? 0
  const tauxPassage = visites > 0 ? Math.round((c.totalConsultations / visites) * 100) : null

  // Même test que `SyntheseRapport` : une période sans rien à compter le DIT, et se
  // tait sur le reste — un mur de zéros se lirait comme une panne.
  const vide = c.totalConsultations === 0 && visites === 0

  const blocs: BlocImprimable[] = []

  // PAGE DE GARDE. Un rapport destiné à une Direction s'ouvre sur ce qu'il est et pour
  // quelle période — pas sur un tableau. Les trois chiffres donnent le ton avant même
  // qu'on tourne la page : l'activité, ce qu'elle a coûté en absence, et la gravité.
  blocs.push({
    type: 'couverture',
    titre: t('rapports.printTitre'),
    periode,
    edite: formatDate(new Date(), { day: '2-digit', month: 'long', year: 'numeric' }),
    destinataire: t('rapports.printDestinataire'),
    faits: vide ? undefined : [
      { label: t('rapports.kpiConsultations'), valeur: c.totalConsultations },
      { label: t('rapports.kpiJoursArret'), valeur: c.repos.totalJours },
      { label: t('rapports.kpiAccidents'), valeur: at },
    ],
  })

  if (vide) {
    blocs.push({ type: 'synthese', titre: t('rapports.syntheseTitle'), texte: `${t('rapports.periodeVide')} ${t('rapports.periodeVideHint')}` })
  } else {
    // ── 1. Ce qu'il faut retenir, les alertes, la tendance ──────────────────
    if ((c.alertes ?? []).length > 0) {
      blocs.push({
        type: 'alertes',
        titre: t('rapports.alertesPrint'),
        items: (c.alertes ?? []).map(a => ({
          ton: a.niveau,
          texte: t(`rapports.alerte.${a.code}`, a.params),
        })),
      })
    }
    blocs.push({ type: 'synthese', titre: t('rapports.syntheseTitle'), texte: phrasesSynthese(rapport, t) })

    const serie = c.serie ?? []
    if (serie.length >= 2) {
      blocs.push({
        type: 'barres',
        titre: t('rapports.tendanceTitle'),
        points: serie.map((p, i) => ({
          label: formatDate(p.debut, { day: '2-digit', month: 'short' }),
          valeur: p.consultations,
          courant: i === serie.length - 1,
        })),
      })
    }

    // ── 2. Les cinq volets, dans l'ordre de l'écran ─────────────────────────
    if (v) {
      blocs.push({
        type: 'indicateurs',
        titre: t('rapports.voletActivite'),
        items: [
          { label: t('rapports.kpiVisites'), valeur: v.activite.visites, hint: t('rapports.kpiVisitesHint') },
          { label: t('rapports.kpiConsultations'), valeur: c.totalConsultations, hint: t('rapports.kpiConsultationsHint') },
          ...(tauxPassage !== null
            ? [{ label: t('rapports.kpiTauxPassage'), valeur: `${tauxPassage} %`, hint: t('rapports.kpiTauxPassageHint') }]
            : []),
          { label: t('rapports.kpiEvacuations'), valeur: v.activite.evacuations, hint: t('rapports.kpiEvacuationsHint') },
        ],
      })
      blocs.push(...poserRepartitions(
        (v.activite.parMotif ?? []).length
          ? [tableauRepartition(t('rapports.parMotif'), t('rapports.parMotifHint'), t('rapports.printMotif'), t('rapports.printNombre'), v.activite.parMotif!)]
          : [],
      ))

      blocs.push({
        type: 'indicateurs',
        titre: t('rapports.voletSanteTravail'),
        items: [
          { label: t('rapports.kpiAccidents'), valeur: at, hint: t('rapports.kpiAccidentsHint') },
          { label: t('rapports.kpiJoursArret'), valeur: c.repos.totalJours, hint: t('rapports.kpiJoursArretHint') },
          { label: t('rapports.kpiCertificats'), valeur: v.santeTravail.certificats, hint: t('rapports.kpiCertificatsHint') },
        ],
      })

      blocs.push({
        type: 'indicateurs',
        titre: t('rapports.voletPopulation'),
        items: [
          { label: t('rapports.kpiNouveauxDossiers'), valeur: v.population.nouveauxDossiers, hint: t('rapports.kpiNouveauxDossiersHint') },
          { label: t('rapports.kpiDossiersActifs'), valeur: v.population.dossiersActifs, hint: t('rapports.kpiEtatHint') },
        ],
      })
      blocs.push(...poserRepartitions(
        (v.population.parCategorie ?? []).length
          ? [tableauRepartition(t('rapports.parCategoriePop'), t('rapports.parCategoriePopHint'), t('rapports.printCategorie'), t('rapports.printNombre'), v.population.parCategorie!)]
          : [],
      ))

      blocs.push({
        type: 'indicateurs',
        titre: t('rapports.voletPharmacie'),
        items: [
          { label: t('rapports.kpiOrdonnances'), valeur: v.pharmacieExamens.ordonnances, hint: t('rapports.kpiFluxHint') },
          { label: t('rapports.kpiBonsExamen'), valeur: v.pharmacieExamens.bonsExamen, hint: t('rapports.kpiFluxHint') },
          { label: t('rapports.kpiResultats'), valeur: v.pharmacieExamens.resultatsRecus, hint: t('rapports.kpiResultatsHint') },
        ],
      })
      blocs.push(...poserRepartitions([
        ...((v.pharmacieExamens.parMedicament ?? []).length
          ? [tableauRepartition(t('rapports.parMedicament'), t('rapports.parMedicamentHint'), t('rapports.printMedicament'), t('rapports.printNombre'), v.pharmacieExamens.parMedicament!)]
          : []),
        ...((v.pharmacieExamens.parExamen ?? []).length
          ? [tableauRepartition(t('rapports.parExamen'), t('rapports.parExamenHint'), t('rapports.printExamen'), t('rapports.printNombre'), v.pharmacieExamens.parExamen!)]
          : []),
      ]))

      blocs.push({
        type: 'indicateurs',
        titre: t('rapports.voletSuivi'),
        items: [
          { label: t('rapports.kpiChroniques'), valeur: v.suiviRisques.suivisChroniques, hint: t('rapports.kpiEtatHint') },
          { label: t('rapports.kpiGrossesses'), valeur: v.suiviRisques.grossessesSuivies, hint: t('rapports.kpiEtatHint') },
          { label: t('rapports.kpiAlertes'), valeur: v.suiviRisques.alertesActives, hint: t('rapports.kpiAlertesHint') },
        ],
      })
    }

    // ── 3. Les trois découpages des consultations, puis les pathologies ─────
    blocs.push(...poserRepartitions([
      ...(c.parType.length ? [tableauRepartition(t('rapports.byType'), t('rapports.byTypeHint', { count: c.totalConsultations }), t('rapports.printType'), t('rapports.printNombre'), c.parType)] : []),
      ...(c.parCategorie.length ? [tableauRepartition(t('rapports.byCategory'), t('rapports.byCategoryHint', { count: c.totalConsultations }), t('rapports.printCategorie'), t('rapports.printNombre'), c.parCategorie)] : []),
      ...(c.parDepartement.length ? [tableauRepartition(t('rapports.byDepartment'), t('rapports.byDepartmentHint', { count: c.totalConsultations }), t('rapports.printDepartement'), t('rapports.printNombre'), c.parDepartement)] : []),
      ...(c.parPathologie.length ? [tableauRepartition(t('rapports.topPathologies'), t('rapports.topPathologiesHint'), t('rapports.printPathologie'), t('rapports.printNombre'), c.parPathologie)] : []),
    ]))
  }

  return (
    <ListePrintSheet
      rootId={ROOT_ID}
      titre={t('rapports.printTitre')}
      sousTitre={`${t(`rapports.type${rapport.type}`)} · ${periode}`}
      blocs={blocs}
      libelleSuite={t('rapports.printSuite')}
      piedGauche={t('rapports.printPied')}
      onClose={onClose}
    />
  )
}
