import type { Session } from './types'
import { normalizeExerciseName } from './exerciseName'
import { compareChrono } from './similarSession'
import { estimate1RM } from './units'
import { setStages } from './setMath'

export type ExerciseRecord = {
  key: string
  name: string
  bodyweight: boolean
  /** Heaviest load (kg; "lest" for bodyweight movements) and the reps done with it. */
  weight: number
  reps: number
  date: string
  sessionId: string
  /** Best Brzycki estimate over sets of ≤ 12 reps (0 for bodyweight). */
  e1rm: number
  /** Most reps in a single set, all loads. */
  maxReps: number
}

export type RecordEvent = {
  key: string
  name: string
  bodyweight: boolean
  weight: number
  reps: number
  previous: number
  date: string
  sessionId: string
}

/** One pass over the history, oldest first: current records and every time one was beaten. */
export function computeRecords(sessions: Session[]) {
  const chrono = sessions.filter(s => s.type !== 'running').sort(compareChrono)
  const best = new Map<string, ExerciseRecord>()
  const names = new Map<string, Map<string, number>>()
  const events: RecordEvent[] = []

  for (const s of chrono) {
    for (const ex of s.exercises) {
      const key = normalizeExerciseName(ex.name)
      if (!key) continue
      const counts = names.get(key) ?? new Map<string, number>()
      counts.set(ex.name, (counts.get(ex.name) ?? 0) + 1)
      names.set(key, counts)
      const bw = !!ex.bodyweight
      for (const set of ex.sets) {
        for (const st of setStages(set)) {
          const cur = best.get(key)
          const w = Number(st.weight)
          if (!cur) {
            best.set(key, {
              key, name: ex.name, bodyweight: bw, weight: w, reps: st.reps, date: s.date, sessionId: s.id,
              e1rm: !bw && st.reps > 0 && st.reps <= 12 ? estimate1RM(w, st.reps) : 0, maxReps: st.reps,
            })
            continue
          }
          cur.bodyweight ||= bw
          cur.maxReps = Math.max(cur.maxReps, st.reps)
          if (!bw && st.reps > 0 && st.reps <= 12) cur.e1rm = Math.max(cur.e1rm, estimate1RM(w, st.reps))
          const beats = w > cur.weight || (w === cur.weight && st.reps > cur.reps)
          if (beats) {
            if (w > cur.weight && cur.weight > 0) {
              events.push({ key, name: ex.name, bodyweight: cur.bodyweight, weight: w, reps: st.reps, previous: cur.weight, date: s.date, sessionId: s.id })
            }
            Object.assign(cur, { weight: w, reps: st.reps, date: s.date, sessionId: s.id })
          }
        }
      }
    }
  }

  // Display name = most used spelling.
  for (const [key, rec] of best) {
    let top = 0
    for (const [n, c] of names.get(key) ?? []) if (c > top) { rec.name = n; top = c }
  }
  for (const e of events) e.name = best.get(e.key)?.name ?? e.name

  return {
    records: [...best.values()].filter(r => r.weight > 0 || r.maxReps > 0),
    events: events.reverse(), // newest first
  }
}

export function runningRecords(sessions: Session[]) {
  let pace: { value: number; date: string; id: string; km: number } | null = null
  let far: { value: number; date: string; id: string } | null = null
  let long: { value: number; date: string; id: string } | null = null
  for (const s of sessions) {
    if (s.type !== 'running') continue
    const km = (s.distanceMeters ?? 0) / 1000
    const sec = s.durationSeconds ?? 0
    if (km > 0 && (!far || km > far.value)) far = { value: km, date: s.date, id: s.id }
    if (sec > 0 && (!long || sec > long.value)) long = { value: sec, date: s.date, id: s.id }
    // Ignore very short efforts so a 400 m sprint doesn't take the pace record.
    if (km >= 1 && sec > 0) {
      const p = sec / km
      if (!pace || p < pace.value) pace = { value: p, date: s.date, id: s.id, km }
    }
  }
  return { pace, far, long }
}