/**
 * ConsultationQueueCard — Carte dans la file des consultations ouvertes.
 * Aligné sur le style de la file de triage (QueueCard) : rangée de liste plate,
 * fond sélectionné `ap-50`, barre gauche `ap-500` uniquement si sélectionné,
 * avatar catégorie via PatientAvatar — pas de bordure colorée par catégorie.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Stethoscope, ChevronRight, Clock } from 'lucide-react'
import { PatientAvatar } from '@/modules/patients/components/CategorieBadge'
import { LiveDuration }  from '@/components/saris'
import type { ConsultationListItem } from '@cms-saris/types'
import { calcAge } from '@/lib/age'

// ── Carte ─────────────────────────────────────────────────────────────────────

interface Props {
  consultation: ConsultationListItem
  selected:     boolean
  onClick:      () => void
}

export function ConsultationQueueCard({ consultation, selected, onClick }: Props) {
  const { t } = useTranslation()
  const { visite } = consultation
  const patient     = visite.patient
  const id          = patient.identite
  const categCode   = patient.categoriePatient?.code ?? 'PATIENT_EXTERNE'
  const hasAlert    = patient.alertesMedicales.some(a => a.gravite === 'CRITIQUE')
                   || patient.allergies.some(a => a.gravite === 'SEVERE')

  const [focused, setFocused] = useState(false)
  const patientName = id ? `${id.prenom} ${id.nom}` : patient.numeroPatient
  const ariaLabel = [patientName, visite.motifPrincipal?.libelle].filter(Boolean).join(' · ')

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '12px',
        padding:      '12px 16px',
        cursor:       'pointer',
        borderBottom: '1px solid var(--bordure-legere)',
        background:   selected ? 'var(--ap-50)' : 'transparent',
        borderLeft:   `3px solid ${selected ? 'var(--ap-500)' : 'transparent'}`,
        transition:   'background 0.1s',
        outline:      'none',
        boxShadow:    focused ? 'inset 0 0 0 2px var(--ap-400)' : undefined,
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--fond-surface-2)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Avatar + point d'alerte */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {id ? (
          <PatientAvatar nom={id.nom} prenom={id.prenom} code={categCode} size={38} />
        ) : (
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: 'var(--fond-surface-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 16, color: 'var(--texte-tertiaire)' }}>?</span>
          </div>
        )}
        {hasAlert && (
          <div style={{
            position: 'absolute', top: -3, right: -3,
            width: 10, height: 10, borderRadius: '50%',
            background: 'var(--erreur-accent)',
            border: '2px solid var(--fond-surface)',
          }} />
        )}
      </div>

      {/* Infos */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontWeight: '600', fontSize: '13px', color: 'var(--texte-primaire)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
        }}>
          {id ? `${id.prenom} ${id.nom}` : patient.numeroPatient}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
          <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', fontFamily: 'monospace' }}>
            {patient.numeroPatient}
          </span>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', marginTop: '2px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {visite.motifPrincipal?.libelle ?? '—'}
          {id?.dateNaissance && <>{' · '}{t('consultation.ageYears', { age: calcAge(id.dateNaissance) })}</>}
        </div>

        {consultation.soignant && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: '3px' }}>
            <Stethoscope size={11} style={{ color: 'var(--ap-600)', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'var(--ap-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t('consultation.doctorPrefix', { name: consultation.soignant.nom })}
            </span>
          </div>
        )}
      </div>

      {/* Timer + chevron */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
        <span style={{
          fontSize: '11px', color: 'var(--texte-tertiaire)',
          background: 'var(--fond-surface-2)',
          padding: '1px 6px', borderRadius: '9999px',
          fontVariantNumeric: 'tabular-nums',
          display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          <Clock size={11} style={{ flexShrink: 0 }} /> <LiveDuration from={visite.dateOuverture} />
        </span>
        <ChevronRight size={13} style={{ color: 'var(--texte-tertiaire)' }} />
      </div>
    </div>
  )
}
