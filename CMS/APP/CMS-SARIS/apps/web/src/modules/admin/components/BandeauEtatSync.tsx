/**
 * BandeauEtatSync — la réponse à « est-ce que tout va bien ? », en une seconde.
 *
 * L'ancienne page ouvrait sur quatre onglets et trois sous-onglets : pour savoir si le
 * poste de Nkayi avait remonté ses données, il fallait deux clics et savoir où chercher.
 * Un écran de supervision doit dire l'essentiel AVANT qu'on ait cliqué.
 *
 * Une seule phrase, dont le ton suit la gravité réelle :
 *   • rien d'anormal          → vert, on passe son chemin ;
 *   • des postes muets        → orange, avec leur nombre ;
 *   • des conflits en attente → rouge, car ils demandent une décision humaine.
 *
 * Un poste « muet » n'est pas un poste hors ligne : un poste éteint la nuit est normal.
 * C'est le silence PROLONGÉ d'une machine qui devrait travailler qui mérite l'alerte —
 * d'où le seuil en heures plutôt qu'en minutes.
 */
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertTriangle, XCircle, Radio } from 'lucide-react'

/** Au-delà, un poste qui ne donne plus signe de vie est signalé. */
export const SEUIL_MUET_MS = 2 * 60 * 60 * 1000

export interface EtatSync {
  total:      number
  enLigne:    number
  muets:      number
  conflits:   number
}

type Ton = 'ok' | 'attention' | 'critique'

export function BandeauEtatSync({ etat, loading }: { etat: EtatSync; loading?: boolean }) {
  const { t } = useTranslation()

  const ton: Ton = etat.conflits > 0 ? 'critique' : etat.muets > 0 ? 'attention' : 'ok'

  const COULEURS: Record<Ton, { fond: string; texte: string; bordure: string }> = {
    ok:        { fond: 'var(--succes-fond)', texte: 'var(--succes-texte)', bordure: 'var(--succes-accent)' },
    attention: { fond: 'var(--avert-fond)',  texte: 'var(--avert-texte)',  bordure: 'var(--avert-accent)' },
    critique:  { fond: 'var(--erreur-fond)', texte: 'var(--erreur-texte)', bordure: 'var(--erreur-accent)' },
  }
  const c = COULEURS[ton]
  const Icone = ton === 'ok' ? CheckCircle2 : ton === 'attention' ? AlertTriangle : XCircle

  // La phrase est construite par gravité décroissante : ce qui bloque d'abord.
  const phrase = loading
    ? t('admin.syncEtatChargement', { defaultValue: 'Relevé de l’état du parc…' })
    : etat.total === 0
      ? t('admin.syncEtatAucunPoste', { defaultValue: 'Aucun poste déclaré pour l’instant.' })
      : etat.conflits > 0
        ? t('admin.syncEtatConflits', {
            defaultValue: '{{n}} conflit(s) à trancher — des données divergent entre un poste et le serveur.',
            n: etat.conflits,
          })
        : etat.muets > 0
          ? t('admin.syncEtatMuets', {
              defaultValue: '{{n}} poste(s) sans signe de vie depuis plus de 2 h.',
              n: etat.muets,
            })
          : t('admin.syncEtatOk', {
              defaultValue: 'Tout est à jour — {{n}} poste(s) synchronisé(s).',
              n: etat.total,
            })

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 'var(--espace-3)',
      padding: '14px 18px',
      borderRadius: 'var(--radius-lg)',
      background: c.fond,
      border: `1px solid ${c.bordure}`,
      borderLeft: `4px solid ${c.bordure}`,
    }}>
      <Icone size={20} style={{ color: c.texte, flexShrink: 0 }} />
      <p style={{ margin: 0, flex: 1, fontSize: 'var(--font-size-body)', fontWeight: 600, color: c.texte }}>
        {phrase}
      </p>

      {/* Compteurs : la lecture détaillée, pour qui veut aller plus loin que la phrase. */}
      {etat.total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-4)', flexShrink: 0 }}>
          <Compteur
            icone={<Radio size={13} />}
            valeur={etat.enLigne}
            libelle={t('admin.syncEnLigne', { defaultValue: 'en ligne' })}
            couleur={c.texte}
          />
          <Compteur
            valeur={etat.total}
            libelle={t('admin.syncPostesTotal', { defaultValue: 'postes' })}
            couleur={c.texte}
          />
        </div>
      )}
    </div>
  )
}

function Compteur({ icone, valeur, libelle, couleur }: {
  icone?: React.ReactNode
  valeur: number
  libelle: string
  couleur: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: couleur }}>
      {icone}
      <span style={{ fontSize: 'var(--font-size-h4)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {valeur}
      </span>
      <span style={{ fontSize: 'var(--font-size-caption)', opacity: 0.85 }}>{libelle}</span>
    </div>
  )
}
