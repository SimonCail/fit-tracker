import { format, parseISO, subDays } from 'date-fns'
import type { WeighIn, WeighSlot } from './types'

export type TrendPoint = { date: string; raw: number | null; avg: number }

/**
 * Trailing 7-day mean of one weigh-in slot (morning vs evening are never mixed:
 * the evening weight is routinely 0.5–1 kg higher and would bend the curve).
 * One point per day that has a weigh-in, values in kg.
 */
export function weightTrend(weighIns: WeighIn[], slot: WeighSlot, windowDays = 7): TrendPoint[] {
  const byDate = new Map<string, number>()
  for (const w of weighIns) if ((w.slot ?? 'morning') === slot) byDate.set(w.date, w.weight)
  const dates = [...byDate.keys()].sort()
  return dates.map(date => {
    const from = format(subDays(parseISO(date), windowDays - 1), 'yyyy-MM-dd')
    const win = dates.filter(d => d >= from && d <= date).map(d => byDate.get(d)!)
    return { date, raw: byDate.get(date)!, avg: win.reduce((a, b) => a + b, 0) / win.length }
  })
}

/** Current 7-day average and its change versus the 7 days before (kg). */
export function weeklyAverage(weighIns: WeighIn[], slot: WeighSlot, today = new Date()) {
  const vals = (fromBack: number, toBack: number) => {
    const from = format(subDays(today, fromBack), 'yyyy-MM-dd')
    const to = format(subDays(today, toBack), 'yyyy-MM-dd')
    return weighIns.filter(w => (w.slot ?? 'morning') === slot && w.date >= from && w.date <= to).map(w => w.weight)
  }
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
  const now = mean(vals(6, 0))
  const before = mean(vals(13, 7))
  return { now, count: vals(6, 0).length, delta: now !== null && before !== null ? now - before : null }
}