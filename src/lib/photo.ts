/**
 * Turn a picked image into a small square JPEG data URL for the profile photo.
 *
 * The photo is stored directly in the Firestore profile document (no Firebase Storage
 * bucket needed), so it is centre-cropped and shrunk to 256 px: about 15–30 KB.
 */
const SIZE = 256
const MAX_BYTES = 140_000 // keep well under the limit set in firestore.rules

export async function fileToAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Ce fichier n’est pas une image.')
  const img = await loadImage(file)
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  if (!side) throw new Error('Image illisible.')
  const sx = (img.naturalWidth - side) / 2
  const sy = (img.naturalHeight - side) / 2

  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Impossible de traiter l’image.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE)

  for (const q of [0.85, 0.72, 0.6, 0.45]) {
    const url = canvas.toDataURL('image/jpeg', q)
    if (url.length <= MAX_BYTES) return url
  }
  throw new Error('Image trop lourde, essaie une autre photo.')
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Format non pris en charge par ce navigateur. Essaie un JPEG ou un PNG.'))
    }
    img.src = url
  })
}