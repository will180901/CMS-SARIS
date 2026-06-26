/**
 * UtilisateurDrawer — détail / édition d'un compte utilisateur.
 *
 * Architecture : hero d'identité fixe + 4 onglets (style identique aux pages :
 * soulignement bas, actif en ap-700/ap-500) + footer fixe.
 *
 *   Onglet « Profil »    : site, rattachement personnel, infos compte
 *   Onglet « Rôles »     : rôles attribués (pills) + édition isolée
 *   Onglet « Activité »  : timeline des connexions, groupée par jour
 *   Onglet « Sécurité »  : tentatives, blocage, désactivation
 *
 * Charte SARIS : un seul accent (bleu sarcelle var(--ap-*)). Aucune couleur
 * décorative par rôle, aucune bordure latérale colorée. Couleurs sémantiques
 * (vert/ambre/rouge) réservées aux statuts et alertes.
 */

import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  X, Shield, ShieldCheck, ShieldOff, AlertTriangle, CheckCircle2,
  KeyRound, Building2, Stethoscope, AlertCircle, Mail, AtSign, Pencil,
  Power, Activity, Clock, CalendarDays, UserCog, Trash2,
  ShieldQuestion, RefreshCw, LogOut, Copy, Check,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@workspace/ui/components/sheet'
import { toast } from '@workspace/ui/components/sonner'
import { Button, Avatar, Skeleton, SegmentedTabs, Modal } from '@/components/saris'
import {
  useUtilisateur, useRoles, useSetRoles, useSetStatut, useAuditAuth, useDeleteUtilisateur,
  useResetTotp, useRegenerateBackupCodes, useRevokeSessions,
} from '../hooks/useAdmin'
import { usePermissions } from '@/hooks/usePermissions'
import { useSessionStore } from '@/stores/session.store'
import { labelMetier, labelStatut } from '@/config/labels'
import { formatDate as intlFormatDate, formatTime as intlFormatTime } from '@/lib/intl'
import { getPrimaryRole, ROLE_META } from '@/config/navigation.config'
import type { Role } from '@cms-saris/types'

type TabKey = 'profil' | 'roles' | 'activite' | 'securite'

