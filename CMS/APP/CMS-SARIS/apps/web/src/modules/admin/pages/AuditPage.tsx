/**
 * AuditPage — consultation des journaux d'audit et d'authentification.
 *
 * Deux onglets :
 *   1. Actions métier (JournalAudit) — création/modification/suppression sur les entités
 *   2. Authentifications (JournalAuthentification) — login / logout / TOTP
 *
 * Filtres : période, utilisateur, module/résultat, recherche libre.
 * Tous les codes techniques (action, module, statut, entité) sont traduits en
 * français lisible via `@/config/labels`.
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover'
import {
  History, Activity, KeyRound, ChevronRight, ChevronDown,
  CheckCircle2, XCircle, AlertTriangle, X, FileText, GitCompare, Code2,
  ArrowRight, Plus, Minus, User, Clock, Globe, Layers, MapPin,
} from 'lucide-react'
import { parseUserAgent } from '@/lib/userAgent'
import { formatCoords } from '@/lib/geo'
import { formatDateTime } from '@/lib/intl'
import { useIsCompact } from '@/hooks/useMediaQuery'
import {
  PageHeader, Card, Button, IconButton, StatusPill,
  Avatar, EmptyState, Skeleton, Toolbar, SelectBox, DatePicker, PaginationBar, SegmentedTabs,
  useColumnResize,
} from '@/components/saris'
import type { ColumnResize } from '@/components/saris'
import { usePagination } from '@/hooks/usePagination'
import { useRowsPerPage } from '@/hooks/useRowsPerPage'
import {
  useAuditActions, useAuditAuth, useUtilisateurs, usePermissions as useAdminPermissions,
} from '../hooks/useAdmin'
import type { AuditEntry, AuthLogEntry } from '../api/admin.api'
import { labelModule, labelAction, labelStatut, labelEntite, labelRole, labelPermission } from '@/config/labels'
import { buildPermissionTree, parsePermCode, labelPermAction } from '@/config/permission-tree'

// Résultats d'authentification possibles (liste stable, indépendante des données
// chargées — pour que le filtre reste complet après sélection).
const AUTH_RESULTATS = [
  'SUCCES_LOGIN', 'SUCCES_LOGIN_TOTP', 'SUCCES_LOGIN_TOTP_REQUIS', 'SUCCES_LOGOUT', 'SUCCES_CHANGEMENT_MDP',
  'ECHEC_MOT_DE_PASSE', 'ECHEC_LOGIN_INCONNU', 'ECHEC_COMPTE_DESACTIVE', 'ECHEC_COMPTE_BLOQUE', 'ECHEC_CODE_TOTP',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Date + heure avec secondes, suivant la langue active (cf. `@/lib/intl`). */
