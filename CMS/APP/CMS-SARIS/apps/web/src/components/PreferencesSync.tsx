/**
 * PreferencesSync — applique les préférences personnelles de l'utilisateur
 * connecté à toute l'application : thème (mode sombre), densité, langue.
 *
 * Monté uniquement dans la zone authentifiée. Rend null.
 */

import { useEffect } from 'react'
import { useTheme } from '@/components/theme-provider'
import { useMyPreferences } from '@/modules/admin/hooks/useAdmin'
import { setLanguage } from '@/i18n/config'
import { desktopBridge, isDesktop } from '@/lib/desktop'
import { useSessionStore } from '@/stores/session.store'

export const THEME_MAP = { clair: 'light', sombre: 'dark', auto: 'system' } as const

export function PreferencesSync() {
  const { data: pref } = useMyPreferences()
  const { setTheme } = useTheme()
  const userId = useSessionStore(s => s.user?.id)

  // Provisionne l'espace de fichiers PROPRE au compte connecté (façon WhatsApp
  // Desktop) — dossiers Documents/Images/Vidéos/Audio dédiés, jamais partagés
  // entre comptes sur un même poste. Desktop uniquement, sans effet en web/PWA.
  useEffect(() => {
    if (isDesktop && userId) void desktopBridge()?.media.ensureDirs(userId)
  }, [userId])

  // IMPORTANT : on dépend des VALEURS, pas de l'objet `pref`. Sinon un simple
  // refetch de la query (déclenché p.ex. en ouvrant l'onglet Personnel après
  // expiration du staleTime) renverrait un nouvel objet et rejouerait setTheme(),
  // écrasant un choix local (raccourci clavier, aperçu) → bascule de thème non
  // sollicitée. En dépendant des valeurs, un refetch idempotent n'applique rien.
  const theme   = pref?.theme
  const densite = pref?.densite
  const langue  = pref?.langue

  // Thème → bascule la classe .dark/.light (gère 'system' via le ThemeProvider)
  useEffect(() => {
    if (theme) setTheme(THEME_MAP[theme] ?? 'system')
  }, [theme, setTheme])

  // Densité → attribut sur <html> (override des --espace-*)
  useEffect(() => {
    if (densite) document.documentElement.setAttribute('data-densite', densite)
  }, [densite])

  // Langue → applique réellement la langue de l'interface (i18n) + attribut lang du document.
  useEffect(() => {
    if (langue === 'fr' || langue === 'en') setLanguage(langue)
  }, [langue])

  return null
}
