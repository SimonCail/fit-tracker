import { useCallback, useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button, Modal, ModalContent, ModalTitle } from './ui'
import { cropToAvatar } from '../lib/photo'

const VIEW = 280 // size of the square crop area on screen, px
const MAX_ZOOM = 4

type Pos = { x: number; y: number; zoom: number } // image top-left in the view, and zoom (1 = just covers the circle)

/**
 * Choose the profile photo framing: drag to move, pinch (or wheel / slider) to zoom.
 * The circle shows exactly what the avatar will be.
 */
export function AvatarCropper({
  file,
  onCancel,
  onConfirm,
}: {
  file: File | null
  onCancel: () => void
  onConfirm: (dataUrl: string) => Promise<void> | void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0, zoom: 1 })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const posRef = useRef(pos)
  useEffect(() => { posRef.current = pos }, [pos])

  useEffect(() => {
    if (!file) return
    const u = URL.createObjectURL(file)
    setUrl(u)
    setNatural(null)
    setError(null)
    return () => URL.revokeObjectURL(u)
  }, [file])

  // Scale at zoom 1: the shorter side fills the view.
  const base = natural ? VIEW / Math.min(natural.w, natural.h) : 1

  /** Keep the image covering the whole view (no empty edge in the circle). */
  const clamp = useCallback(
    (p: Pos): Pos => {
      if (!natural) return p
      const zoom = Math.min(MAX_ZOOM, Math.max(1, p.zoom))
      const w = natural.w * base * zoom
      const h = natural.h * base * zoom
      return {
        zoom,
        x: Math.min(0, Math.max(VIEW - w, p.x)),
        y: Math.min(0, Math.max(VIEW - h, p.y)),
      }
    },
    [natural, base],
  )

  /** Zoom keeping the point (cx, cy) of the view still. */
  const zoomAt = useCallback(
    (p: Pos, nextZoom: number, cx = VIEW / 2, cy = VIEW / 2): Pos => {
      const z = Math.min(MAX_ZOOM, Math.max(1, nextZoom))
      const k = z / p.zoom
      return clamp({ zoom: z, x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k })
    },
    [clamp],
  )

  function onLoad() {
    const img = imgRef.current
    if (!img) return
    const n = { w: img.naturalWidth, h: img.naturalHeight }
    if (!n.w || !n.h) { setError('Image illisible.'); return }
    setNatural(n)
    const b = VIEW / Math.min(n.w, n.h)
    setPos({ zoom: 1, x: (VIEW - n.w * b) / 2, y: (VIEW - n.h * b) / 2 })
  }

  // --- gestures (pointer events: mouse, finger, pen) -------------------------------------
  const areaRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ pos: Pos; x: number; y: number; dist: number } | null>(null)

  const local = (e: { clientX: number; clientY: number }) => {
    const r = areaRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const snapshot = (p: Pos) => {
    const pts = [...pointers.current.values()]
    const cx = pts.reduce((s, q) => s + q.x, 0) / pts.length
    const cy = pts.reduce((s, q) => s + q.y, 0) / pts.length
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0
    gesture.current = { pos: p, x: cx, y: cy, dist }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!natural) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, local(e))
    snapshot(pos)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    pointers.current.set(e.pointerId, local(e))
    const pts = [...pointers.current.values()]
    const g = gesture.current
    const cx = pts.reduce((s, q) => s + q.x, 0) / pts.length
    const cy = pts.reduce((s, q) => s + q.y, 0) / pts.length
    // Move with the fingers…
    let next: Pos = { ...g.pos, x: g.pos.x + (cx - g.x), y: g.pos.y + (cy - g.y) }
    // …and with two of them, zoom by how much they spread.
    if (pts.length > 1 && g.dist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      next = zoomAt(next, g.pos.zoom * (dist / g.dist), cx, cy)
    } else {
      next = clamp(next)
    }
    setPos(next)
  }
  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    // Restart from where we are, so lifting one finger of two doesn't jump.
    if (pointers.current.size) snapshot(posRef.current)
    else gesture.current = null
  }

  // Mouse wheel / trackpad pinch on a computer. Not passive, so the page doesn't scroll.
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025))
      setPos(p => zoomAt(p, p.zoom * factor, e.clientX - r.left, e.clientY - r.top))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt, url])

  async function confirm() {
    const img = imgRef.current
    if (!img || !natural) return
    setSaving(true)
    setError(null)
    try {
      const scale = base * pos.zoom
      const dataUrl = cropToAvatar(img, { x: -pos.x / scale, y: -pos.y / scale, side: VIEW / scale })
      await onConfirm(dataUrl)
    } catch (e) {
      setError((e as Error).message || 'Envoi impossible.')
    } finally {
      setSaving(false)
    }
  }

  const step = (dz: number) => setPos(p => zoomAt(p, p.zoom + dz))

  return (
    <Modal open={!!file} onOpenChange={o => { if (!o && !saving) onCancel() }}>
      <ModalContent onOpenAutoFocus={e => e.preventDefault()}>
        <ModalTitle className="t-heading text-[20px]">Cadrer ta photo</ModalTitle>
        <p className="text-[14px] text-dim mt-1">Glisse pour déplacer, pince ou utilise le curseur pour zoomer.</p>

        <div className="mt-5 flex justify-center">
          <div
            ref={areaRef}
            data-no-swipe
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative overflow-hidden rounded-[16px] bg-surface-2 touch-none select-none cursor-grab active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
          >
            {url && (
              <img
                ref={imgRef}
                src={url}
                alt=""
                draggable={false}
                onLoad={onLoad}
                onError={() => setError('Format non pris en charge par ce navigateur. Essaie un JPEG ou un PNG.')}
                className="absolute left-0 top-0 max-w-none origin-top-left pointer-events-none"
                style={
                  natural
                    ? { width: natural.w * base, height: natural.h * base, transform: `translate(${pos.x}px, ${pos.y}px) scale(${pos.zoom})` }
                    : { opacity: 0 }
                }
              />
            )}
            {/* Darken outside the circle: what's inside is the avatar. */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none rounded-full"
              style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)', outline: '2px solid rgba(255,255,255,0.85)', outlineOffset: -1 }}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3" data-no-swipe>
          <button type="button" onClick={() => step(-0.25)} aria-label="Dézoomer" className="h-10 w-10 grid place-items-center text-dim hover:text-ink cursor-pointer">
            <Minus size={18} />
          </button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={pos.zoom}
            onChange={e => setPos(p => zoomAt(p, Number(e.target.value)))}
            aria-label="Zoom"
            className="flex-1 accent-[var(--color-accent)] cursor-pointer"
          />
          <button type="button" onClick={() => step(0.25)} aria-label="Zoomer" className="h-10 w-10 grid place-items-center text-dim hover:text-ink cursor-pointer">
            <Plus size={18} />
          </button>
        </div>

        {error && <p className="text-[13px] text-danger mt-2" role="alert">{error}</p>}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>Annuler</Button>
          <Button onClick={confirm} disabled={!natural || saving}>{saving ? 'Enregistrement…' : 'Utiliser'}</Button>
        </div>
      </ModalContent>
    </Modal>
  )
}