function formatAuditDateTime(iso: string): string {
  return formatDateTime(iso, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'actions' | 'auth'

export function AuditPage() {
  const { t } = useTranslation()
  const [tab,           setTab]           = useState<Tab>('actions')
  const [search,        setSearch]        = useState('')
  const [filtreUserId,  setFiltreUserId]  = useState('')
  const [filtreModule,  setFiltreModule]  = useState('')
  const [filtreResultat, setFiltreResultat] = useState('')
  const [dateMin,       setDateMin]       = useState('')
  const [heureMin,      setHeureMin]      = useState('')   // HH:mm, optionnel (requiert dateMin)
  const [dateMax,       setDateMax]       = useState('')
  const [heureMax,      setHeureMax]      = useState('')   // HH:mm, optionnel (requiert dateMax)
  const [openEntry,     setOpenEntry]     = useState<AuditEntry | null>(null)

  const { data: users = [] } = useUtilisateurs()
  const { data: permsCatalog = [] } = useAdminPermissions()

  // Combinaison date + heure → borne datetime envoyée au backend.
  //   - Min : début de l'heure choisie (sinon le serveur prend le début de journée).
  //   - Max : fin de la minute choisie (sinon le serveur prend la fin de journée).
  const dateMinParam = dateMin ? (heureMin ? `${dateMin}T${heureMin}:00`     : dateMin) : ''
  const dateMaxParam = dateMax ? (heureMax ? `${dateMax}T${heureMax}:59.999` : dateMax) : ''

  // Query audit actions — `total` = nombre réel d'entrées (≠ taille du lot
  // renvoyé, plafonné à `limit`) → compteur d'onglet juste et évolutif.
  const { data: actionsRes, isLoading: la } = useAuditActions({
    utilisateurId: filtreUserId || undefined,
    module:        filtreModule || undefined,
    dateMin:       dateMinParam || undefined,
    dateMax:       dateMaxParam || undefined,
    limit:         '200',
  })
  const actions      = actionsRes?.data  ?? []
  const actionsTotal = actionsRes?.total ?? 0

  // Query auth
  const { data: authRes, isLoading: lh } = useAuditAuth({
    utilisateurId: filtreUserId   || undefined,
    resultat:      filtreResultat || undefined,
    dateMin:       dateMinParam   || undefined,
    dateMax:       dateMaxParam   || undefined,
    limit:         '200',
  })
  const auth      = authRes?.data  ?? []
  const authTotal = authRes?.total ?? 0

  // Filtrage local par recherche libre
  const actionsFiltered = useMemo(() => {
    if (!search.trim()) return actions
    const q = search.toLowerCase()
    return actions.filter(e =>
      e.action.toLowerCase().includes(q) ||
      e.module.toLowerCase().includes(q) ||
      (e.entiteType ?? '').toLowerCase().includes(q) ||
      (e.entiteId ?? '').toLowerCase().includes(q) ||
      (e.utilisateur?.login ?? '').toLowerCase().includes(q),
    )
  }, [actions, search])

  const authFiltered = useMemo(() => {
    if (!search.trim()) return auth
    const q = search.toLowerCase()
    return auth.filter(e =>
      e.resultat.toLowerCase().includes(q) ||
      (e.login ?? '').toLowerCase().includes(q) ||
      (e.ipAdresse ?? '').toLowerCase().includes(q),
    )
  }, [auth, search])

  // Modules pour le select : dérivés du CATALOGUE de permissions (liste stable),
  // pas des résultats filtrés — sinon la liste rétrécit après sélection.
  const distinctModules = useMemo(
    () => [...new Set(permsCatalog.map(p => p.module))].sort((a, b) => labelModule(a).localeCompare(labelModule(b))),
    [permsCatalog],
  )
  const distinctResultats = AUTH_RESULTATS

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

        <PageHeader
          icon={<History size={18} />}
          title={t('admin.auditTitle')}
          subtitle={t('admin.auditSubtitle')}
        />

        {/* Tabs (pills SARIS) */}
        <div style={{ padding: 'var(--espace-4) var(--espace-6) 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <SegmentedTabs
            value={tab}
            onChange={k => setTab(k as Tab)}
            tabs={[
              { key: 'actions', label: t('admin.businessActions'),    icon: <Activity size={14} />, badge: actionsTotal },
              { key: 'auth',    label: t('admin.authentications'), icon: <KeyRound size={14} />, badge: authTotal },
            ]}
          />
        </div>

        {/* Toolbar filtres */}
        <div style={{ padding: 'var(--espace-3) var(--espace-6) 0' }}>
          <Card>
            <Toolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={tab === 'actions' ? t('admin.searchActionsPlaceholder') : t('admin.searchAuthPlaceholder')}
              filters={
                <>
                  <div style={{ minWidth: 180 }}>
                    <SelectBox
                      size="sm"
                      value={filtreUserId}
                      onChange={setFiltreUserId}
                      placeholder={t('admin.allUsers')}
                      aria-label={t('admin.filterByUser')}
                      options={[
                        { value: '', label: t('admin.allUsers') },
                        ...users.map(u => ({
                          value: u.id,
                          label: u.personnelMedical ? `${u.personnelMedical.prenom} ${u.personnelMedical.nom}` : u.login,
                          sublabel: u.login,
                        })),
                      ]}
                    />
                  </div>
                  {tab === 'actions' && (
                    <div style={{ minWidth: 160 }}>
                      <SelectBox
                        size="sm"
                        value={filtreModule}
                        onChange={setFiltreModule}
                        placeholder={t('admin.allModules')}
                        aria-label={t('admin.filterByModule')}
                        options={[
                          { value: '', label: t('admin.allModules') },
                          ...distinctModules.map(m => ({ value: m, label: labelModule(m) })),
                        ]}
                      />
                    </div>
                  )}
                  {tab === 'auth' && (
                    <div style={{ minWidth: 200 }}>
                      <SelectBox
                        size="sm"
                        value={filtreResultat}
                        onChange={setFiltreResultat}
                        placeholder={t('admin.allResults')}
                        aria-label={t('admin.filterByResult')}
                        options={[
                          { value: '', label: t('admin.allResults') },
                          ...distinctResultats.map(r => ({ value: r, label: labelStatut('auth_result', r) })),
                        ]}
                      />
                    </div>
                  )}
                  <PeriodeFilter
                    dateMin={dateMin} setDateMin={setDateMin} heureMin={heureMin} setHeureMin={setHeureMin}
                    dateMax={dateMax} setDateMax={setDateMax} heureMax={heureMax} setHeureMax={setHeureMax}
                  />
                </>
              }
            />
          </Card>
        </div>

        {/* Tableau */}
        {tab === 'actions' ? (
          <ActionsTable
            entries={actionsFiltered}
            loading={la}
            onOpen={setOpenEntry}
          />
        ) : (
          <AuthTable entries={authFiltered} loading={lh} />
        )}
      </div>

      {openEntry && (
        <AuditDetailDrawer entry={openEntry} onClose={() => setOpenEntry(null)} />
      )}
    </>
  )
}

// ── Filtre de période « Du … / Au … » (date + heure) ─────────────────────────

function PeriodeFilter({
  dateMin, setDateMin, heureMin, setHeureMin,
  dateMax, setDateMax, heureMax, setHeureMax,
}: {
  dateMin: string;  setDateMin: (v: string) => void
  heureMin: string; setHeureMin: (v: string) => void
  dateMax: string;  setDateMax: (v: string) => void
  heureMax: string; setHeureMax: (v: string) => void
}) {
  const { t } = useTranslation()
  const hasAny = !!(dateMin || dateMax || heureMin || heureMax)
  // Même jour → l'heure max doit rester ≥ l'heure min.
  const sameDay = !!dateMin && dateMin === dateMax
  function clearAll() { setDateMin(''); setHeureMin(''); setDateMax(''); setHeureMax('') }

  // Recadrage si un changement de date rend la plage d'heures incohérente
  useEffect(() => {
    if (sameDay && heureMin && heureMax && heureMax < heureMin) setHeureMax(heureMin)
  }, [sameDay, heureMin, heureMax, setHeureMax])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      padding: '3px 6px 3px 10px',
      border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-md)',
      background: 'var(--fond-surface-2)',
    }}>
      <PeriodeLabel>{t('admin.from')}</PeriodeLabel>
      <div style={{ width: 144 }}>
        <DatePicker
          size="sm"
          value={dateMin}
          onChange={v => { setDateMin(v ?? ''); if (!v) setHeureMin('') }}
          placeholder={t('admin.date')}
          aria-label={t('admin.dateMin')}
          max={dateMax || undefined}
          captionLayout="label"
          clearable
        />
      </div>
      <div style={{ width: 86 }}>
        <TimePicker
          value={heureMin} onChange={setHeureMin} ariaLabel={t('admin.timeMin')} disabled={!dateMin}
          max={sameDay && heureMax ? heureMax : undefined}
        />
      </div>

      <PeriodeLabel>{t('admin.to')}</PeriodeLabel>
      <div style={{ width: 144 }}>
        <DatePicker
          size="sm"
          value={dateMax}
          onChange={v => { setDateMax(v ?? ''); if (!v) setHeureMax('') }}
          placeholder={t('admin.date')}
          aria-label={t('admin.dateMax')}
          min={dateMin || undefined}
          captionLayout="label"
          clearable
        />
      </div>
      <div style={{ width: 86 }}>
        <TimePicker
          value={heureMax} onChange={setHeureMax} ariaLabel={t('admin.timeMax')} disabled={!dateMax}
          min={sameDay && heureMin ? heureMin : undefined}
        />
      </div>

      <button
        type="button"
        onClick={clearAll}
        disabled={!hasAny}
        aria-label={t('admin.clearPeriod')}
        title={t('admin.clearPeriod')}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: 'var(--radius-sm)', flexShrink: 0,
          border: 'none', background: 'transparent',
          color: hasAny ? 'var(--texte-tertiaire)' : 'var(--bordure-normale)',
          cursor: hasAny ? 'pointer' : 'default', transition: 'background 0.12s, color 0.12s',
        }}
        onMouseEnter={e => { if (hasAny) { e.currentTarget.style.background = 'var(--fond-surface)'; e.currentTarget.style.color = 'var(--erreur-accent)' } }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = hasAny ? 'var(--texte-tertiaire)' : 'var(--bordure-normale)' }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

function PeriodeLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 'var(--font-size-overline)', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.06em', color: 'var(--texte-tertiaire)', padding: '0 1px', userSelect: 'none',
    }}>
      {children}
    </span>
  )
}

// ── Sélecteur d'heure SARIS (popover heures/minutes, zéro natif) ──────────────

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

function TimePicker({ value, onChange, ariaLabel, disabled, min, max }: {
  value: string
  onChange: (v: string) => void
  ariaLabel: string
  disabled?: boolean
  /** Bornes HH:mm : désactivent les heures/minutes hors plage (cohérence même jour) */
  min?: string
  max?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const h = value ? value.split(':')[0] ?? '' : ''
  const m = value ? value.split(':')[1] ?? '' : ''

  const minH = min ? Number(min.split(':')[0]) : null
  const minM = min ? Number(min.split(':')[1]) : null
  const maxH = max ? Number(max.split(':')[0]) : null
  const maxM = max ? Number(max.split(':')[1]) : null

  const hourDisabled = (hh: string) => {
    const n = Number(hh)
    if (minH !== null && n < minH) return true
    if (maxH !== null && n > maxH) return true
    return false
  }
  const minuteDisabled = (mm: string) => {
    const n = Number(mm)
    const curH = h ? Number(h) : null
    if (minH !== null && minM !== null && curH === minH && n < minM) return true
    if (maxH !== null && maxM !== null && curH === maxH && n > maxM) return true
    return false
  }

  function pickHour(hh: string) {
    const n = Number(hh)
    let mm = m || '00'
    // Recadre la minute si elle sort de la plage pour cette nouvelle heure
    if (minH !== null && minM !== null && n === minH && Number(mm) < minM) mm = String(minM).padStart(2, '0')
    if (maxH !== null && maxM !== null && n === maxH && Number(mm) > maxM) mm = String(maxM).padStart(2, '0')
    onChange(`${hh}:${mm}`)
  }
  function pickMin(mm: string) { onChange(`${h || '00'}:${mm}`) }

  return (
    <Popover open={open && !disabled} onOpenChange={o => { if (!disabled) setOpen(o) }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          title={disabled ? t('admin.chooseDateFirst') : ariaLabel}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--espace-2)',
            height: 30, width: '100%', boxSizing: 'border-box',
            padding: '0 8px', fontSize: 'var(--font-size-body-sm)',
            borderRadius: 'var(--radius-md)', background: 'var(--fond-surface)',
            border: `1px solid ${open ? 'var(--ap-400)' : 'var(--bordure-normale)'}`,
            boxShadow: open ? '0 0 0 3px var(--ap-100, rgba(20,148,148,0.14))' : 'none',
            color: value ? 'var(--texte-primaire)' : 'var(--texte-tertiaire)',
            fontWeight: value ? 500 : 400,
            cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
            textAlign: 'left', transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        >
          <Clock size={14} style={{ color: disabled ? 'var(--texte-tertiaire)' : 'var(--ap-500)', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{value || t('admin.timePlaceholder')}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        style={{
          padding: 0, width: 'auto',
          background: 'var(--fond-surface)',
          border: '1px solid var(--bordure-normale)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--ombre-3)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex' }}>
          <TimeColumn label={t('admin.hourColumn')} items={HOURS}   selected={h} open={open} onSelect={pickHour} isDisabled={hourDisabled} />
          <div style={{ width: 1, background: 'var(--bordure-legere)' }} />
          <TimeColumn label={t('admin.minuteColumn')}  items={MINUTES} selected={m} open={open} onSelect={pickMin} isDisabled={minuteDisabled} />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TimeColumn({ label, items, selected, open, onSelect, isDisabled }: {
  label: string
  items: string[]
  selected: string
  open: boolean
  onSelect: (v: string) => void
  isDisabled?: (v: string) => boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Centre la valeur sélectionnée à l'ouverture
  useEffect(() => {
    if (!open || !scrollRef.current) return
    const el = scrollRef.current.querySelector('[data-on="true"]') as HTMLElement | null
    if (el) scrollRef.current.scrollTop = el.offsetTop - 70
  }, [open])

  return (
    <div style={{ width: 70, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '6px 0', textAlign: 'center',
        fontSize: 'var(--font-size-overline)', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: 'var(--texte-tertiaire)',
        background: 'var(--fond-surface-2)', borderBottom: '1px solid var(--bordure-legere)',
      }}>
        {label}
      </div>
      <div ref={scrollRef} style={{ maxHeight: 184, overflowY: 'auto', padding: 4 }}>
        {items.map(it => {
          const on  = selected === it
          const off = isDisabled?.(it) ?? false
          return (
            <button
              key={it}
              type="button"
              data-on={on}
              disabled={off}
              onClick={() => { if (!off) onSelect(it) }}
              style={{
                display: 'block', width: '100%', textAlign: 'center',
                padding: '5px 0', margin: '1px 0', borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-body-sm)', fontWeight: on ? 700 : 500,
                fontVariantNumeric: 'tabular-nums',
                background: on ? 'var(--ap-500)' : 'transparent',
                color: off ? 'var(--bordure-normale)' : on ? '#fff' : 'var(--texte-secondaire)',
                border: 'none', cursor: off ? 'not-allowed' : 'pointer', transition: 'background 0.1s',
                textDecoration: off ? 'line-through' : 'none',
              }}
              onMouseEnter={e => { if (!on && !off) e.currentTarget.style.background = 'var(--ap-50)' }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}
            >
              {it}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── TabButton ─────────────────────────────────────────────────────────────────


// ── Grille colonnes actions ───────────────────────────────────────────────────

const ACTIONS_COLS = '180px 180px 100px 1fr 1.2fr 110px 30px'

// ── Table actions ─────────────────────────────────────────────────────────────

function ActionsTable({ entries, loading, onOpen }: {
  entries: AuditEntry[]
  loading: boolean
  onOpen:  (e: AuditEntry) => void
}) {
  const { t } = useTranslation()
  const isCompact = useIsCompact()
  const pagination = usePagination(entries, useRowsPerPage())
  const rz = useColumnResize({ storageKey: 'audit-actions', ready: !loading && entries.length > 0, cellsSelector: ':scope > *' })
  const cols = rz.gridTemplate ?? ACTIONS_COLS

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
      padding: isCompact ? 'var(--espace-3) var(--espace-4) var(--espace-5)' : 'var(--espace-3) var(--espace-6) var(--espace-6)',
      gap: 'var(--espace-3)',
    }}>
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        background: 'var(--fond-surface)',
        border: '1px solid var(--bordure-legere)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
      }}>
        {/* Header sticky — défile horizontalement avec le corps sur petit écran */}
        {!loading && entries.length > 0 && (
          <div style={{ overflowX: isCompact ? 'auto' : undefined, flexShrink: 0, scrollbarWidth: 'none' }}>
            <div style={{ minWidth: isCompact ? 'max-content' : undefined }}>
              <Row header resize={rz} cols={cols} columns={[t('admin.colDate'), t('admin.colUser'), t('admin.colModule'), t('admin.colAction'), t('admin.colEntity'), t('admin.colStatus'), '']} />
            </div>
          </div>
        )}

        {/* Body scrollable — vertical, plus horizontal sur petit écran (colonnes fixes accessibles) */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: isCompact ? 'auto' : 'hidden', minHeight: 0 }} role="table">
          {loading ? (
            <TableSkeleton />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={<Activity size={20} />}
              title={t('admin.noActionRecorded')}
              description={t('admin.noActionMatch')}
              variant="subtle"
            />
          ) : (
            pagination.pageData.map((e, i) => (
        <button
          key={e.id}
          onClick={() => onOpen(e)}
          style={{
            ...rowStyle(i % 2 === 1, cols, isCompact),
            cursor: 'pointer',
            textAlign: 'left',
            border: 'none',
            width: '100%',
          }}
          onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--ap-50)')}
          onMouseLeave={ev => (ev.currentTarget.style.background = i % 2 === 1 ? 'var(--fond-surface-2)' : 'transparent')}
        >
          <Cell>
            <span style={{ fontSize: 'var(--font-size-caption)', fontFamily: 'monospace', color: 'var(--texte-tertiaire)' }}>
              {formatAuditDateTime(e.createdAt)}
            </span>
          </Cell>
          <Cell>
            {e.utilisateur ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar nom={e.utilisateur.login} size={24} tone="neutral" />
                <span style={{ fontSize: 'var(--font-size-body-sm)' }}>{e.utilisateur.login}</span>
              </div>
            ) : (
              <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>
                {t('admin.systemLower')}
              </span>
            )}
          </Cell>
          <Cell>
            <StatusPill tone="neutral" dot={false}>{labelModule(e.module)}</StatusPill>
          </Cell>
          <Cell>
            <span style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-primaire)', fontWeight: 500 }}>
              {labelAction(e.action)}
            </span>
          </Cell>
          <Cell>
            {e.entiteType && (
              <span style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>
                {labelEntite(e.entiteType)}
              </span>
            )}
          </Cell>
          <Cell>
            <StatusPill tone={e.statut === 'SUCCES' ? 'success' : 'error'}>
              {labelStatut('audit_result', e.statut)}
            </StatusPill>
          </Cell>
          <Cell>
            <ChevronRight size={14} style={{ color: 'var(--texte-tertiaire)' }} />
          </Cell>
        </button>
            ))
          )}
        </div>
      </div>

      {/* Pagination */}
      {!loading && entries.length > 0 && <PaginationBar {...pagination} />}
    </div>
  )
}

// ── Grille colonnes auth ──────────────────────────────────────────────────────

const AUTH_COLS = '170px 150px 160px 140px 170px 1fr'

// ── Table auth ────────────────────────────────────────────────────────────────

function AuthTable({ entries, loading }: {
  entries: AuthLogEntry[]
  loading: boolean
}) {
  const { t } = useTranslation()
  const isCompact = useIsCompact()
  const pagination = usePagination(entries, useRowsPerPage())
  const rz = useColumnResize({ storageKey: 'audit-auth-v2', ready: !loading && entries.length > 0, cellsSelector: ':scope > *' })
  const cols = rz.gridTemplate ?? AUTH_COLS

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
      padding: isCompact ? 'var(--espace-3) var(--espace-4) var(--espace-5)' : 'var(--espace-3) var(--espace-6) var(--espace-6)',
      gap: 'var(--espace-3)',
    }}>
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        background: 'var(--fond-surface)',
        border: '1px solid var(--bordure-legere)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
      }}>
        {/* Header sticky — défile horizontalement avec le corps sur petit écran */}
        {!loading && entries.length > 0 && (
          <div style={{ overflowX: isCompact ? 'auto' : undefined, flexShrink: 0, scrollbarWidth: 'none' }}>
            <div style={{ minWidth: isCompact ? 'max-content' : undefined }}>
              <Row header resize={rz} cols={cols} columns={[t('admin.colDate'), t('admin.colLogin'), t('admin.colResult'), t('admin.colIpAddress'), t('admin.colLocation'), t('admin.colBrowser')]} />
            </div>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: isCompact ? 'auto' : 'hidden', minHeight: 0 }} role="table">
          {loading ? (
            <TableSkeleton />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={<KeyRound size={20} />}
              title={t('admin.noAuthentication')}
              description={t('admin.noAuthMatch')}
              variant="subtle"
            />
          ) : (
            pagination.pageData.map((e, i) => {
              const isSuccess = e.resultat.startsWith('SUCCES')
              const isWarn    = e.resultat.includes('BLOCAGE') || e.resultat.includes('TOTP_REQUIS')
              const tone      = isSuccess ? 'success' : isWarn ? 'warning' : 'error'

              return (
                <div key={e.id} style={rowStyle(i % 2 === 1, cols, isCompact)}>
            <Cell>
              <span style={{ fontSize: 'var(--font-size-caption)', fontFamily: 'monospace', color: 'var(--texte-tertiaire)' }}>
                {formatAuditDateTime(e.createdAt)}
              </span>
            </Cell>
            <Cell>
              <span style={{ fontSize: 'var(--font-size-body-sm)', fontFamily: 'monospace' }}>
                {e.login}
              </span>
            </Cell>
            <Cell>
              <StatusPill tone={tone as any}>
                {isSuccess
                  ? <CheckCircle2 size={11} style={{ marginRight: 2 }} />
                  : isWarn
                    ? <AlertTriangle size={11} style={{ marginRight: 2 }} />
                    : <XCircle size={11} style={{ marginRight: 2 }} />
                }
                {labelStatut('auth_result', e.resultat)}
              </StatusPill>
            </Cell>
            <Cell>
              {e.ipAdresse && (
                <code style={{ fontSize: 'var(--font-size-caption)', fontFamily: 'monospace', color: 'var(--texte-secondaire)' }}>
                  {e.ipAdresse}
                </code>
              )}
            </Cell>
            <Cell>
              {e.localisation && e.localisation.label !== 'Localisation inconnue' && (
                <span
                  title={formatCoords(e.localisation) ? `${t('admin.coordinates')} ${formatCoords(e.localisation)}${e.localisation.timezone ? ' · ' + e.localisation.timezone : ''}` : undefined}
                  style={{
                    fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)',
                    display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                  <MapPin size={11} style={{ flexShrink: 0 }} /> {e.localisation.label}
                </span>
              )}
            </Cell>
            <Cell>
              {e.userAgent && (
                <span
                  title={e.userAgent}
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: 'var(--texte-tertiaire)',
                    display: 'inline-block',
                    maxWidth: 280,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                  {parseUserAgent(e.userAgent).label}
                </span>
              )}
            </Cell>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Pagination */}
      {!loading && entries.length > 0 && <PaginationBar {...pagination} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  DRAWER DÉTAIL AUDIT — 3 onglets lisibles (Résumé / Changements / Technique)
// ════════════════════════════════════════════════════════════════════════════

type DetailTab = 'resume' | 'changements' | 'technique'

// Champs à ignorer dans le diff (bruit technique non pertinent pour un humain)
const CHAMP_NOISE = new Set([
  'id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'version', 'passwordHash',
])

// Champs dont les éléments sont des codes de permission → affichage hiérarchique
// (Module → Sous-section → actions) au lieu d'une liste plate de pastilles.
const PERMISSION_FIELDS = new Set(['permissions', 'grants', 'revokes'])

// Libellés humains des champs rencontrés dans les journaux
function champLabels(t: TFunction): Record<string, string> {
  return {
    login: t('admin.fieldLogin'), email: t('admin.fieldEmail'), statut: t('admin.fieldStatut'), motif: t('admin.fieldMotif'),
    roles: t('admin.fieldRoles'), permissions: t('admin.fieldPermissions'), grants: t('admin.fieldGrants'),
    revokes: t('admin.fieldRevokes'), site: t('admin.fieldSite'), siteId: t('admin.fieldSite'),
    personnelMedical: t('admin.fieldPersonnel'), personnelMedicalId: t('admin.fieldPersonnel'),
    motDePasseTemp: t('admin.fieldTempPassword'), forcerChangement: t('admin.fieldForcedChange'),
    libelle: t('admin.fieldLibelle'), code: t('admin.fieldCode'), isSystem: t('admin.fieldIsSystem'), nbUtilisateurs: t('admin.fieldNbUsers'),
    mode: t('admin.fieldMode'), utilisateurIds: t('admin.fieldUserIds'), tentativesEchec: t('admin.fieldFailedAttempts'),
  }
}

function labelChamp(key: string, t: TFunction): string {
  return champLabels(t)[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').toLowerCase()
}

const isPermCode = (s: unknown): s is string => typeof s === 'string' && /^[a-z_]+\.[a-z._]+$/.test(s)
const isRoleCode = (s: unknown): s is string => typeof s === 'string' && /^[A-Z][A-Z_]+$/.test(s)

/** Formate une valeur scalaire (ou petit objet) en texte lisible français. */
function formatScalar(key: string, v: unknown, t: TFunction): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? t('admin.yes') : t('admin.no')
  if (key === 'mode') return v === 'GRANT' ? t('admin.modeGrant') : v === 'REVOKE' ? t('admin.modeRevoke') : v === 'RESET' ? t('admin.modeReset') : String(v)
  if (key === 'statut') return labelStatut('compte', String(v))
  if (key === 'module') return labelModule(String(v))
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (typeof o['libelle'] === 'string') return o['libelle'] as string
    if (typeof o['code'] === 'string') return o['code'] as string
    return JSON.stringify(v)
  }
  if (isPermCode(v)) return labelPermission(v)
  if (isRoleCode(v)) return labelRole(v)
  return String(v)
}

/** Formate un élément de liste (rôle, permission, utilisateur…). */
function formatItem(key: string, item: unknown, t: TFunction): string {
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>
    if (typeof o['libelle'] === 'string') return o['libelle'] as string
    if (typeof o['code'] === 'string') return formatScalar(key, o['code'], t)
    return JSON.stringify(item)
  }
  if (isPermCode(item)) return labelPermission(item)
  if (isRoleCode(item)) return labelRole(item)
  return String(item)
}

type DiffField =
  | { key: string; kind: 'scalar'; type: 'added' | 'removed' | 'modified'; before: unknown; after: unknown }
  | { key: string; kind: 'list'; added: unknown[]; removed: unknown[] }

function buildDiff(avant: unknown, apres: unknown): DiffField[] {
  const a = (avant && typeof avant === 'object' && !Array.isArray(avant)) ? avant as Record<string, unknown> : {}
  const b = (apres && typeof apres === 'object' && !Array.isArray(apres)) ? apres as Record<string, unknown> : {}
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !CHAMP_NOISE.has(k))
  const fields: DiffField[] = []

  for (const k of keys) {
    const av = a[k], bv = b[k]
    if (JSON.stringify(av) === JSON.stringify(bv)) continue

    if (Array.isArray(av) || Array.isArray(bv)) {
      const aArr = Array.isArray(av) ? av : []
      const bArr = Array.isArray(bv) ? bv : []
      const norm = (x: unknown) => (x && typeof x === 'object')
        ? String((x as Record<string, unknown>)['code'] ?? (x as Record<string, unknown>)['id'] ?? JSON.stringify(x))
        : String(x)
      const aKeys = new Set(aArr.map(norm))
      const bKeys = new Set(bArr.map(norm))
      const added   = bArr.filter(x => !aKeys.has(norm(x)))
      const removed = aArr.filter(x => !bKeys.has(norm(x)))
      if (added.length || removed.length) fields.push({ key: k, kind: 'list', added, removed })
      continue
    }

    const type = (av === null || av === undefined) ? 'added'
               : (bv === null || bv === undefined) ? 'removed' : 'modified'
    fields.push({ key: k, kind: 'scalar', type, before: av, after: bv })
  }
  return fields
}

/** Phrase de synthèse en français naturel. */
function resumePhrase(entry: AuditEntry, t: TFunction): string {
  const who = entry.utilisateur?.login ?? t('admin.theSystem')
  const ent = (labelEntite(entry.entiteType) || labelModule(entry.module)).toLowerCase()
  const VERBS: Record<string, string> = {
    CREATE: t('admin.verbCreate'), UPDATE: t('admin.verbUpdate'), DELETE: t('admin.verbDelete'),
    SET_ROLES: t('admin.verbSetRoles'), SET_STATUT: t('admin.verbSetStatut'),
    RESET_PASSWORD: t('admin.verbResetPassword'),
    SET_PERMISSIONS: t('admin.verbSetPermissions'),
    BULK_PERMISSION: t('admin.verbBulkPermission'),
  }
  const verb = VERBS[entry.action] ?? t('admin.verbGeneric', { action: labelAction(entry.action) })
  return entry.action === 'BULK_PERMISSION' ? `${who} ${verb}` : `${who} ${verb} ${ent}`
}

function AuditDetailDrawer({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const { t } = useTranslation()
  const diff = useMemo(() => buildDiff(entry.avantJson, entry.apresJson), [entry])
  const hasJson = entry.avantJson != null || entry.apresJson != null
  const [tab, setTab] = useState<DetailTab>(diff.length > 0 ? 'changements' : 'resume')

  const TABS: { key: DetailTab; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { key: 'resume',      label: t('admin.tabSummary'),     icon: <FileText size={13} /> },
    { key: 'changements', label: `${t('admin.tabChanges')}${diff.length ? ` (${diff.length})` : ''}`, icon: <GitCompare size={13} />, disabled: diff.length === 0 },
    { key: 'technique',   label: t('admin.tabTechnical'),  icon: <Code2 size={13} />, disabled: !hasJson },
  ]

  const success = entry.statut === 'SUCCES'

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)',
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1001,
        width: 600, maxWidth: '95vw',
        background: 'var(--fond-surface)',
        boxShadow: 'var(--ombre-4)',
        display: 'flex', flexDirection: 'column',
        height: '100vh', maxHeight: '100vh',
      }}>
        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <div style={{
          padding: 'var(--espace-4) var(--espace-5)',
          borderBottom: '1px solid var(--bordure-legere)',
          display: 'flex', alignItems: 'center', gap: 'var(--espace-3)', flexShrink: 0,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 'var(--radius-lg)',
            background: success ? 'var(--ap-50)' : 'var(--erreur-fond)',
            color: success ? 'var(--ap-600)' : 'var(--erreur-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Activity size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-h4)', fontWeight: 700, color: 'var(--texte-primaire)' }}>
              {labelAction(entry.action)}
              <span style={{ color: 'var(--texte-tertiaire)', fontWeight: 500 }}> · {labelModule(entry.module)}</span>
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
              {formatAuditDateTime(entry.createdAt)}
            </p>
          </div>
          <IconButton aria-label={t('admin.close')} icon={<X size={16} />} onClick={onClose} />
        </div>

        {/* ── Onglets (pills SARIS) ─────────────────────────────────────── */}
        <div style={{ padding: 'var(--espace-3) var(--espace-5)', borderBottom: '1px solid var(--bordure-legere)', flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <SegmentedTabs value={tab} onChange={k => setTab(k as DetailTab)} tabs={TABS} />
        </div>

        {/* ── Corps scrollable ──────────────────────────────────────────── */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
          padding: 'var(--espace-5)',
        }}>
          {tab === 'resume'      && <ResumeTab entry={entry} diff={diff} onSeeChanges={() => setTab('changements')} t={t} />}
          {tab === 'changements' && <ChangementsTab diff={diff} t={t} />}
          {tab === 'technique'   && <TechniqueTab entry={entry} t={t} />}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div style={{
          padding: 'var(--espace-3) var(--espace-5)',
          borderTop: '1px solid var(--bordure-legere)',
          background: 'var(--fond-surface)', flexShrink: 0,
        }}>
          <Button variant="secondary" onClick={onClose} fullWidth>{t('admin.close')}</Button>
        </div>
      </div>
    </>
  )
}

// ── Onglet RÉSUMÉ ─────────────────────────────────────────────────────────────

function ResumeTab({ entry, diff, onSeeChanges, t }: {
  entry: AuditEntry
  diff: DiffField[]
  onSeeChanges: () => void
  t: TFunction
}) {
  const success = entry.statut === 'SUCCES'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>

      {/* Phrase de synthèse */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 'var(--espace-3)',
        padding: 'var(--espace-4)', borderRadius: 'var(--radius-lg)',
        background: 'var(--ap-50)', border: '1px solid var(--ap-200)',
      }}>
        {entry.utilisateur
          ? <Avatar nom={entry.utilisateur.login} size={36} tone="neutral" />
          : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--fond-surface)', border: '1px solid var(--ap-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ap-600)', flexShrink: 0 }}><Layers size={16} /></div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-body)', fontWeight: 600, color: 'var(--texte-primaire)', lineHeight: 1.45 }}>
            {resumePhrase(entry, t)}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--ap-700)' }}>
            {formatAuditDateTime(entry.createdAt)}
          </p>
        </div>
      </div>

      {/* Chips d'information clés */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--espace-2)' }}>
        <InfoTile icon={<User size={14} />}   label={t('admin.author')}  value={entry.utilisateur?.login ?? t('admin.system')} />
        <InfoTile icon={<Layers size={14} />} label={t('admin.module')}  value={labelModule(entry.module)} />
        <InfoTile icon={<FileText size={14} />} label={t('admin.entity')} value={labelEntite(entry.entiteType) || '—'} />
        <InfoTile icon={<Clock size={14} />}  label={t('admin.status')}
          value={labelStatut('audit_result', entry.statut)}
          tone={success ? 'success' : 'error'} />
        {entry.entiteId && <InfoTile icon={<Code2 size={14} />} label={t('admin.entityRef')} value={entry.entiteId} mono span2 />}
        {entry.ipAdresse && <InfoTile icon={<Globe size={14} />} label={t('admin.ipAddress')} value={entry.ipAdresse} mono span2 />}
      </div>

      {/* Résumé des changements */}
      {diff.length > 0 ? (
        <button
          onClick={onSeeChanges}
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
            padding: 'var(--espace-3)', borderRadius: 'var(--radius-md)',
            background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)',
            cursor: 'pointer', textAlign: 'left', width: '100%',
          }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 'var(--radius-md)', flexShrink: 0,
            background: 'var(--ap-50)', color: 'var(--ap-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GitCompare size={15} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)' }}>
              {diff.length > 1 ? t('admin.fieldsModifiedPlural', { count: diff.length }) : t('admin.fieldsModifiedSingular', { count: diff.length })}
            </p>
            <p style={{ margin: '1px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
              {t('admin.seeChangesDetail')}
            </p>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--texte-tertiaire)' }} />
        </button>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
          padding: 'var(--espace-3)', borderRadius: 'var(--radius-md)',
          background: 'var(--fond-surface-2)', border: '1px dashed var(--bordure-normale)',
          fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', fontStyle: 'italic',
        }}>
          <CheckCircle2 size={14} /> {t('admin.noComparisonData')}
        </div>
      )}
    </div>
  )
}

