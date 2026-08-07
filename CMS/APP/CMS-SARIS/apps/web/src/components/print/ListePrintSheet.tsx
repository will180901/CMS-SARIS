/**
 * ListePrintSheet — extraction PDF d'une LISTE, au format A4 paysage.
 *
 * Pendant de `MedicalPrintSheet` (qui imprime UN document médical : ordonnance,
 * bon d'examen…) : même en-tête SARIS — logo, établissement, titre, filet teal —
 * mais un corps fait d'un tableau plutôt que d'une fiche patient. Ni identité, ni
 * signatures : une liste n'est prescrite par personne.
 *
 * Le tableau reprend la trame de l'application (en-tête gris, intitulés en
 * capitales espacées, lignes alternées) pour qu'on retrouve à l'impression ce
 * qu'on avait à l'écran.
 *
 * Paysage par défaut : une liste a plus de colonnes que de lignes de texte, et le
 * portrait tronquerait ou tasserait. L'en-tête du tableau se répète sur chaque
 * page (`display: table-header-group`), sans quoi les pages 2+ deviennent
 * illisibles.
 *
 * Impression : CSS @media print → PDF natif du navigateur, aucune dépendance.
 */
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, ZoomIn, ZoomOut } from 'lucide-react'
import { isDesktop } from '@/lib/desktop'
import { DESKTOP_TITLEBAR_H } from '@/components/layout/DesktopTitleBar'
import { formatDateTime as intlFormatDateTime } from '@/lib/intl'

const LOGO_URL = `${import.meta.env.BASE_URL}logo_cms_saris.png`

// Palette identique à MedicalPrintSheet — les deux documents doivent se
// ressembler : c'est la même application qui les produit.
const INK    = '#1f2933'
const MUTED  = '#6b7280'
const ACCENT = '#2f6f86'
const SOFT   = '#eef4f7'
const LINE   = '#e4e8ec'

// A4 paysage en px (96 dpi)
const SHEET_W = 297 * 3.78
const SHEET_H = 210 * 3.78

