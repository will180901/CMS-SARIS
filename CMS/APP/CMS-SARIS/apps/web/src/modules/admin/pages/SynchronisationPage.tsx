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

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n/config'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RefreshCw, Database, Save, ShieldCheck, FileText, KeyRound, Wifi, WifiOff,
  HardDrive, CheckCircle2, AlertTriangle, Loader2, CloudUpload, Trash2,
  RotateCcw, Users, Stethoscope, Pill, Ambulance, FlaskConical, HardHat, ClipboardList,
  CalendarClock, MonitorSmartphone, Activity, GitMerge, Radio, LayoutGrid, List, Search,
  X, Clock, LogIn, Pencil, User, MessageSquare, Download, ChevronRight, ChevronDown,
} from 'lucide-react'
import {
  PageHeader, Card, Button, StatusPill, Skeleton, EmptyState, Tooltip, Modal, SegmentedTabs,
  Toolbar, DataTableHead, DATA_TABLE_CARD, DATA_TD_PADDING, dataRowStyle, PaginationBar,
} from '@/components/saris'
import type { SegmentedTab } from '@/components/saris'
import { toast } from '@workspace/ui/components/sonner'
import { usePermissions } from '@/hooks/usePermissions'
import { usePagination } from '@/hooks/usePagination'
import { useRowsPerPage } from '@/hooks/useRowsPerPage'
import { formatDateTime, formatNumber } from '@/lib/intl'
import { ListePrintSheet, type ColonneExport } from '@/components/print/ListePrintSheet'
import { formatDuree } from '@/lib/duree'
import { labelModule, labelStatut, labelAction, labelRole } from '@/config/labels'
import { useConnectivityStore } from '@/stores/connectivity.store'
import { isDesktop } from '@/lib/desktop'
import { BandeauEtatSync, SEUIL_MUET_MS, type EtatSync } from '../components/BandeauEtatSync'
import { CePosteCard } from '../components/CePosteCard'
import { useSyncStore } from '@/stores/sync.store'
import { syncCycle, listMutations, purgeMutations, retryRejected } from '@/lib/sync'
import {
  useSyncStatus, useRestaurerSauvegarde,
} from '../hooks/useAdmin'
import {
  useSyncStatus as useDataSyncStatus, useSyncRun, useSyncSupervision, useSyncActivite, usePosteDetail, useMasquerPoste, useRenamePoste,
} from '../hooks/useSync'
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
  messagerie:       <MessageSquare size={14} />,
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

