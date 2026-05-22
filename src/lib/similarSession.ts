import type { ExerciseSet, Session } from './types'
import { normalizeExerciseName } from './exerciseName'

/** Negative when `a` happened before `b`. Same date → earlier `createdAt` first. */
export function compareChrono(a: Session, b: Session): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return a.createdAt - b.createdAt
}

/** Normalized, de-duplicated set of exercise names present in a session. */
function exerciseKeys(s: Session): Set<string> {
  const keys = new Set<string>()
  for (const ex of s.exercises) {
    const k = normalizeExerciseName(ex.name)
    if (k) keys.add(k)
  }
  return keys
}

export type SimilarMatch = {
  session: Session
  /** How many exercises this session shares with the reference one. */
  overlap: number
  /** Normalized names shared with the reference session. */
  sharedKeys: Set<string>
}

/**
 * Pick the strength session most similar to `current`, looking only at sessions
 * that happened strictly before it. Similarity = number of shared exercises
 * (matched by normalized name, so accents/casing/spacing don't matter) — the
 * session title is intentionally ignored, so a mistyped or empty title still
 * resolves to the right "type" of session. Ties are broken by recency.
 * Returns null when `current` has no exercises or nothing overlaps.
 */
export function findLastSimilarSession(
  current: Session,
  all: Session[],
): SimilarMatch | null {
  const cur = exerciseKeys(current)
  if (cur.size === 0) return null
  let best: SimilarMatch | null = null
  for (const s of all) {
    if (s.id === current.id || s.type !== 'strength') continue
    if (compareChrono(s, current) >= 0) continue
    const shared = new Set<string>()
    for (const k of exerciseKeys(s)) if (cur.has(k)) shared.add(k)
    if (shared.size === 0) continue
    if (
      !best ||
      shared.size > best.overlap ||
      (shared.size === best.overlap && compareChrono(best.session, s) < 0)
    ) {
      best = { session: s, overlap: shared.size, sharedKeys: shared }
    }
  }
  return best
}

export type PreviousPerformance = {
  /** ISO date of the session this performance comes from. */
  date: string
  sets: ExerciseSet[]
  bodyweight: boolean
}

/**
 * For each exercise in `current`, find the most recent prior performance of that
 * exercise (matched by normalized name) — the sets logged the last time it was
 * done, in any session before this one. Exercises never done before (or only
 * ever logged with zero sets) are simply absent from the map.
 */
export function buildPreviousPerformances(
  current: Session,
  all: Session[],
): Map<string, PreviousPerformance> {
  const wanted = exerciseKeys(current)
  const out = new Map<string, PreviousPerformance>()
  if (wanted.size === 0) return out
  const prior = all
    .filter(s => s.id !== current.id && s.type === 'strength' && compareChrono(s, current) < 0)
    .sort((a, b) => compareChrono(b, a)) // most recent first
  for (const s of prior) {
    for (const ex of s.exercises) {
      const k = normalizeExerciseName(ex.name)
      if (!k || !wanted.has(k) || out.has(k) || ex.sets.length === 0) continue
      out.set(k, { date: s.date, sets: ex.sets, bodyweight: !!ex.bodyweight })
    }
    if (out.size === wanted.size) break
  }
  return out
}
