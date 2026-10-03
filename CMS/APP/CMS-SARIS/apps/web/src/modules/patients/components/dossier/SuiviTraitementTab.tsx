/**
 * SuiviTraitementTab — onglet « Suivi de traitement » du Parcours de soins.
 * Regroupe tout ce qui concerne le suivi clinique dans la durée (recueil) :
 *   1. Épisodes de suivi de traitement (contrôle d'état de santé, évolution
 *      d'une maladie, prise des médicaments) — ouverts depuis une consultation
 *      clôturée, gérés ensuite uniquement depuis le dossier (fiches datées).
 *   2. Constantes vitales — historique complet, toutes visites confondues.
 *   3. Évolution des pathologies chroniques (fréquence/objectifs de suivi).
 *   4. Historique des traitements (lignes d'ordonnances validées).
 *   5. Résultats d'examens en attente de saisie — point d'entrée découvrable.
 *   6. Résultats d'examens déjà reçus.
 * Calculé sur l'historique COMPLET du patient (dossier centralisé) — chaque
 * ligne cliquable ouvre son détail dans un TIROIR qui glisse de la droite,
 * la liste reste visible derrière (jamais de redirection hors du dossier).
 */
import { useMemo, useState } from 'react'
import { humanizeCode } from '@/config/labels'
import { useTranslation } from 'react-i18next'
import { nomSoignant } from '@/lib/soignant'
import {
  Activity, TrendingUp, Pill, FlaskConical, Loader2, ChevronRight, Plus, Pencil,
  CircleCheck, HeartPulse, PenLine, Thermometer, Wind, Weight, Ruler, Gauge,
  TrendingDown, Minus, Droplet,
} from 'lucide-react'
import { StatusPill, Modal, Button, SelectBox, Textarea } from '@/components/saris'
import { DrawerShell } from '@/modules/referentiels/components/DrawerShell'
import { usePermissions } from '@/hooks/usePermissions'
import { formatDate, formatTime } from '@/lib/intl'
import { labelStatut } from '@/config/labels'
import { usePatientSuivi, useCreateSuiviChronique, useUpdateSuiviChronique, usePatientConstantes } from '../../hooks/usePatients'
import { useSuivisTraitement } from '@/modules/suivi-traitement/hooks/useSuiviTraitement'
import { DossierDetailDrawer } from './DossierDetailPanel'
import type { DossierDetailTarget } from './DossierDetailPanel'
import { FREQUENCES_SUIVI } from '../../api/patients.api'
import type { SuiviChroniqueItem, SuiviTraitementItem, SuiviResultatExamenItem, SuiviResultatEnAttenteItem } from '../../api/patients.api'
import type { ConstanteVitale } from '@cms-saris/types'

// ── En-têtes / états partagés ────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ color: 'var(--ap-600)', display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--texte-primaire)' }}>{title}</span>
    </div>
  )
}

function EmptySection({ text }: { text: string }) {
  return <p style={{ fontSize: 13, color: 'var(--texte-tertiaire)', fontStyle: 'italic', margin: 0 }}>{text}</p>
}

// ── Ligne cliquable générique ─────────────────────────────────────────────────

