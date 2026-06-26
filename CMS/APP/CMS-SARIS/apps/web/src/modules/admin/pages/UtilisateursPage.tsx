/**
 * UtilisateursPage — administration des comptes utilisateur.
 *
 * Layout : PageHeader + Toolbar + tableau dense.
 * Actions : créer, voir détail, changer statut, réinitialiser mdp, attribuer rôles.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Users, Plus, Shield, KeyRound, UserCheck, UserX,
  Stethoscope, Loader2, ChevronRight, Trash2, AlertTriangle,
} from 'lucide-react'
import { PageHeader, Toolbar, Card, Button, StatCard,
  StatusPill, Avatar, EmptyState, Skeleton, IconButton, SelectBox, PaginationBar, useColumnResize, Modal,
} from '@/components/saris'
import { usePagination } from '@/hooks/usePagination'
import { useRowsPerPage } from '@/hooks/useRowsPerPage'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { usePermissions } from '@/hooks/usePermissions'
import { useSessionStore } from '@/stores/session.store'
import { useUtilisateurs, useRoles, useSetStatut, useDeleteUtilisateur } from '../hooks/useAdmin'
import { CreerUtilisateurDrawer } from '../components/CreerUtilisateurDrawer'
import { UtilisateurDrawer }      from '../components/UtilisateurDrawer'
import { ResetPasswordDialog }    from '../components/ResetPasswordDialog'
import type { UtilisateurAdmin }  from '../api/admin.api'
import { labelStatut } from '@/config/labels'

export function UtilisateursPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const isCompact = useIsCompact()
  // Permissions backend distinctes — ne JAMAIS regrouper sous un seul "canWrite".
  const canCreate        = has('utilisateur.create')
  const canUpdate        = has('utilisateur.update')          // toggle statut + édition compte
  const canResetPassword = has('utilisateur.reset_password')
  const canDelete        = has('utilisateur.delete')
  const meId             = useSessionStore(s => s.user?.id)
  const [search,    setSearch]    = useState('')
  const [statutF,   setStatutF]   = useState<'' | 'ACTIF' | 'DESACTIVE' | 'BLOQUE'>('')
  const [roleF,     setRoleF]     = useState<string>('')
  const [openCreer, setOpenCreer] = useState(false)
  const [openDetail, setOpenDetail] = useState<string | null>(null)
  const [openReset,  setOpenReset]  = useState<UtilisateurAdmin | null>(null)
  const [openDelete, setOpenDelete] = useState<UtilisateurAdmin | null>(null)

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

  const { data: users = [], isLoading } = useUtilisateurs({
    search: search.trim() || undefined,
    statut: statutF || undefined,
    roleId: roleF   || undefined,
  })
  const { data: roles = [] } = useRoles()

  // KPI rapides
  const stats = useMemo(() => ({
    total:    users.length,
    actifs:   users.filter(u => u.statut === 'ACTIF').length,
    bloques:  users.filter(u => u.statut === 'BLOQUE').length,
    desact:   users.filter(u => u.statut === 'DESACTIVE').length,
  }), [users])

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: isCompact ? 'auto' : '100%', minHeight: isCompact ? undefined : 0 }}>

        {!embedded && (
        <PageHeader
          icon={<Users size={18} />}
          title={t('admin.usersTitle')}
          subtitle={t('admin.usersSubtitle')}
          actions={
            canCreate && (
              <Button leftIcon={<Plus size={15} />} onClick={() => setOpenCreer(true)}>
                {t('admin.newUser')}
              </Button>
            )
          }
        />
        )}

        {/* Mode embarqué (module Accès & habilitations) : actions compactes, en-tête fourni par le parent */}
        {embedded && canCreate && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--espace-2)', padding: 'var(--espace-3) var(--espace-6) 0' }}>
            <Button size="sm" leftIcon={<Plus size={15} />} onClick={() => setOpenCreer(true)}>
              {t('admin.newUser')}
            </Button>
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
            label={t('admin.totalAccounts')}
            value={stats.total}
            tone="accent"
            hint={t('admin.allStatuses')}
          />
          <StatCard
            icon={<UserCheck size={18} />}
            label={t('admin.active')}
            value={stats.actifs}
            tone="success"
            hint={stats.total > 0 ? `${Math.round(stats.actifs / stats.total * 100)} %` : '—'}
          />
          <StatCard
            icon={<UserX size={18} />}
            label={t('admin.deactivated')}
            value={stats.desact}
            tone="neutral"
          />
          <StatCard
            icon={<Shield size={18} />}
            label={t('admin.blocked')}
            value={stats.bloques}
            tone={stats.bloques > 0 ? 'warning' : 'neutral'}
            hint={stats.bloques > 0 ? t('admin.failedAttempts') : t('admin.noBlocking')}
          />
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
                </>
              }
            />
          </Card>
        </div>

        {/* ── Tableau ──────────────────────────────────────────────────────── */}
        <UserTableSection
          users={users}
          isLoading={isLoading}
          hasFilters={!!(search || statutF || roleF)}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canResetPassword={canResetPassword}
          canDelete={canDelete}
          meId={meId}
          onOpenCreer={() => setOpenCreer(true)}
          onOpenDetail={setOpenDetail}
          onResetPassword={setOpenReset}
          onDelete={setOpenDelete}
        />
      </div>

      {/* Drawers / Dialogs */}
      <CreerUtilisateurDrawer open={openCreer} onClose={() => setOpenCreer(false)} />

      {openDetail && (
        <UtilisateurDrawer
          utilisateurId={openDetail}
          onClose={() => setOpenDetail(null)}
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
  users, isLoading, hasFilters,
  canCreate, canUpdate, canResetPassword, canDelete, meId,
  onOpenCreer, onOpenDetail, onResetPassword, onDelete,
}: {
  users:            UtilisateurAdmin[]
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
}) {
  const { t } = useTranslation()
  const isCompact = useIsCompact()
  const tableMinW = isCompact ? 720 : undefined
  const pagination = usePagination(users, useRowsPerPage())
  const rz = useColumnResize({ storageKey: 'admin-utilisateurs', ready: !isLoading && users.length > 0, cellsSelector: ':scope > *' })
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
        {!isLoading && users.length > 0 && (
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
            {[t('admin.colAccount'), t('admin.colSite'), t('admin.colRoles'), t('admin.colStatus'), t('admin.colActions')].map((label, i, arr) => (
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
          ) : users.length === 0 ? (
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
            pagination.pageData.map((u, i) => (
              <UserRow
                key={u.id}
                u={u}
                cols={cols}
                striped={i % 2 === 1}
                canUpdate={canUpdate}
                canResetPassword={canResetPassword}
                canDelete={canDelete && u.id !== meId}
                onOpenDetail={onOpenDetail}
                onResetPassword={onResetPassword}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      </div>

      {/* Pagination (visible seulement quand il y a des données) */}
      {!isLoading && users.length > 0 && (
        <PaginationBar {...pagination} />
      )}
    </div>
  )
}

function UserRow({
  u, cols, striped, canUpdate, canResetPassword, canDelete, onOpenDetail, onResetPassword, onDelete,
}: {
  u: UtilisateurAdmin
  cols: string
  striped: boolean
  canUpdate: boolean
  canResetPassword: boolean
  canDelete: boolean
  onOpenDetail: (id: string) => void
  onResetPassword: (u: UtilisateurAdmin) => void
  onDelete: (u: UtilisateurAdmin) => void
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
        background: striped ? 'var(--fond-surface-2)' : 'transparent',
        borderBottom: '1px solid var(--bordure-legere)',
        cursor: 'pointer',
        transition: 'background 0.12s',
      }}
      onClick={() => onOpenDetail(u.id)}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--ap-50)')}
      onMouseLeave={e => (e.currentTarget.style.background = striped ? 'var(--fond-surface-2)' : 'transparent')}
    >
      {/* Compte */}
      <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-3)', minWidth: 0 }}>
        {u.personnelMedical ? (
          <Avatar nom={u.personnelMedical.nom} prenom={u.personnelMedical.prenom} size={34} />
        ) : (
          <Avatar nom={u.login} size={34} tone="neutral" />
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
