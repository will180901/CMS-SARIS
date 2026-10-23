/**
 * BulleSynchro — la synchronisation, rendue visible.
 *
 * Jusqu'ici, la synchro était un travail invisible : on ne savait jamais si les données
 * étaient à jour, en train de l'être, ou en attente d'un réseau. Sur un poste qui bascule
 * entre le serveur central et sa base locale, c'est précisément ce qu'on a besoin de voir.
 *
 * La bulle n'apparaît QUE lorsqu'il se passe quelque chose qui concerne la personne : des écritures qui
 * attendent le réseau, un envoi en cours après une coupure, ou un ordre d'administrateur. Connecté au
 * serveur central, la copie locale se tient à jour en silence : rien à montrer (cf. lib/bulleSynchro.ts).
 * Le reste du temps elle disparaît : un indicateur permanent cesse d'être lu au bout de deux jours.
 *
 * Interroge le backend EMBARQUÉ en direct (loopback, 127.0.0.1) plutôt que de passer par
 * la couche API : celle-ci change d'adresse au gré de la connectivité, alors que la bulle
 * doit parler du poste, toujours le même.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, CloudUpload, Pause } from 'lucide-react'
import { desktopBridge } from '@/lib/desktop'
import { bulleVoulue, lisser, LISSAGE_INITIAL, type LissageEtat } from '@/lib/bulleSynchro'
import { useParleAuCentral } from '@/stores/connectivity.store'
import { DESKTOP_TITLEBAR_H } from './DesktopTitleBar'

interface EtatSynchro {
  enCours: boolean
  pendingPush: boolean
  recus: number
  /** Un administrateur a suspendu les échanges de ce poste. */
  suspendu: boolean
  /** Resynchronisation complète demandée par le serveur, en cours. */
  resync: boolean
}

/** Rythme d'interrogation : assez vif pour que la bulle paraisse vivante, assez lent pour
 *  rester une requête en boucle locale sans coût — on parle à 127.0.0.1. */
const CADENCE_MS = 1200

export function BulleSynchro() {
  const { t } = useTranslation()
  const url = desktopBridge()?.localApiUrl
  const [etat, setEtat] = useState<EtatSynchro | null>(null)
  const parleAuCentral = useParleAuCentral()
  // Ce qui est AFFICHÉ suit ce que les lectures réclament, mais seulement quand elles le réclament plusieurs fois
  // de suite : une bulle qui apparaît et disparaît à chaque cycle fatigue sans informer.
  const [lissage, setLissage] = useState<LissageEtat>(LISSAGE_INITIAL)
  useEffect(() => {
    setLissage((prec) => lisser(prec, bulleVoulue(etat, parleAuCentral)))
  }, [etat, parleAuCentral])

  useEffect(() => {
    if (!url) return
    let vivant = true
    const base = url.replace(/\/+$/, '')

    const lire = async (): Promise<void> => {
      try {
        const res = await fetch(`${base}/sync/ready`)
        if (!res.ok) return
        const b = (await res.json()) as Partial<EtatSynchro>
        if (vivant) {
          setEtat({
            enCours: b.enCours === true,
            pendingPush: b.pendingPush === true,
            recus: b.recus ?? 0,
            suspendu: b.suspendu === true,
            resync: b.resync === true,
          })
        }
      } catch {
        // Backend pas encore démarré, ou en cours d'arrêt : la bulle se tait.
        if (vivant) setEtat(null)
      }
    }

    void lire()
    const id = setInterval(() => void lire(), CADENCE_MS)
    return () => { vivant = false; clearInterval(id) }
  }, [url])

  // Une SUSPENSION reste affichée tant qu'elle dure : c'est elle qui explique pourquoi rien ne
  // part ni n'arrive — sans elle, on croirait à une panne, ou on s'inquiéterait de ses saisies.
  // Ordre de priorité (cf. bulleVoulue) : suspension, resynchronisation complète, cycle en cours, attente.
  const bulle = lissage.affichee
  if (!url || !bulle) return null
  const suspendu = bulle === 'suspendue'
  const enCours = bulle === 'enCours' || bulle === 'resync'

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        // Sous la barre de titre, centrée : la même zone que les notifications, pour que
        // l'œil sache déjà où regarder.
        top: DESKTOP_TITLEBAR_H + 10,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 14px',
        borderRadius: 9999,
        background: 'var(--fond-surface)',
        border: '1px solid var(--bordure-legere)',
        boxShadow: 'var(--ombre-2, 0 6px 20px rgba(0,0,0,0.12))',
        fontSize: 'var(--font-size-caption)',
        fontWeight: 600,
        color: enCours ? 'var(--ap-700)' : 'var(--avert-texte)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none', // purement informatif : ne doit jamais gêner un clic
      }}
    >
      {suspendu ? (
        <Pause size={13} style={{ flexShrink: 0 }} />
      ) : enCours ? (
        <RefreshCw size={13} className="animate-spin" style={{ flexShrink: 0 }} />
      ) : (
        <CloudUpload size={13} style={{ flexShrink: 0 }} />
      )}
      {suspendu
        ? t('shell.syncSuspendue')
        : bulle === 'resync'
          ? t('shell.syncResync')
          : enCours
            ? t('shell.syncEnCours')
            : t('shell.syncEnAttente')}
    </div>
  )
}
