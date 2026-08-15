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

// ── Mode « document composé » ────────────────────────────────────────────────
// Une extraction de référentiel tient dans UN tableau ; un rapport, non : il
// enchaîne une synthèse, des indicateurs, des répartitions. Plutôt que d'inventer
// un second gabarit qui divergerait du premier, la feuille sait désormais empiler
// des BLOCS — et se pagine toute seule à partir de leur hauteur estimée.

export interface ColonneBloc {
  libelle: string
  align?: 'left' | 'right' | 'center'
  /** Largeur fixe en px (colonnes de nombres). */
  largeur?: number
}

export type BlocImprimable =
  /** Encadré d'ouverture : ce qu'il faut retenir, en toutes lettres. */
  | { type: 'synthese'; titre: string; texte: string }
  /** Constats qui sortent de l'ordinaire, chacun sur sa ligne colorée. */
  | { type: 'alertes'; titre: string; items: { ton: 'critique' | 'attention' | 'info'; texte: string }[] }
  /** Cartes de chiffres, quatre par rangée — l'équivalent papier des tuiles à l'écran. */
  | { type: 'indicateurs'; titre: string; items: { label: string; valeur: string | number; hint?: string }[] }
  /** Tableau, découpable sur plusieurs pages (son en-tête est alors répété). */
  | { type: 'tableau'; titre: string; hint?: string; colonnes: ColonneBloc[]; lignes: (string | number)[][] }
  /** Deux tableaux côte à côte : une répartition de trois lignes n'a pas besoin
   *  de toute la largeur d'un A4 paysage. Insécable. */
  | { type: 'paire'; gauche: BlocTableau; droite?: BlocTableau }
  /** Histogramme de périodes — dessiné en CSS, donc imprimable sans image. */
  | { type: 'barres'; titre: string; hint?: string; points: { label: string; valeur: number; courant?: boolean }[] }

export type BlocTableau = Extract<BlocImprimable, { type: 'tableau' }>

interface Props<T> {
  rootId:      string
  /** Titre du document, ex. « PERSONNEL ». */
  titre:       string
  /** Précision sous le titre, ex. « 16 personnes · Actifs ». */
  sousTitre?:  string
  /** Mode LISTE (extraction d'un référentiel) : un seul tableau, paginé par lignes. */
  colonnes?:   ColonneExport<T>[]
  lignes?:     T[]
  cleDe?:      (ligne: T, index: number) => string
  /** Mode DOCUMENT (rapport) : une suite de blocs, paginée par blocs. Prioritaire. */
  blocs?:      BlocImprimable[]
  /** Suffixe ajouté au titre d'un tableau repris sur la page suivante. */
  libelleSuite?: string
  /** Mention libre en bas à gauche, à la place de « Document confidentiel ». */
  piedGauche?: string
  etablissement?: string
  onClose:     () => void
}

