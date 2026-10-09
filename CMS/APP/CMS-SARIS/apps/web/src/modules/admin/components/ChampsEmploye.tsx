/**
 * ChampsEmploye — ce qui fait d'une personne du centre un EMPLOYÉ de la SARIS.
 *
 * Employé = personnel = utilisateur du système. Ces informations ne servent pas
 * qu'à la fiche : le jour où la personne passe à l'accueil pour se soigner, son
 * dossier patient s'ouvre à partir d'elles, sans rien ressaisir (et donc sans
 * risque d'un second dossier sous une autre orthographe).
 *
 * Partagé par l'assistant « Nouvelle personne » et la fiche de la personne, pour
 * que les deux écrans posent exactement les mêmes questions.
 */

import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Field, TextInput, SelectBox, DatePicker } from '@/components/saris'
import { dateNaissance as dateNaissanceSchema, todayISO, minBirthISO } from '@/lib/validation'
import type { TypeContratPersonnel } from '@/modules/acteurs/api/personnel.api'
import { naissanceValide, type DonneesEmploye } from './donneesEmploye'

export function ChampsEmploye({ valeur, onChange, cols2, disabled = false, requis = false, intertitre }: {
  valeur:    DonneesEmploye
  onChange:  (v: DonneesEmploye) => void
  cols2:     string
  disabled?: boolean
  /** Création : tout est exigé. Fiche existante : complétable plus tard. */
  requis?:   boolean
  /** Affiché entre l'identité (naissance, sexe) et l'emploi (contrat, paie…). */
  intertitre?: ReactNode
}) {
  const { t } = useTranslation()
  const set = (patch: Partial<DonneesEmploye>) => onChange({ ...valeur, ...patch })
  const dateErreur = valeur.dateNaissance && !naissanceValide(valeur.dateNaissance)
    ? dateNaissanceSchema.safeParse(valeur.dateNaissance).error?.issues[0]?.message
    : undefined

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 'var(--espace-3)' }}>
        <Field label={t('admin.naissanceLabel', { defaultValue: 'Date de naissance' })} required={requis} error={dateErreur}>
          {(id) => (
            <DatePicker
              id={id} value={valeur.dateNaissance} disabled={disabled}
              onChange={v => set({ dateNaissance: v ?? '' })}
              min={minBirthISO()} max={todayISO()}
              invalid={!!dateErreur} fullWidth
              placeholder={t('admin.naissancePlaceholder', { defaultValue: 'jj/mm/aaaa' })}
            />
          )}
        </Field>
        <Field label={t('admin.sexeLabel', { defaultValue: 'Sexe' })} required={requis}>
          {(id) => (
            <SelectBox
              id={id} value={valeur.sexe} disabled={disabled}
              onChange={v => set({ sexe: v as 'M' | 'F' })}
              options={[
                // Le sélecteur n'affiche pas d'invite quand rien n'est choisi : on la lui donne.
                { value: '', label: t('admin.sexeChoisir', { defaultValue: 'Choisir…' }), disabled: true },
                { value: 'M', label: t('triage.sexeMasculin') },
                { value: 'F', label: t('triage.sexeFeminin') },
              ]}
            />
          )}
        </Field>
      </div>

      {intertitre}

      <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 'var(--espace-3)' }}>
        <Field label={t('admin.contratLabel', { defaultValue: 'Contrat' })} required={requis}>
          {(id) => (
            <SelectBox
              id={id} value={valeur.typeContrat} disabled={disabled}
              onChange={v => set({ typeContrat: v as TypeContratPersonnel })}
              options={[
                { value: 'CDI', label: t('admin.contratCdi', { defaultValue: 'CDI' }) },
                { value: 'CDD', label: t('admin.contratCdd', { defaultValue: 'CDD' }) },
              ]}
            />
          )}
        </Field>
        <Field label={t('admin.sectionPaieLabel', { defaultValue: 'Section de paie' })} required={requis}>
          {(id) => (
            <TextInput id={id} value={valeur.sectionPaie} disabled={disabled} maxLength={100}
              onChange={e => set({ sectionPaie: e.target.value })} />
          )}
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 'var(--espace-3)' }}>
        <Field label={t('admin.serviceLabel', { defaultValue: 'Service' })} required={requis}>
          {(id) => (
            <TextInput id={id} value={valeur.service} disabled={disabled} maxLength={100}
              onChange={e => set({ service: e.target.value })} />
          )}
        </Field>
        <Field label={t('admin.departementLabel', { defaultValue: 'Département' })} required={requis}>
          {(id) => (
            <TextInput id={id} value={valeur.departement} disabled={disabled} maxLength={100}
              onChange={e => set({ departement: e.target.value })} />
          )}
        </Field>
      </div>
    </>
  )
}
