/**
 * MedicalPrintSheet — gabarit A4 imprimable commun à TOUS les documents médicaux
 * de CMS SARIS (ordonnance, bon d'examen, évacuation, accident, suivi, synthèse).
 *
 * Design épuré et cohérent avec l'application : logo réel de l'app, accent teal
 * SARIS, une seule police, espacements généreux, filets fins. Le corps propre au
 * document est passé en `children`.
 *
 * Aperçu en deux variantes :
 *   - `modal`  : fenêtre centrée (par défaut) — utilisé hors consultation.
 *   - `inline` : recouvre la ZONE où il est monté (position:absolute inset:0) —
 *                intégré dans la zone droite de la consultation, sans modale.
 *
 * Impression : CSS @media print → PDF natif du navigateur, sans dépendance.
 */
import { useRef, useState, useEffect, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, FileText, ZoomIn, ZoomOut } from 'lucide-react'
import { labelMetier } from '@/config/labels'
import { formatDate as intlFormatDate } from '@/lib/intl'
import { calcAge } from '@/lib/age'

const LOGO_URL = `${import.meta.env.BASE_URL}logo_cms_saris.png`

// Palette document — cohérente avec l'app (teal SARIS), contrastée pour le papier.
const INK    = '#1f2933'
const MUTED  = '#6b7280'
const ACCENT = '#2f6f86'   // teal profond (lisible sur blanc)
const SOFT   = '#eef4f7'   // teal très clair (bandeaux / lignes alternées)
const LINE   = '#e4e8ec'

const SHEET_W = 210 * 3.78  // 210 mm en px (96 dpi)
const SHEET_H = 297 * 3.78

// Hôte d'aperçu : conteneur (position:relative) fourni par l'écran parent (ex. la
// zone de travail de la consultation) dans lequel l'aperçu inline se PORTALISE — pour
// échapper au `backdrop-filter` des Cards (qui en ferait un bloc conteneur trop petit).
export const PreviewHostContext = createContext<HTMLElement | null>(null)

function formatDate(iso: string) {
  return intlFormatDate(iso, { day: '2-digit', month: 'long', year: 'numeric' })
}
export interface PrintPatient {
  identite:          { nom: string; prenom: string; dateNaissance: string; sexe: string } | null
  numeroPatient:     string
  categorieLibelle?: string
}
export interface PrintSoignant {
  prenom?: string; nom?: string; role?: string | null; matricule?: string | null
}

interface Props {
  rootId:        string
  titre:         string          // ex. « BON D'EXAMEN »
  apercuLabel:   string          // ex. « Aperçu du bon d'examen »
  numero:        string
  date:          string          // ISO
  patient:       PrintPatient
  soignant?:     PrintSoignant | null
  /** Libellé de la 2e zone de signature (ex. « Cachet établissement destinataire »). */
  secondSignatureLabel?: string
  /** Ligne d'établissement sous le logo (ex. « Centre Médico-Social — CMS Moutela »). */
  etablissement?: string
  children:      React.ReactNode  // corps du document
  onClose:       () => void
  variant?:      'modal' | 'inline'
}

