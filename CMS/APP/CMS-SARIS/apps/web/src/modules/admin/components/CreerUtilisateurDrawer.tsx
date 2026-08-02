/**
 * CreerUtilisateurDrawer — assistant d'enregistrement d'une PERSONNE.
 *
 * Assistant en 2 étapes :
 *   1. Identité — nom, prénom, matricule, métier
 *   2. Accès    — facultatif : login, mot de passe, site, rôles
 *
 * L'ordre compte : on enregistre d'abord QUI est la personne, et seulement
 * ensuite si elle peut se connecter. Un agent administratif ou un soignant pas
 * encore doté d'un compte s'arrête à l'étape 1 — auparavant c'était impossible
 * sans passer par un second écran, ce qui produisait des fiches en double.
 *
 * Le métier (sage-femme, technicien de laboratoire…) est saisi ici et non déduit
 * du rôle d'accès : le système n'a que trois rôles de droits pour cinq métiers,
 * et laisser le serveur deviner écrasait le métier réel.
 *
 * Avec `personnel`, l'assistant sert à DONNER un accès à quelqu'un déjà
 * enregistré : l'identité est rappelée en lecture seule et on démarre à l'étape 2.
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
import { Button, Field, TextInput, StatusPill, SelectBox } from '@/components/saris'
import { useCreateUtilisateur, useRoles } from '../hooks/useAdmin'
import { useCreatePersonnel } from '@/modules/acteurs/hooks/usePersonnel'
import { labelFonction, optionsFonction, roleParDefaut } from '@/config/fonctions'
import { useSites } from '@/modules/referentiels/hooks/useReferentiels'
import { useSessionStore } from '@/stores/session.store'
import { usePermissions } from '@/hooks/usePermissions'

/** Personne déjà enregistrée à qui l'on vient donner un accès. */
export interface PersonneExistante {
  id:        string
  nom:       string
  prenom:    string
  matricule: string
  role:      string
}

interface Props {
  open:    boolean
  onClose: () => void
  /** Renseigné = mode « donner un accès » : identité figée, on démarre à l'étape 2. */
  personnel?: PersonneExistante | null
}


// Règles de validation alignées avec le backend (cf utilisateur.dto.ts).
const LOGIN_REGEX    = /^[a-z][a-z0-9._-]*$/i
const EMAIL_REGEX    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/

