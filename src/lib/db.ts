import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type { Exercise, ExerciseSet, Session, SessionType, WeighIn, WeighSlot } from './types'

function uid(): string {
  const u = auth.currentUser
  if (!u) throw new Error('not authenticated')
  return u.uid
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const sessionsCol = () => collection(db, 'users', uid(), 'sessions')
const sessionRef = (id: string) => doc(db, 'users', uid(), 'sessions', id)
const weighInsCol = () => collection(db, 'users', uid(), 'weighIns')
const weighInRef = (id: string) => doc(db, 'users', uid(), 'weighIns', id)

function toMs(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis()
  if (typeof v === 'number') return v
  return Date.now()
}

function parseSession(id: string, data: Record<string, unknown>): Session {
  const rawType = data.type as string | undefined
  const type = rawType === 'running' ? 'running' : 'strength'
  return {
    id,
    date: (data.date as string) ?? '',
    notes: (data.notes as string | null) ?? null,
    createdAt: toMs(data.createdAt),
    type,
    exercises: Array.isArray(data.exercises) ? (data.exercises as Exercise[]) : [],
    distanceMeters: typeof data.distanceMeters === 'number' ? data.distanceMeters : null,
    durationSeconds: typeof data.durationSeconds === 'number' ? data.durationSeconds : null,
    route: (data.route as string | null) ?? null,
  }
}

function parseWeighIn(id: string, data: Record<string, unknown>): WeighIn {
  const slot = data.slot as string | undefined
  return {
    id,
    date: (data.date as string) ?? '',
    weight: Number(data.weight ?? 0),
    note: (data.note as string | null) ?? null,
    slot: slot === 'morning' || slot === 'evening' ? slot : null,
    createdAt: toMs(data.createdAt),
  }
}

export async function listSessions(max = 60): Promise<Session[]> {
  const q = query(sessionsCol(), orderBy('createdAt', 'desc'), limit(max))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => parseSession(d.id, d.data()))
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return b.createdAt - a.createdAt
    })
}

export async function getSession(id: string): Promise<Session | null> {
  const snap = await getDoc(sessionRef(id))
  if (!snap.exists()) return null
  return parseSession(snap.id, snap.data())
}

export async function createSession(
  date: string,
  notes: string | null = null,
  type: SessionType = 'strength',
): Promise<Session> {
  const docRef = await addDoc(sessionsCol(), {
    date,
    notes,
    type,
    exercises: [],
    createdAt: serverTimestamp(),
  })
  return { id: docRef.id, date, notes, type, exercises: [], createdAt: Date.now() }
}

/** Find an existing session on a date, or create a new one. Ensures ≤1 session per day. */
export async function findOrCreateSessionOnDate(date: string, type: SessionType = 'strength'): Promise<Session> {
  const q = query(sessionsCol(), where('date', '==', date), limit(1))
  const snap = await getDocs(q)
  if (!snap.empty) {
    const d = snap.docs[0]
    return parseSession(d.id, d.data())
  }
  return createSession(date, null, type)
}

export async function updateRunningSession(
  id: string,
  patch: { distanceMeters?: number | null; durationSeconds?: number | null; route?: string | null },
) {
  await updateDoc(sessionRef(id), patch)
}

/**
 * Duplicate a session's structure (exercise names) into another date.
 * Sets are NOT copied — user fills fresh reps/weight.
 * If a session already exists at `toDate`, its exercises are replaced with the template.
 */
export async function duplicateSession(fromId: string, toDate: string): Promise<Session> {
  const source = await getSession(fromId)
  if (!source) throw new Error('Séance source introuvable')
  const templateExercises: Exercise[] = source.exercises.map(ex => ({
    id: uuid(),
    name: ex.name,
    sets: [],
  }))
  const target = await findOrCreateSessionOnDate(toDate)
  await updateDoc(sessionRef(target.id), { exercises: templateExercises })
  return { ...target, exercises: templateExercises }
}

export async function updateSession(id: string, patch: Partial<Pick<Session, 'date' | 'notes' | 'type'>>) {
  await updateDoc(sessionRef(id), patch)
}

export async function deleteSession(id: string) {
  await deleteDoc(sessionRef(id))
}

async function mutateExercises(sessionId: string, fn: (exercises: Exercise[]) => Exercise[]): Promise<Exercise[]> {
  const snap = await getDoc(sessionRef(sessionId))
  const current = (snap.data()?.exercises as Exercise[]) ?? []
  const next = fn(current)
  await updateDoc(sessionRef(sessionId), { exercises: next })
  return next
}

export async function addExercise(sessionId: string, name: string): Promise<Exercise> {
  const newEx: Exercise = { id: uuid(), name, sets: [] }
  await mutateExercises(sessionId, prev => [...prev, newEx])
  return newEx
}

export async function renameExercise(sessionId: string, exerciseId: string, name: string) {
  await mutateExercises(sessionId, prev =>
    prev.map(e => (e.id === exerciseId ? { ...e, name } : e)),
  )
}

export async function deleteExercise(sessionId: string, exerciseId: string) {
  await mutateExercises(sessionId, prev => prev.filter(e => e.id !== exerciseId))
}

export async function addSet(
  sessionId: string,
  exerciseId: string,
  reps: number,
  weight: number,
): Promise<ExerciseSet> {
  const newSet: ExerciseSet = { id: uuid(), reps, weight }
  await mutateExercises(sessionId, prev =>
    prev.map(e => (e.id === exerciseId ? { ...e, sets: [...e.sets, newSet] } : e)),
  )
  return newSet
}

