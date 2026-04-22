import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const src = readFileSync(resolve(root, 'public/icon.svg'))

const outputs = [
  { file: 'public/pwa-192x192.png', size: 192 },
  { file: 'public/pwa-512x512.png', size: 512 },
  { file: 'public/apple-touch-icon.png', size: 180 },
]

for (const { file, size } of outputs) {
  await sharp(src).resize(size, size).png().toFile(resolve(root, file))
  console.log(`generated ${file} (${size}x${size})`)
}
