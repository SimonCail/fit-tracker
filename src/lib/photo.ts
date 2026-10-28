/**
 * Profile photos: a small square JPEG data URL.
 *
 * The photo is stored directly in the Firestore profile document (no Firebase Storage
 * bucket needed), so it is cropped and shrunk to 256 px: about 15–30 KB.
 * The crop is chosen by the user in AvatarCropper (move + zoom); fileToAvatar is the
 * plain centred version.
 */
const SIZE = 256
const MAX_BYTES = 140_000 // keep well under the limit set in firestore.rules

/** Square area of the original image, in its own pixels. */
export type CropArea = { x: number; y: number; side: number }

export async function fileToAvatar(file: File): Promise<string> {
  const img = await loadImageFile(file)
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  return cropToAvatar(img, { x: (img.naturalWidth - side) / 2, y: (img.naturalHeight - side) / 2, side })
}

export function cropToAvatar(img: HTMLImageElement, area: CropArea): string {
  if (!area.side) throw new Error('Image illisible.')
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Impossible de traiter l’image.')
  ctx.imageSmoothingQuality = 'high'
  // White behind, in case the image has transparency (PNG) — JPEG has no alpha.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.drawImage(img, area.x, area.y, area.side, area.side, 0, 0, SIZE, SIZE)

  for (const q of [0.85, 0.72, 0.6, 0.45]) {
    const url = canvas.toDataURL('image/jpeg', q)
    if (url.length <= MAX_BYTES) return url
  }
  throw new Error('Image trop lourde, essaie une autre photo.')
}

export function loadImageFile(file: File): Promise<HTMLImageElement> {
  if (!file.type.startsWith('image/') && file.type !== '') return Promise.reject(new Error('Ce fichier n’est pas une image.'))
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      if (!img.naturalWidth || !img.naturalHeight) reject(new Error('Image illisible.'))
      else resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Format non pris en charge par ce navigateur. Essaie un JPEG ou un PNG.'))
    }
    img.src = url
  })
}