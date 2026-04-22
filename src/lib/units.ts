export type Unit = 'kg' | 'lb'

const KG_PER_LB = 0.45359237

export function fromKg(kg: number, unit: Unit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB
}

export function toKg(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value * KG_PER_LB
}

export function formatWeight(kg: number, unit: Unit, digits = 1): string {
  const v = fromKg(kg, unit)
  return `${round(v, digits)} ${unit}`
}

export function round(v: number, digits = 1): number {
  const f = 10 ** digits
  return Math.round(v * f) / f
}

/** Brzycki 1-rep max estimate (valid for reps ≤ ~10). */
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg
  return weightKg * 36 / (37 - reps)
}