// Met la feuille A4 (793px) à l'ÉCHELLE pour qu'elle tienne dans la largeur
// disponible : plus de scroll horizontal, document lisible quelle que soit la
// largeur du panneau. `transform: scale` (universel, vs `zoom`) ; un wrapper réserve
// la taille mise à l'échelle pour un défilement vertical correct. L'impression n'est
// PAS affectée (le CSS @media print recompose #rootId à 210mm).
function ScaledSheet({ children, zoom = 1 }: { children: React.ReactNode; zoom?: number }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const innerRef  = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(1)
  const [sheetH, setSheetH]     = useState(SHEET_H)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const compute = () => {
      const avail = el.clientWidth - 48
      setFitScale(Math.min(1, Math.max(0.3, avail / SHEET_W)))
      if (innerRef.current) setSheetH(innerRef.current.offsetHeight)
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    const t = window.setTimeout(compute, 120)   // re-mesure après peinture du contenu
    return () => { ro.disconnect(); window.clearTimeout(t) }
  }, [])
  const scale = Math.min(3, Math.max(0.25, fitScale * zoom))   // zoom utilisateur PAR-DESSUS l'ajustement auto
  return (
    <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', background: '#e9edf0', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 24 }}>
      <div className="ms-print-wrap" style={{ width: SHEET_W * scale, height: sheetH * scale, flexShrink: 0 }}>
        <div ref={innerRef} className="ms-print-scale" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: SHEET_W }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export function MedicalPrintSheet({
  rootId, titre, apercuLabel, numero, date, patient, soignant,
  secondSignatureLabel = "Cachet de l'établissement destinataire",
  etablissement = 'Centre Médico-Social — République du Congo',
  children, onClose, variant = 'modal',
}: Props) {
  const styleRef = useRef<HTMLStyleElement | null>(null)
  const previewHost = useContext(PreviewHostContext)
  const [zoom, setZoom] = useState(1)   // zoom utilisateur de l'aperçu (1 = ajusté à la largeur)
  const identite = patient.identite
  const now = new Date()

  function handlePrint() {
    if (!styleRef.current) {
      const style = document.createElement('style')
      style.textContent = `
        @media print {
          body * { visibility: hidden !important; }
          #${rootId}, #${rootId} * { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          /* CRUCIAL : neutraliser la mise à l'échelle de l'aperçu — un ancêtre 'transform'
             redéfinit le référentiel du position:fixed et casse l'impression A4. */
          .ms-print-scale { transform: none !important; }
          .ms-print-wrap  { width: auto !important; height: auto !important; overflow: visible !important; }
          #${rootId} {
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 210mm !important; min-height: 297mm !important;
            margin: 0 !important; padding: 0 !important; background: white !important; box-shadow: none !important;
          }
          @page { size: A4; margin: 0; }
        }`
      document.head.appendChild(style)
      styleRef.current = style
    }
    window.print()
    setTimeout(() => { styleRef.current?.remove(); styleRef.current = null }, 2000)
  }

  // ── Barre d'actions (commune aux deux variantes) ──────────────────────────
  const zoomBtn: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 6, background: 'var(--fond-surface-2)',
    border: '1px solid var(--bordure-legere)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--texte-secondaire)',
  }
  const toolbar = (
    <div style={{ flexShrink: 0, padding: '12px 18px', background: 'var(--fond-surface)', borderBottom: '1px solid var(--bordure-legere)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--ap-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileText size={15} style={{ color: 'var(--ap-600)' }} />
        </div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apercuLabel}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        {variant === 'inline' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginRight: 4 }}>
            <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.15).toFixed(2)))} title="Dézoomer" style={zoomBtn}><ZoomOut size={14} /></button>
            <button onClick={() => setZoom(1)} title="Ajuster à la largeur" style={{ ...zoomBtn, width: 'auto', padding: '0 8px', fontSize: 11, fontWeight: 700 }}>{Math.round(zoom * 100)}%</button>
            <button onClick={() => setZoom(z => Math.min(2.5, +(z + 0.15).toFixed(2)))} title="Zoomer" style={zoomBtn}><ZoomIn size={14} /></button>
          </div>
        )}
        <button onClick={handlePrint} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'var(--ap-500)', color: '#fff', border: 'none', cursor: 'pointer' }}>
          <Printer size={13} /> Imprimer
        </button>
        <button onClick={onClose} title="Fermer l'aperçu" style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--texte-secondaire)' }}>
          <X size={14} />
        </button>
      </div>
    </div>
  )

  // ── Feuille A4 ────────────────────────────────────────────────────────────
  const sheet = (
    <div id={rootId} style={{
      width: SHEET_W, minHeight: SHEET_H, flexShrink: 0,
      background: '#fff', boxShadow: '0 6px 28px rgba(15,23,42,0.16)',
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      fontSize: 11, color: INK, lineHeight: 1.5,
      display: 'flex', flexDirection: 'column',
      printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact',
    } as React.CSSProperties}>

      {/* EN-TÊTE */}
      <div style={{ padding: '30px 40px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
        <div style={{ minWidth: 0 }}>
          <img src={LOGO_URL} alt="CMS SARIS" style={{ height: 38, width: 'auto', display: 'block' }} />
          <p style={{ margin: '10px 0 0', fontSize: 9.5, color: MUTED, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{etablissement}</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: ACCENT, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{titre}</p>
          <p style={{ margin: '6px 0 0', fontSize: 9.5, color: MUTED }}>N° <span style={{ fontWeight: 700, color: INK, fontFamily: 'monospace' }}>{numero}</span></p>
          <p style={{ margin: '2px 0 0', fontSize: 9.5, color: MUTED }}>{formatDate(date)}</p>
        </div>
      </div>
      <div style={{ height: 2, background: ACCENT, margin: '0 40px' }} />

      {/* PATIENT + PRESCRIPTEUR */}
      <div style={{ padding: '16px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
        <IdentityBlock title="Patient" rows={[
          ['Nom & prénom', identite ? `${identite.nom.toUpperCase()} ${identite.prenom}` : '—'],
          ['Naissance', identite ? `${formatDate(identite.dateNaissance)} · ${calcAge(identite.dateNaissance)} ans` : '—'],
          ['Sexe', identite?.sexe === 'M' ? 'Masculin' : identite?.sexe === 'F' ? 'Féminin' : '—'],
          ['N° dossier', patient.numeroPatient, true],
          ...(patient.categorieLibelle ? [['Catégorie', patient.categorieLibelle] as [string, string]] : []),
        ]} />
        <IdentityBlock title="Prescripteur" rows={[
          ['Nom & prénom', soignant?.prenom || soignant?.nom ? `${soignant?.prenom ?? ''} ${(soignant?.nom ?? '').toUpperCase()}`.trim() : '—'],
          ['Fonction', soignant?.role ? labelMetier(soignant.role) : '—'],
          ['Matricule', soignant?.matricule ?? '—', true],
          ["Date d'émission", formatDate(now.toISOString())],
        ]} />
      </div>

      {/* CORPS */}
      <div style={{ padding: '8px 40px 18px', flex: 1 }}>{children}</div>

      {/* SIGNATURES */}
      <div style={{ padding: '16px 40px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36 }}>
        <SignatureBox label="Signature et cachet du prescripteur" hint={soignant ? `${soignant.prenom ?? ''} ${soignant.nom ?? ''}${soignant.matricule ? ` — ${soignant.matricule}` : ''}`.trim() : ''} />
        <SignatureBox label={secondSignatureLabel} hint="Date : ___/___/______   Visa :" />
      </div>

      {/* PIED DE PAGE */}
      <div style={{ borderTop: `2px solid ${ACCENT}`, padding: '8px 40px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 8, color: MUTED }}>CMS SARIS · Document confidentiel à usage médical — généré le {formatDate(now.toISOString())}</p>
        <p style={{ margin: 0, fontSize: 8, color: MUTED, fontFamily: 'monospace' }}>{patient.numeroPatient} · Réf. {numero}</p>
      </div>
    </div>
  )

  // ── Variante INLINE : recouvre la zone (zone droite consultation) ─────────
  if (variant === 'inline') {
    const content = (
      <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'var(--fond-page)', display: 'flex', flexDirection: 'column' }}>
        {toolbar}
        <ScaledSheet zoom={zoom}>{sheet}</ScaledSheet>
      </div>
    )
    // Portalisé dans la zone de travail (hôte position:relative) → couvre toute la
    // zone, jamais coincé par le backdrop-filter d'une Card parente. Repli en place.
    return previewHost ? createPortal(content, previewHost) : content
  }

  // ── Variante MODALE : fenêtre centrée ─────────────────────────────────────
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 1001, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: SHEET_W + 28, background: 'var(--fond-surface)', borderRadius: 12, boxShadow: '0 24px 60px rgba(15,23,42,0.3)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {toolbar}
          <div style={{ background: '#e9edf0', display: 'flex', justifyContent: 'center', padding: 24 }}>
            {sheet}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Primitives ────────────────────────────────────────────────────────────────

function IdentityBlock({ title, rows }: { title: string; rows: ([string, string] | [string, string, boolean])[] }) {
  return (
    <div>
      <p style={{ margin: '0 0 8px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: ACCENT }}>{title}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}><tbody>
        {rows.map(([label, value, mono], i) => (
          <tr key={i}>
            <td style={{ padding: '2.5px 0', color: MUTED, width: '42%', verticalAlign: 'top', fontSize: 9.5 }}>{label}</td>
            <td style={{ padding: '2.5px 0 2.5px 8px', color: INK, fontWeight: 600, verticalAlign: 'top', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  )
}

function SignatureBox({ label, hint }: { label: string; hint: string }) {
  return (
    <div>
      <p style={{ margin: '0 0 5px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: ACCENT }}>{label}</p>
      <div style={{ height: 56, border: `1px dashed #c2cbd2`, borderRadius: 6, display: 'flex', alignItems: 'flex-end', padding: '5px 9px' }}>
        <p style={{ margin: 0, fontSize: 9, color: MUTED }}>{hint}</p>
      </div>
    </div>
  )
}

// Réexports utilitaires pour les corps de documents
export { formatDate as formatPrintDate }
export const PRINT_INK = INK
export const PRINT_MUTED = MUTED
export const PRINT_ACCENT = ACCENT
export const PRINT_SOFT = SOFT
export const PRINT_LINE = LINE

/** Section de corps réutilisable (titre accentué + contenu). */
export function PrintSection({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ margin: '0 0 7px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: ACCENT }}>{titre}</p>
      {children}
    </div>
  )
}

/** Zone de texte libre encadrée (indications, circonstances…). */
export function PrintProse({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, color: INK, lineHeight: 1.55, whiteSpace: 'pre-wrap', background: SOFT, border: `1px solid ${LINE}`, borderRadius: 6, padding: '10px 12px' }}>
      {children}
    </div>
  )
}

/** Tableau propre : en-tête teal, lignes alternées. */
export interface PrintColumn { key: string; label: string; width?: number; align?: 'left' | 'center' }
export function PrintTable({ columns, rows }: { columns: PrintColumn[]; rows: Record<string, React.ReactNode>[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
      <thead>
        <tr style={{ background: ACCENT, color: '#fff' }}>
          {columns.map(c => (
            <th key={c.key} style={{ padding: '7px 10px', textAlign: c.align ?? 'left', fontWeight: 700, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.05em', width: c.width }}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? SOFT : '#fff', borderBottom: `1px solid ${LINE}` }}>
            {columns.map(c => (
              <td key={c.key} style={{ padding: '7px 10px', verticalAlign: 'top', textAlign: c.align ?? 'left', color: INK }}>{r[c.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Encart d'information coloré (note de bas de document). */
export function PrintCallout({ tone = 'info', children }: { tone?: 'info' | 'danger' | 'success'; children: React.ReactNode }) {
  const T = {
    info:    { bg: SOFT,      bd: '#cfe0e7', ac: ACCENT,    fg: '#234b58' },
    danger:  { bg: '#fff1f2', bd: '#fecdd3', ac: '#b91c1c', fg: '#7f1d1d' },
    success: { bg: '#f0fdf4', bd: '#bbf7d0', ac: '#15803d', fg: '#14532d' },
  }[tone]
  return (
    <div style={{ marginTop: 12, padding: '9px 13px', background: T.bg, border: `1px solid ${T.bd}`, borderLeft: `3px solid ${T.ac}`, borderRadius: 6 }}>
      <p style={{ margin: 0, fontSize: 9.5, color: T.fg, lineHeight: 1.5 }}>{children}</p>
    </div>
  )
}

/** Valeur mise en avant (niveau d'urgence, gravité…). */
export function PrintEmphasis({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: danger ? '#b91c1c' : ACCENT }}>{children}</p>
}
