import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ClipboardList, Search, X, SlidersHorizontal, ChevronLeft } from 'lucide-react'
import { Button }              from '@workspace/ui/components/button'
import { Input }               from '@workspace/ui/components/input'
import { SelectBox }          from '@/components/saris'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@workspace/ui/components/popover'
import { useSessionStore }     from '@/stores/session.store'
import { usePermissions }      from '@/hooks/usePermissions'
import { useIsCompact }        from '@/hooks/useMediaQuery'
import { usePersistedState }   from '@/hooks/usePersistedState'
import { useVisites }          from '../hooks/useTriage'
import { useMotifs }           from '@/modules/referentiels/hooks/useReferentiels'
import { useSoignants }        from '../hooks/useSoignants'
import { QueueCard }           from '../components/QueueCard'
import { VisiteDetail }        from '../components/VisiteDetail'
import { PrivacyCurtain }      from '@/components/PrivacyCurtain'
import { NouvelleVisitePanel } from '../components/NouvelleVisiteDrawer'
import { formatDate, formatTime } from '@/lib/intl'

// ── Horloge live ──────────────────────────────────────────────────────────────
// Composant feuille : seul ce <span> se re-render chaque seconde, pas toute la page.

function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span style={{ fontFamily: 'monospace', marginRight: 8 }}>
      {formatTime(now, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  )
}

// ── Types filtre ──────────────────────────────────────────────────────────────

type Filter = 'ACTIVES' | 'EN_ATTENTE' | 'EN_COURS' | 'CLOTUREE' | 'ANNULEE'

// ── Page ──────────────────────────────────────────────────────────────────────

