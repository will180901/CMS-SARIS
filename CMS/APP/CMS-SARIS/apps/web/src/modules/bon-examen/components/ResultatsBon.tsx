/**
 * ResultatsBon — les résultats d'un bon d'examen, EXAMEN PAR EXAMEN.
 *
 * Un résultat ne se saisit que pour un examen prescrit sur le bon, une seule fois : une
 * erreur se CORRIGE (l'ancienne version reste consultable, avec le motif). Le compte
 * rendu du laboratoire (photo ou PDF) se joint au bon. Les anciens bons, saisis avant le
 * détail par examen, gardent leur « résultat global ».
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Image as ImageIcon, PenLine, History, Paperclip, Eye, Trash2, CheckCircle2, Download, FlaskConical } from 'lucide-react'
import { Button, StatusPill, Field, Textarea, TextInput, Modal, DatePicker, EmptyState } from '@/components/saris'
import { usePermissions } from '@/hooks/usePermissions'
import { formatDate } from '@/lib/intl'
import { todayISO } from '@/lib/validation'
import { labelDomaine } from '@/config/labels'
import { bonExamenApi } from '../api/bon-examen.api'
import type { BonExamen, ResultatExamen, PieceJointeResultat } from '../api/bon-examen.api'
import { useSaisirResultat, useCorrigerResultat, useAjouterCompteRendu, useRetirerCompteRendu, useBonsExamen } from '../hooks/useBonExamen'

type Normalite = 'NON_PRECISE' | 'NORMAL' | 'ANORMAL'
const versNormalite = (a: boolean | null | undefined): Normalite => (a === true ? 'ANORMAL' : a === false ? 'NORMAL' : 'NON_PRECISE')
const versBooleen = (n: Normalite): boolean | undefined => (n === 'ANORMAL' ? true : n === 'NORMAL' ? false : undefined)

const surtitre = {
  margin: 0, fontSize: 'var(--font-size-overline)', fontWeight: 700, textTransform: 'uppercase' as const,
  letterSpacing: '0.07em', color: 'var(--texte-tertiaire)',
}

/** État d'un bon : examens sans résultat en vigueur (un ancien résultat global couvre tout). */
export function examensManquants(bon: BonExamen) {
  const enVigueur = bon.resultats.filter(r => r.statut !== 'REMPLACE')
  if (enVigueur.some(r => !r.ligneExamenId)) return []
  const recus = new Set(enVigueur.map(r => r.ligneExamenId))
  return bon.lignes.filter(l => !recus.has(l.id))
}

function PastilleNormalite({ anormal }: { anormal?: boolean | null }) {
  const { t } = useTranslation()
  if (anormal === true) return <StatusPill tone="error">{t('bonExamen.anormal')}</StatusPill>
  if (anormal === false) return <StatusPill tone="success">{t('bonExamen.normal')}</StatusPill>
  return null
}

