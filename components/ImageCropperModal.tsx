'use client'

import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'

interface Area { x: number; y: number; width: number; height: number }
export interface CropInfo { x: number; y: number; width: number; height: number; imageWidth: number; imageHeight: number }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function getCroppedBlob(imageSrc: string, pixelCrop: Area, mimeType = 'image/jpeg', quality = 0.88): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), mimeType, quality))
}

async function getResizedBlob(imageSrc: string, mimeType = 'image/jpeg', quality = 0.82): Promise<{ blob: Blob; width: number; height: number }> {
  const image = await loadImage(imageSrc)
  const scale = Math.min(1, 1600 / image.naturalWidth)
  const w = Math.round(image.naturalWidth * scale)
  const h = Math.round(image.naturalHeight * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0, w, h)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), mimeType, quality))
  return { blob, width: w, height: h }
}

interface Props {
  imageSrc: string
  aspect: number
  cropShape?: 'rect' | 'round'
  softCrop?: boolean
  onSave: (blob: Blob, cropInfo?: CropInfo) => Promise<void>
  onCancel: () => void
}

export default function ImageCropperModal({ imageSrc, aspect, cropShape = 'rect', softCrop, onSave, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  async function handleSave() {
    if (!croppedAreaPixels) return
    setSaving(true)
    try {
      if (softCrop) {
        const { blob, width: iw, height: ih } = await getResizedBlob(imageSrc)
        const origImage = await loadImage(imageSrc)
        const scale = iw / origImage.naturalWidth
        const cropInfo: CropInfo = {
          x: Math.round(croppedAreaPixels.x * scale),
          y: Math.round(croppedAreaPixels.y * scale),
          width: Math.round(croppedAreaPixels.width * scale),
          height: Math.round(croppedAreaPixels.height * scale),
          imageWidth: iw,
          imageHeight: ih,
        }
        await onSave(blob, cropInfo)
      } else {
        const blob = await getCroppedBlob(imageSrc, croppedAreaPixels)
        await onSave(blob)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{ background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 560, boxShadow: '0 24px 60px rgba(0,0,0,.5)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: 16 }}>Afbeelding bijsnijden</div>

        <div style={{ position: 'relative', width: '100%', paddingBottom: cropShape === 'round' ? '100%' : '56.25%', borderRadius: 8, overflow: 'hidden', background: '#000' }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={cropShape}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            className="btn-cancel"
            onClick={onCancel}
            style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: 'var(--cancel-fg)', border: '1px solid var(--cancel-border)' }}
          >Annuleren</button>
          <button
            className="btn-submit"
            onClick={handleSave}
            disabled={saving}
            style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: 6, cursor: saving ? 'wait' : 'pointer', border: 'none', background: 'var(--accent)', color: 'var(--accent-fg)', opacity: saving ? 0.7 : 1 }}
          >{saving ? 'Bezig...' : 'Opslaan'}</button>
        </div>
      </div>
    </div>
  )
}
