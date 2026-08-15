/**
 * UtilisateursPage — administration des PERSONNES du centre.
 *
 * Une ligne = une personne, qu'elle puisse se connecter ou non.
 *
 * Le système garde deux objets distincts en base, et c'est nécessaire :
 *   • `PersonnelMedical` — l'identité professionnelle (nom, matricule, métier).
 *     C'est elle que référence tout l'historique clinique : consultations,
 *     délégations, absences, présences, plannings, habilitations. La supprimer
 *     détruirait cet historique.
 *   • `Utilisateur` — le moyen de se connecter (login, rôles, permissions,
 *     sessions, messagerie). L'administrateur système en a un sans être soignant.
 *
 * Mais les gérer sur DEUX écrans n'avait aucun sens : c'est la même personne, et
 * deux formulaires de création produisaient des doublons et des fiches orphelines.
 * Cette page les réunit — l'accès à l'application devient une PROPRIÉTÉ de la
 * personne : elle en a un, ou elle n'en a pas.
 *
 * Layout : PageHeader + Toolbar + tableau dense.
 * Actions : créer, voir détail, changer statut, réinitialiser mdp, attribuer rôles.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Users, Plus, Shield, KeyRound, UserCheck, UserX, LogIn,
  Stethoscope, Loader2, ChevronRight, Trash2, AlertTriangle, Pencil, Download, ListChecks,
} from 'lucide-react'
import { PageHeader, Toolbar, Card, Button, StatCard,
  StatusPill, UserAvatar, EmptyState, Skeleton, IconButton, SelectBox, PaginationBar, useColumnResize, Modal,
  useSelectionLot, BarreSelectionLot, CheckBox,
} from '@/components/saris'
import { usePagination } from '@/hooks/usePagination'
import { useRowsPerPage } from '@/hooks/useRowsPerPage'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { usePermissions } from '@/hooks/usePermissions'
import { useSessionStore } from '@/stores/session.store'
import { useUtilisateurs, useRoles, useSetStatut, useDeleteUtilisateur } from '../hooks/useAdmin'
import { usePersonnel } from '@/modules/acteurs/hooks/usePersonnel'
import { useSites } from '@/modules/referentiels/hooks/useReferentiels'
import { labelFonction } from '@/config/fonctions'
import { CreerUtilisateurDrawer } from '../components/CreerUtilisateurDrawer'
import { UtilisateurDrawer }      from '../components/UtilisateurDrawer'
import { ResetPasswordDialog }    from '../components/ResetPasswordDialog'
import { FichePersonnelModal }    from '../components/FichePersonnelModal'
import { ListePrintSheet, type ColonneExport } from '@/components/print/ListePrintSheet'
import { adminApi, type UtilisateurAdmin } from '../api/admin.api'
import { ADMIN_KEYS } from '../hooks/useAdmin'
import { labelStatut } from '@/config/labels'

/**
 * Une personne telle qu'affichée ici : son identité, et son accès s'il existe.
 * `compte` à null = la personne est enregistrée mais ne peut pas se connecter.
 */
export interface Personne {
  cle:         string
  compte:      UtilisateurAdmin | null
  personnelId: string | null
  nom:         string
  prenom:      string
  matricule:   string | null
  metier:      string | null
  ficheActive: boolean
}

