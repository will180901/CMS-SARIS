import { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, RotateCcw, Check } from 'lucide-react'
import { useCreateConstantes } from '../hooks/useTriage'
import { VITAL_RANGES, validateVital } from '@/lib/validation'
import { formatDateTime } from '@/lib/intl'

// ── Helpers sévérité ──────────────────────────────────────────────────────────

type Sev = 'normal' | 'warning' | 'danger'

const SEV_STYLE: Record<Sev, { border: string; bg: string; color: string }> = {
  normal:  { border: 'var(--bordure-normale)', bg: 'var(--fond-input)',  color: 'var(--texte-primaire)' },
  warning: { border: 'var(--avert-bordure)',   bg: 'var(--avert-fond)',  color: 'var(--avert-texte)'   },
  danger:  { border: 'var(--erreur-bordure)',  bg: 'var(--erreur-fond)', color: 'var(--erreur-texte)'  },
}

function tempSev(v: string): Sev {
  const n = parseFloat(v); if (isNaN(n)) return 'normal'
  return n >= 38.5 ? 'danger' : n >= 37.5 ? 'warning' : 'normal'
}
function taSev(v: string): Sev {
  const n = parseFloat(v); if (isNaN(n)) return 'normal'
  return n >= 160 ? 'danger' : n >= 140 ? 'warning' : 'normal'
}
function spo2Sev(v: string): Sev {
  const n = parseFloat(v); if (isNaN(n)) return 'normal'
  return n < 90 ? 'danger' : n < 95 ? 'warning' : 'normal'
}
function imcInfo(imc: number | null): { labelKey: string; color: string } | null {
  if (imc == null) return null
  if (imc < 18.5) return { labelKey: 'triage.imcInsuffisance', color: 'var(--info-texte)' }
  if (imc < 25)   return { labelKey: 'triage.imcNormal',       color: 'var(--succes-texte)' }
  if (imc < 30)   return { labelKey: 'triage.imcSurpoids',     color: 'var(--avert-texte)' }
  return              { labelKey: 'triage.imcObesite',         color: 'var(--erreur-texte)' }
}

// ── Helper d'affichage "Dernier" ──────────────────────────────────────────────

function HintLast({ value, unit }: { value: string | null; unit: string }) {
  const { t } = useTranslation()
  if (!value) return null
  return (
    <span style={{ fontSize: '10px', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>
      {t('triage.derniereHint', { value, unit })}
    </span>
  )
}

// ── Ligne vitale ──────────────────────────────────────────────────────────────

function ErrText({ msg }: { msg?: string | null }) {
  if (!msg) return null
  return (
    <span style={{ fontSize: '10px', color: 'var(--erreur-texte)', fontWeight: '500' }}>
      {msg}
    </span>
  )
}

function VLine({
  label, unit, value, onChange, sev = 'normal', step = 1, lastHint, readOnly = false, compact = false,
  min, max, error,
}: {
  label:     string
  unit:      string
  value:     string
  onChange?: (v: string) => void
  sev?:      Sev
  step?:     number
  lastHint?: string | null
  readOnly?: boolean
  compact?:  boolean
  min?:      number
  max?:      number
  error?:    string | null
}) {
  // Une erreur de plage prime sur la sévérité clinique pour la couleur de bordure.
  const eff = error ? 'danger' : sev
  const s = SEV_STYLE[eff]

  const input = (
    <input
      type="number"
      step={step}
      min={min}
      max={max}
      inputMode="decimal"
      value={value}
      readOnly={readOnly}
      aria-invalid={!!error}
      onChange={onChange ? e => onChange(e.target.value) : undefined}
      placeholder="—"
      style={{
        flex:       1,
        minWidth:   0,
        height:     34,
        padding:    '0 10px',
        borderRadius: 6,
        border:     `1px solid ${s.border}`,
        background: readOnly ? 'var(--fond-surface-2)' : s.bg,
        color:      s.color,
        fontSize:   '13px',
        fontWeight: eff !== 'normal' ? '600' : '400',
        outline:    'none',
        textAlign:  'right',
        transition: 'border-color .15s',
      }}
    />
  )

  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: '12px', color: 'var(--texte-secondaire)', fontWeight: '500' }}>
            {label}
          </span>
          <HintLast value={lastHint ?? null} unit={unit} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {input}
          <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', minWidth: 36, flexShrink: 0, textAlign: 'right' }}>
            {unit}
          </span>
        </div>
        <ErrText msg={error} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 140, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '12px', color: 'var(--texte-secondaire)', fontWeight: '500' }}>
            {label}
          </span>
          <HintLast value={lastHint ?? null} unit={unit} />
        </div>
        {input}
        <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', width: 40, flexShrink: 0, textAlign: 'right' }}>
          {unit}
        </span>
      </div>
      {error && (
        <div style={{ paddingLeft: 150 }}>
          <ErrText msg={error} />
        </div>
      )}
    </div>
  )
}

