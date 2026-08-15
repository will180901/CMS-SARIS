/**
 * Sélection multiple + suppression en lot — brique commune à TOUTES les listes.
 *
 * Généralise le patron éprouvé de la messagerie (`selectMode` / `selectedIds` /
 * `onToggleSelect` + suppression groupée) pour les listes tabulaires, sans le
 * recopier dans chaque page.
 *
 * Comme dans la messagerie, la sélection est un MODE : les cases à cocher n'existent
 * pas tant qu'on ne l'a pas demandé. On y entre par l'action « Sélectionner » du menu
 * de ligne (`sel.entrer(ligne)`), qui coche du même geste la ligne d'où l'on vient ;
 * on en sort par « Annuler ». Une liste au repos reste donc une liste de lecture,
 * sans colonne de cases qui la ferait ressembler à un formulaire.
 *
 * La suppression en lot rejoue la suppression UNITAIRE déjà exposée par chaque
 * module (même URL, mêmes permissions, mêmes garde-fous 409 côté serveur) : aucun
 * nouvel endpoint, donc aucun risque d'ouvrir une porte dérobée. Les lignes que le
 * serveur refuse (encore référencées ailleurs) restent cochées et sont annoncées.
 *
 * Branchement type dans une page :
 *
 *   const sel = useSelectionLot({
 *     idDe: (m) => m.id,
 *     supprimer: (id) => referentielsApi.medicaments.remove(id),
 *     invalider: [QUERY_KEYS.medicaments],
 *   })
 *   …
 *   <BarreSelectionLot sel={sel} lignes={filtered} />
 *   <tr {...proprietesLigne(sel, m, dataRowStyle(striped, survol))}>
 *     <td><CaseSelectionLigne sel={sel} ligne={m}>{…contenu habituel…}</CaseSelectionLigne></td>
 *   … et dans le menu ⋮ de la ligne : <ActionSelectionner onClick={() => sel.entrer(m)} />
 *
 * Le tableau garde EXACTEMENT ses colonnes : rien n'est ajouté ni retiré à sa
 * structure, seule la première cellule s'enrichit d'une case pendant le mode.
 */
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2, Loader2, X, AlertTriangle, ListChecks } from 'lucide-react'
import { toast } from '@workspace/ui/components/sonner'
import { DropdownMenuItem } from '@workspace/ui/components/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'
import { CheckBox } from './CheckBox'

/** Nombre de suppressions envoyées en même temps — assez pour être rapide, assez peu
 *  pour ne pas saturer une connexion de terrain ni le pool de la base. */
const LOT = 4

export interface SelectionLot<T> {
  /** Mode sélection en cours : c'est LUI qui fait apparaître les cases à cocher. */
  actif: boolean
  /** Entre en mode sélection en cochant la ligne d'où part l'action. */
  entrer: (ligne: T) => void
  /** Quitte le mode et oublie la sélection. */
  quitter: () => void
  /** Identifiants cochés. */
  ids: Set<string>
  nb: number
  estSelectionne: (ligne: T) => boolean
  basculer: (ligne: T) => void
  /** Une ligne peut-elle être cochée ? (faux = protégée, case désactivée) */
  selectionnable: (ligne: T) => boolean
  /** Coche toutes les lignes fournies (action « Tout sélectionner » du bandeau). */
  toutSelectionner: (lignes: T[]) => void
  /** Lance la suppression des lignes cochées (parmi celles fournies). */
  supprimerSelection: (lignes: T[]) => Promise<void>
  enCours: boolean
}

export interface OptionsSelectionLot<T> {
  idDe: (ligne: T) => string
  /** Suppression UNITAIRE côté API — appel brut, sans toast (le lot en fait un seul). */
  supprimer: (id: string) => Promise<unknown>
  /** Clés React Query à invalider une fois le lot terminé. */
  invalider?: readonly (readonly unknown[])[]
  /** Lignes qu'on ne doit pas pouvoir cocher (compte protégé, ligne verrouillée…). */
  verrouillee?: (ligne: T) => boolean
}

