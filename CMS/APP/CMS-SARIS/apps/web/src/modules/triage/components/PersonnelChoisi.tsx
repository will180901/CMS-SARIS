/**
 * PersonnelChoisi — la personne du centre retenue à l'accueil, qui n'a pas encore de
 * dossier patient. Son dossier s'ouvrira avec la visite, à partir de sa fiche : on ne
 * ressaisit rien, on complète seulement ce qui manque à sa fiche.
 *
 * Si un ANCIEN dossier à son nom existe sans matricule (venue avant d'avoir sa fiche),
 * on le signale. Le relier à sa fiche (il prend son matricule et la catégorie de son
 * contrat) évite un second dossier : c'est un changement de catégorie, donc réservé au
 * médecin chef et à l'administrateur. Les autres peuvent UTILISER cet ancien dossier pour
 * la visite, sans le relier.
 */

import { useTranslation } from 'react-i18next'
import { X, BadgeCheck, AlertTriangle, Link2 } from 'lucide-react'
import { Label } from '@workspace/ui/components/label'
import { DatePicker } from '@/components/saris'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { PatientAvatar } from '@/modules/patients/components/CategorieBadge'
import { dateNaissance as dateNaissanceSchema, todayISO, minBirthISO } from '@/lib/validation'
import { useFindSimilarPatients } from '@/modules/patients/hooks/usePatients'
import { calcAge } from '@/lib/age'
import type { PersonnelSansDossier } from '@/modules/patients/api/patients.api'
import type { ComplementsPersonnel } from './personnelAccueil'

const lbl = { fontSize: '12px', fontWeight: '500', color: 'var(--texte-secondaire)' }

export function PersonnelChoisi({ personne, complements, onChange, onRetirer, dossierARelier, onRelier, peutRelier, onUtiliser }: {
  personne:    PersonnelSansDossier
  complements: ComplementsPersonnel
  onChange:    (c: ComplementsPersonnel) => void
  onRetirer:   () => void
  /** Ancien dossier retenu pour être relié à sa fiche (null = ouvrir un nouveau dossier). */
  dossierARelier: string | null
  onRelier:       (dossierId: string | null) => void
  /** `patient.change_category` : relier un ancien dossier change sa catégorie. */
  peutRelier:     boolean
  /** Sans ce droit : visite ouverte sur l'ancien dossier tel quel (pas de lien à la fiche). */
  onUtiliser:     (dossier: { id: string; numeroPatient: string }) => void
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
  // Dossiers au même nom SANS matricule : un autre matricule désigne quelqu'un d'autre.
  const { data: similaires = [] } = useFindSimilarPatients({ nom: personne.nom, prenom: personne.prenom })
  const anciens = similaires.filter(s => !s.matricule)
  const relie = anciens.find(s => s.id === dossierARelier) ?? null

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

      {relie ? (
        <div style={{
          marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 8,
          padding: '10px 12px', borderRadius: 8,
          background: 'var(--fond-surface)', border: '1px solid var(--ap-200)',
        }}>
          <Link2 size={14} style={{ color: 'var(--ap-600)', flexShrink: 0, marginTop: 1 }} />
          <p style={{ flex: 1, margin: 0, fontSize: '12px', color: 'var(--texte-primaire)' }}>
            {t('triage.dossierARelier', { numero: relie.numeroPatient, contrat: personne.typeContrat })}
          </p>
          <button
            type="button" onClick={() => onRelier(null)}
            style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ap-600)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
          >
            {t('common.cancel', { defaultValue: 'Annuler' })}
          </button>
        </div>
      ) : (
        <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '11px', color: 'var(--texte-secondaire)', margin: '8px 0 0' }}>
          <BadgeCheck size={13} style={{ color: 'var(--ap-600)', flexShrink: 0, marginTop: 1 }} />
          {t('triage.personnelDossierOuvert', { defaultValue: 'Membre du personnel, sans dossier patient : son dossier s’ouvrira avec cette visite, à partir de sa fiche.' })}
        </p>
      )}

      {/* Ancien dossier à son nom, sans matricule : c'est peut-être elle. */}
      {!relie && anciens.length > 0 && (
        <div style={{
          marginTop: 10, padding: '10px 12px', borderRadius: 8,
          background: 'var(--avert-fond)', border: '1px solid var(--avert-bordure)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <AlertTriangle size={14} style={{ color: 'var(--avert-accent)', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--avert-texte)' }}>
              {t('triage.ancienDossierMemeNom', { count: anciens.length })}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {anciens.map(s => (
              <button
                key={s.id} type="button"
                onClick={() => (peutRelier ? onRelier(s.id) : onUtiliser(s))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '7px 10px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                  background: 'var(--fond-surface)', border: '1px solid var(--bordure-normale)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--texte-primaire)' }}>
                    {s.identite ? `${s.identite.prenom} ${s.identite.nom}` : s.numeroPatient}
                  </span>
                  <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--texte-tertiaire)' }}>{s.numeroPatient}</span>
                    {s.identite?.dateNaissance && <span style={{ fontSize: '10px', color: 'var(--texte-tertiaire)' }}>· {t('triage.ageAns', { age: calcAge(s.identite.dateNaissance) })}</span>}
                    {s.categoriePatient && <span style={{ fontSize: '10px', color: 'var(--texte-tertiaire)' }}>· {s.categoriePatient.libelle}</span>}
                  </div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ap-600)', flexShrink: 0 }}>
                  {peutRelier ? t('triage.relierAFiche') : t('triage.utiliserCeDossier')}
                </span>
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '10px', color: 'var(--avert-texte)' }}>
            {t('triage.sinonNouveauDossier')}
            {!peutRelier && <> {t('triage.relierReserve')}</>}
          </p>
        </div>
      )}

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
