/**
 * PersonnelTab — réglages de l'utilisateur connecté (self-service) :
 *   - Préférences d'affichage (thème, densité, langue, page d'accueil…)
 *   - Authentification à deux facteurs (TOTP individuel)
 *   - Sessions actives (révocation)
 *   - Mot de passe
 */

import { useState, useEffect, useRef } from 'react'
import {
  Palette, ShieldCheck, MonitorSmartphone, KeyRound, Check, Copy, ShieldAlert,
  LogOut, QrCode, Save, MapPin, Globe, Navigation,
} from 'lucide-react'
import { parseUserAgent } from '@/lib/userAgent'
import { geoLabel, formatCoords, mapsUrl } from '@/lib/geo'
import { QRCode } from '@workspace/ui/components/kibo-ui/qr-code'
import { Card, Button, SelectBox, TextInput, StatusPill, Skeleton, SegmentedTabs, TotpCountdown } from '@/components/saris'
import { ChangePasswordDialog } from '@/modules/auth/components/ChangePasswordDialog'
import { useTheme } from '@/components/theme-provider'
import { THEME_MAP } from '@/components/PreferencesSync'
import { soundsEnabled, setSoundsEnabled } from '@/lib/sounds'
import { formatDateTime } from '@/lib/intl'
import { useTranslation } from 'react-i18next'
import {
  useMyPreferences, useUpdateMyPreferences,
  useMySessions, useRevokeSession, useRevokeOtherSessions,
  useTotpStatus, useTotpSetup, useTotpActivate, useTotpDisable,
} from '../../hooks/useAdmin'
import type { Preferences } from '../../api/admin.api'

/** Rend UNE section du compte personnel, sélectionnée par la sous-nav. */
export function PersonnelTab({ section }: { section: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>
      {section === 'preferences' && <PreferencesCard />}
      {section === 'securite' && <><TotpCard /><MotDePasseCard /></>}
      {section === 'sessions' && <SessionsCard />}
    </div>
  )
}

// ── Préférences d'affichage ───────────────────────────────────────────────────

