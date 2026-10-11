/**
 * DonneesTestPage — fabriquer plusieurs mois d'activité fictive du centre, puis les supprimer.
 *
 * Réservée à l'administrateur système (droit `systeme.donnees_test`) et au MODE TEST : c'est le même
 * système et la même base qu'en production, d'où les garde-fous — chaque ligne fabriquée est marquée
 * (elle se retire sans jamais toucher à une vraie donnée), et ni les comptes, ni le personnel, ni les
 * référentiels, ni la messagerie ne sont concernés.
 *
 * La génération tourne en arrière-plan sur le serveur : on peut quitter la page, y revenir, l'arrêter
 * après la journée en cours, la reprendre là où elle s'était arrêtée.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle, CheckCircle2, CirclePause, FlaskConical, Loader2, Play, RotateCcw, Square,
  Trash2, TriangleAlert, Users,
} from 'lucide-react'
import { Button, Card, EmptyState, Modal, PageHeader, Skeleton, StatusPill } from '@/components/saris'
import type { StatusTone } from '@/components/saris'
import { toast } from '@workspace/ui/components/sonner'
import { ApiError } from '@/lib/api'
import { formatDateTime, formatNumber } from '@/lib/intl'
import {
  useArreterDonneesTest,
  useEtatDonneesTest,
  useGenererDonneesTest,
  usePrevisionsDonneesTest,
  useReprendreDonneesTest,
  useSupprimerDonneesTest,
} from '../hooks/useDonneesTest'
import type { LotDonneesTest, StatutLot } from '../api/donneesTest.api'

const DUREES = [3, 4, 6, 12] as const
/** Visites par jour d'ouverture, tous sites confondus. */
const RYTHMES = [
  { cle: 'rythmeLeger', visitesParJour: 15 },
  { cle: 'rythmeStandard', visitesParJour: 40 },
  { cle: 'rythmeDense', visitesParJour: 80 },
] as const

const STATUTS: Record<StatutLot, { tone: StatusTone; cle: string }> = {
  EN_COURS: { tone: 'info', cle: 'statutEnCours' },
  TERMINE: { tone: 'success', cle: 'statutTermine' },
  INTERROMPU: { tone: 'warning', cle: 'statutInterrompu' },
  ANNULE: { tone: 'neutral', cle: 'statutAnnule' },
  ECHEC: { tone: 'error', cle: 'statutEchec' },
}

function messageDe(e: unknown): string {
  return e instanceof ApiError ? e.serverMessage : (e as Error).message
}

/** « 2 min 05 s » / « 41 s » / « 1 h 03 min » */
function duree(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')} s`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

const jourCourt = (iso: string) => iso.split('-').reverse().join('/')

export function DonneesTestPage() {
  const { t } = useTranslation()
  const { data: etat, isLoading, dataUpdatedAt } = useEtatDonneesTest()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <PageHeader
        icon={<FlaskConical size={18} />}
        title={t('donneesTest.titre')}
        subtitle={t('donneesTest.sousTitre')}
        tone="ambre"
      />
      <div style={{
        padding: 'var(--espace-4) var(--espace-6) var(--espace-6)',
        display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)',
      }}>
        {isLoading || !etat ? (
          <>
            <Skeleton height={260} />
            <Skeleton height={140} />
          </>
        ) : !etat.disponible ? (
          <EmptyState
            icon={<FlaskConical size={22} />}
            title={t('donneesTest.indisponibleTitre')}
            description={etat.raison ?? t('donneesTest.indisponibleTexte')}
          />
        ) : (
          <>
            <ZoneGenerer />
            {etat.lot && <ZoneProgression lot={etat.lot} maintenant={dataUpdatedAt} />}
            <ZoneExistantes />
          </>
        )}
      </div>
    </div>
  )
}

// ── Générer ──────────────────────────────────────────────────────────────────

