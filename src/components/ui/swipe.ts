import { useEffect } from 'react'

const DRAG_START_PX = 8
const CLOSE_VELOCITY = 0.6 // px per ms: a quick flick closes even if short

/**
 * Pull a bottom sheet down with a finger; let go far enough (a quarter of its height)
 * or fast enough and it closes, otherwise it springs back.
 * Doesn't start from a text field, nor while the content is scrolled down, so scrolling
 * a long list still works normally. `phoneOnly` skips it when the panel is a centred
 * dialog (screens 640 px and wider).
 */
export function useSwipeDownToClose(node: HTMLElement | null, onClose: () => void, phoneOnly = false) {
  useEffect(() => {
    if (!node) return
    let state: 'idle' | 'pending' | 'drag' | 'ignore' = 'idle'
    let startX = 0
    let startY = 0
    let startT = 0
    let dy = 0

    const scrolledDown = (target: EventTarget | null) => {
      for (let el = target as HTMLElement | null; el; el = el.parentElement) {
        if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight) return true
        if (el === node) break
      }
      return false
    }

    const onStart = (e: TouchEvent) => {
      const t = e.target as HTMLElement
      if (
        e.touches.length !== 1 ||
        (phoneOnly && window.matchMedia('(min-width: 640px)').matches) ||
        t.closest('input, textarea, select, [contenteditable="true"], [data-no-swipe]') ||
        scrolledDown(t)
      ) {
        state = 'ignore'
        return
      }
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      startT = performance.now()
      dy = 0
      state = 'pending'
    }

    const onMove = (e: TouchEvent) => {
      if (state === 'idle' || state === 'ignore') return
      const d = e.touches[0].clientY - startY
      const dx = e.touches[0].clientX - startX
      if (state === 'pending') {
        // Horizontal gesture or a push upwards: leave it to the page.
        if ((Math.abs(dx) > DRAG_START_PX && Math.abs(dx) > Math.abs(d)) || d < -4) { state = 'ignore'; return }
        if (d < DRAG_START_PX) return
        state = 'drag'
        node.style.transition = 'none'
      }
      e.preventDefault()
      dy = Math.max(0, d - DRAG_START_PX)
      node.style.transform = `translateY(${dy}px)`
    }

    const onEnd = () => {
      if (state !== 'drag') { state = 'idle'; return }
      state = 'idle'
      const velocity = dy / Math.max(1, performance.now() - startT)
      if (dy > node.offsetHeight * 0.25 || (velocity > CLOSE_VELOCITY && dy > 30)) {
        node.style.transition = 'transform 200ms ease-in'
        node.style.transform = 'translateY(100%)'
        window.setTimeout(() => {
          // Already off-screen: skip the closing animation so it doesn't jump back up first.
          node.style.animation = 'none'
          onClose()
        }, 200)
      } else {
        node.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)'
        node.style.transform = ''
      }
    }

    node.addEventListener('touchstart', onStart, { passive: true })
    node.addEventListener('touchmove', onMove, { passive: false })
    node.addEventListener('touchend', onEnd)
    node.addEventListener('touchcancel', onEnd)
    return () => {
      node.removeEventListener('touchstart', onStart)
      node.removeEventListener('touchmove', onMove)
      node.removeEventListener('touchend', onEnd)
      node.removeEventListener('touchcancel', onEnd)
    }
  }, [node, onClose, phoneOnly])
}