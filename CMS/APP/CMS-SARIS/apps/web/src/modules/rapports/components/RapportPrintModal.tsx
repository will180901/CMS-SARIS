/**
 * RapportPrintModal — le rapport sur le gabarit A4 maison, pas un export brut.
 *
 * L'export PDF passait par une feuille bricolée, sans rapport visuel avec les documents
 * médicaux du reste de l'application. Un rapport destiné à la Direction Générale ne peut
 * pas être moins soigné qu'un bon d'examen.
 *
 * On réutilise donc `MedicalPrintSheet`, le gabarit A4 commun à tous les documents :
 * même en-tête, même typographie, même pied de signature. Et on lui donne ce qu'il sait
 * le mieux rendre — du TEXTE (`PrintProse`) et des TABLEAUX (`PrintTable`) — au lieu de
 * graphiques qui s'impriment mal et se lisent moins bien sur papier.
 */
import { useTranslation } from 'react-i18next'
import {
  MedicalPrintSheet, PrintSection, PrintProse, PrintTable, PrintCallout,
} from '@/components/print/MedicalPrintSheet'
import { formatDate } from '@/lib/intl'
import type { RapportDetail, Repartition } from '../api/rapports.api'

const ROOT_ID = 'rapport-print-sheet'

function Tableau({ rows, colLibelle, colNombre }: { rows?: Repartition[]; colLibelle: string; colNombre: string }) {
  if (!rows || rows.length === 0) return null
  const total = rows.reduce((s, r) => s + r.count, 0)
  return (
    <PrintTable
      columns={[
        { key: 'libelle', label: colLibelle },
        { key: 'count', label: colNombre, width: 70, align: 'center' },
        { key: 'part', label: '%', width: 60, align: 'center' },
      ]}
      rows={rows.map(r => ({
        libelle: r.libelle,
        count: r.count,
        // La part evite au lecteur de faire la division lui-meme — c'est tout l'interet
        // d'un rapport imprime, qu'on lit sans calculatrice.
        part: total > 0 ? `${Math.round((r.count / total) * 100)} %` : '—',
      }))}
    />
  )
}