function PreferencesCard() {
  const { t } = useTranslation()
  const { data: pref, isLoading } = useMyPreferences()
  const update = useUpdateMyPreferences()
  const { setTheme } = useTheme()
  const pageOptions = [
    { value: 'dashboard', label: t('nav.dashboard') },
    { value: 'patients', label: t('nav.patients') },
    { value: 'triage', label: t('nav.triage') },
    { value: 'consultations', label: t('nav.consultations') },
    { value: 'personnel', label: t('nav.personnel') },
    { value: 'admin/utilisateurs', label: t('nav.utilisateurs') },
  ]
  const [draft, setDraft] = useState<Preferences | null>(null)
  // Préférence locale (appareil) : sons d'interface. Appliquée immédiatement.
  const [sons, setSons] = useState(soundsEnabled())

  // Suit les dernières valeurs (serveur + brouillon) pour le nettoyage au démontage.
  const latest = useRef<{ pref?: Preferences | null; draft: Preferences | null }>({ pref, draft })
  latest.current = { pref, draft }

  useEffect(() => { if (pref) setDraft(pref) }, [pref])

  // Au démontage (on quitte l'onglet Personnel) : si un aperçu n'a PAS été
  // enregistré (draft ≠ serveur), on restaure la valeur enregistrée. Sinon
  // l'aperçu resterait appliqué (et persisté en localStorage par le
  // ThemeProvider), divergeant durablement de la préférence serveur.
  // On ne restaure QUE les dimensions modifiées par l'aperçu → un changement
  // fait autrement (ex. Shift+D) n'est pas écrasé.
  useEffect(() => {
    return () => {
      const { pref: p, draft: d } = latest.current
      if (!p || !d) return
      if (d.theme   !== p.theme)   setTheme(THEME_MAP[p.theme] ?? 'system')
      if (d.densite !== p.densite) document.documentElement.setAttribute('data-densite', p.densite)
    }
  }, [setTheme])

  // Aperçu instantané (avant enregistrement)
  function previewTheme(v: Preferences['theme'])     { setDraft(d => d ? { ...d, theme: v } : d);   setTheme(THEME_MAP[v] ?? 'system') }
  function previewDensite(v: Preferences['densite']) { setDraft(d => d ? { ...d, densite: v } : d); document.documentElement.setAttribute('data-densite', v) }

  if (isLoading || !draft) {
    return <Card><Card.Body padding="md"><Skeleton height={180} /></Card.Body></Card>
  }

  const dirty = !!pref && (
    draft.theme !== pref.theme || draft.densite !== pref.densite || draft.pageAccueil !== pref.pageAccueil
  )
  const set = (patch: Partial<Preferences>) => setDraft(d => d ? { ...d, ...patch } : d)

  function save() {
    update.mutate({ theme: draft!.theme, densite: draft!.densite, pageAccueil: draft!.pageAccueil })
  }

  return (
    <Card>
      <Card.Header icon={<Palette size={15} />} title={t('settings.prefTitle')}
        subtitle={t('settings.prefSubtitle')}
        actions={dirty
          ? <Button size="sm" variant="primary" loading={update.isPending} leftIcon={<Save size={13} />} onClick={save}>{t('common.save')}</Button>
          : undefined} />
      <Card.Body padding="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>

          <PrefRow label={t('settings.theme')} hint={t('settings.themeHint')}>
            <SegmentedTabs size="sm" value={draft.theme} onChange={v => previewTheme(v as Preferences['theme'])}
              tabs={[{ key: 'clair', label: t('settings.themeLight') }, { key: 'sombre', label: t('settings.themeDark') }, { key: 'auto', label: t('settings.themeSystem') }]} />
          </PrefRow>

          <PrefRow label={t('settings.densityLabel')} hint={t('settings.densityHint')}>
            <SegmentedTabs size="sm" value={draft.densite} onChange={v => previewDensite(v as Preferences['densite'])}
              tabs={[{ key: 'confort', label: t('settings.densityComfort') }, { key: 'compact', label: t('settings.densityCompact') }]} />
          </PrefRow>

          <PrefRow label={t('settings.homePage')} hint={t('settings.homePageHint')}>
            <div style={{ width: 240 }}>
              <SelectBox value={draft.pageAccueil} onChange={v => set({ pageAccueil: v })} options={pageOptions} />
            </div>
          </PrefRow>

          <PrefRow label={t('settings.sounds')} hint={t('settings.soundsHint')}>
            <div style={{ width: 160 }}>
              <SelectBox value={sons ? 'true' : 'false'} onChange={v => { const on = v === 'true'; setSons(on); setSoundsEnabled(on) }}
                options={[{ value: 'true', label: t('settings.enabled') }, { value: 'false', label: t('settings.disabled') }]} />
            </div>
          </PrefRow>
        </div>
      </Card.Body>
    </Card>
  )
}

function PrefRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--espace-3)', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)' }}>{label}</p>
        {hint && <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>{hint}</p>}
      </div>
      {children}
    </div>
  )
}

// ── 2FA (TOTP) ────────────────────────────────────────────────────────────────

