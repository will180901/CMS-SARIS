/**
 * ParametresPage — navigation à 2 niveaux :
 *   - Niveau 1 (onglets pills)      : Généraux (système) / Personnel (compte connecté)
 *   - Niveau 2 (sous-nav verticale) : sous-pages de la catégorie active
 *
 * Généraux  : paramètres système RÉELLEMENT appliqués (perm parametre.read/update).
 * Personnel : réglages du compte connecté (self-service), dont langue & mentions légales.
 */

import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Settings, SlidersHorizontal, UserCog, Bell, ShieldCheck, KeyRound,
  Palette, MonitorSmartphone, Languages, FileText, Lock, Info, Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader, SegmentedTabs } from '@/components/saris'
import { usePermissions } from '@/hooks/usePermissions'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ConditionsModal } from '@/components/ConditionsModal'
import { useUpdateMyPreferences } from '../hooks/useAdmin'
import { GenerauxTab } from '../components/parametres/GenerauxTab'
import { PersonnelTab } from '../components/parametres/PersonnelTab'

type Tab = 'generaux' | 'personnel'

interface SectionItem { key: string; label: string; icon: ReactNode; hint?: string }

export function ParametresPage() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const isCompact = useIsCompact()
  const canReadGeneraux = has('parametre.read')
  const canWrite = has('parametre.update')

  // Pour Généraux : la clé = nom du groupe (sert au filtrage des paramètres système).
  const generauxSections: SectionItem[] = [
    { key: 'comptes', label: t('settings.genAccounts'), icon: <Users size={15} />, hint: t('settings.genAccountsHint') },
    { key: 'Sécurité & authentification', label: t('settings.genSecurity'), icon: <ShieldCheck size={15} />, hint: t('settings.genSecurityHint') },
    { key: 'Politique de mot de passe', label: t('settings.genPassword'), icon: <KeyRound size={15} />, hint: t('settings.genPasswordHint') },
    { key: 'Notifications', label: t('settings.genNotifications'), icon: <Bell size={15} />, hint: t('settings.genNotificationsHint') },
  ]
  const personnelSections: SectionItem[] = [
    { key: 'preferences', label: t('settings.secPreferences'), icon: <Palette size={15} />, hint: t('settings.secPreferencesHint') },
    { key: 'securite', label: t('settings.secAccountSecurity'), icon: <ShieldCheck size={15} />, hint: t('settings.secAccountSecurityHint') },
    { key: 'sessions', label: t('settings.secSessions'), icon: <MonitorSmartphone size={15} />, hint: t('settings.secSessionsHint') },
    { key: 'legal', label: t('settings.secLegalLang'), icon: <Languages size={15} />, hint: t('settings.secLegalLangHint') },
  ]

  const initialTop: Tab = canReadGeneraux ? 'generaux' : 'personnel'
  const [topTab, setTopTab] = useState<Tab>(initialTop)
  const [sub, setSub] = useState<string>(
    (initialTop === 'generaux' ? generauxSections : personnelSections)[0]!.key,
  )

  const sections = topTab === 'generaux' ? generauxSections : personnelSections

  function changeTop(k: Tab) {
    setTopTab(k)
    setSub((k === 'generaux' ? generauxSections : personnelSections)[0]!.key)
  }

  const topTabs = [
    ...(canReadGeneraux ? [{ key: 'generaux', label: t('settings.tabGeneral'), icon: <SlidersHorizontal size={14} /> }] : []),
    { key: 'personnel', label: t('settings.tabPersonal'), icon: <UserCog size={14} /> },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <PageHeader icon={<Settings size={18} />} title={t('settings.title')} subtitle={t('settings.subtitle')} />

      {/* Niveau 1 — onglets pills */}
      <div style={{ padding: 'var(--espace-4) var(--espace-6) 0' }}>
        <SegmentedTabs value={topTab} onChange={(k) => changeTop(k as Tab)} tabs={topTabs} aria-label={t('settings.title')} />
      </div>

      {/* Niveau 2 — sous-nav verticale + contenu (empilés sur petit écran) */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: isCompact ? 'column' : 'row', gap: 'var(--espace-5)', padding: 'var(--espace-4) var(--espace-6) var(--espace-6)' }}>
        <SubNav items={sections} value={sub} onChange={setSub} compact={isCompact} />
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto' }}>
          {topTab === 'generaux' && canReadGeneraux && sub === 'comptes' && <ComptesAccesShortcut />}
          {topTab === 'generaux' && canReadGeneraux && sub !== 'comptes' && <GenerauxTab canWrite={canWrite} section={sub} />}
          {topTab === 'personnel' && sub === 'legal' && <LegalLangSection />}
          {topTab === 'personnel' && sub !== 'legal' && <PersonnelTab section={sub} />}
        </div>
      </div>
    </div>
  )
}

// ── Section « Langue & mentions légales » (bilingue) ──────────────────────────

