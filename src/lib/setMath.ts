import type { ExerciseSet, SetDrop } from './types'

/** All stages of a set: the main effort first, then any drops in order. */
export function setStages(s: ExerciseSet): Array<{ reps: number; weight: number }> {
  const main = { reps: s.reps, weight: Number(s.weight) }
  if (!s.drops || s.drops.length === 0) return [main]
  return [main, ...s.drops.map(d => ({ reps: d.reps, weight: Number(d.weight) }))]
}

/** reps × weight summed across main + drops. */
export function setVolumeKg(s: ExerciseSet): number {
  return setStages(s).reduce((v, st) => v + st.reps * st.weight, 0)
}

/** Reps total across main + drops. */
export function setTotalReps(s: ExerciseSet): number {
  return setStages(s).reduce((n, st) => n + st.reps, 0)
}

/** Heaviest weight loaded during this set (main vs drops). */
export function setMaxWeightKg(s: ExerciseSet): number {
  return setStages(s).reduce((m, st) => Math.max(m, st.weight), 0)
}

export function hasDrops(s: ExerciseSet): boolean {
  return !!s.drops && s.drops.length > 0
}

export type { SetDrop }