// ── Ligne Tension artérielle (sys/dia côte à côte, responsive) ───────────────

function TensionLine({
  sys, setSys, dia, setDia, lastSys, lastDia, compact, sysError, diaError,
}: {
  sys:     string
  setSys:  (v: string) => void
  dia:     string
  setDia:  (v: string) => void
  lastSys: number | null
  lastDia: number | null
  compact: boolean
  sysError?: string | null
  diaError?: string | null
}) {
  const { t } = useTranslation()
  const sysSev = sysError ? 'danger' : taSev(sys)
  const diaSev: Sev = diaError ? 'danger' : 'normal'
  const RS = VITAL_RANGES.tensionSystolique
  const RD = VITAL_RANGES.tensionDiastolique
  const inputs = (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <input
        type="number"
        inputMode="numeric"
        min={RS.min} max={RS.max} step={RS.step}
        value={sys}
        aria-invalid={!!sysError}
        onChange={e => setSys(e.target.value)}
        placeholder={t('triage.placeholderSys')}
        style={{
          flex: 1, minWidth: 0,
          height: 34, padding: '0 8px', borderRadius: 6, textAlign: 'right',
          border:     `1px solid ${SEV_STYLE[sysSev].border}`,
          background: SEV_STYLE[sysSev].bg,
          color:      SEV_STYLE[sysSev].color,
          fontSize: '13px', fontWeight: sysSev !== 'normal' ? '600' : '400',
          outline: 'none',
        }}
      />
      <span style={{ color: 'var(--texte-tertiaire)', fontWeight: '600', flexShrink: 0 }}>/</span>
      <input
        type="number"
        inputMode="numeric"
        min={RD.min} max={RD.max} step={RD.step}
        value={dia}
        aria-invalid={!!diaError}
        onChange={e => setDia(e.target.value)}
        placeholder={t('triage.placeholderDia')}
        style={{
          flex: 1, minWidth: 0,
          height: 34, padding: '0 8px', borderRadius: 6, textAlign: 'right',
          border:     `1px solid ${SEV_STYLE[diaSev].border}`,
          background: SEV_STYLE[diaSev].bg,
          color:      SEV_STYLE[diaSev].color,
          fontSize: '13px', fontWeight: diaSev !== 'normal' ? '600' : '400',
          outline: 'none',
        }}
      />
    </div>
  )
  const taError = sysError || diaError

  const hintNode = lastSys != null
    ? <span style={{ fontSize: '10px', color: 'var(--texte-tertiaire)', fontStyle: 'italic' }}>
        {t('triage.derniereHintTension', { value: `${lastSys}/${lastDia ?? '?'}` })}
      </span>
    : null

  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: '12px', color: 'var(--texte-secondaire)', fontWeight: '500' }}>
            {t('triage.labelTensionArterielle')}
          </span>
          {hintNode}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {inputs}
          <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', minWidth: 36, flexShrink: 0, textAlign: 'right' }}>
            mmHg
          </span>
        </div>
        <ErrText msg={taError} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 140, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '12px', color: 'var(--texte-secondaire)', fontWeight: '500' }}>
            {t('triage.labelTensionArterielle')}
          </span>
          {hintNode}
        </div>
        {inputs}
        <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', width: 40, flexShrink: 0, textAlign: 'right' }}>
          mmHg
        </span>
      </div>
      {taError && (
        <div style={{ paddingLeft: 150 }}>
          <ErrText msg={taError} />
        </div>
      )}
    </div>
  )
}

// ── Signes généraux (modèle Jeannette) ───────────────────────────────────────
// Catégories cliniques standard ; la valeur stockée = le libellé (texte lisible).
const CONSCIENCE_OPTS = ['Conscient', 'Somnolent', 'Obnubilé', 'Comateux']
const ETAT_GEN_OPTS   = ['Bon', 'Altéré', 'Mauvais']
const HYDRA_OPTS      = ['Normale', 'Déshydratation modérée', 'Déshydratation sévère']
const COLORA_OPTS     = ['Normale', 'Pâleur', 'Cyanose', 'Ictère']

