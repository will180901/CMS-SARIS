/**
 * ConfirmationSiteModal — le site de travail, confirmé une fois par session.
 *
 * POURQUOI CET ÉCRAN. Le site n'appartient PAS au compte : il appartient à l'ACTE. Chaque
 * visite, chaque consultation recopie le site porté par la session au moment où elle est
 * enregistrée. La même personne peut donc travailler sur un site aujourd'hui et sur un
 * autre demain, sans que rien ne change sur son compte.
 *
 * Il faut donc le demander — une seule fois, à l'entrée, et jamais plus ensuite. Le
 * réclamer à chaque acte serait insupportable ; le deviner serait pire, car une erreur
 * silencieuse étiquetterait toute une journée de travail sur le mauvais site.
 *
 * L'écran est BLOQUANT et sans fermeture : sans site confirmé, les actes ne sauraient pas
 * où se rattacher. Mieux vaut une question franche qu'une valeur choisie à la place de
 * quelqu'un.
 *
 * Absent du CLIENT DE BUREAU : le site y est fixé à l'installation du poste et identifie
 * la machine. Poser la question reviendrait à permettre de contourner cette configuration.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Check, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useSessionStore } from '@/stores/session.store'
import { useSites } from '@/modules/referentiels/hooks/useReferentiels'
import { isDesktop } from '@/lib/desktop'
import type { UserSession } from '@cms-saris/types'

interface ReponseConfirmation {
  accessToken: string
  refreshToken: string
  user: Omit<UserSession, 'token'>
}

export function ConfirmationSiteModal() {
  const { t } = useTranslation()
  const siteConfirme = useSessionStore(s => s.siteConfirme)
  const refreshToken = useSessionStore(s => s.refreshToken)
  const siteDuCompte = useSessionStore(s => s.user?.siteId)
  const setSession = useSessionStore(s => s.setSession)
  const setSiteConfirme = useSessionStore(s => s.setSiteConfirme)

  const { data: sites = [], isLoading } = useSites()
  const [choisi, setChoisi] = useState<string>('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Le poste de bureau a déjà son site : rien à demander.
  if (isDesktop || siteConfirme || !refreshToken) return null

  // Pré-sélection sur le site du compte — une commodité, pas une vérité : il ne sert
  // qu'à éviter de repartir d'une liste vide à chaque connexion.
  const valeur = choisi || (sites.some(s => s.id === siteDuCompte) ? siteDuCompte! : (sites[0]?.id ?? ''))

  async function confirmer() {
    if (!valeur || !refreshToken) return
    setEnvoi(true); setErreur(null)
    try {
      const r = await api.post<ReponseConfirmation>('/auth/site/confirmer', {
        refreshToken,
        siteId: valeur,
      })
      // Les jetons sont RENOUVELÉS : ils portent désormais le site confirmé, qui sera
      // recopié sur chaque acte de la session.
      setSession(r.user, r.accessToken, r.refreshToken)
      setSiteConfirme(true)
    } catch {
      setErreur(t('site.confirmError'))
      setEnvoi(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      background: 'rgba(10,14,20,0.55)', backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: 'var(--fond-surface)',
        border: '1px solid var(--bordure-legere)', borderRadius: 10,
        boxShadow: '0 18px 50px rgba(0,0,0,0.24)', padding: 22,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{
            width: 34, height: 34, borderRadius: 9999, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--fond-surface-2)', color: 'var(--ap-400)',
          }}>
            <MapPin size={17} />
          </span>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--texte-primaire)' }}>
            {t('site.confirmTitle')}
          </h2>
        </div>

        <p style={{ margin: '0 0 16px 44px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--texte-secondaire)' }}>
          {t('site.confirmHelp')}
        </p>

        <select
          value={valeur}
          onChange={e => setChoisi(e.target.value)}
          disabled={isLoading || envoi}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8,
            border: '1px solid var(--bordure-normale)', background: 'var(--fond-surface)',
            color: 'var(--texte-primaire)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
          }}>
          {sites.map(s => (
            <option key={s.id} value={s.id}>{s.libelle}</option>
          ))}
        </select>

        {erreur && (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--erreur-texte, #b3261e)' }}>{erreur}</p>
        )}

        <button
          onClick={() => void confirmer()}
          disabled={!valeur || envoi || isLoading}
          style={{
            marginTop: 16, width: '100%', height: 40, borderRadius: 8, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: valeur && !envoi ? 'var(--ap-400)' : 'var(--fond-surface-2)',
            color: valeur && !envoi ? '#fff' : 'var(--texte-tertiaire)',
            fontSize: 13.5, fontWeight: 600, cursor: valeur && !envoi ? 'pointer' : 'default',
          }}>
          {envoi ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {t('site.confirmAction')}
        </button>
      </div>
    </div>
  )
}
