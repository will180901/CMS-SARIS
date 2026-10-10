/**
 * PersonnelChoisi — la personne du centre retenue à l'accueil, qui n'a pas encore de
 * dossier patient. Son dossier s'ouvrira avec la visite, à partir de sa fiche : on ne
 * ressaisit rien, on complète seulement ce qui manque à sa fiche.
 */

import { useTranslation } from 'react-i18next'
import { X, BadgeCheck } from 'lucide-react'
import { Label } from '@workspace/ui/components/label'
import { DatePicker } from '@/components/saris'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { PatientAvatar } from '@/modules/patients/components/CategorieBadge'
import { dateNaissance as dateNaissanceSchema, todayISO, minBirthISO } from '@/lib/validation'
import type { PersonnelSansDossier } from '@/modules/patients/api/patients.api'
import type { ComplementsPersonnel } from './personnelAccueil'

const lbl = { fontSize: '12px', fontWeight: '500', color: 'var(--texte-secondaire)' }

export function PersonnelChoisi({ personne, complements, onChange, onRetirer }: {
  personne:    PersonnelSansDossier
  complements: ComplementsPersonnel
  onChange:    (c: ComplementsPersonnel) => void
  onRetirer:   () => void
}) {
  const { t } = useTranslation()
  const isCompact = useIsCompact()
  const cols2 = isCompact ? '1fr' : '1fr 1fr'
  const patch = (p: Partial<ComplementsPersonnel>) => onChange({ ...complements, ...p })
  const manque = (c: PersonnelSansDossier['manquants'][number]) => personne.manquants.includes(c)
  const input = {
    height: 36, padding: '0 10px', fontSize: '13px', width: '100%', boxSizing: 'border-box' as const,
    borderRadius: 6, background: 'var(--fond-surface)', color: 'var(--texte-primaire)', outline: 'none',
    border: '1px solid var(--bordure-normale)',
  }
  const dateErr = complements.dateNaissance && !dateNaissanceSchema.safeParse(complements.dateNaissance).success
    ? dateNaissanceSchema.safeParse(complements.dateNaissance).error?.issues[0]?.message
    : null
  const requis = <span style={{ color: 'var(--erreur-texte)' }}>*</span>

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px', borderRadius: 8,
        background: 'var(--ap-50)', border: '1px solid var(--ap-200)',
      }}>
        <PatientAvatar
          nom={personne.nom} prenom={personne.prenom} size={40}
          code={personne.typeContrat === 'CDD' ? 'ASSURE_CDD' : 'ASSURE_CDI'}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--texte-primaire)', margin: 0 }}>
            {`${personne.prenom} ${personne.nom}`}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)', fontFamily: 'monospace' }}>
              {personne.matricule}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--texte-tertiaire)' }}>· {personne.fonction} · {personne.typeContrat}</span>
          </div>
        </div>
        <button
          type="button" onClick={onRetirer} title={t('triage.changerPatient')}
          style={{
            width: 26, height: 26, borderRadius: 6, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--texte-tertiaire)',
          }}
        >
          <X size={14} />
        </button>
      </div>

      <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '11px', color: 'var(--texte-secondaire)', margin: '8px 0 0' }}>
        <BadgeCheck size={13} style={{ color: 'var(--ap-600)', flexShrink: 0, marginTop: 1 }} />
        {t('triage.personnelDossierOuvert', { defaultValue: 'Membre du personnel, sans dossier patient : son dossier s’ouvrira avec cette visite, à partir de sa fiche.' })}
      </p>

      {/* Fiche incomplète : on ne demande QUE ce qui manque, une seule fois. */}
      {personne.manquants.length > 0 && (
        <div style={{
          marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10,
          padding: 12, borderRadius: 8,
          border: '1px solid var(--bordure-legere)', background: 'var(--fond-surface)',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--texte-secondaire)', margin: 0 }}>
            {t('triage.personnelACompleter', { defaultValue: 'Sa fiche est incomplète. Complétez-la (elle sera gardée pour la suite) :' })}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 10 }}>
            {manque('dateNaissance') && (
              <div>
                <Label style={lbl}>{t('triage.naissance')} {requis}</Label>
                <DatePicker
                  value={complements.dateNaissance}
                  onChange={v => patch({ dateNaissance: v ?? '' })}
                  min={minBirthISO()} max={todayISO()}
                  invalid={!!dateErr} size="sm"
                  placeholder={t('triage.naissance')}
                />
                {dateErr && <p style={{ fontSize: '10px', color: 'var(--erreur-texte)', fontWeight: 500, margin: '3px 0 0' }}>{dateErr}</p>}
              </div>
            )}
            {manque('sexe') && (
              <div>
                <Label style={lbl}>{t('triage.sexe')} {requis}</Label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['M', 'F'] as const).map(s => (
                    <button
                      key={s} type="button" onClick={() => patch({ sexe: s })}
                      style={{
                        flex: 1, height: 36, borderRadius: 6, fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        background: complements.sexe === s ? 'var(--ap-500)' : 'var(--fond-surface)',
                        color:      complements.sexe === s ? '#fff' : 'var(--texte-secondaire)',
                        border:     complements.sexe === s ? '1.5px solid var(--ap-500)' : '1px solid var(--bordure-normale)',
                      }}
                    >
                      {s === 'M' ? t('triage.sexeMasculin') : t('triage.sexeFeminin')}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {manque('sectionPaie') && (
              <div>
                <Label style={lbl}>{t('patients.fieldSectionPaie', { defaultValue: 'Section de paie' })} {requis}</Label>
                <input value={complements.sectionPaie} maxLength={100} onChange={e => patch({ sectionPaie: e.target.value })} style={input} />
              </div>
            )}
            {manque('departement') && (
              <div>
                <Label style={lbl}>{t('patients.fieldDepartement', { defaultValue: 'Département' })} {requis}</Label>
                <input value={complements.departement} maxLength={100} onChange={e => patch({ departement: e.target.value })} style={input} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
