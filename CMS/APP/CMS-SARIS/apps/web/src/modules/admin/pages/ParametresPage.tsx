/**
 * ParametresPage — réglages PERSONNELS du compte connecté, en self-service : accessible
 * à tout utilisateur authentifié, sans aucune permission.
 *
 * Les paramètres SYSTÈME (sécurité, mots de passe, notifications) ont leur propre page
 * (`/admin/parametres-systeme`, permission `parametre.read`) et leur propre entrée de
 * barre latérale — d'où la disparition du niveau d'onglets Généraux/Personnel : cette
 * page n'a plus qu'une seule nature.
 */

import { useState, type ReactNode } from 'react'
import {
  Settings, ShieldCheck,
  Palette, MonitorSmartphone, Languages, FileText, Lock, Info,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/saris'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ConditionsModal } from '@/components/ConditionsModal'
import { useUpdateMyPreferences } from '../hooks/useAdmin'
import { PersonnelTab } from '../components/parametres/PersonnelTab'
import { SettingsSubNav, type SettingsSectionItem } from '../components/parametres/SettingsSubNav'

export function ParametresPage() {
  const { t } = useTranslation()
  const isCompact = useIsCompact()

  const sections: SettingsSectionItem[] = [
    { key: 'preferences', label: t('settings.secPreferences'), icon: <Palette size={15} />, hint: t('settings.secPreferencesHint') },
    { key: 'securite', label: t('settings.secAccountSecurity'), icon: <ShieldCheck size={15} />, hint: t('settings.secAccountSecurityHint') },
    { key: 'sessions', label: t('settings.secSessions'), icon: <MonitorSmartphone size={15} />, hint: t('settings.secSessionsHint') },
    { key: 'legal', label: t('settings.secLegalLang'), icon: <Languages size={15} />, hint: t('settings.secLegalLangHint') },
  ]

  const [sub, setSub] = useState<string>(sections[0]!.key)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <PageHeader icon={<Settings size={18} />} title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: isCompact ? 'column' : 'row', gap: 'var(--espace-5)', padding: 'var(--espace-4) var(--espace-6) var(--espace-6)' }}>
        <SettingsSubNav items={sections} value={sub} onChange={setSub} compact={isCompact} />
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto' }}>
          {sub === 'legal' ? <LegalLangSection /> : <PersonnelTab section={sub} />}
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
        <p style={{ margin: 0, fontSize: 13, color: 'var(--texte-secondaire)' }}>{t('settings.aboutVersion')} : CMS SARIS v{__APP_VERSION__}</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--texte-secondaire)' }}>{t('settings.aboutAuthor')} : Déo Cherel BOUWAYI MIKOUYA et Oscarvie Verdi NZILA</p>
      </SettingCard>

      <ConditionsModal open={modal === 'cgu'} kind="cgu" onClose={() => setModal(null)} />
      <ConditionsModal open={modal === 'privacy'} kind="privacy" onClose={() => setModal(null)} />
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
