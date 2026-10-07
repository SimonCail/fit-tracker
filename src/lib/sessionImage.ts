import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Session } from './types'
import { frNum, fromKg, type Unit } from './units'
import { setMaxWeightKg, setTotalReps, setVolumeKg } from './setMath'

/**
 * Renders a session as a 1080×1350 picture (4:5, the format social apps crop least)
 * in the app's own type and plate colours, then hands it to the share sheet.
 */

const C = {
  bg: '#000000',
  ink: '#F3F2EE',
  dim: '#9D9B95',
  faint: '#66645F',
  line: '#2C2C2C',
  lift: '#3F70E0',
  pr: '#EE4A3B',
  run: '#33B06C',
}
const SANS = '"Schibsted Grotesk Variable", system-ui, sans-serif'
const NUM = '"Big Shoulders Variable", "Schibsted Grotesk Variable", sans-serif'

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = r * 0.09
  ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = C.bg
  ctx.beginPath(); ctx.arc(x, y, r * 0.21, 0, Math.PI * 2); ctx.fill()
}

/** Word-wrap `text` into lines no wider than `max`. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (ctx.measureText(t).width > max && cur) { lines.push(cur); cur = w } else cur = t
  }
  if (cur) lines.push(cur)
  return lines
}

export async function renderSessionImage(session: Session, unit: Unit, records: Set<string>): Promise<Blob> {
  await Promise.all([
    document.fonts.load(`700 80px ${SANS}`),
    document.fonts.load(`500 40px ${SANS}`),
    document.fonts.load(`700 80px ${NUM}`),
  ]).catch(() => {})

  const W = 1080, H = 1350, P = 84
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'

  const running = session.type === 'running'
  const plate = running ? C.run : C.lift

  // Header: mark + date
  disc(ctx, P + 22, P + 22, 22, plate)
  ctx.fillStyle = C.ink
  ctx.font = `700 34px ${SANS}`
  ctx.fillText('Fit', P + 58, P + 34)
  ctx.fillStyle = C.dim
  ctx.font = `500 32px ${SANS}`
  const date = format(new Date(session.date + 'T12:00:00'), 'EEEE d MMMM yyyy', { locale: fr })
  const dateTxt = date.charAt(0).toUpperCase() + date.slice(1)
  ctx.textAlign = 'right'
  ctx.fillText(dateTxt, W - P, P + 34)
  ctx.textAlign = 'left'

  // Title
  let y = P + 150
  ctx.fillStyle = C.ink
  ctx.font = `750 92px ${SANS}`
  const title = session.notes || (running ? 'Course' : 'Séance')
  for (const line of wrap(ctx, title, W - 2 * P).slice(0, 2)) {
    ctx.fillText(line, P, y)
    y += 96
  }
  y += 20

  if (running) {
    const km = (session.distanceMeters ?? 0) / 1000
    const sec = session.durationSeconds ?? 0
    const pace = km > 0 && sec > 0 ? Math.round(sec / km) : 0
    const figs = [
      { v: km > 0 ? frNum(km, 2) : '–', u: 'km', l: 'Distance' },
      { v: sec > 0 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : '–', u: '', l: 'Durée' },
      { v: pace ? `${Math.floor(pace / 60)}:${String(pace % 60).padStart(2, '0')}` : '–', u: '/km', l: 'Allure' },
    ]
    y += 140
    figs.forEach((f, i) => {
      const fy = y + i * 250
      ctx.fillStyle = i === 0 ? C.run : C.ink
      ctx.font = `700 210px ${NUM}`
      ctx.fillText(f.v, P, fy + 120)
      const w = ctx.measureText(f.v).width
      ctx.fillStyle = C.dim
      ctx.font = `600 44px ${SANS}`
      if (f.u) ctx.fillText(f.u, P + w + 16, fy + 120)
      ctx.font = `500 32px ${SANS}`
      ctx.fillText(f.l, P, fy - 70)
    })
    if (session.route) {
      ctx.fillStyle = C.dim
      ctx.font = `500 34px ${SANS}`
      ctx.fillText(session.route, P, H - P)
    }
  } else {
    const exercises = session.exercises.filter(e => e.sets.length > 0)
    const maxRows = 7
    const shown = exercises.slice(0, maxRows)
    const footerTop = H - P - 150
    const rowH = Math.min(150, (footerTop - y - 30) / Math.max(1, shown.length))
    const big = rowH >= 120

    for (const ex of shown) {
      const isPR = records.has(ex.name.trim())
      ctx.fillStyle = C.ink
      ctx.font = `650 ${big ? 38 : 32}px ${SANS}`
      let name = ex.name
      while (ctx.measureText(name).width > W - 2 * P - (isPR ? 60 : 0) && name.length > 4) name = name.slice(0, -2)
      if (name !== ex.name) name = name.trimEnd() + '…'
      ctx.fillText(name, P, y + 38)
      if (isPR) disc(ctx, P + ctx.measureText(name).width + 34, y + 26, 16, C.pr)

      ctx.font = `600 ${big ? 54 : 44}px ${NUM}`
      let x = P
      const sy = y + 38 + (big ? 64 : 54)
      for (const s of ex.sets) {
        const w = Number(s.weight)
        const load = ex.bodyweight ? (w > 0 ? `+${frNum(fromKg(w, unit), 1)}` : 'PDC') : frNum(fromKg(w, unit), 1)
        const txt = `${s.reps}×${load}`
        const tw = ctx.measureText(txt).width
        if (x + tw > W - P) { ctx.fillStyle = C.faint; ctx.fillText('…', x, sy); break }
        ctx.fillStyle = isPR && setMaxWeightKg(s) === Math.max(...ex.sets.map(setMaxWeightKg)) ? C.pr : C.ink
        ctx.fillText(txt, x, sy)
        x += tw + 34
      }
      y += rowH
    }
    if (exercises.length > maxRows) {
      ctx.fillStyle = C.dim
      ctx.font = `500 30px ${SANS}`
      ctx.fillText(`+ ${exercises.length - maxRows} autre${exercises.length - maxRows > 1 ? 's' : ''}`, P, y + 10)
    }

    // Footer figures
    const sets = exercises.reduce((n, e) => n + e.sets.length, 0)
    const reps = exercises.reduce((n, e) => n + e.sets.reduce((m, s) => m + setTotalReps(s), 0), 0)
    const vol = fromKg(exercises.reduce((n, e) => n + (e.bodyweight ? 0 : e.sets.reduce((m, s) => m + setVolumeKg(s), 0)), 0), unit)
    ctx.strokeStyle = C.line; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(P, footerTop); ctx.lineTo(W - P, footerTop); ctx.stroke()
    const figs = [
      { v: String(sets), l: sets > 1 ? 'séries' : 'série' },
      { v: String(reps), l: 'répétitions' },
      { v: vol >= 1000 ? frNum(vol / 1000, 1) : String(Math.round(vol)), l: vol >= 1000 ? (unit === 'kg' ? 'tonnes soulevées' : 'k lb soulevées') : `${unit} soulevés` },
    ]
    const colW = (W - 2 * P) / 3
    figs.forEach((f, i) => {
      const fx = P + i * colW
      ctx.fillStyle = C.ink
      ctx.font = `700 96px ${NUM}`
      ctx.fillText(f.v, fx, footerTop + 105)
      ctx.fillStyle = C.dim
      ctx.font = `500 28px ${SANS}`
      ctx.fillText(f.l, fx, footerTop + 145)
    })
  }

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('export impossible'))), 'image/png'))
}

/** Native share sheet when the browser can share files, download otherwise. */
export async function shareSessionImage(blob: Blob, session: Session) {
  const name = `seance-${session.date}.png`
  const file = new File([blob], name, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: session.notes ?? 'Séance' })
      return 'shared' as const
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled' as const
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded' as const
}