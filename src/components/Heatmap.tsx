import { useMemo } from 'react'
import { addDays, differenceInCalendarDays, format, startOfWeek, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '../lib/cn'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui'

type Props = {
  counts: Record<string, number> // ISO date (yyyy-MM-dd) -> number of sessions
  weeks?: number
  onDayClick?: (date: string) => void
}

const CELL = 14 // px
const GAP = 3 // px

export function Heatmap({ counts, weeks = 20, onDayClick }: Props) {
  const todayIso = format(new Date(), 'yyyy-MM-dd')

  const { grid, monthLabels, max, total, daysWith } = useMemo(() => {
    const today = new Date()
    const firstMonday = startOfWeek(subDays(today, (weeks - 1) * 7), { weekStartsOn: 1 })
    const totalDays = differenceInCalendarDays(today, firstMonday) + 1

    const grid: { date: string; count: number; future: boolean; isToday: boolean }[][] = []
    let max = 0
    let total = 0
    let daysWith = 0
    for (let w = 0; w < weeks; w++) {
      const col: { date: string; count: number; future: boolean; isToday: boolean }[] = []
      for (let d = 0; d < 7; d++) {
        const dayOffset = w * 7 + d
        const day = addDays(firstMonday, dayOffset)
        const iso = format(day, 'yyyy-MM-dd')
        const count = counts[iso] ?? 0
        if (count > 0) {
          total += count
          daysWith += 1
        }
        max = Math.max(max, count)
        col.push({ date: iso, count, future: dayOffset >= totalDays, isToday: iso === todayIso })
      }
      grid.push(col)
    }

    const monthLabels: { col: number; label: string }[] = []
    let lastMonth = -1
    for (let w = 0; w < weeks; w++) {
      const day = addDays(firstMonday, w * 7)
      const month = day.getMonth()
      if (month !== lastMonth && w < weeks - 1) {
        monthLabels.push({ col: w, label: format(day, 'MMM', { locale: fr }) })
        lastMonth = month
      }
    }

    return { grid, monthLabels, max, total, daysWith }
  }, [counts, weeks, todayIso])

  function intensityStyle(count: number): { bg: string; border?: string } {
    if (count === 0) return { bg: 'color-mix(in srgb, var(--color-text-dim) 10%, transparent)' }
    const steps = Math.max(max, 3)
    const t = count / steps
    // Four discrete tiers
    const alpha = t <= 0.25 ? 0.28 : t <= 0.5 ? 0.5 : t <= 0.75 ? 0.75 : 1
    return { bg: `color-mix(in srgb, var(--color-accent) ${alpha * 100}%, transparent)` }
  }

  const weekWidth = weeks * CELL + (weeks - 1) * GAP

  return (
    <div className="select-none">
      <div className="flex items-baseline justify-between mb-3 px-0.5">
        <p className="text-xs text-[color:var(--color-text-dim)]">
          <span className="font-medium text-[color:var(--color-text)] tabular">{daysWith}</span> jours actifs ·{' '}
          <span className="font-medium text-[color:var(--color-text)] tabular">{total}</span> séance{total > 1 ? 's' : ''}
        </p>
        <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-dim)] font-medium">
          {weeks} semaines
        </p>
      </div>

      <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <div style={{ width: weekWidth }}>
          {/* Month row */}
          <div className="relative text-[10px] uppercase tracking-[0.15em] text-[color:var(--color-text-dim)] font-medium mb-1.5" style={{ height: 14 }}>
            {monthLabels.map(({ col, label }) => (
              <span
                key={col}
                className="absolute top-0"
                style={{ left: col * (CELL + GAP) }}
              >
                {label}
              </span>
            ))}
          </div>
          {/* Grid */}
          <div className="grid grid-flow-col gap-[3px]" style={{ gridTemplateRows: `repeat(7, ${CELL}px)` }}>
            {grid.map((col, w) =>
              col.map((cell, d) => {
                const clickable = !cell.future && cell.count > 0
                const style = intensityStyle(cell.count)
                const dateLabel = format(new Date(cell.date), 'EEEE d MMMM', { locale: fr })
                const countLabel = cell.count === 0
                  ? 'repos'
                  : `${cell.count} séance${cell.count > 1 ? 's' : ''}`
                return (
                  <Tooltip key={`${w}-${d}`}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={cell.future}
                        onClick={() => clickable && onDayClick?.(cell.date)}
                        aria-label={`${dateLabel} — ${countLabel}`}
                        className={cn(
                          'rounded-[3px] transition-all outline-none',
                          cell.future && 'opacity-20 cursor-default',
                          !cell.future && cell.count > 0 && 'cursor-pointer hover:scale-125 hover:z-10 hover:shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-accent)_40%,transparent)]',
                          !cell.future && cell.count === 0 && 'cursor-default',
                          cell.isToday && 'ring-2 ring-[color:var(--color-text)] ring-offset-2 ring-offset-[color:var(--color-surface)]',
                        )}
                        style={{ width: CELL, height: CELL, backgroundColor: style.bg }}
                      />
                    </TooltipTrigger>
                    {!cell.future && (
                      <TooltipContent side="top">
                        <div className="flex flex-col">
                          <span className="capitalize font-medium">{dateLabel}</span>
                          <span className="opacity-70 text-[11px]">
                            {cell.count === 0 ? 'repos' : countLabel}
                            {cell.isToday && ' · aujourd\'hui'}
                          </span>
                        </div>
                      </TooltipContent>
                    )}
                  </Tooltip>
                )
              }),
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-4 px-0.5">
        <p className="text-xs text-[color:var(--color-text-dim)]">
          Clique un jour pour voir tes séances
        </p>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-text-dim)] font-medium">
          <span>Moins</span>
          {[0, 0.28, 0.5, 0.75, 1].map((alpha, i) => (
            <span
              key={i}
              className="rounded-[3px] inline-block"
              style={{
                width: 10,
                height: 10,
                backgroundColor:
                  alpha === 0
                    ? 'color-mix(in srgb, var(--color-text-dim) 10%, transparent)'
                    : `color-mix(in srgb, var(--color-accent) ${alpha * 100}%, transparent)`,
              }}
            />
          ))}
          <span>Plus</span>
        </div>
      </div>
    </div>
  )
}
