/**
 * Internationalisation (FR/EN) — react-i18next.
 * Langue persistée dans localStorage (`cms-saris-lang`), défaut français.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { fr } from './locales/fr'
import { en } from './locales/en'
import { acteurs } from './locales/modules/acteurs'
import { admin } from './locales/modules/admin'
import { bonExamen } from './locales/modules/bonExamen'
import { bonPharmacie } from './locales/modules/bonPharmacie'
import { consultation } from './locales/modules/consultation'
import { dashboard } from './locales/modules/dashboard'
import { employes } from './locales/modules/employes'
import { labels } from './locales/modules/labels'
import { messagerie } from './locales/modules/messagerie'
import { patients } from './locales/modules/patients'
import { personnelSoignant } from './locales/modules/personnelSoignant'
import { referentiels } from './locales/modules/referentiels'
import { sorties } from './locales/modules/sorties'
import { triage } from './locales/modules/triage'

// Espaces de noms par module (un fichier i18n par module, fusionnés sous leur préfixe).
const MODULES_FR = {
  acteurs: acteurs.fr, admin: admin.fr, bonExamen: bonExamen.fr, bonPharmacie: bonPharmacie.fr, consultation: consultation.fr,
  dashboard: dashboard.fr, employes: employes.fr, labels: labels.fr, messagerie: messagerie.fr, patients: patients.fr,
  personnelSoignant: personnelSoignant.fr,
  referentiels: referentiels.fr, sorties: sorties.fr, triage: triage.fr,
}
const MODULES_EN = {
  acteurs: acteurs.en, admin: admin.en, bonExamen: bonExamen.en, bonPharmacie: bonPharmacie.en, consultation: consultation.en,
  dashboard: dashboard.en, employes: employes.en, labels: labels.en, messagerie: messagerie.en, patients: patients.en,
  personnelSoignant: personnelSoignant.en,
  referentiels: referentiels.en, sorties: sorties.en, triage: triage.en,
}

export const LANG_KEY = 'cms-saris-lang'
export type Lang = 'fr' | 'en'

function initialLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY)
    if (v === 'fr' || v === 'en') return v
  } catch {
    /* localStorage indisponible */
  }
  return 'fr'
}

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: { ...fr, ...MODULES_FR } },
    en: { translation: { ...en, ...MODULES_EN } },
  },
  lng: initialLang(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  returnNull: false,
})

if (typeof document !== 'undefined') document.documentElement.lang = i18n.language

/** Change la langue de toute la plateforme (et la persiste). */
export function setLanguage(lng: Lang): void {
  void i18n.changeLanguage(lng)
  try {
    localStorage.setItem(LANG_KEY, lng)
  } catch {
    /* noop */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lng
}

export function currentLang(): Lang {
  return (i18n.language as Lang) || 'fr'
}

export default i18n
