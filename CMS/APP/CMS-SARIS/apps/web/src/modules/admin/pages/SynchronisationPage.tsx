/**
 * SynchronisationPage — centre de synchronisation & sauvegardes.
 *
 * Trois zones distinctes :
 *   1. Synchronisation terrain (offline-first) : état réseau + file de rejeu
 *      des écritures faites hors-ligne (IndexedDB) + bouton « Synchroniser ».
 *   2. Sauvegardes système (serveur) : dernière sauvegarde + historique.
 *   3. Volumétrie & journaux : compteurs par module.
 *
 * Réservé aux administrateurs (synchronisation.read/execute).
 */

import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n/config'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RefreshCw, Database, Save, ShieldCheck, FileText, KeyRound, Wifi, WifiOff,
  HardDrive, CheckCircle2, AlertTriangle, Loader2, Play, CloudUpload, Trash2,
  RotateCcw, Users, Stethoscope, Pill, Ambulance, FlaskConical, HardHat, ClipboardList,
  CalendarClock, MonitorSmartphone, Activity, GitMerge, Radio,
} from 'lucide-react'
import {
  PageHeader, Card, Button, StatusPill, Skeleton, EmptyState, Tooltip, Modal, SegmentedTabs,
} from '@/components/saris'
import { toast } from '@workspace/ui/components/sonner'
import { usePermissions } from '@/hooks/usePermissions'
import { formatDateTime, formatNumber } from '@/lib/intl'
import { labelModule, labelStatut, labelAction } from '@/config/labels'
import { useNetworkStore } from '@/stores/network.store'
import { useSyncStore } from '@/stores/sync.store'
import { syncCycle, listMutations, purgeMutations, retryRejected } from '@/lib/sync'
import {
  useSyncStatus, useSauvegardes, useDeclencherSauvegarde, useRestaurerSauvegarde,
} from '../hooks/useAdmin'
import { useSyncStatus as useDataSyncStatus, useSyncRun, useSyncSupervision } from '../hooks/useSync'
import type { SauvegardeSysteme } from '../api/admin.api'
import type {
  SyncSupervisionPoste, SyncSupervisionJournal, SyncSupervisionConflit,
} from '../api/sync.api'
import type { FileMutation } from '@cms-saris/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Date absolue (jour mois année + heure) suivant la langue active. */
function formatDate(iso: string): string {
  return formatDateTime(iso, {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function relative(d: Date | string | null | undefined): string {
  if (!d) return i18n.t('admin.relativeNever')
  const t = typeof d === 'string' ? new Date(d).getTime() : d.getTime()
  const diff = (Date.now() - t) / 1000
  if (diff < 10)     return i18n.t('admin.relativeNow')
  if (diff < 60)     return i18n.t('admin.relativeSeconds', { count: Math.floor(diff) })
  if (diff < 3600)   return i18n.t('admin.relativeMinutes', { count: Math.floor(diff / 60) })
  if (diff < 86400)  return i18n.t('admin.relativeHours', { count: Math.floor(diff / 3600) })
  return i18n.t('admin.relativeDays', { count: Math.floor(diff / 86400) })
}

const MODULE_ICONS: Record<string, ReactNode> = {
  utilisateurs:     <KeyRound size={14} />,
  sites:            <Database size={14} />,
  personnel:        <Users size={14} />,
  patients:         <FileText size={14} />,
  visites:          <ClipboardList size={14} />,
  consultations:    <Stethoscope size={14} />,
  ordonnances:      <Pill size={14} />,
  bons_examen:      <FlaskConical size={14} />,
  evacuations:      <Ambulance size={14} />,
  accidents_travail:<HardHat size={14} />,
}
function moduleIcon(mod: string) { return MODULE_ICONS[mod] ?? <HardDrive size={14} /> }

type TFn = ReturnType<typeof useTranslation>['t']

const MUTATION_STATUT_TONE: Record<string, string> = {
  PENDING:  'warning',
  SENT:     'info',
  APPLIED:  'success',
  REJECTED: 'error',
  CONFLICT: 'error',
}
function mutationStatutLabel(t: TFn, statut: string): string {
  const map: Record<string, string> = {
    PENDING:  t('admin.mutationPending'),
    SENT:     t('admin.mutationSent'),
    APPLIED:  t('admin.mutationApplied'),
    REJECTED: t('admin.mutationRejected'),
    CONFLICT: t('admin.mutationConflict'),
  }
  return map[statut] ?? statut
}

// ════════════════════════════════════════════════════════════════════════════════
//  PAGE
// ════════════════════════════════════════════════════════════════════════════════

type SyncTab = 'supervision' | 'terrain' | 'backups' | 'volumetry'

export function SynchronisationPage() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canExecute = has('synchronisation.execute')
  const canRestore = has('synchronisation.restore')

  const { data: status, isLoading: ls } = useSyncStatus()
  const { data: sauvegardes = [], isLoading: lh } = useSauvegardes()
  const declencher = useDeclencherSauvegarde()

  const totalEnregistrements = status?.modules.reduce((a, m) => a + m.count, 0) ?? 0

  const [tab, setTab] = useState<SyncTab>('supervision')

  const tabs = [
    { key: 'supervision', label: t('admin.tabSupervision'), icon: <Radio size={14} /> },
    { key: 'terrain',     label: t('admin.tabTerrain'),     icon: <CloudUpload size={14} /> },
    { key: 'backups',     label: t('admin.tabBackups'),     icon: <Save size={14} />, badge: sauvegardes.length || undefined },
    { key: 'volumetry',   label: t('admin.tabVolumetry'),   icon: <HardDrive size={14} /> },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <PageHeader
        icon={<RefreshCw size={18} />}
        title={t('admin.syncPageTitle')}
        subtitle={t('admin.syncPageSubtitle')}
        actions={
          canExecute && (
            <Button leftIcon={<Save size={14} />} loading={declencher.isPending} onClick={() => declencher.mutate()}>
              {t('admin.runBackup')}
            </Button>
          )
        }
      />

      {/* Onglets de regroupement (scroll horizontal sur petit écran) */}
      <div style={{ padding: 'var(--espace-4) var(--espace-6) 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
        <SegmentedTabs value={tab} onChange={(k) => setTab(k as SyncTab)} tabs={tabs} aria-label={t('admin.syncPageTitle')} />
      </div>

      <div style={{ padding: 'var(--espace-4) var(--espace-6) var(--espace-6)', display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>
        {tab === 'supervision' && (
          <>
            <SupervisionZone />
            <DataSyncZone />
          </>
        )}
        {tab === 'terrain' && <SyncTerrainZone />}
        {tab === 'backups' && (
          <SauvegardesZone
            sauvegardes={sauvegardes} loading={lh} canExecute={canExecute} canRestore={canRestore}
            planification={status?.planification} declencher={declencher}
          />
        )}
        {tab === 'volumetry' && <VolumetrieZone status={status} loading={ls} total={totalEnregistrements} />}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
//  ZONE 0 — Supervision de la synchronisation (temps réel, serveur central)
// ════════════════════════════════════════════════════════════════════════════════

const JOURNAL_STATUT_TONE: Record<string, string> = {
  SUCCESS:    'success',
  REUSSI:     'success',
  REUSSIE:    'success',
  OK:         'success',
  RUNNING:    'info',
  EN_COURS:   'info',
  PARTIAL:    'warning',
  PARTIEL:    'warning',
  FAILED:     'error',
  ECHEC:      'error',
  ERROR:      'error',
}
function journalStatutLabel(t: TFn, statut: string): string {
  const map: Record<string, string> = {
    SUCCESS:  t('admin.supJournalSuccess'),
    REUSSI:   t('admin.supJournalSuccess'),
    REUSSIE:  t('admin.supJournalSuccess'),
    OK:       t('admin.supJournalSuccess'),
    RUNNING:  t('admin.supJournalRunning'),
    EN_COURS: t('admin.supJournalRunning'),
    PARTIAL:  t('admin.supJournalPartial'),
    PARTIEL:  t('admin.supJournalPartial'),
    FAILED:   t('admin.supJournalFailed'),
    ECHEC:    t('admin.supJournalFailed'),
    ERROR:    t('admin.supJournalFailed'),
  }
  return map[(statut || '').toUpperCase()] ?? statut
}

function SupervisionZone() {
  const { t } = useTranslation()
  const { data, isLoading } = useSyncSupervision()
  const postes   = data?.postes   ?? []
  const journaux = data?.journaux ?? []
  const conflits = data?.conflits ?? []
  const enLigne  = postes.filter(p => p.enLigne).length

  return (
    <Card padding="none" className="saris-grain">
      <Card.Header
        icon={<Radio size={14} />}
        title={t('admin.supTitle')}
        subtitle={t('admin.supSubtitle')}
        actions={
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
            padding: '3px 9px', borderRadius: 9999,
            background: 'var(--succes-fond)', color: 'var(--succes-texte)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--succes-accent)', flexShrink: 0 }} />
            {t('admin.supLive')}
          </span>
        }
      />
      <Card.Body padding="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>

          {/* ── Postes ───────────────────────────────────────────────────── */}
          <section>
            <SupSectionTitle
              icon={<MonitorSmartphone size={13} />}
              label={t('admin.supPostesTitle')}
              count={postes.length > 0 ? t('admin.supPostesOnline', { online: enLigne, total: postes.length }) : undefined}
            />
            {isLoading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--espace-2)' }}>
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={58} />)}
              </div>
            ) : postes.length === 0 ? (
              <EmptyState
                icon={<MonitorSmartphone size={18} />}
                title={t('admin.supNoPosteTitle')}
                description={t('admin.supNoPosteDesc')}
                variant="subtle"
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--espace-2)' }}>
                {postes.map(p => <PosteCard key={p.id} poste={p} />)}
              </div>
            )}
          </section>

          {/* ── Activité récente ─────────────────────────────────────────── */}
          <section>
            <SupSectionTitle
              icon={<Activity size={13} />}
              label={t('admin.supActivityTitle')}
            />
            {isLoading ? (
              <div>{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={44} style={{ marginBottom: 6 }} />)}</div>
            ) : journaux.length === 0 ? (
              <EmptyState
                icon={<Activity size={18} />}
                title={t('admin.supNoActivityTitle')}
                description={t('admin.supNoActivityDesc')}
                variant="subtle"
              />
            ) : (
              <div style={{ border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                {journaux.map((j, i) => <JournalRow key={j.id} j={j} striped={i % 2 === 1} />)}
              </div>
            )}
          </section>

          {/* ── Conflits ─────────────────────────────────────────────────── */}
          <section>
            <SupSectionTitle
              icon={<GitMerge size={13} />}
              label={t('admin.supConflictsTitle')}
              badge={conflits.length > 0 ? conflits.length : undefined}
            />
            {isLoading ? (
              <div>{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} height={44} style={{ marginBottom: 6 }} />)}</div>
            ) : conflits.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 size={18} />}
                title={t('admin.supNoConflictTitle')}
                description={t('admin.supNoConflictDesc')}
                variant="subtle"
              />
            ) : (
              <div style={{ border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                {conflits.map((c, i) => <ConflitRow key={c.id} c={c} striped={i % 2 === 1} />)}
              </div>
            )}
          </section>

        </div>
      </Card.Body>
    </Card>
  )
}