export function TriagePage() {
  const { t } = useTranslation()
  const FILTER_LABEL: Record<Filter, string> = {
    ACTIVES:    t('triage.filterActives'),
    EN_ATTENTE: t('triage.filterEnAttente'),
    EN_COURS:   t('triage.filterEnCours'),
    CLOTUREE:   t('triage.filterCloturees'),
    ANNULEE:    t('triage.filterAnnulees'),
  }
  const siteId = useSessionStore(s => s.user?.siteId ?? '')
  const { has } = usePermissions()
  const canCreateVisite = has('visite.create')

  const [filter,     setFilter]   = usePersistedState<Filter>('triage', 'filter', 'ACTIVES')
  const [selectedId, setSelected] = usePersistedState<string | null>('triage', 'selectedId', null)
  const [creating, setCreating]   = useState(false)

  /* ── Recherche + filtres globaux (mémorisés au retour sur la page) ─────── */
  const [search,        setSearch]        = usePersistedState('triage', 'search', '')
  const [soignantFilter, setSoignantFilter] = usePersistedState<string | null>('triage', 'soignantFilter', null)
  const [motifFilter,   setMotifFilter]   = usePersistedState<string | null>('triage', 'motifFilter', null)
  const [sortOrder,     setSortOrder]     = usePersistedState<'asc' | 'desc'>('triage', 'sortOrder', 'asc')   // file par heure d'arrivée
  const [filtersOpen,   setFiltersOpen]   = useState(false)

  const { data: motifs = [] }    = useMotifs()
  const { data: personnel = [] } = useSoignants()

  const motifsActifs    = useMemo(() => motifs.filter(m => m.statut === 'ACTIF'), [motifs])
  const personnelActif  = useMemo(() => personnel.filter(p => p.statut === 'ACTIF'), [personnel])

  function resetFilters() {
    setSearch(''); setSoignantFilter(null); setMotifFilter(null); setSortOrder('asc'); setFilter('ACTIVES')
  }

  // Compteur du bouton « Filtres » = filtres AVANCÉS uniquement. Le statut et la
  // recherche ont désormais leurs propres contrôles toujours visibles.
  const activeFiltersCount =
    (soignantFilter ? 1 : 0) +
    (motifFilter ? 1 : 0) +
    (sortOrder !== 'asc' ? 1 : 0)

  /* Redimensionnement panneau file */
  const splitRef                 = useRef<HTMLDivElement>(null)
  const [queueWidth, setQueueWidth] = usePersistedState('triage', 'queueWidth', 380)
  const [isResizing, setIsResizing] = useState(false)
  const isCompact = useIsCompact()

  useEffect(() => {
    if (!isResizing) return
    function onMove(e: MouseEvent) {
      if (!splitRef.current) return
      const rect = splitRef.current.getBoundingClientRect()
      const w = e.clientX - rect.left
      setQueueWidth(Math.max(280, Math.min(620, w)))
    }
    function onUp() { setIsResizing(false) }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
    document.body.style.cursor     = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
      document.body.style.cursor     = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  const { data: visites = [], isLoading } = useVisites({
    siteId: siteId || undefined,
    statut: filter,
  })

  /* Compteurs live — toujours chargés en parallèle, indépendamment du filtre courant */
  const { data: allActives = [] } = useVisites({
    siteId: siteId || undefined,
    statut: 'ACTIVES',
  })
  const { data: allCloturees = [] } = useVisites({
    siteId: siteId || undefined,
    statut: 'CLOTUREE',
  })
  const { data: allAnnulees = [] } = useVisites({
    siteId: siteId || undefined,
    statut: 'ANNULEE',
  })

  const stats = useMemo(() => ({
    actives:   allActives.length,
    attente:   allActives.filter(v => v.statut === 'EN_ATTENTE').length,
    enCours:   allActives.filter(v => v.statut === 'EN_COURS').length,
    cloturees: allCloturees.length,
    annulees:  allAnnulees.length,
  }), [allActives, allCloturees, allAnnulees])

  /* Liste visible = visites de l'onglet courant, croisées avec recherche + filtres */
  const filteredVisites = useMemo(() => {
    let list = visites

    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(v => {
        const id = v.patient?.identite
        const nom    = id ? `${id.prenom} ${id.nom}`.toLowerCase() : ''
        const num    = (v.patient?.numeroPatient ?? '').toLowerCase()
        const motif  = (v.motifPrincipal?.libelle ?? '').toLowerCase()
        return nom.includes(q) || num.includes(q) || motif.includes(q)
      })
    }
    if (soignantFilter) {
      list = list.filter(v => v.soignantId === soignantFilter)
    }
    if (motifFilter) {
      list = list.filter(v => v.motifPrincipalId === motifFilter)
    }

    // Tri par heure d'arrivée — les visites en cours restent épinglées en tête.
    return [...list].sort((a, b) => {
      if (a.statut === 'EN_COURS' && b.statut !== 'EN_COURS') return -1
      if (b.statut === 'EN_COURS' && a.statut !== 'EN_COURS') return  1
      const ta = new Date(a.dateOuverture).getTime()
      const tb = new Date(b.dateOuverture).getTime()
      return sortOrder === 'asc' ? ta - tb : tb - ta
    })
  }, [visites, search, soignantFilter, motifFilter, sortOrder])

  /* Auto-sélection de la première EN_COURS sinon première de la liste (parmi celles visibles) */
  useEffect(() => {
    // Sur mobile, on affiche d'abord la FILE (un seul panneau) : pas d'auto-sélection.
    // En cours de création inline (creating), on NE sélectionne PAS en arrière-plan,
    // sinon fermer la création révélerait une visite que l'utilisateur n'a pas choisie.
    if (!selectedId && !creating && !isCompact && filteredVisites.length > 0) {
      const enCours = filteredVisites.find(v => v.statut === 'EN_COURS')
      setSelected(enCours?.id ?? filteredVisites[0]?.id ?? null)
    }
  }, [filteredVisites, creating, selectedId, isCompact])

  /* Désélection automatique si l'item disparaît de la liste visible */
  useEffect(() => {
    if (selectedId && !filteredVisites.some(v => v.id === selectedId)) {
      setSelected(null)
    }
  }, [filteredVisites, selectedId])

  return (
    <>
      <style>{`
        .tri-resize:hover           { background: var(--ap-50) !important; }
        .tri-resize:hover > div     { background: var(--ap-400) !important; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

        {/* ── En-tête (calque PatientsPage) ─────────────────────────────── */}
        <div style={{ padding: 'var(--espace-4) var(--espace-6) 0', flexShrink: 0, borderBottom: '1px solid var(--bordure-legere)', background: 'var(--fond-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>

            {/* Titre + icône */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'var(--ap-50)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 2,
              }}>
                <ClipboardList size={16} style={{ color: 'var(--ap-600)' }} />
              </div>
              <div>
                <h1 style={{ fontSize: 'var(--font-size-h2)', fontWeight: '600', color: 'var(--texte-primaire)', margin: 0 }}>
                  {t('triage.pageTitle')}
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--texte-tertiaire)', margin: '2px 0 0' }}>
                  <LiveClock />
                  {isLoading ? '…' : t('triage.visitesAffichees', { count: visites.length })}
                </p>
              </div>
            </div>

            {/* Actions (mise à jour temps réel — pas de bouton actualiser) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {canCreateVisite && (
                <Button
                  size="sm"
                  onClick={() => { setSelected(null); setCreating(true) }}
                  style={{ background: 'var(--ap-400)', color: '#fff', fontSize: '13px', height: '34px', gap: '6px' }}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  {t('triage.nouvelleVisite')}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Corps split panel ─────────────────────────────────────────── */}
        <div ref={splitRef} style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

          {/* Panneau file — colonne fixe (bureau) / pleine largeur, cachee si un detail OU une création est ouvert (compact) */}
          {(!isCompact || (!selectedId && !creating)) && (
          <div style={{
            width:         isCompact ? '100%' : `${queueWidth}px`,
            flexShrink:    0,
            display:       'flex',
            flexDirection: 'column',
            minHeight:     0,
            background:    'var(--fond-surface)',
          }}>

            {/* ── Barre recherche + filtres (sticky top) ─────────────────── */}
            <div style={{
              padding:      '10px 12px',
              borderBottom: '1px solid var(--bordure-legere)',
              display:      'flex',
              flexDirection:'column',
              gap:          8,
              flexShrink:   0,
              background:   'var(--fond-surface)',
            }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {/* Recherche */}
                <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  <Search size={13} style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--texte-tertiaire)', pointerEvents: 'none',
                  }} />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t('triage.searchPlaceholder')}
                    style={{
                      paddingLeft: 32, paddingRight: search ? 32 : 12,
                      height: 32, fontSize: '12px',
                      background: 'var(--fond-surface)',
                      border: '1px solid var(--bordure-normale)',
                      borderRadius: 6,
                    }}
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--texte-tertiaire)', display: 'flex', padding: 2,
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Bouton Filtres + Popover */}
                <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <PopoverTrigger asChild>
                    <button
                      title={t('triage.filtresAvances')}
                      style={{
                        height: 32, padding: '0 10px', borderRadius: 6,
                        display: 'flex', alignItems: 'center', gap: 5,
                        fontSize: '12px', fontWeight: '500', cursor: 'pointer',
                        background: filtersOpen || activeFiltersCount > 0 ? 'var(--ap-50)' : 'var(--fond-surface)',
                        color:      filtersOpen || activeFiltersCount > 0 ? 'var(--ap-700)' : 'var(--texte-secondaire)',
                        border:     `1px solid ${filtersOpen || activeFiltersCount > 0 ? 'var(--ap-200)' : 'var(--bordure-normale)'}`,
                        transition: 'all 0.1s',
                        flexShrink: 0,
                      }}
                    >
                      <SlidersHorizontal size={12} />
                      {t('triage.filtresTitle')}
                      {activeFiltersCount > 0 && (
                        <span style={{
                          minWidth: 16, height: 16, borderRadius: 8,
                          background: 'var(--ap-400)', color: '#fff',
                          fontSize: '10px', fontWeight: '700',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          padding: '0 4px',
                        }}>
                          {activeFiltersCount}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    sideOffset={6}
                    style={{
                      width: 320,
                      padding: 0,
                      background: 'var(--fond-surface)',
                      border: '1px solid var(--bordure-legere)',
                      borderRadius: 10,
                      boxShadow: 'var(--ombre-4)',
                    }}
                  >
                    {/* En-tête popover */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--bordure-legere)',
                      background: 'var(--fond-surface-2)',
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--texte-primaire)' }}>
                        {t('triage.filtresAvances')}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)' }}>
                        {t('triage.countSurTotal', { shown: filteredVisites.length, total: visites.length })}
                      </span>
                    </div>

                    <div style={{
                      display: 'flex', flexDirection: 'column', gap: 14,
                      padding: '14px',
                    }}>
                      {/* Soignant */}
                      <div>
                        <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)', margin: '0 0 6px' }}>
                          {t('triage.soignantAssigneLabel')}
                        </p>
                        <SelectBox
                          size="md"
                          value={soignantFilter ?? '__all__'}
                          onChange={v => setSoignantFilter(v === '__all__' ? null : v)}
                          aria-label={t('triage.soignantAssigneLabel')}
                          options={[
                            { value: '__all__', label: t('triage.tous') },
                            ...personnelActif.map(p => ({ value: p.id, label: `${p.prenom} ${p.nom}` })),
                          ]}
                        />
                      </div>

                      {/* Motif */}
                      <div>
                        <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)', margin: '0 0 6px' }}>
                          {t('triage.motifPrincipalLabel')}
                        </p>
                        <SelectBox
                          size="md"
                          value={motifFilter ?? '__all__'}
                          onChange={v => setMotifFilter(v === '__all__' ? null : v)}
                          aria-label={t('triage.motifPrincipalLabel')}
                          options={[
                            { value: '__all__', label: t('triage.tous') },
                            ...motifsActifs.map(m => ({ value: m.id, label: m.libelle })),
                          ]}
                        />
                      </div>

                      {/* Tri par heure d'arrivée */}
                      <div>
                        <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)', margin: '0 0 6px' }}>
                          {t('triage.heureArrivee')}
                        </p>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {([
                            { val: 'asc',  label: t('triage.plusAnciennes') },
                            { val: 'desc', label: t('triage.plusRecentes') },
                          ] as const).map(opt => {
                            const active = sortOrder === opt.val
                            return (
                              <button
                                key={opt.val}
                                type="button"
                                onClick={() => setSortOrder(opt.val)}
                                style={{
                                  flex: 1, height: 32, borderRadius: 6, cursor: 'pointer',
                                  fontSize: '12px', fontWeight: active ? '600' : '500',
                                  background: active ? 'var(--ap-50)' : 'var(--fond-surface)',
                                  color:      active ? 'var(--ap-700)' : 'var(--texte-secondaire)',
                                  border:     `1px solid ${active ? 'var(--ap-200)' : 'var(--bordure-normale)'}`,
                                  transition: 'all 0.1s',
                                }}
                              >
                                {opt.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Footer du popover */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderTop: '1px solid var(--bordure-legere)',
                      background: 'var(--fond-surface-2)',
                    }}>
                      <button
                        onClick={resetFilters}
                        disabled={activeFiltersCount === 0}
                        style={{
                          fontSize: '11px', fontWeight: '500', cursor: activeFiltersCount === 0 ? 'not-allowed' : 'pointer',
                          background: 'none', border: 'none',
                          color: activeFiltersCount === 0 ? 'var(--texte-tertiaire)' : 'var(--ap-600)',
                          padding: 0,
                          opacity: activeFiltersCount === 0 ? 0.5 : 1,
                          textDecoration: activeFiltersCount > 0 ? 'underline' : 'none',
                        }}
                      >
                        {t('triage.toutReinitialiser')}
                      </button>
                      <button
                        onClick={() => setFiltersOpen(false)}
                        style={{
                          fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                          background: 'var(--ap-400)', color: '#fff',
                          border: 'none', borderRadius: 6,
                          padding: '5px 12px',
                        }}
                      >
                        {t('common.close')}
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Statut — toujours visible (la bascule la plus fréquente du triage) */}
              <div
                role="tablist"
                aria-label={t('triage.statutLabel')}
                style={{ display: 'flex', gap: 6, overflowX: 'auto' }}
              >
                {([
                  { key: 'ACTIVES',  count: stats.actives   },
                  { key: 'CLOTUREE', count: stats.cloturees },
                  { key: 'ANNULEE',  count: stats.annulees  },
                ] as { key: Filter; count: number }[]).map(s => {
                  const active = filter === s.key
                  return (
                    <button
                      key={s.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(s.key)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                        height: 28, padding: '0 10px', borderRadius: 9999, cursor: 'pointer',
                        fontSize: '12px', fontWeight: active ? '600' : '500', whiteSpace: 'nowrap',
                        background: active ? 'var(--ap-50)' : 'var(--fond-surface)',
                        color:      active ? 'var(--ap-700)' : 'var(--texte-secondaire)',
                        border:     `1px solid ${active ? 'var(--ap-200)' : 'var(--bordure-normale)'}`,
                        transition: 'all 0.1s',
                      }}
                    >
                      {FILTER_LABEL[s.key]}
                      <span style={{
                        minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: '700',
                        background: active ? 'var(--ap-400)' : 'var(--fond-surface-2)',
                        color:      active ? '#fff' : 'var(--texte-tertiaire)',
                      }}>
                        {s.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Liste scrollable ───────────────────────────────────────── */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: 8 }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderRadius: 8, opacity: 1 - i * 0.1 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--fond-surface-2)', flexShrink: 0 }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ height: 12, borderRadius: 4, background: 'var(--fond-surface-2)', width: '55%' }} />
                        <div style={{ height: 10, borderRadius: 4, background: 'var(--fond-surface-2)', width: '30%' }} />
                      </div>
                      <div style={{ width: 48, height: 18, borderRadius: 99, background: 'var(--fond-surface-2)' }} />
                    </div>
                  ))}
                </div>
              ) : filteredVisites.length === 0 ? (
                <div style={{ padding: '60px 32px', textAlign: 'center' }}>
                  {activeFiltersCount > 0 ? (
                    <>
                      <Search size={28} style={{ margin: '0 auto 12px', color: 'var(--texte-tertiaire)', opacity: 0.3, display: 'block' }} />
                      <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--texte-secondaire)', margin: '0 0 12px' }}>
                        {t('triage.aucunResultat')}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', margin: '0 0 12px' }}>
                        {t('triage.surVisitesOnglet', { count: visites.length })}
                      </p>
                      <button
                        onClick={resetFilters}
                        style={{
                          padding: '6px 14px', borderRadius: 6, fontSize: '12px', cursor: 'pointer',
                          background: 'var(--ap-50)', border: '1px solid var(--ap-200)',
                          color: 'var(--ap-700)', fontWeight: '500',
                        }}
                      >
                        {t('triage.reinitialiserFiltres')}
                      </button>
                    </>
                  ) : (
                    <>
                      <ClipboardList size={32} style={{ margin: '0 auto 12px', color: 'var(--texte-tertiaire)', opacity: 0.3, display: 'block' }} />
                      <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--texte-secondaire)', margin: '0 0 12px' }}>
                        {t('triage.aucuneVisite', { filter: FILTER_LABEL[filter].toLowerCase() })}
                      </p>
                      {filter !== 'ACTIVES' ? (
                        <button
                          onClick={() => setFilter('ACTIVES')}
                          style={{
                            padding: '6px 14px', borderRadius: 6, fontSize: '12px', cursor: 'pointer',
                            background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-normale)',
                            color: 'var(--texte-secondaire)',
                          }}
                        >
                          {t('triage.voirToutes')}
                        </button>
                      ) : canCreateVisite ? (
                        <Button
                          size="sm"
                          onClick={() => { setSelected(null); setCreating(true) }}
                          style={{ background: 'var(--ap-400)', color: '#fff', fontSize: '12px', height: 30, gap: 5 }}
                        >
                          <Plus size={12} /> {t('triage.premiereVisite')}
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
              ) : (
                filteredVisites.map(v => (
                  <QueueCard
                    key={v.id}
                    visite={v}
                    selected={v.id === selectedId}
                    onClick={() => { setSelected(v.id); setCreating(false) }}
                  />
                ))
              )}
            </div>
          </div>
          )}

          {/* Poignée redimensionnement — bureau uniquement */}
          {!isCompact && (
          <div
            onMouseDown={() => setIsResizing(true)}
            onDoubleClick={() => setQueueWidth(380)}
            title={t('triage.resizeHint')}
            className="tri-resize"
            style={{
              width: 5,
              flexShrink: 0,
              cursor: 'col-resize',
              position: 'relative',
              background: isResizing ? 'var(--ap-50)' : 'transparent',
              transition: 'background 0.15s',
            }}
          >
            <div style={{
              position: 'absolute',
              left: 2, top: 0, bottom: 0,
              width: 1,
              background: isResizing ? 'var(--ap-400)' : 'var(--bordure-legere)',
              transition: 'background 0.15s',
            }} />
          </div>
          )}

          {/* Panneau détail / nouvelle visite / état vide */}
          {(!isCompact || selectedId || creating) && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--fond-page)' }}>
            {isCompact && (selectedId || creating) && (
              <button onClick={() => { setSelected(null); setCreating(false) }}
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', borderBottom: '1px solid var(--bordure-legere)', background: 'var(--fond-surface)', border: 'none', cursor: 'pointer', color: 'var(--texte-secondaire)', fontSize: 13, fontWeight: 600, textAlign: 'left' }}>
                <ChevronLeft size={18} /> {t('triage.backToQueue')}
              </button>
            )}
            {creating ? (
              <NouvelleVisitePanel
                onClose={() => setCreating(false)}
                onCreated={(id) => { setCreating(false); setSelected(id) }}
              />
            ) : selectedId ? (
              <PrivacyCurtain>
                <VisiteDetail key={selectedId} visiteId={selectedId} onSent={() => setSelected(null)} />
              </PrivacyCurtain>
            ) : (
              <EmptyPanel canCreate={canCreateVisite} onNew={() => { setSelected(null); setCreating(true) }} />
            )}
          </div>
          )}
        </div>

      </div>
    </>
  )
}

// ── Panneau vide (dashboard du jour) ──────────────────────────────────────────

function EmptyPanel({
  canCreate,
  onNew,
}: {
  canCreate: boolean
  onNew: () => void
}) {
  const { t } = useTranslation()
  const today = formatDate(new Date(), {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 24, padding: 32, overflowY: 'auto',
    }}>
      <p style={{
        fontSize: '11px', fontWeight: '600', letterSpacing: '0.04em',
        color: 'var(--texte-tertiaire)', margin: 0, textAlign: 'center',
        textTransform: 'capitalize',
      }}>
        {today}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 10,
          background: 'var(--ap-50)', border: '1px solid var(--bordure-legere)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ClipboardList size={24} style={{ color: 'var(--ap-600)' }} />
        </div>
        <p style={{ fontSize: '13px', color: 'var(--texte-secondaire)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
          {canCreate
            ? t('triage.emptySelectOrNew')
            : t('triage.emptySelect')}
        </p>
        {canCreate && (
          <Button
            size="sm"
            onClick={onNew}
            style={{ background: 'var(--ap-400)', color: '#fff', fontSize: '13px', height: 34, gap: 6 }}
          >
            <Plus size={14} strokeWidth={2.5} />
            {t('triage.nouvelleVisite')}
          </Button>
        )}
      </div>
    </div>
  )
}
