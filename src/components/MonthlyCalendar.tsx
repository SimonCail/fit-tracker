import { useMemo, useState } from 'react'
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Tooltip, TooltipContent, TooltipTrigger } from './ui'
import { cn } from '../lib/cn'

type Props = {
  counts: Record<string, number> // yyyy-MM-dd -> number of sessions
  weighInDates?: string[] // days where a weigh-in exists
  onDayClick?: (date: string) => void
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function MonthlyCalendar({ counts, weighInDates = [], onDayClick }: Props) {
  const [anchor, setAnchor] = useState<Date>(new Date())
  const [direction, setDirection] = useState<1 | -1>(1)

  const weighInSet = useMemo(() => new Set(weighInDates), [weighInDates])

  const monthStart = startOfMonth(anchor)
  const monthEnd = endOfMonth(anchor)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days: Date[] = []
  for (let d = gridStart; d <= gridEnd; d = new Date(d.getTime() + 86_400_000)) days.push(d)

  const monthSessions = useMemo(() => {
    let total = 0
    let activeDays = 0
    for (const d of days) {
      if (!isSameMonth(d, anchor)) continue
      const iso = format(d, 'yyyy-MM-dd')
      const c = counts[iso] ?? 0
      if (c > 0) {
        total += c
        activeDays += 1
      }
    }
    return { total, activeDays }
  }, [days, counts, anchor])

  const max = useMemo(() => {
    let m = 0
    for (const c of Object.values(counts)) m = Math.max(m, c)
    return Math.max(1, m)
  }, [counts])

  function goPrev() { setDirection(-1); setAnchor(d => subMonths(d, 1)) }
  function goNext() { setDirection(1); setAnchor(d => addMonths(d, 1)) }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-xl tracking-tight capitalize">
          {format(anchor, 'MMMM yyyy', { locale: fr })}
        </h3>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={goPrev} aria-label="Mois précédent">
                <ChevronLeft size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Mois précédent</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={goNext} aria-label="Mois suivant">
                <ChevronRight size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Mois suivant</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-2">
        {WEEKDAYS.map((d, i) => (
          <div
            key={i}
            className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-dim)] font-medium text-center py-1"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={format(anchor, 'yyyy-MM')}
            custom={direction}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 24 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-7 gap-1 sm:gap-1.5"
          >
            {days.map(day => {
              const iso = format(day, 'yyyy-MM-dd')
              const count = counts[iso] ?? 0
              const hasWeigh = weighInSet.has(iso)
              const outside = !isSameMonth(day, anchor)
              const today = isToday(day)
              const intensity = count === 0 ? 0 : count / max
              const clickable = count > 0 || hasWeigh

              return (
                <Tooltip key={iso}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={outside}
                      onClick={() => clickable && onDayClick?.(iso)}
                      aria-label={`${format(day, 'EEEE d MMMM', { locale: fr })}${count > 0 ? ` — ${count} séance${count > 1 ? 's' : ''}` : ''}`}
                      className={cn(
                        'relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]',
                        outside && 'opacity-30 cursor-default',
                        !outside && !clickable && 'cursor-default hover:bg-[color:var(--color-surface-2)]/50',
                        !outside && clickable && 'cursor-pointer hover:scale-[1.08] hover:z-10',
                        today && 'ring-2 ring-[color:var(--color-accent)] ring-offset-0',
                      )}
                      style={
                        count > 0
                          ? {
                              background: `color-mix(in srgb, var(--color-accent) ${20 + intensity * 55}%, var(--color-surface))`,
                              color: intensity > 0.55 ? 'var(--color-accent-text)' : 'var(--color-text)',
                            }
                          : undefined
                      }
                    >
                      <span className={cn('font-display text-sm sm:text-base tabular leading-none', today && 'font-semibold')}>
                        {format(day, 'd')}
                      </span>
                      {hasWeigh && count === 0 && (
                        <span
                          className="absolute bottom-1.5 w-1 h-1 rounded-full bg-[color:var(--color-text-dim)]"
                          aria-hidden
                        />
                      )}
                      {hasWeigh && count > 0 && (
                        <span
                          className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[color:var(--color-bg)] ring-1 ring-[color:var(--color-accent)]"
                          aria-hidden
                        />
                      )}
                    </button>
                  </TooltipTrigger>
                  {!outside && (
                    <TooltipContent side="top">
                      <div className="flex flex-col">
                        <span className="capitalize font-medium">
                          {format(day, 'EEEE d MMMM', { locale: fr })}
                        </span>
                        <span className="opacity-70 text-[11px]">
                          {count > 0 ? `${count} séance${count > 1 ? 's' : ''}` : hasWeigh ? 'pesée enregistrée' : 'repos'}
                          {today && ' · aujourd\'hui'}
                        </span>
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[color:var(--color-border)]">
        <p className="text-xs text-[color:var(--color-text-dim)]">
          <span className="font-medium text-[color:var(--color-text)] tabular">{monthSessions.activeDays}</span> jours actifs ·{' '}
          <span className="font-medium text-[color:var(--color-text)] tabular">{monthSessions.total}</span> séance{monthSessions.total > 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-text-dim)] font-medium">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full ring-1 ring-[color:var(--color-accent)] bg-transparent" /> Pesée
          </span>
        </div>
      </div>
    </div>
  )
}

// Helper kept for API parity
export { parseISO, isSameDay }