function SupSectionTitle({ icon, label, count, badge }: {
  icon: ReactNode; label: string; count?: string; badge?: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--espace-2)' }}>
      <span style={{ display: 'inline-flex', color: 'var(--texte-tertiaire)' }}>{icon}</span>
      <p style={{ margin: 0, fontSize: 'var(--font-size-overline)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)' }}>
        {label}
      </p>
      {badge !== undefined && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9999,
          fontSize: 11, fontWeight: 700,
          background: 'var(--erreur-fond)', color: 'var(--erreur-texte)',
        }}>
          {badge}
        </span>
      )}
      {count && (
        <span style={{ marginLeft: 'auto', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
          {count}
        </span>
      )}
    </div>
  )
}

function PosteCard({ poste }: { poste: SyncSupervisionPoste }) {
  const { t } = useTranslation()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
      padding: 'var(--espace-2) var(--espace-3)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--bordure-legere)', background: 'var(--fond-surface)',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 'var(--radius-md)', flexShrink: 0,
        background: poste.enLigne ? 'var(--succes-fond)' : 'var(--fond-surface-2)',
        color:      poste.enLigne ? 'var(--succes-accent)' : 'var(--texte-tertiaire)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <MonitorSmartphone size={15} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {poste.libelle}
        </p>
        <p style={{ margin: '1px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
          {t('admin.supLastSync')} · {relative(poste.derniereSyncAt)}
        </p>
      </div>
      <StatusPill tone={poste.enLigne ? 'success' : 'neutral'} size="sm">
        {poste.enLigne ? t('admin.supOnline') : t('admin.supOffline')}
      </StatusPill>
    </div>
  )
}

function JournalRow({ j, striped }: { j: SyncSupervisionJournal; striped: boolean }) {
  const { t } = useTranslation()
  const tone = JOURNAL_STATUT_TONE[(j.statut || '').toUpperCase()] ?? 'neutral'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
      padding: 'var(--espace-2) var(--espace-3)',
      background: striped ? 'var(--fond-surface-2)' : 'transparent',
      borderBottom: '1px solid var(--bordure-legere)',
    }}>
      <div style={{ width: 26, height: 26, borderRadius: 'var(--radius-md)', background: 'var(--ap-50)', color: 'var(--ap-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Activity size={13} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {j.poste}
        </p>
        <p style={{ margin: '1px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
          {relative(j.startedAt)} · {t('admin.supMutations', { count: j.nbMutations })} · {t('admin.supConflicts', { count: j.nbConflits })}
        </p>
      </div>
      <StatusPill tone={tone as any} size="sm">{journalStatutLabel(t, j.statut)}</StatusPill>
    </div>
  )
}

function ConflitRow({ c, striped }: { c: SyncSupervisionConflit; striped: boolean }) {
  const { t } = useTranslation()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
      padding: 'var(--espace-2) var(--espace-3)',
      background: striped ? 'var(--fond-surface-2)' : 'transparent',
      borderBottom: '1px solid var(--bordure-legere)',
    }}>
      <div style={{ width: 26, height: 26, borderRadius: 'var(--radius-md)', background: 'var(--erreur-fond)', color: 'var(--erreur-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <GitMerge size={13} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {humanizeCode(c.entiteType)}
        </p>
        <p style={{ margin: '1px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
          {humanizeCode(c.typeConflit)} · {relative(c.createdAt)}
        </p>
      </div>
      <StatusPill tone="warning" size="sm">{t('admin.supConflictBadge')}</StatusPill>
    </div>
  )
}

function humanizeCode(code: string): string {
  if (!code) return ''
  const s = code.replace(/[_-]+/g, ' ').trim().toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ════════════════════════════════════════════════════════════════════════════════
//  ZONE 1 bis — Synchronisation des données (mode local : SQLite ↔ serveur central)
// ════════════════════════════════════════════════════════════════════════════════

function DataSyncZone() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canExecute = has('synchronisation.execute')
  const { data } = useDataSyncStatus()
  const run = useSyncRun()
  const client = data?.client
  const enabled = !!client?.enabled
  const online = !!client?.online

  return (
    <Card padding="none" className="saris-grain">
      <Card.Header
        icon={<Database size={14} />}
        title={t('sync.dataTitle')}
        subtitle={t('sync.dataSubtitle')}
      />
      <Card.Body padding="md">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--espace-4)', flexWrap: 'wrap',
          padding: 'var(--espace-3) var(--espace-4)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--bordure-legere)',
          background: 'color-mix(in srgb, var(--fond-surface-2) 70%, transparent)',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
            padding: '5px 11px', borderRadius: 9999,
            background: !enabled ? 'var(--info-fond)' : online ? 'var(--succes-fond)' : 'var(--avert-fond)',
            color:      !enabled ? 'var(--info-texte)' : online ? 'var(--succes-texte)' : 'var(--avert-texte)',
          }}>
            {!enabled ? <Database size={13} /> : online ? <Wifi size={13} /> : <WifiOff size={13} />}
            {!enabled ? t('sync.remoteMode') : online ? t('sync.serverReachable') : t('common.offline')}
          </span>

          {enabled && <Metric label={t('sync.lastPull')} value={relative(client?.lastPulledAt)} />}
          {enabled && <Metric label={t('sync.lastPush')} value={relative(client?.lastPushedAt)} />}

          <div style={{ marginLeft: 'auto' }}>
            <Tooltip label={t('admin.forceSyncTooltip')}>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={run.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                disabled={!enabled || !online || !canExecute || run.isPending}
                onClick={() => run.mutate(undefined, {
                  onSuccess: (r) => toast.success(
                    r.skipped
                      ? t('sync.skipped')
                      : t('sync.success', { pulled: r.pulled ?? 0, pushed: r.pushed ?? 0 }),
                  ),
                  onError: () => toast.error(t('sync.error')),
                })}
              >
                {run.isPending ? t('sync.syncing') : t('admin.forceSync')}
              </Button>
            </Tooltip>
          </div>
        </div>

        {!enabled && (
          <p style={{ marginTop: 'var(--espace-3)', fontSize: 12, color: 'var(--texte-secondaire)' }}>
            {t('sync.remoteExplain')}
          </p>
        )}
      </Card.Body>
    </Card>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
//  ZONE 1 — Synchronisation terrain (offline-first)
// ════════════════════════════════════════════════════════════════════════════════

function SyncTerrainZone() {
  const { t } = useTranslation()
  const isOnline     = useNetworkStore(s => s.isOnline)
  const syncStatus   = useSyncStore(s => s.status)
  const pendingCount = useSyncStore(s => s.pendingCount)
  const lastSyncAt   = useSyncStore(s => s.lastSyncAt)
  const errorMessage = useSyncStore(s => s.errorMessage)
  const syncing      = syncStatus === 'syncing'

  const qc = useQueryClient()
  const { data: queue = [] } = useQuery({
    queryKey: ['sync-queue'],
    queryFn:  listMutations,
    refetchInterval: 5000,
  })

  // Service worker / PWA actif ?
  const [swActive, setSwActive] = useState(false)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      setSwActive(!!navigator.serviceWorker.controller)
      navigator.serviceWorker.ready.then(() => setSwActive(true)).catch(() => {})
    }
  }, [])

  const sync = useMutation({
    mutationFn: () => syncCycle(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sync-queue'] }); qc.invalidateQueries() },
  })
  const retry = useMutation({
    mutationFn: () => retryRejected(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sync-queue'] }); toast.success(t('admin.retryStarted')) },
  })
  const purge = useMutation({
    mutationFn: () => purgeMutations('REJECTED'),
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ['sync-queue'] }); toast.success(t('admin.purgedRejected', { count: n })) },
  })

  const rejectedCount = queue.filter(m => m.statut === 'REJECTED').length

  return (
    <Card padding="none" className="saris-grain">
      <Card.Header
        icon={<CloudUpload size={14} />}
        title={t('admin.terrainTitle')}
        subtitle={t('admin.terrainSubtitle')}
      />
      <Card.Body padding="md">
        {/* Bandeau d'état */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--espace-4)', flexWrap: 'wrap',
          padding: 'var(--espace-3) var(--espace-4)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--bordure-legere)',
          background: 'color-mix(in srgb, var(--fond-surface-2) 70%, transparent)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
            padding: '5px 11px', borderRadius: 9999,
            background: isOnline ? 'var(--succes-fond)' : 'var(--avert-fond)',
            color:      isOnline ? 'var(--succes-texte)' : 'var(--avert-texte)',
          }}>
            {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
            {isOnline ? t('admin.online') : t('admin.offline')}
          </span>

          <Metric label={t('admin.pendingSync')} value={`${pendingCount}`} tone={pendingCount > 0 ? 'warning' : 'neutral'} />
          <Metric label={t('admin.lastSync')} value={relative(lastSyncAt)} />
          <Tooltip label={swActive
            ? t('admin.swActiveTooltip')
            : t('admin.swInactiveTooltip')}>
            <span><Metric label={t('admin.serviceWorkerLabel')} value={swActive ? t('admin.swActive') : t('admin.swInactive')} tone={swActive ? 'success' : 'neutral'} /></span>
          </Tooltip>

          <div style={{ marginLeft: 'auto' }}>
            <Tooltip label={t('admin.forceSyncTooltip')}>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                disabled={!isOnline || syncing || sync.isPending}
                onClick={() => sync.mutate()}
              >
                {syncing ? t('admin.syncing') : t('admin.forceSync')}
              </Button>
            </Tooltip>
          </div>
        </div>

        {errorMessage && (
          <div style={{
            marginTop: 'var(--espace-3)', padding: 'var(--espace-2) var(--espace-3)',
            borderRadius: 'var(--radius-md)', background: 'var(--erreur-fond)',
            color: 'var(--erreur-texte)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <AlertTriangle size={13} /> {errorMessage}
          </div>
        )}

        {/* File de rejeu */}
        <div style={{ marginTop: 'var(--espace-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--espace-2)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-overline)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)' }}>
              {t('admin.localQueue', { count: queue.length })}
            </p>
            {rejectedCount > 0 && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <Button size="sm" variant="ghost" leftIcon={<RotateCcw size={12} />} loading={retry.isPending} onClick={() => retry.mutate()}>
                  {t('admin.retryRejected')}
                </Button>
                <Button size="sm" variant="ghost" leftIcon={<Trash2 size={12} />} loading={purge.isPending} onClick={() => purge.mutate()}>
                  {t('admin.purgeRejected')}
                </Button>
              </div>
            )}
          </div>

          {queue.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={18} />}
              title={t('admin.queueEmptyTitle')}
              description={t('admin.queueEmptyDesc')}
              variant="subtle"
            />
          ) : (
            <div style={{ border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              {queue.slice(0, 30).map((m, i) => <MutationRow key={m.mutationUuid} m={m} striped={i % 2 === 1} />)}
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'warning' | 'success' | 'neutral' }) {
  const color = tone === 'warning' ? 'var(--avert-accent)'
              : tone === 'success' ? 'var(--succes-accent)'
              : 'var(--texte-primaire)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--texte-tertiaire)' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}

function MutationRow({ m, striped }: { m: FileMutation; striped: boolean }) {
  const { t } = useTranslation()
  const tone = MUTATION_STATUT_TONE[m.statut] ?? 'neutral'
  const label = mutationStatutLabel(t, m.statut)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
      padding: 'var(--espace-2) var(--espace-3)',
      background: striped ? 'var(--fond-surface-2)' : 'transparent',
      borderBottom: '1px solid var(--bordure-legere)',
    }}>
      <div style={{ width: 26, height: 26, borderRadius: 'var(--radius-md)', background: 'var(--ap-50)', color: 'var(--ap-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {moduleIcon(m.module)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)' }}>
          {labelAction(m.action)} · {labelModule(m.module === 'triage' ? 'visite' : m.module)}
        </p>
        <p style={{ margin: '1px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
          {relative(m.createdLocalAt)}{m.errorMessage ? ` · ${m.errorMessage}` : ''}
        </p>
      </div>
      <StatusPill tone={tone as any} size="sm">{label}</StatusPill>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
//  ZONE 2 — Sauvegardes serveur
// ════════════════════════════════════════════════════════════════════════════════

function SauvegardesZone({ sauvegardes, loading, canExecute, canRestore, planification, declencher }: {
  sauvegardes: SauvegardeSysteme[]
  loading: boolean
  canExecute: boolean
  canRestore: boolean
  planification?: { actif: boolean; frequence?: string; heure?: string; expression?: string; retention: number }
  declencher: ReturnType<typeof useDeclencherSauvegarde>
}) {
  const { t } = useTranslation()
  const derniere = sauvegardes[0]
  const restaurer = useRestaurerSauvegarde()
  const [restoreTarget, setRestoreTarget] = useState<SauvegardeSysteme | null>(null)

  return (
    <Card padding="none" className="saris-grain">
      <Card.Header
        icon={<Save size={14} />}
        title={t('admin.backupsTitle')}
        subtitle={t('admin.backupsSubtitle', { count: sauvegardes.length })}
        actions={canExecute && (
          <Button variant="outline" size="sm"
            leftIcon={declencher.isPending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            disabled={declencher.isPending} onClick={() => declencher.mutate()}>
            {t('admin.run')}
          </Button>
        )}
      />
      <Card.Body padding="md">
        {/* Bandeau planification automatique */}
        {planification?.actif && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: 'var(--espace-2) var(--espace-3)', borderRadius: 'var(--radius-md)',
            background: 'var(--info-fond)', color: 'var(--info-texte)', fontSize: 12, marginBottom: 'var(--espace-3)',
          }}>
            <CalendarClock size={14} />
            <span><strong>{t('admin.autoBackup')}</strong> — {planificationLabel(t, planification)} · {t('admin.retentionKept', { count: planification.retention })}</span>
          </div>
        )}
        {/* Dernière sauvegarde mise en avant */}
        {derniere && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
            padding: 'var(--espace-3) var(--espace-4)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--bordure-legere)', background: 'var(--fond-surface-2)',
            marginBottom: 'var(--espace-3)',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 'var(--radius-lg)', flexShrink: 0,
              background: derniere.statut === 'REUSSIE' ? 'var(--succes-fond)' : 'var(--avert-fond)',
              color:      derniere.statut === 'REUSSIE' ? 'var(--succes-accent)' : 'var(--avert-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {derniere.statut === 'REUSSIE' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-body)', fontWeight: 700, color: 'var(--texte-primaire)' }}>
                {t('admin.lastBackup')} — {relative(derniere.createdAt)}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
                {formatDate(derniere.createdAt)} · {t('admin.triggeredBy', { type: declTypeLabel(derniere.type) })}
              </p>
            </div>
            <StatusPill tone={derniere.statut === 'REUSSIE' ? 'success' : derniere.statut === 'ECHEC' ? 'error' : 'warning'}>
              {labelStatut('synchronisation', derniere.statut)}
            </StatusPill>
          </div>
        )}

        {loading ? (
          <div>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={44} style={{ marginBottom: 6 }} />)}</div>
        ) : sauvegardes.length === 0 ? (
          <EmptyState
            icon={<Save size={20} />}
            title={t('admin.noBackupTitle')}
            description={t('admin.noBackupDesc')}
            variant="subtle"
            action={canExecute && (
              <Button leftIcon={<Play size={14} />} loading={declencher.isPending} onClick={() => declencher.mutate()}>
                {t('admin.firstBackup')}
              </Button>
            )}
          />
        ) : (
          <div style={{ border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {sauvegardes.map((s, i) => (
              <SauvegardeRow key={s.id} s={s} striped={i % 2 === 1}
                canRestore={canRestore} onRestore={() => setRestoreTarget(s)} />
            ))}
          </div>
        )}
      </Card.Body>

      {restoreTarget && (
        <Modal
          icon={<RotateCcw size={18} style={{ color: 'var(--avert-accent)' }} />}
          title={t('admin.restoreTitle')}
          subtitle={t('admin.restoreSubtitle', { date: formatDate(restoreTarget.createdAt) })}
          width={460}
          onClose={() => setRestoreTarget(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRestoreTarget(null)}>{t('admin.cancel')}</Button>
              <Button
                variant="danger"
                loading={restaurer.isPending}
                onClick={() => restaurer.mutate(restoreTarget.id, { onSuccess: () => setRestoreTarget(null) })}
              >
                {t('admin.restore')}
              </Button>
            </>
          }
        >
          <p style={{ fontSize: 13, color: 'var(--texte-secondaire)', margin: 0, lineHeight: 1.55 }}>
            {t('admin.restoreBody1')}<strong>{t('admin.restoreBodyStrong1')}</strong>{t('admin.restoreBody2')}<strong>{t('admin.restoreBodyStrong2')}</strong>{t('admin.restoreBody3')}
          </p>
        </Modal>
      )}
    </Card>
  )
}