function ClickableRow({
  icon, tint, bg, title, subtitle, badge, badgeTone, date, onClick,
}: {
  icon: React.ReactNode
  tint: string
  bg:   string
  title: string
  subtitle?: string
  badge?: string
  badgeTone?: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'accent' | 'gold'
  date: string
  onClick?: () => void
}) {
  const clickable = !!onClick
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)',
        borderRadius: 8, padding: '11px 13px',
        cursor: clickable ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', gap: 12,
        transition: 'border-color 0.12s, background 0.12s',
      }}
      onMouseEnter={ev => { if (clickable) { ev.currentTarget.style.borderColor = 'var(--ap-300)'; ev.currentTarget.style.background = 'var(--fond-surface-2)' } }}
      onMouseLeave={ev => { ev.currentTarget.style.borderColor = 'var(--bordure-legere)'; ev.currentTarget.style.background = 'var(--fond-surface)' }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: bg, color: tint,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--texte-primaire)' }}>{title}</span>
          {badge && <StatusPill tone={badgeTone ?? 'neutral'}>{badge}</StatusPill>}
        </div>
        {subtitle && (
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--texte-secondaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--texte-tertiaire)' }}>{formatDate(date, { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
        <div style={{ fontSize: 10, color: 'var(--texte-quaternaire)' }}>{formatTime(date, { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
      {clickable && <ChevronRight size={15} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />}
    </button>
  )
}

// ── 1. Épisodes de suivi de traitement (NOUVEAU) ─────────────────────────────

const STATUT_SUIVI: Record<string, { labelKey: string; tint: string; bg: string }> = {
  EN_COURS: { labelKey: 'suiviTraitement.statutEnCours', tint: 'var(--info-texte)',   bg: 'var(--info-fond)'   },
  CLOTURE:  { labelKey: 'suiviTraitement.statutCloture', tint: 'var(--succes-texte)', bg: 'var(--succes-fond)' },
  ANNULE:   { labelKey: 'suiviTraitement.statutAnnule',  tint: 'var(--texte-tertiaire)', bg: 'var(--fond-surface-2)' },
}

function EpisodesSection({ patientId, onOpen, historiqueRestreint = false }: { patientId: string; onOpen: (t: DossierDetailTarget) => void; historiqueRestreint?: boolean }) {
  const { t } = useTranslation()
  const { data: episodes = [], isLoading, isError, refetch } = useSuivisTraitement({ patientId })

  return (
    <div>
      <SectionHeader icon={<Activity size={14} />} title={t('suiviTraitement.cardTitle')} />
      {isError ? (
        <ErreurChargement onRetry={() => { void refetch() }} />
      ) : isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--texte-tertiaire)' }}>
          <Loader2 size={14} className="animate-spin" /> <span style={{ fontSize: 13 }}>{t('patients.loading')}</span>
        </div>
      ) : episodes.length === 0 ? (
        <EmptySection text={t(historiqueRestreint ? 'patients.suiviEpisodesEmptyEnCours' : 'suiviTraitement.emptyTitle')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
          {episodes.map(ep => {
            const cfg = STATUT_SUIVI[ep.statut] ?? STATUT_SUIVI.EN_COURS
            return (
              <ClickableRow
                key={ep.id}
                icon={<Activity size={14} />} tint="var(--ap-600)" bg="var(--ap-50)"
                title={ep.motif}
                subtitle={t('suiviTraitement.fichesTitle') + ` · ${ep.fiches.length}`}
                badge={t(cfg.labelKey)}
                badgeTone={ep.statut === 'EN_COURS' ? 'info' : ep.statut === 'CLOTURE' ? 'success' : 'neutral'}
                date={ep.createdAt}
                onClick={() => onOpen({ kind: 'SUIVI_TRAITEMENT', consultationId: ep.consultationId, suiviId: ep.id })}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── 2. Constantes vitales ─────────────────────────────────────────────────────

type Sev = 'normal' | 'warning' | 'danger'
const SEV_COLOR: Record<Sev, string> = {
  normal:  'var(--texte-primaire)',
  warning: 'var(--avert-texte)',
  danger:  'var(--erreur-texte)',
}
function tempSev(v?: number | null): Sev { if (v == null) return 'normal'; return v >= 38.5 ? 'danger' : v >= 37.5 ? 'warning' : v < 35 ? 'warning' : 'normal' }
function taSev(v?: number | null): Sev { if (v == null) return 'normal'; return v >= 160 ? 'danger' : v >= 140 ? 'warning' : v < 90 ? 'warning' : 'normal' }
function spo2Sev(v?: number | null): Sev { if (v == null) return 'normal'; return v < 90 ? 'danger' : v < 95 ? 'warning' : 'normal' }
function fcSev(v?: number | null): Sev { if (v == null) return 'normal'; return v >= 120 || v < 50 ? 'danger' : v >= 100 || v < 60 ? 'warning' : 'normal' }

/**
 * Mini-courbe placée sur le TEMPS (constat 77) : avant, les points étaient espacés par
 * rang — trois mesures sur trois mois ressemblaient à trois mesures sur trois jours, et
 * une évolution lente passait pour une chute brutale.
 */
function Sparkline({ points, color }: { points: Point[]; color: string }) {
  if (points.length < 2) return <div style={{ height: 28 }} />
  const w = 104, h = 28, pad = 3
  const values = points.map(p => p.v)
  const temps = points.map(p => new Date(p.date).getTime())
  const t0 = Math.min(...temps), t1 = Math.max(...temps)
  const duree = t1 - t0 || 1
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = pad + ((temps[i]! - t0) / duree) * (w - 2 * pad)
    const y = h - pad - ((v - min) / range) * (h - 2 * pad)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const last = pts[pts.length - 1].split(',')
  return (
    <svg width={w} height={h} style={{ display: 'block' }} aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill={color} />
    </svg>
  )
}

/** Une mesure : sa valeur ET sa date, inseparables. Les separer est precisement ce qui
 *  faisait afficher une ancienne valeur comme la derniere, sans pouvoir dire de quand. */
type Point = { v: number; date: string }

function VitalCard({ icon, label, unit, points, sevOf }: {
  icon: React.ReactNode; label: string; unit: string; points: Point[]
  /** Gravite calculee sur LA MEME mesure que la valeur affichee — pas sur une autre. */
  sevOf?: (v: number) => Sev
}) {
  const { t } = useTranslation()
  const series  = points.map(p => p.v)
  const dernier = points.length ? points[points.length - 1] : null
  const latest  = dernier ? dernier.v : null
  const sev: Sev = dernier && sevOf ? sevOf(dernier.v) : 'normal'
  const prev    = series.length > 1 ? series[series.length - 2] : null
  const delta  = latest != null && prev != null ? latest - prev : null
  const Trend  = delta == null || Math.abs(delta) < 1e-9 ? Minus : delta > 0 ? TrendingUp : TrendingDown

  return (
    <div style={{
      border: '1px solid var(--bordure-legere)', borderRadius: 10,
      background: 'var(--fond-surface)', padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--texte-tertiaire)', display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--texte-tertiaire)' }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: latest == null ? 'var(--texte-tertiaire)' : SEV_COLOR[sev], lineHeight: 1 }}>
          {latest == null ? '—' : latest}
        </span>
        {latest != null && <span style={{ fontSize: 11, color: 'var(--texte-tertiaire)' }}>{unit}</span>}
        {delta != null && (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: delta === 0 ? 'var(--texte-tertiaire)' : 'var(--texte-secondaire)' }}>
            <Trend size={12} /> {delta === 0 ? '' : `${delta > 0 ? '+' : ''}${Math.round(delta * 10) / 10}`}
          </span>
        )}
      </div>
      {dernier && (
        <span style={{ fontSize: 11, color: 'var(--texte-tertiaire)', marginTop: -4 }}>
          {t('patients.vitalMeasuredOn', { date: formatDate(dernier.date) })}
        </span>
      )}
      <Sparkline points={points} color="var(--ap-400)" />
    </div>
  )
}

function Cell({ children, sev = 'normal', mono }: { children: React.ReactNode; sev?: Sev; mono?: boolean }) {
  return (
    <td style={{
      padding: '8px 10px', fontSize: 12, whiteSpace: 'nowrap',
      color: SEV_COLOR[sev], fontWeight: sev === 'normal' ? 500 : 700,
      fontFamily: mono ? 'monospace' : undefined,
      borderBottom: '1px solid var(--bordure-legere)',
    }}>
      {children ?? <span style={{ color: 'var(--texte-quaternaire)' }}>—</span>}
    </td>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      padding: '8px 10px', fontSize: 10, textAlign: 'left', whiteSpace: 'nowrap',
      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
      color: 'var(--texte-tertiaire)', borderBottom: '1px solid var(--bordure-normale)',
      position: 'sticky', top: 0, background: 'var(--fond-surface-2)', zIndex: 1,
    }}>
      {children}
    </th>
  )
}

function ConstantesSection({ patientId, historiqueRestreint }: { patientId: string; historiqueRestreint: boolean }) {
  const { t } = useTranslation()
  const { data: constantes = [], isLoading, isError, refetch } = usePatientConstantes(patientId)

  const series = useMemo(() => {
    const asc = [...constantes].reverse()
    // Chaque valeur garde la date de SA mesure.
    const pick = (k: keyof ConstanteVitale): Point[] => asc
      .filter(c => typeof c[k] === 'number')
      .map(c => ({ v: c[k] as number, date: c.createdAt }))
    return {
      temperature:        pick('temperature'),
      tensionSystolique:  pick('tensionSystolique'),
      frequenceCardiaque: pick('frequenceCardiaque'),
      saturationO2:       pick('saturationO2'),
      poids:              pick('poids'),
      imc:                pick('imc'),
      glycemie: pick('glycemie'),
    }
  }, [constantes])
  const aGlycemie   = constantes.some(c => c.glycemie != null)
  const aTaille     = constantes.some(c => c.taille != null)
  const aGlasgow    = constantes.some(c => c.scoreGlasgow != null)
  const aConscience = constantes.some(c => !!c.etatConscience)
  const aSuivi      = constantes.some(c => c.origine === 'SUIVI')

  return (
    <div>
      <SectionHeader icon={<HeartPulse size={14} />} title={t('patients.vitalsTitle')} />
      {isError ? (
        <ErreurChargement onRetry={() => { void refetch() }} />
      ) : isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--texte-tertiaire)' }}>
          <Loader2 size={14} className="animate-spin" /> <span style={{ fontSize: 13 }}>{t('patients.loading')}</span>
        </div>
      ) : constantes.length === 0 ? (
        <EmptySection text={t(historiqueRestreint ? 'patients.vitalsEmptyEnCours' : 'patients.vitalsEmptyTitle')} />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
            <VitalCard icon={<Thermometer size={13} />} label={t('patients.vitalTemperature')} unit="°C"    points={series.temperature}        sevOf={tempSev} />
            <VitalCard icon={<Gauge size={13} />}       label={t('patients.vitalTensionSys')}  unit="mmHg"  points={series.tensionSystolique}  sevOf={taSev} />
            <VitalCard icon={<HeartPulse size={13} />}  label={t('patients.vitalHeartRate')}   unit="bpm"   points={series.frequenceCardiaque} sevOf={fcSev} />
            <VitalCard icon={<Wind size={13} />}        label={t('patients.vitalSpo2')}        unit="%"     points={series.saturationO2}       sevOf={spo2Sev} />
            <VitalCard icon={<Weight size={13} />}      label={t('patients.vitalWeight')}      unit="kg"    points={series.poids} />
            <VitalCard icon={<Ruler size={13} />}       label={t('patients.vitalImc')}         unit="kg/m²" points={series.imc} />
            {aGlycemie && <VitalCard icon={<Droplet size={13} />} label={t('patients.colGlycemie')} unit="g/L" points={series.glycemie} />}
          </div>
          {/* Glycémie, taille, score de Glasgow, état de conscience : saisis au triage mais
              jamais montrés (constat 76) — la glycémie d'un diabétique suivi était introuvable.
              Colonnes affichées dès qu'au moins une mesure existe, masquées sinon. */}
          <div style={{ border: '1px solid var(--bordure-legere)', borderRadius: 10, overflow: 'auto', maxHeight: 360 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>{t('patients.colDate')}</Th>
                  <Th>{t('patients.colTemp')}</Th>
                  <Th>{t('patients.colTension')}</Th>
                  <Th>{t('patients.colFc')}</Th>
                  <Th>{t('patients.colFreqResp')}</Th>
                  <Th>{t('patients.colSpo2')}</Th>
                  <Th>{t('patients.colWeight')}</Th>
                  <Th>{t('patients.colImc')}</Th>
                  {aGlycemie && <Th>{t('patients.colGlycemie')}</Th>}
                  {aTaille && <Th>{t('patients.colTaille')}</Th>}
                  {aGlasgow && <Th>{t('patients.colGlasgow')}</Th>}
                  {aConscience && <Th>{t('patients.colConscience')}</Th>}
                  {aSuivi && <Th>{t('patients.colOrigine')}</Th>}
                  <Th>{t('patients.colSaisiePar')}</Th>
                </tr>
              </thead>
              <tbody>
                {constantes.map(c => (
                  <tr key={c.id}>
                    <Cell mono>
                      {formatDate(c.createdAt, { day: '2-digit', month: '2-digit', year: '2-digit' })}{' '}
                      <span style={{ color: 'var(--texte-tertiaire)' }}>{formatTime(c.createdAt, { hour: '2-digit', minute: '2-digit' })}</span>
                    </Cell>
                    <Cell sev={tempSev(c.temperature)}>{c.temperature != null ? `${c.temperature}°` : null}</Cell>
                    <Cell sev={taSev(c.tensionSystolique)}>{c.tensionSystolique != null ? `${c.tensionSystolique}/${c.tensionDiastolique ?? '—'}` : null}</Cell>
                    <Cell sev={fcSev(c.frequenceCardiaque)}>{c.frequenceCardiaque ?? null}</Cell>
                    <Cell>{c.frequenceRespiratoire ?? null}</Cell>
                    <Cell sev={spo2Sev(c.saturationO2)}>{c.saturationO2 != null ? `${c.saturationO2}%` : null}</Cell>
                    <Cell>{c.poids != null ? `${c.poids} kg` : null}</Cell>
                    <Cell>{c.imc != null ? c.imc : null}</Cell>
                    {aGlycemie && <Cell>{c.glycemie != null ? `${c.glycemie} g/L` : null}</Cell>}
                    {aTaille && <Cell>{c.taille != null ? `${c.taille} cm` : null}</Cell>}
                    {aGlasgow && <Cell sev={c.scoreGlasgow != null && c.scoreGlasgow <= 8 ? 'danger' : c.scoreGlasgow != null && c.scoreGlasgow < 15 ? 'warning' : 'normal'}>{c.scoreGlasgow ?? null}</Cell>}
                    {aConscience && <Cell>{c.etatConscience ? humanizeCode(c.etatConscience) : null}</Cell>}
                    {aSuivi && <Cell>{c.origine === 'SUIVI' ? t('patients.origineSuivi') : t('patients.origineTriage')}</Cell>}
                    <Cell>{c.saisieParNom}</Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── 3. Pathologies chroniques ─────────────────────────────────────────────────

function CardAction({ icon, label, onClick, accent }: { icon: React.ReactNode; label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
        fontSize: 12, fontWeight: 600,
        border: `1px solid ${accent ? 'var(--ap-300)' : 'var(--bordure-normale)'}`,
        background: accent ? 'var(--ap-50)' : 'var(--fond-surface)',
        color: accent ? 'var(--ap-700)' : 'var(--texte-secondaire)',
      }}
    >
      {icon} {label}
    </button>
  )
}

function ChroniqueCard({ item, patientId, canManage }: { item: SuiviChroniqueItem; patientId: string; canManage: boolean }) {
  const { t } = useTranslation()
  const suivi = item.suivi
  const create = useCreateSuiviChronique(patientId)
  const update = useUpdateSuiviChronique(patientId)

  const clos = item.dernierSuiviClos ?? null
  const [formOpen, setFormOpen]   = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [freq, setFreq]           = useState<string>('Mensuel')
  const [objectifs, setObjectifs] = useState('')
  const [motif, setMotif]         = useState('')

  const openForm = () => {
    setFreq(suivi?.frequenceSuivi ?? 'Mensuel')
    setObjectifs(suivi?.objectifs ?? '')
    setFormOpen(true)
  }

  const lbl = { fontSize: 12, fontWeight: 500 as const, color: 'var(--texte-secondaire)' }
  const dirty = suivi
    ? (freq !== (suivi.frequenceSuivi ?? 'Mensuel') || objectifs !== (suivi.objectifs ?? ''))
    : (freq !== 'Mensuel' || objectifs.trim().length > 0)

  return (
    <div style={{ border: '1px solid var(--bordure-legere)', borderRadius: 8, background: 'var(--fond-surface)', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--texte-primaire)' }}>{item.pathologie.libelle}</span>
        <StatusPill tone="neutral">
          {t(item.occurrences > 1 ? 'patients.suiviOccurrencePlural' : 'patients.suiviOccurrenceSingular', { count: item.occurrences })}
        </StatusPill>
        <StatusPill tone={suivi ? 'success' : 'neutral'}>
          {suivi
            ? t('patients.suiviChroniqueSuiviActif')
            : clos?.closedAt
              ? t('patients.suiviChroniqueClos', { date: formatDate(clos.closedAt) })
              : t('patients.suiviChroniqueSansSuivi')}
        </StatusPill>
      </div>

      {!suivi && clos && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8, fontSize: 12, color: 'var(--texte-secondaire)' }}>
          <span>
            <strong style={{ color: 'var(--texte-tertiaire)', fontWeight: 600 }}>{t('patients.suiviChroniqueCloturePeriode')} : </strong>
            {formatDate(clos.createdAt)}{clos.closedAt ? ` → ${formatDate(clos.closedAt)}` : ''}
            {clos.frequenceSuivi ? ` · ${clos.frequenceSuivi}` : ''}
          </span>
          {clos.motifCloture && <span><strong style={{ color: 'var(--texte-tertiaire)', fontWeight: 600 }}>{t('patients.suiviChroniqueMotif')} : </strong>{clos.motifCloture}</span>}
        </div>
      )}

      {suivi && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8, fontSize: 12, color: 'var(--texte-secondaire)' }}>
          {suivi.frequenceSuivi && <span><strong style={{ color: 'var(--texte-tertiaire)', fontWeight: 600 }}>{t('patients.suiviFrequence')} : </strong>{suivi.frequenceSuivi}</span>}
          {suivi.objectifs && <span><strong style={{ color: 'var(--texte-tertiaire)', fontWeight: 600 }}>{t('patients.suiviObjectifs')} : </strong>{suivi.objectifs}</span>}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--texte-tertiaire)' }}>
          <span>{t('patients.suiviPremierDiagnostic')} : {formatDate(item.premierDiagnostic, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          <span>{t('patients.suiviDernierDiagnostic')} : {formatDate(item.dernierDiagnostic, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>

        {canManage && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {suivi ? (
              <>
                <CardAction icon={<Pencil size={12} />} label={t('patients.suiviModifier')} onClick={openForm} />
                <CardAction icon={<CircleCheck size={12} />} label={t('patients.suiviCloturer')} onClick={() => { setMotif(''); setCloseOpen(true) }} />
              </>
            ) : (
              <CardAction icon={<Plus size={12} />} label={t('patients.suiviDefinir')} accent onClick={openForm} />
            )}
          </div>
        )}
      </div>

      <DrawerShell
        open={formOpen}
        onClose={() => setFormOpen(false)}
        icon={<HeartPulse size={18} />}
        title={suivi ? t('patients.suiviFormTitleEdit') : t('patients.suiviFormTitleCreate')}
        description={item.pathologie.libelle}
        isDirty={dirty}
        isSaving={create.isPending || update.isPending}
        onSave={async () => {
          try {
            if (suivi) await update.mutateAsync({ sId: suivi.id, data: { frequenceSuivi: freq, objectifs } })
            else       await create.mutateAsync({ pathologieId: item.pathologieId, frequenceSuivi: freq, objectifs })
            setFormOpen(false)
          } catch { /* erreur déjà signalée par le toast du hook ; on garde le drawer ouvert */ }
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={lbl}>{t('patients.suiviFieldFrequence')}</span>
            <SelectBox
              size="md" fullWidth value={freq} onChange={setFreq}
              aria-label={t('patients.suiviFieldFrequence')}
              options={FREQUENCES_SUIVI.map(f => ({ value: f, label: f }))}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={lbl}>{t('patients.suiviFieldObjectifs')}</span>
            <Textarea
              value={objectifs}
              onChange={e => setObjectifs(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder={t('patients.suiviObjectifsPlaceholder')}
            />
          </div>
        </div>
      </DrawerShell>

      {closeOpen && suivi && (
        <Modal
          icon={<CircleCheck size={17} />}
          title={t('patients.suiviCloturerTitle')}
          subtitle={item.pathologie.libelle}
          width={460}
          onClose={() => setCloseOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setCloseOpen(false)} disabled={update.isPending}>{t('common.cancel', { defaultValue: 'Annuler' })}</Button>
              <Button
                onClick={async () => { try { await update.mutateAsync({ sId: suivi.id, data: { statut: 'CLOTURE', motifCloture: motif } }); setCloseOpen(false) } catch { /* toast déjà affiché */ } }}
                loading={update.isPending}
                leftIcon={<CircleCheck size={14} />}
              >
                {t('patients.suiviCloturer')}
              </Button>
            </>
          }
        >
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
            {t('patients.suiviCloturerBody')}
          </p>
          <Textarea value={motif} onChange={e => setMotif(e.target.value)} maxLength={300} rows={2} placeholder={t('patients.suiviMotifCloturePlaceholder')} />
        </Modal>
      )}
    </div>
  )
}

// ── Onglets du dossier ────────────────────────────────────────────────────────
//
// Ces cinq vues formaient un 3e niveau d'onglets À L'INTÉRIEUR de « Suivi de
// traitement ». Elles sont désormais des onglets du dossier à part entière, rangés par
// nature (décision utilisateur, étape 5.2) :
//   Dossier médical   — ce que le patient A : pathologies chroniques, constantes
//   Parcours de soins — ce qui a été FAIT : épisodes de suivi, traitements, résultats
// Chacune garde exactement son contenu ; seul son emplacement change.

interface OngletProps {
  patientId: string
  /** Infirmier hors supervision : vue limitée au parcours en cours (messages vides adaptés). */
  historiqueRestreint?: boolean
}

/** Erreur de chargement : DITE comme telle. Avant, elle s'affichait « aucune donnée »
 *  (constat 73) — un soignant pouvait conclure « aucun traitement » sur une panne réseau. */
function ErreurChargement({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--erreur-fond)', border: '1px solid var(--erreur-bordure)', color: 'var(--erreur-texte)', fontSize: 13 }}>
      <span style={{ flex: 1 }}>{t('patients.erreurChargement')}</span>
      <button type="button" onClick={onRetry} style={{ fontSize: 12, fontWeight: 600, color: 'var(--erreur-texte)', background: 'none', border: '1px solid var(--erreur-bordure)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
        {t('patients.reessayer')}
      </button>
    </div>
  )
}

function Chargement() {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--texte-tertiaire)' }}>
      <Loader2 size={14} className="animate-spin" /> <span style={{ fontSize: 13 }}>{t('patients.loading')}</span>
    </div>
  )
}

/** Parcours de soins › Suivi de traitement : les ÉPISODES de suivi, sa fonction propre. */
export function SuiviTraitementTab({ patientId, historiqueRestreint = false }: OngletProps) {
  const [detail, setDetail] = useState<DossierDetailTarget | null>(null)
  return (
    <div>
      <EpisodesSection patientId={patientId} onOpen={setDetail} historiqueRestreint={historiqueRestreint} />
      {/* Tiroir de détail (glisse de la droite, la liste reste derrière) */}
      {detail && <DossierDetailDrawer target={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

/** Dossier médical › Constantes. */
export function ConstantesTab({ patientId, historiqueRestreint = false }: OngletProps) {
  return <ConstantesSection patientId={patientId} historiqueRestreint={historiqueRestreint} />
}

/** Dossier médical › Pathologies chroniques. */
export function PathologiesChroniquesTab({ patientId, historiqueRestreint = false }: OngletProps) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('consultation.diagnose')
  const { data, isLoading, isError, refetch } = usePatientSuivi(patientId)
  if (isError) return <ErreurChargement onRetry={() => { void refetch() }} />
  if (isLoading) return <Chargement />
  const chroniques = data?.chroniques ?? []
  return (
    <div>
      <SectionHeader icon={<TrendingUp size={14} />} title={t('patients.suiviSectionChroniques')} />
      {chroniques.length === 0 ? (
        <EmptySection text={t(historiqueRestreint ? 'patients.suiviEmptyChroniquesEnCours' : 'patients.suiviEmptyChroniques')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {chroniques.map(c => <ChroniqueCard key={c.pathologieId} item={c} patientId={patientId} canManage={canManage} />)}
        </div>
      )}
    </div>
  )
}

/** Parcours de soins › Traitements. */
function grouperParOrdonnance(lignes: SuiviTraitementItem[]) {
  const groupes = new Map<string, { ordonnanceId: string; date: string; prescripteur: SuiviTraitementItem['prescripteur']; delivrance: string | null; delivreLe: string | null; lignes: SuiviTraitementItem[] }>()
  for (const l of lignes) {
    const g = groupes.get(l.ordonnanceId) ?? { ordonnanceId: l.ordonnanceId, date: l.date, prescripteur: l.prescripteur ?? null, delivrance: l.delivrance ?? null, delivreLe: l.delivreLe ?? null, lignes: [] }
    g.lignes.push(l)
    groupes.set(l.ordonnanceId, g)
  }
  return [...groupes.values()]
}

export function TraitementsTab({ patientId, historiqueRestreint = false }: OngletProps) {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = usePatientSuivi(patientId)
  const [detail, setDetail] = useState<DossierDetailTarget | null>(null)
  // Instant figé au montage (rendu pur) pour juger « en cours » / « terminé ».
  const [maintenant] = useState(() => Date.now())
  if (isError) return <ErreurChargement onRetry={() => { void refetch() }} />
  if (isLoading) return <Chargement />
  const traitements = data?.traitements ?? []
  return (
    <div>
      <SectionHeader icon={<Pill size={14} />} title={t('patients.suiviSectionTraitements')} />
      {traitements.length === 0 ? (
        <EmptySection text={t(historiqueRestreint ? 'patients.suiviEmptyTraitementsEnCours' : 'patients.suiviEmptyTraitements')} />
      ) : (
        // Regroupé PAR ORDONNANCE (constat 82) : une ordonnance de 4 médicaments donnait 4
        // lignes séparées, toutes « Validée », sans prescripteur, sans délivrance, et un
        // traitement de 5 jours d'il y a deux ans ressemblait exactement à celui d'hier.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720 }}>
          {grouperParOrdonnance(traitements).map(g => (
            <div key={g.ordonnanceId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--texte-secondaire)' }}>
                <span style={{ fontWeight: 600, color: 'var(--texte-primaire)' }}>
                  {t('patients.ordonnanceDu', { date: formatDate(g.date) })}
                </span>
                {g.prescripteur && <span>· {nomSoignant(g.prescripteur, t)}</span>}
                <StatusPill tone={g.delivrance === 'DELIVRE' ? 'success' : g.delivrance === 'EN_ATTENTE' ? 'warning' : 'neutral'}>
                  {g.delivrance === 'DELIVRE'
                    ? (g.delivreLe ? t('patients.delivreLe', { date: formatDate(g.delivreLe) }) : t('patients.delivre'))
                    : g.delivrance === 'EN_ATTENTE' ? t('patients.nonDelivre') : t('patients.sansBonPharmacie')}
                </StatusPill>
              </div>
              {g.lignes.map(tr => {
                const fin = tr.finEstimee ? new Date(tr.finEstimee).getTime() : null
                const enCours = fin != null && fin > maintenant
                return (
                  <ClickableRow
                    key={tr.ligneId}
                    icon={<Pill size={14} />} tint="var(--ap-600)" bg="var(--ap-50)"
                    title={tr.medicament}
                    subtitle={`${tr.posologie} · ${tr.duree} · ${tr.voieAdmin}`}
                    badge={fin == null ? undefined : enCours
                      ? t('patients.traitementEnCoursJusquau', { date: formatDate(tr.finEstimee!) })
                      : t('patients.traitementTermine', { date: formatDate(tr.finEstimee!) })}
                    badgeTone={enCours ? 'success' : 'neutral'}
                    date={tr.date}
                    onClick={() => setDetail({ kind: 'ORDONNANCE', consultationId: tr.consultationId, ordonnanceId: tr.ordonnanceId })}
                  />
                )
              })}
            </div>
          ))}
        </div>
      )}
      {detail && <DossierDetailDrawer target={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

/** Parcours de soins › Résultats d'examens (en attente de saisie, puis reçus). */
export function ResultatsExamensTab({ patientId, historiqueRestreint = false }: OngletProps) {
  const { t } = useTranslation()
  const { data, isLoading, isError, refetch } = usePatientSuivi(patientId)
  const [detail, setDetail] = useState<DossierDetailTarget | null>(null)
  if (isError) return <ErreurChargement onRetry={() => { void refetch() }} />
  if (isLoading) return <Chargement />
  const resultatsExamens   = data?.resultatsExamens ?? []
  const resultatsEnAttente = data?.resultatsEnAttente ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Résultats en attente de saisie */}
      {resultatsEnAttente.length > 0 && (
        <div>
          <SectionHeader icon={<PenLine size={14} />} title={t('patients.suiviSectionEnAttente')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
            {resultatsEnAttente.map((r: SuiviResultatEnAttenteItem) => (
              <ClickableRow
                key={r.bonId}
                icon={<PenLine size={14} />} tint="var(--avert-texte)" bg="var(--avert-fond)"
                title={r.examens.length > 0 ? r.examens.join(', ') : t('patients.suiviExamensRealises')}
                badge={r.aValider ? t('patients.suiviAValiderBadge') : t('patients.suiviEnAttenteBadge')}
                badgeTone="warning"
                date={r.date}
                onClick={() => setDetail({ kind: 'BON_EXAMEN_ACTION', consultationId: r.consultationId, bonId: r.bonId, patientId })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Résultats d'examens déjà reçus */}
      <div>
        <SectionHeader icon={<FlaskConical size={14} />} title={t('patients.suiviSectionExamens')} />
        {resultatsExamens.length === 0 ? (
          <EmptySection text={t(historiqueRestreint ? 'patients.suiviEmptyExamensEnCours' : 'patients.suiviEmptyExamens')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
            {resultatsExamens.map((r: SuiviResultatExamenItem) => (
              <ClickableRow
                key={r.id}
                icon={<FlaskConical size={14} />} tint="var(--info-accent)" bg="var(--info-fond)"
                title={r.examens.length > 0 ? r.examens.join(', ') : t('patients.suiviExamensRealises')}
                subtitle={[r.laboratoire, r.interpretation].filter(Boolean).join(' · ') || undefined}
                badge={labelStatut('resultat_examen', r.statut)}
                date={r.date}
                onClick={() => setDetail({ kind: 'RESULTAT', consultationId: r.consultationId, bonId: r.bonId, resultat: r })}
              />
            ))}
          </div>
        )}
      </div>
      {detail && <DossierDetailDrawer target={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