function TotpCard() {
  const { t } = useTranslation()
  const { data: status, isLoading } = useTotpStatus()
  const setup    = useTotpSetup()
  const activate = useTotpActivate()
  const disable  = useTotpDisable()

  const [phase, setPhase] = useState<'idle' | 'setup' | 'backup' | 'disable'>('idle')
  const [secret, setSecret] = useState('')
  const [otpUrl, setOtpUrl] = useState('')
  const [code, setCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])

  // Les mutations affichent l'erreur via leur onError (toast). On encapsule pour
  // éviter toute promesse rejetée non gérée et laisser l'utilisateur réessayer.
  async function startSetup() {
    setCode('')
    try {
      const r = await setup.mutateAsync()
      setSecret(r.secret); setOtpUrl(r.otpauthUrl); setPhase('setup')
    } catch { /* toast géré par le hook ; on reste en phase idle */ }
  }
  async function confirmActivate() {
    try {
      const r = await activate.mutateAsync(code)
      setBackupCodes(r.backupCodes); setPhase('backup'); setCode('')
    } catch { /* toast géré ; on reste en phase setup pour réessayer */ }
  }
  async function confirmDisable() {
    try {
      await disable.mutateAsync(code)
      setPhase('idle'); setCode('')
    } catch { /* toast géré ; on reste en phase disable pour réessayer */ }
  }

  if (isLoading) return <Card><Card.Body padding="md"><Skeleton height={90} /></Card.Body></Card>

  const actif = status?.actif

  return (
    <Card>
      <Card.Header icon={<ShieldCheck size={15} />} title={t('settings.twoFactorTitle')}
        subtitle={t('settings.twoFactorSubtitle')} />
      <Card.Body padding="md">
        {/* État + action principale */}
        {phase === 'idle' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--espace-3)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-2)' }}>
              <StatusPill tone={actif ? 'success' : 'neutral'}>{actif ? t('settings.twoFactorEnabled') : t('settings.twoFactorDisabled')}</StatusPill>
              <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
                {actif ? t('settings.twoFactorEnabledHint') : t('settings.twoFactorRecommended')}
              </span>
            </div>
            {actif
              ? <Button size="sm" variant="outline" leftIcon={<ShieldAlert size={13} />} onClick={() => { setCode(''); setPhase('disable') }}
                  style={{ color: 'var(--erreur-accent)', borderColor: 'var(--erreur-bordure)' }}>{t('settings.twoFactorDisable')}</Button>
              : <Button size="sm" variant="primary" loading={setup.isPending} leftIcon={<QrCode size={13} />} onClick={startSetup}>{t('settings.twoFactorActivate')}</Button>}
          </div>
        )}

        {/* Setup : QR + secret + code */}
        {phase === 'setup' && (
          <div style={{ display: 'flex', gap: 'var(--espace-5)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ width: 180, height: 180, padding: 10, background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--bordure-legere)', flexShrink: 0 }}>
              <QRCode data={otpUrl} foreground="#0f172a" background="#ffffff" />
            </div>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
                <li>{t('settings.totpStep1')}</li>
                <li>{t('settings.totpStep2')}</li>
              </ol>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 'var(--font-size-overline)', color: 'var(--texte-tertiaire)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('settings.totpManualKey')}</p>
                <code style={{ display: 'block', padding: '6px 10px', background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', fontSize: 'var(--font-size-caption)', wordBreak: 'break-all' }}>{secret}</code>
              </div>
              <div style={{ display: 'flex', gap: 'var(--espace-2)', alignItems: 'center' }}>
                <div style={{ width: 130 }}>
                  <TextInput value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000"
                    style={{ fontFamily: 'monospace', letterSpacing: '0.2em', textAlign: 'center' }} />
                </div>
                <Button size="sm" variant="primary" loading={activate.isPending} disabled={code.length !== 6} leftIcon={<Check size={13} />} onClick={confirmActivate}>{t('settings.totpConfirm')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setPhase('idle')}>{t('settings.totpCancel')}</Button>
              </div>
              <TotpCountdown />
            </div>
          </div>
        )}

        {/* Codes de secours (une seule fois) */}
        {phase === 'backup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', padding: 'var(--espace-2) var(--espace-3)', background: 'var(--avert-fond)', border: '1px solid var(--avert-bordure)', borderRadius: 'var(--radius-md)', color: 'var(--avert-texte)', fontSize: 'var(--font-size-caption)' }}>
              <ShieldAlert size={15} /> {t('settings.backupWarning')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))', gap: 6 }}>
              {backupCodes.map(c => (
                <code key={c} style={{ padding: '6px 10px', background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', fontSize: 'var(--font-size-body-sm)', textAlign: 'center', letterSpacing: '0.05em' }}>{c}</code>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--espace-2)' }}>
              <Button size="sm" variant="outline" leftIcon={<Copy size={13} />} onClick={() => navigator.clipboard?.writeText(backupCodes.join('\n'))}>{t('settings.backupCopy')}</Button>
              <Button size="sm" variant="primary" leftIcon={<Check size={13} />} onClick={() => setPhase('idle')}>{t('settings.backupSaved')}</Button>
            </div>
          </div>
        )}

        {/* Désactivation : code requis */}
        {phase === 'disable' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>
              {t('settings.disableHint')}
            </p>
            <div style={{ display: 'flex', gap: 'var(--espace-2)', alignItems: 'center' }}>
              <div style={{ width: 130 }}>
                <TextInput value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000"
                  style={{ fontFamily: 'monospace', letterSpacing: '0.2em', textAlign: 'center' }} />
              </div>
              <Button size="sm" variant="danger" loading={disable.isPending} disabled={code.length !== 6} onClick={confirmDisable}>{t('settings.twoFactorDisable')}</Button>
              <Button size="sm" variant="ghost" onClick={() => setPhase('idle')}>{t('settings.totpCancel')}</Button>
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  )
}

