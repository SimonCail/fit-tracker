import type { Unit } from './units'

export type PlateSpec = { weight: number; color: string; height: number; width: number; label: string }

// Competition colours for the big plates; change plates are steel.
const KG: PlateSpec[] = [
  { weight: 25, color: 'var(--color-pr)', height: 1, width: 22, label: '25' },
  { weight: 20, color: 'var(--color-lift)', height: 1, width: 19, label: '20' },
  { weight: 15, color: 'var(--color-weigh)', height: 1, width: 16, label: '15' },
  { weight: 10, color: 'var(--color-run)', height: 1, width: 13, label: '10' },
  { weight: 5, color: 'var(--color-ink)', height: 0.66, width: 11, label: '5' },
  { weight: 2.5, color: 'var(--color-pr)', height: 0.52, width: 9, label: '2,5' },
  { weight: 1.25, color: 'var(--color-dim)', height: 0.44, width: 7, label: '1,25' },
  { weight: 0.5, color: 'var(--color-ink)', height: 0.36, width: 5, label: '0,5' },
]
const LB: PlateSpec[] = [
  { weight: 45, color: 'var(--color-lift)', height: 1, width: 20, label: '45' },
  { weight: 35, color: 'var(--color-weigh)', height: 1, width: 17, label: '35' },
  { weight: 25, color: 'var(--color-run)', height: 0.86, width: 14, label: '25' },
  { weight: 10, color: 'var(--color-ink)', height: 0.62, width: 11, label: '10' },
  { weight: 5, color: 'var(--color-pr)', height: 0.5, width: 9, label: '5' },
  { weight: 2.5, color: 'var(--color-dim)', height: 0.42, width: 7, label: '2,5' },
]

export const platesFor = (unit: Unit) => (unit === 'kg' ? KG : LB)
export const barOptions = (unit: Unit) => (unit === 'kg' ? [20, 15, 10] : [45, 35, 25])

/** Greedy loading of one side of the bar. Works in the user's unit. */
export function loadBar(target: number, bar: number, unit: Unit) {
  const perSide = (target - bar) / 2
  if (perSide < 0) return { perSide: 0, plates: [] as PlateSpec[], loaded: bar, exact: target === bar, tooLight: true }
  let rest = Math.round(perSide * 100) / 100
  const plates: PlateSpec[] = []
  for (const p of platesFor(unit)) {
    while (rest >= p.weight - 1e-9) {
      plates.push(p)
      rest = Math.round((rest - p.weight) * 100) / 100
    }
  }
  const side = plates.reduce((a, p) => a + p.weight, 0)
  return { perSide, plates, loaded: bar + 2 * side, exact: rest < 0.01, tooLight: false }
}