// ── Onglet CHANGEMENTS (diff lisible) ─────────────────────────────────────────

function ChangementsTab({ diff, t }: { diff: DiffField[]; t: TFunction }) {
  if (diff.length === 0) {
    return (
      <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>
        {t('admin.noChangeToShow')}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
      {diff.map(f => <DiffRow key={f.key} field={f} t={t} />)}
    </div>
  )
}

function DiffRow({ field, t }: { field: DiffField; t: TFunction }) {
  return (
    <section style={{
      border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
    }}>
      <header style={{
        padding: 'var(--espace-2) var(--espace-3)', background: 'var(--fond-surface-2)',
        borderBottom: '1px solid var(--bordure-legere)',
        fontSize: 'var(--font-size-body-sm)', fontWeight: 700, color: 'var(--texte-primaire)',
      }}>
        {labelChamp(field.key, t)}
      </header>
      <div style={{ padding: 'var(--espace-3)' }}>
        {field.kind === 'scalar' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', flexWrap: 'wrap' }}>
            <ValueChip tone={field.type === 'added' ? 'muted' : 'remove'}>
              {formatScalar(field.key, field.before, t)}
            </ValueChip>
            <ArrowRight size={14} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
            <ValueChip tone={field.type === 'removed' ? 'muted' : 'add'}>
              {formatScalar(field.key, field.after, t)}
            </ValueChip>
          </div>
        ) : PERMISSION_FIELDS.has(field.key) ? (
          // Permissions : regroupement Module → Sous-section → actions courtes
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
            {field.added.length > 0 && (
              <GroupedPermChange tone="add" icon={<Plus size={12} />} label={t('admin.added')}
                codes={field.added.filter((x): x is string => typeof x === 'string')} />
            )}
            {field.removed.length > 0 && (
              <GroupedPermChange tone="remove" icon={<Minus size={12} />} label={t('admin.removed')}
                codes={field.removed.filter((x): x is string => typeof x === 'string')} />
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
            {field.added.length > 0 && (
              <ListChange tone="add" icon={<Plus size={12} />} label={t('admin.added')}
                items={field.added.map(it => formatItem(field.key, it, t))} />
            )}
            {field.removed.length > 0 && (
              <ListChange tone="remove" icon={<Minus size={12} />} label={t('admin.removed')}
                items={field.removed.map(it => formatItem(field.key, it, t))} />
            )}
          </div>
        )}
      </div>
    </section>
  )
}

// ── Diff de permissions groupé par Module → Sous-section → actions ────────────

function GroupedPermChange({ tone, icon, label, codes }: {
  tone: 'add' | 'remove'
  icon: React.ReactNode
  label: string
  codes: string[]
}) {
  const c = tone === 'add'
    ? { text: 'var(--succes-texte)', bg: 'var(--succes-fond)', border: 'var(--succes-bordure)' }
    : { text: 'var(--erreur-texte)', bg: 'var(--erreur-fond)', border: 'var(--erreur-bordure)' }
  const tree = buildPermissionTree(codes.map(code => ({ code, module: parsePermCode(code).module })))

  return (
    <div>
      <p style={{
        margin: '0 0 6px', fontSize: 'var(--font-size-overline)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.05em', color: c.text,
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        {icon} {label} ({codes.length})
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
        {tree.map(node => (
          <section key={node.module} style={{
            border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-md)', overflow: 'hidden',
          }}>
            {/* En-tête module */}
            <header style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '5px 10px', background: 'var(--fond-surface-2)',
              borderBottom: '1px solid var(--bordure-legere)',
            }}>
              <span style={{ fontSize: 'var(--font-size-body-sm)', fontWeight: 700, color: 'var(--texte-primaire)' }}>
                {node.label}
              </span>
              <span style={{ fontSize: 'var(--font-size-overline)', fontWeight: 700, color: c.text }}>
                {node.codes.length}
              </span>
            </header>

            {/* Sous-sections */}
            <div style={{ padding: '7px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {node.subgroups.map(sg => (
                <div key={sg.key} style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  {sg.sub && (
                    <span style={{
                      fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--texte-tertiaire)',
                      minWidth: 96, flexShrink: 0,
                    }}>
                      {sg.label}
                    </span>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {sg.leaves.map(leaf => (
                      <span key={leaf.code} title={labelPermission(leaf.code)} style={{
                        fontSize: 'var(--font-size-caption)', fontWeight: 600,
                        padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                        background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                      }}>
                        {labelPermAction(leaf.action)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function ListChange({ tone, icon, label, items }: {
  tone: 'add' | 'remove'; icon: React.ReactNode; label: string; items: string[]
}) {
  const c = tone === 'add'
    ? { text: 'var(--succes-texte)', bg: 'var(--succes-fond)', border: 'var(--succes-bordure)' }
    : { text: 'var(--erreur-texte)', bg: 'var(--erreur-fond)', border: 'var(--erreur-bordure)' }
  return (
    <div>
      <p style={{
        margin: '0 0 5px', fontSize: 'var(--font-size-overline)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.05em', color: c.text,
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        {icon} {label} ({items.length})
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {items.map((it, i) => (
          <span key={i} style={{
            fontSize: 'var(--font-size-caption)', fontWeight: 500,
            padding: '3px 9px', borderRadius: 'var(--radius-sm)',
            background: c.bg, color: c.text, border: `1px solid ${c.border}`,
          }}>
            {it}
          </span>
        ))}
      </div>
    </div>
  )
}

function ValueChip({ tone, children }: { tone: 'add' | 'remove' | 'muted'; children: React.ReactNode }) {
  const c = tone === 'add'
    ? { text: 'var(--succes-texte)', bg: 'var(--succes-fond)', border: 'var(--succes-bordure)' }
    : tone === 'remove'
      ? { text: 'var(--erreur-texte)', bg: 'var(--erreur-fond)', border: 'var(--erreur-bordure)' }
      : { text: 'var(--texte-tertiaire)', bg: 'var(--fond-surface-2)', border: 'var(--bordure-legere)' }
  return (
    <span style={{
      fontSize: 'var(--font-size-body-sm)', fontWeight: 500,
      padding: '4px 10px', borderRadius: 'var(--radius-sm)',
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      ...(tone === 'remove' ? { textDecoration: 'line-through' } : {}),
    }}>
      {children}
    </span>
  )
}

function InfoTile({ icon, label, value, mono, tone, span2 }: {
  icon: React.ReactNode; label: string; value: React.ReactNode
  mono?: boolean; tone?: 'success' | 'error'; span2?: boolean
}) {
  const valColor = tone === 'success' ? 'var(--succes-texte)' : tone === 'error' ? 'var(--erreur-texte)' : 'var(--texte-primaire)'
  return (
    <div style={{
      gridColumn: span2 ? '1 / -1' : undefined,
      padding: 'var(--espace-2) var(--espace-3)',
      background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)',
      borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', minWidth: 0,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 'var(--radius-sm)', flexShrink: 0,
        background: 'var(--ap-50)', color: 'var(--ap-600)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-overline)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--texte-tertiaire)' }}>
          {label}
        </p>
        <p style={{
          margin: '1px 0 0', fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: valColor,
          fontFamily: mono ? 'monospace' : 'inherit',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {value}
        </p>
      </div>
    </div>
  )
}

// ── Onglet TECHNIQUE (JSON repliable) ─────────────────────────────────────────

function TechniqueTab({ entry, t }: { entry: AuditEntry; t: TFunction }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
      <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>
        {t('admin.rawLogData')}
      </p>
      {entry.avantJson != null && <JsonBlock title={t('admin.stateBefore')} data={entry.avantJson} />}
      {entry.apresJson != null && <JsonBlock title={t('admin.stateAfter')} data={entry.apresJson} defaultOpen />}
      {entry.avantJson == null && entry.apresJson == null && (
        <div style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>
          {t('admin.noTechnicalData')}
        </div>
      )}
    </div>
  )
}

function JsonBlock({ title, data, defaultOpen }: { title: string; data: unknown; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <section style={{ border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
          padding: 'var(--espace-2) var(--espace-3)', background: 'var(--fond-surface-2)',
          border: 'none', borderBottom: open ? '1px solid var(--bordure-legere)' : 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        {open ? <ChevronDown size={14} style={{ color: 'var(--texte-tertiaire)' }} /> : <ChevronRight size={14} style={{ color: 'var(--texte-tertiaire)' }} />}
        <span style={{ flex: 1, fontSize: 'var(--font-size-body-sm)', fontWeight: 700, color: 'var(--texte-primaire)' }}>{title}</span>
        <Code2 size={13} style={{ color: 'var(--texte-tertiaire)' }} />
      </button>
      {open && (
        <pre style={{
          margin: 0, padding: 'var(--espace-3)', background: 'var(--fond-surface)',
          fontSize: 'var(--font-size-caption)', fontFamily: 'monospace', color: 'var(--texte-primaire)',
          maxHeight: 360, overflow: 'auto', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </section>
  )
}

// ── Helpers visuels ───────────────────────────────────────────────────────────

function Row({ columns, header, cols, resize }: { columns: string[]; header?: boolean; cols: string; resize?: ColumnResize }) {
  const { t } = useTranslation()
  const last = columns.length - 1
  return (
    <div ref={resize ? resize.containerRef : undefined} style={{
      display: 'grid',
      gridTemplateColumns: cols,
      padding: 'var(--espace-2) var(--espace-4)',
      background: header ? 'var(--fond-surface-2)' : 'transparent',
      borderBottom: '1px solid var(--bordure-legere)',
      fontSize: 'var(--font-size-overline)',
      fontWeight: header ? 700 : 400,
      textTransform: header ? 'uppercase' : 'none',
      letterSpacing: '0.07em',
      color: 'var(--texte-tertiaire)',
      gap: 'var(--espace-3)',
      flexShrink: 0,
    }}>
      {columns.map((c, i) => (
        <div key={i} style={{ position: 'relative', minWidth: 0 }}>
          {c}
          {resize && i < last && (
            <span
              className="saris-col-resize"
              role="separator"
              aria-orientation="vertical"
              aria-label={t('admin.resizeColumn')}
              onPointerDown={e => resize.startDrag(i, e)}
              onDoubleClick={resize.reset}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function rowStyle(striped: boolean, cols: string, compact?: boolean): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: cols,
    // Petit écran : les colonnes à largeur fixe gardent leur taille naturelle
    // (la zone défile horizontalement) au lieu d'être écrasées/tronquées.
    minWidth: compact ? 'max-content' : undefined,
    gap: 'var(--espace-3)',
    padding: 'var(--espace-2) var(--espace-4)',
    alignItems: 'center',
    background: striped ? 'var(--fond-surface-2)' : 'transparent',
    borderBottom: '1px solid var(--bordure-legere)',
    transition: 'background 0.12s',
  }
}

function Cell({ children }: { children: React.ReactNode }) {
  return <div style={{ minWidth: 0, overflow: 'hidden' }}>{children}</div>
}

function TableSkeleton() {
  return (
    <div style={{ padding: 'var(--espace-4)' }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} height={36} style={{ marginBottom: 6 }} />
      ))}
    </div>
  )
}

// ── Style select ──────────────────────────────────────────────────────────────