// ── Sessions actives ──────────────────────────────────────────────────────────

function SessionsCard() {
  const { t } = useTranslation()
  const { data: sessions = [], isLoading } = useMySessions()
  const revoke = useRevokeSession()
  const revokeOthers = useRevokeOtherSessions()
  const others = sessions.filter(s => !s.current).length

  return (
    <Card>
      <Card.Header icon={<MonitorSmartphone size={15} />} title={t('settings.sessionsTitle')}
        subtitle={t('settings.sessionsSubtitle')}
        actions={others > 0
          ? <Button size="sm" variant="outline" leftIcon={<LogOut size={13} />} loading={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>{t('settings.sessionsDisconnectOthers', { count: others })}</Button>
          : undefined} />
      <Card.Body padding="none">
        {isLoading ? (
          <div style={{ padding: 'var(--espace-4)' }}><Skeleton height={48} /></div>
        ) : sessions.length === 0 ? (
          <p style={{ padding: 'var(--espace-4)', margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>{t('settings.sessionsNone')}</p>
        ) : (
          sessions.map((s, i) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
              padding: 'var(--espace-3) var(--espace-4)',
              borderTop: i > 0 ? '1px solid var(--bordure-legere)' : 'none',
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--ap-50)', color: 'var(--ap-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MonitorSmartphone size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {parseUserAgent(s.userAgent).label}
                  {s.current && <StatusPill tone="success" dot={false} size="sm">{t('settings.sessionsThis')}</StatusPill>}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={11} /> {geoLabel(s.localisation)}
                  </span>
                  {formatCoords(s.localisation) && (
                    mapsUrl(s.localisation)
                      ? <a href={mapsUrl(s.localisation)!} target="_blank" rel="noopener noreferrer"
                           style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ap-600)', textDecoration: 'none' }}>
                          <Navigation size={11} /> {formatCoords(s.localisation)}
                        </a>
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Navigation size={11} /> {formatCoords(s.localisation)}
                        </span>
                  )}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Globe size={11} /> {s.ipAdresse ?? t('settings.sessionsUnknownIp')}
                  </span>
                  <span>{t('settings.sessionsOpenedOn', { date: formatDateTime(s.createdAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</span>
                </p>
              </div>
              {!s.current && (
                <Button size="sm" variant="ghost" loading={revoke.isPending && revoke.variables === s.id} onClick={() => revoke.mutate(s.id)}
                  style={{ color: 'var(--erreur-accent)' }}>{t('settings.sessionsRevoke')}</Button>
              )}
            </div>
          ))
        )}
      </Card.Body>
    </Card>
  )
}

// ── Mot de passe ──────────────────────────────────────────────────────────────

function MotDePasseCard() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <Card.Header icon={<KeyRound size={15} />} title={t('settings.passwordTitle')} subtitle={t('settings.passwordSubtitle')} />
      <Card.Body padding="md">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--espace-3)' }}>
          <span style={{ fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>
            {t('settings.passwordPolicyHint')}
          </span>
          <Button size="sm" variant="outline" leftIcon={<KeyRound size={13} />} onClick={() => setOpen(true)}>{t('settings.passwordChange')}</Button>
        </div>
      </Card.Body>
      <ChangePasswordDialog open={open} onClose={() => setOpen(false)} />
    </Card>
  )
}
