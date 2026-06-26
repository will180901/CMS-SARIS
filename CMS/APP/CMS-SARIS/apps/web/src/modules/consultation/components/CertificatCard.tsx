/**
 * CertificatCard — PEC supplémentaire : Repos maladie.
 * Branché sur l'endpoint B5 (setRepos).
 */

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Bed, Check, Printer } from 'lucide-react'
import { useSetRepos } from '../hooks/useConsultation'

interface Props {
  consultationId:  string
  reposJours:      number | null
  reposInclutJour: boolean
  dateReprise:     string | null
  readonly?:       boolean
  /** Permission (calculée dans ConsultationDetail) ; permissif par défaut. */
  canRepos?:       boolean   // consultation.update (repos maladie)
  /** Ouvre l'aperçu/impression du certificat de repos (fourni par ConsultationDetail). */
  onPrint?:        () => void
}

const CARD: React.CSSProperties = {
  background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)',
  borderRadius: 10, overflow: 'hidden',
}
const HEADER: React.CSSProperties = {
  padding: '10px 14px', borderBottom: '1px solid var(--bordure-legere)',
  background: 'var(--fond-surface-2)', display: 'flex', alignItems: 'center', gap: 6,
}
const LABEL: React.CSSProperties = {
  fontSize: '12px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--texte-tertiaire)', margin: 0,
}
const INPUT: React.CSSProperties = {
  height: 34, padding: '0 10px', fontSize: '13px', borderRadius: 8, outline: 'none',
  border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)',
  color: 'var(--texte-primaire)', boxSizing: 'border-box',
}

export function CertificatCard({ consultationId, reposJours, reposInclutJour, dateReprise, readonly, canRepos = true, onPrint }: Props) {
  const { t } = useTranslation()
  const reposRO = readonly || !canRepos   // le repos maladie frappe consultation.update
  const setRepos = useSetRepos(consultationId)

  // ── Repos (auto-save débounce) ──────────────────────────────────────────────
  const [jours, setJours]       = useState<string>(reposJours != null ? String(reposJours) : '')
  const [reprise, setReprise]   = useState<string>(dateReprise ? dateReprise.slice(0, 10) : '')
  const [inclut, setInclut]     = useState<boolean>(reposInclutJour)
  const [reposSaved, setSaved]  = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setJours(reposJours != null ? String(reposJours) : '')
    setReprise(dateReprise ? dateReprise.slice(0, 10) : '')
    setInclut(reposInclutJour)
    setSaved(true)
  }, [consultationId])

  function persistRepos(next: { jours?: string; reprise?: string; inclut?: boolean }) {
    const j = next.jours    ?? jours
    const r = next.reprise  ?? reprise
    const i = next.inclut   ?? inclut
    setSaved(false)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setRepos.mutate(
        { reposJours: j ? Number(j) : null, reposInclutJour: i, dateReprise: r || null },
        { onSuccess: () => setSaved(true) },
      )
    }, 800)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Repos maladie ─────────────────────────────────────────────────── */}
      <div style={CARD}>
        <div style={{ ...HEADER, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Bed size={13} style={{ color: 'var(--ap-600)' }} />
            <p style={LABEL}>{t('consultation.certReposTitle')}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!reposRO && (
              <span style={{ fontSize: '10px', color: reposSaved ? 'var(--succes-texte)' : 'var(--texte-tertiaire)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                {reposSaved && <Check size={11} />}{reposSaved ? t('consultation.certSaved') : t('consultation.certSaving')}
              </span>
            )}
            {onPrint && reposJours != null && (
              <button type="button" onClick={onPrint} title={t('consultation.certReposPrint')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '12px', color: 'var(--ap-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                <Printer size={13} /> {t('consultation.certReposPrint')}
              </button>
            )}
          </div>
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '11px', color: 'var(--texte-secondaire)' }}>{t('consultation.certDays')}</span>
            <input type="number" min={0} max={365} value={jours} disabled={reposRO}
              onChange={e => { setJours(e.target.value); persistRepos({ jours: e.target.value }) }}
              placeholder="0" style={{ ...INPUT, width: 110, maxWidth: '100%' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '11px', color: 'var(--texte-secondaire)' }}>{t('consultation.certResumeDate')}</span>
            <input type="date" value={reprise} disabled={reposRO}
              onChange={e => { setReprise(e.target.value); persistRepos({ reprise: e.target.value }) }}
              style={{ ...INPUT, width: 150, maxWidth: '100%' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--texte-secondaire)', paddingBottom: 8, cursor: reposRO ? 'default' : 'pointer' }}>
            <input type="checkbox" checked={inclut} disabled={reposRO}
              onChange={e => { setInclut(e.target.checked); persistRepos({ inclut: e.target.checked }) }} />
            {t('consultation.certIncludeDay')}
          </label>
        </div>
      </div>
    </div>
  )
}