function SigneSelect({ label, value, onChange, options, compact }: {
  label:    string
  value:    string
  onChange: (v: string) => void
  options:  string[]
  compact?: boolean
}) {
  const pills = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
      {options.map(o => {
        const active = value === o
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(active ? '' : o)}
            aria-pressed={active}
            style={{
              padding: '4px 10px', borderRadius: 9999, fontSize: '12px', cursor: 'pointer',
              fontWeight: active ? 600 : 500, whiteSpace: 'nowrap',
              background: active ? 'var(--ap-50)' : 'var(--fond-surface)',
              color:      active ? 'var(--ap-700)' : 'var(--texte-secondaire)',
              border:     `1px solid ${active ? 'var(--ap-200)' : 'var(--bordure-normale)'}`,
            }}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: '12px', color: 'var(--texte-secondaire)', fontWeight: '500' }}>{label}</span>
        {pills}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ width: 140, flexShrink: 0, fontSize: '12px', color: 'var(--texte-secondaire)', fontWeight: '500', paddingTop: 5 }}>{label}</span>
      {pills}
    </div>
  )
}

// ── Composant ─────────────────────────────────────────────────────────────────

interface LastValues {
  temperature?:        number | null
  tensionSystolique?:  number | null
  tensionDiastolique?: number | null
  frequenceCardiaque?: number | null
  saturationO2?:       number | null
  poids?:              number | null
  taille?:             number | null
  imc?:                number | null
  glycemie?:           number | null
  createdAt?:          string
}

function fmt(n: number | null | undefined): string | null {
  return n != null ? String(n) : null
}

