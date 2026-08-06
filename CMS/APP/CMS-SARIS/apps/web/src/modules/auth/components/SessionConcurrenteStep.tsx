/**
 * SessionConcurrenteStep — 3e étape de connexion : une session tourne déjà ailleurs.
 *
 * Le mot de passe (et le code TOTP le cas échéant) sont déjà validés ; il ne reste
 * qu'une décision à prendre. On la présente avec de quoi la prendre : quel appareil,
 * quel lieu, et surtout depuis quand il n'y a plus eu d'activité. « Actif il y a 30 s »
 * et « plus rien depuis ce matin » n'appellent pas la même réaction.
 *
 * Trois issues, dont une qui ne connecte pas : si ce n'est pas soi, entrer dans le
 * compte reviendrait à cohabiter avec l'intrus. Le refermer coupe son accès.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { MonitorSmartphone, MapPin, Clock, ShieldAlert, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import type { SessionConcurrente } from '@cms-saris/types'
import { parseUserAgent } from '@/lib/userAgent'
import { formatDateTime } from '@/lib/intl'

interface Props {
  session:   SessionConcurrente
  onDecider: (action: 'REMPLACER' | 'SIGNALER') => void
  enCours:   boolean
  erreur?:   string
  onAnnuler: () => void
}

/** « il y a 3 minutes », « il y a 2 heures »… Volontairement grossier : l'ordre de
 *  grandeur suffit à décider, la précision à la seconde n'apporte rien. */
function depuis(iso: string, t: TFunction): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.round(ms / 60_000)
  if (min < 1)  return t('auth.sessionMaintenant',  { defaultValue: "à l'instant" })
  if (min < 60) return t('auth.sessionIlYaMin',     { defaultValue: 'il y a {{n}} min', n: min })
  const h = Math.round(min / 60)
  if (h < 24)   return t('auth.sessionIlYaHeures',  { defaultValue: 'il y a {{n}} h', n: h })
  const j = Math.round(h / 24)
  return t('auth.sessionIlYaJours', { defaultValue: 'il y a {{n}} j', n: j })
}

export function SessionConcurrenteStep({ session, onDecider, enCours, erreur, onAnnuler }: Props) {
  const { t } = useTranslation()
  const [confirmeSignalement, setConfirmeSignalement] = useState(false)

  const appareil = session.userAgent
    ? parseUserAgent(session.userAgent).label
    : t('auth.sessionAppareilInconnu', { defaultValue: 'Appareil inconnu' })

  // La dernière activité prime sur l'heure d'ouverture : c'est elle qui dit si
  // quelqu'un est encore devant l'écran.
  const reference = session.derniereActiviteA ?? session.ouverteA
  const active = Date.now() - new Date(reference).getTime() < 5 * 60_000

  return (
    <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200">

      {/* ── Titre ─────────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-start gap-3">
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          background: 'var(--avert-fond)', color: 'var(--avert-texte)',
        }}>
          <ShieldAlert size={17} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h2 className="text-sm font-medium" style={{ color: 'var(--texte-primaire)' }}>
            {t('auth.sessionTitre', { defaultValue: 'Une session est déjà ouverte' })}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--texte-tertiaire)' }}>
            {t('auth.sessionSousTitre', {
              defaultValue: 'Votre compte est utilisé sur un autre appareil en ce moment.',
            })}
          </p>
        </div>
      </div>

      {/* ── Carte : d'où vient l'autre session ────────────────────────── */}
      <div style={{
        border: '1px solid var(--bordure-legere)',
        borderRadius: 10,
        background: 'var(--fond-surface-2)',
        padding: '11px 13px',
        display: 'flex', flexDirection: 'column', gap: 8,
        marginBottom: 14,
      }}>
        <Ligne icone={<MonitorSmartphone size={13} />} valeur={appareil} />
        {session.lieu && <Ligne icone={<MapPin size={13} />} valeur={session.lieu} />}
        <Ligne
          icone={<Clock size={13} />}
          valeur={
            session.derniereActiviteA
              ? t('auth.sessionDerniereActivite', {
                  defaultValue: 'Dernière activité {{quand}}',
                  quand: depuis(session.derniereActiviteA, t),
                })
              : t('auth.sessionOuverteLe', {
                  defaultValue: 'Ouverte le {{quand}}',
                  quand: formatDateTime(session.ouverteA),
                })
          }
          accent={active}
        />
      </div>

      {erreur && (
        <p className="text-xs mb-3" style={{ color: 'var(--erreur-texte)' }}>{erreur}</p>
      )}

      {/* ── Décision ──────────────────────────────────────────────────── */}
      {!confirmeSignalement ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button
            onClick={() => onDecider('REMPLACER')}
            disabled={enCours}
            style={{ background: 'var(--ap-500)', color: '#fff', height: 38, fontSize: 13, gap: 7 }}
          >
            {enCours ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            {t('auth.sessionCEtaitMoi', { defaultValue: "C'était moi — fermer l'autre session" })}
          </Button>

          <Button
            variant="outline"
            onClick={() => setConfirmeSignalement(true)}
            disabled={enCours}
            style={{ height: 36, fontSize: 12.5, gap: 6, color: 'var(--erreur-texte)', borderColor: 'var(--erreur-bordure, var(--bordure-normale))' }}
          >
            <ShieldAlert size={13} />
            {t('auth.sessionPasMoi', { defaultValue: "Ce n'est pas moi" })}
          </Button>

          <button
            onClick={onAnnuler}
            disabled={enCours}
            className="text-xs mt-1 transition-colors"
            style={{ color: 'var(--texte-tertiaire)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {t('auth.sessionAnnuler', { defaultValue: 'Annuler' })}
          </button>
        </div>
      ) : (
        // Confirmation : le signalement ferme TOUT et ne connecte pas. On le dit avant.
        <div style={{
          border: '1px solid var(--erreur-bordure, var(--bordure-normale))',
          borderRadius: 10, padding: '11px 13px',
          background: 'var(--erreur-fond)',
          display: 'flex', flexDirection: 'column', gap: 9,
        }}>
          <p className="text-xs" style={{ color: 'var(--erreur-texte)', margin: 0, lineHeight: 1.5 }}>
            {t('auth.sessionPasMoiExplication', {
              defaultValue:
                'Toutes les sessions de votre compte vont être fermées et un administrateur sera alerté. Vous ne serez pas connecté : changez votre mot de passe dès que possible.',
            })}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="outline"
              onClick={() => setConfirmeSignalement(false)}
              disabled={enCours}
              style={{ height: 34, fontSize: 12.5, flex: 1 }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => onDecider('SIGNALER')}
              disabled={enCours}
              style={{ height: 34, fontSize: 12.5, flex: 1, gap: 6, background: 'var(--erreur-texte)', color: '#fff' }}
            >
              {enCours ? <Loader2 size={13} className="animate-spin" /> : <ShieldAlert size={13} />}
              {t('auth.sessionPasMoiConfirmer', { defaultValue: 'Fermer tout' })}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Ligne({ icone, valeur, accent }: { icone: React.ReactNode; valeur: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span style={{ color: 'var(--texte-tertiaire)', display: 'flex', flexShrink: 0 }}>{icone}</span>
      <span style={{
        fontSize: 12.5,
        color: accent ? 'var(--avert-texte)' : 'var(--texte-secondaire)',
        fontWeight: accent ? 600 : 400,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {valeur}
      </span>
    </div>
  )
}