/** Compose la phrase de planification via i18n à partir des données structurées. */
function planificationLabel(t: TFn, p: { frequence?: string; heure?: string; expression?: string }): string {
  if (p.frequence === 'DAILY' && p.heure) return t('admin.scheduleDaily', { heure: p.heure })
  return p.expression ?? t('admin.scheduleUnknown')
}

function declTypeLabel(type: string): string {
  const ty = (type || '').toUpperCase()
  if (ty === 'AUTOMATIQUE' || ty === 'AUTO') return i18n.t('admin.triggerAuto')
  if (ty === 'MANUELLE')                     return i18n.t('admin.triggerManual')
  return type.toLowerCase()
}

function formatTaille(o?: number | null): string {
  if (!o) return ''
  if (o < 1024)        return `${o} ${i18n.t('admin.unitBytes')}`
  if (o < 1024 * 1024) return `${(o / 1024).toFixed(1)} ${i18n.t('admin.unitKilobytes')}`
  return `${(o / 1024 / 1024).toFixed(1)} ${i18n.t('admin.unitMegabytes')}`
}

function SauvegardeRow({ s, striped, canRestore, onRestore }: {
  s: SauvegardeSysteme; striped: boolean; canRestore: boolean; onRestore: () => void
}) {
  const { t } = useTranslation()
  const tone = s.statut === 'REUSSIE' ? 'success' : s.statut === 'ECHEC' ? 'error' : s.statut === 'EN_COURS' ? 'warning' : 'neutral'
  const restaurable = s.statut === 'REUSSIE' && (s.taille ?? 0) > 0
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '32px 1fr auto auto auto', gap: 'var(--espace-3)', alignItems: 'center',
      padding: 'var(--espace-2) var(--espace-3)',
      background: striped ? 'var(--fond-surface-2)' : 'transparent',
      borderBottom: '1px solid var(--bordure-legere)',
    }}>
      <div style={{ width: 30, height: 30, borderRadius: 'var(--radius-md)', background: 'var(--ap-50)', color: 'var(--ap-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Save size={14} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)' }}>
          {t('admin.backupOfType', { type: declTypeLabel(s.type) })}{s.taille ? ` · ${formatTaille(s.taille)}` : ''}
        </p>
        <p style={{ margin: '1px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>{formatDate(s.createdAt)} · {relative(s.createdAt)}</p>
      </div>
      <StatusPill tone={tone as any}>{labelStatut('synchronisation', s.statut)}</StatusPill>
      {canRestore ? (
        restaurable ? (
          <Button size="sm" variant="outline" leftIcon={<RotateCcw size={12} />} onClick={onRestore}>{t('admin.restore')}</Button>
        ) : (
          <Tooltip label={t('admin.notRestorable')}>
            <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>—</span>
          </Tooltip>
        )
      ) : <span />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
//  ZONE 3 — Volumétrie & journaux
// ════════════════════════════════════════════════════════════════════════════════

function VolumetrieZone({ status, loading, total }: {
  status: ReturnType<typeof useSyncStatus>['data']
  loading: boolean
  total: number
}) {
  const { t } = useTranslation()
  return (
    <Card padding="none" className="saris-grain">
      <Card.Header
        icon={<HardDrive size={14} />}
        title={t('admin.volumetryTitle')}
        subtitle={loading ? t('admin.loading') : t('admin.volumetrySubtitle', { count: total, value: formatNumber(total) })}
      />
      <Card.Body padding="md">
        {loading || !status ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--espace-2)' }}>
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={58} />)}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--espace-2)' }}>
              {status.modules.map(m => (
                <VolChip key={m.module} icon={moduleIcon(m.module)} label={labelModule(m.module)} value={m.count} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--espace-2)', marginTop: 'var(--espace-3)' }}>
              <VolChip icon={<ShieldCheck size={14} />} label={t('admin.auditLogsVol')} value={status.journaux.audit} tone="gold" />
              <VolChip icon={<KeyRound size={14} />} label={t('admin.authenticationsVol')} value={status.journaux.authentifications} tone="neutral" />
            </div>
          </>
        )}
      </Card.Body>
    </Card>
  )
}

function VolChip({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone?: 'gold' | 'neutral' }) {
  const accent = tone === 'gold' ? 'var(--as-700)' : 'var(--ap-700)'
  const bg     = tone === 'gold' ? 'var(--as-50)'  : 'var(--ap-50)'
  return (
    <Tooltip label={`${formatNumber(value)} ${label.toLowerCase()}`}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
        padding: 'var(--espace-2) var(--espace-3)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--bordure-legere)', background: 'var(--fond-surface)',
      }}>
        <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', background: bg, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--texte-primaire)', lineHeight: 1.1 }}>{formatNumber(value)}</p>
          <p style={{ margin: '1px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
        </div>
      </div>
    </Tooltip>
  )
}
