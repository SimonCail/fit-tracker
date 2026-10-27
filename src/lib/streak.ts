import { addWeeks, format, parseISO, startOfWeek } from 'date-fns'
import type { Session } from './types'

/** A session counts once something was actually logged in it. */
export function isLoggedSession(s: Session): boolean {
  if (s.type === 'running') return (s.distanceMeters ?? 0) > 0 || (s.durationSeconds ?? 0) > 0
  return s.exercises.some(e => e.sets.length > 0)
}

const weekKey = (d: Date) => format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')

export type WeekCount = { week: string; count: number; met: boolean }

/**
 * Regularity: how many weeks in a row you reached `goal` sessions.
 * The current week only adds to the streak once it is reached; until then the streak
 * stands on the previous weeks (it isn't "broken" before Sunday is over).
 */
export function weeklyStreak(sessions: Session[], goal: number, today = new Date()) {
  const counts = new Map<string, number>()
  for (const s of sessions) {
    if (!s.date || !isLoggedSession(s)) continue
    const k = weekKey(parseISO(s.date))
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const thisWeek = weekKey(today)
  const thisCount = counts.get(thisWeek) ?? 0
  const met = (k: string) => (counts.get(k) ?? 0) >= goal

  // Current streak.
  let current = 0
  let cursor = met(thisWeek) ? startOfWeek(today, { weekStartsOn: 1 }) : addWeeks(startOfWeek(today, { weekStartsOn: 1 }), -1)
  while (met(weekKey(cursor))) {
    current++
    cursor = addWeeks(cursor, -1)
  }

  // Best streak ever.
  let best = 0
  const keys = [...counts.keys()].sort()
  if (keys.length) {
    let run = 0
    for (let w = parseISO(keys[0]); weekKey(w) <= thisWeek; w = addWeeks(w, 1)) {
      if (met(weekKey(w))) { run++; best = Math.max(best, run) } else run = 0
    }
  }

  // The last 12 weeks, oldest first, for the little strip.
  const recent: WeekCount[] = []
  for (let i = 11; i >= 0; i--) {
    const k = weekKey(addWeeks(today, -i))
    const c = counts.get(k) ?? 0
    recent.push({ week: k, count: c, met: c >= goal })
  }

  return { current, best: Math.max(best, current), thisWeek: thisCount, recent }
}