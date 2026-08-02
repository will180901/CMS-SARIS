/**
 * ModeVieCard — Mode de vie du patient (recueil) : tabac, alcool, sommeil, sédentarité…
 * Carte autonome (état d'édition propre), toutes catégories. Endpoint PATCH /patients/:id/mode-vie.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Check, X, HeartPulse } from 'lucide-react'
import { Label }     from '@workspace/ui/components/label'
import { Textarea, SelectBox } from '@/components/saris'
import { useUpdateModeVie } from '../../hooks/usePatients'
import { useIsCompact } from '@/hooks/useMediaQuery'
import type { PatientDossier } from '@cms-saris/types'

/**
 * Chaque rubrique se saisit dans une liste déroulante et non plus au clavier :
 * le mode de vie est relevé en consultation, souvent debout et dans l'urgence, et
 * dix champs libres coûtaient dix frappes complètes. Les choix reprennent les
 * échelles qui étaient déjà proposées en indication dans les anciens champs.
 *
 * Le détail chiffré ou nuancé (heures de sommeil, substance précise, médicament
 * pris en automédication…) va dans « Observations », qui reste en texte libre.
 */
const FIELDS = [
  { key: 'tabac',            label: 'Tabac',               choix: ['Non', 'Occasionnel', 'Régulier', 'Sevré'] },
  { key: 'alcool',           label: 'Alcool',              choix: ['Non', 'Occasionnel', 'Régulier'] },
  { key: 'drogues',          label: 'Drogues',             choix: ['Non', 'Occasionnel', 'Régulier'] },
  { key: 'activitePhysique', label: 'Activité physique',   choix: ['Sédentaire', 'Modérée', 'Intense'] },
  { key: 'alimentation',     label: 'Alimentation',        choix: ['Équilibrée', 'Déséquilibrée', 'Régime particulier'] },
  { key: 'sommeil',          label: 'Sommeil',             choix: ['Bon', 'Moyen', 'Mauvais'] },
  { key: 'troublesSommeil',  label: 'Troubles du sommeil', choix: ['Non', 'Oui'] },
  { key: 'sedentarite',      label: 'Sédentarité',         choix: ['Non', 'Oui'] },
  { key: 'portCharges',      label: 'Port de charges',     choix: ['Non', 'Occasionnel', 'Fréquent'] },
  { key: 'automedication',   label: 'Automédication',      choix: ['Non', 'Oui'] },
] as const

type ModeVieKey = (typeof FIELDS)[number]['key'] | 'observations'

/**
 * Options d'une rubrique : « non renseigné » d'abord (pour pouvoir effacer), puis
 * les choix standard.
 *
 * Si le dossier contient déjà une valeur absente de la liste — les anciennes
 * saisies étaient libres — elle est ajoutée en fin de liste. Sans cela, la liste
 * n'aurait rien à sélectionner, afficherait « non renseigné », et le premier
 * enregistrement effacerait silencieusement une donnée clinique existante.
 */
function optionsPour(choix: readonly string[], actuelle: string | null | undefined, labelVide: string) {
  const options = [
    { value: '', label: labelVide },
    ...choix.map(c => ({ value: c, label: c })),
  ]
  if (actuelle && !choix.includes(actuelle)) {
    options.push({ value: actuelle, label: actuelle })
  }
  return options
}