/** « 07 août 2026 à 14:32 » — date d'édition de l'extraction, mentionnée une seule fois. */
function formatDateHeure(d: Date) {
  return intlFormatDateTime(d.toISOString(), {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export interface ColonneExport<T> {
  /** Intitulé affiché dans l'en-tête du tableau. */
  libelle: string
  /** Valeur imprimée pour une ligne. Renvoyer une chaîne : pas de JSX ici, le
   *  papier n'a ni pastille ni icône. */
  valeur: (ligne: T) => string
  /** Alignement — utile pour les colonnes de nombres. */
  align?: 'left' | 'right' | 'center'
}

interface Props<T> {
  rootId:      string
  /** Titre du document, ex. « PERSONNEL ». */
  titre:       string
  /** Précision sous le titre, ex. « 16 personnes · Actifs ». */
  sousTitre?:  string
  colonnes:    ColonneExport<T>[]
  lignes:      T[]
  cleDe:       (ligne: T, index: number) => string
  etablissement?: string
  onClose:     () => void
}

export function ListePrintSheet<T>({
  rootId, titre, sousTitre, colonnes, lignes, cleDe,
  etablissement = 'Centre Médico-Social — République du Congo',
  onClose,
}: Props<T>) {
  const styleRef = useRef<HTMLStyleElement | null>(null)
  // Échelle initiale : la feuille A4 PAYSAGE fait ~1122 px de large et déborde de
  // la plupart des écrans. Sans ajustement, la partie droite — donc le titre et la
  // date — sort du cadre et l'aperçu donne l'impression d'un document tronqué.
  const [zoom, setZoom] = useState(() =>
    Math.min(1, (window.innerWidth * 0.92 - 60) / SHEET_W),
  )
  const now = new Date()

  function handlePrint() {
    if (!styleRef.current) {
      const style = document.createElement('style')
      style.textContent = `
        @media print {
          body * { visibility: hidden !important; }
          #${rootId}, #${rootId} * { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          /* Neutralise la mise à l'échelle de l'aperçu : un ancêtre 'transform'
             redéfinit le référentiel du position:fixed et casse la pagination. */
          .lps-scale { transform: none !important; }
          .lps-wrap  { width: auto !important; height: auto !important; overflow: visible !important; }
          #${rootId} {
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 297mm !important; min-height: 210mm !important;
            margin: 0 !important; padding: 0 !important; background: white !important; box-shadow: none !important;
          }
          /* L'en-tête se répète sur chaque page, et aucune ligne n'est coupée en deux. */
          #${rootId} thead { display: table-header-group !important; }
          #${rootId} tr    { break-inside: avoid !important; page-break-inside: avoid !important; }
          @page { size: A4 landscape; margin: 0; }
        }`
      document.head.appendChild(style)
      styleRef.current = style
    }
    window.print()
    setTimeout(() => { styleRef.current?.remove(); styleRef.current = null }, 2000)
  }

  const barre = (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, padding: '10px 14px',
      borderBottom: '1px solid var(--bordure-legere)',
      background: 'var(--fond-surface)', flexShrink: 0,
    }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--texte-primaire)' }}>
        Aperçu — {titre.toLowerCase()}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          aria-label="Réduire l'aperçu" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
          style={boutonIcone}
        ><ZoomOut size={14} /></button>
        <button
          aria-label="Agrandir l'aperçu" onClick={() => setZoom(z => Math.min(2, z + 0.1))}
          style={boutonIcone}
        ><ZoomIn size={14} /></button>
        <button onClick={handlePrint} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 11px',
          borderRadius: 7, fontSize: 12, fontWeight: 600,
          background: 'var(--ap-500)', color: '#fff', border: 'none', cursor: 'pointer',
        }}>
          <Printer size={13} /> Imprimer / PDF
        </button>
        <button aria-label="Fermer l'aperçu" onClick={onClose} style={boutonIcone}><X size={14} /></button>
      </div>
    </div>
  )

  const feuille = (
    <div id={rootId} style={{
      width: SHEET_W, minHeight: SHEET_H, background: '#fff',
      fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      fontSize: 10, color: INK, lineHeight: 1.45,
      display: 'flex', flexDirection: 'column',
      printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact',
    } as React.CSSProperties}>

      {/* EN-TÊTE — même composition que les documents médicaux */}
      <div style={{ padding: '26px 34px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
        <div style={{ minWidth: 0 }}>
          <img src={LOGO_URL} alt="CMS SARIS" style={{ height: 34, width: 'auto', display: 'block' }} />
          <p style={{ margin: '9px 0 0', fontSize: 9, color: MUTED, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{etablissement}</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: ACCENT, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{titre}</p>
          {sousTitre && <p style={{ margin: '5px 0 0', fontSize: 9.5, color: MUTED }}>{sousTitre}</p>}
          {/* Date ET heure : une liste est une photo à un instant donné. Deux extractions
              du même jour ne se distingueraient pas sans l'heure — or c'est justement ce
              qu'on veut savoir en comparant deux tirages. Mentionnée ICI seulement : le
              pied de page répétait la même date, sans rien apporter. */}
          <p style={{ margin: '2px 0 0', fontSize: 9.5, color: MUTED }}>{formatDateHeure(now)}</p>
        </div>
      </div>
      <div style={{ height: 2, background: ACCENT, margin: '0 34px' }} />

      {/* TABLEAU */}
      <div style={{ padding: '14px 34px 18px', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {colonnes.map((c, i) => (
                <th key={i} style={{
                  textAlign: c.align ?? 'left',
                  padding: '7px 8px',
                  background: SOFT,
                  borderBottom: `1px solid ${LINE}`,
                  fontSize: 8, fontWeight: 700, color: MUTED,
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                  whiteSpace: 'nowrap',
                }}>{c.libelle}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 ? (
              <tr>
                <td colSpan={colonnes.length} style={{ padding: '18px 8px', textAlign: 'center', color: MUTED, fontStyle: 'italic' }}>
                  Aucune donnée à extraire
                </td>
              </tr>
            ) : lignes.map((l, i) => (
              <tr key={cleDe(l, i)} style={{ background: i % 2 === 1 ? '#fafbfc' : '#fff' }}>
                {colonnes.map((c, j) => (
                  <td key={j} style={{
                    textAlign: c.align ?? 'left',
                    padding: '6px 8px',
                    borderBottom: `1px solid ${LINE}`,
                    fontSize: 9.5, color: INK,
                    verticalAlign: 'top',
                  }}>{c.valeur(l)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PIED DE PAGE */}
      <div style={{ borderTop: `2px solid ${ACCENT}`, padding: '8px 34px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 8, color: MUTED }}>
          CMS SARIS · Document confidentiel
        </p>
        <p style={{ margin: 0, fontSize: 8, color: MUTED, fontFamily: 'monospace' }}>
          {lignes.length} ligne{lignes.length > 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      top: isDesktop ? DESKTOP_TITLEBAR_H : 0,
      background: 'rgba(15, 23, 32, 0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--fond-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--ombre-3)',
          display: 'flex', flexDirection: 'column',
          maxWidth: '95vw', maxHeight: '92vh', overflow: 'hidden',
        }}
      >
        {barre}
        <div className="lps-wrap" style={{ overflow: 'auto', padding: 16, background: 'var(--fond-surface-2)' }}>
          {/* La hauteur réservée suit l'échelle, sinon le zoom laisse un grand vide
              sous la feuille (le transform ne change pas la place occupée). */}
          <div style={{ width: SHEET_W * zoom, minHeight: SHEET_H * zoom }}>
            <div className="lps-scale" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
              {feuille}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const boutonIcone: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 30, height: 30, borderRadius: 7,
  background: 'transparent', border: '1px solid var(--bordure-normale)',
  color: 'var(--texte-secondaire)', cursor: 'pointer',
}
