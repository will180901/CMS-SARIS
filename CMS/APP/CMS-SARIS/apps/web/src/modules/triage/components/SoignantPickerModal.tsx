import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Check, UserMinus, Users } from 'lucide-react'
import { Modal } from '@/components/saris'
import { useSoignants } from '../hooks/useSoignants'
import type { PersonnelMedical, RolePersonnel } from '@cms-saris/types'

// ── Palette par rôle ──────────────────────────────────────────────────────────
// `labelKey` = clé i18n (préfixée `triage.`) traduite au point d'affichage.

const ROLE_CONFIG: Record<RolePersonnel, { labelKey: string; bg: string; text: string; border: string }> = {
  MEDECIN:        { labelKey: 'triage.roleMedecin',        bg: 'var(--info-fond)',      text: 'var(--info-texte)',        border: 'var(--info-bordure)'     },
  INFIRMIER:      { labelKey: 'triage.roleInfirmier',      bg: 'var(--ap-50)',          text: 'var(--ap-700)',            border: 'var(--ap-200)'           },
  SAGE_FEMME:     { labelKey: 'triage.roleSageFemme',      bg: 'var(--succes-fond)',    text: 'var(--succes-texte)',      border: 'var(--succes-bordure)'   },
  TECHNICIEN_LAB: { labelKey: 'triage.roleTechnicienLab',  bg: 'var(--avert-fond)',     text: 'var(--avert-texte)',       border: 'var(--avert-bordure)'    },
  ADMINISTRATIF:  { labelKey: 'triage.roleAdministratif',  bg: 'var(--fond-surface-2)', text: 'var(--texte-secondaire)',  border: 'var(--bordure-normale)'  },
}

function roleConfig(role: string) {
  return ROLE_CONFIG[role as RolePersonnel] ?? ROLE_CONFIG.ADMINISTRATIF
}

// ── Mini-avatar initiales ─────────────────────────────────────────────────────

function PersonnelAvatar({ p, size = 36 }: { p: PersonnelMedical; size?: number }) {
  const cfg = roleConfig(p.role)
  const initials = `${p.prenom?.[0] ?? ''}${p.nom?.[0] ?? ''}`.toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: cfg.bg, border: `1.5px solid ${cfg.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, fontWeight: '700',
      fontSize: size <= 32 ? '11px' : '13px',
      color: cfg.text, letterSpacing: '0.02em',
    }}>
      {initials || '?'}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface Props {
  open:        boolean
  onClose:     () => void
  currentId:   string | null
  onSelect:    (soignantId: string | null) => void
  pendingId?:  string | null            // soignantId en cours d'enregistrement (loader)
}

export function SoignantPickerModal({ open, onClose, currentId, onSelect, pendingId }: Props) {
  const { t } = useTranslation()
  const { data: personnel = [], isLoading } = useSoignants()
  const [search, setSearch] = useState('')

  // Reset recherche à la fermeture
  useEffect(() => { if (!open) setSearch('') }, [open])

  const filtered = useMemo(() => {
    const actifs = personnel.filter(p => p.statut === 'ACTIF')
    if (!search.trim()) return actifs
    const q = search.toLowerCase()
    return actifs.filter(p => {
      const full = `${p.nom} ${p.prenom} ${p.matricule} ${t(roleConfig(p.role).labelKey)}`.toLowerCase()
      return full.includes(q)
    })
  }, [personnel, search, t])

  if (!open) return null

  return (
    <Modal
      icon={<Users size={16} />}
      title={t('triage.choisirSoignant')}
      subtitle={t('triage.personnelActif', { count: filtered.length })}
      width={480}
      onClose={onClose}
      bodyPadding="0"
    >
      <div>
        {/* Recherche (collée en haut) */}
        <div style={{ position: 'sticky', top: 0, zIndex: 2, padding: '12px 20px', borderBottom: '1px solid var(--bordure-legere)', background: 'var(--fond-surface)' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={13}
              style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--texte-tertiaire)', pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('triage.searchSoignantPlaceholder')}
              autoFocus
              style={{
                width: '100%', height: 34,
                paddingLeft: 32, paddingRight: 12,
                fontSize: '13px',
                background: 'var(--fond-surface)',
                border: '1px solid var(--bordure-normale)',
                borderRadius: 6,
                color: 'var(--texte-primaire)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Liste */}
        <div style={{ padding: '8px 0' }}>

          {/* Option "Aucun soignant" — désassigner */}
          <SoignantRow
            label={t('triage.aucunSoignantAssigne')}
            sub={t('triage.retirerAffectation')}
            selected={currentId === null}
            pending={pendingId === null && pendingId !== undefined}
            onClick={() => onSelect(null)}
            icon={
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'var(--fond-surface-2)',
                border: '1.5px dashed var(--bordure-normale)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <UserMinus size={15} style={{ color: 'var(--texte-tertiaire)' }} />
              </div>
            }
          />

          {/* Séparateur */}
          <div style={{ borderTop: '1px solid var(--bordure-legere)', margin: '4px 0' }} />

          {/* Personnel */}
          {isLoading && (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--texte-tertiaire)' }}>
              {t('triage.chargement')}
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <Users size={28} style={{ color: 'var(--texte-tertiaire)', opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--texte-secondaire)', margin: 0 }}>
                {search ? t('triage.aucunResultatPour', { search }) : t('triage.aucunPersonnelActif')}
              </p>
            </div>
          )}
          {!isLoading && filtered.map(p => {
            const cfg = roleConfig(p.role)
            return (
              <SoignantRow
                key={p.id}
                label={`${p.prenom} ${p.nom}`}
                sub={t(cfg.labelKey)}
                meta={p.matricule}
                selected={currentId === p.id}
                pending={pendingId === p.id}
                onClick={() => onSelect(p.id)}
                icon={<PersonnelAvatar p={p} />}
              />
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

// ── Ligne sélectionnable ──────────────────────────────────────────────────────

function SoignantRow({
  icon, label, sub, meta, selected, pending, onClick,
}: {
  icon:     React.ReactNode
  label:    string
  sub?:     string
  meta?:    string
  selected: boolean
  pending?: boolean
  onClick:  () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 20px',
        background: selected ? 'var(--ap-50)' : 'transparent',
        border: 'none',
        cursor: pending ? 'wait' : 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s',
        opacity: pending ? 0.6 : 1,
      }}
      onMouseEnter={e => { if (!selected && !pending) e.currentTarget.style.background = 'var(--fond-surface-2)' }}
      onMouseLeave={e => { if (!selected && !pending) e.currentTarget.style.background = 'transparent' }}
    >
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: selected ? '700' : '500', color: 'var(--texte-primaire)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </p>
        {sub && (
          <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', margin: '2px 0 0' }}>
            {sub}
            {meta && <span style={{ marginLeft: 6, fontFamily: 'monospace' }}>· {meta}</span>}
          </p>
        )}
      </div>
      {selected && (
        <div style={{
          width: 22, height: 22, borderRadius: 11,
          background: 'var(--ap-500)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Check size={12} style={{ color: '#fff' }} strokeWidth={3} />
        </div>
      )}
    </button>
  )
}

// Export utilitaire — pour réutiliser dans ActionsCard
export { roleConfig, PersonnelAvatar }
