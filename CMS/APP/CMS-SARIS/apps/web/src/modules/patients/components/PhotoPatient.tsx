/**
 * PhotoPatient — la photo du patient au format « photo d'identité », avec ses actions :
 * appareil photo (ajouter / changer) en bas à droite, corbeille (retirer) en bas à gauche.
 *
 * Même système que Paramètres : validation côté client, recadrage (PhotoCropModal) AVANT
 * l'envoi, aperçu local immédiat pendant l'enregistrement. Partagé par l'aperçu rapide
 * de la liste des patients et la colonne d'identité du dossier, pour qu'une photo se
 * présente et se change partout de la même façon.
 *
 * Les appelants le montent avec `key={patientId}` : changer de patient repart d'un état
 * vierge (aucun aperçu ni recadrage d'un autre patient ne survit).
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Camera, Trash2 } from 'lucide-react'
import { toast } from '@workspace/ui/components/sonner'
import { PhotoCropModal } from '@/components/saris'
import { useUploadPatientPhoto, useRemovePatientPhoto } from '../hooks/usePatients'

const PHOTO_MAX_BYTES = 5 * 1024 * 1024
const PHOTO_MIME_RE = /^image\/(jpeg|png|webp|gif)$/

export function PhotoPatient({ patientId, photoUrl, canEdit }: {
  patientId: string
  photoUrl:  string | null | undefined
  /** `patient.update` (et dossier non verrouillé) : sans ce droit, la photo se regarde. */
  canEdit:   boolean
}) {
  const { t } = useTranslation()
  const [apercu, setApercu] = useState<string | null>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadPhoto = useUploadPatientPhoto(patientId)
  const removePhoto = useRemovePatientPhoto(patientId)

  // Filet de sécurité : libère l'URL objet au démontage même si le recadrage
  // n'a pas été fermé explicitement (ex. l'utilisateur navigue ailleurs).
  useEffect(() => {
    return () => { if (cropSrc) URL.revokeObjectURL(cropSrc) }
  }, [cropSrc])

  // Photo affichée : aperçu local prioritaire, sinon photo persistée.
  // photoUrl est une data URL Base64 (stockée en base) → utilisable directement.
  const photo = apercu ?? photoUrl ?? null

  function closeCrop() {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-choisir le même fichier ensuite
    if (!file) return
    if (!PHOTO_MIME_RE.test(file.type)) {
      toast.error(t('patients.photoInvalidFormat'))
      return
    }
    if (file.size > PHOTO_MAX_BYTES) {
      toast.error(t('patients.photoTooLarge'))
      return
    }
    // Étape de recadrage AVANT l'envoi : le backend recadre de toute façon en
    // carré centré, autant laisser l'utilisateur choisir la partie gardée.
    setCropSrc(URL.createObjectURL(file))
  }

  function onCropConfirm(blob: Blob) {
    const reader = new FileReader()
    reader.onload = () => setApercu(reader.result as string) // aperçu immédiat, le temps du refetch
    reader.readAsDataURL(blob)
    uploadPhoto.mutate(new File([blob], 'photo.jpg', { type: 'image/jpeg' }), { onSuccess: closeCrop })
  }

  function onRemove() {
    removePhoto.mutate(undefined, { onSuccess: () => setApercu(null) })
  }

  const bouton = {
    position: 'absolute' as const, bottom: -6,
    width: 34, height: 34, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 1px 4px rgba(15, 23, 42, 0.18)',
  }

  return (
    <>
      <div style={{ position: 'relative', width: '100%' }}>
        <div style={{
          width: '100%', aspectRatio: '1 / 1', borderRadius: 'var(--radius-xl)', overflow: 'hidden',
          background: 'var(--fond-surface-2)', border: '1px solid var(--bordure-legere)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {photo
            ? <img src={photo} alt={t('patients.patientPhoto')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Users size={56} style={{ color: 'var(--texte-tertiaire)', opacity: 0.4 }} />}
        </div>
        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadPhoto.isPending}
              aria-label={photo ? t('patients.changePhoto') : t('patients.addPhoto')}
              title={photo ? t('patients.changePhoto') : t('patients.addPhoto')}
              style={{
                ...bouton, right: -6,
                background: 'var(--ap-400)', color: '#fff',
                border: '2px solid var(--fond-surface)',
                cursor: uploadPhoto.isPending ? 'wait' : 'pointer',
                opacity: uploadPhoto.isPending ? 0.7 : 1,
              }}
            >
              <Camera size={16} />
            </button>
            {photoUrl && (
              <button
                type="button"
                onClick={onRemove}
                disabled={removePhoto.isPending}
                aria-label={t('patients.removePhoto')}
                title={t('patients.removePhoto')}
                style={{
                  ...bouton, left: -6,
                  background: 'var(--fond-surface)', color: 'var(--erreur-accent)',
                  border: '2px solid var(--erreur-bordure)',
                  cursor: removePhoto.isPending ? 'wait' : 'pointer',
                  opacity: removePhoto.isPending ? 0.7 : 1,
                }}
              >
                <Trash2 size={15} />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={onPick} />
          </>
        )}
      </div>
      {cropSrc && (
        <PhotoCropModal imageSrc={cropSrc} busy={uploadPhoto.isPending} onConfirm={onCropConfirm} onCancel={closeCrop} />
      )}
    </>
  )
}