function ZoneGenerer() {
  const { t } = useTranslation()
  const { data: etat } = useEtatDonneesTest()
  const [mois, setMois] = useState<number>(4)
  const [visitesParJour, setVisitesParJour] = useState<number>(40)
  const [confirmer, setConfirmer] = useState(false)
  const { data: prev } = usePrevisionsDonneesTest(mois, visitesParJour)
  const generer = useGenererDonneesTest()
  if (!etat) return null

  const equipeOk = etat.equipe.medecins > 0 && etat.equipe.infirmiers > 0
  const dejaDesDonnees = etat.existantes.total > 0
  const bloque = etat.enCours || dejaDesDonnees || !equipeOk

  function lancer() {
    generer.mutate(
      { mois, visitesParJour },
      {
        onSuccess: () => {
          setConfirmer(false)
          toast.success(t('donneesTest.lancee'))
        },
        onError: (e) => {
          setConfirmer(false)
          toast.error(messageDe(e))
        },
      },
    )
  }

  return (
    <Card padding="none">
      <Card.Header
        icon={<Play size={14} />}
        title={t('donneesTest.genererTitre')}
        subtitle={t('donneesTest.genererSousTitre')}
        tone="ambre"
      />
      <Card.Body padding="md">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--espace-5)' }}>
          {/* Réglages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>
            <Groupe titre={t('donneesTest.duree')}>
              <div role="radiogroup" aria-label={t('donneesTest.duree')} style={{ display: 'flex', gap: 'var(--espace-2)', flexWrap: 'wrap' }}>
                {DUREES.map((n) => (
                  <Choix key={n} actif={mois === n} disabled={bloque} onClick={() => setMois(n)}>
                    {t('donneesTest.dureeMois', { n })}
                  </Choix>
                ))}
              </div>
            </Groupe>
            <Groupe titre={t('donneesTest.rythme')}>
              <div role="radiogroup" aria-label={t('donneesTest.rythme')} style={{ display: 'flex', gap: 'var(--espace-2)', flexWrap: 'wrap' }}>
                {RYTHMES.map((r) => (
                  <Choix
                    key={r.cle}
                    actif={visitesParJour === r.visitesParJour}
                    disabled={bloque}
                    onClick={() => setVisitesParJour(r.visitesParJour)}
                    detail={t('donneesTest.rythmeParJour', { n: r.visitesParJour })}
                  >
                    {t(`donneesTest.${r.cle}`)}
                  </Choix>
                ))}
              </div>
            </Groupe>
            <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={13} />
              {t('donneesTest.equipe', {
                m: etat.equipe.medecins, i: etat.equipe.infirmiers, s: etat.equipe.sites,
              })}
            </p>
          </div>

          {/* Prévisions */}
          <Card muted padding="md">
            <p style={{ margin: '0 0 var(--espace-3)', fontSize: 'var(--font-size-label)', fontWeight: 700, color: 'var(--texte-secondaire)' }}>
              {t('donneesTest.previsionsTitre')}
            </p>
            {!prev ? (
              <Skeleton height={120} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
                <Ligne label={t('donneesTest.periode')} valeur={t('donneesTest.periodeValeur', { debut: jourCourt(prev.debut), fin: jourCourt(prev.fin) })} />
                <Ligne label={t('donneesTest.joursOuverts')} valeur={formatNumber(prev.joursOuverts)} />
                <Ligne label={t('donneesTest.visitesPrevues')} valeur={`≈ ${formatNumber(prev.visites)}`} />
                <Ligne label={t('donneesTest.dossiersPrevus')} valeur={`≈ ${formatNumber(prev.patients)}`} />
                <Ligne label={t('donneesTest.tailleEstimee')} valeur={`≈ ${formatNumber(Math.max(1, Math.round(prev.octets / 1048576)))} Mo`} />
                {prev.baseMo !== null && (
                  <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
                    {t('donneesTest.baseActuelle', { mo: prev.baseMo, limite: prev.limiteMo })}
                  </p>
                )}
                {prev.avertissements.map((a) => (
                  <p key={a} style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 'var(--font-size-caption)', color: 'var(--avert-texte)' }}>
                    <TriangleAlert size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{a}</span>
                  </p>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div style={{ marginTop: 'var(--espace-4)', display: 'flex', alignItems: 'center', gap: 'var(--espace-3)', flexWrap: 'wrap' }}>
          <Button leftIcon={<Play size={15} />} onClick={() => setConfirmer(true)} disabled={bloque || !prev}>
            {t('donneesTest.generer')}
          </Button>
          {!equipeOk && <Aide>{t('donneesTest.equipeManquante')}</Aide>}
          {equipeOk && dejaDesDonnees && !etat.enCours && <Aide>{t('donneesTest.existantesBloque')}</Aide>}
        </div>
      </Card.Body>

      {confirmer && prev && (
        <Modal
          icon={<FlaskConical size={18} />}
          tone="warning"
          title={t('donneesTest.confirmerTitre')}
          onClose={() => setConfirmer(false)}
          width={520}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmer(false)}>{t('common.cancel')}</Button>
              <Button leftIcon={<Play size={15} />} loading={generer.isPending} onClick={lancer}>
                {t('donneesTest.confirmerBouton')}
              </Button>
            </>
          }
        >
          <p style={{ margin: 0, fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
            {t('donneesTest.confirmerCorps', {
              visites: formatNumber(prev.visites),
              dossiers: formatNumber(prev.patients),
              debut: jourCourt(prev.debut),
              fin: jourCourt(prev.fin),
            })}
          </p>
        </Modal>
      )}
    </Card>
  )
}

function Groupe({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-2)' }}>
      <span style={{ fontSize: 'var(--font-size-label)', fontWeight: 600, color: 'var(--texte-secondaire)' }}>{titre}</span>
      {children}
    </div>
  )
}

function Choix({ actif, disabled, onClick, detail, children }: {
  actif: boolean; disabled?: boolean; onClick: () => void; detail?: string; children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={actif}
      disabled={disabled}
      onClick={onClick}
      className="saris-focus-ring"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1,
        padding: '7px 14px', borderRadius: 'var(--radius-md)', cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 'var(--font-size-body-sm)', fontWeight: actif ? 700 : 500,
        background: actif ? 'var(--ap-50)' : 'var(--fond-surface)',
        color: actif ? 'var(--ap-700)' : 'var(--texte-secondaire)',
        border: `1px solid ${actif ? 'var(--ap-300)' : 'var(--bordure-normale)'}`,
        opacity: disabled && !actif ? 0.6 : 1,
      }}
    >
      <span>{children}</span>
      {detail && <span style={{ fontSize: 'var(--font-size-caption)', fontWeight: 500, color: 'var(--texte-tertiaire)' }}>{detail}</span>}
    </button>
  )
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--espace-3)', fontSize: 'var(--font-size-body-sm)' }}>
      <span style={{ color: 'var(--texte-tertiaire)' }}>{label}</span>
      <strong style={{ color: 'var(--texte-primaire)', textAlign: 'right' }}>{valeur}</strong>
    </div>
  )
}