function LegalLangSection() {
  const { t } = useTranslation()
  const [modal, setModal] = useState<null | 'cgu' | 'privacy'>(null)
  const updatePref = useUpdateMyPreferences()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)', maxWidth: 640 }}>
      <SettingCard icon={<Languages size={16} />} title={t('settings.sectionLanguage')} hint={t('settings.languageHint')}>
        <LanguageSwitcher onChange={(l) => updatePref.mutate({ langue: l })} />
      </SettingCard>

      <SettingCard icon={<FileText size={16} />} title={t('settings.sectionLegal')}>
        <div style={{ display: 'flex', gap: 'var(--espace-2)', flexWrap: 'wrap' }}>
          <LegalButton icon={<FileText size={14} />} label={t('settings.legalTerms')} onClick={() => setModal('cgu')} />
          <LegalButton icon={<Lock size={14} />} label={t('settings.legalPrivacy')} onClick={() => setModal('privacy')} />
        </div>
      </SettingCard>

      <SettingCard icon={<Info size={16} />} title={t('settings.sectionAbout')}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--texte-secondaire)' }}>{t('settings.aboutVersion')} : CMS SARIS v0.1.0</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--texte-secondaire)' }}>{t('settings.aboutAuthor')} : Déo Cherel BOUWAYI MIKOUYA</p>
      </SettingCard>

      <ConditionsModal open={modal === 'cgu'} kind="cgu" onClose={() => setModal(null)} />
      <ConditionsModal open={modal === 'privacy'} kind="privacy" onClose={() => setModal(null)} />
    </div>
  )
}

// ── Raccourci « Comptes & accès » (contrôle admin depuis les Généraux) ────────

function ComptesAccesShortcut() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)', maxWidth: 640 }}>
      <SettingCard icon={<Users size={16} />} title={t('settings.accountsTitle')} hint={t('settings.accountsHint')}>
        <p style={{ margin: '0 0 var(--espace-3)', fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.5 }}>
          {t('settings.accountsDesc')}
        </p>
        <div style={{ display: 'flex', gap: 'var(--espace-2)', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => navigate('/admin/utilisateurs')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'var(--ap-400)', color: '#fff', border: 'none' }}>
            <Users size={14} /> {t('settings.accountsManage')}
          </button>
          <button type="button" onClick={() => navigate('/admin/roles')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'var(--fond-surface-2)', color: 'var(--texte-primaire)', border: '1px solid var(--bordure-legere)' }}>
            <ShieldCheck size={14} /> {t('settings.accountsRoles')}
          </button>
        </div>
      </SettingCard>
    </div>
  )
}

function SettingCard({ icon, title, hint, children }: { icon: ReactNode; title: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-lg)', padding: 'var(--espace-4) var(--espace-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', marginBottom: hint ? 2 : 'var(--espace-3)' }}>
        <span style={{ color: 'var(--ap-600)', display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--texte-primaire)' }}>{title}</span>
      </div>
      {hint && <p style={{ margin: '0 0 var(--espace-3)', fontSize: 12, color: 'var(--texte-tertiaire)' }}>{hint}</p>}
      {children}
    </div>
  )
}

function LegalButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600,
        padding: '8px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
        background: 'var(--fond-surface-2)', color: 'var(--texte-primaire)', border: '1px solid var(--bordure-legere)',
      }}
    >
      {icon} {label}
    </button>
  )
}

// ── Sous-navigation verticale (rail de sous-pages) ────────────────────────────

function SubNav({ items, value, onChange, compact = false }: { items: SectionItem[]; value: string; onChange: (k: string) => void; compact?: boolean }) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('settings.sectionsAria')} style={
      compact
        ? { flexShrink: 0, display: 'flex', flexDirection: 'row', gap: 6, overflowX: 'auto', paddingBottom: 4 }
        : { width: 232, flexShrink: 0, alignSelf: 'flex-start', position: 'sticky', top: 0, display: 'flex', flexDirection: 'column', gap: 2 }
    }>
      {items.map((it) => {
        const active = it.key === value
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            aria-current={active ? 'page' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
              padding: '10px 12px', borderRadius: 'var(--radius-md)',
              border: '1px solid transparent', cursor: 'pointer', textAlign: 'left',
              width: compact ? 'auto' : '100%', flexShrink: compact ? 0 : undefined, whiteSpace: compact ? 'nowrap' : undefined,
              background: active ? 'var(--ap-50)' : 'transparent',
              borderColor: active ? 'var(--ap-200)' : 'transparent',
              transition: 'background .12s, color .12s',
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--fond-surface-2)' }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{
              width: 30, height: 30, borderRadius: 'var(--radius-md)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: active ? 'var(--fond-surface)' : 'var(--fond-surface-2)',
              color: active ? 'var(--ap-600)' : 'var(--texte-tertiaire)',
              border: active ? '1px solid var(--ap-200)' : '1px solid var(--bordure-legere)',
            }}>
              {it.icon}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 'var(--font-size-body-sm)', fontWeight: active ? 600 : 500, color: active ? 'var(--ap-700)' : 'var(--texte-primaire)' }}>
                {it.label}
              </span>
              {it.hint && !compact && (
                <span style={{ display: 'block', fontSize: 'var(--font-size-overline)', color: 'var(--texte-tertiaire)', marginTop: 1 }}>
                  {it.hint}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
