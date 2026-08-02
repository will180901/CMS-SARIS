/**
 * ErrorBoundary — filet de sécurité global contre les crashs de rendu.
 *
 * Sans cela, une exception levée pendant le rendu d'un composant démonte TOUT
 * l'arbre React (écran blanc) et empêche même la redirection vers /login.
 * Ici on intercepte, on journalise, et on propose à l'utilisateur de recharger
 * ou de se reconnecter — sans dépendre de composants qui pourraient eux-mêmes
 * échouer (styles inline + variables CSS uniquement).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import i18n from '@/i18n/config'
import { useSessionStore } from '@/stores/session.store'
import { isDesktop } from '@/lib/desktop'
import { DESKTOP_TITLEBAR_H } from './layout/DesktopTitleBar'
import { estChunkObsolete, tenterRechargementUnique } from '@/lib/stale-chunk'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Cas fréquent après un déploiement : la page demandée est un fichier dont le nom
    // a changé. Ce n'est pas un bug applicatif — on recharge au lieu d'afficher une
    // erreur que l'utilisateur ne peut pas comprendre ni corriger.
    if (estChunkObsolete(error) && tenterRechargementUnique()) return

    // Journalisé SANS condition : c'est la seule trace exploitable quand un incident
    // survient chez un utilisateur, où les outils de développement sont absents.
    console.error('[ErrorBoundary] Crash de rendu intercepté :', error, info.componentStack)
  }

  private handleReload = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  private handleReconnect = () => {
    useSessionStore.getState().clearSession()
    this.setState({ error: null })
    // Le routeur affichera LoginPage dès que la session est vidée.
    window.location.assign('/login')
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{
        position: 'fixed', top: isDesktop ? DESKTOP_TITLEBAR_H : 0, right: 0, bottom: 0, left: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--espace-6)',
        background: 'var(--fond-page)',
      }}>
        <div style={{
          maxWidth: 460, width: '100%',
          background: 'var(--fond-surface)',
          border: '1px solid var(--bordure-legere)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--ombre-3)',
          padding: 'var(--espace-7) var(--espace-6)',
          textAlign: 'center',
        }}>
          <div style={{
            width: 52, height: 52, margin: '0 auto var(--espace-4)',
            borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--erreur-fond)',
            color: 'var(--erreur-accent)',
          }}>
            <AlertTriangle size={26} />
          </div>

          <h1 style={{
            margin: '0 0 var(--espace-2)',
            fontSize: 'var(--font-size-h3)', fontWeight: 700,
            color: 'var(--texte-primaire)',
          }}>
            {i18n.t('shell.errorTitle')}
          </h1>

          <p style={{
            margin: '0 0 var(--espace-5)',
            fontSize: 'var(--font-size-body-sm)',
            color: 'var(--texte-secondaire)', lineHeight: 1.5,
          }}>
            {i18n.t('shell.errorDescription')}
          </p>

          <div style={{ display: 'flex', gap: 'var(--espace-3)', justifyContent: 'center' }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: 'var(--espace-2) var(--espace-5)',
                borderRadius: 'var(--radius-md)',
                border: 'none', cursor: 'pointer',
                background: 'var(--ap-500)', color: '#fff',
                fontSize: 'var(--font-size-body-sm)', fontWeight: 600,
              }}
            >
              {i18n.t('shell.errorReload')}
            </button>
            <button
              onClick={this.handleReconnect}
              style={{
                padding: 'var(--espace-2) var(--espace-5)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--bordure-normale)', cursor: 'pointer',
                background: 'var(--fond-surface)', color: 'var(--texte-secondaire)',
                fontSize: 'var(--font-size-body-sm)', fontWeight: 600,
              }}
            >
              {i18n.t('shell.errorReconnect')}
            </button>
          </div>

          {/* Détail technique disponible AUSSI en production, mais replié : sans lui,
              un incident chez un utilisateur est impossible à diagnostiquer — il ne
              peut que décrire « une erreur est survenue ». Replié par défaut pour ne
              pas inquiéter, et copiable pour être transmis au support. */}
          <details style={{ marginTop: 'var(--espace-5)', textAlign: 'left' }}>
            <summary style={{
              cursor: 'pointer', listStyle: 'none',
              fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)',
              textAlign: 'center',
            }}>
              {i18n.t('shell.errorDetails')}
            </summary>
            <pre style={{
              marginTop: 'var(--espace-3)', marginBottom: 0,
              padding: 'var(--espace-3)',
              background: 'var(--fond-surface-2)',
              border: '1px solid var(--bordure-legere)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px', color: 'var(--erreur-accent)',
              whiteSpace: 'pre-wrap', overflow: 'auto',
              maxHeight: 160,
            }}>
              {this.state.error.name}: {this.state.error.message}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