function Aide({ children }: { children: ReactNode }) {
  return (
    <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)', maxWidth: 520 }}>{children}</span>
  )
}

// ── Progression ──────────────────────────────────────────────────────────────

/** `maintenant` : l'instant du dernier relevé de l'état (il est relu toutes les 1,5 s pendant une génération). */
function ZoneProgression({ lot, maintenant }: { lot: LotDonneesTest; maintenant: number }) {
  const { t } = useTranslation()
  const arreter = useArreterDonneesTest()
  const reprendre = useReprendreDonneesTest()
  const p = lot.progression
  const pct = p.joursTotal > 0 ? Math.round((p.joursFaits / p.joursTotal) * 100) : 0
  const statut = STATUTS[lot.statut]
  const enCours = lot.statut === 'EN_COURS'
  const reprenable = lot.statut === 'INTERROMPU' || lot.statut === 'ANNULE' || lot.statut === 'ECHEC'

  // Durée écoulée et temps restant : une règle de trois sur les journées déjà faites.
  const depuis = new Date(lot.creeLe).getTime()
  // Une génération arrêtée ou interrompue ne « dure » plus : on s'arrête à sa dernière écriture.
  const fin = new Date(lot.termineLe ?? (enCours ? maintenant : lot.derniereMaj)).getTime()
  const ecoule = fin - depuis
  const restant = enCours && p.joursFaits > 2 ? (ecoule / p.joursFaits) * (p.joursTotal - p.joursFaits) : null

  const icone = enCours ? <Loader2 size={14} className="animate-spin" />
    : lot.statut === 'TERMINE' ? <CheckCircle2 size={14} />
    : lot.statut === 'ECHEC' ? <AlertTriangle size={14} />
    : <CirclePause size={14} />

  return (
    <Card padding="none">
      <Card.Header
        icon={icone}
        title={t('donneesTest.progressionTitre')}
        subtitle={t('donneesTest.demarreLe', { date: formatDateTime(lot.creeLe) })}
        tone={statut.tone === 'info' ? 'accent' : statut.tone === 'neutral' ? 'neutral' : statut.tone}
        actions={<StatusPill tone={statut.tone}>{t(`donneesTest.${statut.cle}`)}</StatusPill>}
      />
      <Card.Body padding="md">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={t('donneesTest.progressionTitre')}
          style={{ height: 10, borderRadius: 9999, background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)', overflow: 'hidden' }}
        >
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 9999, transition: 'width 0.4s',
            background: lot.statut === 'ECHEC' ? 'var(--erreur-accent)' : lot.statut === 'TERMINE' ? 'var(--succes-accent)' : 'var(--ap-500)',
          }} />
        </div>
        <p style={{ margin: 'var(--espace-2) 0 0', fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>
          <strong>{pct} %</strong> · {t('donneesTest.jourSur', { faits: p.joursFaits, total: p.joursTotal })}
          {p.jourCourant && <> · {t('donneesTest.dernierJour', { jour: jourCourt(p.jourCourant) })}</>}
          {' · '}{t('donneesTest.duree2', { d: duree(ecoule) })}
          {restant !== null && <> · {t('donneesTest.restant', { d: duree(restant) })}</>}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--espace-2)', marginTop: 'var(--espace-3)' }}>
          <Compteur label={t('donneesTest.cVisites')} valeur={p.visites} />
          <Compteur label={t('donneesTest.cDossiers')} valeur={p.patients} />
          <Compteur label={t('donneesTest.cConsultations')} valeur={p.consultations} />
          <Compteur label={t('donneesTest.cAnnulees')} valeur={p.visitesAnnulees} />
          {p.nonRecus > 0 && <Compteur label={t('donneesTest.cNonRecus')} valeur={p.nonRecus} />}
        </div>

        {lot.message && (
          <p style={{
            margin: 'var(--espace-3) 0 0', display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 'var(--font-size-body-sm)',
            color: lot.statut === 'ECHEC' ? 'var(--erreur-texte)' : 'var(--avert-texte)',
          }}>
            <TriangleAlert size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{lot.message}</span>
          </p>
        )}

        {(enCours || reprenable) && (
          <div style={{ marginTop: 'var(--espace-3)', display: 'flex', gap: 'var(--espace-2)', flexWrap: 'wrap' }}>
            {enCours && (
              <Button
                variant="secondary" size="sm" leftIcon={<Square size={13} />}
                loading={arreter.isPending}
                onClick={() => arreter.mutate(undefined, {
                  onSuccess: () => toast.success(t('donneesTest.arretDemande')),
                  onError: (e) => toast.error(messageDe(e)),
                })}
              >
                {t('donneesTest.arreter')}
              </Button>
            )}
            {reprenable && (
              <Button
                variant="outline" size="sm" leftIcon={<RotateCcw size={13} />}
                loading={reprendre.isPending}
                onClick={() => reprendre.mutate(undefined, {
                  onSuccess: () => toast.success(t('donneesTest.reprise')),
                  onError: (e) => toast.error(messageDe(e)),
                })}
              >
                {t('donneesTest.reprendre')}
              </Button>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}

function Compteur({ label, valeur }: { label: string; valeur: number }) {
  return (
    <div style={{
      padding: 'var(--espace-2) var(--espace-3)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--bordure-legere)', background: 'var(--fond-surface)',
    }}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.1, color: 'var(--texte-primaire)', fontVariantNumeric: 'tabular-nums' }}>
        {formatNumber(valeur)}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>{label}</p>
    </div>
  )
}

// ── Ce qui existe, et sa suppression ──────────────────────────────────────────

function ZoneExistantes() {
  const { t } = useTranslation()
  const { data: etat } = useEtatDonneesTest()
  const supprimer = useSupprimerDonneesTest()
  const [confirmer, setConfirmer] = useState(false)
  const tables = useMemo(
    () => [...(etat?.existantes.tables ?? [])].sort((a, b) => b.n - a.n),
    [etat?.existantes.tables],
  )
  if (!etat) return null
  const total = etat.existantes.total

  return (
    <Card padding="none">
      <Card.Header
        icon={<Trash2 size={14} />}
        title={t('donneesTest.existantesTitre')}
        subtitle={total > 0 ? t('donneesTest.existantesSousTitre', { n: formatNumber(total) }) : t('donneesTest.aucune')}
        tone={total > 0 ? 'ambre' : 'neutral'}
      />
      {total > 0 && (
        <Card.Body padding="md">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 'var(--espace-2)' }}>
            {tables.map((x) => <Compteur key={x.modele} label={x.libelle} valeur={x.n} />)}
          </div>
          <div style={{ marginTop: 'var(--espace-4)' }}>
            <Button variant="danger" leftIcon={<Trash2 size={15} />} disabled={etat.enCours} onClick={() => setConfirmer(true)}>
              {t('donneesTest.supprimer')}
            </Button>
            {etat.enCours && <Aide>{' '}{t('donneesTest.supprimerBloque')}</Aide>}
          </div>
        </Card.Body>
      )}

      {confirmer && (
        <Modal
          icon={<Trash2 size={18} />}
          tone="error"
          title={t('donneesTest.supprimerTitre')}
          onClose={() => setConfirmer(false)}
          width={520}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmer(false)}>{t('common.cancel')}</Button>
              <Button
                variant="danger" leftIcon={<Trash2 size={15} />} loading={supprimer.isPending}
                onClick={() => supprimer.mutate(undefined, {
                  onSuccess: (r) => {
                    setConfirmer(false)
                    toast.success(t('donneesTest.supprimees', { n: formatNumber(r.lignes) }))
                  },
                  onError: (e) => { setConfirmer(false); toast.error(messageDe(e)) },
                })}
              >
                {t('donneesTest.supprimerBouton')}
              </Button>
            </>
          }
        >
          <p style={{ margin: 0, fontSize: 13, color: 'var(--texte-secondaire)', lineHeight: 1.6 }}>
            {t('donneesTest.supprimerCorps', { n: formatNumber(total) })}
          </p>
        </Modal>
      )}
    </Card>
  )
}