export function UtilisateursPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const isCompact = useIsCompact()
  // Permissions backend distinctes — ne JAMAIS regrouper sous un seul "canWrite".
  // Deux droits distincts se rencontrent sur cette page : voir les COMPTES et voir
  // les PERSONNES. Le médecin chef détient `personnel.read` sans `utilisateur.read` :
  // il doit continuer à gérer le personnel, sans rien apprendre des accès.
  const canVoirComptes   = has('utilisateur.read')
  const canCreate        = has('utilisateur.create')
  const canUpdate        = has('utilisateur.update')          // toggle statut + édition compte
  const canResetPassword = has('utilisateur.reset_password')
  const canDelete        = has('utilisateur.delete')
  const meId             = useSessionStore(s => s.user?.id)
  const [search,    setSearch]    = useState('')
  const [statutF,   setStatutF]   = useState<'' | 'ACTIF' | 'DESACTIVE' | 'BLOQUE'>('')
  const [roleF,     setRoleF]     = useState<string>('')
  const [siteF,     setSiteF]     = useState<string>('')
  const [accesF,    setAccesF]    = useState<'' | 'avec' | 'sans'>('')
  // Filtre de site : la liste backend est désormais globale (multi-site sans
  // restriction) — ce filtre est purement une commodité d'affichage côté client,
  // appliqué après réception de la liste complète (pas de paramètre serveur).
  const { data: sites = [] } = useSites()
  const [openCreer, setOpenCreer] = useState(false)
  const [openDetail, setOpenDetail] = useState<string | null>(null)
  const [openReset,  setOpenReset]  = useState<UtilisateurAdmin | null>(null)
  const [openDelete, setOpenDelete] = useState<UtilisateurAdmin | null>(null)
  /** Personne déjà enregistrée à qui l'on ouvre un accès. */
  const [openAcces,  setOpenAcces]  = useState<Personne | null>(null)
  /** Fiche (identité) en cours de modification. */
  const [openFiche,  setOpenFiche]  = useState<Personne | null>(null)
  const [openExport, setOpenExport] = useState(false)

  const deleteUser = useDeleteUtilisateur()

  async function handleDelete() {
    if (!openDelete) return
    try {
      await deleteUser.mutateAsync(openDelete.id)
      setOpenDelete(null)
    } catch {
      // Toast déjà affiché par le hook (ex: 409 dernier admin / référencé par l'audit).
    }
  }

  const { data: allUsers = [], isLoading } = useUtilisateurs({
    search: search.trim() || undefined,
    statut: statutF || undefined,
    roleId: roleF   || undefined,
  }, canVoirComptes)
  // Filtre de site : purement client-side (commodité d'affichage), la liste
  // reçue est déjà globale (multi-site sans restriction).
  const users = useMemo(
    () => (canCreate && siteF ? allUsers.filter(u => u.siteId === siteF) : allUsers),
    [allUsers, canCreate, siteF],
  )
  const { data: roles = [] } = useRoles()

  // Répertoire des personnes. Celles qui n'ont pas de compte n'apparaissent que
  // via cette source — sans elle, un agent administratif ou un soignant pas
  // encore doté d'un accès resterait invisible ici.
  const { data: personnel = [], isLoading: chargePersonnel } = usePersonnel()

  // ── Fusion : une ligne par personne ────────────────────────────────────────
  const personnes = useMemo<Personne[]>(() => {
    const q = search.trim().toLowerCase()

    const depuisComptes: Personne[] = users.map(u => ({
      cle:         'u:' + u.id,
      compte:      u,
      personnelId: u.personnelMedicalId,
      nom:         u.personnelMedical?.nom    ?? u.login,
      prenom:      u.personnelMedical?.prenom ?? '',
      matricule:   u.personnelMedical?.matricule ?? null,
      metier:      u.personnelMedical?.role   ?? null,
      ficheActive: u.statut === 'ACTIF',
    }))

    // Un filtre qui ne porte que sur le compte (statut, rôle, site) exclut par
    // nature les personnes qui n'en ont pas : on ne les mélange pas au résultat.
    const filtreCompteActif = !!(statutF || roleF || siteF)
    const rattaches = new Set(users.map(u => u.personnelMedicalId).filter(Boolean))

    const sansAcces: Personne[] =
      accesF === 'avec' || filtreCompteActif
        ? []
        : personnel
            .filter(p => !rattaches.has(p.id))
            .filter(p => !q || [p.nom, p.prenom, p.matricule].some(v => v?.toLowerCase().includes(q)))
            .map(p => ({
              cle:         'p:' + p.id,
              compte:      null,
              personnelId: p.id,
              nom:         p.nom,
              prenom:      p.prenom,
              matricule:   p.matricule,
              metier:      p.role,
              ficheActive: p.statut === 'ACTIF',
            }))

    const liste = accesF === 'sans' ? sansAcces : [...depuisComptes, ...sansAcces]
    return liste.sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom))
  }, [users, personnel, search, statutF, roleF, siteF, accesF])

  /**
   * Colonnes de l'extraction. Elles suivent celles de l'écran, mais rendues en
   * texte : le papier n'a ni pastille de statut ni avatar. Les colonnes réservées
   * aux comptes disparaissent pour qui n'a pas le droit de les voir — un document
   * imprimé ne doit pas révéler ce que l'écran masque.
   */
  const colonnesExport = useMemo<ColonneExport<Personne>[]>(() => [
    { libelle: t('admin.colPersonne', { defaultValue: 'Personne' }),
      valeur: p => `${p.prenom} ${p.nom}`.trim() },
    { libelle: t('admin.soignantMatricule', { defaultValue: 'Matricule' }),
      valeur: p => p.matricule ?? '—' },
    { libelle: t('admin.colFonction', { defaultValue: 'Fonction' }),
      valeur: p => (p.metier ? labelFonction(p.metier) : '—') },
    ...(canVoirComptes ? [
      // Le login est en sous-titre de la colonne « Personne » à l'écran ; sur le
      // papier il lui faut sa propre colonne, sinon il disparaît.
      { libelle: t('admin.colLogin', { defaultValue: 'Login' }),
        valeur: (p: Personne) => p.compte?.login ?? '—' },
      { libelle: t('admin.colSite'),
        valeur: (p: Personne) => p.compte?.site?.libelle ?? '—' },
      // « Espace de travail » = les rôles, exactement comme les pastilles à l'écran.
      { libelle: t('admin.colAcces', { defaultValue: 'Espace de travail' }),
        valeur: (p: Personne) => (p.compte
          ? (p.compte.roles.map(r => r.libelle).join(', ') || '—')
          : t('admin.sansAcces', { defaultValue: 'Sans accès' })) },
    ] : []),
    { libelle: t('admin.colStatus'),
      valeur: p => (p.compte?.statut === 'BLOQUE'
        ? t('admin.blocked')
        : p.ficheActive
          ? t('acteurs.statutActif',   { defaultValue: 'Actif' })
          : t('acteurs.statutInactif', { defaultValue: 'Inactif' })) },
  ], [t, canVoirComptes])

  // KPI rapides — à l'échelle des PERSONNES, pas des seuls comptes.
  const stats = useMemo(() => ({
    total:    personnes.length,
    avec:     personnes.filter(p => p.compte).length,
    sans:     personnes.filter(p => !p.compte).length,
    bloques:  personnes.filter(p => p.compte?.statut === 'BLOQUE').length,
    actives:  personnes.filter(p => p.ficheActive).length,
  }), [personnes])

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: isCompact ? 'auto' : '100%', minHeight: isCompact ? undefined : 0 }}>

        {!embedded && (
        <PageHeader
          icon={<Users size={18} />}
          title={t('admin.usersTitle')}
          subtitle={t('admin.usersSubtitle')}
          actions={
            <div style={{ display: 'flex', gap: 'var(--espace-2)' }}>
              <Button variant="secondary" leftIcon={<Download size={15} />} onClick={() => setOpenExport(true)}>
                {t('common.exporter', { defaultValue: 'Exporter' })}
              </Button>
              {canCreate && (
                <Button leftIcon={<Plus size={15} />} onClick={() => setOpenCreer(true)}>
                  {t('admin.nouvellePersonne', { defaultValue: 'Nouvelle personne' })}
                </Button>
              )}
            </div>
          }
        />
        )}

        {/* Mode embarqué (module Accès & habilitations) : actions compactes, en-tête fourni par le parent */}
        {embedded && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--espace-2)', padding: 'var(--espace-3) var(--espace-6) 0' }}>
            <Button size="sm" variant="secondary" leftIcon={<Download size={15} />} onClick={() => setOpenExport(true)}>
              {t('common.exporter', { defaultValue: 'Exporter' })}
            </Button>
            {canCreate && (
              <Button size="sm" leftIcon={<Plus size={15} />} onClick={() => setOpenCreer(true)}>
                {t('admin.nouvellePersonne', { defaultValue: 'Nouvelle personne' })}
              </Button>
            )}
          </div>
        )}

        {/* ── KPI ──────────────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isCompact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--espace-3)',
          padding: 'var(--espace-4) var(--espace-6) 0',
        }}>
          <StatCard
            icon={<Users size={18} />}
            label={t('admin.totalPersonnes', { defaultValue: 'Personnes au total' })}
            value={stats.total}
            tone="accent"
            hint={t('admin.avecOuSansAcces', { defaultValue: 'Avec ou sans accès' })}
          />
          {/* Sans droit sur les comptes, on ne parle que des personnes : afficher
              « avec / sans accès » laisserait croire que tout le monde est privé
              d'accès, alors qu'on n'a simplement pas le droit de le savoir. */}
          {canVoirComptes ? (
            <>
              <StatCard
                icon={<UserCheck size={18} />}
                label={t('admin.avecAcces', { defaultValue: 'Avec accès' })}
                value={stats.avec}
                tone="success"
                hint={stats.total > 0 ? `${Math.round(stats.avec / stats.total * 100)} %` : '—'}
              />
              <StatCard
                icon={<UserX size={18} />}
                label={t('admin.sansAcces', { defaultValue: 'Sans accès' })}
                value={stats.sans}
                tone="neutral"
                hint={t('admin.sansAccesHint', { defaultValue: 'Enregistrées, sans connexion' })}
              />
              <StatCard
                icon={<Shield size={18} />}
                label={t('admin.blocked')}
                value={stats.bloques}
                tone={stats.bloques > 0 ? 'warning' : 'neutral'}
                hint={stats.bloques > 0 ? t('admin.failedAttempts') : t('admin.noBlocking')}
              />
            </>
          ) : (
            <StatCard
              icon={<UserCheck size={18} />}
              label={t('acteurs.filterActivesOnly', { defaultValue: 'Actifs' })}
              value={stats.actives}
              tone="success"
              hint={stats.total > 0 ? `${Math.round(stats.actives / stats.total * 100)} %` : '—'}
            />
          )}
        </div>

        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div style={{ padding: 'var(--espace-3) var(--espace-6) 0' }}>
          <Card>
            <Toolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={t('admin.userSearchPlaceholder')}
              filters={
                <>
                  {/* Les filtres ci-dessous portent tous sur le COMPTE : sans droit
                      de le consulter, ils n'auraient rien à filtrer. */}
                  {canVoirComptes && <>
                  <div style={{ minWidth: 170 }}>
                    <SelectBox
                      size="sm"
                      value={accesF}
                      onChange={v => setAccesF(v as '' | 'avec' | 'sans')}
                      placeholder={t('admin.accesAll', { defaultValue: 'Accès : tous' })}
                      aria-label={t('admin.filterByAcces', { defaultValue: 'Filtrer par accès' })}
                      options={[
                        { value: '',     label: t('admin.accesAll',  { defaultValue: 'Accès : tous' }) },
                        { value: 'avec', label: t('admin.avecAcces', { defaultValue: 'Avec accès' }) },
                        { value: 'sans', label: t('admin.sansAcces', { defaultValue: 'Sans accès' }) },
                      ]}
                    />
                  </div>
                  <div style={{ minWidth: 160 }}>
                    <SelectBox
                      size="sm"
                      value={statutF}
                      onChange={v => setStatutF(v as any)}
                      placeholder={t('admin.allStatusesFilter')}
                      aria-label={t('admin.filterByStatus')}
                      options={[
                        { value: '',           label: t('admin.allStatusesFilter') },
                        { value: 'ACTIF',      label: t('admin.activePlural')        },
                        { value: 'DESACTIVE',  label: t('admin.deactivatedPlural')    },
                        { value: 'BLOQUE',     label: t('admin.blockedPlural')       },
                      ]}
                    />
                  </div>
                  <div style={{ minWidth: 200 }}>
                    <SelectBox
                      size="sm"
                      value={roleF}
                      onChange={setRoleF}
                      placeholder={t('admin.allRoles')}
                      aria-label={t('admin.filterByRole')}
                      options={[
                        { value: '', label: t('admin.allRoles') },
                        ...roles.map(r => ({ value: r.id, label: r.libelle })),
                      ]}
                    />
                  </div>
                  {canCreate && (
                    <div style={{ minWidth: 160 }}>
                      <SelectBox
                        size="sm"
                        value={siteF}
                        onChange={setSiteF}
                        placeholder={t('admin.allSites')}
                        aria-label={t('admin.filterBySite')}
                        options={[
                          { value: '', label: t('admin.allSites') },
                          ...sites.map(s => ({ value: s.id, label: s.libelle })),
                        ]}
                      />
                    </div>
                  )}
                  </>}
                </>
              }
            />
          </Card>
        </div>

        {/* ── Tableau ──────────────────────────────────────────────────────── */}
        <UserTableSection
          personnes={personnes}
          isLoading={isLoading || chargePersonnel}
          hasFilters={!!(search || statutF || roleF || siteF || accesF)}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canResetPassword={canResetPassword}
          canDelete={canDelete}
          meId={meId}
          onOpenCreer={() => setOpenCreer(true)}
          onOpenDetail={setOpenDetail}
          onResetPassword={setOpenReset}
          onDelete={setOpenDelete}
          onDonnerAcces={setOpenAcces}
          onOpenFiche={setOpenFiche}
          canVoirComptes={canVoirComptes}
        />
      </div>

      {/* Drawers / Dialogs */}
      <CreerUtilisateurDrawer open={openCreer} onClose={() => setOpenCreer(false)} />

      {/* Ouvrir un accès à quelqu'un déjà enregistré : même assistant, identité figée. */}
      {openAcces?.personnelId && (
        <CreerUtilisateurDrawer
          key={openAcces.personnelId}
          open
          onClose={() => setOpenAcces(null)}
          personnel={{
            id:        openAcces.personnelId,
            nom:       openAcces.nom,
            prenom:    openAcces.prenom,
            matricule: openAcces.matricule ?? '',
            role:      openAcces.metier ?? 'INFIRMIER',
          }}
        />
      )}

      {openDetail && (
        <UtilisateurDrawer
          utilisateurId={openDetail}
          onClose={() => setOpenDetail(null)}
        />
      )}

      {openExport && (
        <ListePrintSheet<Personne>
          rootId="export-personnel"
          titre={t('admin.tabPersonnel', { defaultValue: 'Personnel' })}
          sousTitre={`${personnes.length} personne${personnes.length > 1 ? 's' : ''}`}
          lignes={personnes}
          cleDe={p => p.cle}
          colonnes={colonnesExport}
          onClose={() => setOpenExport(false)}
        />
      )}

      {openFiche?.personnelId && (
        <FichePersonnelModal
          key={openFiche.personnelId}
          fiche={{
            id:        openFiche.personnelId,
            nom:       openFiche.nom,
            prenom:    openFiche.prenom,
            matricule: openFiche.matricule ?? '',
            metier:    openFiche.metier ?? 'INFIRMIER',
            active:    openFiche.ficheActive,
            aUnCompte: !!openFiche.compte,
          }}
          canUpdate={has('personnel.update')}
          canDelete={has('personnel.delete')}
          onClose={() => setOpenFiche(null)}
        />
      )}

      {openReset && (
        <ResetPasswordDialog
          utilisateur={openReset}
          onClose={() => setOpenReset(null)}
        />
      )}

      {openDelete && (
        <Modal
          icon={<Trash2 size={16} />}
          title={t('admin.deleteAccountTitle')}
          subtitle={`${openDelete.login} · ${openDelete.email}`}
          width={460}
          onClose={() => { if (!deleteUser.isPending) setOpenDelete(null) }}
          footer={
            <>
              <Button variant="secondary" disabled={deleteUser.isPending} onClick={() => setOpenDelete(null)}>
                {t('admin.cancel')}
              </Button>
              <Button
                variant="danger"
                leftIcon={<Trash2 size={14} />}
                loading={deleteUser.isPending}
                onClick={handleDelete}
              >
                {t('admin.deletePermanently')}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>
              {t('admin.deleteAccountIntro1')} <strong style={{ color: 'var(--texte-primaire)' }}>{t('admin.irreversible')}</strong>. {t('admin.deleteAccountIntro2')}
            </p>
            <p style={{
              margin: 0, display: 'flex', alignItems: 'flex-start', gap: 6,
              padding: 'var(--espace-2) var(--espace-3)',
              background: 'var(--avert-fond)',
              border: '1px solid var(--avert-bordure)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-caption)',
              color: 'var(--avert-texte)',
            }}>
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                {t('admin.deleteAccountAuditWarning')}
              </span>
            </p>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── Grille (colonnes) ─────────────────────────────────────────────────────────

const USER_COLS = '2.2fr 1.4fr 1.8fr 1fr 140px'

// ── Section tableau avec sticky header + pagination ───────────────────────────

function UserTableSection({
  personnes, isLoading, hasFilters,
  canCreate, canUpdate, canResetPassword, canDelete, meId,
  onOpenCreer, onOpenDetail, onResetPassword, onDelete, onDonnerAcces, onOpenFiche, canVoirComptes,
}: {
  personnes:        Personne[]
  isLoading:        boolean
  hasFilters:       boolean
  canCreate:        boolean
  canUpdate:        boolean
  canResetPassword: boolean
  canDelete:        boolean
  meId:             string | undefined
  onOpenCreer:      () => void
  onOpenDetail:     (id: string) => void
  onResetPassword:  (u: UtilisateurAdmin) => void
  onDelete:         (u: UtilisateurAdmin) => void
  onDonnerAcces:    (p: Personne) => void
  onOpenFiche:      (p: Personne) => void
  canVoirComptes:   boolean
}) {
  const { t } = useTranslation()
  const isCompact = useIsCompact()
  const tableMinW = isCompact ? 720 : undefined
  const pagination = usePagination(personnes, useRowsPerPage())
  const rz = useColumnResize({ storageKey: 'admin-utilisateurs', ready: !isLoading && personnes.length > 0, cellsSelector: ':scope > *' })

  // Sélection en lot : seuls les comptes SONT supprimables. Une personne sans accès
  // n'a rien à supprimer ici (sa fiche se gère dans Personnel), et son propre compte
  // reste hors de portée — exactement la règle déjà appliquée au bouton unitaire.
  const sel = useSelectionLot<Personne>({
    idDe: p => p.cle,
    supprimer: id => {
      const cible = personnes.find(p => p.cle === id)?.compte
      if (!cible) return Promise.reject(new Error('compte introuvable'))
      return adminApi.utilisateurs.remove(cible.id)
    },
    invalider: [ADMIN_KEYS.utilisateurs],
    verrouillee: p => !p.compte || p.compte.id === meId,
  })

  // Le gabarit de grille ne change JAMAIS : la case à cocher du mode sélection vit
  // dans la première cellule, pas dans une colonne à elle.
  const cols = rz.gridTemplate ?? USER_COLS

  return (
    <div style={{
      flex: isCompact ? 'none' : 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: isCompact ? undefined : 0,
      padding: 'var(--espace-3) var(--espace-6) var(--espace-6)',
      gap: 'var(--espace-3)',
    }}>
      <BarreSelectionLot sel={sel} lignes={personnes} />

      {/* Card du tableau avec scroll interne (hauteur fixe utilisable en mobile) */}
      <div style={{
        flex: isCompact ? 'none' : 1,
        height: isCompact ? '70vh' : undefined,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background:   'var(--fond-surface)',
        border:       '1px solid var(--bordure-legere)',
        borderRadius: 'var(--radius-xl)',
        overflowX: isCompact ? 'auto' : 'hidden',
        overflowY: 'hidden',
      }}>

        {/* Header tableau — STICKY */}
        {!isLoading && personnes.length > 0 && (
          <div ref={rz.containerRef} role="row" style={{
            display:      'grid',
            gridTemplateColumns: cols,
            minWidth:     tableMinW,
            gap:          'var(--espace-3)',
            padding:      'var(--espace-2) var(--espace-4)',
            background:   'var(--fond-surface-2)',
            borderBottom: '1px solid var(--bordure-legere)',
            fontSize:     'var(--font-size-overline)',
            fontWeight:   700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color:        'var(--texte-tertiaire)',
            flexShrink:   0,
          }}>
            {[
              t('admin.colPersonne', { defaultValue: 'Personne' }),
              canVoirComptes ? t('admin.colSite') : t('admin.colFonction', { defaultValue: 'Fonction' }),
              canVoirComptes ? t('admin.colAcces', { defaultValue: 'Espace de travail' }) : '',
              t('admin.colStatus'),
              t('admin.colActions'),
            ].map((label, i, arr) => (
              <div key={i} role="columnheader" style={{ position: 'relative', minWidth: 0, textAlign: i === arr.length - 1 ? 'right' : 'left' }}>
                {label}
                {i < arr.length - 1 && (
                  <span
                    className="saris-col-resize"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={t('admin.resizeColumn')}
                    onPointerDown={e => rz.startDrag(i, e)}
                    onDoubleClick={rz.reset}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Body scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0, minWidth: tableMinW }} role="table" aria-label={t('admin.usersListAria')}>
          {isLoading ? (
            <div style={{ padding: 'var(--espace-6)', display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-3)' }}>
                  <Skeleton variant="circle" width={36} height={36} />
                  <div style={{ flex: 1 }}>
                    <Skeleton variant="text" width="40%" />
                    <Skeleton variant="text" width="60%" style={{ marginTop: 6 }} />
                  </div>
                  <Skeleton width={80} height={22} />
                </div>
              ))}
            </div>
          ) : personnes.length === 0 ? (
            <EmptyState
              icon={<Users size={20} />}
              title={t('admin.noUserAccount')}
              description={hasFilters
                ? t('admin.noUserMatch')
                : t('admin.createFirstAccount')}
              action={canCreate
                ? <Button leftIcon={<Plus size={15} />} onClick={onOpenCreer}>{t('admin.createUser')}</Button>
                : undefined}
            />
          ) : (
            pagination.pageData.map((p, i) => {
              // La case se glisse DANS la première cellule (à côté de l'avatar) : la
              // grille garde exactement ses colonnes, en mode sélection comme au repos.
              // Elle reste présente mais inerte sur les personnes sans accès, dont il
              // n'y a pas de compte à supprimer ici.
              const caseSelection = sel.actif ? (
                <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                  <CheckBox
                    size={15}
                    checked={sel.estSelectionne(p)}
                    disabled={!sel.selectionnable(p)}
                    onChange={() => sel.basculer(p)}
                    aria-label={t('selection.selectRow')}
                  />
                </span>
              ) : null
              return p.compte ? (
                <UserRow
                  key={p.cle}
                  u={p.compte}
                  metier={p.metier}
                  cols={cols}
                  striped={i % 2 === 1}
                  selected={sel.estSelectionne(p)}
                  caseSelection={caseSelection}
                  enSelection={sel.actif}
                  onBasculer={() => sel.basculer(p)}
                  canUpdate={canUpdate}
                  canResetPassword={canResetPassword}
                  canDelete={canDelete && p.compte.id !== meId}
                  onOpenDetail={onOpenDetail}
                  onResetPassword={onResetPassword}
                  onDelete={onDelete}
                  onOpenFiche={() => onOpenFiche(p)}
                  onSelectionner={() => sel.entrer(p)}
                />
              ) : (
                <PersonneSansAccesRow
                  key={p.cle}
                  personne={p}
                  cols={cols}
                  striped={i % 2 === 1}
                  caseSelection={caseSelection}
                  canDonnerAcces={canCreate && canVoirComptes}
                  onDonnerAcces={() => onDonnerAcces(p)}
                  canUpdate={canUpdate}
                  onOpenFiche={() => onOpenFiche(p)}
                  canVoirComptes={canVoirComptes}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Pagination (visible seulement quand il y a des données) */}
      {!isLoading && personnes.length > 0 && (
        <PaginationBar {...pagination} />
      )}
    </div>
  )
}

/**
 * Personne enregistrée SANS accès à l'application : un agent administratif, ou un
 * soignant pas encore doté d'un compte. Elle a une identité et un métier, mais ni
 * login, ni rôle, ni site de connexion — les cellules correspondantes restent
 * volontairement vides plutôt que d'afficher un faux « — » qui laisserait croire
 * à une donnée manquante.
 */
function PersonneSansAccesRow({
  personne, cols, striped, caseSelection, canDonnerAcces, onDonnerAcces, canUpdate, onOpenFiche, canVoirComptes,
}: {
  personne: Personne
  cols: string
  striped: boolean
  caseSelection: React.ReactNode
  canDonnerAcces: boolean
  onDonnerAcces: () => void
  canUpdate: boolean
  onOpenFiche: () => void
  canVoirComptes: boolean
}) {
  const { t } = useTranslation()

  return (
    <div
      role="row"
      style={{
        display: 'grid',
        gridTemplateColumns: cols,
        gap: 'var(--espace-3)',
        padding: 'var(--espace-3) var(--espace-4)',
        alignItems: 'center',
        background: striped ? 'var(--fond-surface-2)' : 'transparent',
        borderBottom: '1px solid var(--bordure-legere)',
      }}
    >
      {/* Personne */}
      <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-3)', minWidth: 0 }}>
        {caseSelection}
        <UserAvatar userId={personne.personnelId ?? personne.cle} nom={personne.nom} prenom={personne.prenom} size={34} tone="neutral" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontWeight: 600, fontSize: 'var(--font-size-body-sm)',
            color: 'var(--texte-primaire)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {`${personne.prenom} ${personne.nom}`.trim()}
          </p>
          <p style={{
            margin: '2px 0 0',
            fontSize: 'var(--font-size-caption)',
            color: 'var(--texte-tertiaire)',
            fontFamily: 'monospace',
            display: 'flex', alignItems: 'center', gap: 6,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <Stethoscope size={10} />
            {personne.matricule}
            {personne.metier && (
              <>
                <span>·</span>
                <span style={{ fontFamily: 'inherit' }}>{labelFonction(personne.metier)}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Site (ou fonction si l'on ne voit pas les comptes) */}
      <div role="cell" style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>
        {canVoirComptes ? '' : (personne.metier ? labelFonction(personne.metier) : '—')}
      </div>

      {/* Accès — masqué faute de droit d'en connaître l'existence */}
      <div role="cell">
        {canVoirComptes && (
          <StatusPill tone="neutral" dot={false}>
            {t('admin.sansAcces', { defaultValue: 'Sans accès' })}
          </StatusPill>
        )}
      </div>

      {/* Statut de la fiche */}
      <div role="cell">
        <StatusPill tone={personne.ficheActive ? 'success' : 'neutral'}>
          {personne.ficheActive
            ? t('acteurs.statutActif',   { defaultValue: 'Actif' })
            : t('acteurs.statutInactif', { defaultValue: 'Inactif' })}
        </StatusPill>
      </div>

      {/* Actions */}
      <div role="cell" style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
        {canUpdate && (
          <IconButton
            aria-label={t('admin.modifierFiche', { defaultValue: 'Modifier la fiche' })}
            icon={<Pencil size={14} />}
            tone="neutral"
            size="sm"
            onClick={onOpenFiche}
          />
        )}
        {/* Bouton icône et non bouton texte : la colonne Actions doit garder la
            même trame d'une ligne à l'autre, sinon les icônes des autres lignes
            se décalent et l'œil ne suit plus. L'intitulé reste porté par
            l'infobulle et le libellé d'accessibilité. */}
        {/* `LogIn` et non `KeyRound` : la clé désigne DÉJÀ la réinitialisation du mot de
            passe sur les lignes voisines. Deux actions très différentes — ouvrir un accès
            à quelqu'un qui n'en a pas / changer le mot de passe de quelqu'un qui en a —
            ne peuvent pas porter le même symbole dans une seule et même liste. */}
        {canDonnerAcces && (
          <IconButton
            aria-label={t('admin.donnerAccesAction', { defaultValue: 'Donner l’accès' })}
            icon={<LogIn size={14} />}
            tone="accent"
            size="sm"
            onClick={onDonnerAcces}
          />
        )}
      </div>
    </div>
  )
}

function UserRow({
  u, metier, cols, striped, selected, caseSelection, enSelection, onBasculer,
  canUpdate, canResetPassword, canDelete, onOpenDetail, onResetPassword, onDelete, onOpenFiche, onSelectionner,
}: {
  u: UtilisateurAdmin
  /** Métier de la personne (Sage-femme, Technicien…). Distinct du rôle d'accès. */
  metier: string | null
  cols: string
  striped: boolean
  selected: boolean
  caseSelection: React.ReactNode
  /** Pendant le mode sélection, le clic sur la ligne coche au lieu d'ouvrir le détail. */
  enSelection: boolean
  onBasculer: () => void
  canUpdate: boolean
  canResetPassword: boolean
  canDelete: boolean
  onOpenDetail: (id: string) => void
  onResetPassword: (u: UtilisateurAdmin) => void
  onDelete: (u: UtilisateurAdmin) => void
  onOpenFiche: () => void
  onSelectionner: () => void
}) {
  const { t } = useTranslation()
  const setStatut = useSetStatut(u.id)

  return (
    <div
      role="row"
      style={{
        display: 'grid',
        gridTemplateColumns: cols,
        gap: 'var(--espace-3)',
        padding: 'var(--espace-3) var(--espace-4)',
        alignItems: 'center',
        background: selected ? 'var(--ap-50)' : striped ? 'var(--fond-surface-2)' : 'transparent',
        borderBottom: '1px solid var(--bordure-legere)',
        cursor: 'pointer',
        transition: 'background 0.12s',
      }}
      onClick={() => (enSelection ? onBasculer() : onOpenDetail(u.id))}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--ap-50)')}
      onMouseLeave={e => (e.currentTarget.style.background = selected ? 'var(--ap-50)' : striped ? 'var(--fond-surface-2)' : 'transparent')}
    >
      {/* Compte */}
      <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-3)', minWidth: 0 }}>
        {caseSelection}
        {u.personnelMedical ? (
          <UserAvatar userId={u.id} nom={u.personnelMedical.nom} prenom={u.personnelMedical.prenom} size={34} />
        ) : (
          <UserAvatar userId={u.id} nom={u.login} size={34} tone="neutral" />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontWeight: 600, fontSize: 'var(--font-size-body-sm)',
            color: 'var(--texte-primaire)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {u.personnelMedical
              ? `${u.personnelMedical.prenom} ${u.personnelMedical.nom}`
              : u.login}
          </p>
          {/* Sous-titre : on l'affiche uniquement s'il apporte de l'info. Si
              le compte n'est pas rattaché à un agent, le label principal est
              déjà le login → inutile de le répéter en sous-titre grisé. */}
          {u.personnelMedical && (
            <p style={{
              margin: '2px 0 0',
              fontSize: 'var(--font-size-caption)',
              color: 'var(--texte-tertiaire)',
              fontFamily: 'monospace',
              display: 'flex', alignItems: 'center', gap: 6,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {u.login}
              <span>·</span>
              <Stethoscope size={10} />
              {u.personnelMedical.matricule}
              {metier && (
                <>
                  <span>·</span>
                  <span style={{ fontFamily: 'inherit' }}>{labelFonction(metier)}</span>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Site */}
      <div role="cell" style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>
        {u.site.libelle.replace('Centre Médico-Social ', '')}
      </div>

      {/* Rôles */}
      <div role="cell" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {u.roles.slice(0, 2).map(r => (
          <StatusPill key={r.id} tone="accent" dot={false}>
            {r.libelle}
          </StatusPill>
        ))}
        {u.roles.length > 2 && (
          <StatusPill tone="neutral" dot={false}>+{u.roles.length - 2}</StatusPill>
        )}
      </div>

      {/* Statut */}
      <div role="cell">
        <StatusPill
          tone={u.statut === 'ACTIF' ? 'success' : u.statut === 'BLOQUE' ? 'warning' : 'neutral'}
        >
          {labelStatut('compte', u.statut)}
        </StatusPill>
        {u.motDePasseTemp && (
          <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--avert-accent)', fontWeight: 500 }}>
            {t('admin.temporaryPassword')}
          </p>
        )}
      </div>

      {/* Actions */}
      <div role="cell" style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
        {/* Modifier l'IDENTITÉ (nom, matricule, métier) — distinct du compte.
            Absent pour un compte sans fiche clinique, comme l'administrateur. */}
        {canUpdate && u.personnelMedical && (
          <IconButton
            aria-label={t('admin.modifierFiche', { defaultValue: 'Modifier la fiche' })}
            icon={<Pencil size={14} />}
            tone="neutral"
            size="sm"
            onClick={onOpenFiche}
          />
        )}
        {canResetPassword && (
          <IconButton
            aria-label={t('admin.resetPasswordAria')}
            icon={<KeyRound size={14} />}
            tone="neutral"
            size="sm"
            onClick={() => onResetPassword(u)}
          />
        )}
        {canUpdate && (
          <IconButton
            aria-label={u.statut === 'ACTIF' ? t('admin.deactivateAccount') : t('admin.reactivateAccount')}
            icon={u.statut === 'ACTIF' ? <UserX size={14} /> : <UserCheck size={14} />}
            tone={u.statut === 'ACTIF' ? 'danger' : 'success'}
            size="sm"
            disabled={setStatut.isPending}
            onClick={() => setStatut.mutate({ statut: u.statut === 'ACTIF' ? 'DESACTIVE' : 'ACTIF' })}
          />
        )}
        {canDelete && (
          <IconButton
            aria-label={t('admin.deleteAccountAria')}
            icon={<Trash2 size={14} />}
            tone="danger"
            size="sm"
            onClick={() => onDelete(u)}
          />
        )}
        {/* Entrée dans le mode sélection. Cette liste n'a pas de menu ⋮ : ses actions
            sont des icônes, donc celle-ci en est une aussi. */}
        {canDelete && (
          <IconButton
            aria-label={t('selection.enterMode')}
            icon={<ListChecks size={14} />}
            tone="neutral"
            size="sm"
            onClick={onSelectionner}
          />
        )}
        <IconButton
          aria-label={t('admin.viewDetail')}
          icon={setStatut.isPending ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
          tone="accent"
          size="sm"
          onClick={() => onOpenDetail(u.id)}
        />
      </div>
    </div>
  )
}
