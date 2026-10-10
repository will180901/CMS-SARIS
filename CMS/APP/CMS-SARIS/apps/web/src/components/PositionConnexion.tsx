/**
 * PositionConnexion — relève la position de l'APPAREIL à chaque connexion web, en
 * arrière-plan, et la range sur la ligne du journal que la connexion a ouverte.
 *
 * L'application ne demande rien à l'utilisateur : le relevé part tout seul dès l'ouverture
 * de la session. Le NAVIGATEUR, lui, affiche sa propre invite d'autorisation la première
 * fois — aucun code ne peut la contourner ; l'utilisateur la voit une seule fois s'il
 * choisit « Autoriser » (ou jamais, si l'informaticien du centre déploie la règle
 * `AllowGeolocationForUrls` sur les navigateurs).
 *
 * Si la position manque (refus, appareil sans moyen de se localiser) :
 *  - par défaut, la connexion est acceptée, un bandeau le dit et le journal le signale en
 *    rouge — la personne n'est jamais enfermée dehors par un navigateur mal réglé ;
 *  - si le centre l'exige (réglage « position obligatoire »), l'application est verrouillée
 *    tant que la position manque. L'administrateur système n'est jamais verrouillé : il reste
 *    tracé, mais doit pouvoir retirer l'exigence.
 *
 * Client de bureau : sans objet ici — la position d'un poste est celle enregistrée à son
 * installation.
 */

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { MapPinOff, RefreshCw, LogOut, HelpCircle } from 'lucide-react'
import { Button } from '@/components/saris'
import { isDesktop } from '@/lib/desktop'
import { useSessionStore } from '@/stores/session.store'
import { useLogout } from '@/modules/auth/hooks/useLogout'
import {
  useEtatPosition, useReleverPosition, useMyPreferences, ME_KEYS,
} from '@/modules/admin/hooks/useAdmin'

export function PositionConnexion() {
  const { t } = useTranslation()
  const user = useSessionStore(s => s.user)
  const actif = !isDesktop && !!user
  const qc = useQueryClient()
  const { data: etat } = useEtatPosition(actif, user?.id)
  const { data: pref } = useMyPreferences()
  const { mutate: relever, isPending } = useReleverPosition()
  const logout = useLogout()
  const lance = useRef(false)
  const [aide, setAide] = useState(false)

  // À la déconnexion (le shell se démonte), l'état de CETTE connexion est oublié : la
  // suivante, dans le même onglet, doit relever sa propre position.
  useEffect(() => () => { qc.removeQueries({ queryKey: ME_KEYS.position }) }, [qc])

  // Relevé automatique, une fois par chargement tant que la position manque (une page
  // rechargée après avoir autorisé la position dans le navigateur la récupère donc).
  useEffect(() => {
    if (!etat?.suivie || etat.statut === 'OK' || lance.current) return
    lance.current = true
    relever()
  }, [etat, relever])

  if (!actif || !etat?.suivie || etat.statut === 'OK') return null

  const echec = !isPending && etat.statut !== null
  const bloque = etat.bloquant && pref?.cguAJour !== false

  const aideTexte = (
    <p style={{ margin: 'var(--espace-2) 0 0', fontSize: 'var(--font-size-caption)', color: 'inherit', lineHeight: 1.5 }}>
      {t('position.commentEtapes')}
    </p>
  )

  // ── Verrou : le centre exige la position ───────────────────────────────────
  if (bloque) {
    return (
      <div
        role="alertdialog" aria-modal="true" aria-label={t('position.verrouTitre')}
        style={{
          position: 'fixed', inset: 0, zIndex: 1500,
          background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}
      >
        <div style={{
          width: 440, maxWidth: '100%', background: 'var(--fond-surface)',
          border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--ombre-2)', padding: 'var(--espace-6)',
          display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 'var(--radius-lg)', background: 'var(--avert-fond)',
            color: 'var(--avert-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MapPinOff size={20} />
          </div>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-h4)', fontWeight: 700, color: 'var(--texte-primaire)' }}>
            {t('position.verrouTitre')}
          </h2>
          <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)', lineHeight: 1.5 }}>
            {isPending ? t('position.attenteNavigateur') : t('position.verrouTexte')}
          </p>
          {echec && (
            <div style={{ color: 'var(--texte-secondaire)' }}>{aideTexte}</div>
          )}
          <div style={{ display: 'flex', gap: 'var(--espace-2)', justifyContent: 'flex-end', marginTop: 'var(--espace-2)', flexWrap: 'wrap' }}>
            <Button variant="outline" size="sm" leftIcon={<LogOut size={13} />} loading={logout.isPending} onClick={() => logout.mutate()}>
              {t('position.deconnexion')}
            </Button>
            <Button variant="primary" size="sm" leftIcon={<RefreshCw size={13} />} loading={isPending} onClick={() => relever()}>
              {t('position.reessayer')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Bandeau : la connexion est acceptée, mais la position manque ───────────
  if (isPending || etat.statut === null) return null
  return (
    <div
      role="status"
      style={{
        flexShrink: 0, margin: '0 var(--espace-4)', padding: 'var(--espace-2) var(--espace-3)',
        background: 'var(--avert-fond)', border: '1px solid var(--avert-bordure)',
        borderRadius: 'var(--radius-md)', color: 'var(--avert-texte)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-2)', flexWrap: 'wrap' }}>
        <MapPinOff size={15} style={{ flexShrink: 0, color: 'var(--avert-accent)' }} />
        <p style={{ margin: 0, flex: 1, minWidth: 200, fontSize: 'var(--font-size-body-sm)', lineHeight: 1.4 }}>
          <strong>{t('position.bandeauTitre')}</strong>{' '}{t('position.bandeauTexte')}
        </p>
        <button
          type="button" onClick={() => setAide(v => !v)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 'var(--font-size-caption)', fontWeight: 600 }}
        >
          <HelpCircle size={13} /> {t('position.comment')}
        </button>
        <Button variant="outline" size="sm" leftIcon={<RefreshCw size={13} />} onClick={() => relever()}>
          {t('position.reessayer')}
        </Button>
      </div>
      {aide && aideTexte}
    </div>
  )
}