export function ModeVieCard({ dossier, canWrite }: { dossier: PatientDossier; canWrite: boolean }) {
  const { t } = useTranslation()
  const update = useUpdateModeVie(dossier.id)
  const isCompact = useIsCompact()
  const cols3 = isCompact ? '1fr 1fr' : 'repeat(3, 1fr)'
  const mv = dossier.modeVie
  const [editing, setEditing] = useState(false)

  const initial = (): Record<ModeVieKey, string> => ({
    tabac:            mv?.tabac            ?? '',
    alcool:           mv?.alcool           ?? '',
    drogues:          mv?.drogues          ?? '',
    activitePhysique: mv?.activitePhysique ?? '',
    alimentation:     mv?.alimentation     ?? '',
    sommeil:          mv?.sommeil          ?? '',
    troublesSommeil:  mv?.troublesSommeil  ?? '',
    sedentarite:      mv?.sedentarite      ?? '',
    portCharges:      mv?.portCharges      ?? '',
    automedication:   mv?.automedication   ?? '',
    observations:     mv?.observations     ?? '',
  })
  const [vals, setVals] = useState<Record<ModeVieKey, string>>(initial)

  function startEdit() { setVals(initial()); setEditing(true) }
  function cancel()    { setEditing(false) }
  async function save() {
    await update.mutateAsync(Object.fromEntries(
      Object.entries(vals).map(([k, v]) => [k, v.trim() || undefined]),
    ))
    setEditing(false)
  }

  const tr = (key: string, label: string) => t(`patients.modeVie.${key}`, { defaultValue: label })
  const lbl  = { fontSize: '11px', fontWeight: 500 as const, color: 'var(--texte-secondaire)' }
  const fld  = { display: 'flex', flexDirection: 'column' as const, gap: '5px' }

  return (
    <div style={{ background: 'var(--fond-surface)', border: '1px solid var(--bordure-legere)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bordure-legere)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--fond-surface-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <HeartPulse size={13} style={{ color: 'var(--ap-600)' }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--texte-primaire)' }}>
            {t('patients.modeVie.title', { defaultValue: 'Mode de vie' })}
          </span>
        </div>
        {canWrite && !editing && (
          <button onClick={startEdit} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--ap-600)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
            <Pencil size={11} /> {t('patients.edit')}
          </button>
        )}
        {editing && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={cancel} style={{ padding: '3px 8px', borderRadius: 5, fontSize: '11px', color: 'var(--texte-secondaire)', background: 'none', border: '1px solid var(--bordure-normale)', cursor: 'pointer' }}>
              <X size={11} />
            </button>
            <button onClick={save} disabled={update.isPending} style={{ padding: '3px 8px', borderRadius: 5, fontSize: '11px', color: '#fff', background: 'var(--ap-500)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Check size={11} /> {update.isPending ? '…' : t('patients.save')}
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: '16px' }}>
        {!editing ? (
          <div style={{ display: 'grid', gridTemplateColumns: cols3, gap: '12px' }}>
            {FIELDS.map(f => (
              <div key={f.key}>
                <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--texte-tertiaire)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px' }}>{tr(f.key, f.label)}</p>
                <p style={{ fontSize: '13px', color: mv?.[f.key] ? 'var(--texte-primaire)' : 'var(--texte-tertiaire)', margin: 0, fontStyle: mv?.[f.key] ? 'normal' : 'italic' }}>
                  {mv?.[f.key] || t('patients.notProvided')}
                </p>
              </div>
            ))}
            {mv?.observations && (
              <div style={{ gridColumn: '1 / -1' }}>
                <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--texte-tertiaire)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 3px' }}>{t('patients.modeVie.observations', { defaultValue: 'Observations' })}</p>
                <p style={{ fontSize: '13px', color: 'var(--texte-primaire)', margin: 0, whiteSpace: 'pre-wrap' }}>{mv.observations}</p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols3, gap: '10px' }}>
              {FIELDS.map(f => (
                <div key={f.key} style={fld}>
                  <Label style={lbl}>{tr(f.key, f.label)}</Label>
                  <SelectBox
                    size="sm"
                    value={vals[f.key]}
                    onChange={val => setVals(v => ({ ...v, [f.key]: val }))}
                    placeholder={t('patients.notProvided')}
                    aria-label={tr(f.key, f.label)}
                    options={optionsPour(f.choix, mv?.[f.key], t('patients.notProvided'))}
                  />
                </div>
              ))}
            </div>
            <div style={fld}>
              <Label style={lbl}>{t('patients.modeVie.observations', { defaultValue: 'Observations' })}</Label>
              <Textarea
                value={vals.observations}
                onChange={e => setVals(v => ({ ...v, observations: e.target.value }))}
                maxLength={1000}
                rows={2}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