export function SynchronisationPage() {
  const { t } = useTranslation()
  const { data: sup, isLoading: lsup } = useSyncSupervision()

  // État du parc, calculé une fois ici et passé au bandeau : la page entière raisonne
  // sur les mêmes chiffres que sa phrase d'accroche.
  //
  // `maintenant` est figé au montage plutôt que relu à chaque rendu : lire l'horloge
  // pendant le rendu le rend impur (react-hooks/purity). Les données se rafraîchissent
  // de toute façon par le flux temps réel, qui remonte un nouvel objet — le calcul se
  // refait alors avec une horloge fraîche.
  const [maintenant] = useState(() => Date.now())
  const postes = useMemo(() => sup?.postes ?? [], [sup?.postes])
  const conflits = useMemo(() => sup?.conflits ?? [], [sup?.conflits])
  const etat = useMemo<EtatSync>(() => ({
    total:       postes.length,
    enLigne:     postes.filter(p => p.enLigne).length,
    // Même prédicat que la pastille « À surveiller » de la liste, à dessein : le bandeau
    // annonce un nombre, la liste doit contenir exactement ces postes-là.
    aSurveiller: postes.filter(p => aBesoinAttention(p, maintenant)).length,
    conflits:    conflits.length,
  }), [postes, conflits, maintenant])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <PageHeader
        icon={<RefreshCw size={18} />}
        title={t('admin.syncPageTitle')}
        subtitle={t('admin.syncPageSubtitle')}
        tone="neutral"
      />

      {/* Écran UNIQUE, ordonné par urgence décroissante — plus d'onglets de premier
          niveau. Superviser, c'est répondre à « est-ce que tout va bien ? » : la réponse
          doit être lisible avant le premier clic, pas cachée derrière deux niveaux de
          navigation. Sauvegardes et volumétrie sont partis vers « Base de données » :
          ce sont des sujets de stockage, pas de synchronisation. */}
      <div style={{ padding: 'var(--espace-4) var(--espace-6) var(--espace-6)', display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>

        {/* 1. L'état, en une phrase */}
        <BandeauEtatSync etat={etat} loading={lsup} />

        {/* 2. Ce poste-ci — DESKTOP uniquement : l'application y est elle-même une
               machine du parc, et sa propre situation prime sur celle des autres.
               Son IDENTITÉ d'abord (nom donné à l'installation, site, réseau), puis
               l'état de sa synchronisation. */}
        {isDesktop && <CePosteCard />}
        {isDesktop && <DataSyncZone />}

        {/* 3. Le parc : postes, activité, conflits */}
        <SupervisionZone />

        {/* 4. Le terrain hors-ligne (file d'attente locale) */}
        {isDesktop && <SyncTerrainZone />}

        {/* Sauvegardes et volumétrie sont parties vers « Base de données » : restaurer
            une sauvegarde ou lire des compteurs de stockage n'a rien à voir avec
            surveiller un parc de postes. Les mêler obligeait à traverser un tableau de
            bord d'exploitation pour un geste d'administration de base. */}
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

type SupTab = 'postes' | 'activite' | 'conflits'
type PosteFiltre = 'attention' | 'tous' | 'ligne' | 'horsligne'
type PosteVue = 'grid' | 'list'

/**
 * Au-delà de ce nombre de postes, la liste complète cesse d'informer : sur un parc de
 * 200 machines, 190 vont bien un jour normal, et les faire défiler revient à ranger
 * proprement du bruit. On bascule donc par défaut sur les seules anomalies.
 *
 * En deçà, l'inventaire garde du sens : avec cinq postes, on veut les voir tous les cinq,
 * pas devoir cliquer pour les afficher.
 */
const SEUIL_PARC_IMPORTANT = 12

/**
 * Un poste « à surveiller » est un poste dont le silence n'a pas d'explication normale :
 *   - muet : plus aucune nouvelle depuis des heures alors qu'il devrait travailler ;
 *   - jamais synchronisé : enregistré, mais qui n'a jamais rien remonté.
 *
 * Un poste simplement hors ligne n'en fait PAS partie — une machine éteinte le soir ou
 * sur un site fermé est un fonctionnement attendu, pas un incident.
 */
function aBesoinAttention(p: SyncSupervisionPoste, maintenant: number): boolean {
  if (p.enLigne) return false
  if (!p.derniereSyncAt) return true
  return maintenant - new Date(p.derniereSyncAt).getTime() > SEUIL_MUET_MS
}

function SupervisionZone() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canExecute = has('synchronisation.execute')
  const { data, isLoading } = useSyncSupervision()
  const postes   = data?.postes   ?? []
  const conflits = data?.conflits ?? []
  const enLigne  = postes.filter(p => p.enLigne).length

  const [supTab, setSupTab] = useState<SupTab>('postes')

  // ── Journal d'activité : état des filtres, requête côté serveur ───────────────
  // Il ne vit plus dans la charge de supervision : le parc en produit des milliers de
  // lignes par jour, et l'onglet n'est même pas ouvert la plupart du temps. `enabled`
  // fait que rien n'est demandé tant qu'on ne l'affiche pas.
  const [actPage, setActPage]     = useState(1)
  const [actTaille, setActTaille] = useState<number | null>(null)
  const [actPoste, setActPoste]   = useState('')
  const [actStatut, setActStatut] = useState('')
  const lignesParDefaut = useRowsPerPage()
  const taille = actTaille ?? lignesParDefaut
  const { data: activite, isFetching: actLoading } = useSyncActivite(
    {
      page: actPage,
      pageSize: taille,
      posteId: actPoste || undefined,
      statut: actStatut || undefined,
    },
    supTab === 'activite',
  )
  const journaux = activite?.items ?? []
  // Tout changement de filtre ramène à la première page : rester page 7 après avoir
  // restreint à un poste qui n'a que 12 entrées afficherait un tableau vide.
  const filtrer = (maj: () => void) => { maj(); setActPage(1) }

  // ── Extraction PDF ────────────────────────────────────────────────────────
  // Mêmes colonnes qu'à l'écran ; l'onglet actif décide du jeu imprimé.
  const [openExport, setOpenExport] = useState(false)
  const colonnesActivite = useMemo<ColonneExport<SyncSupervisionJournal>[]>(() => [
    { libelle: t('admin.colPoste'),     valeur: j => j.poste },
    { libelle: t('admin.colStatus'),    valeur: j => journalStatutLabel(t, j.statut) },
    { libelle: t('admin.colStarted'),   valeur: j => formatDateTime(j.startedAt) },
    { libelle: t('admin.colMutations'), valeur: j => formatNumber(j.nbMutations), align: 'right' },
    { libelle: t('admin.colConflicts'), valeur: j => formatNumber(j.nbConflits),  align: 'right' },
  ], [t])
  const colonnesConflits = useMemo<ColonneExport<SyncSupervisionConflit>[]>(() => [
    { libelle: t('admin.colEntity'), valeur: c => humanizeCode(c.entiteType) },
    { libelle: t('admin.colType'),   valeur: c => humanizeCode(c.typeConflit) },
    { libelle: t('admin.colDate'),   valeur: c => formatDateTime(c.createdAt) },
    { libelle: t('admin.colStatus'), valeur: () => t('admin.supConflictBadge'), align: 'right' },
  ], [t])

  const supTabs: SegmentedTab[] = [
    { key: 'postes',   label: t('admin.supPostesTitle'),   icon: <MonitorSmartphone size={13} />, badge: postes.length || undefined },
    { key: 'activite', label: t('admin.supActivityTitle'), icon: <Activity size={13} /> },
    { key: 'conflits', label: t('admin.supConflictsTitle'), icon: <GitMerge size={13} />, badge: conflits.length || undefined },
  ]

  return (
    <Card padding="none">
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
        <div style={{ marginBottom: 'var(--espace-4)', display: 'flex', alignItems: 'center', gap: 'var(--espace-3)', flexWrap: 'wrap' }}>
          <SegmentedTabs value={supTab} onChange={(k) => setSupTab(k as SupTab)} tabs={supTabs} size="sm" aria-label={t('admin.supTitle')} />
          {supTab !== 'postes' && (
            <Button size="sm" variant="outline" style={{ marginLeft: 'auto' }} onClick={() => setOpenExport(true)}>
              <Download size={14} /> {t('common.exporter', { defaultValue: 'Exporter' })}
            </Button>
          )}
        </div>

        {supTab === 'postes' && <PostesSection postes={postes} enLigne={enLigne} loading={isLoading} canExecute={canExecute} />}
        {supTab === 'activite' && (
          <ActiviteTable
            journaux={journaux}
            total={activite?.total ?? 0}
            page={actPage} pageSize={taille}
            onPage={setActPage}
            onPageSize={(n) => filtrer(() => setActTaille(n))}
            postes={postes}
            posteId={actPoste} onPosteId={(v) => filtrer(() => setActPoste(v))}
            statut={actStatut}  onStatut={(v) => filtrer(() => setActStatut(v))}
            loading={actLoading}
          />
        )}
        {supTab === 'conflits' && <ConflitsTable conflits={conflits} loading={isLoading} />}
      </Card.Body>

      {openExport && (supTab === 'activite' ? (
        <ListePrintSheet<SyncSupervisionJournal>
          rootId="export-sync-activite"
          titre={t('admin.supActivityTitle')}
          /* L'export porte sur ce qui est À L'ÉCRAN — page et filtres courants. Avec un
             journal de plusieurs milliers de lignes, « tout exporter » n'aurait pas de
             sens ; on le dit dans le sous-titre plutôt que de laisser croire au contraire. */
          sousTitre={t('admin.supExportPortee', { count: journaux.length, total: activite?.total ?? 0 })}
          lignes={journaux}
          cleDe={j => j.id}
          colonnes={colonnesActivite}
          onClose={() => setOpenExport(false)}
        />
      ) : (
        <ListePrintSheet<SyncSupervisionConflit>
          rootId="export-sync-conflits"
          titre={t('admin.supConflictsTitle')}
          sousTitre={`${conflits.length} conflit${conflits.length > 1 ? 's' : ''}`}
          lignes={conflits}
          cleDe={c => c.id}
          colonnes={colonnesConflits}
          onClose={() => setOpenExport(false)}
        />
      ))}
    </Card>
  )
}

// ── Onglet Postes : recherche + filtre en ligne/hors ligne + bascule grille/liste ──

function PostesSection({ postes, enLigne, loading, canExecute }: {
  postes: SyncSupervisionPoste[]; enLigne: number; loading: boolean; canExecute: boolean
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  // `null` = l'opérateur n'a pas encore choisi : le filtre découle alors de la taille du
  // parc. Stocker directement un défaut ne marcherait pas — l'état s'initialiserait
  // pendant le chargement, avec 0 poste, et resterait figé sur ce mauvais calcul.
  const [filtreChoisi, setFiltreChoisi] = useState<PosteFiltre | null>(null)
  const [vue, setVue] = useState<PosteVue>('grid')
  const [detailId, setDetailId] = useState<string | null>(null)
  const masquer = useMasquerPoste()
  // Horloge figée au montage : la relire à chaque rendu le rendrait impur. Les données
  // temps réel remontent un nouvel objet, le calcul se refait alors avec l'heure fraîche.
  const [maintenant] = useState(() => Date.now())

  const aSurveiller = postes.filter(p => aBesoinAttention(p, maintenant))
  const horsLigne = postes.length - enLigne

  // Sur un grand parc, l'écran s'ouvre sur ce qui réclame une action plutôt que sur
  // l'inventaire complet. Dès que l'opérateur touche une pastille, son choix l'emporte.
  const filtre: PosteFiltre = filtreChoisi
    ?? (postes.length > SEUIL_PARC_IMPORTANT ? 'attention' : 'tous')

  const pillFiltres: { key: PosteFiltre; label: string; count: number }[] = [
    { key: 'attention', label: t('admin.supFilterAttention'), count: aSurveiller.length },
    { key: 'tous',      label: t('admin.supFilterAll'), count: postes.length },
    { key: 'ligne',     label: t('admin.supOnline'),    count: enLigne },
    { key: 'horsligne', label: t('admin.supOffline'),   count: horsLigne },
  ]

  const filtered = postes.filter(p => {
    if (filtre === 'attention' && !aBesoinAttention(p, maintenant)) return false
    if (filtre === 'ligne' && !p.enLigne) return false
    if (filtre === 'horsligne' && p.enLigne) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const nom  = `${p.libelle} ${p.utilisateurNom ?? ''}`.toLowerCase()
      const role = p.utilisateurRole ? labelRole(p.utilisateurRole).toLowerCase() : ''
      if (!nom.includes(q) && !role.includes(q)) return false
    }
    return true
  })

  const pagination = usePagination(filtered, useRowsPerPage())

  // ── Regroupement par site ────────────────────────────────────────────────────
  // Un humain ne dit pas « poste-47 est muet », il dit « Nkayi ne remonte plus ». Le site
  // est l'unité dans laquelle on raisonne, et replier les groupes sains ramène un parc de
  // 200 machines à une dizaine de lignes.
  const groupes = useMemo(() => {
    const parSite = new Map<string, { libelle: string; postes: SyncSupervisionPoste[] }>()
    for (const p of filtered) {
      const cle = p.siteId || '__sans_site'
      let g = parSite.get(cle)
      if (!g) { g = { libelle: p.siteLibelle ?? t('admin.supSiteInconnu'), postes: [] }; parSite.set(cle, g) }
      g.postes.push(p)
    }
    return [...parSite.entries()]
      .map(([id, g]) => ({ id, ...g, aSurveiller: g.postes.filter(p => aBesoinAttention(p, maintenant)).length }))
      // Les sites qui réclament une action remontent ; à égalité, ordre alphabétique
      // pour que la liste reste stable d'un rafraîchissement à l'autre.
      .sort((a, b) => b.aSurveiller - a.aSurveiller || a.libelle.localeCompare(b.libelle))
  }, [filtered, maintenant, t])

  // Le regroupement ne s'active que s'il apporte quelque chose : plusieurs sites, et assez
  // de postes pour que la liste à plat devienne pénible. Sur 4 anomalies réparties sur
  // 3 sites, des en-têtes de groupe ajouteraient du bruit sans rien clarifier — le nom du
  // site figure alors directement sur chaque carte.
  const grouper = groupes.length > 1 && filtered.length > SEUIL_PARC_IMPORTANT

  // Repli : ouvert par défaut si le site a des anomalies, replié sinon. Un clic sur
  // l'en-tête inscrit un choix explicite, qui l'emporte ensuite.
  const [ouvertures, setOuvertures] = useState<Record<string, boolean>>({})
  const estOuvert = (g: { id: string; aSurveiller: number }) => ouvertures[g.id] ?? g.aSurveiller > 0

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--espace-2)' }}>
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={58} />)}
      </div>
    )
  }
  if (postes.length === 0) {
    return <EmptyState icon={<MonitorSmartphone size={18} />} title={t('admin.supNoPosteTitle')} description={t('admin.supNoPosteDesc')} variant="subtle" />
  }

  return (
    <div>
      <Card style={{ marginBottom: 'var(--espace-3)' }}>
        <Toolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('admin.supSearchPlaceholder')}
          filters={
            <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 'var(--radius-md)', background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)' }}>
              {pillFiltres.map(f => (
                <button
                  key={f.key} type="button" onClick={() => setFiltreChoisi(f.key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                    fontSize: 'var(--font-size-caption)', fontWeight: 600,
                    background: filtre === f.key ? 'var(--fond-surface)' : 'transparent',
                    color:      filtre === f.key ? 'var(--texte-primaire)' : 'var(--texte-tertiaire)',
                    boxShadow:  filtre === f.key ? 'var(--ombre-1)' : 'none',
                  }}
                >
                  {f.label}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 16, height: 16, padding: '0 4px', borderRadius: 9999,
                    fontSize: 10, fontWeight: 700,
                    background: filtre === f.key ? 'var(--ap-100)' : 'var(--fond-surface-2)',
                    color:      filtre === f.key ? 'var(--ap-700)' : 'var(--texte-tertiaire)',
                  }}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          }
          actions={
            <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 'var(--radius-md)', background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)' }}>
              <Tooltip label={t('admin.supViewGrid')}>
                <button type="button" onClick={() => setVue('grid')} aria-label={t('admin.supViewGrid')} aria-pressed={vue === 'grid'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                    background: vue === 'grid' ? 'var(--fond-surface)' : 'transparent',
                    color:      vue === 'grid' ? 'var(--ap-600)' : 'var(--texte-tertiaire)',
                    boxShadow:  vue === 'grid' ? 'var(--ombre-1)' : 'none',
                  }}
                ><LayoutGrid size={14} /></button>
              </Tooltip>
              <Tooltip label={t('admin.supViewList')}>
                <button type="button" onClick={() => setVue('list')} aria-label={t('admin.supViewList')} aria-pressed={vue === 'list'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 26, height: 26, borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                    background: vue === 'list' ? 'var(--fond-surface)' : 'transparent',
                    color:      vue === 'list' ? 'var(--ap-600)' : 'var(--texte-tertiaire)',
                    boxShadow:  vue === 'list' ? 'var(--ombre-1)' : 'none',
                  }}
                ><List size={14} /></button>
              </Tooltip>
            </div>
          }
        />
      </Card>

      {filtered.length === 0 ? (
        // Zéro anomalie n'est pas « aucun résultat » : c'est la bonne nouvelle que
        // l'écran est censé annoncer. On le dit franchement, au lieu du vide habituel.
        filtre === 'attention' && !search.trim() ? (
          <EmptyState
            icon={<CheckCircle2 size={18} />}
            title={t('admin.supAllHealthyTitle')}
            description={t('admin.supAllHealthyDesc', { count: postes.length })}
            variant="subtle"
          />
        ) : (
          <EmptyState icon={<Search size={18} />} title={t('admin.supNoMatchTitle')} description={t('admin.supNoMatchDesc')} variant="subtle" />
        )
      ) : grouper ? (
        // Vue groupée : le repli remplace la pagination. Douze sites repliés tiennent en
        // douze lignes — on n'a plus besoin de tourner les pages pour balayer le parc.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
          {groupes.map(g => {
            const ouvert = estOuvert(g)
            return (
              <div key={g.id}>
                <button
                  type="button"
                  onClick={() => setOuvertures(o => ({ ...o, [g.id]: !ouvert }))}
                  aria-expanded={ouvert}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', width: '100%',
                    padding: 'var(--espace-2) var(--espace-3)', borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--bordure-legere)',
                    background: g.aSurveiller > 0 ? 'var(--avert-fond)' : 'var(--fond-surface-2)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {ouvert ? <ChevronDown size={15} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
                          : <ChevronRight size={15} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />}
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 700,
                    color: g.aSurveiller > 0 ? 'var(--avert-texte)' : 'var(--texte-primaire)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {g.libelle}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', flexShrink: 0 }}>
                    {t('admin.supGroupePostes', { count: g.postes.length })}
                  </span>
                  {g.aSurveiller > 0 && (
                    <StatusPill tone="warning" size="sm">
                      {t('admin.supGroupeASurveiller', { count: g.aSurveiller })}
                    </StatusPill>
                  )}
                </button>

                {ouvert && (
                  <div style={{
                    marginTop: 'var(--espace-2)', paddingLeft: 'var(--espace-5)',
                    ...(vue === 'grid'
                      ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--espace-2)' }
                      : { display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }),
                  }}>
                    {g.postes.map(p => (
                      <PosteCard
                        key={p.id} poste={p} masquerSite
                        onOpenDetail={() => setDetailId(p.id)}
                        onMasquer={canExecute ? () => masquer.mutate(p.id, {
                          onSuccess: () => toast.success(t('admin.supPosteRemoved')),
                        }) : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <>
          <div style={vue === 'grid'
            ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--espace-2)' }
            : { display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}
          >
            {pagination.pageData.map(p => (
              <PosteCard
                key={p.id} poste={p}
                onOpenDetail={() => setDetailId(p.id)}
                onMasquer={canExecute ? () => masquer.mutate(p.id, {
                  onSuccess: () => toast.success(t('admin.supPosteRemoved')),
                }) : undefined}
              />
            ))}
          </div>
          <div style={{ marginTop: 'var(--espace-3)' }}>
            <PaginationBar {...pagination} />
          </div>
        </>
      )}

      {/* Le reste du parc, replié derrière une ligne discrète. Ce qui va bien ne doit
          pas disparaître — il ne doit simplement pas occuper l'écran par défaut. */}
      {filtre === 'attention' && postes.length > aSurveiller.length && (
        <button
          type="button"
          onClick={() => setFiltreChoisi('tous')}
          style={{
            display: 'block', width: '100%', marginTop: 'var(--espace-3)',
            padding: 'var(--espace-2)', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)',
            textAlign: 'center',
          }}
        >
          {t('admin.supShowHealthy', { count: postes.length - aSurveiller.length })}
        </button>
      )}

      {detailId && <PosteDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}

/** `masquerSite` : à l'intérieur d'un groupe de site, répéter le nom du site sur chaque
 *  carte n'apprend rien — l'en-tête du groupe le dit déjà. */
function PosteCard({ poste, onOpenDetail, onMasquer, masquerSite }: {
  poste: SyncSupervisionPoste; onOpenDetail: () => void; onMasquer?: () => void; masquerSite?: boolean
}) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onOpenDetail}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail() } }}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
        padding: 'var(--espace-2) var(--espace-3)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--bordure-legere)', background: 'var(--fond-surface)',
        cursor: 'pointer',
      }}
    >
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
          {/* Nom du POSTE lui-même (identité stable) — le dernier utilisateur connecté est
              affiché en second, à titre indicatif seulement. */}
          {poste.libelle}
        </p>
        <p style={{ margin: '1px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {/* Le site vient EN PREMIER : hors regroupement, savoir où se trouve la machine
              prime sur savoir qui s'en est servi en dernier. */}
          {!masquerSite && poste.siteLibelle && `${poste.siteLibelle} · `}
          {poste.utilisateurNom && `${poste.utilisateurNom} · `}
          {t('admin.supLastSync')} · {relative(poste.derniereSyncAt)}
        </p>
      </div>
      <StatusPill tone={poste.enLigne ? 'success' : 'neutral'} size="sm">
        {poste.enLigne ? t('admin.supOnline') : t('admin.supOffline')}
      </StatusPill>

      {onMasquer && hovered && (
        <Tooltip label={t('admin.supPosteRemove')}>
          <button
            type="button"
            aria-label={t('admin.supPosteRemove')}
            onClick={(e) => { e.stopPropagation(); onMasquer() }}
            style={{
              position: 'absolute', top: -7, right: -7, zIndex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--bordure-legere)',
              background: 'var(--fond-surface)', color: 'var(--erreur-accent)',
              boxShadow: 'var(--ombre-1)', cursor: 'pointer',
            }}
          >
            <X size={12} />
          </button>
        </Tooltip>
      )}
    </div>
  )
}

