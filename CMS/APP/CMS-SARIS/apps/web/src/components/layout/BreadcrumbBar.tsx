/**
 * BreadcrumbBar — navigation rapide du header :
 *   • flèches « Précédent / Suivant » (rejouent la pile d'historique, cf. navStack.store)
 *   • fil d'Ariane cliquable reflétant l'URL courante.
 * Monté dans le TopHeader (côté gauche), masqué sur mobile.
 */
import { Fragment } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Home } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavStackStore } from '@/stores/navStack.store'
import { usePatientDossier } from '@/modules/patients/hooks/usePatients'

// Segment d'URL → clé i18n (réutilise les libellés de la sidebar : cohérence FR/EN).
const SEG_TKEY: Record<string, string> = {
  dashboard: 'nav.dashboard',
  patients: 'nav.patients',
  triage: 'nav.triage',
  consultations: 'nav.consultations',
  'sorties-critiques': 'nav.sortiesCritiques',
  messagerie: 'nav.messagerie',
  referentiels: 'nav.referentiels',
  utilisateurs: 'nav.utilisateurs',
  roles: 'nav.roles',
  audit: 'nav.audit',
  parametres: 'nav.parametres',
  synchronisation: 'nav.synchronisation',
  admin: 'navGroups.adminSysteme',
}

// Chemins réellement routés : un crumb n'est cliquable que s'il pointe vers une page existante.
const KNOWN_ROUTES = new Set([
  '/dashboard', '/patients', '/triage', '/consultations', '/sorties-critiques',
  '/messagerie', '/referentiels', '/synchronisation',
  '/admin/utilisateurs', '/admin/roles', '/admin/audit', '/admin/parametres',
])

const ID_RE = /^[0-9a-f]{8,}$/i   // cuid/uuid → libellé contextuel plutôt que l'id brut

export function BreadcrumbBar() {
  const { t }    = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const index    = useNavStackStore(s => s.index)
  const length   = useNavStackStore(s => s.stack.length)
  const canBack    = index > 0
  const canForward = index < length - 1

  const segs = location.pathname.split('/').filter(Boolean)
  const crumbs = segs.map((seg, i) => {
    const path = '/' + segs.slice(0, i + 1).join('/')
    const cap  = seg.charAt(0).toUpperCase() + seg.slice(1)
    const isPatientId = segs[i - 1] === 'patients' && (ID_RE.test(seg) || seg.length > 16)
    let label: string
    if (SEG_TKEY[seg])                           label = t(SEG_TKEY[seg], { defaultValue: cap })
    else if (isPatientId)                        label = t('breadcrumb.dossier')
    else if (ID_RE.test(seg) || seg.length > 16) label = t('breadcrumb.detail')
    else                                         label = cap
    return { label, path, isLink: i < segs.length - 1 && KNOWN_ROUTES.has(path), patientId: isPatientId ? seg : undefined }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 'auto', minWidth: 0 }}>
      {/* Précédent / Suivant */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <Arrow label={t('breadcrumb.back')}    disabled={!canBack}    onClick={() => navigate(-1)}><ChevronLeft  size={18} /></Arrow>
        <Arrow label={t('breadcrumb.forward')} disabled={!canForward} onClick={() => navigate(1)}><ChevronRight size={18} /></Arrow>
      </div>

      <span aria-hidden="true" style={{ width: 1, height: 18, background: 'var(--bordure-legere)', flexShrink: 0 }} />

      {/* Fil d'Ariane */}
      <nav aria-label={t('breadcrumb.aria')} style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden' }}>
        <Crumb to="/" title={t('breadcrumb.home')}><Home size={14} /></Crumb>
        {crumbs.map((c) => (
          <Fragment key={c.path}>
            <ChevronRight size={13} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} aria-hidden="true" />
            {c.isLink
              ? <Crumb to={c.path}>{c.label}</Crumb>
              : c.patientId
                ? <PatientCrumb id={c.patientId} fallback={c.label} />
                : <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--texte-primaire)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>}
          </Fragment>
        ))}
      </nav>
    </div>
  )
}

// ── Sous-composants ─────────────────────────────────────────────────────────────

function Arrow({ label, disabled, onClick, children }: {
  label: string; disabled: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      style={{
        width: 30, height: 30, borderRadius: 'var(--radius-md)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--texte-tertiaire)' : 'var(--texte-secondaire)',
        opacity: disabled ? 0.4 : 1, transition: 'background .12s, color .12s',
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'var(--fond-surface-2)'; e.currentTarget.style.color = 'var(--texte-primaire)' } }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = disabled ? 'var(--texte-tertiaire)' : 'var(--texte-secondaire)' }}
    >
      {children}
    </button>
  )
}

// Dernier maillon d'un dossier patient → affiche le NOM du patient (lu dans le cache
// React Query, déjà chargé par la page Dossier ; repli « Dossier » si pas encore là).
function PatientCrumb({ id, fallback }: { id: string; fallback: string }) {
  const { data } = usePatientDossier(id)
  const ident = data?.identite
  const name  = ident ? `${(ident.nom ?? '').toUpperCase()} ${ident.prenom ?? ''}`.trim() : ''
  return (
    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--texte-primaire)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
      {name || fallback}
    </span>
  )
}

function Crumb({ to, title, children }: { to: string; title?: string; children: React.ReactNode }) {
  return (
    <Link
      to={to} title={title}
      style={{
        display: 'inline-flex', alignItems: 'center',
        fontSize: 13, fontWeight: 500, color: 'var(--texte-tertiaire)',
        textDecoration: 'none', whiteSpace: 'nowrap',
        padding: '2px 5px', borderRadius: 6, maxWidth: 220,
        overflow: 'hidden', textOverflow: 'ellipsis',
        transition: 'color .12s, background .12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--texte-primaire)'; e.currentTarget.style.background = 'var(--fond-surface-2)' }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--texte-tertiaire)'; e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </Link>
  )
}
