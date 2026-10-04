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
import { Activity, CalendarClock, ClipboardList, FlaskConical, Pill, Stethoscope, PenLine, ArrowUpRight, Loader2, FileText, Syringe, Replace, OctagonX, X } from 'lucide-react'
import { Button, StatusPill, SegmentedTabs, DatePicker, EmptyState, Modal, MotifDialog, Field, TextInput, Textarea } from '@/components/saris'
import { useSessionStore } from '@/stores/session.store'
import { usePermissions } from '@/hooks/usePermissions'
import { usePersistedState } from '@/hooks/usePersistedState'
import { formatDate, formatDateTime } from '@/lib/intl'
import { todayISO } from '@/lib/validation'
import { nomSoignant } from '@/lib/soignant'
import { etatTraitement } from '@/lib/traitement'
import { useEpisodeSuivi, useSetProchainControle, useCreerSeanceSuivi, useArreterTraitement, useAdministrer, useRetirerAdministration } from '../hooks/useSuiviTraitement'
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

  const enCoursTraitements = lignesDeTraitement(data)
    .filter(({ l, o }) => ['EN_COURS', 'INDETERMINE'].includes(etatTraitement(l, o.createdAt, maintenant).etat)).length
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
      {onglet === 'traitements' && <Traitements data={data} maintenant={maintenant} suiviId={suiviId} onSeance={lancerSeance} />}
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
  data.ordonnances.filter(o => o.statut === 'VALIDEE').forEach(o => evts.push({ genre: 'ordonnance', date: o.createdAt, o }))
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

type LigneT = { l: Episode['ordonnances'][number]['lignes'][number]; o: OrdonnanceEpisode }

/** Lignes de médicaments PRESCRITES (ordonnance validée) de l'épisode, les plus récentes d'abord. */
function lignesDeTraitement(data: Episode): LigneT[] {
  return data.ordonnances
    .filter(o => (o.typeOrdonnance ?? 'PHARMACEUTIQUE') === 'PHARMACEUTIQUE' && o.statut === 'VALIDEE')
    .flatMap(o => o.lignes.filter(l => l.medicament).map(l => ({ l, o })))
    .sort((a, b) => new Date(b.o.createdAt).getTime() - new Date(a.o.createdAt).getTime())
}

/**
 * Chaque traitement avec son cycle de vie (en cours, terminé, arrêté, remplacé) et son
 * évolution (prescrit, délivré, administrations, arrêt). Les gestes se font ici :
 * administrer (soignant du suivi), arrêter ou remplacer (prescripteur).
 */
