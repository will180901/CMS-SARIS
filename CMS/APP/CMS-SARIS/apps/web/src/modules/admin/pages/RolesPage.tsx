/**
 * RolesPage — administration des rôles et de leur matrice de permissions.
 *
 * Layout : liste rôles (gauche) + détail/édition matrice (droite).
 * Les rôles "système" sont en lecture seule pour le code, mais leurs permissions
 * peuvent être ajustées (la matrice est éditable, pas la suppression).
 */

import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Shield, ShieldCheck, Plus, Trash2, ChevronRight, ChevronLeft,
  Lock, Users as UsersIcon, Search, Check,
} from 'lucide-react'
import {
  PageHeader, Card, Button, StatCard, StatusPill, EmptyState,
  IconButton, Skeleton, Field, TextInput, Avatar, SegmentedTabs, Modal,
} from '@/components/saris'
import {
  useRoles, usePermissions as useAdminPermissions, useRoleUtilisateurs,
  useCreateRole, useUpdateRole, useDeleteRole,
} from '../hooks/useAdmin'
import { usePermissions } from '@/hooks/usePermissions'
import { useIsCompact } from '@/hooks/useMediaQuery'
import type { RoleAdmin, PermissionDb } from '../api/admin.api'
import type { PermissionCode } from '@cms-saris/types'
import { labelModule, labelPermission } from '@/config/labels'
import { PrivacyCurtain } from '@/components/PrivacyCurtain'
import { buildPermissionTree, parsePermCode, labelPermAction } from '@/config/permission-tree'

// ── Page ──────────────────────────────────────────────────────────────────────

export function RolesPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation()
  const { data: roles = [],       isLoading: lr } = useRoles()
  const { data: permissions = [], isLoading: lp } = useAdminPermissions()

  // Permissions backend distinctes pour les rôles.
  const { has } = usePermissions()
  const canCreateRole = has('role.create')
  const canUpdateRole = has('role.update')
  const canDeleteRole = has('role.delete')
  const isCompact = useIsCompact()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Sur petit écran, on affiche la LISTE d'abord : pas d'auto-sélection du
  // premier rôle (sinon on tombe directement sur le détail, liste cachée).
  useEffect(() => {
    if (!selectedId && roles.length > 0 && !isCompact) setSelectedId(roles[0]!.id)
  }, [roles, selectedId, isCompact])

  const selected = roles.find(r => r.id === selectedId) ?? null

  // KPI
  const stats = useMemo(() => ({
    total:     roles.length,
    system:    roles.filter(r => r.isSystem).length,
    custom:    roles.filter(r => !r.isSystem).length,
    permCount: permissions.length,
  }), [roles, permissions])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: isCompact ? 'auto' : '100%', minHeight: isCompact ? undefined : 0 }}>

      {!embedded && (
      <PageHeader
        icon={<ShieldCheck size={18} />}
        title={t('admin.rolesTitle')}
        subtitle={t('admin.rolesSubtitle')}
        actions={
          canCreateRole && (
            <Button leftIcon={<Plus size={15} />} onClick={() => setShowCreate(true)}>
              {t('admin.newRole')}
            </Button>
          )
        }
      />
      )}

      {/* Mode embarqué (module Accès & habilitations) : action compacte, en-tête fourni par le parent */}
      {embedded && canCreateRole && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'var(--espace-3) var(--espace-6) 0' }}>
          <Button size="sm" leftIcon={<Plus size={15} />} onClick={() => setShowCreate(true)}>
            {t('admin.newRole')}
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
        <StatCard icon={<Shield size={18} />}      label={t('admin.rolesDefined')}    value={stats.total}     tone="accent" />
        <StatCard icon={<Lock size={18} />}        label={t('admin.systemRoles')}     value={stats.system}    tone="gold"
                  hint={t('admin.protectedFromDeletion')} />
        <StatCard icon={<ShieldCheck size={18} />} label={t('admin.customRoles')} value={stats.custom} tone="success" />
        <StatCard icon={<UsersIcon size={18} />}   label={t('admin.availablePermissions')} value={stats.permCount} tone="neutral" />
      </div>

      {/* ── Split : liste rôles | détail matrice ─────────────────────────── */}
      <div style={{
        flex: isCompact ? 'none' : 1, display: 'flex', gap: 'var(--espace-4)',
        padding: 'var(--espace-4) var(--espace-6) var(--espace-6)',
        minHeight: 0, overflow: isCompact ? 'visible' : 'hidden',
      }}>

        {/* Liste rôles — pleine largeur (compact, masquée si un rôle est sélectionné) */}
        {(!isCompact || !selected) && (
        <Card style={{ width: isCompact ? '100%' : 320, height: isCompact ? '70vh' : undefined, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <Card.Header compact title={`${t('admin.roles')} (${roles.length})`} />
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--espace-2)' }}>
            {lr ? (
              <div style={{ padding: 'var(--espace-2)' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} height={56} style={{ marginBottom: 6 }} />
                ))}
              </div>
            ) : roles.length === 0 ? (
              <EmptyState title={t('admin.noRole')} variant="subtle"
                icon={<Shield size={20} />}
                description={t('admin.createFirstRole')} />
            ) : (
              roles.map(r => (
                <RoleListItem
                  key={r.id}
                  role={r}
                  selected={r.id === selectedId}
                  onClick={() => setSelectedId(r.id)}
                />
              ))
            )}
          </div>
        </Card>
        )}

        {/* Détail matrice — pleine largeur (compact, si un rôle est sélectionné) */}
        {(!isCompact || selected) && (
        <div style={{ flex: 1, minWidth: 0, height: isCompact ? '70vh' : undefined, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {lp ? (
            <Card padding="lg">
              <Skeleton height={32} width="40%" />
              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} height={36} />
                ))}
              </div>
            </Card>
          ) : selected ? (
            <PrivacyCurtain>
              <RoleEditor role={selected} permissions={permissions} canUpdate={canUpdateRole} canDelete={canDeleteRole} onBack={isCompact ? () => setSelectedId(null) : undefined} />
            </PrivacyCurtain>
          ) : (
            <Card>
              <EmptyState
                icon={<Shield size={20} />}
                title={t('admin.selectRole')}
                description={t('admin.selectRoleDesc')}
              />
            </Card>
          )}
        </div>
        )}
      </div>

      {/* Drawer création */}
      {showCreate && (
        <CreateRoleDialog
          permissions={permissions}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* (Permissions par rôle uniquement — dérogations individuelles retirées en v1.) */}
    </div>
  )
}

