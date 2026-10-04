/**
 * EpisodeSuivi — un épisode de suivi EN ENTIER, dans le dossier du patient.
 *
 * Tout ce qui concerne ce problème au même endroit : la consultation de départ et les
 * séances de suivi, les traitements prescrits (et leur évolution), les examens prescrits
 * et leurs résultats, les relevés. Le médecin lance d'ici une SÉANCE DE SUIVI (sans
 * repasser par le triage), avec les mêmes outils de prescription qu'en consultation ; un
 * résultat peut déclencher directement une nouvelle prescription.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Activity, CalendarClock, ClipboardList, FlaskConical, Pill, Stethoscope, PenLine, ArrowUpRight, Loader2, FileText } from 'lucide-react'
import { Button, StatusPill, SegmentedTabs, DatePicker, EmptyState } from '@/components/saris'
import { usePermissions } from '@/hooks/usePermissions'
import { usePersistedState } from '@/hooks/usePersistedState'
import { formatDate } from '@/lib/intl'
import { todayISO } from '@/lib/validation'
import { nomSoignant } from '@/lib/soignant'
import { etatTraitement } from '@/lib/traitement'
import { useEpisodeSuivi, useSetProchainControle, useCreerSeanceSuivi } from '../hooks/useSuiviTraitement'
import { SuiviTraitementCard } from './SuiviTraitementCard'
import { useBonExamen } from '@/modules/bon-examen/hooks/useBonExamen'
import { SaisieResultatsModal } from '@/modules/bon-examen/components/ResultatsBon'
import type { EpisodeSuivi as Episode, RencontreEpisode, OrdonnanceEpisode, BonEpisode } from '../api/suivi-traitement.api'

type Onglet = 'chrono' | 'traitements' | 'examens' | 'releves'

const carte = {
  border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-lg)', background: 'var(--fond-surface)',
  padding: '10px 12px', display: 'flex', flexDirection: 'column' as const, gap: 4,
}
const petit = { margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }

export function EpisodeSuivi({ suiviId }: { suiviId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { has } = usePermissions()
  const { data, isLoading, isError, refetch } = useEpisodeSuivi(suiviId)
  const [onglet, setOnglet] = usePersistedState<Onglet>('dossier', 'episodeOnglet', 'chrono')
  const creerSeance = useCreerSeanceSuivi(suiviId)
  const setControle = useSetProchainControle(suiviId)
  const [maintenant] = useState(() => Date.now())

  if (isLoading) return <p style={{ ...petit, display: 'flex', alignItems: 'center', gap: 6 }}><Loader2 size={13} className="animate-spin" /> {t('suiviTraitement.loading')}</p>
  if (isError || !data) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--erreur-texte)' }}>{t('suiviTraitement.episodeIllisible')}</p>
      <Button size="sm" variant="outline" onClick={() => { void refetch() }}>{t('suiviTraitement.reessayer')}</Button>
    </div>
  )

  const { suivi } = data
  const enCours = suivi.statut === 'EN_COURS'
  const peutSeance = enCours && has('consultation.create') && has('suivi_traitement.update')
  const peutModifier = enCours && has('suivi_traitement.update')
  const seanceOuverte = data.seances.find(s => s.statut === 'OUVERTE')
  const ouvrirConsultation = (id: string) => navigate('/consultations', { state: { openConsultationId: id } })
  const lancerSeance = (motif?: string) => creerSeance.mutate(motif, { onSuccess: r => ouvrirConsultation(r.consultationId) })
  const controleDepasse = !!suivi.prochainControle && new Date(suivi.prochainControle).getTime() < maintenant

  const lignesTraitement = data.ordonnances
    .filter(o => (o.typeOrdonnance ?? 'PHARMACEUTIQUE') === 'PHARMACEUTIQUE')
    .flatMap(o => o.lignes.filter(l => l.medicament).map(l => ({ ligne: l, ord: o })))
  const enCoursTraitements = lignesTraitement.filter(({ ligne, ord }) => etatTraitement(ligne, ord.createdAt, maintenant).etat !== 'TERMINE' && !ligne.arreteLe).length
  const totalExamens = data.bons.reduce((n, b) => n + b.lignes.length, 0)
  const recus = data.bons.reduce((n, b) => n + b.lignes.filter(l => b.resultats.some(r => r.ligneExamenId === l.id) || b.resultats.some(r => !r.ligneExamenId)).length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* En-tête : le problème, d'où il vient, quand revoir le patient */}
      <div style={{ ...carte, gap: 8, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Activity size={15} style={{ color: 'var(--ap-600)' }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--texte-primaire)', flex: 1, minWidth: 0 }}>{suivi.motif}</span>
          <StatusPill tone={enCours ? 'info' : suivi.statut === 'CLOTURE' ? 'success' : 'neutral'}>
            {t(enCours ? 'suiviTraitement.statutEnCours' : suivi.statut === 'CLOTURE' ? 'suiviTraitement.statutCloture' : 'suiviTraitement.statutAnnule')}
          </StatusPill>
        </div>
        <p style={petit}>
          {t('suiviTraitement.ouvertLe', { date: formatDate(suivi.createdAt) })}
          {data.consultationInitiale?.soignant ? ` · ${nomSoignant(data.consultationInitiale.soignant, t)}` : ''}
          {data.consultationInitiale?.diagnosticPrincipal ? ` · ${data.consultationInitiale.diagnosticPrincipal}` : ''}
          {` · ${t('suiviTraitement.nbSeances', { count: data.seances.length })}`}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: controleDepasse && enCours ? 'var(--erreur-texte)' : 'var(--texte-secondaire)' }}>
            <CalendarClock size={13} /> {t('suiviTraitement.prochainControle')}
          </span>
          {peutModifier ? (
            <div style={{ width: 200 }}>
              <DatePicker
                size="sm"
                value={suivi.prochainControle ? suivi.prochainControle.slice(0, 10) : ''}
                onChange={v => setControle.mutate(v ? new Date(`${v}T09:00:00`).toISOString() : null)}
                min={todayISO()}
                placeholder={t('suiviTraitement.aucunControle')}
              />
            </div>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--texte-primaire)' }}>{suivi.prochainControle ? formatDate(suivi.prochainControle) : t('suiviTraitement.aucunControle')}</span>
          )}
          {controleDepasse && enCours && <StatusPill tone="error">{t('suiviTraitement.controleEnRetard')}</StatusPill>}
          {peutSeance && (
            <span style={{ marginLeft: 'auto' }}>
              <Button size="sm" variant="primary" leftIcon={<Stethoscope size={13} />} loading={creerSeance.isPending} onClick={() => lancerSeance()}>
                {seanceOuverte ? t('suiviTraitement.reprendreSeance') : t('suiviTraitement.nouvelleSeance')}
              </Button>
            </span>
          )}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <SegmentedTabs
          size="sm"
          value={onglet}
          onChange={k => setOnglet(k as Onglet)}
          tabs={[
            { key: 'chrono',      label: t('suiviTraitement.ongletChronologie'), icon: <ClipboardList size={13} /> },
            { key: 'traitements', label: t('suiviTraitement.ongletTraitements'), icon: <Pill size={13} />, badge: enCoursTraitements || undefined },
            { key: 'examens',     label: t('suiviTraitement.ongletExamens'),     icon: <FlaskConical size={13} />, badge: totalExamens ? `${recus}/${totalExamens}` : undefined },
            { key: 'releves',     label: t('suiviTraitement.ongletReleves'),     icon: <Activity size={13} />, badge: suivi.fiches.length || undefined },
          ]}
        />
      </div>

      {onglet === 'chrono' && <Chronologie data={data} onOuvrir={ouvrirConsultation} />}
      {onglet === 'traitements' && <Traitements data={data} maintenant={maintenant} />}
      {onglet === 'examens' && <Examens data={data} peutPrescrire={peutSeance} onPrescrire={lancerSeance} enCoursDePrescription={creerSeance.isPending} />}
      {onglet === 'releves' && <SuiviTraitementCard consultationId={suivi.consultationId} suiviId={suiviId} />}
    </div>
  )
}