/** Modale de détail d'un poste : identité (renommable) + dernière session connectée. */
function PosteDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation()
  const { data, isLoading } = usePosteDetail(id)

  return (
    <Modal
      icon={<MonitorSmartphone size={18} />}
      title={data?.libelle ?? t('admin.supPosteDetailTitle')}
      width={440}
      onClose={onClose}
    >
      {isLoading || !data ? (
        <div>{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={48} style={{ marginBottom: 6 }} />)}</div>
      ) : (
        <>
          <RenamePosteField posteId={id} currentLibelle={data.libelle} />
          <DetailRow
            icon={<span style={{ width: 8, height: 8, borderRadius: '50%', display: 'block', background: data.enLigne ? 'var(--succes-accent)' : 'var(--texte-tertiaire)' }} />}
            label={t('admin.supDetailStatus')}
            value={data.enLigne ? t('admin.supOnline') : t('admin.supOffline')}
          />
          {data.utilisateurNom && (
            <DetailRow
              icon={<User size={14} />}
              label={t('admin.supDetailLastUser')}
              value={data.utilisateurRole ? `${data.utilisateurNom} · ${labelRole(data.utilisateurRole)}` : data.utilisateurNom}
            />
          )}
          <DetailRow
            icon={<LogIn size={14} />}
            label={t('admin.supDetailLastConnection')}
            value={data.derniereSyncAt
              ? formatDateTime(data.derniereSyncAt, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : t('admin.relativeNever')}
          />
          <DetailRow
            icon={<Clock size={14} />}
            label={t('admin.supDetailSessionDuration')}
            value={data.sessionDebut && data.sessionFin
              ? formatDuree(data.sessionDebut, data.sessionFin, { precis: true })
              : '—'}
          />
        </>
      )}
    </Modal>
  )
}