// ── Item liste rôles ──────────────────────────────────────────────────────────

function RoleListItem({ role, selected, onClick }: {
  role: RoleAdmin
  selected: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      onClick={onClick}
      style={{
        width:        '100%',
        textAlign:    'left',
        padding:      'var(--espace-3)',
        marginBottom: 4,
        borderRadius: 'var(--radius-md)',
        background:   selected ? 'var(--ap-50)' : 'transparent',
        border:       `1.5px solid ${selected ? 'var(--ap-300)' : 'transparent'}`,
        cursor:       'pointer',
        display:      'flex', alignItems: 'center', gap: 'var(--espace-2)',
        transition:   'background 0.12s, border-color 0.12s',
      }}
      onMouseEnter={e => {
        if (!selected) e.currentTarget.style.background = 'var(--fond-surface-2)'
      }}
      onMouseLeave={e => {
        if (!selected) e.currentTarget.style.background = 'transparent'
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 'var(--radius-md)',
        background: role.isSystem ? 'var(--as-50)' : 'var(--ap-50)',
        color: role.isSystem ? 'var(--as-700)' : 'var(--ap-600)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {role.isSystem ? <Lock size={14} /> : <Shield size={14} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600,
          color: selected ? 'var(--ap-700)' : 'var(--texte-primaire)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {role.libelle}
        </p>
        <p style={{
          margin: '2px 0 0',
          fontSize: 'var(--font-size-caption)',
          color: 'var(--texte-tertiaire)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {role.permissions.length} {role.permissions.length > 1 ? t('admin.permissionsPlural') : t('admin.permissionSingular')} · {role.nbUtilisateurs} {role.nbUtilisateurs > 1 ? t('admin.usersPlural') : t('admin.userSingular')}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
        <StatusPill tone={role.permissions.length > 0 ? 'accent' : 'neutral'} dot={false} size="sm">
          {role.permissions.length}
        </StatusPill>
        <span style={{ fontSize: 'var(--font-size-overline)', color: 'var(--texte-tertiaire)' }}>
          {role.nbUtilisateurs} {t('admin.usersAbbrev')}
        </span>
      </div>
      <ChevronRight size={14} style={{
        color: selected ? 'var(--ap-500)' : 'var(--texte-tertiaire)',
        flexShrink: 0,
      }} />
    </button>
  )
}

// ── Éditeur de matrice permissions ────────────────────────────────────────────

function RoleEditor({ role, permissions, canUpdate, canDelete, onBack }: {
  role: RoleAdmin; permissions: PermissionDb[]; canUpdate: boolean; canDelete: boolean
  onBack?: () => void
}) {
  const { t } = useTranslation()
  const update = useUpdateRole(role.id)
  const remove = useDeleteRole()
  const { data: usersOfRole = [], isLoading: lu } = useRoleUtilisateurs(role.id)

  const [libelle, setLibelle] = useState(role.libelle)
  const [selected, setSelected] = useState<Set<PermissionCode>>(new Set(role.permissions))
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tab, setTab] = useState<'details' | 'permissions' | 'utilisateurs'>('permissions')

  // Sync quand on change de rôle
  useEffect(() => {
    setLibelle(role.libelle)
    setSelected(new Set(role.permissions))
    setSearch('')
    setConfirmDelete(false)
  }, [role.id])

  // Arbre Module → Sous-section → actions. La recherche porte sur les libellés
  // humains (module, sous-section, action), jamais sur les codes techniques.
  const tree = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? permissions.filter(p =>
          labelPermission(p.code, p.libelle).toLowerCase().includes(q) ||
          labelModule(p.module).toLowerCase().includes(q) ||
          labelPermAction(parsePermCode(p.code).action).toLowerCase().includes(q))
      : permissions
    return buildPermissionTree(filtered)
  }, [permissions, search])

  function toggle(code: PermissionCode) {
    setSelected(s => {
      const next = new Set(s)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function toggleModule(_module: string, codes: PermissionCode[]) {
    const allSelected = codes.every(c => selected.has(c))
    setSelected(s => {
      const next = new Set(s)
      if (allSelected) codes.forEach(c => next.delete(c))
      else             codes.forEach(c => next.add(c))
      return next
    })
  }

  function reset() {
    setLibelle(role.libelle)
    setSelected(new Set(role.permissions))
  }

  async function save() {
    await update.mutateAsync({
      libelle,
      permissions: [...selected],
    })
  }

  async function handleDelete() {
    await remove.mutateAsync(role.id)
    setConfirmDelete(false)
  }

  // Détection de modifications
  const dirty = libelle !== role.libelle
    || selected.size !== role.permissions.length
    || ![...selected].every(c => role.permissions.includes(c))

  return (
    <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        padding: 'var(--espace-4) var(--espace-5)',
        borderBottom: '1px solid var(--bordure-legere)',
        background: 'var(--fond-surface-2)',
        display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
      }}>
        {onBack && (
          <button onClick={onBack} title={t('common.back')} aria-label={t('common.back')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px 6px 8px', borderRadius: 9999, background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', cursor: 'pointer', color: 'var(--texte-secondaire)', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            <ChevronLeft size={18} /> {t('common.back')}
          </button>
        )}
        <div style={{
          width: 40, height: 40, borderRadius: 'var(--radius-lg)',
          background: role.isSystem ? 'var(--as-50)' : 'var(--ap-50)',
          color: role.isSystem ? 'var(--as-700)' : 'var(--ap-600)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {role.isSystem ? <Lock size={18} /> : <Shield size={18} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-h3)', fontWeight: 700, color: 'var(--texte-primaire)' }}>
            {role.libelle}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
            {role.isSystem ? t('admin.predefinedSystemRole') : t('admin.customRole')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--espace-2)', alignItems: 'center' }}>
          {role.isSystem && (
            <StatusPill tone="gold" dot={false}>{t('admin.systemRole')}</StatusPill>
          )}
          <StatusPill tone="accent" dot={false}>
            {role.nbUtilisateurs} {role.nbUtilisateurs > 1 ? t('admin.usersPlural') : t('admin.userSingular')}
          </StatusPill>
        </div>
      </div>

      {/* Barre d'onglets (pills SARIS) */}
      <div style={{
        flexShrink: 0, padding: 'var(--espace-3) var(--espace-5)',
        borderBottom: '1px solid var(--bordure-legere)', background: 'var(--fond-surface)',
      }}>
        <SegmentedTabs
          value={tab}
          onChange={k => setTab(k as 'details' | 'permissions' | 'utilisateurs')}
          tabs={[
            { key: 'details',      label: t('admin.tabDetails') },
            { key: 'permissions',  label: t('admin.tabPermissions') },
            { key: 'utilisateurs', label: t('admin.tabUsers'), badge: role.nbUtilisateurs },
          ]}
        />
      </div>

      {/* Contenu de l'onglet actif */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--espace-5)' }}>

        {/* ── Onglet DÉTAILS ──────────────────────────────────────────────── */}
        {tab === 'details' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>
            <Field label={t('admin.roleLabel')} required>
              {(id) => (
                <TextInput
                  id={id}
                  value={libelle}
                  onChange={e => setLibelle(e.target.value)}
                  placeholder={t('admin.roleLabelPlaceholder')}
                />
              )}
            </Field>
            <div style={{
              border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-lg)',
              padding: 'var(--espace-3) var(--espace-4)', display: 'flex', flexDirection: 'column',
            }}>
              <RoleInfoLine label={t('admin.roleType')} value={role.isSystem ? t('admin.systemRoleProtected') : t('admin.customRole')} />
              <RoleInfoLine label={t('admin.activePermissions')} value={`${selected.size} / ${permissions.length}`} />
              <RoleInfoLine label={t('admin.attachedUsers')} value={String(role.nbUtilisateurs)} last />
            </div>
          </div>
        )}

        {/* ── Onglet UTILISATEURS ─────────────────────────────────────────── */}
        {tab === 'utilisateurs' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', marginBottom: 6 }}>
            <h3 style={{ margin: 0, fontSize: 'var(--font-size-h4)', fontWeight: 700, color: 'var(--texte-primaire)' }}>
              {t('admin.usersWithRole')}
            </h3>
            <StatusPill tone="accent" dot={false}>{usersOfRole.length}</StatusPill>
          </div>
          <p style={{ margin: '0 0 var(--espace-2)', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
            {t('admin.usersWithRoleHint', { defaultValue: 'Tous ces comptes héritent automatiquement des permissions du rôle.' })}
          </p>
          {lu ? (
            <Skeleton height={44} />
          ) : usersOfRole.length === 0 ? (
            <div style={{
              padding: 'var(--espace-3)', borderRadius: 'var(--radius-md)',
              background: 'var(--fond-surface-2)', border: '1px dashed var(--bordure-normale)',
              fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', fontStyle: 'italic',
            }}>
              {t('admin.noUserHasRole')}
            </div>
          ) : (
            <div style={{
              border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-lg)',
              overflow: 'hidden', maxHeight: 240, overflowY: 'auto',
            }}>
              {usersOfRole.map((u, idx) => {
                const hasNom = !!(u.nom || u.prenom)
                const nom = hasNom ? `${u.prenom ?? ''} ${u.nom ?? ''}`.trim() : u.login
                return (
                  <div
                    key={u.id}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
                      padding: 'var(--espace-2) var(--espace-3)',
                      borderTop: idx > 0 ? '1px solid var(--bordure-legere)' : 'none',
                    }}
                  >
                    {hasNom
                      ? <Avatar nom={u.nom ?? ''} prenom={u.prenom ?? ''} size={30} />
                      : <Avatar nom={u.login} size={30} tone="neutral" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {nom}
                      </p>
                      <p style={{ margin: '1px 0 0', fontSize: 'var(--font-size-overline)', color: 'var(--texte-tertiaire)', fontFamily: 'monospace' }}>
                        {u.login}{u.statut !== 'ACTIF' ? (u.statut === 'BLOQUE' ? ` · ${t('admin.blockedLower')}` : ` · ${t('admin.deactivatedLower')}`) : ''}
                      </p>
                    </div>
                    {u.site && (
                      <span style={{ flexShrink: 0, fontSize: 'var(--font-size-overline)', color: 'var(--texte-tertiaire)', background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)', borderRadius: 9999, padding: '2px 8px' }}>
                        {u.site}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        )}

        {/* ── Onglet PERMISSIONS ──────────────────────────────────────────── */}
        {tab === 'permissions' && (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 'var(--espace-3)',
          }}>
            <h3 style={{
              margin: 0, fontSize: 'var(--font-size-h4)', fontWeight: 700,
              color: 'var(--texte-primaire)',
              display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
            }}>
              {t('admin.permissionMatrix')}
              <StatusPill tone="accent" dot={false}>
                {selected.size} / {permissions.length}
              </StatusPill>
            </h3>
          </div>

          <div style={{ position: 'relative', marginBottom: 'var(--espace-3)' }}>
            <Search size={14} style={{
              position: 'absolute', left: 10, top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--texte-tertiaire)', pointerEvents: 'none',
            }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('admin.searchPermission')}
              style={{
                width: '100%',
                height: 34,
                paddingLeft: 32, paddingRight: 10,
                fontSize: 'var(--font-size-body-sm)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--fond-surface-2)',
                border: '1px solid var(--bordure-normale)',
                color: 'var(--texte-primaire)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
            {tree.length === 0 && (
              <p style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', fontStyle: 'italic', margin: 0 }}>
                {t('admin.noPermissionMatch', { search })}
              </p>
            )}
            {tree.map(node => {
              const allSel  = node.codes.every(c => selected.has(c))
              const someSel = node.codes.some(c => selected.has(c))
              const selCount = node.codes.filter(c => selected.has(c)).length

              return (
                <div key={node.module} style={{
                  background: 'var(--fond-surface)',
                  border: '1px solid var(--bordure-legere)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                }}>
                  {/* En-tête module : sélection globale */}
                  <div style={{
                    padding: 'var(--espace-2) var(--espace-3)',
                    background: 'var(--fond-surface-2)',
                    borderBottom: '1px solid var(--bordure-legere)',
                    display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
                  }}>
                    <input
                      type="checkbox"
                      checked={allSel}
                      ref={el => { if (el) el.indeterminate = someSel && !allSel }}
                      onChange={() => toggleModule(node.module, node.codes)}
                      disabled={!canUpdate}
                      style={{ width: 14, height: 14, accentColor: 'var(--ap-500)', cursor: canUpdate ? 'pointer' : 'not-allowed' }}
                    />
                    <p style={{ margin: 0, flex: 1, fontSize: 'var(--font-size-body-sm)', fontWeight: 700, color: 'var(--texte-primaire)' }}>
                      {node.label}
                    </p>
                    <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
                      {selCount} / {node.codes.length}
                    </span>
                  </div>

                  {/* Sous-sections : chaque sous-entité a sa ligne de chips d'actions */}
                  <div style={{ padding: 'var(--espace-3)', display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
                    {node.subgroups.map(sg => {
                      const sgAll  = sg.codes.every(c => selected.has(c))
                      const sgSome = sg.codes.some(c => selected.has(c))
                      return (
                        <div key={sg.key}>
                          {sg.sub && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                              <input
                                type="checkbox"
                                checked={sgAll}
                                ref={el => { if (el) el.indeterminate = sgSome && !sgAll }}
                                onChange={() => toggleModule(sg.key, sg.codes)}
                                disabled={!canUpdate}
                                style={{ width: 12, height: 12, accentColor: 'var(--ap-500)', cursor: canUpdate ? 'pointer' : 'not-allowed' }}
                              />
                              <span style={{ fontSize: 'var(--font-size-overline)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--texte-tertiaire)' }}>
                                {sg.label}
                              </span>
                            </div>
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: sg.sub ? 18 : 0 }}>
                            {sg.leaves.map(leaf => {
                              const on = selected.has(leaf.code)
                              return (
                                <button
                                  key={leaf.code}
                                  type="button"
                                  disabled={!canUpdate}
                                  onClick={() => toggle(leaf.code)}
                                  title={labelPermission(leaf.code)}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                                    fontSize: 'var(--font-size-caption)', fontWeight: on ? 600 : 500,
                                    cursor: canUpdate ? 'pointer' : 'not-allowed',
                                    background: on ? 'var(--ap-50)' : 'var(--fond-surface-2)',
                                    color:      on ? 'var(--ap-700)' : 'var(--texte-secondaire)',
                                    border: `1px solid ${on ? 'var(--ap-300)' : 'var(--bordure-legere)'}`,
                                    transition: 'all 0.12s',
                                  }}
                                >
                                  {on && <Check size={11} />}
                                  {labelPermAction(leaf.action)}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        )}
      </div>

      {/* Footer actions */}
      <div style={{
        padding: 'var(--espace-3) var(--espace-5)',
        borderTop: '1px solid var(--bordure-legere)',
        background: 'var(--fond-surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 'var(--espace-2)',
      }}>
        <div>
          {!role.isSystem && canDelete && (
            confirmDelete ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-2)' }}>
                <span style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--erreur-texte)' }}>
                  {t('admin.deleteRoleQuestion')}
                </span>
                <Button variant="danger" size="sm" loading={remove.isPending} onClick={handleDelete}>
                  {t('admin.confirm')}
                </Button>
                <Button variant="ghost"  size="sm" onClick={() => setConfirmDelete(false)}>
                  {t('admin.cancel')}
                </Button>
              </div>
            ) : (
              <IconButton
                aria-label={t('admin.deleteRole')}
                icon={<Trash2 size={14} />}
                tone="danger"
                size="sm"
                disabled={role.nbUtilisateurs > 0}
                title={role.nbUtilisateurs > 0 ? t('admin.roleAssignedRemoveFirst') : undefined}
                onClick={() => setConfirmDelete(true)}
              />
            )
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--espace-2)' }}>
          <Button variant="secondary" disabled={!dirty || !canUpdate} onClick={reset}>
            {t('admin.reset')}
          </Button>
          <Button
            variant="primary"
            disabled={!dirty || libelle.trim().length < 2 || !canUpdate}
            loading={update.isPending}
            onClick={save}
            leftIcon={<ShieldCheck size={14} />}
          >
            {t('admin.save')}
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ── Dialog création rôle ──────────────────────────────────────────────────────

function RoleInfoLine({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--espace-3)',
      padding: '7px 0', borderBottom: last ? 'none' : '1px solid var(--bordure-legere)',
    }}>
      <span style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-tertiaire)' }}>{label}</span>
      <span style={{ fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function CreateRoleDialog({
  permissions, onClose,
}: {
  permissions: PermissionDb[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const create = useCreateRole()
  const [libelle, setLibelle] = useState('')

  /**
   * Le code technique du rôle est généré automatiquement depuis le libellé
   * (par ex. « Coordinateur de pharmacie » → COORDINATEUR_PHARMACIE). L'admin
   * n'a donc plus à connaître la grammaire UPPER_SNAKE_CASE — il saisit
   * juste un nom français.
   */
  function generateCode(text: string): string {
    return text
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // retire les accents
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30)
  }

  const valid = libelle.trim().length >= 2 && generateCode(libelle).length > 0

  async function handleCreate() {
    if (!valid) return
    await create.mutateAsync({
      code:        generateCode(libelle),
      libelle:     libelle.trim(),
      permissions: [],   // matrice à configurer après création
    })
    onClose()
  }

  return (
    <Modal
      icon={<ShieldCheck size={18} />}
      title={t('admin.newRole')}
      subtitle={t('admin.newRoleSubtitle')}
      width={480}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('admin.cancel')}</Button>
          <Button
            variant="primary"
            disabled={!valid}
            loading={create.isPending}
            leftIcon={<Plus size={14} />}
            onClick={handleCreate}
          >
            {t('admin.createRole')}
          </Button>
        </>
      }
    >
      <Field label={t('admin.roleName')} required hint={t('admin.roleNameHint')}>
        {(id) => (
          <TextInput
            id={id}
            value={libelle}
            onChange={e => setLibelle(e.target.value)}
            placeholder={t('admin.roleNamePlaceholder')}
            autoFocus
          />
        )}
      </Field>
      <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
        {t('admin.permissionsAvailableNote', { count: permissions.length })}
      </p>
    </Modal>
  )
}
