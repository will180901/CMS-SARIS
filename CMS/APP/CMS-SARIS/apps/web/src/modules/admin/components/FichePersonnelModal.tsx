/**
 * FichePersonnelModal — modifier l'IDENTITÉ d'une personne (sa fiche clinique).
 *
 * À ne pas confondre avec le panneau de détail du compte : ici on touche à ce
 * qu'est la personne (nom, matricule, métier, statut), pas à sa façon de se
 * connecter. La distinction compte : la fiche est référencée par tout
 * l'historique clinique, alors que le compte n'est qu'un moyen d'accès.
 *
 * Remplace le formulaire de l'ancien onglet « Personnel soignant », dont c'était
 * la seule raison d'être une fois la liste fusionnée.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Stethoscope, Trash2, Power, PowerOff } from 'lucide-react'
import { Modal, Button, Field, TextInput, SelectBox } from '@/components/saris'
import { useIsCompact } from '@/hooks/useMediaQuery'
import {
  useUpdatePersonnel, useSetStatutPersonnel, useDeletePersonnel,
} from '@/modules/acteurs/hooks/usePersonnel'
import { labelMetier } from '@/config/labels'

const METIERS = ['MEDECIN', 'INFIRMIER', 'SAGE_FEMME', 'TECHNICIEN_LAB', 'ADMINISTRATIF'] as const

export interface FichePersonnel {
  id:        string
  nom:       string
  prenom:    string
  matricule: string
  metier:    string
  active:    boolean
  /** Une personne qui peut se connecter : sa fiche ne se supprime pas telle quelle. */
  aUnCompte: boolean
}

export function FichePersonnelModal({ fiche, onClose, canUpdate, canDelete }: {
  fiche:     FichePersonnel
  onClose:   () => void
  canUpdate: boolean
  canDelete: boolean
}) {
  const { t } = useTranslation()
  const isCompact = useIsCompact()
  const cols2 = isCompact ? '1fr' : '1fr 1fr'

  const update    = useUpdatePersonnel()
  const setStatut = useSetStatutPersonnel()
  const remove    = useDeletePersonnel()

  const [nom,       setNom]       = useState(fiche.nom)
  const [prenom,    setPrenom]    = useState(fiche.prenom)
  const [matricule, setMatricule] = useState(fiche.matricule)
  const [metier,    setMetier]    = useState(fiche.metier)
  const [confirmerSuppression, setConfirmerSuppression] = useState(false)

  const valide =
    nom.trim().length >= 2 && prenom.trim().length >= 2 && matricule.trim().length >= 2
  const modifie =
    nom !== fiche.nom || prenom !== fiche.prenom ||
    matricule !== fiche.matricule || metier !== fiche.metier

  const enCours = update.isPending || setStatut.isPending || remove.isPending

  async function enregistrer() {
    if (!valide || !modifie) return
    try {
      await update.mutateAsync({
        id: fiche.id,
        data: {
          nom:       nom.trim(),
          prenom:    prenom.trim(),
          matricule: matricule.trim(),
          role:      metier as never,
        },
      })
      onClose()
    } catch {
      // Toast émis par le hook (matricule déjà pris…) — on garde la fenêtre ouverte.
    }
  }

  async function basculerStatut() {
    try {
      await setStatut.mutateAsync({ id: fiche.id, statut: fiche.active ? 'INACTIF' : 'ACTIF' })
      onClose()
    } catch { /* toast */ }
  }

  async function supprimer() {
    try {
      await remove.mutateAsync(fiche.id)
      onClose()
    } catch {
      // 409 si l'historique clinique y réfère encore : le hook l'explique.
      setConfirmerSuppression(false)
    }
  }

  return (
    <Modal
      icon={<Stethoscope size={16} />}
      title={t('admin.ficheTitre', { defaultValue: 'Fiche de la personne' })}
      subtitle={`${fiche.prenom} ${fiche.nom} · ${fiche.matricule}`}
      width={520}
      onClose={() => { if (!enCours) onClose() }}
      footer={
        <>
          <Button variant="secondary" disabled={enCours} onClick={onClose}>
            {t('admin.cancel')}
          </Button>
          {canUpdate && (
            <Button
              variant="primary"
              disabled={!valide || !modifie}
              loading={update.isPending}
              onClick={enregistrer}
            >
              {t('admin.save', { defaultValue: 'Enregistrer' })}
            </Button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>

        <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 'var(--espace-3)' }}>
          <Field label={t('admin.soignantPrenom', { defaultValue: 'Prénom' })} required>
            {(id) => (
              <TextInput id={id} value={prenom} disabled={!canUpdate}
                onChange={e => setPrenom(e.target.value)} />
            )}
          </Field>
          <Field label={t('admin.soignantNom', { defaultValue: 'Nom' })} required>
            {(id) => (
              <TextInput id={id} value={nom} disabled={!canUpdate}
                onChange={e => setNom(e.target.value)} />
            )}
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 'var(--espace-3)' }}>
          <Field label={t('admin.soignantMatricule', { defaultValue: 'Matricule' })} required>
            {(id) => (
              <TextInput id={id} value={matricule} disabled={!canUpdate}
                onChange={e => setMatricule(e.target.value)} />
            )}
          </Field>
          <Field
            label={t('admin.metierLabel', { defaultValue: 'Métier' })}
            required
            hint={t('admin.metierHint', { defaultValue: 'Sa fonction réelle — indépendante des droits accordés.' })}
          >
            {(id) => (
              <SelectBox id={id} value={metier} onChange={setMetier} disabled={!canUpdate}
                options={METIERS.map(m => ({ value: m, label: labelMetier(m) }))} />
            )}
          </Field>
        </div>

        {/* Actions sur l'existence de la fiche, séparées de la simple édition */}
        {(canUpdate || canDelete) && (
          <div style={{
            display: 'flex', gap: 'var(--espace-2)', flexWrap: 'wrap',
            paddingTop: 'var(--espace-3)',
            borderTop: '1px solid var(--bordure-legere)',
          }}>
            {canUpdate && (
              <Button
                variant="secondary" size="sm"
                leftIcon={fiche.active ? <PowerOff size={13} /> : <Power size={13} />}
                loading={setStatut.isPending}
                onClick={basculerStatut}
              >
                {fiche.active
                  ? t('admin.desactiverFiche', { defaultValue: 'Désactiver' })
                  : t('admin.reactiverFiche',  { defaultValue: 'Réactiver' })}
              </Button>
            )}

            {canDelete && !fiche.aUnCompte && (
              confirmerSuppression ? (
                <Button
                  variant="danger" size="sm" leftIcon={<Trash2 size={13} />}
                  loading={remove.isPending} onClick={supprimer}
                >
                  {t('admin.confirmerSuppression', { defaultValue: 'Confirmer la suppression' })}
                </Button>
              ) : (
                <Button
                  variant="secondary" size="sm" leftIcon={<Trash2 size={13} />}
                  onClick={() => setConfirmerSuppression(true)}
                >
                  {t('admin.supprimerFiche', { defaultValue: 'Supprimer la fiche' })}
                </Button>
              )
            )}
          </div>
        )}

        {/* Pourquoi la suppression est indisponible : l'expliquer vaut mieux que
            de masquer un bouton sans raison visible. */}
        {canDelete && fiche.aUnCompte && (
          <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
            {t('admin.ficheAvecCompteHint', {
              defaultValue: 'Cette personne a un accès à l’application : retirez d’abord son accès pour pouvoir supprimer sa fiche.',
            })}
          </p>
        )}
      </div>
    </Modal>
  )
}