/** Champ de renommage du poste — nom UNIQUE par site, validé côté serveur. */
function RenamePosteField({ posteId, currentLibelle }: { posteId: string; currentLibelle: string }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(currentLibelle)
  const rename = useRenamePoste()

  useEffect(() => { setValue(currentLibelle) }, [currentLibelle])

  async function save() {
    const trimmed = value.trim()
    if (!trimmed) { toast.error(t('admin.supPosteRenameRequired')); return }
    if (trimmed === currentLibelle) { setEditing(false); return }
    try {
      await rename.mutateAsync({ id: posteId, libelle: trimmed })
      toast.success(t('admin.supPosteRenamed'))
      setEditing(false)
    } catch {
      toast.error(t('admin.supPosteRenameDuplicate'))
    }
  }
  function cancel() { setValue(currentLibelle); setEditing(false) }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', marginBottom: 'var(--espace-3)' }}>
      {editing ? (
        <>
          <input
            value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') cancel() }}
            style={{
              flex: 1, padding: '7px 10px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--bordure-normale)', fontSize: 'var(--font-size-body-sm)',
              color: 'var(--texte-primaire)', background: 'var(--fond-surface)',
            }}
          />
          <Button size="sm" onClick={() => void save()} disabled={rename.isPending}>{t('admin.save')}</Button>
          <Button size="sm" variant="ghost" onClick={cancel}>{t('admin.cancel')}</Button>
        </>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} style={{ gap: 6 }}>
          <Pencil size={13} /> {t('admin.supPosteRename')}
        </Button>
      )}
    </div>
  )
}

function DetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
      padding: 'var(--espace-3)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--bordure-legere)', background: 'var(--fond-surface-2)',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 'var(--radius-md)', flexShrink: 0,
        background: 'var(--ap-50)', color: 'var(--ap-600)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>{label}</p>
        {value && <p style={{ margin: '1px 0 0', fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)' }}>{value}</p>}
      </div>
    </div>
  )
}

// ── Onglet Activité récente : tableau propre (comme les autres pages) ────────

/**
 * Journal d'activité. La pagination est SERVEUR : `journaux` ne contient que la page
 * demandée, et `total` dit combien d'entrées correspondent aux filtres. On ne peut donc
 * pas s'appuyer sur usePagination, qui découpe un tableau déjà complet — l'objet passé à
 * PaginationBar est construit à la main à partir de ce que le serveur a répondu.
 */
function ActiviteTable({
  journaux, total, page, pageSize, onPage, onPageSize,
  postes, posteId, onPosteId, statut, onStatut, loading,
}: {
  journaux: SyncSupervisionJournal[]; total: number
  page: number; pageSize: number
  onPage: (p: number) => void; onPageSize: (n: number) => void
  postes: SyncSupervisionPoste[]
  posteId: string; onPosteId: (v: string) => void
  statut: string;  onStatut: (v: string) => void
  loading: boolean
}) {
  const { t } = useTranslation()

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pagination = {
    page, pageSize, totalPages, total,
    // `start` est un DÉCALAGE à partir de 0 : PaginationBar affiche `start + 1`.
    // Y mettre le numéro de la première ligne décalerait tout d'un cran (« 2 – 10 »).
    start: (page - 1) * pageSize,
    end:   Math.min(page * pageSize, total),
    setPage: onPage, setPageSize: onPageSize,
    goFirst: () => onPage(1),
    goLast:  () => onPage(totalPages),
    goPrev:  () => onPage(Math.max(1, page - 1)),
    goNext:  () => onPage(Math.min(totalPages, page + 1)),
    canGoPrev: page > 1,
    canGoNext: page < totalPages,
  }

  const filtreActif = !!posteId || !!statut

  // Filtrer suppose qu'il y ait de quoi filtrer. Sans aucun poste ni aucune entrée, la
  // barre n'offre qu'un menu vide et deux boutons sans effet — du décor. Elle réapparaît
  // dès qu'un filtre est posé, sans quoi on se retrouverait enfermé dans une sélection
  // trop restrictive sans moyen d'en sortir.
  const filtrable = postes.length > 0 || total > 0 || filtreActif

  // Les filtres restent affichés pendant le chargement et même si la page revient vide,
  // pour cette même raison.
  const barreFiltres = !filtrable ? null : (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
      marginBottom: 'var(--espace-3)', flexWrap: 'wrap',
    }}>
      <select
        value={posteId}
        onChange={(e) => onPosteId(e.target.value)}
        aria-label={t('admin.supFiltrePoste')}
        style={{
          height: 30, maxWidth: 260, padding: '0 var(--espace-2)',
          borderRadius: 'var(--radius-md)', border: '1px solid var(--bordure-legere)',
          background: 'var(--fond-surface)', color: 'var(--texte-primaire)',
          fontSize: 'var(--font-size-caption)', cursor: 'pointer',
        }}
      >
        <option value="">{t('admin.supFiltreTousPostes')}</option>
        {postes.map(p => <option key={p.id} value={p.id}>{p.libelle}</option>)}
      </select>

      <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 'var(--radius-md)', background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)' }}>
        {[
          { key: '',         label: t('admin.supFiltreTout') },
          { key: 'CONFLITS', label: t('admin.supConflictsTitle') },
        ].map(f => (
          <button
            key={f.key || 'tout'} type="button" onClick={() => onStatut(f.key)}
            style={{
              padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
              fontSize: 'var(--font-size-caption)', fontWeight: 600,
              background: statut === f.key ? 'var(--fond-surface)' : 'transparent',
              color:      statut === f.key ? 'var(--texte-primaire)' : 'var(--texte-tertiaire)',
              boxShadow:  statut === f.key ? 'var(--ombre-1)' : 'none',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <span style={{ marginLeft: 'auto', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
        {t('admin.supActiviteTotal', { count: total })}
      </span>
    </div>
  )

  if (loading && journaux.length === 0) {
    return (
      <>
        {barreFiltres}
        <div>{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={40} style={{ marginBottom: 6 }} />)}</div>
      </>
    )
  }
  if (journaux.length === 0) {
    return (
      <>
        {barreFiltres}
        <EmptyState
          icon={<Activity size={18} />}
          title={filtreActif ? t('admin.supNoMatchTitle') : t('admin.supNoActivityTitle')}
          description={filtreActif ? t('admin.supNoActiviteFiltreDesc') : t('admin.supNoActivityDesc')}
          variant="subtle"
        />
      </>
    )
  }
  return (
    <>
      {barreFiltres}
      <div style={DATA_TABLE_CARD}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <DataTableHead columns={[
            { label: t('admin.colPoste') },
            { label: t('admin.colStatus'), width: 110 },
            { label: t('admin.colStarted'), width: 140 },
            { label: t('admin.colMutations'), align: 'right', width: 110 },
            { label: t('admin.colConflicts'), align: 'right', width: 100 },
          ]} />
          <tbody>
            {journaux.map((j, i) => {
              const tone = JOURNAL_STATUT_TONE[(j.statut || '').toUpperCase()] ?? 'neutral'
              return (
                <tr key={j.id} style={dataRowStyle(i % 2 === 1, false)}>
                  <td style={{ padding: DATA_TD_PADDING }}>
                    <span style={{ fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)' }}>{j.poste}</span>
                  </td>
                  <td style={{ padding: DATA_TD_PADDING }}>
                    <StatusPill tone={tone as any} size="sm">{journalStatutLabel(t, j.statut)}</StatusPill>
                  </td>
                  <td style={{ padding: DATA_TD_PADDING }}>
                    <span style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>{relative(j.startedAt)}</span>
                  </td>
                  <td style={{ padding: DATA_TD_PADDING, textAlign: 'right' }}>
                    <span style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>{formatNumber(j.nbMutations)}</span>
                  </td>
                  <td style={{ padding: DATA_TD_PADDING, textAlign: 'right' }}>
                    <span style={{ fontSize: 'var(--font-size-body-sm)', color: j.nbConflits > 0 ? 'var(--avert-accent)' : 'var(--texte-tertiaire)', fontWeight: j.nbConflits > 0 ? 700 : 400 }}>
                      {formatNumber(j.nbConflits)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 'var(--espace-3)' }}>
        <PaginationBar {...pagination} />
      </div>
    </>
  )
}

// ── Onglet Conflits : tableau propre (comme les autres pages) ────────────────

function ConflitsTable({ conflits, loading }: { conflits: SyncSupervisionConflit[]; loading: boolean }) {
  const { t } = useTranslation()
  const pagination = usePagination(conflits, useRowsPerPage())
  if (loading) {
    return <div>{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} height={40} style={{ marginBottom: 6 }} />)}</div>
  }
  if (conflits.length === 0) {
    return <EmptyState icon={<CheckCircle2 size={18} />} title={t('admin.supNoConflictTitle')} description={t('admin.supNoConflictDesc')} variant="subtle" />
  }
  return (
    <>
      <div style={DATA_TABLE_CARD}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <DataTableHead columns={[
            { label: t('admin.colEntity') },
            { label: t('admin.colType') },
            { label: t('admin.colDate'), width: 160 },
            { label: t('admin.colStatus'), align: 'right', width: 110 },
          ]} />
          <tbody>
            {pagination.pageData.map((c, i) => (
              <tr key={c.id} style={dataRowStyle(i % 2 === 1, false)}>
                <td style={{ padding: DATA_TD_PADDING }}>
                  <span style={{ fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)' }}>{humanizeCode(c.entiteType)}</span>
                </td>
                <td style={{ padding: DATA_TD_PADDING }}>
                  <span style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>{humanizeCode(c.typeConflit)}</span>
                </td>
                <td style={{ padding: DATA_TD_PADDING }}>
                  <span style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>{relative(c.createdAt)}</span>
                </td>
                <td style={{ padding: DATA_TD_PADDING, textAlign: 'right' }}>
                  <StatusPill tone="warning" size="sm">{t('admin.supConflictBadge')}</StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 'var(--espace-3)' }}>
        <PaginationBar {...pagination} />
      </div>
    </>
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
    <Card padding="none">
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
  // Badge + garde du bouton « Forcer la synchro » : DESKTOP uniquement (cf. TopHeader.tsx
  // pour le détail — retiré du web le 2026-07-05, un onglet déjà ouvert peut tourner sur un
  // ancien bundle JS tant que le service worker n'a pas fini sa mise à jour PWA).
  const centralOnline = useConnectivityStore(s => s.online)
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
    <Card padding="none">
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
          {isDesktop && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
              padding: '5px 11px', borderRadius: 9999,
              background: centralOnline ? 'var(--succes-fond)' : 'var(--avert-fond)',
              color:      centralOnline ? 'var(--succes-texte)' : 'var(--avert-texte)',
            }}>
              {centralOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
              {centralOnline ? t('admin.online') : t('admin.offline')}
            </span>
          )}

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
                disabled={(isDesktop && !centralOnline) || syncing || sync.isPending}
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

export function SauvegardesZone({ sauvegardes, loading, canRestore, planification }: {
  sauvegardes: SauvegardeSysteme[]
  loading: boolean
  canRestore: boolean
  planification?: { actif: boolean; frequence?: string; heure?: string; expression?: string; retention: number }
}) {
  const { t } = useTranslation()
  const derniere = sauvegardes[0]
  const restaurer = useRestaurerSauvegarde()
  const [restoreTarget, setRestoreTarget] = useState<SauvegardeSysteme | null>(null)
  // La sauvegarde automatique tourne tous les jours : cette liste grossit toute seule,
  // sans que personne ne l'alimente. Elle était rendue d'un bloc, jusqu'aux 50 entrées
  // renvoyées par le serveur — sept semaines à faire défiler pour atteindre la dernière.
  const pagination = usePagination(sauvegardes, useRowsPerPage())

  return (
    <Card padding="none">
      <Card.Header
        icon={<Save size={14} />}
        title={t('admin.backupsTitle')}
        subtitle={t('admin.backupsSubtitle', { count: sauvegardes.length })}
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
          />
        ) : (
          <>
            <div style={{ border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              {pagination.pageData.map((s, i) => (
                <SauvegardeRow key={s.id} s={s} striped={i % 2 === 1}
                  canRestore={canRestore} onRestore={() => setRestoreTarget(s)} />
              ))}
            </div>
            <div style={{ marginTop: 'var(--espace-3)' }}>
              <PaginationBar {...pagination} />
            </div>
          </>
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

export function VolumetrieZone({ status, loading, total }: {
  status: ReturnType<typeof useSyncStatus>['data']
  loading: boolean
  total: number
}) {
  const { t } = useTranslation()
  return (
    <Card padding="none">
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
