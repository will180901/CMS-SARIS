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
import { useTranslation } from 'react-i18next'
import {
  Activity, TrendingUp, Pill, FlaskConical, Loader2, ChevronRight, Plus, Pencil,
  CircleCheck, HeartPulse, PenLine, Thermometer, Wind, Weight, Ruler, Gauge,
  TrendingDown, Minus,
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

function EpisodesSection({ patientId, onOpen }: { patientId: string; onOpen: (t: DossierDetailTarget) => void }) {
  const { t } = useTranslation()
  const { data: episodes = [], isLoading } = useSuivisTraitement({ patientId })

  return (
    <div>
      <SectionHeader icon={<Activity size={14} />} title={t('suiviTraitement.cardTitle')} />
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--texte-tertiaire)' }}>
          <Loader2 size={14} className="animate-spin" /> <span style={{ fontSize: 13 }}>{t('patients.loading')}</span>
        </div>
      ) : episodes.length === 0 ? (
        <EmptySection text={t('suiviTraitement.emptyTitle')} />
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
                onClick={() => onOpen({ kind: 'SUIVI_TRAITEMENT', consultationId: ep.consultationId })}
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

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div style={{ height: 28 }} />
  const w = 104, h = 28, pad = 3
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - 2 * pad)
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

function VitalCard({ icon, label, unit, series, sev = 'normal' }: {
  icon: React.ReactNode; label: string; unit: string; series: number[]; sev?: Sev
}) {
  const latest = series.length ? series[series.length - 1] : null
  const prev   = series.length > 1 ? series[series.length - 2] : null
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
      <Sparkline values={series} color="var(--ap-400)" />
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

function ConstantesSection({ patientId }: { patientId: string }) {
  const { t } = useTranslation()
  const { data: constantes = [], isLoading } = usePatientConstantes(patientId)

  const series = useMemo(() => {
    const asc = [...constantes].reverse()
    const pick = (k: keyof ConstanteVitale) => asc.map(c => c[k]).filter((v): v is number => typeof v === 'number')
    return {
      temperature:        pick('temperature'),
      tensionSystolique:  pick('tensionSystolique'),
      frequenceCardiaque: pick('frequenceCardiaque'),
      saturationO2:       pick('saturationO2'),
      poids:              pick('poids'),
      imc:                pick('imc'),
    }
  }, [constantes])

  return (
    <div>
      <SectionHeader icon={<HeartPulse size={14} />} title={t('patients.vitalsTitle')} />
      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--texte-tertiaire)' }}>
          <Loader2 size={14} className="animate-spin" /> <span style={{ fontSize: 13 }}>{t('patients.loading')}</span>
        </div>
      ) : constantes.length === 0 ? (
        <EmptySection text={t('patients.vitalsEmptyTitle')} />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
            <VitalCard icon={<Thermometer size={13} />} label={t('patients.vitalTemperature')} unit="°C"    series={series.temperature}        sev={tempSev(constantes[0].temperature)} />
            <VitalCard icon={<Gauge size={13} />}       label={t('patients.vitalTensionSys')}  unit="mmHg"  series={series.tensionSystolique}  sev={taSev(constantes[0].tensionSystolique)} />
            <VitalCard icon={<HeartPulse size={13} />}  label={t('patients.vitalHeartRate')}   unit="bpm"   series={series.frequenceCardiaque} sev={fcSev(constantes[0].frequenceCardiaque)} />
            <VitalCard icon={<Wind size={13} />}        label={t('patients.vitalSpo2')}        unit="%"     series={series.saturationO2}       sev={spo2Sev(constantes[0].saturationO2)} />
            <VitalCard icon={<Weight size={13} />}      label={t('patients.vitalWeight')}      unit="kg"    series={series.poids} />
            <VitalCard icon={<Ruler size={13} />}       label={t('patients.vitalImc')}         unit="kg/m²" series={series.imc} />
          </div>
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
          {suivi ? t('patients.suiviChroniqueSuiviActif') : t('patients.suiviChroniqueSansSuivi')}
        </StatusPill>
      </div>

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

// ── Composant principal ───────────────────────────────────────────────────────

export function SuiviTraitementTab({ patientId }: { patientId: string }) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canManage = has('consultation.diagnose')
  const { data, isLoading } = usePatientSuivi(patientId)
  const [detail, setDetail] = useState<DossierDetailTarget | null>(null)

  const chroniques         = data?.chroniques ?? []
  const traitements        = data?.traitements ?? []
  const resultatsExamens   = data?.resultatsExamens ?? []
  const resultatsEnAttente = data?.resultatsEnAttente ?? []

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <Activity size={15} style={{ color: 'var(--ap-600)' }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('suiviTraitement.cardTitle')}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* 1. Épisodes de suivi de traitement */}
        <EpisodesSection patientId={patientId} onOpen={setDetail} />

        {/* 2. Constantes vitales */}
        <ConstantesSection patientId={patientId} />

        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--texte-tertiaire)' }}>
            <Loader2 size={14} className="animate-spin" /> <span style={{ fontSize: 13 }}>{t('patients.loading')}</span>
          </div>
        ) : (
          <>
            {/* 3. Évolution des pathologies chroniques */}
            <div>
              <SectionHeader icon={<TrendingUp size={14} />} title={t('patients.suiviSectionChroniques')} />
              {chroniques.length === 0 ? (
                <EmptySection text={t('patients.suiviEmptyChroniques')} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {chroniques.map(c => <ChroniqueCard key={c.pathologieId} item={c} patientId={patientId} canManage={canManage} />)}
                </div>
              )}
            </div>

            {/* 4. Traitement */}
            <div>
              <SectionHeader icon={<Pill size={14} />} title={t('patients.suiviSectionTraitements')} />
              {traitements.length === 0 ? (
                <EmptySection text={t('patients.suiviEmptyTraitements')} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
                  {traitements.map((tr: SuiviTraitementItem) => (
                    <ClickableRow
                      key={tr.ligneId}
                      icon={<Pill size={14} />} tint="var(--ap-600)" bg="var(--ap-50)"
                      title={tr.medicament}
                      subtitle={`${tr.posologie} · ${tr.duree} · ${tr.voieAdmin}`}
                      badge={labelStatut('ordonnance', tr.statutOrdonnance)}
                      badgeTone={tr.statutOrdonnance === 'VALIDEE' ? 'success' : tr.statutOrdonnance === 'ANNULEE' ? 'error' : 'neutral'}
                      date={tr.date}
                      onClick={() => setDetail({ kind: 'ORDONNANCE', consultationId: tr.consultationId, ordonnanceId: tr.ordonnanceId })}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 5. Résultats en attente de saisie */}
            {resultatsEnAttente.length > 0 && (
              <div>
                <SectionHeader icon={<PenLine size={14} />} title={t('patients.suiviSectionEnAttente')} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 680 }}>
                  {resultatsEnAttente.map((r: SuiviResultatEnAttenteItem) => (
                    <ClickableRow
                      key={r.bonId}
                      icon={<PenLine size={14} />} tint="var(--avert-texte)" bg="var(--avert-fond)"
                      title={r.examens.length > 0 ? r.examens.join(', ') : t('patients.suiviExamensRealises')}
                      badge={t('patients.suiviEnAttenteBadge')}
                      badgeTone="warning"
                      date={r.date}
                      onClick={() => setDetail({ kind: 'BON_EXAMEN_ACTION', consultationId: r.consultationId, bonId: r.bonId })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 6. Résultats d'examens déjà reçus */}
            <div>
              <SectionHeader icon={<FlaskConical size={14} />} title={t('patients.suiviSectionExamens')} />
              {resultatsExamens.length === 0 ? (
                <EmptySection text={t('patients.suiviEmptyExamens')} />
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
          </>
        )}
      </div>

      {/* Tiroir de détail (glisse de la droite, la liste reste derrière) */}
      {detail && <DossierDetailDrawer target={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
