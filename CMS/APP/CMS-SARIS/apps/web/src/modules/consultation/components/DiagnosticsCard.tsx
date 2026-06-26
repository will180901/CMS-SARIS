/**
 * DiagnosticsCard — Saisie des diagnostics d'une consultation.
 *
 * Ergonomie : liste à puces en lecture seule (en haut) + petit champ de saisie
 * libre avec bouton ➕ (en bas). Le médecin tape librement ; une autocomplétion
 * discrète propose les pathologies connues. À l'ajout :
 *   • si le texte correspond à une pathologie du référentiel → on garde le code
 *     (statistiques + suggestion de suivi chronique préservées) ;
 *   • sinon → la pathologie est créée à la volée (texte libre conservé + codé).
 * Le 1ᵉʳ diagnostic est « Principal », les suivants « Associé » (automatique).
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Loader2 } from 'lucide-react'
import { Card } from '@/components/saris'
import { useAddDiagnostic, useRemoveDiagnostic } from '../hooks/useConsultation'
import { usePathologies, useCreatePathologie } from '@/modules/referentiels/hooks/useReferentiels'
import { usePermissions } from '@/hooks/usePermissions'
import { Popover, PopoverAnchor, PopoverContent } from '@workspace/ui/components/popover'
import type { DiagnosticDetail, TypeDiagnostic } from '@cms-saris/types'
import { normaliser } from '@/lib/text'

/** Génère un code normalisé depuis un libellé (3–6 chars) */
function autoCode(libelle: string): string {
  return libelle
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6)
    || 'AUTRE'
}

// ── Composant ─────────────────────────────────────────────────────────────────

interface Props {
  consultationId: string
  diagnostics:    DiagnosticDetail[]
  readonly?:      boolean
}

