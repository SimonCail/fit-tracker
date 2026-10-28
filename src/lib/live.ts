import { useCallback, useSyncExternalStore } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { onSnapshot, type Query, type QuerySnapshot } from 'firebase/firestore'
import { auth } from './firebase'

/**
 * Live, shared Firestore queries.
 *
 * Each source is listened to once (onSnapshot) and shared by every page that needs it:
 * - the first result comes from the device cache, so pages show up instantly;
 * - changes (yours, or a friend accepting / sending a request) arrive by themselves;
 * - a local write shows up at once, without waiting for the server.
 * Listeners stay open while you are signed in, so going back to a page costs nothing.
 */

export type LiveSource<T> = {
  /** Unique per query AND per user (include the uid). */
  key: string
  query: () => Query
  map: (snap: QuerySnapshot) => T
}

export type LiveState<T> = { data: T | undefined; error: Error | null }

type Entry = {
  state: LiveState<unknown>
  listeners: Set<() => void>
  unsub: (() => void) | null
  ready: Promise<void>
  resolveReady: () => void
}

const registry = new Map<string, Entry>()
const EMPTY: LiveState<never> = { data: undefined, error: null }

function start<T>(src: LiveSource<T>): Entry {
  const existing = registry.get(src.key)
  // A listener that failed (offline at start, rules…) is retried by the next page that needs it.
  if (existing && !(existing.state.error && existing.listeners.size === 0)) return existing
  existing?.unsub?.()
  let resolveReady!: () => void
  const ready = new Promise<void>(r => { resolveReady = r })
  const entry: Entry = { state: EMPTY, listeners: new Set(), unsub: null, ready, resolveReady }
  registry.set(src.key, entry)
  const emit = () => entry.listeners.forEach(l => l())
  try {
    entry.unsub = onSnapshot(
      src.query(),
      snap => {
        entry.state = { data: src.map(snap), error: null }
        entry.resolveReady()
        emit()
      },
      error => {
        console.warn(`[live] ${src.key}`, error)
        entry.state = { data: entry.state.data, error }
        entry.resolveReady()
        emit()
      },
    )
  } catch (error) {
    entry.state = { data: undefined, error: error as Error }
    entry.resolveReady()
  }
  return entry
}

/** One-off read through the shared listener (instant once it has loaded). */
export async function readLive<T>(src: LiveSource<T>): Promise<T> {
  const entry = start(src)
  await entry.ready
  const { data, error } = entry.state as LiveState<T>
  if (data !== undefined) return data
  throw error ?? new Error('no data')
}

/** Latest value if the listener already has one (no waiting). */
export function peekLive<T>(src: LiveSource<T>): T | undefined {
  return registry.get(src.key)?.state.data as T | undefined
}

/** React hook: re-renders on every change. `src` may be null (e.g. signed out). */
export function useLive<T>(src: LiveSource<T> | null): LiveState<T> {
  const key = src?.key ?? null
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a source is identified by its key
  const subscribe = useCallback((cb: () => void) => {
    if (!src) return () => {}
    const entry = start(src)
    entry.listeners.add(cb)
    return () => { entry.listeners.delete(cb) }
  }, [key])
  const getSnapshot = useCallback(
    () => (key ? ((registry.get(key)?.state ?? EMPTY) as LiveState<T>) : EMPTY),
    [key],
  )
  return useSyncExternalStore(subscribe, getSnapshot)
}

/** Close every listener (sign-out / account switch). */
export function resetLive() {
  for (const e of registry.values()) e.unsub?.()
  registry.clear()
}

let lastUid: string | null = null
onAuthStateChanged(auth, u => {
  const uid = u?.uid ?? null
  if (uid !== lastUid) resetLive()
  lastUid = uid
})