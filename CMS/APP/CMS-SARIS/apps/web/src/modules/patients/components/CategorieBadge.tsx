/**
 * CategorieBadge — badge coloré par catégorie patient
 * + utilitaires de couleur partagés dans le module patients
 */

import { useTranslation } from 'react-i18next'

// ── Config des catégories ─────────────────────────────────────────────────────
// Couleurs = variables du thème (tons décoratifs) : des teintes claires écrites en dur
// ressortaient comme des pastilles éclatantes sur le fond sombre.
// `labelKey` = clé i18n (résolue dans le composant, jamais au niveau module).

export const CATEGORIE_CONFIG: Record<string, {
  labelKey: string
  bg:      string
  text:    string
  border:  string
  avatar:  string  // fond avatar dans la liste
}> = {
  ASSURE_CDI:        { labelKey: 'patients.categCdi',          bg: 'var(--ap-50)',    text: 'var(--ap-700)',    border: 'var(--ap-200)',    avatar: 'var(--ap-100)'    },
  AYANT_DROIT_CDI:   { labelKey: 'patients.categBeneficiary',  bg: 'var(--ton-emeraude-fond)', text: 'var(--ton-emeraude-icone)', border: 'var(--ton-emeraude-bordure)', avatar: 'var(--ton-emeraude-fond)' },
  SOUS_TRAITANT:     { labelKey: 'patients.categSubcontractor', bg: 'var(--ton-ambre-fond)', text: 'var(--ton-ambre-icone)', border: 'var(--ton-ambre-bordure)', avatar: 'var(--ton-ambre-fond)' },
  RETRAITE:          { labelKey: 'patients.categRetired',      bg: 'var(--ton-violet-fond)', text: 'var(--ton-violet-icone)', border: 'var(--ton-violet-bordure)', avatar: 'var(--ton-violet-fond)' },
  AGENT_FONCTIONNAIRE: { labelKey: 'patients.categCivilServant', bg: 'var(--ton-bleu-fond)', text: 'var(--ton-bleu-icone)', border: 'var(--ton-bleu-bordure)', avatar: 'var(--ton-bleu-fond)' },
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