interface Props {
  utilisateurId: string
  onClose:       () => void
  /** Onglet ouvert par défaut (ex: 'permissions' depuis la page Rôles) */
  initialTab?:   TabKey
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string, t: TFunction): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)     return t('admin.justNow')
  if (diff < 3600)   return t('admin.minutesAgo', { count: Math.floor(diff / 60) })
  if (diff < 86400)  return t('admin.hoursAgo', { count: Math.floor(diff / 3600) })
  if (diff < 604800) return t('admin.daysAgo', { count: Math.floor(diff / 86400) })
  return intlFormatDate(iso, { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDate(iso: string): string {
  return intlFormatDate(iso, { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatTime(iso: string): string {
  return intlFormatTime(iso, { hour: '2-digit', minute: '2-digit' })
}

/** Étiquette de jour pour la timeline ("Aujourd'hui" / "Hier" / "mer. 21 mai"). */
function dayBucket(iso: string, t: TFunction): string {
  const d = new Date(iso)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const that = new Date(d); that.setHours(0, 0, 0, 0)
  if (that.getTime() === today.getTime())     return t('admin.today')
  if (that.getTime() === yesterday.getTime()) return t('admin.yesterday')
  return intlFormatDate(d, { weekday: 'short', day: 'numeric', month: 'long' })
}

// ── Composant principal ───────────────────────────────────────────────────────

export function UtilisateurDrawer({ utilisateurId, onClose, initialTab }: Props) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canAssignRole   = has('utilisateur.assign_role')
  const canUpdate       = has('utilisateur.update')
  const canDelete       = has('utilisateur.delete')
  const meId            = useSessionStore(s => s.user?.id)

  const { data: u, isLoading } = useUtilisateur(utilisateurId)
  const { data: roles = [] }   = useRoles()
  const setRoles  = useSetRoles(utilisateurId)
  const setStatut = useSetStatut(utilisateurId)
  const deleteUser = useDeleteUtilisateur()
  const resetTotp = useResetTotp(utilisateurId)
  const regenBackupCodes = useRegenerateBackupCodes(utilisateurId)
  const revokeSessions = useRevokeSessions(utilisateurId)
  const { data: authRes } = useAuditAuth({ utilisateurId, limit: '12' })
  const authLogs = authRes?.data ?? []

  const [tab, setTab] = useState<TabKey>(initialTab ?? 'profil')
  const [editingRoles, setEditingRoles] = useState(false)
  const [roleSel, setRoleSel] = useState<string[]>([])
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Récupération de compte
  const [confirmResetTotp, setConfirmResetTotp] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)

  // Le user courant ne peut pas se supprimer lui-même (le backend renvoie 409,
  // mais on masque l'action en amont pour une UX cohérente).
  const isSelf = meId === utilisateurId

  async function handleDelete() {
    try {
      await deleteUser.mutateAsync(utilisateurId)
      setConfirmDelete(false)
      onClose()
    } catch {
      // Toast déjà affiché par le hook (ex: 409 dernier admin / référencé par l'audit).
      // On garde la modale ouverte pour que l'utilisateur lise l'erreur.
    }
  }

  // ── Récupération de compte ──────────────────────────────────────────────────
  async function handleResetTotp() {
    try {
      await resetTotp.mutateAsync()
      setConfirmResetTotp(false)
    } catch {
      // Toast déjà affiché par le hook ; on laisse la confirmation ouverte.
    }
  }

  async function handleRegenerateBackupCodes() {
    try {
      const res = await regenBackupCodes.mutateAsync()
      // Affichage unique : les codes en clair ne sont jamais re-renvoyés ensuite.
      setBackupCodes(res.backupCodes)
    } catch {
      // Toast déjà affiché par le hook.
    }
  }

  async function handleRevokeSessions() {
    try {
      await revokeSessions.mutateAsync()
      setConfirmRevoke(false)
    } catch {
      // Toast déjà affiché par le hook.
    }
  }

  useEffect(() => {
    if (u && !editingRoles) setRoleSel(u.roles.map(r => r.id))
  }, [u, editingRoles])

  // Quitter le mode édition quand on change d'onglet (évite un état incohérent)
  useEffect(() => {
    if (tab !== 'roles') setEditingRoles(false)
  }, [tab])

  function toggleRole(id: string) {
    setRoleSel(rs => rs.includes(id) ? rs.filter(r => r !== id) : [...rs, id])
  }

  async function saveRoles() {
    try {
      await setRoles.mutateAsync({ roleIds: roleSel })
      setEditingRoles(false)
    } catch {
      // Toast déjà affiché par le hook ; on garde le mode édition ouvert.
    }
  }

  const primaryRole = u ? getPrimaryRole(u.roles.map(r => r.code) as Role[]) : null
  const primaryLabel = primaryRole ? ROLE_META[primaryRole]?.label : null

  // Permissions cumulées (dédupliquées) sur les rôles attribués
  const permsCumulees = useMemo(() => {
    if (!u) return 0
    const seen = new Set<string>()
    const userRoleIds = new Set(u.roles.map(r => r.id))
    roles.filter(r => userRoleIds.has(r.id)).forEach(r => r.permissions.forEach(p => seen.add(p)))
    return seen.size
  }, [u, roles])

  const lastLogin = authLogs.find(l => l.resultat.startsWith('SUCCES'))

  // Onglets
  const TABS: { key: TabKey; label: string }[] = [
    { key: 'profil',      label: t('admin.tabProfile') },
    { key: 'roles',       label: t('admin.tabRolesAccess') },
    { key: 'activite',    label: t('admin.tabActivity') },
    { key: 'securite',    label: t('admin.tabSecurity') },
  ]

  return (
    <Sheet open onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        style={{
          width: 600, maxWidth: '95vw', padding: 0,
          display: 'flex', flexDirection: 'column', gap: 0,
          height: '100vh', maxHeight: '100vh',
          background: 'var(--fond-surface)',
        }}
      >
        {/* Titre/description accessibles (lecteurs d'écran) — exigés par Radix Dialog */}
        <SheetTitle className="sr-only">
          {t('admin.accountDetailAria', { login: u ? u.login : t('admin.userFallback') })}
        </SheetTitle>
        <SheetDescription className="sr-only">
          {t('admin.accountDetailDescAria')}
        </SheetDescription>


        {/* ── HERO : identité (neutre, sans bordure colorée) ──────────────── */}
        <div style={{
          flexShrink: 0,
          position: 'relative',
          padding: 'var(--espace-5) var(--espace-6) var(--espace-4)',
          borderBottom: '1px solid var(--bordure-legere)',
        }}>
          <button
            aria-label={t('admin.closePanel')}
            onClick={onClose}
            style={{
              position: 'absolute', top: 14, right: 14,
              background: 'transparent', border: 'none',
              padding: 6, borderRadius: 'var(--radius-md)',
              color: 'var(--texte-tertiaire)', cursor: 'pointer',
              transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--fond-surface-2)'; e.currentTarget.style.color = 'var(--texte-primaire)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--texte-tertiaire)' }}
          >
            <X size={16} />
          </button>

          {isLoading || !u ? (
            <div style={{ display: 'flex', gap: 'var(--espace-3)', alignItems: 'center' }}>
              <Skeleton variant="circle" width={56} height={56} />
              <div style={{ flex: 1 }}>
                <Skeleton variant="text" width="55%" />
                <Skeleton variant="text" width="38%" style={{ marginTop: 6 }} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 'var(--espace-3)', alignItems: 'center' }}>
              {u.personnelMedical
                ? <Avatar nom={u.personnelMedical.nom} prenom={u.personnelMedical.prenom} size={56} />
                : <Avatar nom={u.login} size={56} tone="neutral" />}

              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{
                  margin: 0, fontSize: 'var(--font-size-h3)', fontWeight: 700,
                  color: 'var(--texte-primaire)', lineHeight: 1.2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {u.personnelMedical
                    ? `${u.personnelMedical.prenom} ${u.personnelMedical.nom}`
                    : u.login}
                </h2>

                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 'var(--espace-2)',
                  marginTop: 4, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)',
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <AtSign size={11} /> {u.login}
                  </span>
                  <span style={{ color: 'var(--bordure-normale)' }}>·</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    <Mail size={11} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</span>
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 'var(--espace-3)', flexWrap: 'wrap' }}>
                  <StatutPill statut={u.statut} />
                  {primaryLabel && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 9px', borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-caption)', fontWeight: 600,
                      background: 'var(--ap-50)', color: 'var(--ap-700)',
                      border: '1px solid var(--ap-200)',
                    }}>
                      <Shield size={11} /> {primaryLabel}
                    </span>
                  )}
                  {u.motDePasseTemp && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 9px', borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-caption)', fontWeight: 600,
                      background: 'var(--avert-fond)', color: 'var(--avert-texte)',
                      border: '1px solid var(--avert-bordure)',
                    }}>
                      <KeyRound size={11} /> {t('admin.temporaryPassword')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Barre d'onglets (pills SARIS) ───────────────────────────────── */}
        {!isLoading && u && (
          <div style={{
            flexShrink: 0,
            padding: 'var(--espace-3) var(--espace-6)',
            borderBottom: '1px solid var(--bordure-legere)',
          }}>
            <SegmentedTabs value={tab} onChange={k => setTab(k as TabKey)} tabs={TABS} />
          </div>
        )}

        {/* ── Zone scrollable : contenu de l'onglet actif ─────────────────── */}
        {isLoading || !u ? (
          <div style={{ flex: 1, padding: 'var(--espace-5) var(--espace-6)' }}>
            <Skeleton height={70} />
            <Skeleton height={120} style={{ marginTop: 'var(--espace-3)' }} />
          </div>
        ) : (
          <div style={{
            flex: 1, minHeight: 0,
            overflowY: 'auto', overflowX: 'hidden',
            padding: 'var(--espace-5) var(--espace-6)',
          }}>
            {tab === 'profil'   && <ProfilTab u={u} permsCumulees={permsCumulees}
                                              lastLogin={lastLogin ? formatRelative(lastLogin.createdAt, t) : '—'} />}
            {tab === 'roles'    && (
              <RolesTab
                u={u} roles={roles}
                permsCumulees={permsCumulees}
                canAssignRole={canAssignRole}
                editing={editingRoles} setEditing={setEditingRoles}
                roleSel={roleSel} toggleRole={toggleRole}
                onSave={saveRoles} saving={setRoles.isPending}
                onCancel={() => { setEditingRoles(false); setRoleSel(u.roles.map(r => r.id)) }}
              />
            )}
            {tab === 'activite' && <ActiviteTab logs={authLogs} t={t} />}
            {tab === 'securite' && (
              <SecuriteTab
                u={u} canUpdate={canUpdate}
                pending={setStatut.isPending}
                confirmDeactivate={confirmDeactivate}
                setConfirmDeactivate={setConfirmDeactivate}
                onDeactivate={() => { setStatut.mutate({ statut: 'DESACTIVE' }); setConfirmDeactivate(false) }}
                onReactivate={() => setStatut.mutate({ statut: 'ACTIF' })}
                canDelete={canDelete && !isSelf}
                onAskDelete={() => setConfirmDelete(true)}
                onAskResetTotp={() => setConfirmResetTotp(true)}
                onRegenerateBackupCodes={handleRegenerateBackupCodes}
                regeneratingBackupCodes={regenBackupCodes.isPending}
                onAskRevokeSessions={() => setConfirmRevoke(true)}
              />
            )}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div style={{
          padding: 'var(--espace-3) var(--espace-6)',
          borderTop: '1px solid var(--bordure-legere)',
          background: 'var(--fond-surface)',
          flexShrink: 0,
        }}>
          <Button variant="secondary" onClick={onClose} fullWidth>{t('admin.close')}</Button>
        </div>
      </SheetContent>

      {/* ── Confirmation de suppression définitive ──────────────────────────── */}
      {confirmDelete && u && (
        <Modal
          icon={<Trash2 size={16} />}
          title={t('admin.deleteAccountTitle')}
          subtitle={`${u.login} · ${u.email}`}
          width={460}
          onClose={() => { if (!deleteUser.isPending) setConfirmDelete(false) }}
          footer={
            <>
              <Button variant="secondary" disabled={deleteUser.isPending} onClick={() => setConfirmDelete(false)}>
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

      {/* ── Confirmation : réinitialiser la 2FA ─────────────────────────────── */}
      {confirmResetTotp && u && (
        <Modal
          icon={<ShieldQuestion size={16} />}
          title={t('admin.resetTotpConfirmTitle')}
          subtitle={`${u.login} · ${u.email}`}
          width={460}
          onClose={() => { if (!resetTotp.isPending) setConfirmResetTotp(false) }}
          footer={
            <>
              <Button variant="secondary" disabled={resetTotp.isPending} onClick={() => setConfirmResetTotp(false)}>
                {t('admin.cancel')}
              </Button>
              <Button
                variant="danger"
                leftIcon={<ShieldOff size={14} />}
                loading={resetTotp.isPending}
                onClick={handleResetTotp}
              >
                {t('admin.resetTotpConfirm')}
              </Button>
            </>
          }
        >
          <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>
            {t('admin.resetTotpConfirmIntro')}
          </p>
        </Modal>
      )}

      {/* ── Confirmation : forcer la déconnexion ────────────────────────────── */}
      {confirmRevoke && u && (
        <Modal
          icon={<LogOut size={16} />}
          title={t('admin.forceLogoutConfirmTitle')}
          subtitle={`${u.login} · ${u.email}`}
          width={460}
          onClose={() => { if (!revokeSessions.isPending) setConfirmRevoke(false) }}
          footer={
            <>
              <Button variant="secondary" disabled={revokeSessions.isPending} onClick={() => setConfirmRevoke(false)}>
                {t('admin.cancel')}
              </Button>
              <Button
                variant="danger"
                leftIcon={<LogOut size={14} />}
                loading={revokeSessions.isPending}
                onClick={handleRevokeSessions}
              >
                {t('admin.forceLogoutConfirm')}
              </Button>
            </>
          }
        >
          <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>
            {t('admin.forceLogoutConfirmIntro')}
          </p>
        </Modal>
      )}

      {/* ── Codes de secours régénérés (affichés une seule fois) ────────────── */}
      {backupCodes && u && (
        <BackupCodesModal
          codes={backupCodes}
          subtitle={`${u.login} · ${u.email}`}
          onClose={() => setBackupCodes(null)}
        />
      )}
    </Sheet>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
//  ONGLET « PROFIL »
// ════════════════════════════════════════════════════════════════════════════════

function ProfilTab({ u, permsCumulees, lastLogin }: {
  u: NonNullable<ReturnType<typeof useUtilisateur>['data']>
  permsCumulees: number
  lastLogin: string
}) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>

      {/* Mini-stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(110px, 100%), 1fr))', gap: 'var(--espace-2)' }}>
        <StatChip icon={<ShieldCheck size={14} />} label={t('admin.rolesShort')}        value={u.roles.length} />
        <StatChip icon={<KeyRound size={14} />}    label={t('admin.permissionsShort')}  value={permsCumulees} />
        <StatChip icon={<Clock size={14} />}       label={t('admin.lastLoginShort')} value={lastLogin} small />
      </div>

      {/* Site d'affectation */}
      <Panel icon={<Building2 size={14} />} title={t('admin.assignedSite')}>
        <InfoRow icon={<Building2 size={15} />} label={t('admin.medicoSocialCenter')} value={u.site.libelle} />
      </Panel>

      {/* Personnel médical rattaché */}
      {u.personnelMedical ? (
        <Panel icon={<Stethoscope size={14} />} title={t('admin.attachedPersonnel')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-3)' }}>
            <Avatar nom={u.personnelMedical.nom} prenom={u.personnelMedical.prenom} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)' }}>
                {u.personnelMedical.prenom} {u.personnelMedical.nom}
              </p>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 'var(--espace-2)', marginTop: 4,
                fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)',
              }}>
                <span style={{ fontFamily: 'monospace' }}>{u.personnelMedical.matricule}</span>
                <span>·</span>
                <span>{labelMetier(u.personnelMedical.role)}</span>
                <span>·</span>
                <span>{labelStatut('generique', u.personnelMedical.statut)}</span>
              </div>
            </div>
          </div>
        </Panel>
      ) : (
        <Panel icon={<Stethoscope size={14} />} title={t('admin.attachedPersonnel')}>
          <EmptyHint icon={<UserCog size={16} />}>
            {t('admin.adminAccountNoPersonnel')}
          </EmptyHint>
        </Panel>
      )}

      {/* Informations du compte */}
      <Panel icon={<CalendarDays size={14} />} title={t('admin.accountInfo')}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <InfoLine label={t('admin.accountCreatedOn')}   value={formatDate(u.createdAt)} />
          <InfoLine label={t('admin.lastUpdate')} value={formatDate(u.updatedAt)} last />
        </div>
      </Panel>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
//  ONGLET « RÔLES & ACCÈS »
// ════════════════════════════════════════════════════════════════════════════════

function RolesTab({
  u, roles, permsCumulees, canAssignRole,
  editing, setEditing, roleSel, toggleRole, onSave, saving, onCancel,
}: {
  u: NonNullable<ReturnType<typeof useUtilisateur>['data']>
  roles: ReturnType<typeof useRoles>['data'] & {}
  permsCumulees: number
  canAssignRole: boolean
  editing: boolean
  setEditing: (v: boolean) => void
  roleSel: string[]
  toggleRole: (id: string) => void
  onSave: () => void
  saving: boolean
  onCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>

      {/* Barre de résumé + actions — COLLANTE en haut de l'onglet : Enregistrer
          reste toujours atteignable même quand la liste de rôles est longue. */}
      <div style={{
        position: 'sticky', top: 'calc(-1 * var(--espace-5))', zIndex: 2,
        marginTop: 'calc(-1 * var(--espace-5))',
        marginLeft: 'calc(-1 * var(--espace-6))', marginRight: 'calc(-1 * var(--espace-6))',
        padding: 'var(--espace-4) var(--espace-6) var(--espace-3)',
        background: 'var(--fond-surface)',
        borderBottom: '1px solid var(--bordure-legere)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 'var(--espace-2)',
      }}>
        <div style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>
          {editing ? (
            <span><strong style={{ color: 'var(--texte-primaire)' }}>{roleSel.length}</strong> {roleSel.length > 1 ? t('admin.rolesSelectedPlural') : t('admin.roleSelectedSingular')}</span>
          ) : (
            <span>
              <strong style={{ color: 'var(--texte-primaire)' }}>{u.roles.length}</strong> {u.roles.length > 1 ? t('admin.rolesPlural') : t('admin.roleSingular')}
              {' · '}
              <strong style={{ color: 'var(--texte-primaire)' }}>{permsCumulees}</strong> {permsCumulees > 1 ? t('admin.cumulatedPermissionsPlural') : t('admin.cumulatedPermissionSingular')}
            </span>
          )}
        </div>

        {!editing ? (
          canAssignRole && (
            <Button variant="outline" size="sm" leftIcon={<Pencil size={12} />} onClick={() => setEditing(true)}>
              {t('admin.edit')}
            </Button>
          )
        ) : (
          <div style={{ display: 'flex', gap: 'var(--espace-2)' }}>
            <Button variant="ghost" size="sm" onClick={onCancel}>{t('admin.cancel')}</Button>
            <Button
              variant="primary" size="sm"
              leftIcon={<CheckCircle2 size={12} />}
              loading={saving}
              disabled={saving || roleSel.length === 0}
              onClick={onSave}
            >
              {t('admin.save')}
            </Button>
          </div>
        )}
      </div>

      {/* Lecture : pills/badges des rôles attribués */}
      {!editing ? (
        u.roles.length === 0 ? (
          <EmptyHint icon={<ShieldOff size={16} />}>
            {t('admin.noRoleAssigned')}
          </EmptyHint>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--espace-2)' }}>
            {u.roles.map(r => {
              const full = roles?.find(rr => rr.id === r.id)
              return (
                <span
                  key={r.id}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 9999,
                    background: 'var(--ap-50)', color: 'var(--ap-700)',
                    border: '1px solid var(--ap-200)',
                    fontSize: 'var(--font-size-body-sm)', fontWeight: 600,
                  }}
                >
                  <Shield size={12} />
                  {r.libelle}
                  {full && (
                    <span style={{
                      fontSize: 'var(--font-size-overline)', fontWeight: 600,
                      color: 'var(--ap-600)', background: 'var(--fond-surface)',
                      padding: '1px 6px', borderRadius: 9999,
                    }}>
                      {full.permissions.length}
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        )
      ) : (
        /* Édition : liste cochable. L'onglet est dédié → aucune autre section
           à pousser, la liste s'étend simplement dans le scroll de l'onglet. */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(roles ?? []).map(r => {
            const checked = roleSel.includes(r.id)
            return (
              <label
                key={r.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
                  padding: 'var(--espace-3)',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${checked ? 'var(--ap-400)' : 'var(--bordure-legere)'}`,
                  background: checked ? 'var(--ap-50)' : 'var(--fond-surface)',
                  cursor: 'pointer', transition: 'all 0.12s',
                }}
              >
                <input
                  type="checkbox" checked={checked}
                  onChange={() => toggleRole(r.id)}
                  style={{ width: 15, height: 15, accentColor: 'var(--ap-500)', cursor: 'pointer' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0, fontWeight: 600, fontSize: 'var(--font-size-body-sm)',
                    color: checked ? 'var(--ap-700)' : 'var(--texte-primaire)',
                  }}>
                    {r.libelle}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
                    {r.permissions.length} {r.permissions.length > 1 ? t('admin.permissionsPlural') : t('admin.permissionSingular')}
                    {r.isSystem && ` · ${t('admin.systemRole')}`}
                  </p>
                </div>
                {checked && <CheckCircle2 size={16} style={{ color: 'var(--ap-600)', flexShrink: 0 }} />}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
//  ONGLET « ACTIVITÉ »
// ════════════════════════════════════════════════════════════════════════════════

function ActiviteTab({ logs, t }: { logs: NonNullable<ReturnType<typeof useAuditAuth>['data']>['data']; t: TFunction }) {
  if (!logs || logs.length === 0) {
    return (
      <EmptyHint icon={<Activity size={16} />}>
        {t('admin.noLoginRecorded')}
      </EmptyHint>
    )
  }

  // Grouper par jour
  const groups: { day: string; items: typeof logs }[] = []
  for (const log of logs) {
    const day = dayBucket(log.createdAt, t)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(log)
    else groups.push({ day, items: [log] })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>
      {groups.map(group => (
        <div key={group.day}>
          <p style={{
            margin: '0 0 var(--espace-2)', fontSize: 'var(--font-size-overline)',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
            color: 'var(--texte-tertiaire)',
          }}>
            {group.day}
          </p>
          <div style={{
            background: 'var(--fond-surface)',
            border: '1px solid var(--bordure-legere)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}>
            {group.items.map((log, idx) => {
              const isSuccess = log.resultat.startsWith('SUCCES')
              return (
                <div
                  key={log.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
                    padding: 'var(--espace-3)',
                    borderTop: idx > 0 ? '1px solid var(--bordure-legere)' : 'none',
                  }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: isSuccess ? 'var(--succes-fond)' : 'var(--erreur-fond)',
                    color:      isSuccess ? 'var(--succes-accent)' : 'var(--erreur-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {isSuccess ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 500, color: 'var(--texte-primaire)' }}>
                      {labelStatut('auth_result', log.resultat)}
                    </p>
                    {log.ipAdresse && (
                      <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', fontFamily: 'monospace' }}>
                        {log.ipAdresse}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', flexShrink: 0 }}>
                    {formatTime(log.createdAt)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
//  ONGLET « SÉCURITÉ »
// ════════════════════════════════════════════════════════════════════════════════

function SecuriteTab({
  u, canUpdate, pending, confirmDeactivate, setConfirmDeactivate, onDeactivate, onReactivate,
  canDelete, onAskDelete,
  onAskResetTotp, onRegenerateBackupCodes, regeneratingBackupCodes, onAskRevokeSessions,
}: {
  u: NonNullable<ReturnType<typeof useUtilisateur>['data']>
  canUpdate: boolean
  pending: boolean
  confirmDeactivate: boolean
  setConfirmDeactivate: (v: boolean) => void
  onDeactivate: () => void
  onReactivate: () => void
  canDelete: boolean
  onAskDelete: () => void
  onAskResetTotp: () => void
  onRegenerateBackupCodes: () => void
  regeneratingBackupCodes: boolean
  onAskRevokeSessions: () => void
}) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>

      {/* État de sécurité */}
      <Panel icon={<Shield size={14} />} title={t('admin.securityState')}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <InfoLine label={t('admin.accountStatus')} value={<StatutPill statut={u.statut} />} />
          <InfoLine label={t('admin.failedAttemptsLabel')} value={String(u.tentativesEchec)} />
          <InfoLine
            label={t('admin.passwordLabel')}
            value={u.motDePasseTemp ? t('admin.passwordTemporary') : t('admin.passwordUserDefined')}
            last
          />
        </div>

        {u.statut === 'BLOQUE' && (
          <Alert tone="warning" icon={<AlertCircle size={14} />} style={{ marginTop: 'var(--espace-3)' }}>
            {t('admin.accountBlockedAlert')}
          </Alert>
        )}
        {u.tentativesEchec > 0 && u.statut !== 'BLOQUE' && (
          <Alert tone="warning" icon={<AlertCircle size={14} />} style={{ marginTop: 'var(--espace-3)' }}>
            {u.tentativesEchec > 1
              ? t('admin.recentFailedAttemptsPlural', { count: u.tentativesEchec })
              : t('admin.recentFailedAttemptsSingular', { count: u.tentativesEchec })}
          </Alert>
        )}
      </Panel>

      {/* Actions sur le compte */}
      <Panel icon={<Power size={14} />} title={t('admin.accountActions')} tone="danger">
        {!canUpdate ? (
          <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>
            {t('admin.noStatusPermission')}
          </p>
        ) : u.statut === 'ACTIF' ? (
          confirmDeactivate ? (
            <div style={{
              padding: 'var(--espace-3)',
              background: 'var(--erreur-fond)',
              border: '1px solid var(--erreur-bordure)',
              borderRadius: 'var(--radius-md)',
            }}>
              <p style={{ margin: '0 0 var(--espace-3)', fontSize: 'var(--font-size-body-sm)', color: 'var(--erreur-texte)' }}>
                {t('admin.deactivateConfirmQuestion')}
              </p>
              <div style={{ display: 'flex', gap: 'var(--espace-2)' }}>
                <Button variant="danger" size="sm" loading={pending} onClick={onDeactivate}>
                  {t('admin.confirmDeactivation')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDeactivate(false)}>
                  {t('admin.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button
                variant="outline" size="sm" leftIcon={<Power size={13} />}
                onClick={() => setConfirmDeactivate(true)}
                style={{ color: 'var(--erreur-accent)', borderColor: 'var(--erreur-bordure)' }}
              >
                {t('admin.deactivateAccount')}
              </Button>
              <p style={{ margin: 'var(--espace-2) 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
                {t('admin.deactivationRevokesSessions')}
              </p>
            </>
          )
        ) : (
          <Button variant="success" size="sm" leftIcon={<CheckCircle2 size={13} />} loading={pending} onClick={onReactivate}>
            {t('admin.reactivateAccount')}
          </Button>
        )}
      </Panel>

      {/* Récupération de compte — l'admin reprend la main (2FA / sessions) */}
      {canUpdate && (
        <Panel icon={<ShieldQuestion size={14} />} title={t('admin.accountRecovery')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>

            {/* État 2FA */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--espace-2)' }}>
              <span style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-tertiaire)' }}>
                {t('admin.securityState')}
              </span>
              <TwoFactorBadge active={!!u.aDeuxFacteurs} />
            </div>

            <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
              {t('admin.twoFactorHelp')}
            </p>

            {/* Actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--espace-2)' }}>
              <Button
                variant="outline" size="sm" leftIcon={<ShieldOff size={13} />}
                disabled={!u.aDeuxFacteurs}
                onClick={onAskResetTotp}
              >
                {t('admin.resetTotp')}
              </Button>
              <Button
                variant="outline" size="sm" leftIcon={<RefreshCw size={13} />}
                disabled={!u.aDeuxFacteurs}
                loading={regeneratingBackupCodes}
                onClick={onRegenerateBackupCodes}
              >
                {t('admin.regenerateBackupCodes')}
              </Button>
              <Button
                variant="outline" size="sm" leftIcon={<LogOut size={13} />}
                onClick={onAskRevokeSessions}
              >
                {t('admin.forceLogout')}
              </Button>
            </div>

            {!u.aDeuxFacteurs && (
              <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>
                {t('admin.resetTotpDisabled')}
              </p>
            )}
          </div>
        </Panel>
      )}

      {/* Zone de danger — suppression définitive */}
      {canDelete && (
        <Panel icon={<Trash2 size={14} />} title={t('admin.dangerZone')} tone="danger">
          <Button
            variant="outline" size="sm" leftIcon={<Trash2 size={13} />}
            onClick={onAskDelete}
            style={{ color: 'var(--erreur-accent)', borderColor: 'var(--erreur-bordure)' }}
          >
            {t('admin.deleteAccountAria')}
          </Button>
          <p style={{ margin: 'var(--espace-2) 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
            {t('admin.deleteDangerHint')}
          </p>
        </Panel>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
//  SOUS-COMPOSANTS VISUELS PARTAGÉS
// ════════════════════════════════════════════════════════════════════════════════

function StatutPill({ statut }: { statut: 'ACTIF' | 'DESACTIVE' | 'BLOQUE' }) {
  const { t } = useTranslation()
  const map = {
    ACTIF:     { bg: 'var(--succes-fond)',    text: 'var(--succes-texte)',    border: 'var(--succes-bordure)',  icon: <CheckCircle2 size={11} />,  label: t('admin.statusActiveAccount') },
    DESACTIVE: { bg: 'var(--fond-surface-2)', text: 'var(--texte-secondaire)', border: 'var(--bordure-normale)', icon: <ShieldOff size={11} />,     label: t('admin.statusDeactivated') },
    BLOQUE:    { bg: 'var(--avert-fond)',     text: 'var(--avert-texte)',     border: 'var(--avert-bordure)',   icon: <AlertTriangle size={11} />, label: t('admin.statusBlocked') },
  } as const
  const m = map[statut]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--font-size-caption)', fontWeight: 600,
      background: m.bg, color: m.text, border: `1px solid ${m.border}`,
    }}>
      {m.icon} {m.label}
    </span>
  )
}

/** Badge d'état de la double authentification (2FA active / non configurée). */
function TwoFactorBadge({ active }: { active: boolean }) {
  const { t } = useTranslation()
  return active ? (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--font-size-caption)', fontWeight: 600,
      background: 'var(--succes-fond)', color: 'var(--succes-texte)', border: '1px solid var(--succes-bordure)',
    }}>
      <ShieldCheck size={11} /> {t('admin.twoFactorActive')}
    </span>
  ) : (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--font-size-caption)', fontWeight: 600,
      background: 'var(--fond-surface-2)', color: 'var(--texte-secondaire)', border: '1px solid var(--bordure-normale)',
    }}>
      <ShieldOff size={11} /> {t('admin.twoFactorNotConfigured')}
    </span>
  )
}

/**
 * Modale d'affichage des codes de secours régénérés. Les codes en clair ne sont
 * renvoyés qu'UNE seule fois par le backend → on insiste sur la copie immédiate.
 */
function BackupCodesModal({ codes, subtitle, onClose }: {
  codes:    string[]
  subtitle: string
  onClose:  () => void
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      setCopied(true)
      toast.success(t('admin.backupCodesCopied'))
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé) — l'admin peut recopier à la main.
    }
  }

  return (
    <Modal
      icon={<KeyRound size={16} />}
      title={t('admin.backupCodesTitle')}
      subtitle={subtitle}
      width={460}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="secondary"
            leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
            onClick={copyAll}
          >
            {copied ? t('admin.copied') : t('admin.copyAll')}
          </Button>
          <Button variant="primary" onClick={onClose}>{t('admin.close')}</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
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
          <span>{t('admin.backupCodesWarning')}</span>
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))', gap: 'var(--espace-2)',
          padding: 'var(--espace-3)',
          background: 'var(--fond-surface-2)',
          border: '1px solid var(--bordure-legere)',
          borderRadius: 'var(--radius-md)',
        }}>
          {codes.map((code, i) => (
            <span
              key={i}
              style={{
                fontFamily: 'monospace', fontSize: 'var(--font-size-body-sm)', fontWeight: 600,
                letterSpacing: '0.04em', color: 'var(--texte-primaire)', textAlign: 'center',
                padding: '4px 0',
              }}
            >
              {code}
            </span>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function StatChip({ icon, label, value, small = false }: {
  icon: React.ReactNode
  label: string
  value: number | string
  small?: boolean
}) {
  return (
    <div style={{
      padding: 'var(--espace-2) var(--espace-3)',
      background: 'var(--fond-surface-2)',
      border: '1px solid var(--bordure-legere)',
      borderRadius: 'var(--radius-md)',
      display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', minWidth: 0,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 'var(--radius-md)',
        background: 'var(--ap-50)', color: 'var(--ap-600)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{
          margin: 0,
          fontSize: small ? 'var(--font-size-body-sm)' : 'var(--font-size-h4)',
          fontWeight: 700, color: 'var(--texte-primaire)', lineHeight: 1.1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {value}
        </p>
        <p style={{
          margin: '2px 0 0', fontSize: 'var(--font-size-overline)',
          fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
          color: 'var(--texte-tertiaire)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </p>
      </div>
    </div>
  )
}

function Panel({ icon, title, actions, children, tone = 'normal' }: {
  icon: React.ReactNode
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
  tone?: 'normal' | 'danger'
}) {
  const iconColor = tone === 'danger' ? 'var(--erreur-accent)' : 'var(--ap-600)'
  const iconBg    = tone === 'danger' ? 'var(--erreur-fond)'   : 'var(--ap-50)'
  return (
    <section style={{
      background: 'var(--fond-surface)',
      border: '1px solid var(--bordure-legere)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <header style={{
        padding: 'var(--espace-2) var(--espace-3)',
        background: 'var(--fond-surface-2)',
        borderBottom: '1px solid var(--bordure-legere)',
        display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 'var(--radius-sm)',
          background: iconBg, color: iconColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {icon}
        </div>
        <h3 style={{ flex: 1, margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 700, color: 'var(--texte-primaire)' }}>
          {title}
        </h3>
        {actions}
      </header>
      <div style={{ padding: 'var(--espace-3)' }}>
        {children}
      </div>
    </section>
  )
}

/** Ligne d'info "carte" (icône + label + valeur) pour les blocs descriptifs */
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
      padding: 'var(--espace-3)',
      background: 'var(--fond-surface-2)',
      border: '1px solid var(--bordure-legere)',
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 'var(--radius-md)',
        background: 'var(--ap-50)', color: 'var(--ap-600)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-overline)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--texte-tertiaire)' }}>
          {label}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </p>
      </div>
    </div>
  )
}

/** Ligne clé/valeur simple (pour les blocs "Informations") */
function InfoLine({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 'var(--espace-3)', padding: '8px 0',
      borderBottom: last ? 'none' : '1px solid var(--bordure-legere)',
    }}>
      <span style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-tertiaire)' }}>{label}</span>
      <span style={{ fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  )
}

function EmptyHint({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
      padding: 'var(--espace-3)',
      background: 'var(--fond-surface-2)',
      border: '1px dashed var(--bordure-normale)',
      borderRadius: 'var(--radius-md)',
      fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', fontStyle: 'italic',
    }}>
      <span style={{ color: 'var(--texte-secondaire)' }}>{icon}</span>
      {children}
    </div>
  )
}

function Alert({ tone, icon, children, style }: {
  tone: 'warning' | 'error' | 'info'
  icon: React.ReactNode
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const tones = {
    warning: { bg: 'var(--avert-fond)',  border: 'var(--avert-bordure)',  text: 'var(--avert-texte)'  },
    error:   { bg: 'var(--erreur-fond)', border: 'var(--erreur-bordure)', text: 'var(--erreur-texte)' },
    info:    { bg: 'var(--info-fond)',   border: 'var(--info-bordure)',   text: 'var(--info-texte)'   },
  } as const
  const t = tones[tone]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
      padding: 'var(--espace-2) var(--espace-3)',
      background: t.bg, color: t.text, border: `1px solid ${t.border}`,
      borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-body-sm)',
      ...style,
    }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span>{children}</span>
    </div>
  )
}
