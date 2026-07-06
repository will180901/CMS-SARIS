/**
 * PhotoCropModal — recadrage d'une photo de profil avant envoi (façon WhatsApp) :
 * glisser pour repositionner, molette/curseur pour zoomer, aperçu masqué en
 * cercle. Le backend recadre de toute façon en carré centré (256×256) — cet
 * écran permet à l'utilisateur de choisir LUI-MÊME la partie gardée au lieu
 * de subir un centrage automatique.
 */

import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import { useTranslation } from 'react-i18next'
import { ImageUp, ZoomIn, ZoomOut } from 'lucide-react'
import { Slider } from '@workspace/ui/components/slider'
import { Modal } from './Modal'
import { Button } from './Button'

const OUTPUT_SIZE = 512

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function cropToBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image  = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width  = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas non supporté')
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Échec de génération de l’image'))), 'image/jpeg', 0.92)
  })
}

interface PhotoCropModalProps {
  imageSrc: string
  busy?: boolean
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

export function PhotoCropModal({ imageSrc, busy, onConfirm, onCancel }: PhotoCropModalProps) {
  const { t } = useTranslation()
  const [crop, setCrop]   = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom]   = useState(1)
  const [area, setArea]   = useState<Area | null>(null)
  const [processing, setProcessing] = useState(false)

  const onCropComplete = useCallback((_percent: Area, pixels: Area) => setArea(pixels), [])

  async function handleConfirm() {
    if (!area) return
    setProcessing(true)
    try {
      const blob = await cropToBlob(imageSrc, area)
      onConfirm(blob)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Modal
      icon={<ImageUp size={18} />}
      title={t('settings.photoCropTitle')}
      subtitle={t('settings.photoCropHint')}
      width={420}
      onClose={onCancel}
      footer={(
        <>
          <Button variant="secondary" onClick={onCancel} disabled={processing || busy}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleConfirm} loading={processing || busy} disabled={!area}>{t('common.confirm')}</Button>
        </>
      )}
    >
      <div style={{
        position: 'relative', width: '100%', height: 320,
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        background: 'var(--fond-surface-2)',
      }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          minZoom={1}
          maxZoom={3}
          cropShape="round"
          showGrid={false}
          restrictPosition
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--espace-3)' }}>
        <ZoomOut aria-hidden="true" size={15} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
        <Slider value={[zoom]} min={1} max={3} step={0.01} onValueChange={([z]) => setZoom(z ?? 1)} aria-label={t('settings.photoCropZoom')} />
        <ZoomIn aria-hidden="true" size={15} style={{ color: 'var(--texte-tertiaire)', flexShrink: 0 }} />
      </div>
    </Modal>
  )
}
