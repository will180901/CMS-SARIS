/**
 * SyntheseRapport — ce qu'il faut retenir, avant les chiffres.
 *
 * POURQUOI CE BLOC. Les rapports affichaient des compteurs et laissaient le lecteur faire
 * lui-même le travail d'interprétation — qu'en pratique il ne fait pas. « 5 consultations »
 * ne dit rien : ni beaucoup, ni peu, ni en hausse. On ouvre donc désormais par trois
 * choses, dans cet ordre :
 *
 *   1. les ALERTES — ce qui sort de l'ordinaire, et rien d'autre ;
 *   2. la SYNTHÈSE — quelques phrases en français qui disent ce qu'il faut retenir ;
 *   3. la TENDANCE — six périodes, pour situer celle qu'on lit.
 *
 * Les phrases sont composées ICI et non sur le serveur : le rapport stocké contient des
 * données et des codes d'alerte, jamais du texte. Un texte figé au moment de la génération
 * serait en français pour tout le monde, et faux le jour où l'on change une formulation.
 */
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Info, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { ContenuRapport } from '../api/rapports.api'

// ── Alertes ───────────────────────────────────────────────────────────────────

const TON_ALERTE = {
  critique:  { fond: 'var(--erreur-fond)',  texte: 'var(--erreur-texte)',  Icone: AlertTriangle },
  attention: { fond: 'var(--avert-fond)',   texte: 'var(--avert-texte)',   Icone: AlertTriangle },
  info:      { fond: 'var(--info-fond)',    texte: 'var(--info-texte)',    Icone: Info },
} as const

// ── Composant ─────────────────────────────────────────────────────────────────

export function SyntheseRapport({ contenu }: { contenu: ContenuRapport }) {
  const { t } = useTranslation()

  const total = contenu.totalConsultations
  const avant = contenu.precedent?.totalConsultations ?? null
  const jours = contenu.repos.totalJours
  const alertes = contenu.alertes ?? []
  const serie = contenu.serie ?? []

  // Évolution : uniquement si la période précédente avait de quoi comparer. Un écart
  // calculé sur un ou deux actes est un artefact, pas une tendance.
  const ecart =
    avant !== null && avant >= 3 ? Math.round(((total - avant) / avant) * 100) : null

  // Phrases de synthèse, construites à partir des seules données.
  const phrases: string[] = []
  phrases.push(t('rapports.syntheseActes', { count: total }))
  if (ecart !== null) {
    phrases.push(
      t('rapports.syntheseEvolution', {
        signe: ecart > 0 ? '+' : ecart < 0 ? '−' : '',
        pct: Math.abs(ecart),
        avant,
      }),
    )
  } else if (avant === null) {
    phrases.push(t('rapports.synthesePremiere'))
  }
  const dominant = [...contenu.parType].sort((a, b) => b.count - a.count)[0]
  if (dominant && total > 0) {
    phrases.push(
      t('rapports.syntheseDominant', {
        libelle: dominant.libelle,
        pct: Math.round((dominant.count / total) * 100),
      }),
    )
  }
  phrases.push(
    jours > 0
      ? t('rapports.syntheseRepos', {
          jours,
          count: contenu.repos.consultationsAvecRepos,
        })
      : t('rapports.syntheseSansRepos'),
  )

  const TendanceIcone = ecart === null ? Minus : ecart > 0 ? TrendingUp : ecart < 0 ? TrendingDown : Minus
  const tonEcart =
    ecart === null || ecart === 0
      ? 'var(--texte-tertiaire)'
      : ecart > 0
        ? 'var(--succes-accent)'
        : 'var(--avert-texte)'

  // PERIODE SANS ACTIVITE. Un mur de zeros se lit comme une panne : on croit que le
  // rapport n'a pas su calculer, alors qu'il n'y avait simplement rien a compter. On le
  // DIT, une bonne fois, en tete — et on se tait sur le reste.
  const vide = total === 0 && (contenu.volets?.activite.visites ?? 0) === 0
  if (vide) {
    return (
      <div style={{
        padding: 'var(--espace-5)', borderRadius: 'var(--radius-lg)',
        background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)',
        textAlign: 'center',
      }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-body)', fontWeight: 600, color: 'var(--texte-primaire)' }}>
          {t('rapports.periodeVide')}
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-tertiaire)', lineHeight: 1.5 }}>
          {t('rapports.periodeVideHint')}
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>
      {/* ── Alertes ─────────────────────────────────────────────────────────── */}
      {alertes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alertes.map((a, i) => {
            const ton = TON_ALERTE[a.niveau] ?? TON_ALERTE.info
            return (
              <div
                key={`${a.code}-${i}`}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 9,
                  padding: '9px 12px', borderRadius: 'var(--radius-md)',
                  background: ton.fond, color: ton.texte,
                  fontSize: 'var(--font-size-body-sm)', lineHeight: 1.45, fontWeight: 500,
                }}>
                <ton.Icone size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{t(`rapports.alerte.${a.code}`, a.params)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Synthèse rédigée ────────────────────────────────────────────────── */}
      <div style={{
        padding: 'var(--espace-4)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--fond-surface-2)',
        border: '1px solid var(--bordure-legere)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <TendanceIcone size={15} style={{ color: tonEcart, flexShrink: 0 }} />
          <p style={{
            margin: 0, fontSize: 'var(--font-size-overline)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)',
          }}>
            {t('rapports.syntheseTitle')}
          </p>
        </div>
        <p style={{
          margin: 0, fontSize: 'var(--font-size-body)', lineHeight: 1.6,
          color: 'var(--texte-primaire)',
        }}>
          {phrases.join(' ')}
        </p>
      </div>

      {/* ── Tendance ────────────────────────────────────────────────────────── */}
      {serie.length >= 2 && <Tendance serie={serie} t={t} />}
    </div>
  )
}

// ── Courbe de tendance ────────────────────────────────────────────────────────

/**
 * Six périodes en barres, la dernière étant celle qu'on lit — mise en évidence.
 *
 * Des barres et non une courbe : les périodes sont des blocs de temps distincts, pas un
 * continuum. Une courbe suggérerait des valeurs intermédiaires qui n'existent pas.
 */
function Tendance({
  serie, t,
}: {
  serie: { debut: string; consultations: number }[]
  t: (k: string, o?: Record<string, unknown>) => string
}) {
  const max = Math.max(...serie.map(p => p.consultations), 1)
  return (
    <div>
      <p style={{
        margin: '0 0 10px', fontSize: 'var(--font-size-overline)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)',
      }}>
        {t('rapports.tendanceTitle')}
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90 }}>
        {serie.map((p, i) => {
          const courant = i === serie.length - 1
          const h = Math.max(3, Math.round((p.consultations / max) * 68))
          return (
            <div key={p.debut} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 4, minWidth: 0,
            }}>
              <span style={{
                fontSize: 11, fontWeight: courant ? 700 : 500,
                color: courant ? 'var(--texte-primaire)' : 'var(--texte-tertiaire)',
              }}>
                {p.consultations}
              </span>
              <div style={{
                width: '100%', height: h, borderRadius: 4,
                background: courant ? 'var(--ap-400)' : 'var(--ap-100)',
              }} />
              <span style={{
                fontSize: 10, color: 'var(--texte-tertiaire)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
              }}>
                {new Date(p.debut).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