export async function updateSet(
  sessionId: string,
  exerciseId: string,
  setId: string,
  patch: Partial<Pick<ExerciseSet, 'reps' | 'weight'>>,
) {
  await mutateExercises(sessionId, prev =>
    prev.map(e =>
      e.id === exerciseId
        ? { ...e, sets: e.sets.map(s => (s.id === setId ? { ...s, ...patch } : s)) }
        : e,
    ),
  )
}

export async function deleteSet(sessionId: string, exerciseId: string, setId: string) {
  await mutateExercises(sessionId, prev =>
    prev.map(e =>
      e.id === exerciseId ? { ...e, sets: e.sets.filter(s => s.id !== setId) } : e,
    ),
  )
}

export async function listWeighIns(max = 180): Promise<WeighIn[]> {
  const q = query(weighInsCol(), orderBy('createdAt', 'desc'), limit(max))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => parseWeighIn(d.id, d.data()))
    .sort((a, b) => b.date.localeCompare(a.date))
}

/** Set (create or overwrite) a weigh-in for a specific date/slot. Enforces ≤1 per slot/day. */
export async function setWeighIn(
  date: string,
  slot: WeighSlot,
  weight: number,
  note: string | null = null,
): Promise<WeighIn> {
  const id = `${date}-${slot}`
  await setDoc(weighInRef(id), {
    date,
    slot,
    weight,
    note,
    createdAt: serverTimestamp(),
  })
  return { id, date, slot, weight, note, createdAt: Date.now() }
}

export async function getWeighIn(date: string, slot: WeighSlot): Promise<WeighIn | null> {
  const snap = await getDoc(weighInRef(`${date}-${slot}`))
  if (!snap.exists()) return null
  return parseWeighIn(snap.id, snap.data())
}

export async function deleteWeighIn(id: string) {
  await deleteDoc(weighInRef(id))
}

export async function getDistinctExerciseNames(): Promise<string[]> {
  const sessions = await listSessions(60)
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of sessions) {
    for (const ex of s.exercises) {
      const key = ex.name.trim().toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        out.push(ex.name.trim())
      }
    }
  }
  return out
}

/**
 * Rename all exercises whose normalized name matches `fromNormalized` to `toName`.
 * Touches every session that contains a matching exercise.
 */
export async function renameExerciseEverywhere(
  fromNormalized: string,
  toName: string,
  normalize: (n: string) => string,
): Promise<number> {
  const all = await listSessions(500)
  let touched = 0
  for (const session of all) {
    let changed = false
    const nextEx = session.exercises.map(ex => {
      if (normalize(ex.name) === fromNormalized && ex.name !== toName) {
        changed = true
        return { ...ex, name: toName }
      }
      return ex
    })
    if (changed) {
      await updateDoc(sessionRef(session.id), { exercises: nextEx })
      touched++
    }
  }
  return touched
}

/**
 * Aggregated view: every distinct exercise (by normalized key) with its display name,
 * total set count and total volume. Used by the exercise management + history pages.
 */
export type ExerciseAggregate = {
  key: string // normalized
  displayName: string // most-used variant
  totalSets: number
  totalVolumeKg: number
  bestWeightKg: number
  lastUsedIso: string
  variantNames: string[] // all raw spellings seen
}

export async function getExerciseAggregates(
  normalize: (n: string) => string,
): Promise<ExerciseAggregate[]> {
  const sessions = await listSessions(500)
  const map = new Map<string, {
    displayCounts: Map<string, number>
    totalSets: number
    totalVolumeKg: number
    bestWeightKg: number
    lastUsedIso: string
    variantNames: Set<string>
  }>()
  for (const s of sessions) {
    for (const ex of s.exercises) {
      const name = ex.name.trim()
      if (!name) continue
      const key = normalize(name)
      const entry = map.get(key) ?? {
        displayCounts: new Map<string, number>(),
        totalSets: 0,
        totalVolumeKg: 0,
        bestWeightKg: 0,
        lastUsedIso: '',
        variantNames: new Set<string>(),
      }
      entry.displayCounts.set(name, (entry.displayCounts.get(name) ?? 0) + 1)
      entry.variantNames.add(name)
      entry.totalSets += ex.sets.length
      for (const set of ex.sets) {
        entry.totalVolumeKg += set.reps * Number(set.weight)
        if (Number(set.weight) > entry.bestWeightKg) entry.bestWeightKg = Number(set.weight)
      }
      if (s.date > entry.lastUsedIso) entry.lastUsedIso = s.date
      map.set(key, entry)
    }
  }
  const out: ExerciseAggregate[] = []
  for (const [key, v] of map) {
    // pick most-frequent spelling as displayName
    let bestName = ''
    let bestCount = 0
    for (const [n, c] of v.displayCounts) {
      if (c > bestCount) { bestName = n; bestCount = c }
    }
    out.push({
      key,
      displayName: bestName,
      totalSets: v.totalSets,
      totalVolumeKg: v.totalVolumeKg,
      bestWeightKg: v.bestWeightKg,
      lastUsedIso: v.lastUsedIso,
      variantNames: [...v.variantNames],
    })
  }
  out.sort((a, b) => b.totalSets - a.totalSets)
  return out
}
