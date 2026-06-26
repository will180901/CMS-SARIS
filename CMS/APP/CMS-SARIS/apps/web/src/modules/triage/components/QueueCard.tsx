import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Clock } from 'lucide-react'
import { PatientAvatar }   from '@/modules/patients/components/CategorieBadge'
import { LiveDuration }    from '@/components/saris'
import type { VisiteListItem } from '@cms-saris/types'
import { calcAge } from '@/lib/age'

// ── Composant ─────────────────────────────────────────────────────────────────

export function QueueCard({
  visite, selected, onClick,
}: {
  visite:   VisiteListItem
  selected: boolean
  onClick:  () => void
}) {
  const { t }      = useTranslation()
  const id         = visite.patient?.identite
  const categCode  = visite.patient?.categoriePatient?.code ?? 'PATIENT_EXTERNE'
  const hasAlert   = (visite.patient?.allergies?.length ?? 0) > 0
                  || (visite.patient?.alertesMedicales?.length ?? 0) > 0
  // Bordure gauche = statut (en cours mis en avant), plus de couleur de priorité.
  const statusColor = visite.statut === 'EN_COURS' ? 'var(--ap-400)' : 'transparent'

  const [focused, setFocused] = useState(false)
  const patientLabel = id ? `${id.prenom} ${id.nom}` : (visite.patient?.numeroPatient ?? '')
  const ariaLabel = [
    patientLabel,
    visite.motifPrincipal?.libelle,
    visite.statut === 'EN_COURS' ? t('triage.badgeEnCours') : undefined,
  ].filter(Boolean).join(' · ')

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
      }}
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
        borderLeft:   `3px solid ${selected ? 'var(--ap-500)' : statusColor}`,
        transition:   'background 0.1s',
        outline:      'none',
        boxShadow:    focused ? 'inset 0 0 0 2px var(--ap-400)' : undefined,
      }}
    >
      {/* Avatar + point d'alerte */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {id ? (
          <PatientAvatar
            nom={id.nom}
            prenom={id.prenom}
            code={categCode}
            size={38}
            photoUrl={id.photoUrl}
          />
        ) : (
          <div style={{
            width: 38, height: 38, borderRadius: 8,
            background: 'var(--fond-surface-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 16, color: 'var(--texte-tertiaire)' }}>?</span>
          </div>
        )}
        {/* Point rouge si alerte critique */}
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
        {/* Nom + statut */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontWeight: '600', fontSize: '13px', color: 'var(--texte-primaire)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {id ? `${id.prenom} ${id.nom}` : visite.patient?.numeroPatient ?? '—'}
          </span>
          {visite.statut === 'EN_COURS' && (
            <span style={{
              fontSize: '10px', fontWeight: '600',
              color: 'var(--info-texte)', background: 'var(--info-fond)',
              padding: '1px 6px', borderRadius: '9999px',
              border: '1px solid var(--info-bordure)',
              flexShrink: 0,
            }}>
              {t('triage.badgeEnCours')}
            </span>
          )}
        </div>

        {/* Numéro patient */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
          <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', fontFamily: 'monospace' }}>
            {visite.patient?.numeroPatient}
          </span>
        </div>

        {/* Motif · âge */}
        <div style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', marginTop: '2px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {visite.motifPrincipal?.libelle ?? '—'}
          {id?.dateNaissance && (
            <>
              {' · '}
              {t('triage.ageAns', { age: calcAge(id.dateNaissance) })}
            </>
          )}
        </div>
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