export function CreerUtilisateurDrawer({ open, onClose, personnel = null }: Props) {
  const { t } = useTranslation()
  const create = useCreateUtilisateur()
  const creerPersonnel = useCreatePersonnel()
  const isCompact = useIsCompact()
  const cols2 = isCompact ? '1fr' : '1fr 1fr'

  /** Mode « donner un accès » : la personne existe déjà, son identité est figée. */
  const modeAcces = !!personnel

  const [step, setStep] = useState<1 | 2>(modeAcces ? 2 : 1)
  const [login,    setLogin]    = useState('')
  const [email,    setEmail]    = useState('')
  const [mdp,      setMdp]      = useState('')
  const [showMdp,  setShowMdp]  = useState(false)
  const [roleIds,  setRoleIds]  = useState<string[]>([])
  const [nom,       setNom]       = useState(personnel?.nom ?? '')
  const [prenom,    setPrenom]    = useState(personnel?.prenom ?? '')
  const [matricule, setMatricule] = useState(personnel?.matricule ?? '')
  const [metier,    setMetier]    = useState<string>(personnel?.role ?? 'INFIRMIER')
  // En mode « donner un accès », la question ne se pose pas : c'est le but même.
  const [avecAcces, setAvecAcces] = useState(modeAcces)

  const { data: sites = [] } = useSites()
  const { data: roles = [] } = useRoles()

  const identityValid =
    nom.trim().length >= 2 && prenom.trim().length >= 2 && matricule.trim().length >= 2

  // Cloisonnement multi-site : par défaut un admin crée sur SON propre site
  // (JWT), site figé sans sélecteur. Un détenteur de `utilisateur.create`
  // « multi-site » (ADMIN_SYSTEME, ou un MEDECIN_CHEF auquel l'admin a
  // accordé ce droit) peut en revanche choisir librement Moutela OU Nkayi —
  // cf. UtilisateursController#hasCrossSiteAccess (backend, même règle).
  const { has } = usePermissions()
  const crossSite = has('utilisateur.create')
  const ownSiteId = useSessionStore(s => s.user?.siteId) ?? ''
  const [siteId, setSiteId] = useState(ownSiteId)
  const siteLabel = sites.find(s => s.id === siteId)?.libelle ?? '—'
  const siteOptions = sites.map(s => ({ value: s.id, label: s.libelle }))

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

  // Étape 1 = identité. Étape 2 = accès, dont les champs ne sont exigés que si
  // l'on a effectivement demandé un accès.
  const accesValid =
    LOGIN_REGEX.test(login) && login.length >= 3 && login.length <= 32
    && EMAIL_REGEX.test(email)
    && PASSWORD_REGEX.test(mdp)
    && !!siteId
    && roleIds.length > 0
  const valid = identityValid && (!avecAcces || accesValid)

  function reset() {
    setStep(modeAcces ? 2 : 1)
    setLogin(''); setEmail(''); setMdp(''); setShowMdp(false)
    setRoleIds([])
    setNom(personnel?.nom ?? ''); setPrenom(personnel?.prenom ?? '')
    setMatricule(personnel?.matricule ?? ''); setMetier(personnel?.role ?? 'INFIRMIER')
    setAvecAcces(modeAcces)
    setSiteId(ownSiteId)
  }
  function handleClose() { reset(); onClose() }

  function toggleRole(id: string) {
    setRoleIds(rs => rs.includes(id) ? rs.filter(r => r !== id) : [...rs, id])
  }

  /**
   * Coche le rôle qui découle de la fonction, s'il n'y a pas déjà un choix.
   * Évite de redemander à l'étape 2 ce qui vient d'être dit à l'étape 1.
   */
  function proposerRolePourFonction() {
    if (roleIds.length > 0) return
    const code = roleParDefaut(metier)
    const role = code ? roles.find(r => r.code === code) : undefined
    if (role) setRoleIds([role.id])
  }

  function goNext() {
    if (!identityValid) return
    proposerRolePourFonction()
    setStep(2)
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!valid) return
    // Erreurs serveur (matricule/login/email déjà pris…) notifiées par toast via les hooks.
    try {
      // 1. L'identité d'abord. La fiche porte le VRAI métier — le serveur ne peut
      //    pas le déduire du rôle d'accès (il n'a que 3 rôles pour 5 métiers).
      const personnelId = personnel
        ? personnel.id
        : (await creerPersonnel.mutateAsync({
            nom:       nom.trim(),
            prenom:    prenom.trim(),
            matricule: matricule.trim(),
            role:      metier as never,
          })).id

      // 2. L'accès ensuite, s'il a été demandé. En cas d'échec ici, la personne
      //    reste enregistrée SANS accès — un état cohérent et rattrapable depuis
      //    la liste (« Donner un accès »), jamais une fiche à moitié créée.
      if (avecAcces) {
        await create.mutateAsync({
          login: login.trim(),
          email: email.trim().toLowerCase(),
          motDePasseInitial: mdp,
          siteId,
          roleIds,
          personnelMedicalId: personnelId,
        })
      }
      handleClose()
    } catch {
      // On garde le panneau ouvert pour correction.
    }
  }

  const STEPS = [
    { n: 1 as const, label: t('admin.stepIdentite', { defaultValue: 'Identité' }), icon: <Stethoscope size={13} /> },
    { n: 2 as const, label: t('admin.stepAcces',    { defaultValue: 'Accès' }),    icon: <KeyRound size={13} /> },
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
              {modeAcces
                ? t('admin.donnerAccesTitre', { defaultValue: 'Donner un accès' })
                : t('admin.nouvellePersonne', { defaultValue: 'Nouvelle personne' })}
            </SheetTitle>
            <SheetDescription style={{
              margin: '3px 0 0', fontSize: 'var(--font-size-caption)',
              color: 'var(--texte-tertiaire)', lineHeight: 1.4,
            }}>
              {modeAcces
                ? t('admin.donnerAccesDesc', { defaultValue: 'Ouvrir une connexion à cette personne' })
                : step === 1
                  ? t('admin.nouvellePersonneDesc', { defaultValue: 'Qui est cette personne ?' })
                  : t('admin.nouvellePersonneAccesDesc', { defaultValue: 'Peut-elle se connecter à l’application ?' })}
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
          {/* ── Étape 1 — Identité ─────────────────────────────────────── */}
          {step === 1 && (
            <>
              <SectionTitle icon={<Stethoscope size={14} />} label={t('admin.identiteSection', { defaultValue: 'Identité de la personne' })} />
              <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 'var(--espace-3)' }}>
                <Field label={t('admin.soignantPrenom', { defaultValue: 'Prénom' })} required>
                  {(id) => (
                    <TextInput
                      id={id} value={prenom}
                      onChange={e => setPrenom(e.target.value)}
                      placeholder="Marie-Claire" autoFocus
                    />
                  )}
                </Field>
                <Field label={t('admin.soignantNom', { defaultValue: 'Nom' })} required>
                  {(id) => (
                    <TextInput id={id} value={nom} onChange={e => setNom(e.target.value)} placeholder="BATCHI" />
                  )}
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 'var(--espace-3)' }}>
                <Field
                  label={t('admin.soignantMatricule', { defaultValue: 'Matricule' })}
                  required
                  hint={t('admin.soignantMatriculeHint', { defaultValue: 'Identifiant unique de l\'agent (ex. INF-001, MED-002).' })}
                >
                  {(id) => <TextInput id={id} value={matricule} onChange={e => setMatricule(e.target.value)} placeholder="INF-001" />}
                </Field>
                <Field
                  label={t('admin.fonctionLabel', { defaultValue: 'Fonction' })}
                  required
                >
                  {(id) => (
                    <SelectBox
                      id={id} value={metier} onChange={setMetier}
                      options={optionsFonction(personnel?.role)}
                    />
                  )}
                </Field>
              </div>
            </>
          )}

          {/* ── Étape 2 — Accès à l'application ────────────────────────── */}
          {step === 2 && (
            <>
              {/* Rappel de qui l'on est en train d'enregistrer */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--espace-2)',
                padding: 'var(--espace-2) var(--espace-3)',
                border: '1px solid var(--bordure-legere)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--fond-surface-2)',
                fontSize: 'var(--font-size-body-sm)',
              }}>
                <Stethoscope size={14} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
                <span style={{ color: 'var(--texte-primaire)', fontWeight: 600 }}>
                  {`${prenom} ${nom}`.trim()}
                </span>
                <span style={{ color: 'var(--texte-tertiaire)', fontFamily: 'monospace', fontSize: 'var(--font-size-caption)' }}>
                  {matricule} · {labelFonction(metier)}
                </span>
              </div>

              {/* Le choix structurant de cet écran : accès ou pas d'accès. */}
              {!modeAcces && (
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: 'var(--espace-2)',
                  padding: 'var(--espace-3)',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${avecAcces ? 'var(--ap-400)' : 'var(--bordure-legere)'}`,
                  background: avecAcces ? 'var(--ap-50)' : 'var(--fond-surface)',
                  cursor: 'pointer', transition: 'all 0.12s',
                }}>
                  <input
                    type="checkbox"
                    checked={avecAcces}
                    onChange={e => { setAvecAcces(e.target.checked); if (e.target.checked) proposerRolePourFonction() }}
                    style={{ width: 14, height: 14, accentColor: 'var(--ap-500)', marginTop: 2 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: avecAcces ? 'var(--ap-700)' : 'var(--texte-primaire)' }}>
                      {t('admin.donnerAcces', { defaultValue: 'Donner un accès à l’application' })}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
                      {t('admin.donnerAccesHint', { defaultValue: 'Décochez pour enregistrer la personne sans lui permettre de se connecter.' })}
                    </p>
                  </div>
                </label>
              )}

              {!avecAcces ? null : (
              <>
              <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 'var(--espace-3)' }}>
                <Field label={t('admin.loginLabel')} required hint={t('admin.loginHint')} error={loginError}>
                  {(id) => (
                    <TextInput
                      id={id} value={login}
                      onChange={e => setLogin(e.target.value.toLowerCase().trim())}
                      placeholder={t('admin.loginPlaceholder')}
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
              {crossSite ? (
                <Field label={t('admin.siteLabel')} hint={t('admin.siteHintMultiSite')}>
                  {(id) => (
                    <SelectBox
                      id={id} value={siteId} onChange={setSiteId}
                      options={siteOptions}
                    />
                  )}
                </Field>
              ) : (
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
              )}

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
          {step === 1 || modeAcces ? (
            <Button variant="secondary" size="sm" onClick={handleClose}>{t('admin.cancel')}</Button>
          ) : (
            <Button variant="secondary" size="sm" leftIcon={<ChevronLeft size={14} />} onClick={() => setStep(1)}>
              {t('admin.back')}
            </Button>
          )}

          {step === 1 ? (
            <Button variant="primary" size="sm" disabled={!identityValid} onClick={goNext}>
              {t('admin.next')} <ChevronRight size={14} style={{ marginLeft: 4 }} />
            </Button>
          ) : (
            <Button
              type="submit" form="creer-user-form"
              variant="primary" size="sm"
              disabled={!valid}
              loading={create.isPending || creerPersonnel.isPending}
              leftIcon={<UserPlus size={14} />}
              style={{ minWidth: 140 }}
            >
              {modeAcces
                ? t('admin.donnerAccesAction', { defaultValue: 'Donner l’accès' })
                : avecAcces
                  ? t('admin.createAccount')
                  : t('admin.enregistrerPersonne', { defaultValue: 'Enregistrer' })}
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