export function ConstantesForm({
  visiteId,
  lastValues,
}: {
  visiteId:    string
  lastValues?: LastValues | null
}) {
  const { t } = useTranslation()
  const save = useCreateConstantes(visiteId)

  // Tous les champs commencent VIDES — pas de pré-remplissage
  const [temp,   setTemp]   = useState('')
  const [sys,    setSys]    = useState('')
  const [dia,    setDia]    = useState('')
  const [fc,     setFc]     = useState('')
  const [spo2,   setSpo2]   = useState('')
  const [poids,  setPoids]  = useState('')
  const [taille, setTaille] = useState('')
  const [glyc,   setGlyc]   = useState('')
  // Signes généraux (modèle Jeannette)
  const [conscience, setConscience] = useState('')
  const [glasgow,    setGlasgow]    = useState('')
  const [etatGen,    setEtatGen]    = useState('')
  const [hydra,      setHydra]      = useState('')
  const [colora,     setColora]     = useState('')

  // Empreinte de la dernière mesure enregistrée (pour ne pas ré-enregistrer à l'identique)
  const [savedSnap, setSavedSnap] = useState('')

  // Reset si on change de visite
  useEffect(() => {
    setTemp(''); setSys(''); setDia(''); setFc('')
    setSpo2(''); setPoids(''); setTaille(''); setGlyc('')
    setConscience(''); setGlasgow(''); setEtatGen(''); setHydra(''); setColora('')
    setSavedSnap('')
  }, [visiteId])

  // Responsive : observer la largeur du conteneur pour passer en mode compact
  const containerRef       = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const ro = new ResizeObserver(([entry]) => {
      // 420 px : seuil en dessous duquel la mise en page horizontale (label 140 + input + unit 40) ne tient plus
      setCompact(entry.contentRect.width < 420)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const imc = useMemo(() => {
    const p = parseFloat(poids), t = parseFloat(taille)
    if (!p || !t || t <= 0) return null
    return Math.round((p / ((t / 100) ** 2)) * 10) / 10
  }, [poids, taille])

  const imcMeta = imcInfo(imc)

  // Validation par champ (plages physiologiques alignées sur le backend)
  const errors = useMemo(() => ({
    temperature:        validateVital('temperature', temp).error,
    tensionSystolique:  validateVital('tensionSystolique', sys).error,
    tensionDiastolique: validateVital('tensionDiastolique', dia).error,
    frequenceCardiaque: validateVital('frequenceCardiaque', fc).error,
    saturationO2:       validateVital('saturationO2', spo2).error,
    poids:              validateVital('poids', poids).error,
    taille:             validateVital('taille', taille).error,
    glycemie:           validateVital('glycemie', glyc).error,
  }), [temp, sys, dia, fc, spo2, poids, taille, glyc])

  const hasError = Object.values(errors).some(Boolean)
  // Cohérence tension : systolique doit être ≥ diastolique
  const taIncoherente = useMemo(() => {
    const s = parseFloat(sys), d = parseFloat(dia)
    return !isNaN(s) && !isNaN(d) && s <= d
  }, [sys, dia])

  const hasAnyValue = [temp, sys, dia, fc, spo2, poids, taille, glyc, conscience, glasgow, etatGen, hydra, colora].some(v => v.trim() !== '')

  // Empreinte courante des champs → détecte si la mesure a changé depuis le dernier enregistrement.
  const snapshot = useMemo(
    () => JSON.stringify([temp, sys, dia, fc, spo2, poids, taille, glyc, conscience, glasgow, etatGen, hydra, colora]),
    [temp, sys, dia, fc, spo2, poids, taille, glyc, conscience, glasgow, etatGen, hydra, colora],
  )
  const dirty = snapshot !== savedSnap

  function reprendreDernier() {
    setTemp(fmt(lastValues?.temperature) ?? '')
    setSys(fmt(lastValues?.tensionSystolique) ?? '')
    setDia(fmt(lastValues?.tensionDiastolique) ?? '')
    setFc(fmt(lastValues?.frequenceCardiaque) ?? '')
    setSpo2(fmt(lastValues?.saturationO2) ?? '')
    setPoids(fmt(lastValues?.poids) ?? '')
    setTaille(fmt(lastValues?.taille) ?? '')
    setGlyc(fmt(lastValues?.glycemie) ?? '')
  }

  // Enregistrement AUTOMATIQUE : déclenché quand le focus quitte la carte (la
  // saisie est finie). Une mesure = un enregistrement horodaté ; on ne ré-enregistre
  // pas si rien n'a changé depuis la dernière sauvegarde (garde `savedSnap`).
  function autoSave() {
    if (save.isPending || hasError || taIncoherente || !hasAnyValue || !dirty) return
    const n = (v: string) => v !== '' ? parseFloat(v) : undefined
    const i = (v: string) => v !== '' ? parseInt(v, 10) : undefined
    const snap = snapshot
    save.mutate({
      temperature:        n(temp),
      tensionSystolique:  i(sys),
      tensionDiastolique: i(dia),
      frequenceCardiaque: i(fc),
      saturationO2:       n(spo2),
      poids:              n(poids),
      taille:             n(taille),
      glycemie:           n(glyc),
      etatConscience:     conscience || undefined,
      scoreGlasgow:       glasgow !== '' ? parseInt(glasgow, 10) : undefined,
      etatGeneral:        etatGen || undefined,
      hydratation:        hydra || undefined,
      coloration:         colora || undefined,
    }, {
      // On garde les valeurs affichées (pas de reset) et on mémorise l'empreinte sauvegardée.
      onSuccess: () => setSavedSnap(snap),
    })
  }

  // Sauvegarde quand le focus sort entièrement de la carte (clic/tab en dehors).
  function handleCardBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) autoSave()
  }

  return (
    <div ref={containerRef} onBlur={handleCardBlur} style={{
      background:   'var(--fond-surface)',
      border:       '1px solid var(--bordure-legere)',
      borderRadius: '10px',
      boxShadow:    'var(--ombre-1)',
      overflow:     'hidden',
    }}>
      {/* En-tête */}
      <div style={{
        padding:      '12px 16px',
        borderBottom: '1px solid var(--bordure-legere)',
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        background:   'var(--fond-surface-2)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'var(--ap-50)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Activity size={14} style={{ color: 'var(--ap-600)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--texte-primaire)', margin: 0 }}>
            {t('triage.constantesVitales')}
          </p>
          {lastValues?.createdAt && (
            <p style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', margin: 0 }}>
              {t('triage.derniereSaisie', { date: formatDateTime(lastValues.createdAt, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) })}
            </p>
          )}
        </div>
        {lastValues && (
          <button
            onClick={reprendreDernier}
            type="button"
            title={t('triage.reprendreTooltip')}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 6, fontSize: '11px', fontWeight: '500',
              background: 'var(--fond-surface)', color: 'var(--texte-secondaire)',
              border: '1px solid var(--bordure-normale)', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <RotateCcw size={11} />
            {t('triage.reprendre')}
          </button>
        )}
      </div>

      {/* Corps */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: compact ? 14 : 10 }}>
        <VLine compact={compact} label={t('triage.labelTemperature')}     unit="°C"  value={temp}  onChange={setTemp}  sev={tempSev(temp)}  step={0.1}
               min={VITAL_RANGES.temperature.min} max={VITAL_RANGES.temperature.max}
               error={errors.temperature} lastHint={fmt(lastValues?.temperature)} />
        <VLine compact={compact} label={t('triage.labelFreqCardiaque')} unit="bpm" value={fc}    onChange={setFc}    step={1}
               min={VITAL_RANGES.frequenceCardiaque.min} max={VITAL_RANGES.frequenceCardiaque.max}
               error={errors.frequenceCardiaque} lastHint={fmt(lastValues?.frequenceCardiaque)} />

        {/* Tension — deux champs sur une ligne (responsive) */}
        <TensionLine
          sys={sys} setSys={setSys}
          dia={dia} setDia={setDia}
          lastSys={lastValues?.tensionSystolique ?? null}
          lastDia={lastValues?.tensionDiastolique ?? null}
          compact={compact}
          sysError={errors.tensionSystolique ?? (taIncoherente ? t('triage.systoliqueInferieure') : undefined)}
          diaError={errors.tensionDiastolique}
        />

        <VLine compact={compact} label={t('triage.labelSpo2')}     unit="%"   value={spo2}   onChange={setSpo2}   sev={spo2Sev(spo2)} step={0.1}
               min={VITAL_RANGES.saturationO2.min} max={VITAL_RANGES.saturationO2.max}
               error={errors.saturationO2} lastHint={fmt(lastValues?.saturationO2)} />
        <VLine compact={compact} label={t('triage.labelPoids')}    unit="kg"  value={poids}  onChange={setPoids}  step={0.1}
               min={VITAL_RANGES.poids.min} max={VITAL_RANGES.poids.max}
               error={errors.poids} lastHint={fmt(lastValues?.poids)} />
        <VLine compact={compact} label={t('triage.labelTaille')}   unit="cm"  value={taille} onChange={setTaille} step={1}
               min={VITAL_RANGES.taille.min} max={VITAL_RANGES.taille.max}
               error={errors.taille} lastHint={fmt(lastValues?.taille)} />
        <VLine compact={compact} label={t('triage.labelGlycemie')} unit="g/L" value={glyc}   onChange={setGlyc}   step={0.01}
               min={VITAL_RANGES.glycemie.min} max={VITAL_RANGES.glycemie.max}
               error={errors.glycemie} lastHint={fmt(lastValues?.glycemie)} />

        {/* IMC calculé */}
        {imc != null && (
          <div style={{
            display: 'flex', alignItems: compact ? 'flex-start' : 'center', gap: 10,
            marginTop: 4, paddingTop: 10,
            borderTop: '1px dashed var(--bordure-legere)',
            flexDirection: compact ? 'column' : 'row',
          }}>
            <span style={{ fontSize: '12px', color: 'var(--texte-secondaire)', fontWeight: '500', width: compact ? 'auto' : 140, flexShrink: 0 }}>
              {t('triage.imcCalcule')}
            </span>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', fontWeight: '700', color: imcMeta?.color ?? 'var(--texte-primaire)' }}>
                {imc}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)' }}>kg/m²</span>
              {imcMeta && (
                <span style={{
                  fontSize: '10px', fontWeight: '600', padding: '1px 6px',
                  borderRadius: 9999, color: imcMeta.color,
                  background: 'var(--fond-surface-2)',
                }}>
                  {t(imcMeta.labelKey)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Signes généraux (modèle Jeannette) */}
        <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px dashed var(--bordure-legere)', display: 'flex', flexDirection: 'column', gap: compact ? 12 : 8 }}>
          <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--texte-tertiaire)' }}>
            {t('triage.signesGeneraux')}
          </span>
          <SigneSelect compact={compact} label={t('triage.labelConscience')}  value={conscience} onChange={setConscience} options={CONSCIENCE_OPTS} />
          <VLine compact={compact} label={t('triage.labelGlasgow')} unit="/15" value={glasgow} onChange={setGlasgow} step={1} min={3} max={15} />
          <SigneSelect compact={compact} label={t('triage.labelEtatGeneral')} value={etatGen}    onChange={setEtatGen}    options={ETAT_GEN_OPTS} />
          <SigneSelect compact={compact} label={t('triage.labelHydratation')} value={hydra}      onChange={setHydra}      options={HYDRA_OPTS} />
          <SigneSelect compact={compact} label={t('triage.labelColoration')}  value={colora}     onChange={setColora}     options={COLORA_OPTS} />
        </div>
      </div>

      {/* Footer — statut d'enregistrement automatique (plus de bouton) */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--bordure-legere)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontSize: '11px',
          color: (hasError || taIncoherente) ? 'var(--erreur-texte)'
               : (!dirty && hasAnyValue)     ? 'var(--succes-texte)'
               :                               'var(--texte-tertiaire)',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          {hasError || taIncoherente
            ? t('triage.corrigerHorsPlage')
            : save.isPending
              ? t('triage.enregistrement')
              : !hasAnyValue
                ? t('triage.saisirAuMoinsUne')
                : dirty
                  ? t('triage.enregistrementAutoCarte')
                  : <><Check size={12} /> {t('triage.constantesEnregistrees')}</>}
        </span>
      </div>
    </div>
  )
}