export function useSelectionLot<T>({
  idDe, supprimer, invalider, verrouillee,
}: OptionsSelectionLot<T>): SelectionLot<T> {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [actif, setActif] = useState(false)
  const [ids, setIds] = useState<Set<string>>(new Set())
  const [enCours, setEnCours] = useState(false)

  const selectionnable = useCallback(
    (ligne: T) => !verrouillee?.(ligne),
    [verrouillee],
  )
  const estSelectionne = useCallback((ligne: T) => ids.has(idDe(ligne)), [ids, idDe])

  const basculer = useCallback((ligne: T) => {
    if (!selectionnable(ligne)) return
    const id = idDe(ligne)
    setIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }, [idDe, selectionnable])

  const toutSelectionner = useCallback((lignes: T[]) => {
    setIds(prev => {
      const n = new Set(prev)
      lignes.filter(selectionnable).forEach(l => n.add(idDe(l)))
      return n
    })
  }, [idDe, selectionnable])

  /** Entrée dans le mode : la ligne d'où part l'action est cochée d'emblée — sans
   *  cela, on ouvre un mode sélection vide et il faut recliquer sur la même ligne. */
  const entrer = useCallback((ligne: T) => {
    setActif(true)
    setIds(selectionnable(ligne) ? new Set([idDe(ligne)]) : new Set())
  }, [idDe, selectionnable])

  const quitter = useCallback(() => { setActif(false); setIds(new Set()) }, [])

  const supprimerSelection = useCallback(async (lignes: T[]) => {
    const cibles = lignes.filter(l => ids.has(idDe(l)) && selectionnable(l))
    if (cibles.length === 0 || enCours) return
    setEnCours(true)
    const echecs: string[] = []
    let ok = 0
    try {
      for (let i = 0; i < cibles.length; i += LOT) {
        const paquet = cibles.slice(i, i + LOT)
        const resultats = await Promise.allSettled(paquet.map(l => supprimer(idDe(l))))
        resultats.forEach((r, j) => {
          if (r.status === 'fulfilled') ok++
          else echecs.push(idDe(paquet[j]!))
        })
      }
    } finally {
      setEnCours(false)
      invalider?.forEach(qk => { void qc.invalidateQueries({ queryKey: qk }) })
      // Les refusés restent cochés — et le mode reste ouvert tant qu'il en reste,
      // pour que l'utilisateur voie exactement ce qui a résisté.
      setIds(new Set(echecs))
      if (echecs.length === 0) setActif(false)
    }
    if (echecs.length === 0) toast.success(t('selection.resultOk', { count: ok }))
    else if (ok === 0) toast.error(t('selection.resultNone', { count: echecs.length }))
    else toast.warning(t('selection.resultPartial', { ok, ko: echecs.length }))
  }, [ids, idDe, selectionnable, enCours, supprimer, invalider, qc, t])

  return useMemo(() => ({
    actif, entrer, quitter,
    ids, nb: ids.size, estSelectionne, basculer, selectionnable,
    toutSelectionner, supprimerSelection, enCours,
  }), [actif, entrer, quitter, ids, estSelectionne, basculer, selectionnable,
       toutSelectionner, supprimerSelection, enCours])
}

/**
 * Entrée « Sélectionner » du menu ⋮ d'une ligne — LE point d'entrée du mode.
 * Rendue comme un `DropdownMenuItem` pour reprendre le style des autres actions.
 */
export function ActionSelectionner({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <DropdownMenuItem onClick={onClick} style={{ gap: '8px', cursor: 'pointer' }}>
      <ListChecks size={13} /> {t('selection.enterMode')}
    </DropdownMenuItem>
  )
}

/**
 * Case à cocher posée DANS la première cellule de la ligne — jamais dans une
 * colonne à elle.
 *
 * Ajouter une colonne à un tableau dont les largeurs sont figées (`tableLayout:
 * fixed` + largeurs mémorisées par `useColumnResize`) décale toutes les colonnes
 * d'un cran le temps d'un rendu, puis force une re-mesure qui perd le réglage de
 * l'utilisateur. En restant à l'intérieur d'une cellule existante, le nombre de
 * colonnes ne bouge jamais : il n'y a rien à re-mesurer, donc rien à casser.
 *
 * Hors mode sélection, le composant rend ses enfants tels quels — le balisage
 * d'origine est strictement inchangé.
 */
export function CaseSelectionLigne<T>({ sel, ligne, children }: {
  sel: SelectionLot<T>
  ligne: T
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  if (!sel.actif) return <>{children}</>
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span
        onClick={e => e.stopPropagation()}
        style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
      >
        <CheckBox
          size={15}
          checked={sel.estSelectionne(ligne)}
          disabled={!sel.selectionnable(ligne)}
          onChange={() => sel.basculer(ligne)}
          aria-label={t('selection.selectRow')}
        />
      </span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  )
}

/**
 * Propriétés du `<tr>` d'une ligne : reprend son style habituel et, PENDANT le mode
 * sélection seulement, rend la ligne ENTIÈRE cliquable pour cocher/décocher. On vise
 * une ligne, pas une case de quinze pixels.
 *
 * Usage : `<tr {...proprietesLigne(sel, m, dataRowStyle(striped, survol))}>`
 */
export function proprietesLigne<T>(
  sel: SelectionLot<T>,
  ligne: T,
  style: React.CSSProperties,
): { style: React.CSSProperties; onClick?: () => void } {
  if (!sel.actif) return { style }
  return {
    style: { ...style, cursor: sel.selectionnable(ligne) ? 'pointer' : 'default' },
    onClick: () => sel.basculer(ligne),
  }
}

/**
 * Bandeau d'action, affiché au-dessus du tableau pendant TOUT le mode sélection —
 * y compris quand on a tout décoché : c'est lui qui porte la sortie du mode.
 * Il pousse le tableau vers le bas au lieu de flotter par-dessus : sur une liste
 * dense, un bandeau flottant masque justement les lignes qu'on vient de cocher.
 */