function Traitements({ data, maintenant, suiviId, onSeance }: {
  data: Episode; maintenant: number; suiviId: string; onSeance: (motif: string) => void
}) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const moi = useSessionStore(s => s.user?.id)
  const arreter = useArreterTraitement(suiviId)
  const administrer = useAdministrer(suiviId)
  const retirer = useRetirerAdministration(suiviId)
  const [ouverte, setOuverte] = useState<string | null>(null)
  const [action, setAction] = useState<{ genre: 'administrer' | 'arreter' | 'remplacer'; ligne: LigneT } | null>(null)
  const [dose, setDose] = useState('')
  const [observation, setObservation] = useState('')

  const enCours = data.suivi.statut === 'EN_COURS'
  const peutAdministrer = enCours && has('suivi_traitement.update')
  const peutArreter = enCours && has('suivi_traitement.update') && has('ordonnance.create')
  const peutRemplacer = peutArreter && has('consultation.create')
  const rencontreDe = (consultationId: string) => {
    if (data.consultationInitiale?.id === consultationId) return t('suiviTraitement.consultationDepart')
    const i = data.seances.findIndex(s => s.id === consultationId)
    return i >= 0 ? t('suiviTraitement.seanceN', { n: i + 1 }) : ''
  }
  const lignes = lignesDeTraitement(data)
  const nomDe = (id: string | null) => lignes.find(x => x.l.id === id)?.l.medicament?.nomGenerique ?? ''
  const fermer = () => { setAction(null); setDose(''); setObservation('') }

  if (lignes.length === 0) return <EmptyState icon={<Pill size={18} />} title={t('suiviTraitement.aucunTraitement')} variant="subtle" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {lignes.map(x => {
        const { l, o } = x
        const nom = l.medicament!.nomGenerique
        const { etat, fin } = etatTraitement(l, o.createdAt, maintenant)
        const actif = etat === 'EN_COURS' || etat === 'INDETERMINE'
        const delivre = o.bonsPharmacie.find(b => b.statut === 'DELIVRE')
        const remplacante = l.remplaceParId ? nomDe(l.remplaceParId) : ''
        const remplacee = lignes.find(y => y.l.remplaceParId === l.id)?.l.medicament?.nomGenerique
        const derniere = l.administrations[0]
        const evolutionOuverte = ouverte === l.id
        return (
          <div key={l.id} style={{ ...carte, opacity: actif ? 1 : 0.8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Pill size={13} style={{ color: 'var(--ap-600)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--texte-primaire)' }}>{nom}</span>
              {l.medicament!.nomCommercial && <span style={petit}>({l.medicament!.nomCommercial})</span>}
              <span style={{ marginLeft: 'auto' }}>
                {etat === 'REMPLACE' ? <StatusPill tone="neutral">{t('suiviTraitement.etatRemplace', { date: formatDate(fin!) })}</StatusPill>
                  : etat === 'ARRETE' ? <StatusPill tone="warning">{t('suiviTraitement.etatArrete', { date: formatDate(fin!) })}</StatusPill>
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
            {remplacee && <span style={{ fontSize: 12, color: 'var(--texte-secondaire)' }}>{t('suiviTraitement.remplaceLigne', { medicament: remplacee })}</span>}
            {l.arreteLe && (
              <span style={{ fontSize: 12, color: 'var(--avert-texte)' }}>
                {l.motifArret ? t('suiviTraitement.motifArret', { motif: l.motifArret }) : ''}
                {l.arreteParNom ? ` · ${t('suiviTraitement.arretePar', { auteur: l.arreteParNom })}` : ''}
                {remplacante ? ` · ${t('suiviTraitement.remplacePar', { medicament: remplacante })}` : ''}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
              <span style={petit}>
                {l.administrations.length === 0
                  ? t('suiviTraitement.aucuneAdministration')
                  : t('suiviTraitement.administrations', { count: l.administrations.length, date: formatDate(derniere.administreLe), auteur: derniere.auteurNom ?? '—' })}
              </span>
              <button type="button" onClick={() => setOuverte(evolutionOuverte ? null : l.id)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--ap-600)' }}>
                {evolutionOuverte ? t('suiviTraitement.masquerEvolution') : t('suiviTraitement.voirEvolution')}
              </button>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {actif && peutAdministrer && <Button size="sm" variant="outline" leftIcon={<Syringe size={12} />} onClick={() => setAction({ genre: 'administrer', ligne: x })}>{t('suiviTraitement.administrer')}</Button>}
                {actif && peutRemplacer && <Button size="sm" variant="ghost" leftIcon={<Replace size={12} />} onClick={() => setAction({ genre: 'remplacer', ligne: x })}>{t('suiviTraitement.remplacer')}</Button>}
                {actif && peutArreter && <Button size="sm" variant="ghost" leftIcon={<OctagonX size={12} />} onClick={() => setAction({ genre: 'arreter', ligne: x })}>{t('suiviTraitement.arreter')}</Button>}
              </span>
            </span>
            {evolutionOuverte && (
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {l.arreteLe && (
                  <li style={{ fontSize: 12, color: 'var(--avert-texte)' }}>
                    {t('suiviTraitement.evolutionArrete', { date: formatDate(l.arreteLe), motif: l.motifArret ?? '—' })}
                  </li>
                )}
                {l.administrations.map(a => (
                  <li key={a.id} style={{ fontSize: 12, color: 'var(--texte-secondaire)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {t('suiviTraitement.evolutionAdministre', {
                        date: formatDateTime(a.administreLe, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                        dose: a.dose ? ` · ${a.dose}` : '',
                        auteur: a.auteurNom ?? '—',
                      })}
                      {a.observation && <em style={{ color: 'var(--texte-tertiaire)' }}>« {a.observation} »</em>}
                      {a.createdBy === moi && enCours && (
                        <button type="button" title={t('suiviTraitement.retirerAdministration')} aria-label={t('suiviTraitement.retirerAdministration')}
                          disabled={retirer.isPending} onClick={() => retirer.mutate(a.id)}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--texte-tertiaire)', display: 'inline-flex' }}>
                          <X size={12} />
                        </button>
                      )}
                    </span>
                  </li>
                ))}
                {delivre?.delivreLe && <li style={{ fontSize: 12, color: 'var(--texte-secondaire)' }}>{t('suiviTraitement.evolutionDelivre', { date: formatDate(delivre.delivreLe) })}</li>}
                <li style={{ fontSize: 12, color: 'var(--texte-secondaire)' }}>{t('suiviTraitement.evolutionPrescrit', { date: formatDate(o.createdAt) })}</li>
              </ul>
            )}
          </div>
        )
      })}

      {action?.genre === 'administrer' && (
        <Modal
          icon={<Syringe size={16} />}
          title={t('suiviTraitement.administrerTitre')}
          subtitle={t('suiviTraitement.administrerSousTitre', { medicament: action.ligne.l.medicament!.nomGenerique, posologie: action.ligne.l.posologie ?? '' })}
          width={460}
          onClose={fermer}
          footer={<>
            <Button variant="secondary" onClick={fermer}>{t('suiviTraitement.cancelForm')}</Button>
            <Button variant="primary" leftIcon={<Syringe size={14} />} loading={administrer.isPending}
              onClick={() => administrer.mutate(
                { ligneOrdonnanceId: action.ligne.l.id, dose: dose.trim() || undefined, observation: observation.trim() || undefined },
                { onSuccess: fermer },
              )}>
              {t('suiviTraitement.save')}
            </Button>
          </>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label={t('suiviTraitement.fieldDose')}>
              {(id) => <TextInput id={id} size="sm" maxLength={200} value={dose} onChange={e => setDose(e.target.value)} placeholder={t('suiviTraitement.dosePlaceholder')} />}
            </Field>
            <Field label={t('suiviTraitement.fieldObservation')}>
              {(id) => <Textarea id={id} rows={2} maxLength={1000} value={observation} onChange={e => setObservation(e.target.value)} placeholder={t('suiviTraitement.observationPlaceholder')} />}
            </Field>
          </div>
        </Modal>
      )}

      {(action?.genre === 'arreter' || action?.genre === 'remplacer') && (
        <MotifDialog
          icon={action.genre === 'arreter' ? <OctagonX size={16} /> : <Replace size={16} />}
          title={t(action.genre === 'arreter' ? 'suiviTraitement.arreterTitre' : 'suiviTraitement.remplacerTitre')}
          subtitle={`${action.ligne.l.medicament!.nomGenerique} — ${t(action.genre === 'arreter' ? 'suiviTraitement.arreterSousTitre' : 'suiviTraitement.remplacerSousTitre')}`}
          label={t(action.genre === 'arreter' ? 'suiviTraitement.motifArretLabel' : 'suiviTraitement.motifRemplacementLabel')}
          placeholder={t('suiviTraitement.motifArretPlaceholder')}
          confirmLabel={t(action.genre === 'arreter' ? 'suiviTraitement.arreter' : 'suiviTraitement.remplacer')}
          confirmIcon={action.genre === 'arreter' ? <OctagonX size={14} /> : <Replace size={14} />}
          danger={action.genre === 'arreter'}
          loading={arreter.isPending}
          onConfirm={motif => {
            const { l } = action.ligne
            const remplacer = action.genre === 'remplacer'
            arreter.mutate({ ligneId: l.id, motifArret: motif }, {
              onSuccess: () => {
                fermer()
                if (remplacer) onSeance(t('suiviTraitement.motifRemplacement', { medicament: l.medicament!.nomGenerique, motif }))
              },
            })
          }}
          onClose={fermer}
        />
      )}
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