export function ListePrintSheet<T>({
  rootId, titre, sousTitre, colonnes, lignes, cleDe, blocs,
  libelleSuite = '(suite)', piedGauche,
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
          /* TOUS les conteneurs de la fenetre d'apercu doivent cesser de borner la
             hauteur. L'overlay est en position:fixed (donc haut d'un ecran) et le modal
             porte max-height:92vh + overflow:hidden : sans cette liberation, tout ce qui
             depasse le premier ecran est coupe — l'imprimante ne recevait qu'UNE feuille,
             quel que soit le nombre de pages affichees dans l'apercu. */
          .lps-overlay, .lps-modal, .lps-wrap {
            position: static !important; inset: auto !important;
            width: auto !important; height: auto !important;
            max-width: none !important; max-height: none !important;
            overflow: visible !important;
            padding: 0 !important; margin: 0 !important;
            background: none !important; box-shadow: none !important;
            border-radius: 0 !important; display: block !important;
          }
          /* La barre d'outils de l'apercu (zoom, imprimer, fermer) n'a rien a faire sur
             le papier. */
          .lps-barre { display: none !important; }
          /* Un position:fixed sur le conteneur ferait tenir TOUTES les pages au même
             endroit : une seule sortirait. Le conteneur redevient un bloc normal, et ce
             sont les pages qui se succèdent. */
          #${rootId} {
            position: absolute !important; top: 0 !important; left: 0 !important;
            margin: 0 !important; padding: 0 !important; background: white !important; box-shadow: none !important;
          }
          /* Une feuille = une page papier, exactement. Le break-after pousse la suivante ;
             la dernière n'en met pas, sinon l'imprimante sort une page blanche finale. */
          #${rootId} .lps-page {
            width: 297mm !important; height: 210mm !important;
            margin: 0 !important; box-shadow: none !important;
            break-after: page; page-break-after: always;
            break-inside: avoid; page-break-inside: avoid;
            overflow: hidden !important;
          }
          #${rootId} .lps-page:last-child { break-after: auto; page-break-after: auto; }
          /* Le découpage est fait en amont (une page = une tranche de lignes) : le
             navigateur n'a plus à paginer le tableau, mais on garde le garde-fou. */
          #${rootId} tr { break-inside: avoid !important; page-break-inside: avoid !important; }
          @page { size: A4 landscape; margin: 0; }
        }`
      document.head.appendChild(style)
      styleRef.current = style
    }
    window.print()
    setTimeout(() => { styleRef.current?.remove(); styleRef.current = null }, 2000)
  }

  const barre = (
    <div className="lps-barre" style={{
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

  // ── Pagination A4 réelle ─────────────────────────────────────────────────
  // Une seule <div> qui s'allonge donnait un aperçu trompeur : à l'écran on voyait une
  // feuille interminable, alors que l'imprimante, elle, découpait. On découpe donc nous-
  // mêmes, et l'aperçu montre exactement ce qui sortira — page par page.
  //
  // Le nombre de lignes tenables est calculé à partir des hauteurs réelles du gabarit
  // plutôt que fixé au doigt mouillé : si l'en-tête ou le pied changent, la pagination
  // suit sans qu'on ait à y repenser.
  const H_ENTETE  = 104   // logo + établissement + titre + filet teal
  const H_PIED    = 40    // filet + mentions
  const H_PADDING = 32    // 14 en haut + 18 en bas de la zone tableau
  const H_THEAD   = 25    // ligne d'en-tête du tableau, répétée sur chaque page
  const H_LIGNE   = 27    // 6+6 de padding + ~9.5px de texte en interligne 1.45
  const lignesParPage = Math.max(
    5,
    Math.floor((SHEET_H - H_ENTETE - H_PIED - H_PADDING - H_THEAD) / H_LIGNE),
  )

  const lignesListe = lignes ?? []
  const pages: T[][] = lignesListe.length === 0
    ? [[]]  // liste vide : une page quand même, avec le message « aucune donnée »
    : Array.from({ length: Math.ceil(lignesListe.length / lignesParPage) }, (_, i) =>
        lignesListe.slice(i * lignesParPage, (i + 1) * lignesParPage))

  // ── Pagination du mode DOCUMENT ──────────────────────────────────────────
  // Même principe que ci-dessus, mais les unités ne sont plus des lignes : ce sont
  // des blocs de hauteurs inégales. On les empile jusqu'à remplir la hauteur utile,
  // en découpant les tableaux trop longs (leur en-tête repart alors sur la page
  // suivante, titre suffixé « (suite) »).
  const H_UTILE = SHEET_H - H_ENTETE - H_PIED - H_PADDING
  const pagesBlocs = blocs ? paginerBlocs(blocs, H_UTILE, libelleSuite) : null

  const enTete = (
    <>
      <div style={{ padding: '26px 34px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
        <div style={{ minWidth: 0 }}>
          <img src={LOGO_URL} alt="CMS SARIS" style={{ height: 34, width: 'auto', display: 'block' }} />
          <p style={{ margin: '9px 0 0', fontSize: 9, color: MUTED, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{etablissement}</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: ACCENT, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{titre}</p>
          {sousTitre && <p style={{ margin: '5px 0 0', fontSize: 9.5, color: MUTED }}>{sousTitre}</p>}
          {/* Date ET heure : une liste est une photo à un instant donné. Deux extractions
              du même jour ne se distingueraient pas sans l'heure. */}
          <p style={{ margin: '2px 0 0', fontSize: 9.5, color: MUTED }}>{formatDateHeure(now)}</p>
        </div>
      </div>
      <div style={{ height: 2, background: ACCENT, margin: '0 34px' }} />
    </>
  )

  /** Châssis d'une feuille A4 : en-tête répété, corps libre, pied paginé. */
  function feuilleA4(iPage: number, nbPages: number, corps: React.ReactNode, mentionDroite: string) {
    return (
      <div
        key={iPage}
        className="lps-page"
        style={{
          width: SHEET_W, height: SHEET_H, background: '#fff',
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          fontSize: 10, color: INK, lineHeight: 1.45,
          display: 'flex', flexDirection: 'column',
          // Marge entre les feuilles À L'ÉCRAN seulement : neutralisée à l'impression
          // (cf. la règle `.lps-page` du <style> print), sinon elle décalerait le contenu.
          marginBottom: iPage < nbPages - 1 ? 18 : 0,
          boxShadow: '0 1px 3px rgba(0,0,0,0.10)',
          printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact',
          overflow: 'hidden',
        } as React.CSSProperties}
      >
        {/* En-tête RÉPÉTÉ sur chaque page : une page 2 anonyme, sans titre ni date,
            n'est plus rattachable au document dont elle est issue. */}
        {enTete}
        {corps}
        <div style={{ borderTop: `2px solid ${ACCENT}`, padding: '8px 34px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 8, color: MUTED }}>
            {piedGauche ?? 'CMS SARIS · Document confidentiel'}
          </p>
          <p style={{ margin: 0, fontSize: 8, color: MUTED, fontFamily: 'monospace' }}>
            {mentionDroite} · page {iPage + 1}/{nbPages}
          </p>
        </div>
      </div>
    )
  }

  const feuille = pagesBlocs ? (
    <div id={rootId}>
      {pagesBlocs.map((blocsPage, iPage) => feuilleA4(
        iPage,
        pagesBlocs.length,
        <div style={{ padding: '14px 34px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 13 }}>
          {blocsPage.map((b, i) => <RenduBloc key={i} bloc={b} />)}
        </div>,
        titre.toLowerCase(),
      ))}
    </div>
  ) : (
    <div id={rootId}>
      {pages.map((lignesPage, iPage) => feuilleA4(
        iPage,
        pages.length,
        <div style={{ padding: '14px 34px 18px', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {(colonnes ?? []).map((c, i) => (
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
              {lignesPage.length === 0 ? (
                <tr>
                  <td colSpan={(colonnes ?? []).length} style={{ padding: '18px 8px', textAlign: 'center', color: MUTED, fontStyle: 'italic' }}>
                    Aucune donnée à extraire
                  </td>
                </tr>
              ) : lignesPage.map((l, i) => {
                // Index ABSOLU : sans lui, l'alternance des fonds se réinitialiserait à
                // chaque page et deux lignes voisines auraient la même couleur au saut.
                const abs = iPage * lignesParPage + i
                return (
                  <tr key={cleDe ? cleDe(l, abs) : abs} style={{ background: abs % 2 === 1 ? '#fafbfc' : '#fff' }}>
                    {(colonnes ?? []).map((c, j) => (
                      <td key={j} style={{
                        textAlign: c.align ?? 'left',
                        padding: '6px 8px',
                        borderBottom: `1px solid ${LINE}`,
                        fontSize: 9.5, color: INK,
                        verticalAlign: 'top',
                      }}>{c.valeur(l)}</td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>,
        `${lignesListe.length} ligne${lignesListe.length > 1 ? 's' : ''}`,
      ))}
    </div>
  )

  return createPortal(
    <div className="lps-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      top: isDesktop ? DESKTOP_TITLEBAR_H : 0,
      background: 'rgba(15, 23, 32, 0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={onClose}>
      <div
        className="lps-modal"
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

// ══════════════════════════════════════════════════════════════════════════════
//  MODE DOCUMENT — hauteurs, pagination, rendu des blocs
// ══════════════════════════════════════════════════════════════════════════════

/* Hauteurs mesurées sur le rendu réel, en px. Elles ne servent qu'à DÉCIDER des
   sauts de page : une estimation un peu large vaut mieux qu'un bloc coupé net. */
const H_TITRE_BLOC = 21
const H_HINT       = 13
const H_THEAD_BLOC = 24
const H_LIGNE_BLOC = 20
const H_CARTE      = 50   // carte d'indicateur (label + valeur + précision)
const H_GAP        = 13   // espace entre deux blocs
const CARTES_RANG  = 4    // cartes par rangée en A4 paysage

/** Hauteur qu'un bloc occupera une fois imprimé. */
function hauteurBloc(b: BlocImprimable): number {
  switch (b.type) {
    case 'synthese':
      // ~150 caractères par ligne à cette largeur et cette taille de police.
      return 30 + Math.ceil(b.texte.length / 150) * 15 + 16
    case 'alertes':
      return H_TITRE_BLOC + b.items.length * 24
    case 'indicateurs':
      return H_TITRE_BLOC + Math.ceil(b.items.length / CARTES_RANG) * (H_CARTE + 8)
    case 'tableau':
      return H_TITRE_BLOC + (b.hint ? H_HINT : 0) + H_THEAD_BLOC
        + Math.max(1, b.lignes.length) * H_LIGNE_BLOC
    case 'paire':
      return Math.max(hauteurBloc(b.gauche), b.droite ? hauteurBloc(b.droite) : 0)
    case 'barres':
      return H_TITRE_BLOC + (b.hint ? H_HINT : 0) + 96
  }
}

/**
 * Répartit les blocs sur des pages A4.
 *
 * Deux règles seulement : on remplit tant que ça rentre ; un tableau qui ne rentre
 * pas est COUPÉ (jamais un titre orphelin en bas de page — on exige la place de
 * l'en-tête plus trois lignes avant de commencer une tranche). Les autres blocs
 * sont insécables : ils basculent entiers sur la page suivante.
 */
function paginerBlocs(blocs: BlocImprimable[], hauteurUtile: number, libelleSuite: string): BlocImprimable[][] {
  const pages: BlocImprimable[][] = []
  let courante: BlocImprimable[] = []
  let reste = hauteurUtile

  const nouvellePage = () => {
    if (courante.length > 0) pages.push(courante)
    courante = []
    reste = hauteurUtile
  }

  for (const bloc of blocs) {
    const h = hauteurBloc(bloc) + (courante.length > 0 ? H_GAP : 0)

    if (h <= reste) {
      courante.push(bloc)
      reste -= h
      continue
    }

    // Un tableau long se coupe plutôt que de laisser une demi-page blanche.
    if (bloc.type === 'tableau' && bloc.lignes.length > 3) {
      let departLignes = 0
      let titre = bloc.titre
      let hint = bloc.hint
      while (departLignes < bloc.lignes.length) {
        const enTeteH = H_TITRE_BLOC + (hint ? H_HINT : 0) + H_THEAD_BLOC + (courante.length > 0 ? H_GAP : 0)
        const dispo = reste - enTeteH
        // On refuse d'ouvrir une tranche de moins de trois lignes : un titre suivi
        // d'une ligne isolée en bas de page ne se lit pas. Sauf sur une page DÉJÀ
        // vide — là, repartir à la ligne ne changerait rien et on tournerait en rond.
        const tenables = Math.max(courante.length === 0 ? 1 : 0, Math.floor(dispo / H_LIGNE_BLOC))
        if (tenables < 3 && courante.length > 0) { nouvellePage(); continue }
        const tranche = bloc.lignes.slice(departLignes, departLignes + tenables)
        courante.push({ ...bloc, titre, hint, lignes: tranche })
        reste -= enTeteH + tranche.length * H_LIGNE_BLOC
        departLignes += tranche.length
        if (departLignes < bloc.lignes.length) {
          // La suite repart en tête de page, sans répéter la phrase d'explication.
          titre = `${bloc.titre} ${libelleSuite}`
          hint = undefined
          nouvellePage()
        }
      }
      continue
    }

    nouvellePage()
    courante.push(bloc)
    reste -= hauteurBloc(bloc)
  }

  if (courante.length > 0) pages.push(courante)
  return pages.length > 0 ? pages : [[]]
}

// ── Rendu ────────────────────────────────────────────────────────────────────

const TON_ALERTE_PRINT = {
  critique:  { fond: '#fdecec', texte: '#96231f' },
  attention: { fond: '#fdf4e3', texte: '#8a5a10' },
  info:      { fond: SOFT,      texte: ACCENT   },
} as const

function TitreBloc({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: 0, fontSize: 8.5, fontWeight: 700, color: ACCENT,
      textTransform: 'uppercase', letterSpacing: '0.09em',
    }}>{children}</p>
  )
}

function TableauBloc({ bloc }: { bloc: BlocTableau }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <TitreBloc>{bloc.titre}</TitreBloc>
      {bloc.hint && <p style={{ margin: '2px 0 0', fontSize: 8, color: MUTED }}>{bloc.hint}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 5 }}>
        <thead>
          <tr>
            {bloc.colonnes.map((c, i) => (
              <th key={i} style={{
                textAlign: c.align ?? 'left', padding: '5px 8px', background: SOFT,
                borderBottom: `1px solid ${LINE}`, fontSize: 7.5, fontWeight: 700, color: MUTED,
                textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap',
                width: c.largeur,
              }}>{c.libelle}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bloc.lignes.length === 0 ? (
            <tr>
              <td colSpan={bloc.colonnes.length} style={{ padding: '10px 8px', textAlign: 'center', color: MUTED, fontStyle: 'italic', fontSize: 9 }}>
                —
              </td>
            </tr>
          ) : bloc.lignes.map((l, i) => (
            <tr key={i} style={{ background: i % 2 === 1 ? '#fafbfc' : '#fff' }}>
              {l.map((v, j) => (
                <td key={j} style={{
                  textAlign: bloc.colonnes[j]?.align ?? 'left',
                  padding: '4px 8px', borderBottom: `1px solid ${LINE}`,
                  fontSize: 9, color: INK, verticalAlign: 'top',
                }}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RenduBloc({ bloc }: { bloc: BlocImprimable }) {
  switch (bloc.type) {
    case 'synthese':
      return (
        <div style={{ background: SOFT, borderLeft: `3px solid ${ACCENT}`, padding: '9px 12px' }}>
          <TitreBloc>{bloc.titre}</TitreBloc>
          <p style={{ margin: '4px 0 0', fontSize: 10, lineHeight: 1.55, color: INK }}>{bloc.texte}</p>
        </div>
      )

    case 'alertes':
      return (
        <div>
          <TitreBloc>{bloc.titre}</TitreBloc>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 5 }}>
            {bloc.items.map((a, i) => {
              const ton = TON_ALERTE_PRINT[a.ton]
              return (
                <p key={i} style={{
                  margin: 0, padding: '5px 9px', background: ton.fond, color: ton.texte,
                  fontSize: 9, lineHeight: 1.4, fontWeight: 600, borderRadius: 3,
                }}>{a.texte}</p>
              )
            })}
          </div>
        </div>
      )

    case 'indicateurs':
      return (
        <div>
          <TitreBloc>{bloc.titre}</TitreBloc>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${CARTES_RANG}, 1fr)`, gap: 8, marginTop: 5 }}>
            {bloc.items.map((it, i) => (
              <div key={i} style={{ border: `1px solid ${LINE}`, borderTop: `2px solid ${ACCENT}`, padding: '6px 9px' }}>
                <p style={{ margin: 0, fontSize: 7.5, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{it.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 17, fontWeight: 800, color: INK, lineHeight: 1.1 }}>{it.valeur}</p>
                {it.hint && <p style={{ margin: '1px 0 0', fontSize: 7.5, color: MUTED, lineHeight: 1.3 }}>{it.hint}</p>}
              </div>
            ))}
          </div>
        </div>
      )

    case 'tableau':
      return <TableauBloc bloc={bloc} />

    case 'paire':
      return (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <TableauBloc bloc={bloc.gauche} />
          {bloc.droite ? <TableauBloc bloc={bloc.droite} /> : <div style={{ flex: 1 }} />}
        </div>
      )

    case 'barres': {
      const max = Math.max(...bloc.points.map(p => p.valeur), 1)
      return (
        <div>
          <TitreBloc>{bloc.titre}</TitreBloc>
          {bloc.hint && <p style={{ margin: '2px 0 0', fontSize: 8, color: MUTED }}>{bloc.hint}</p>}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 74, marginTop: 6 }}>
            {bloc.points.map((p, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 8.5, fontWeight: p.courant ? 800 : 500, color: p.courant ? INK : MUTED }}>{p.valeur}</span>
                <div style={{
                  width: '100%', height: Math.max(2, Math.round((p.valeur / max) * 46)),
                  background: p.courant ? ACCENT : '#c8dbe4',
                }} />
                <span style={{ fontSize: 7.5, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }
  }
}
