/** Normalize exercise names for matching: lowercase, strip accents, collapse whitespace. */
export function normalizeExerciseName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining marks (accents)
    .replace(/\s+/g, ' ')
}

export function slugifyExerciseName(name: string): string {
  return normalizeExerciseName(name)
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Heuristic — returns true when the exercise name strongly suggests a bodyweight movement.
 * Matches French + English variants. Conservative: only obvious cases to avoid false positives
 * (squats and lunges can be loaded, so they're excluded).
 */
const BODYWEIGHT_KEYWORDS = [
  'pompe', 'pushup', 'push-up', 'push up',
  'traction', 'pullup', 'pull-up', 'pull up', 'chinup', 'chin-up', 'chin up',
  'dip', 'dips',
  'muscle up', 'muscle-up',
  'gainage', 'plank',
  'pistol squat',
  'l-sit', 'l sit',
  'handstand', 'atr',
]

export function isBodyweightExerciseName(name: string): boolean {
  const n = normalizeExerciseName(name)
  return BODYWEIGHT_KEYWORDS.some(k => n.includes(k))
}
