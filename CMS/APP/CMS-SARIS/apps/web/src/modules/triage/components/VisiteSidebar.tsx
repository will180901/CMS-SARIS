import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, Activity, AlertTriangle, ExternalLink, Clock } from 'lucide-react'
import { PatientAvatar, CategorieBadge } from '@/modules/patients/components/CategorieBadge'
import { LiveDuration } from '@/components/saris'
import { humanizeCode } from '@/config/labels'
import { formatTime } from '@/lib/intl'
import type { VisiteDetail, ConstanteVitale } from '@cms-saris/types'
import { calcAge as ageYears } from '@/lib/age'

// ── Helpers ───────────────────────────────────────────────────────────────────

function hhmm(d: string) {
  return formatTime(d, { hour: '2-digit', minute: '2-digit' })
}

// Sévérité constantes
function tempSev(v: number | null | undefined): 'normal' | 'warning' | 'danger' {
  if (v == null) return 'normal'
  return v >= 38.5 ? 'danger' : v >= 37.5 ? 'warning' : 'normal'
}
function taSev(sys: number | null | undefined): 'normal' | 'warning' | 'danger' {
  if (sys == null) return 'normal'
  return sys >= 160 ? 'danger' : sys >= 140 ? 'warning' : 'normal'
}
function spo2Sev(v: number | null | undefined): 'normal' | 'warning' | 'danger' {
  if (v == null) return 'normal'
  return v < 90 ? 'danger' : v < 95 ? 'warning' : 'normal'
}

const SEV_COLOR: Record<'normal' | 'warning' | 'danger', string> = {
  normal:  'var(--texte-primaire)',
  warning: 'var(--avert-texte)',
  danger:  'var(--erreur-texte)',
}

// ── Sous-composants (mirror DossierPage helpers) ──────────────────────────────

function SidebarSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
        {icon}
        <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)' }}>
          {title}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {children}
      </div>
    </div>
  )
}

function SidebarRow({ label, value, valueNode }: { label: string; value?: string; valueNode?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', gap: 8 }}>
      <span style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }}>{label}</span>
      {valueNode ?? <span style={{ fontWeight: '500', color: 'var(--texte-primaire)', textAlign: 'right' }}>{value}</span>}
    </div>
  )
}

function SidebarCounter({ label, count, danger }: { label: string; count: number; danger?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
      <span style={{ color: 'var(--texte-secondaire)' }}>{label}</span>
      <span style={{
        minWidth: 20, height: 20, borderRadius: 10, padding: '0 5px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '11px', fontWeight: '600',
        background: danger && count > 0 ? 'var(--erreur-fond)' : 'var(--fond-surface-2)',
        color:      danger && count > 0 ? 'var(--erreur-texte)' : 'var(--texte-secondaire)',
      }}>{count}</span>
    </div>
  )
}