// ── Chronologie ──────────────────────────────────────────────────────────────

type Evenement =
  | { genre: 'rencontre'; date: string; r: RencontreEpisode; rang: number }
  | { genre: 'ordonnance'; date: string; o: OrdonnanceEpisode }
  | { genre: 'resultat'; date: string; examen: string; contenu: string; anormal: boolean | null; realiseLe: string | null }
  | { genre: 'releve'; date: string; resume: string; note: string | null; auteur: string | null }

function Chronologie({ data, onOuvrir }: { data: Episode; onOuvrir: (consultationId: string) => void }) {
  const { t } = useTranslation()
  const evts: Evenement[] = []
  if (data.consultationInitiale) evts.push({ genre: 'rencontre', date: data.consultationInitiale.createdAt, r: data.consultationInitiale, rang: 0 })
  data.seances.forEach((s, i) => evts.push({ genre: 'rencontre', date: s.createdAt, r: s, rang: i + 1 }))
  data.ordonnances.forEach(o => evts.push({ genre: 'ordonnance', date: o.createdAt, o }))
  data.bons.forEach(b => b.resultats.forEach(r => {
    const examen = r.ligneExamenId ? b.lignes.find(l => l.id === r.ligneExamenId)?.typeExamen.libelle ?? '' : b.lignes.map(l => l.typeExamen.libelle).join(', ')
    evts.push({ genre: 'resultat', date: r.dateRealisation ?? r.createdAt, examen, contenu: r.contenu, anormal: r.anormal, realiseLe: r.dateRealisation })
  }))
  data.suivi.fiches.forEach(f => {
    const morceaux = [
      f.temperature != null ? `T° ${f.temperature}` : null,
      f.tensionSystolique != null ? `TA ${f.tensionSystolique}/${f.tensionDiastolique ?? '—'}` : null,
      f.frequenceCardiaque != null ? `FC ${f.frequenceCardiaque}` : null,
      f.frequenceRespiratoire != null ? `FR ${f.frequenceRespiratoire}` : null,
      f.saturationO2 != null ? `SpO₂ ${f.saturationO2} %` : null,
      f.poids != null ? `${f.poids} kg` : null,
    ].filter(Boolean)
    evts.push({ genre: 'releve', date: f.createdAt, resume: morceaux.join(' · '), note: f.noteEvolution, auteur: f.auteurNom ?? null })
  })
  evts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (evts.length === 0) return <EmptyState icon={<ClipboardList size={18} />} title={t('suiviTraitement.chronoVide')} variant="subtle" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {evts.map((e, i) => {
        if (e.genre === 'rencontre') {
          const titre = e.rang === 0 ? t('suiviTraitement.consultationDepart') : t('suiviTraitement.seanceN', { n: e.rang })
          return (
            <button key={i} type="button" onClick={() => onOuvrir(e.r.id)} style={{ ...carte, textAlign: 'left', cursor: 'pointer', borderLeft: '3px solid var(--ap-500)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Stethoscope size={13} style={{ color: 'var(--ap-600)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--texte-primaire)' }}>{titre}</span>
                {e.r.statut === 'OUVERTE' && <StatusPill tone="info">{t('suiviTraitement.seanceEnCours')}</StatusPill>}
                <span style={{ ...petit, marginLeft: 'auto' }}>{formatDate(e.date)}</span>
                <ArrowUpRight size={13} style={{ color: 'var(--texte-tertiaire)' }} />
              </span>
              <span style={petit}>{[e.r.soignant ? nomSoignant(e.r.soignant, t) : null, e.r.diagnosticPrincipal].filter(Boolean).join(' · ')}</span>
              {e.r.motifSeance && <span style={{ fontSize: 12, color: 'var(--texte-secondaire)' }}>{e.r.motifSeance}</span>}
              {e.r.conclusion && <span style={{ fontSize: 12, color: 'var(--texte-primaire)' }}>{e.r.conclusion}</span>}
            </button>
          )
        }
        if (e.genre === 'ordonnance') {
          const examens = e.o.typeOrdonnance === 'PRESCRIPTION_EXAMEN'
          return (
            <div key={i} style={carte}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {examens ? <FlaskConical size={13} style={{ color: 'var(--ap-600)' }} /> : <Pill size={13} style={{ color: 'var(--ap-600)' }} />}
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--texte-primaire)' }}>{examens ? t('suiviTraitement.ordonnanceExamens') : t('suiviTraitement.ordonnanceMedicaments')}</span>
                <span style={{ ...petit, marginLeft: 'auto' }}>{formatDate(e.date)}</span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--texte-secondaire)' }}>
                {e.o.lignes.map(l => l.medicament?.nomGenerique ?? l.typeExamen?.libelle).filter(Boolean).join(', ')}
              </span>
              {e.o.prescripteur && <span style={petit}>{nomSoignant(e.o.prescripteur, t)}</span>}
            </div>
          )
        }
        if (e.genre === 'resultat') {
          return (
            <div key={i} style={{ ...carte, background: e.anormal ? 'var(--erreur-fond)' : 'var(--fond-surface)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={13} style={{ color: e.anormal ? 'var(--erreur-texte)' : 'var(--ap-600)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('suiviTraitement.resultatDe', { examen: e.examen })}</span>
                {e.anormal === true && <StatusPill tone="error">{t('bonExamen.anormal')}</StatusPill>}
                <span style={{ ...petit, marginLeft: 'auto' }}>{formatDate(e.date)}</span>
              </span>
              <span style={{ fontSize: 12, color: 'var(--texte-secondaire)', whiteSpace: 'pre-wrap' }}>{e.contenu}</span>
            </div>
          )
        }
        return (
          <div key={i} style={carte}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={13} style={{ color: 'var(--ap-600)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('suiviTraitement.releve')}</span>
              <span style={{ ...petit, marginLeft: 'auto' }}>{formatDate(e.date)}{e.auteur ? ` · ${e.auteur}` : ''}</span>
            </span>
            {e.resume && <span style={{ fontSize: 12, color: 'var(--texte-secondaire)' }}>{e.resume}</span>}
            {e.note && <span style={{ fontSize: 12, color: 'var(--texte-primaire)' }}>{e.note}</span>}
          </div>
        )
      })}
    </div>
  )
}

// ── Traitements ──────────────────────────────────────────────────────────────

function Traitements({ data, maintenant }: { data: Episode; maintenant: number }) {
  const { t } = useTranslation()
  const rencontreDe = (consultationId: string) => {
    if (data.consultationInitiale?.id === consultationId) return t('suiviTraitement.consultationDepart')
    const i = data.seances.findIndex(s => s.id === consultationId)
    return i >= 0 ? t('suiviTraitement.seanceN', { n: i + 1 }) : ''
  }
  const lignes = data.ordonnances
    .filter(o => (o.typeOrdonnance ?? 'PHARMACEUTIQUE') === 'PHARMACEUTIQUE')
    .flatMap(o => o.lignes.filter(l => l.medicament).map(l => ({ l, o })))
    .sort((a, b) => new Date(b.o.createdAt).getTime() - new Date(a.o.createdAt).getTime())
  if (lignes.length === 0) return <EmptyState icon={<Pill size={18} />} title={t('suiviTraitement.aucunTraitement')} variant="subtle" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {lignes.map(({ l, o }) => {
        const { etat, fin } = etatTraitement(l, o.createdAt, maintenant)
        const delivre = o.bonsPharmacie.find(b => b.statut === 'DELIVRE')
        const derniere = l.administrations[0]
        return (
          <div key={l.id} style={{ ...carte, opacity: etat === 'TERMINE' || etat === 'ARRETE' ? 0.75 : 1 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Pill size={13} style={{ color: 'var(--ap-600)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--texte-primaire)' }}>{l.medicament!.nomGenerique}</span>
              {l.medicament!.nomCommercial && <span style={petit}>({l.medicament!.nomCommercial})</span>}
              <span style={{ marginLeft: 'auto' }}>
                {etat === 'ARRETE' ? <StatusPill tone="neutral">{t('suiviTraitement.etatArrete', { date: formatDate(fin!) })}</StatusPill>
                  : etat === 'TERMINE' ? <StatusPill tone="success">{t('suiviTraitement.etatTermine', { date: formatDate(fin!) })}</StatusPill>
                  : etat === 'EN_COURS' ? <StatusPill tone="info">{t('suiviTraitement.etatEnCours', { date: formatDate(fin!) })}</StatusPill>
                  : <StatusPill tone="info">{t('suiviTraitement.etatEnCoursSansFin')}</StatusPill>}
              </span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--texte-secondaire)' }}>{[l.posologie, l.duree, l.voieAdmin].filter(Boolean).join(' · ')}</span>
            <span style={petit}>
              {t('suiviTraitement.prescritLe', { date: formatDate(o.createdAt), rencontre: rencontreDe(o.consultationId) })}
              {o.prescripteur ? ` · ${nomSoignant(o.prescripteur, t)}` : ''}
              {' · '}{delivre ? t('suiviTraitement.delivreLe', { date: delivre.delivreLe ? formatDate(delivre.delivreLe) : '—' }) : t('suiviTraitement.nonDelivre')}
            </span>
            {l.arreteLe && l.motifArret && <span style={{ fontSize: 12, color: 'var(--avert-texte)' }}>{t('suiviTraitement.motifArret', { motif: l.motifArret })}</span>}
            <span style={petit}>
              {l.administrations.length === 0
                ? t('suiviTraitement.aucuneAdministration')
                : t('suiviTraitement.administrations', { count: l.administrations.length, date: formatDate(derniere.administreLe), auteur: derniere.auteurNom ?? '—' })}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Examens & résultats ──────────────────────────────────────────────────────

function Examens({ data, peutPrescrire, onPrescrire, enCoursDePrescription }: {
  data: Episode; peutPrescrire: boolean; onPrescrire: (motif: string) => void; enCoursDePrescription: boolean
}) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const [saisie, setSaisie] = useState<string | null>(null)
  if (data.bons.length === 0) return <EmptyState icon={<FlaskConical size={18} />} title={t('suiviTraitement.aucunExamen')} variant="subtle" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[...data.bons].reverse().map((b: BonEpisode) => {
        const global = b.resultats.find(r => !r.ligneExamenId)
        const manquants = global ? 0 : b.lignes.filter(l => !b.resultats.some(r => r.ligneExamenId === l.id)).length
        return (
          <div key={b.id} style={carte}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <FlaskConical size={13} style={{ color: 'var(--ap-600)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--texte-primaire)' }}>{t('suiviTraitement.prescritLeCourt', { date: formatDate(b.createdAt) })}</span>
              {b.indicationClinik && <span style={petit}>· {b.indicationClinik}</span>}
              {b.statut === 'VALIDE' && manquants > 0 && has('bon_examen.result') && (
                <span style={{ marginLeft: 'auto' }}>
                  <Button size="sm" variant="outline" leftIcon={<PenLine size={12} />} onClick={() => setSaisie(b.id)}>{t('bonExamen.saisirResultats')}</Button>
                </span>
              )}
            </span>
            {b.statut === 'EN_ATTENTE' && <p style={{ ...petit, color: 'var(--avert-texte)' }}>{t('bonExamen.bonAValiderAvantResultats')}</p>}
            {b.lignes.map(l => {
              const r = b.resultats.find(x => x.ligneExamenId === l.id) ?? global
              return (
                <div key={l.id} style={{ padding: '6px 8px', borderRadius: 'var(--radius-md)', background: r?.anormal ? 'var(--erreur-fond)' : 'var(--fond-surface-2)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--texte-primaire)' }}>{l.typeExamen.libelle}</span>
                    {r ? (r.anormal === true ? <StatusPill tone="error">{t('bonExamen.anormal')}</StatusPill> : r.anormal === false ? <StatusPill tone="success">{t('bonExamen.normal')}</StatusPill> : null)
                      : <StatusPill tone="warning">{t('bonExamen.resultatAttendu')}</StatusPill>}
                    {r && peutPrescrire && (
                      <span style={{ marginLeft: 'auto' }}>
                        <Button size="sm" variant="ghost" leftIcon={<Stethoscope size={12} />} disabled={enCoursDePrescription}
                          onClick={() => onPrescrire(t('suiviTraitement.motifSuiteResultat', { examen: l.typeExamen.libelle, date: formatDate(r.dateRealisation ?? r.createdAt), contenu: r.contenu.slice(0, 120) }))}>
                          {t('suiviTraitement.prescrireSuite')}
                        </Button>
                      </span>
                    )}
                  </span>
                  {r && <span style={{ fontSize: 12, color: 'var(--texte-secondaire)', whiteSpace: 'pre-wrap' }}>{r.contenu}</span>}
                  {r && <span style={petit}>{[r.dateRealisation ? t('bonExamen.realiseLe', { date: formatDate(r.dateRealisation) }) : null, r.laboratoire].filter(Boolean).join(' · ')}</span>}
                </div>
              )
            })}
          </div>
        )
      })}
      {saisie && <SaisieDepuisEpisode bonId={saisie} onClose={() => setSaisie(null)} />}
    </div>
  )
}

/** Saisie des résultats d'un bon depuis l'épisode (le bon complet est chargé à la demande). */
function SaisieDepuisEpisode({ bonId, onClose }: { bonId: string; onClose: () => void }) {
  const { data: bon } = useBonExamen(bonId)
  if (!bon) return null
  return <SaisieResultatsModal bon={bon} onClose={onClose} />
}
