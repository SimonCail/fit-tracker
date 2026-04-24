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