export function RapportPrintModal({ rapport, onClose }: { rapport: RapportDetail; onClose: () => void }) {
  const { t } = useTranslation()
  const c = rapport.contenu
  const v = c.volets
  const periode = `${formatDate(rapport.periodeDebut, { day: '2-digit', month: 'long', year: 'numeric' })} → ${formatDate(rapport.periodeFin, { day: '2-digit', month: 'long', year: 'numeric' })}`

  const at = c.parType.find(x => /accident/i.test(x.libelle))?.count ?? 0
  const avant = c.precedent?.totalConsultations ?? null
  const ecart = avant !== null && avant >= 3
    ? Math.round(((c.totalConsultations - avant) / avant) * 100)
    : null

  const phrases = [
    t('rapports.syntheseActes', { count: c.totalConsultations }),
    ecart !== null
      ? t('rapports.syntheseEvolution', { signe: ecart > 0 ? '+' : ecart < 0 ? '−' : '', pct: Math.abs(ecart), avant })
      : '',
    c.repos.totalJours > 0
      ? t('rapports.syntheseRepos', { jours: c.repos.totalJours, count: c.repos.consultationsAvecRepos })
      : t('rapports.syntheseSansRepos'),
  ].filter(Boolean).join(' ')

  return (
    <MedicalPrintSheet
      rootId={ROOT_ID}
      titre={t('rapports.printTitre')}
      apercuLabel={t('rapports.printApercu')}
      numero={rapport.id.slice(0, 8).toUpperCase()}
      date={rapport.genereLe}
      // Le gabarit est prevu pour un document NOMINATIF. Un rapport n'a pas de patient :
      // on lui presente la PERIODE a la place, ce qui garde l'en-tete informatif au lieu
      // de le laisser vide.
      patient={{ identite: { nom: t('rapports.printPorte'), prenom: periode } } as never}
      soignant={undefined as never}
      soignantTitle={t('rapports.printEmisPar')}
      firstSignatureLabel={t('rapports.printSignature')}
      secondSignatureLabel={t('rapports.printVisa')}
      onClose={onClose}
    >
      {/* ── Ce qu'il faut retenir ─────────────────────────────────────────────── */}
      <PrintSection titre={t('rapports.syntheseTitle')}>
        <PrintProse>{phrases}</PrintProse>
      </PrintSection>

      {/* ── Alertes ───────────────────────────────────────────────────────────── */}
      {(c.alertes ?? []).length > 0 && (
        <PrintSection titre={t('rapports.alertesPrint')}>
          {(c.alertes ?? []).map((a, i) => (
            <PrintCallout key={`${a.code}-${i}`} tone={a.niveau === 'critique' ? 'danger' : 'info'}>
              {t(`rapports.alerte.${a.code}`, a.params)}
            </PrintCallout>
          ))}
        </PrintSection>
      )}

      {/* ── Chiffres clés, en tableau : lisible sans graphique ────────────────── */}
      <PrintSection titre={t('rapports.printChiffres')}>
        <PrintTable
          columns={[
            { key: 'ind', label: t('rapports.printIndicateur') },
            { key: 'val', label: t('rapports.printValeur'), width: 90, align: 'center' },
          ]}
          rows={[
            { ind: t('rapports.kpiVisites'), val: v?.activite.visites ?? '—' },
            { ind: t('rapports.kpiConsultations'), val: c.totalConsultations },
            { ind: t('rapports.kpiAccidents'), val: at },
            { ind: t('rapports.kpiJoursArret'), val: c.repos.totalJours },
            { ind: t('rapports.kpiCertificats'), val: v?.santeTravail.certificats ?? '—' },
            { ind: t('rapports.kpiEvacuations'), val: v?.activite.evacuations ?? '—' },
            { ind: t('rapports.kpiNouveauxDossiers'), val: v?.population.nouveauxDossiers ?? '—' },
            { ind: t('rapports.kpiDossiersActifs'), val: v?.population.dossiersActifs ?? '—' },
            { ind: t('rapports.kpiOrdonnances'), val: v?.pharmacieExamens.ordonnances ?? '—' },
            { ind: t('rapports.kpiBonsExamen'), val: v?.pharmacieExamens.bonsExamen ?? '—' },
          ]}
        />
      </PrintSection>

      {/* ── Répartitions, chacune en tableau avec sa part ─────────────────────── */}
      <PrintSection titre={t('rapports.byType')}>
        <Tableau rows={c.parType} colLibelle={t('rapports.printType')} colNombre={t('rapports.printNombre')} />
      </PrintSection>

      <PrintSection titre={t('rapports.byDepartment')}>
        <Tableau rows={c.parDepartement} colLibelle={t('rapports.printDepartement')} colNombre={t('rapports.printNombre')} />
      </PrintSection>

      {v?.activite.parMotif?.length ? (
        <PrintSection titre={t('rapports.parMotif')}>
          <Tableau rows={v.activite.parMotif} colLibelle={t('rapports.printMotif')} colNombre={t('rapports.printNombre')} />
        </PrintSection>
      ) : null}

      {v?.pharmacieExamens.parMedicament?.length ? (
        <PrintSection titre={t('rapports.parMedicament')}>
          <Tableau rows={v.pharmacieExamens.parMedicament} colLibelle={t('rapports.printMedicament')} colNombre={t('rapports.printNombre')} />
        </PrintSection>
      ) : null}

      {c.parPathologie.length > 0 && (
        <PrintSection titre={t('rapports.topPathologies')}>
          <Tableau rows={c.parPathologie} colLibelle={t('rapports.printPathologie')} colNombre={t('rapports.printNombre')} />
        </PrintSection>
      )}
    </MedicalPrintSheet>
  )
}
