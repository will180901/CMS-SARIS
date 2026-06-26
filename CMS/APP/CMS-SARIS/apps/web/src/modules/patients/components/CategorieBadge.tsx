/**
 * CategorieBadge — badge coloré par catégorie patient
 * + utilitaires de couleur partagés dans le module patients
 */

import { useTranslation } from 'react-i18next'

// ── Config des catégories ─────────────────────────────────────────────────────
// `labelKey` = clé i18n (résolue dans le composant, jamais au niveau module).

export const CATEGORIE_CONFIG: Record<string, {
  labelKey: string
  bg:      string
  text:    string
  border:  string
  avatar:  string  // fond avatar dans la liste
}> = {
  ASSURE_CDI:        { labelKey: 'patients.categCdi',          bg: 'var(--ap-50)',    text: 'var(--ap-700)',    border: 'var(--ap-200)',    avatar: 'var(--ap-100)'    },
  AYANT_DROIT_CDI:   { labelKey: 'patients.categBeneficiary',  bg: '#f0fdfa',        text: '#0f766e',          border: '#99f6e4',          avatar: '#ccfbf1'          },
  SOUS_TRAITANT:     { labelKey: 'patients.categSubcontractor', bg: '#fff7ed',       text: '#c2410c',          border: '#fed7aa',          avatar: '#ffedd5'          },
  RETRAITE:          { labelKey: 'patients.categRetired',      bg: '#faf5ff',        text: '#7c3aed',          border: '#e9d5ff',          avatar: '#ede9fe'          },
  AGENT_FONCTIONNAIRE: { labelKey: 'patients.categCivilServant', bg: '#eff6ff',     text: '#1d4ed8',          border: '#bfdbfe',          avatar: '#dbeafe'          },
  PATIENT_EXTERNE:   { labelKey: 'patients.categExternal',     bg: 'var(--fond-surface-2)', text: 'var(--texte-secondaire)', border: 'var(--bordure-normale)', avatar: 'var(--fond-surface-2)' },
}

export function getCategConfig(code: string) {
  return CATEGORIE_CONFIG[code] ?? CATEGORIE_CONFIG['PATIENT_EXTERNE']!
}

// ── Badge ─────────────────────────────────────────────────────────────────────

export function CategorieBadge({ code, libelle, size = 'md' }: { code: string; libelle?: string; size?: 'sm' | 'md' }) {
  const { t } = useTranslation()
  const cfg = getCategConfig(code)
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      padding:       size === 'sm' ? '1px 6px' : '2px 8px',
      borderRadius:  '9999px',
      fontSize:      size === 'sm' ? '10px' : '11px',
      fontWeight:    '600',
      background:    cfg.bg,
      color:         cfg.text,
      border:        `1px solid ${cfg.border}`,
      whiteSpace:    'nowrap',
      letterSpacing: '0.01em',
    }}>
      {libelle ?? t(cfg.labelKey)}
    </span>
  )
}

// ── Avatar initiales ──────────────────────────────────────────────────────────

export function PatientAvatar({
  nom, prenom, code, size = 40, photoUrl,
}: {
  nom:    string
  prenom: string
  code:   string
  size?:  number
  /** Photo du patient (data URL). Si présente, affichée à la place des initiales. */
  photoUrl?: string | null
}) {
  const cfg      = getCategConfig(code)
  const initials = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase()
  const fontSize = size <= 32 ? '11px' : size <= 40 ? '13px' : '15px'

  // Avec photo : image recadrée dans le même gabarit (mêmes rayon/bordure).
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${prenom} ${nom}`}
        style={{
          width:        `${size}px`,
          height:       `${size}px`,
          borderRadius: '10px',
          border:       `1.5px solid ${cfg.border}`,
          objectFit:    'cover',
          flexShrink:   0,
          display:      'block',
        }}
      />
    )
  }

  return (
    <div style={{
      width:          `${size}px`,
      height:         `${size}px`,
      borderRadius:   '10px',
      background:     cfg.avatar,
      border:         `1.5px solid ${cfg.border}`,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      flexShrink:     0,
      fontWeight:     '700',
      fontSize,
      color:          cfg.text,
      letterSpacing:  '0.02em',
    }}>
      {initials}
    </div>
  )
}
