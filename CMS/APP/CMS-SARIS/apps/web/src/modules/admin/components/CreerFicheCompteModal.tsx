/**
 * CreerFicheCompteModal — donner une fiche du personnel à un compte qui n'en a pas.
 *
 * L'administrateur système créé à l'installation n'a ni nom ni matricule : il n'est qu'un
 * identifiant de connexion. Or employé = personnel = utilisateur — c'est la fiche qui permet à
 * l'accueil de le retrouver et d'ouvrir son dossier patient le jour où il vient se soigner.
 * Les comptes soignants, eux, sont créés avec leur fiche.
 *
 * On ne demande que l'indispensable (identité, matricule, fonction) ; naissance, sexe, section
 * de paie et département restent facultatifs ici et sont demandés à l'accueil au premier passage.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IdCard } from 'lucide-react'
import { Modal, Button, Field, TextInput, SelectBox } from '@/components/saris'
import { useIsCompact } from '@/hooks/useMediaQuery'
import { optionsFonction, fonctionParDefaut } from '@/config/fonctions'
import type { UtilisateurAdmin } from '../api/admin.api'
import { useCreerFicheDuCompte } from '../hooks/useAdmin'
import { ChampsEmploye } from './ChampsEmploye'
import { employeCoherent, employeDepuisFiche, employeVersPayload } from './donneesEmploye'

export function CreerFicheCompteModal({ compte, onClose }: {
  compte:  UtilisateurAdmin
  onClose: () => void
}) {
  const { t } = useTranslation()
  const isCompact = useIsCompact()
  const cols2 = isCompact ? '1fr' : '1fr 1fr'
  const creer = useCreerFicheDuCompte()

  const [prenom,    setPrenom]    = useState('')
  const [nom,       setNom]       = useState('')
  const [matricule, setMatricule] = useState('')
  const [metier,    setMetier]    = useState<string>(() => fonctionParDefaut(compte.roles.map(r => r.code)))
  const [employe,   setEmploye]   = useState(() => employeDepuisFiche(null))

  const valide =
    nom.trim().length >= 2 && prenom.trim().length >= 2 && matricule.trim().length >= 2
    && employeCoherent(employe)

  async function enregistrer() {
    if (!valide) return
    try {
      await creer.mutateAsync({
        compteId: compte.id,
        data: {
          nom:       nom.trim(),
          prenom:    prenom.trim(),
          matricule: matricule.trim(),
          role:      metier as never,
          // La fiche suit le site du compte, comme à la création d'un compte soignant.
          siteId:    compte.siteId,
          ...employeVersPayload(employe),
        },
      })
      onClose()
    } catch {
      // Toast émis par le hook (matricule déjà pris…) — on garde la fenêtre ouverte.
    }
  }

  return (
    <Modal
      icon={<IdCard size={16} />}
      title={t('admin.creerFicheTitre', { defaultValue: 'Créer la fiche du personnel' })}
      subtitle={t('admin.creerFicheSousTitre', {
        defaultValue: 'Compte « {{login}} » : sans fiche, la personne reste introuvable à l’accueil',
        login: compte.login,
      })}
      width={560}
      onClose={() => { if (!creer.isPending) onClose() }}
      footer={
        <>
          <Button variant="secondary" disabled={creer.isPending} onClick={onClose}>
            {t('admin.cancel')}
          </Button>
          <Button variant="primary" disabled={!valide} loading={creer.isPending} onClick={enregistrer}>
            {t('admin.creerFicheAction', { defaultValue: 'Créer la fiche' })}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--espace-4)' }}>

        <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 'var(--espace-3)' }}>
          <Field label={t('admin.soignantPrenom', { defaultValue: 'Prénom' })} required>
            {(id) => <TextInput id={id} value={prenom} onChange={e => setPrenom(e.target.value)} />}
          </Field>
          <Field label={t('admin.soignantNom', { defaultValue: 'Nom' })} required>
            {(id) => <TextInput id={id} value={nom} onChange={e => setNom(e.target.value)} />}
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: cols2, gap: 'var(--espace-3)' }}>
          <Field label={t('admin.soignantMatricule', { defaultValue: 'Matricule' })} required>
            {(id) => <TextInput id={id} value={matricule} onChange={e => setMatricule(e.target.value)} />}
          </Field>
          <Field label={t('admin.fonctionLabel', { defaultValue: 'Fonction' })} required>
            {(id) => <SelectBox id={id} value={metier} onChange={setMetier} options={optionsFonction()} />}
          </Field>
        </div>

        <ChampsEmploye
          valeur={employe} onChange={setEmploye} cols2={cols2}
          intertitre={
            <span style={{
              fontSize: 'var(--font-size-overline)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.07em',
              color: 'var(--texte-tertiaire)',
            }}>
              {t('admin.emploiSection', { defaultValue: 'Emploi à la SARIS' })}
            </span>
          }
        />

        <p style={{ margin: 0, fontSize: 'var(--font-size-caption)', color: 'var(--texte-tertiaire)' }}>
          {t('admin.creerFicheHint', {
            defaultValue: 'Ce qui manque (naissance, sexe, section de paie, département) sera demandé à l’accueil au premier passage.',
          })}
        </p>
      </div>
    </Modal>
  )
}
