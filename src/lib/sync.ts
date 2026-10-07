import { useEffect, useState } from 'react'

/**
 * Offline-first writes.
 *
 * Firestore applies a write to its local cache instantly, but the promise only resolves
 * once the server has acknowledged it — which never happens in a basement gym with no
 * signal. `trackWrite` lets the UI move on after a short grace period while the real
 * promise keeps running in the background, and counts how many writes are still waiting
 * for the server so the interface can say so.
 */

let pending = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

const GRACE_MS = 700

export function trackWrite<T>(p: Promise<T>): Promise<void> {
  pending++
  emit()
  p.catch(e => console.warn('write failed', e)).finally(() => {
    pending = Math.max(0, pending - 1)
    emit()
  })
  return Promise.race([p.then(() => undefined), new Promise<void>(r => setTimeout(r, GRACE_MS))])
}

export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export function useSyncStatus() {
  const [state, setState] = useState(() => ({ online: !isOffline(), pending }))
  useEffect(() => {
    const update = () => setState({ online: !isOffline(), pending })
    listeners.add(update)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      listeners.delete(update)
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return state
}