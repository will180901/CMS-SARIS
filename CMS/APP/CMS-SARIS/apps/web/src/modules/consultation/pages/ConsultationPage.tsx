/**
 * ConsultationPage — Module 7 · Consultation & Actes Prescrits
 * Layout split : file consultations (gauche) | détail (droite)
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { ClipboardList, Search, X, Stethoscope, ChevronLeft, SlidersHorizontal } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@workspace/ui/components/popover'
import { useConsultations }        from '../hooks/useConsultation'
import { consultationApi }         from '../api/consultation.api'
import { ConsultationQueueCard }   from '../components/ConsultationQueueCard'
import { ConsultationDetail }      from '../components/ConsultationDetail'
import { PrivacyCurtain }          from '@/components/PrivacyCurtain'
import { useIsCompact }            from '@/hooks/useMediaQuery'
import { usePersistedState }       from '@/hooks/usePersistedState'

// ── Types filtres ─────────────────────────────────────────────────────────────

type Filter = 'ACTIVES' | 'CLOTUREE' | 'ANNULEE'

// ── Page ──────────────────────────────────────────────────────────────────────

export function ConsultationPage() {
  const { t } = useTranslation()
  const isCompact = useIsCompact()
  const FILTER_LABEL: Record<Filter, string> = {
    ACTIVES:  t('consultation.filterActives'),
    CLOTUREE: t('consultation.filterCloturee'),
    ANNULEE:  t('consultation.filterAnnulee', { defaultValue: 'Annulées' }),
  }
  const location = useLocation()

  // ID reçu depuis le triage via navigate(..., { state })
  const openFromNav = (location.state as { openConsultationId?: string } | null)
    ?.openConsultationId ?? null
  // Vue documents demandée (clic sur un document précis depuis le dossier).
  const openDocView = (location.state as { openDocView?: string } | null)?.openDocView ?? null

  const [filter,     setFilter]   = usePersistedState<Filter>('consultation', 'filter', 'ACTIVES')
  const [selectedId, setSelected] = usePersistedState<string | null>('consultation', 'selectedId', null)
  const [search,     setSearch]   = usePersistedState('consultation', 'search', '')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Arriver depuis un autre écran (triage, ou dossier : documents / chronologie /
  // consultations) via navigate(state.openConsultationId) : ouvrir CETTE consultation
  // en plaçant le filtre sur SON statut réel. Sinon une consultation clôturée ou
  // annulée resterait invisible (filtre « En cours ») et ne s'ouvrirait jamais.
  useEffect(() => {
    if (!openFromNav) return
    let cancelled = false
    consultationApi.findById(openFromNav)
      .then(c => {
        if (cancelled) return
        const f: Filter = c.statut === 'CLOTUREE' ? 'CLOTUREE' : c.statut === 'ANNULEE' ? 'ANNULEE' : 'ACTIVES'
        setFilter(f)
        setSelected(openFromNav)
      })
      .catch(() => { if (!cancelled) { setFilter('ACTIVES'); setSelected(openFromNav) } })
    return () => { cancelled = true }
  }, [openFromNav])

  // ── Resize split rail ─────────────────────────────────────────────────────
  const [queueWidth,  setQueueWidth]  = usePersistedState('consultation', 'queueWidth', 320)
  const splitRef     = useRef<HTMLDivElement>(null)
  const dragging     = useRef(false)
  const startX       = useRef(0)
  const startW       = useRef(0)

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return
      const dx  = e.clientX - startX.current
      const next = Math.max(240, Math.min(480, startW.current + dx))
      setQueueWidth(next)
    }
    function onUp() {
      dragging.current = false
      document.body.style.cursor  = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  function startDrag(e: React.MouseEvent) {
    dragging.current  = true
    startX.current    = e.clientX
    startW.current    = queueWidth
    document.body.style.cursor    = 'col-resize'
    document.body.style.userSelect = 'none'
    e.preventDefault()
  }

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: actives  = [], isLoading: loadActives  } = useConsultations({ statut: 'ACTIVES'   })
  const { data: cloturees = [], isLoading: loadCloturees } = useConsultations({ statut: 'CLOTUREE'  }, { enabled: filter === 'CLOTUREE' || filtersOpen })
  const { data: annulees  = [], isLoading: loadAnnulees  } = useConsultations({ statut: 'ANNULEE'   }, { enabled: filter === 'ANNULEE'  || filtersOpen })

  const allConsultations = filter === 'ACTIVES' ? actives : filter === 'CLOTUREE' ? cloturees : annulees

  // Si la consultation sélectionnée n'appartient pas (plus) à la liste du filtre actif
  // (ex. on bascule sur « En cours » vide alors qu'une clôturée était ouverte), vider la
  // zone de droite. On attend la fin du chargement pour ne pas effacer une sélection en
  // cours de fetch (ouverture depuis le triage).
  const currentLoading = filter === 'ACTIVES' ? loadActives : filter === 'CLOTUREE' ? loadCloturees : loadAnnulees
  useEffect(() => {
    if (currentLoading) return
    if (selectedId && !allConsultations.some(c => c.id === selectedId)) setSelected(null)
  }, [selectedId, allConsultations, currentLoading])

  // ── Recherche client-side ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allConsultations
    return allConsultations.filter(c => {
      const p = c.visite.patient
      const id = p.identite
      return (
        (id?.nom.toLowerCase().includes(q))   ||
        (id?.prenom.toLowerCase().includes(q)) ||
        p.numeroPatient.toLowerCase().includes(q) ||
        c.visite.motifPrincipal.libelle.toLowerCase().includes(q) ||
        (c.soignant?.nom.toLowerCase().includes(q))
      )
    })
  }, [allConsultations, search])

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── File consultations ─────────────────────────────────────────────── */}
      {(!isCompact || !selectedId) && (
      <div style={{
        width:      isCompact ? '100%' : queueWidth,
        minWidth:   isCompact ? 0 : 240,
        maxWidth:   isCompact ? '100%' : 480,
        flexShrink: 0,
        display:    'flex',
        flexDirection: 'column',
        height:     '100%',
        overflow:   'hidden',
        background: 'var(--fond-surface)',
        borderRight: '1px solid var(--bordure-legere)',
      }}>
        {/* Header */}
        <div style={{
          padding:      '14px 16px 10px',
          borderBottom: '1px solid var(--bordure-legere)',
          flexShrink:   0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7,
              background: 'var(--ap-100)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ClipboardList size={16} style={{ color: 'var(--ap-600)' }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--texte-primaire)', lineHeight: 1 }}>
                {t('consultation.title')}
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--texte-tertiaire)' }}>
                {t(actives.length !== 1 ? 'consultation.openCountOther' : 'consultation.openCountOne', { count: actives.length })}
              </p>
            </div>
          </div>

          {/* ── Recherche + Filtres (calque Triage) ─────────────────────── */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Recherche */}
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--texte-tertiaire)', pointerEvents: 'none' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('consultation.searchPlaceholder')}
                style={{
                  width: '100%', height: 32, paddingLeft: 32, paddingRight: search ? 32 : 12,
                  fontSize: '12px', borderRadius: 6,
                  background: 'var(--fond-surface)',
                  border: '1px solid var(--bordure-normale)',
                  color: 'var(--texte-primaire)', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texte-tertiaire)', display: 'flex', padding: 2 }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Bouton Filtres + Popover (statut) */}
            <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
              <PopoverTrigger asChild>
                <button
                  title={t('consultation.filtersTitle', { defaultValue: 'Filtres' })}
                  style={{
                    height: 32, padding: '0 10px', borderRadius: 6, flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                    background: filtersOpen || filter !== 'ACTIVES' ? 'var(--ap-50)' : 'var(--fond-surface)',
                    color:      filtersOpen || filter !== 'ACTIVES' ? 'var(--ap-700)' : 'var(--texte-secondaire)',
                    border:     `1px solid ${filtersOpen || filter !== 'ACTIVES' ? 'var(--ap-200)' : 'var(--bordure-normale)'}`,
                  }}
                >
                  <SlidersHorizontal size={12} />
                  {t('consultation.filtersTitle', { defaultValue: 'Filtres' })}
                  {filter !== 'ACTIVES' && (
                    <span style={{ minWidth: 16, height: 16, borderRadius: 8, background: 'var(--ap-400)', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>1</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={6} style={{ width: 280, padding: 0, background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--bordure-legere)', background: 'var(--fond-surface-2)' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('consultation.filtersTitle', { defaultValue: 'Filtres' })}</span>
                  <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)' }}>{filtered.length}/{allConsultations.length}</span>
                </div>
                <div style={{ padding: '14px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)', margin: '0 0 6px' }}>{t('consultation.statutLabel', { defaultValue: 'Statut' })}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {(['ACTIVES', 'CLOTUREE', 'ANNULEE'] as Filter[]).map(f => {
                      const isActive = filter === f
                      const count = f === 'ACTIVES' ? actives.length : f === 'CLOTUREE' ? cloturees.length : annulees.length
                      return (
                        <button key={f} type="button" onClick={() => setFilter(f)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, height: 32, padding: '0 10px', borderRadius: 6, cursor: 'pointer', fontSize: '12px', fontWeight: isActive ? 600 : 500, background: isActive ? 'var(--ap-50)' : 'var(--fond-surface)', color: isActive ? 'var(--ap-700)' : 'var(--texte-secondaire)', border: `1px solid ${isActive ? 'var(--ap-200)' : 'var(--bordure-normale)'}` }}>
                          <span>{FILTER_LABEL[f]}</span>
                          <span style={{ minWidth: 18, height: 16, borderRadius: 8, padding: '0 5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, background: isActive ? 'var(--ap-400)' : 'var(--fond-surface-2)', color: isActive ? '#fff' : 'var(--texte-tertiaire)' }}>{count}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Liste */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadActives && filter === 'ACTIVES' && (
            <p style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', textAlign: 'center', padding: '20px 0' }}>
              {t('consultation.loading')}
            </p>
          )}

          {!loadActives && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <ClipboardList size={28} style={{ color: 'var(--texte-quaternaire)', marginBottom: 8 }} />
              <p style={{ fontSize: '12px', color: 'var(--texte-tertiaire)', margin: 0 }}>
                {search ? t('consultation.noSearchResult', { search }) : t('consultation.noOpenConsultation')}
              </p>
            </div>
          )}

          {filtered.map(c => (
            <ConsultationQueueCard
              key={c.id}
              consultation={c}
              selected={c.id === selectedId}
              onClick={() => setSelected(c.id)}
            />
          ))}
        </div>
      </div>
      )}

      {/* ── Rail de redimensionnement — bureau uniquement ─────────────────────── */}
      {!isCompact && (
      <div
        ref={splitRef}
        role="separator"
        aria-orientation="vertical"
        aria-label={t('consultation.resizeQueue')}
        aria-valuenow={queueWidth}
        aria-valuemin={240}
        aria-valuemax={480}
        tabIndex={0}
        onMouseDown={startDrag}
        onKeyDown={e => {
          const STEP = 16
          if (e.key === 'ArrowLeft')       { setQueueWidth(w => Math.max(240, w - STEP)); e.preventDefault() }
          else if (e.key === 'ArrowRight') { setQueueWidth(w => Math.min(480, w + STEP)); e.preventDefault() }
          else if (e.key === 'Home')       { setQueueWidth(240); e.preventDefault() }
          else if (e.key === 'End')        { setQueueWidth(480); e.preventDefault() }
        }}
        onFocus={e => { e.currentTarget.style.background = 'var(--ap-100)' }}
        onBlur={e => { e.currentTarget.style.background = 'transparent' }}
        style={{
          width:  6,
          cursor: 'col-resize',
          flexShrink: 0,
          background: 'transparent',
          zIndex: 1,
          position: 'relative',
          outline: 'none',
        }}
      >
        <div style={{
          position: 'absolute', left: 2, top: '50%',
          transform: 'translateY(-50%)',
          width: 2, height: 40, borderRadius: 2,
          background: 'var(--bordure-normale)',
        }} />
      </div>
      )}

      {/* ── Détail consultation ───────────────────────────────────────────────── */}
      {(!isCompact || selectedId) && (
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {selectedId ? (
          <>
            {/* Bouton retour — compact uniquement */}
            {isCompact && (
              <button
                onClick={() => setSelected(null)}
                title={t('common.back')}
                aria-label={t('common.back')}
                style={{
                  alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5,
                  margin: '10px 0 0 12px', padding: '6px 12px 6px 8px', borderRadius: 9999,
                  background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)',
                  cursor: 'pointer', color: 'var(--texte-secondaire)', fontSize: 13, fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                <ChevronLeft size={18} /> {t('common.back')}
              </button>
            )}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <PrivacyCurtain>
                <ConsultationDetail consultationId={selectedId} initialDocView={selectedId === openFromNav ? openDocView : null} />
              </PrivacyCurtain>
            </div>
          </>
        ) : (
          <EmptyState />
        )}
      </div>
      )}
    </div>
  )
}

// ── État vide ─────────────────────────────────────────────────────────────────

function EmptyState() {
  const { t } = useTranslation()
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      color: 'var(--texte-tertiaire)',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: 'var(--fond-surface-2)',
        border: '1px solid var(--bordure-legere)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 14,
      }}>
        <Stethoscope size={24} style={{ color: 'var(--texte-quaternaire)' }} />
      </div>
      <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--texte-secondaire)' }}>
        {t('consultation.noSelectionTitle')}
      </p>
      <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--texte-tertiaire)' }}>
        {t('consultation.noSelectionDescription')}
      </p>
    </div>
  )
}