export function DiagnosticsCard({ consultationId, diagnostics, readonly }: Props) {
  const { t } = useTranslation()
  const TYPE_LABEL: Record<TypeDiagnostic, string> = {
    PRINCIPAL: t('consultation.diagTypePrincipal'),
    ASSOCIE:   t('consultation.diagTypeAssocie'),
  }
  const [input, setInput] = useState('')
  const [focus, setFocus] = useState(false)

  const { has } = usePermissions()
  const canCreatePatho = has('referentiel.pathologie.create')

  const { data: pathologies = [] } = usePathologies()
  const addDiag          = useAddDiagnostic(consultationId)
  const removeDiag       = useRemoveDiagnostic(consultationId)
  const createPathologie = useCreatePathologie()

  const alreadyIds   = useMemo(() => new Set(diagnostics.map(d => d.pathologieId)), [diagnostics])
  const hasPrincipal = diagnostics.some(d => d.type === 'PRINCIPAL')
  const busy         = createPathologie.isPending || addDiag.isPending

  // Autocomplétion : pathologies actives correspondant à la saisie, non déjà ajoutées.
  const suggestions = useMemo(() => {
    const q = normaliser(input)
    if (q.length < 2) return []
    return pathologies
      .filter(p => p.statut === 'ACTIVE' && !alreadyIds.has(p.id))
      .filter(p => normaliser(p.libelle).includes(q) || p.code.toLowerCase().includes(input.trim().toLowerCase()))
      .slice(0, 6)
  }, [input, pathologies, alreadyIds])

  function ajouter(pathologieId: string) {
    const type: TypeDiagnostic = hasPrincipal ? 'ASSOCIE' : 'PRINCIPAL'
    addDiag.mutate(
      { pathologieId, type, certitude: 'CONFIRME' },
      { onSuccess: () => { setInput(''); setFocus(false) } },
    )
  }

  /** Résout le texte libre : pathologie existante (par libellé) sinon création à la volée. */
  function ajouterDepuisTexte() {
    const lib = input.trim()
    if (lib.length < 2 || busy) return
    const n = normaliser(lib)
    const exact = pathologies.find(p => p.statut === 'ACTIVE' && normaliser(p.libelle) === n)
    if (exact) {
      if (alreadyIds.has(exact.id)) { setInput(''); return }
      ajouter(exact.id)
      return
    }
    if (!canCreatePatho) return
    createPathologie.mutate(
      { libelle: lib, code: autoCode(lib), chronique: false },
      { onSuccess: (newPath) => ajouter(newPath.id) },
    )
  }

  return (
    <Card padding="none">
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--bordure-legere)',
        background: 'var(--fond-surface-2)',
      }}>
        <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--texte-tertiaire)', margin: 0 }}>
          {t('consultation.diagnosticsTitle')}
        </p>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Zone d'affichage (lecture seule, liste à puces) ───────────── */}
        <div style={{
          minHeight: 64,
          borderRadius: 8,
          border: '1px solid var(--bordure-legere)',
          background: 'var(--fond-surface-2)',
          padding: diagnostics.length === 0 ? '0' : '8px 4px',
          display: 'flex', flexDirection: 'column',
          justifyContent: diagnostics.length === 0 ? 'center' : 'flex-start',
        }}>
          {diagnostics.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', fontStyle: 'italic', textAlign: 'center', margin: 0 }}>
              {t('consultation.diagEmpty')}
            </p>
          ) : (
            diagnostics.map(d => {
              const principal = d.type === 'PRINCIPAL'
              return (
                <div
                  key={d.id}
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: 10,
                    padding: '6px 10px', borderRadius: 6,
                  }}
                  onMouseEnter={e => { const b = e.currentTarget.querySelector('button'); if (b) (b as HTMLElement).style.opacity = '1' }}
                  onMouseLeave={e => { const b = e.currentTarget.querySelector('button'); if (b) (b as HTMLElement).style.opacity = '0' }}
                >
                  {/* Puce colorée selon le type */}
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                    background: principal ? 'var(--ap-500)' : 'transparent',
                    border: principal ? 'none' : '1.5px solid var(--ap-400)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '14px', fontWeight: principal ? 700 : 500, color: 'var(--texte-primaire)', lineHeight: 1.35 }}>
                      {d.pathologie.libelle}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', marginLeft: 8 }}>
                      {TYPE_LABEL[d.type as TypeDiagnostic]}
                      {d.pathologie.chronique && <span style={{ marginLeft: 6, color: 'var(--avert-accent)', fontWeight: 600 }}>{t('consultation.diagChronicSuffix')}</span>}
                    </span>
                  </div>
                  {!readonly && (
                    <button
                      onClick={() => removeDiag.mutate(d.id)}
                      disabled={removeDiag.isPending}
                      title={t('consultation.remove')}
                      style={{
                        width: 22, height: 22, borderRadius: 4, flexShrink: 0, opacity: 0,
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--texte-tertiaire)', transition: 'opacity 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--erreur-fond)'; e.currentTarget.style.color = 'var(--erreur-accent)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--texte-tertiaire)' }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* ── Petit champ de saisie + bouton ➕ (suggestions en popover) ─── */}
        {!readonly && (
          <Popover open={focus && suggestions.length > 0} onOpenChange={o => { if (!o) setFocus(false) }}>
            <PopoverAnchor asChild>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={input}
                  maxLength={150}
                  onChange={e => setInput(e.target.value)}
                  onFocus={() => setFocus(true)}
                  onBlur={() => setTimeout(() => setFocus(false), 120)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ajouterDepuisTexte() } }}
                  placeholder={t('consultation.diagInputPlaceholder')}
                  aria-label={t('consultation.diagInputPlaceholder')}
                  style={{
                    flex: 1, minWidth: 0, height: 36, padding: '0 12px', fontSize: '13px',
                    borderRadius: 8, boxSizing: 'border-box', outline: 'none',
                    border: '1px solid var(--bordure-normale)',
                    background: 'var(--fond-surface)', color: 'var(--texte-primaire)',
                  }}
                />
                <button
                  onClick={ajouterDepuisTexte}
                  disabled={input.trim().length < 2 || busy}
                  title={t('consultation.add')}
                  style={{
                    width: 36, height: 36, flexShrink: 0, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: input.trim().length < 2 ? 'var(--fond-surface-2)' : 'var(--ap-500)',
                    color: input.trim().length < 2 ? 'var(--texte-tertiaire)' : '#fff',
                    border: 'none', cursor: input.trim().length < 2 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />}
                </button>
              </div>
            </PopoverAnchor>

            <PopoverContent
              align="start" sideOffset={6}
              onOpenAutoFocus={e => e.preventDefault()}
              onCloseAutoFocus={e => e.preventDefault()}
              style={{
                width: 'var(--radix-popover-trigger-width)', maxWidth: 'none', padding: 0,
                maxHeight: 240, overflowY: 'auto', borderRadius: 8,
                background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)',
              }}
            >
              {suggestions.map(p => (
                <button
                  key={p.id}
                  onMouseDown={e => { e.preventDefault(); ajouter(p.id) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '8px 12px', textAlign: 'left', cursor: 'pointer',
                    background: 'transparent', border: 'none',
                    borderBottom: '1px solid var(--bordure-legere)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--ap-50)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ flex: 1, fontSize: '13px', color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.libelle}
                  </span>
                  {p.chronique && <span style={{ fontSize: '9px', color: 'var(--avert-accent)', fontWeight: 700, flexShrink: 0 }}>{t('consultation.chronic')}</span>}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </Card>
  )
}