export function BarreSelectionLot<T>({
  sel, lignes, titreConfirmation, descriptionConfirmation, actionsSupplementaires,
}: {
  sel: SelectionLot<T>
  /** Ensemble de référence (liste filtrée complète) : cible du « tout sélectionner ». */
  lignes: T[]
  titreConfirmation?: string
  descriptionConfirmation?: string
  /** Boutons additionnels (ex. export de la sélection), rendus avant « Supprimer ». */
  actionsSupplementaires?: React.ReactNode
}) {
  const { t } = useTranslation()
  const [confirme, setConfirme] = useState(false)
  if (!sel.actif) return null

  const eligibles = lignes.filter(sel.selectionnable)
  const toutesCochees = eligibles.length > 0 && eligibles.every(sel.estSelectionne)

  return (
    <>
      <div
        role="status"
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', flexWrap: 'wrap',
          padding: '8px 12px', marginBottom: 'var(--espace-2)',
          background: 'var(--ap-50)', border: '1px solid var(--ap-200)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <span style={{ fontSize: 'var(--font-size-body-sm)', fontWeight: 700, color: 'var(--ap-700)' }}>
          {t('selection.count', { count: sel.nb })}
        </span>

        {!toutesCochees && eligibles.length > sel.nb && (
          <button
            type="button"
            onClick={() => sel.toutSelectionner(lignes)}
            style={{
              fontSize: 'var(--font-size-body-sm)', fontWeight: 600, padding: '4px 8px',
              background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)',
              color: 'var(--ap-600)', cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            {t('selection.selectAll', { count: eligibles.length })}
          </button>
        )}

        <div style={{ flex: 1 }} />

        {actionsSupplementaires}

        <button
          type="button"
          onClick={sel.quitter}
          disabled={sel.enCours}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 'var(--font-size-body-sm)', fontWeight: 600, height: 30, padding: '0 10px',
            background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)',
            borderRadius: 'var(--radius-md)', color: 'var(--texte-secondaire)',
            cursor: sel.enCours ? 'not-allowed' : 'pointer',
          }}
        >
          <X size={14} /> {t('common.cancel')}
        </button>

        <button
          type="button"
          onClick={() => setConfirme(true)}
          disabled={sel.enCours || sel.nb === 0}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 'var(--font-size-body-sm)', fontWeight: 600, height: 30, padding: '0 12px',
            background: 'var(--erreur-accent)', border: '1px solid var(--erreur-accent)',
            borderRadius: 'var(--radius-md)', color: '#fff',
            cursor: sel.enCours || sel.nb === 0 ? 'not-allowed' : 'pointer',
            opacity: sel.enCours || sel.nb === 0 ? 0.5 : 1,
          }}
        >
          {sel.enCours ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          {sel.enCours ? t('selection.deleting') : t('selection.deleteSelected')}
        </button>
      </div>

      <AlertDialog open={confirme} onOpenChange={(o) => { if (!o) setConfirme(false) }}>
        <AlertDialogContent style={{
          background: 'var(--fond-surface)', borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--bordure-legere)', boxShadow: 'var(--ombre-4)',
          maxWidth: 440, padding: 0, overflow: 'hidden', gap: 0,
        }}>
          <AlertDialogHeader style={{
            padding: 'var(--espace-5) var(--espace-5) var(--espace-4)',
            display: 'flex', flexDirection: 'row', alignItems: 'flex-start',
            gap: 'var(--espace-3)', textAlign: 'left',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 'var(--radius-lg)',
              background: 'var(--erreur-fond)', color: 'var(--erreur-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <AlertTriangle size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <AlertDialogTitle style={{
                margin: 0, fontSize: 'var(--font-size-h4)', fontWeight: 700,
                color: 'var(--texte-primaire)', lineHeight: 1.3,
              }}>
                {titreConfirmation ?? t('selection.confirmTitle', { count: sel.nb })}
              </AlertDialogTitle>
              <AlertDialogDescription style={{
                margin: '4px 0 0', fontSize: 'var(--font-size-body-sm)',
                color: 'var(--texte-secondaire)', lineHeight: 1.55,
              }}>
                {descriptionConfirmation ?? t('selection.confirmDesc')}
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter style={{
            padding: 'var(--espace-3) var(--espace-5)',
            borderTop: '1px solid var(--bordure-legere)', background: 'var(--fond-surface-2)',
            display: 'flex', justifyContent: 'flex-end', gap: 'var(--espace-2)',
          }}>
            <AlertDialogCancel disabled={sel.enCours} style={{
              margin: 0, background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)',
              color: 'var(--texte-secondaire)', borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-body-sm)', fontWeight: 600, height: 34, padding: '0 14px',
            }}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirme(false); void sel.supprimerSelection(lignes) }}
              disabled={sel.enCours}
              style={{
                background: 'var(--erreur-accent)', color: '#fff', borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-body-sm)', fontWeight: 600, height: 34, padding: '0 16px',
                opacity: sel.enCours ? 0.7 : 1,
              }}
            >
              {t('selection.deleteSelected')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