// Mini-affichage d'une constante (utilisé dans section "Dernières constantes")
function ConstanteRow({ label, value, unit, sev = 'normal' }: {
  label: string
  value: string
  unit:  string
  sev?:  'normal' | 'warning' | 'danger'
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
      <span style={{ color: 'var(--texte-tertiaire)' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontWeight: '600', color: SEV_COLOR[sev] }}>{value}</span>
        <span style={{ fontSize: '10px', color: 'var(--texte-tertiaire)' }}>{unit}</span>
      </span>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export function VisiteSidebar({ visite, width = 268, compact }: { visite: VisiteDetail; width?: number; compact?: boolean }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const STATUT_LABEL: Record<string, string> = {
    EN_ATTENTE: t('triage.statutEnAttente'),
    EN_COURS:   t('triage.statutEnCours'),
    CLOTUREE:   t('triage.statutCloturee'),
    ANNULEE:    t('triage.statutAnnulee'),
  }
  const id        = visite.patient?.identite
  const categCode = visite.patient?.categoriePatient?.code ?? 'PATIENT_EXTERNE'
  const allergies = visite.patient?.allergies ?? []
  const alertes   = visite.patient?.alertesMedicales ?? []
  const sevAllergs = allergies.filter(a => a.gravite === 'SEVERE')
  const critiques  = alertes.filter(a => a.gravite === 'CRITIQUE')

  const lastConst: ConstanteVitale | null = visite.constantes?.[0] ?? null

  return (
    <aside style={{
      width:         compact ? '100%' : `${width}px`,
      flexShrink:    0,
      overflowY:     compact ? 'visible' : 'auto',
      borderBottom:  compact ? '1px solid var(--bordure-legere)' : undefined,
      padding:       '20px',
      display:       'flex',
      flexDirection: 'column',
      gap:           '18px',
      background:    'var(--fond-surface)',
    }}>

      {/* ── Identité patient (centré) ──────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
        paddingBottom: '16px', borderBottom: '1px solid var(--bordure-legere)',
      }}>
        {id ? (
          <PatientAvatar nom={id.nom} prenom={id.prenom} code={categCode} size={56} photoUrl={id.photoUrl} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--fond-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={24} style={{ color: 'var(--texte-tertiaire)' }} />
          </div>
        )}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: '700', fontSize: '14px', color: 'var(--texte-primaire)', margin: 0 }}>
            {id ? `${id.prenom} ${id.nom}` : '—'}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', margin: '3px 0 0', fontFamily: 'monospace' }}>
            {visite.patient?.numeroPatient}
          </p>
          {id && (
            <p style={{ fontSize: '12px', color: 'var(--texte-secondaire)', margin: '2px 0 0' }}>
              {t('triage.ageAns', { age: ageYears(id.dateNaissance) })} · {id.sexe === 'M' ? t('triage.sexeMasculin') : t('triage.sexeFeminin')}
            </p>
          )}
        </div>
        {visite.patient?.categoriePatient && (
          <CategorieBadge code={categCode} libelle={visite.patient.categoriePatient.libelle} />
        )}
      </div>

      {/* ── Visite en cours ────────────────────────────────────────────────── */}
      <SidebarSection title={t('triage.sidebarVisiteEnCours')} icon={<Clock size={12} style={{ color: 'var(--texte-tertiaire)' }} />}>
        <SidebarRow label={t('triage.sidebarStatut')} value={STATUT_LABEL[visite.statut] ?? humanizeCode(visite.statut)} />
        <SidebarRow label={t('triage.sidebarOuverteA')} value={hhmm(visite.dateOuverture)} />
        <SidebarRow label={t('triage.sidebarDuree')} valueNode={<LiveDuration from={visite.dateOuverture} precis />} />
        {visite.soignant && (
          <SidebarRow label={t('triage.sidebarSoignant')} value={`${visite.soignant.prenom} ${visite.soignant.nom}`} />
        )}
      </SidebarSection>

      {/* ── Dernières constantes ───────────────────────────────────────────── */}
      <SidebarSection title={t('triage.sidebarDernieresConstantes')} icon={<Activity size={12} style={{ color: 'var(--texte-tertiaire)' }} />}>
        {lastConst ? (
          <>
            {lastConst.temperature != null && (
              <ConstanteRow label={t('triage.sidebarTemperature')} value={String(lastConst.temperature)} unit="°C" sev={tempSev(lastConst.temperature)} />
            )}
            {lastConst.tensionSystolique != null && (
              <ConstanteRow
                label={t('triage.sidebarTension')}
                value={`${lastConst.tensionSystolique}/${lastConst.tensionDiastolique ?? '—'}`}
                unit="mmHg"
                sev={taSev(lastConst.tensionSystolique)}
              />
            )}
            {lastConst.frequenceCardiaque != null && (
              <ConstanteRow label={t('triage.sidebarFreqCard')} value={String(lastConst.frequenceCardiaque)} unit="bpm" />
            )}
            {lastConst.saturationO2 != null && (
              <ConstanteRow label={t('triage.sidebarSpo2')} value={String(lastConst.saturationO2)} unit="%" sev={spo2Sev(lastConst.saturationO2)} />
            )}
            {lastConst.imc != null && (
              <ConstanteRow label={t('triage.sidebarImc')} value={String(lastConst.imc)} unit="kg/m²" />
            )}
          </>
        ) : (
          <p style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', fontStyle: 'italic', margin: 0 }}>
            {t('triage.pasEncoreSaisies')}
          </p>
        )}
      </SidebarSection>

      {/* ── Alertes & antécédents ──────────────────────────────────────────── */}
      <SidebarSection title={t('triage.sidebarDossierPatient')} icon={<AlertTriangle size={12} style={{ color: 'var(--texte-tertiaire)' }} />}>
        <SidebarCounter label={t('triage.sidebarAllergies')} count={allergies.length} danger={sevAllergs.length > 0} />
        <SidebarCounter label={t('triage.sidebarAlertesMedicales')} count={alertes.length} danger={critiques.length > 0} />
      </SidebarSection>

      {/* ── CTA en bas (marginTop:auto) ────────────────────────────────────── */}
      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
        <button
          onClick={() => navigate(`/patients/${visite.patientId}`)}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: '12px', fontWeight: '500',
            color: 'var(--texte-secondaire)', border: '1px solid var(--bordure-normale)',
            background: 'var(--fond-surface)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'background 0.15s',
          }}
        >
          {t('triage.voirDossierComplet')}
          <ExternalLink size={12} />
        </button>
      </div>
    </aside>
  )
}
