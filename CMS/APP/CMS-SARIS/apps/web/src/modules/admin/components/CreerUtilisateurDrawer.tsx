/**
 * CreerUtilisateurDrawer — assistant de création d'un compte utilisateur.
 *
 * Assistant en 2 étapes (cohérent avec « Nouveau patient ») :
 *   1. Compte         — login, email, mot de passe initial, site d'affectation
 *   2. Rôles & accès  — lien personnel médical (optionnel) + rôles attribués
 *
 * Validation par étape : on ne passe à l'étape 2 que si l'étape 1 est valide,
 * et « Créer le compte » n'est actif qu'avec au moins un rôle.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsCompact } from '@/hooks/useMediaQuery'
import {
  X, UserPlus, Eye, EyeOff, Stethoscope, Building2, ShieldCheck,
  Check, ChevronLeft, ChevronRight, KeyRound,
} from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@workspace/ui/components/sheet'
import { Button, Field, TextInput, StatusPill } from '@/components/saris'
import { useCreateUtilisateur, useRoles } from '../hooks/useAdmin'
import { useSites } from '@/modules/referentiels/hooks/useReferentiels'
import { useSessionStore } from '@/stores/session.store'

interface Props {
  open:    boolean
  onClose: () => void
}

// Règles de validation alignées avec le backend (cf utilisateur.dto.ts).
const LOGIN_REGEX    = /^[a-z][a-z0-9._-]*$/i
const EMAIL_REGEX    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/

export function CreerUtilisateurDrawer({ open, onClose }: Props) {
  const { t } = useTranslation()
  const create = useCreateUtilisateur()
  const isCompact = useIsCompact()
  const cols2 = isCompact ? '1fr' : '1fr 1fr'

  const [step, setStep] = useState<1 | 2>(1)
  const [login,    setLogin]    = useState('')
  const [email,    setEmail]    = useState('')
  const [mdp,      setMdp]      = useState('')
  const [showMdp,  setShowMdp]  = useState(false)
  const [roleIds,  setRoleIds]  = useState<string[]>([])
  const [nom,       setNom]       = useState('')
  const [prenom,    setPrenom]    = useState('')
  const [matricule, setMatricule] = useState('')

  const { data: sites = [] } = useSites()
  const { data: roles = [] } = useRoles()

  // Compte « soignant » = au moins un rôle clinique (MEDECIN_CHEF / INFIRMIER). Dans ce
  // cas on saisit l'identité (nom/prénom/matricule) et le backend crée la fiche clinique
  // liée — plus de répertoire de personnel séparé (recueil).
  const isClinicalSelected = roleIds.some(id => {
    const r = roles.find(x => x.id === id)
    return r?.code === 'MEDECIN_CHEF' || r?.code === 'INFIRMIER'
  })
  const identityValid = !isClinicalSelected
    || (nom.trim().length >= 2 && prenom.trim().length >= 2 && matricule.trim().length >= 2)

  // Cloisonnement multi-site : un admin ne crée que sur SON propre site (JWT).
  // Le site est donc figé — aucun sélecteur, pas de choix inter-sites.
  const siteId    = useSessionStore(s => s.user?.siteId) ?? ''
  const siteLabel = sites.find(s => s.id === siteId)?.libelle ?? '—'

  // Erreurs par champ (affichées sous chaque champ)
  const loginError = login.length > 0 && (login.length < 3 || login.length > 32 || !LOGIN_REGEX.test(login))
    ? t('admin.loginError')
    : undefined
  const emailError = email.length > 0 && !EMAIL_REGEX.test(email)
    ? t('admin.emailError')
    : undefined
  const mdpError = mdp.length > 0 && !PASSWORD_REGEX.test(mdp)
    ? t('admin.passwordRule')
    : undefined

  const step1Valid =
    LOGIN_REGEX.test(login) && login.length >= 3 && login.length <= 32
    && EMAIL_REGEX.test(email)
    && PASSWORD_REGEX.test(mdp)
    && !!siteId
  const valid = step1Valid && roleIds.length > 0 && identityValid

  function reset() {
    setStep(1)
    setLogin(''); setEmail(''); setMdp(''); setShowMdp(false)
    setRoleIds([]); setNom(''); setPrenom(''); setMatricule('')
  }
  function handleClose() { reset(); onClose() }

  function toggleRole(id: string) {
    setRoleIds(rs => rs.includes(id) ? rs.filter(r => r !== id) : [...rs, id])
  }

  function goNext() {
    if (step1Valid) setStep(2)
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!valid) return
    // Erreurs serveur (login/email déjà pris…) notifiées par toast via le hook.
    try {
      await create.mutateAsync({
        login: login.trim(),
        email: email.trim().toLowerCase(),
        motDePasseInitial: mdp,
        siteId,
        roleIds,
        ...(isClinicalSelected ? { nom: nom.trim(), prenom: prenom.trim(), matricule: matricule.trim() } : {}),
      })
      handleClose()
    } catch {
      // On garde le drawer ouvert pour correction.
    }
  }

  const STEPS = [
    { n: 1 as const, label: t('admin.stepAccount'),     icon: <KeyRound size={13} /> },
    { n: 2 as const, label: t('admin.stepRolesAccess'), icon: <ShieldCheck size={13} /> },
  ]

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <SheetContent
        side="right"
        style={{
          width: 520, maxWidth: '95vw',
          display: 'flex', flexDirection: 'column',
          padding: 0, gap: 0,
          height: '100vh', maxHeight: '100vh',
          background: 'var(--fond-surface)',
        }}
      >
        {/* ── Hero header ────────────────────────────────────────────────── */}
        <SheetHeader style={{
          position: 'relative',
          padding: 'var(--espace-5) var(--espace-6) var(--espace-4)',
          borderBottom: '1px solid var(--bordure-legere)',
          flexShrink: 0,
          display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 'var(--espace-3)',
          textAlign: 'left',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 'var(--radius-lg)',
            background: 'var(--ap-50)', color: 'var(--ap-600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <UserPlus size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 28 }}>
            <SheetTitle style={{
              margin: 0, fontSize: 'var(--font-size-h4)', fontWeight: 700,
              color: 'var(--texte-primaire)', lineHeight: 1.25,
            }}>
              {t('admin.newUserAccount')}
            </SheetTitle>
            <SheetDescription style={{
              margin: '3px 0 0', fontSize: 'var(--font-size-caption)',
              color: 'var(--texte-tertiaire)', lineHeight: 1.4,
            }}>
              {step === 1 ? t('admin.newUserStep1Desc') : t('admin.newUserStep2Desc')}
            </SheetDescription>
          </div>
          <button
            aria-label={t('admin.closePanel')}
            onClick={handleClose}
            style={{
              position: 'absolute', top: 14, right: 14,
              background: 'transparent', border: 'none', padding: 6,
              borderRadius: 'var(--radius-md)', color: 'var(--texte-tertiaire)',
              cursor: 'pointer', transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--fond-surface-2)'; e.currentTarget.style.color = 'var(--texte-primaire)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--texte-tertiaire)' }}
          >
            <X size={16} />
          </button>
        </SheetHeader>

        {/* ── Stepper ────────────────────────────────────────────────────── */}
        <div style={{ padding: 'var(--espace-4) var(--espace-6)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i === 0 ? '0 0 auto' : '1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: step >= s.n ? 'var(--ap-500)' : 'var(--fond-surface-2)',
                    color:      step >= s.n ? '#fff' : 'var(--texte-tertiaire)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, flexShrink: 0,
                    transition: 'background 0.2s',
                  }}>
                    {step > s.n ? <Check size={13} /> : s.icon}
                  </div>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: step === s.n ? 600 : 400,
                    color: step >= s.n ? 'var(--texte-primaire)' : 'var(--texte-tertiaire)',
                    whiteSpace: 'nowrap',
                  }}>
                    {s.label}
                  </span>
                </div>
                {i === 0 && (
                  <div style={{
                    flex: 1, height: 1,
                    background: step > 1 ? 'var(--ap-300)' : 'var(--bordure-legere)',
                    margin: '0 12px', transition: 'background 0.2s',
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Contenu scrollable de l'étape ──────────────────────────────── */}
        <form
          id="creer-user-form"
          onSubmit={handleSubmit}
          style={{
            flex: 1, minHeight: 0,
            overflowY: 'auto', overflowX: 'hidden',
            padding: '0 var(--espace-6) var(--espace-5)',
            display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)',
          }}
        >
          {/* ── Étape 1 — Compte ───────────────────────────────────────── */}
          {step === 1 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 'var(--espace-3)' }}>
                <Field label={t('admin.loginLabel')} required hint={t('admin.loginHint')} error={loginError}>
                  {(id) => (
                    <TextInput
                      id={id} value={login}
                      onChange={e => setLogin(e.target.value.toLowerCase().trim())}
                      placeholder={t('admin.loginPlaceholder')} autoFocus
                    />
                  )}
                </Field>
                <Field label={t('admin.emailLabel')} required error={emailError}>
                  {(id) => (
                    <TextInput
                      id={id} type="email" value={email}
                      onChange={e => setEmail(e.target.value.trim())}
                      placeholder="prenom.nom@cms-saris.cg"
                    />
                  )}
                </Field>
              </div>

              <Field
                label={t('admin.initialPassword')}
                required
                hint={t('admin.initialPasswordHint')}
                error={mdpError}
              >
                {(id) => (
                  <div style={{ position: 'relative' }}>
                    <TextInput
                      id={id}
                      type={showMdp ? 'text' : 'password'}
                      value={mdp}
                      onChange={e => setMdp(e.target.value)}
                      placeholder="Saris2026!"
                      style={{ paddingRight: 38 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowMdp(v => !v)}
                      aria-label={showMdp ? t('admin.hidePassword') : t('admin.showPassword')}
                      style={{
                        position: 'absolute', right: 8, top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--texte-tertiaire)', padding: 4,
                      }}
                    >
                      {showMdp ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                )}
              </Field>

              <SectionTitle icon={<Building2 size={14} />} label={t('admin.assignedSite')} />
              <Field label={t('admin.siteLabel')} hint={t('admin.siteHint')}>
                {() => (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
                    padding: 'var(--espace-2) var(--espace-3)',
                    border: '1px solid var(--bordure-legere)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--fond-surface-2)',
                    color: 'var(--texte-secondaire)',
                    fontSize: 'var(--font-size-sm)',
                  }}>
                    <Building2 size={14} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--texte-primaire)', fontWeight: 500 }}>{siteLabel}</span>
                  </div>
                )}
              </Field>
            </>
          )}

          {/* ── Étape 2 — Rôles & accès ────────────────────────────────── */}
          {step === 2 && (
            <>
              <SectionTitle icon={<ShieldCheck size={14} />} label={t('admin.assignedRoles')} />
              <Field
                label={t('admin.rolesLabel')}
                required
                hint={t('admin.rolesHint')}
                error={roleIds.length === 0 ? t('admin.selectAtLeastOneRole') : undefined}
              >
                {() => (
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 4,
                    maxHeight: 360, overflowY: 'auto', overflowX: 'hidden',
                    paddingRight: 4,
                  }}>
                    {roles.map(r => {
                      const checked = roleIds.includes(r.id)
                      return (
                        <label
                          key={r.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
                            padding: 'var(--espace-2) var(--espace-3)',
                            borderRadius: 'var(--radius-md)',
                            border: `1.5px solid ${checked ? 'var(--ap-400)' : 'var(--bordure-legere)'}`,
                            background: checked ? 'var(--ap-50)' : 'var(--fond-surface)',
                            cursor: 'pointer',
                            transition: 'all 0.12s',
                            flexShrink: 0,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRole(r.id)}
                            style={{ width: 14, height: 14, accentColor: 'var(--ap-500)' }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: checked ? 'var(--ap-700)' : 'var(--texte-primaire)' }}>
                              {r.libelle}
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
                              {r.permissions.length} {r.permissions.length > 1 ? t('admin.permissionsPlural') : t('admin.permissionSingular')}
                            </p>
                          </div>
                          {r.isSystem && <StatusPill tone="gold" dot={false}>{t('admin.system')}</StatusPill>}
                        </label>
                      )
                    })}
                  </div>
                )}
              </Field>

              {/* Identité du soignant — la fiche clinique est créée AVEC le compte */}
              {isClinicalSelected && (
                <>
                  <SectionTitle icon={<Stethoscope size={14} />} label={t('admin.soignantIdentity', { defaultValue: 'Identité du soignant' })} />
                  <p style={{ margin: '-6px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
                    {t('admin.soignantIdentityHint', { defaultValue: 'La fiche clinique du soignant est créée automatiquement avec le compte.' })}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 'var(--espace-3)' }}>
                    <Field label={t('admin.soignantNom', { defaultValue: 'Nom' })} required>
                      {(id) => <TextInput id={id} value={nom} onChange={e => setNom(e.target.value)} placeholder="BATCHI" />}
                    </Field>
                    <Field label={t('admin.soignantPrenom', { defaultValue: 'Prénom' })} required>
                      {(id) => <TextInput id={id} value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Marie-Claire" />}
                    </Field>
                  </div>
                  <Field label={t('admin.soignantMatricule', { defaultValue: 'Matricule' })} required hint={t('admin.soignantMatriculeHint', { defaultValue: 'Identifiant unique de l\'agent (ex. INF-001, MED-002).' })}>
                    {(id) => <TextInput id={id} value={matricule} onChange={e => setMatricule(e.target.value)} placeholder="INF-001" />}
                  </Field>
                </>
              )}
            </>
          )}
        </form>

        {/* ── Footer (navigation assistant) ──────────────────────────────── */}
        <div style={{
          padding:    'var(--espace-3) var(--espace-6)',
          borderTop:  '1px solid var(--bordure-legere)',
          background: 'var(--fond-surface)',
          display:    'flex', justifyContent: 'space-between', gap: 'var(--espace-2)',
          flexShrink: 0,
        }}>
          {step === 1 ? (
            <Button variant="secondary" size="sm" onClick={handleClose}>{t('admin.cancel')}</Button>
          ) : (
            <Button variant="secondary" size="sm" leftIcon={<ChevronLeft size={14} />} onClick={() => setStep(1)}>
              {t('admin.back')}
            </Button>
          )}

          {step === 1 ? (
            <Button variant="primary" size="sm" disabled={!step1Valid} onClick={goNext}>
              {t('admin.next')} <ChevronRight size={14} style={{ marginLeft: 4 }} />
            </Button>
          ) : (
            <Button
              type="submit" form="creer-user-form"
              variant="primary" size="sm"
              disabled={!valid}
              loading={create.isPending}
              leftIcon={<UserPlus size={14} />}
              style={{ minWidth: 140 }}
            >
              {t('admin.createAccount')}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── Helpers visuels internes ─────────────────────────────────────────────────

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'var(--espace-1)' }}>
      <span style={{ color: 'var(--ap-600)' }}>{icon}</span>
      <span style={{
        fontSize: 'var(--font-size-overline)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        color: 'var(--texte-tertiaire)',
      }}>{label}</span>
    </div>
  )
}