function ChoixNormalite({ value, onChange }: { value: Normalite; onChange: (v: Normalite) => void }) {
  const { t } = useTranslation()
  const bouton = (cle: 'NORMAL' | 'ANORMAL', libelle: string, couleur: string, fond: string) => {
    const actif = value === cle
    return (
      <button
        type="button"
        aria-pressed={actif}
        onClick={() => onChange(actif ? 'NON_PRECISE' : cle)}
        style={{
          height: 28, padding: '0 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          border: `1px solid ${actif ? couleur : 'var(--bordure-normale)'}`,
          background: actif ? fond : 'var(--fond-surface)', color: actif ? couleur : 'var(--texte-secondaire)',
        }}
      >
        {libelle}
      </button>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {bouton('NORMAL', t('bonExamen.normal'), 'var(--succes-texte)', 'var(--succes-fond)')}
      {bouton('ANORMAL', t('bonExamen.anormal'), 'var(--erreur-texte)', 'var(--erreur-fond)')}
    </div>
  )
}

function MetaResultat({ r }: { r: ResultatExamen }) {
  const { t } = useTranslation()
  const morceaux = [
    r.dateRealisation ? t('bonExamen.realiseLe', { date: formatDate(r.dateRealisation) }) : null,
    r.laboratoire,
    t('bonExamen.saisiLe', { date: formatDate(r.createdAt) }),
  ].filter(Boolean)
  return <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>{morceaux.join(' · ')}</p>
}

// ── Affichage ────────────────────────────────────────────────────────────────

export function ResultatsParExamen({ bon, canResult }: { bon: BonExamen; canResult: boolean }) {
  const { t } = useTranslation()
  const [aCorriger, setACorriger] = useState<ResultatExamen | null>(null)
  const [historique, setHistorique] = useState<string | null>(null)
  const enVigueur = bon.resultats.filter(r => r.statut !== 'REMPLACE')
  const globaux = enVigueur.filter(r => !r.ligneExamenId)
  const attendResultats = bon.statut === 'VALIDE'
  const manquants = examensManquants(bon)
  const interpretations = [...new Set(enVigueur.map(r => r.interpretation).filter((x): x is string => !!x))]
  // Versions antérieures d'un résultat : on remonte la chaîne des corrections.
  const versionsAvant = (r: ResultatExamen) => {
    const out: ResultatExamen[] = []
    let courant = r
    while (courant.corrigeId) {
      const prec = bon.resultats.find(x => x.id === courant.corrigeId)
      if (!prec) break
      out.push(prec); courant = prec
    }
    return out
  }

  const blocResultat = (r: ResultatExamen) => {
    const avant = versionsAvant(r)
    return (
      <div style={{ marginTop: 4 }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-primaire)', whiteSpace: 'pre-wrap' }}>{r.contenu}</p>
        <MetaResultat r={r} />
        {r.corrigeId && (
          <p style={{ margin: '2px 0 0', fontSize: 'var(--font-size-caption)', color: 'var(--avert-texte)' }}>
            {t('bonExamen.corrigeMotif', { motif: r.motifCorrection ?? '—' })}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          {canResult && (
            <button type="button" onClick={() => setACorriger(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--ap-600)' }}>
              <PenLine size={11} /> {t('bonExamen.corriger')}
            </button>
          )}
          {avant.length > 0 && (
            <button type="button" onClick={() => setHistorique(historique === r.id ? null : r.id)} aria-expanded={historique === r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: 'var(--font-size-caption)', fontWeight: 600, color: 'var(--texte-tertiaire)' }}>
              <History size={11} /> {t('bonExamen.versionsPrecedentes', { count: avant.length })}
            </button>
          )}
        </div>
        {historique === r.id && avant.map(v => (
          <div key={v.id} style={{ marginTop: 6, paddingLeft: 10, borderLeft: '2px solid var(--bordure-normale)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-secondaire)', whiteSpace: 'pre-wrap', textDecoration: 'line-through' }}>{v.contenu}</p>
            <MetaResultat r={v} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p style={surtitre}>{t('bonExamen.examsRequested', { count: bon.lignes.length })}</p>
        {attendResultats && globaux.length === 0 && (
          <StatusPill tone={manquants.length === 0 ? 'success' : 'warning'} dot={false}>
            {t('bonExamen.resultatsRecus', { recus: bon.lignes.length - manquants.length, total: bon.lignes.length })}
          </StatusPill>
        )}
      </div>
      {bon.lignes.map(l => {
        const r = enVigueur.find(x => x.ligneExamenId === l.id)
        return (
          <div key={l.id} style={{ padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--bordure-legere)', background: r?.anormal ? 'var(--erreur-fond)' : 'var(--fond-surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)' }}>{l.typeExamen.libelle}</span>
              <span style={{ fontSize: 10, color: 'var(--texte-tertiaire)' }}>{labelDomaine(l.typeExamen.domaine)}</span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
                {r ? <PastilleNormalite anormal={r.anormal} />
                  : attendResultats && globaux.length === 0 ? <StatusPill tone="warning">{t('bonExamen.resultatAttendu')}</StatusPill> : null}
              </span>
            </div>
            {r && blocResultat(r)}
          </div>
        )
      })}
      {globaux.map(r => (
        <div key={r.id} style={{ padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--info-fond)', border: '1px solid var(--info-bordure)' }}>
          <p style={{ ...surtitre, color: 'var(--info-texte)' }}>{t('bonExamen.resultatGlobal')}</p>
          {blocResultat(r)}
        </div>
      ))}
      {interpretations.length > 0 && (
        <div style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', background: 'var(--fond-surface-2)' }}>
          <p style={surtitre}>{t('bonExamen.interpretationLabel')}</p>
          {interpretations.map((txt, i) => (
            <p key={i} style={{ margin: '2px 0 0', fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)', whiteSpace: 'pre-wrap' }}>{txt}</p>
          ))}
        </div>
      )}
      {aCorriger && <CorrectionModal bon={bon} resultat={aCorriger} onClose={() => setACorriger(null)} />}
    </div>
  )
}

// ── Saisie ───────────────────────────────────────────────────────────────────

export function SaisieResultatsModal({ bon, onClose }: { bon: BonExamen; onClose: () => void }) {
  const { t } = useTranslation()
  const saisir = useSaisirResultat(bon.id)
  const manquants = examensManquants(bon)
  const [lignes, setLignes] = useState<Record<string, { contenu: string; normalite: Normalite }>>(
    () => Object.fromEntries(manquants.map(l => [l.id, { contenu: '', normalite: 'NON_PRECISE' as Normalite }])),
  )
  const [dateRealisation, setDateRealisation] = useState(todayISO())
  const [laboratoire, setLaboratoire] = useState(bon.etablissementNom ?? '')
  const [interpretation, setInterpretation] = useState('')
  const aEnvoyer = manquants.filter(l => lignes[l.id]?.contenu.trim())

  async function enregistrer() {
    if (aEnvoyer.length === 0) return
    await saisir.mutateAsync({
      resultats: aEnvoyer.map(l => ({ ligneExamenId: l.id, contenu: lignes[l.id].contenu.trim(), anormal: versBooleen(lignes[l.id].normalite) })),
      dateRealisation: dateRealisation || undefined,
      laboratoire: laboratoire.trim() || undefined,
      interpretation: interpretation.trim() || undefined,
    })
    onClose()
  }

  return (
    <Modal
      icon={<FileText size={16} />}
      title={t('bonExamen.saisieTitre')}
      subtitle={t('bonExamen.saisieSousTitre')}
      width={640}
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('bonExamen.cancel')}</Button>
        <Button variant="primary" loading={saisir.isPending} disabled={aEnvoyer.length === 0} leftIcon={<CheckCircle2 size={14} />} onClick={enregistrer}>
          {t('bonExamen.enregistrerResultats', { count: aEnvoyer.length })}
        </Button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          <Field label={t('bonExamen.dateRealisation')}>
            {() => <DatePicker value={dateRealisation} onChange={v => setDateRealisation(v ?? '')} max={todayISO()} />}
          </Field>
          <Field label={t('bonExamen.labLabel')}>
            {(id) => <TextInput id={id} maxLength={500} value={laboratoire} onChange={e => setLaboratoire(e.target.value)} placeholder={t('bonExamen.labPlaceholder')} />}
          </Field>
        </div>
        {manquants.map(l => (
          <div key={l.id} style={{ padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--bordure-legere)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)', flex: 1 }}>{l.typeExamen.libelle}</span>
              <ChoixNormalite value={lignes[l.id]?.normalite ?? 'NON_PRECISE'} onChange={v => setLignes(s => ({ ...s, [l.id]: { ...s[l.id], normalite: v } }))} />
            </div>
            <Textarea
              aria-label={t('bonExamen.resultatDe', { examen: l.typeExamen.libelle })}
              maxLength={5000}
              rows={2}
              value={lignes[l.id]?.contenu ?? ''}
              onChange={e => setLignes(s => ({ ...s, [l.id]: { ...s[l.id], contenu: e.target.value } }))}
              placeholder={t('bonExamen.resultPlaceholder')}
            />
          </div>
        ))}
        <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>{t('bonExamen.saisiePartielleAide')}</p>
        <Field label={t('bonExamen.interpretationLabel')}>
          {(id) => <Textarea id={id} maxLength={2000} rows={2} value={interpretation} onChange={e => setInterpretation(e.target.value)} placeholder={t('bonExamen.interpretationPlaceholder')} />}
        </Field>
      </div>
    </Modal>
  )
}

function CorrectionModal({ bon, resultat, onClose }: { bon: BonExamen; resultat: ResultatExamen; onClose: () => void }) {
  const { t } = useTranslation()
  const corriger = useCorrigerResultat(bon.id)
  const examen = bon.lignes.find(l => l.id === resultat.ligneExamenId)?.typeExamen.libelle ?? t('bonExamen.resultatGlobal')
  const [contenu, setContenu] = useState(resultat.contenu)
  const [normalite, setNormalite] = useState<Normalite>(versNormalite(resultat.anormal))
  const [motif, setMotif] = useState('')
  const valide = contenu.trim().length > 0 && motif.trim().length >= 3

  return (
    <Modal
      icon={<PenLine size={16} />}
      title={t('bonExamen.correctionTitre')}
      subtitle={examen}
      width={560}
      onClose={onClose}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('bonExamen.cancel')}</Button>
        <Button variant="primary" loading={corriger.isPending} disabled={!valide} leftIcon={<CheckCircle2 size={14} />}
          onClick={() => corriger.mutate({ resultatId: resultat.id, data: { contenu: contenu.trim(), anormal: versBooleen(normalite), motifCorrection: motif.trim() } }, { onSuccess: onClose })}>
          {t('bonExamen.enregistrerCorrection')}
        </Button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>{t('bonExamen.correctionAide')}</p>
        <ChoixNormalite value={normalite} onChange={setNormalite} />
        <Field label={t('bonExamen.resultLabel')} required>
          {(id) => <Textarea id={id} maxLength={5000} rows={4} value={contenu} onChange={e => setContenu(e.target.value)} autoFocus />}
        </Field>
        <Field label={t('bonExamen.motifCorrection')} required>
          {(id) => <Textarea id={id} maxLength={500} rows={2} value={motif} onChange={e => setMotif(e.target.value)} placeholder={t('bonExamen.motifCorrectionPlaceholder')} />}
        </Field>
      </div>
    </Modal>
  )
}

// ── Comptes rendus joints ────────────────────────────────────────────────────

const TYPES_ACCEPTES = 'application/pdf,image/jpeg,image/png,image/webp'
const TAILLE_MAX = 8 * 1024 * 1024

export function ComptesRendus({ bon, canResult }: { bon: BonExamen; canResult: boolean }) {
  const { t } = useTranslation()
  const ajouter = useAjouterCompteRendu(bon.id)
  const retirer = useRetirerCompteRendu(bon.id)
  const input = useRef<HTMLInputElement>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [apercu, setApercu] = useState<PieceJointeResultat | null>(null)
  const [aRetirer, setARetirer] = useState<PieceJointeResultat | null>(null)
  const pieces = bon.piecesJointes ?? []
  if (pieces.length === 0 && !canResult) return null

  function choisir(f: File | undefined) {
    setErreur(null)
    if (!f) return
    if (!TYPES_ACCEPTES.split(',').includes(f.type)) { setErreur(t('bonExamen.compteRenduType')); return }
    if (f.size > TAILLE_MAX) { setErreur(t('bonExamen.compteRenduTaille')); return }
    ajouter.mutate(f)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p style={surtitre}>{t('bonExamen.comptesRendus', { count: pieces.length })}</p>
        {canResult && (
          <>
            <input ref={input} type="file" accept={TYPES_ACCEPTES} hidden onChange={e => { choisir(e.target.files?.[0]); e.target.value = '' }} />
            <Button size="sm" variant="outline" leftIcon={<Paperclip size={13} />} loading={ajouter.isPending} onClick={() => input.current?.click()}>
              {t('bonExamen.joindreCompteRendu')}
            </Button>
          </>
        )}
      </div>
      {erreur && <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--erreur-texte)' }}>{erreur}</p>}
      {pieces.map(pj => (
        <div key={pj.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--bordure-legere)' }}>
          {pj.mimeType.startsWith('image/') ? <ImageIcon size={14} style={{ color: 'var(--ap-600)' }} /> : <FileText size={14} style={{ color: 'var(--ap-600)' }} />}
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-primaire)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pj.nomFichier}</span>
          <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>{Math.max(1, Math.round(pj.taille / 1024))} Ko · {formatDate(pj.createdAt)}</span>
          <Button size="sm" variant="ghost" leftIcon={<Eye size={13} />} onClick={() => setApercu(pj)}>{t('bonExamen.voir')}</Button>
          {canResult && (
            <Button size="sm" variant="ghost" leftIcon={<Trash2 size={13} />} onClick={() => setARetirer(pj)} aria-label={t('bonExamen.retirer')} />
          )}
        </div>
      ))}
      {apercu && <ApercuCompteRendu bonId={bon.id} piece={apercu} onClose={() => setApercu(null)} />}
      {aRetirer && (
        <Modal
          icon={<Trash2 size={16} />}
          title={t('bonExamen.retirerTitre')}
          subtitle={aRetirer.nomFichier}
          width={440}
          onClose={() => setARetirer(null)}
          footer={<>
            <Button variant="secondary" onClick={() => setARetirer(null)}>{t('bonExamen.cancel')}</Button>
            <Button variant="danger" loading={retirer.isPending} leftIcon={<Trash2 size={14} />} onClick={() => retirer.mutate(aRetirer.id, { onSuccess: () => setARetirer(null) })}>
              {t('bonExamen.retirer')}
            </Button>
          </>}
        >
          <p style={{ margin: 0, fontSize: 'var(--font-size-body-sm)', color: 'var(--texte-secondaire)' }}>{t('bonExamen.retirerAide')}</p>
        </Modal>
      )}
    </div>
  )
}

function ApercuCompteRendu({ bonId, piece, onClose }: { bonId: string; piece: PieceJointeResultat; onClose: () => void }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState<string | null>(null)
  const [echec, setEchec] = useState(false)
  useEffect(() => {
    let annule = false
    let cree: string | null = null
    // URL « blob: » plutôt que la data URL : un PDF en data URL n'est pas affiché partout.
    bonExamenApi.lireCompteRendu(bonId, piece.id)
      .then(async r => {
        const blob = await (await fetch(r.dataUrl)).blob()
        if (annule) return
        cree = URL.createObjectURL(blob)
        setUrl(cree)
      })
      .catch(() => { if (!annule) setEchec(true) })
    return () => { annule = true; if (cree) URL.revokeObjectURL(cree) }
  }, [bonId, piece.id])
  const fermer = onClose
  return (
    <Modal
      icon={<FileText size={16} />}
      title={piece.nomFichier}
      width={860}
      onClose={fermer}
      footer={url ? (
        <a href={url} download={piece.nomFichier} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ap-600)', textDecoration: 'none' }}>
          <Download size={14} /> {t('bonExamen.telecharger')}
        </a>
      ) : undefined}
    >
      {echec ? (
        <p style={{ margin: 0, color: 'var(--erreur-texte)', fontSize: 13 }}>{t('bonExamen.compteRenduIllisible')}</p>
      ) : !url ? (
        <p style={{ margin: 0, color: 'var(--texte-tertiaire)', fontSize: 13 }}>{t('bonExamen.loading')}</p>
      ) : piece.mimeType.startsWith('image/') ? (
        <img src={url} alt={piece.nomFichier} style={{ maxWidth: '100%', borderRadius: 'var(--radius-md)' }} />
      ) : (
        <iframe src={url} title={piece.nomFichier} style={{ width: '100%', height: '70vh', border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-md)' }} />
      )}
    </Modal>
  )
}

// ── Onglet « Résultats » d'une consultation ─────────────────────────────────

/** Tous les bons d'examen d'une consultation, avec leurs résultats examen par examen. */
export function ResultatsDesBons({ consultationId }: { consultationId: string }) {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const canResult = has('bon_examen.result')
  const { data: bons = [], isLoading } = useBonsExamen({ consultationId })
  const [saisie, setSaisie] = useState<BonExamen | null>(null)
  const actifs = bons.filter(b => b.statut !== 'ANNULE')

  if (isLoading) return <p style={{ margin: 0, fontSize: 13, color: 'var(--texte-tertiaire)' }}>{t('bonExamen.loading')}</p>
  if (actifs.length === 0) return <EmptyState icon={<FlaskConical size={18} />} title={t('bonExamen.aucunExamenPrescrit')} variant="subtle" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {actifs.map(b => {
        const manquants = examensManquants(b)
        return (
          <div key={b.id} style={{ border: '1px solid var(--bordure-legere)', borderRadius: 'var(--radius-lg)', background: 'var(--fond-surface)', padding: 'var(--espace-3)', display: 'flex', flexDirection: 'column', gap: 'var(--espace-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <FlaskConical size={13} style={{ color: 'var(--ap-600)' }} />
              <span style={{ fontSize: 'var(--font-size-body-sm)', fontWeight: 600, color: 'var(--texte-primaire)' }}>
                {t('bonExamen.bonNumber', { numero: b.id.slice(0, 8).toUpperCase() })}
              </span>
              {b.indicationClinik && <span style={{ fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>· {b.indicationClinik}</span>}
              {canResult && b.statut === 'VALIDE' && manquants.length > 0 && (
                <span style={{ marginLeft: 'auto' }}>
                  <Button size="sm" variant="primary" leftIcon={<FileText size={13} />} onClick={() => setSaisie(b)}>{t('bonExamen.saisirResultats')}</Button>
                </span>
              )}
            </div>
            {b.statut === 'EN_ATTENTE' ? (
              <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--avert-texte)' }}>{t('bonExamen.bonAValiderAvantResultats')}</p>
            ) : (
              <>
                <ResultatsParExamen bon={b} canResult={canResult} />
                <ComptesRendus bon={b} canResult={canResult} />
              </>
            )}
          </div>
        )
      })}
      {saisie && <SaisieResultatsModal bon={saisie} onClose={() => setSaisie(null)} />}
    </div>
  )
}

/** Examens prescrits d'un bon, sans leurs résultats (onglet Prescriptions : les résultats
 *  ont leur propre onglet). Le décompte dit où on en est. */
export function ListeExamensPrescrits({ bon }: { bon: BonExamen }) {
  const { t } = useTranslation()
  const manquants = examensManquants(bon)
  const globaux = bon.resultats.some(r => r.statut !== 'REMPLACE' && !r.ligneExamenId)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p style={surtitre}>{t('bonExamen.examsRequested', { count: bon.lignes.length })}</p>
        {bon.statut === 'VALIDE' && !globaux && (
          <StatusPill tone={manquants.length === 0 ? 'success' : 'warning'} dot={false}>
            {t('bonExamen.resultatsRecus', { recus: bon.lignes.length - manquants.length, total: bon.lignes.length })}
          </StatusPill>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {bon.lignes.map(l => (
          <StatusPill key={l.id} tone="accent" dot={false}>
            {l.typeExamen.libelle}
            <span style={{ marginLeft: 4, opacity: 0.6, fontSize: 9 }}>{labelDomaine(l.typeExamen.domaine)}</span>
          </StatusPill>
        ))}
      </div>
    </div>
  )
}
