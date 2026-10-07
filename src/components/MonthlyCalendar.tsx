import { useMemo, useState } from 'react'
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './ui'
import { cn } from '../lib/cn'

type Props = {
  counts: Record<string, number> // yyyy-MM-dd -> number of sessions
  weighInDates?: string[]
  onDayClick?: (date: string) => void
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function MonthlyCalendar({ counts, weighInDates = [], onDayClick }: Props) {
  const [anchor, setAnchor] = useState<Date>(new Date())
  const [direction, setDirection] = useState<1 | -1>(1)
  const weighInSet = useMemo(() => new Set(weighInDates), [weighInDates])

  const days = useMemo(() => {
    const out: Date[] = []
    const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 })
    for (let d = start; d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) out.push(d)
    return out
  }, [anchor])

  const summary = useMemo(() => {
    let total = 0
    let active = 0
    for (const d of days) {
      if (!isSameMonth(d, anchor)) continue
      const c = counts[format(d, 'yyyy-MM-dd')] ?? 0
      if (c > 0) { total += c; active += 1 }
    }
    return { total, active }
  }, [days, counts, anchor])

  const isCurrentMonth = isSameMonth(anchor, new Date())

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="t-heading text-[17px] capitalize">{format(anchor, 'MMMM yyyy', { locale: fr })}</p>
          <p className="text-[13px] text-dim">
            {summary.total === 0
              ? 'Aucune séance'
              : `${summary.total} séance${summary.total > 1 ? 's' : ''} sur ${summary.active} jour${summary.active > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center -mr-1.5">
          <Button variant="ghost" size="icon" onClick={() => { setDirection(-1); setAnchor(d => subMonths(d, 1)) }} aria-label="Mois précédent">
            <ChevronLeft size={20} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={isCurrentMonth}
            onClick={() => { setDirection(1); setAnchor(d => addMonths(d, 1)) }}
            aria-label="Mois suivant"
          >
            <ChevronRight size={20} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-[12px] font-semibold text-faint text-center py-1">{d}</div>
        ))}
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={format(anchor, 'yyyy-MM')}
            initial={{ opacity: 0, x: direction * 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 20 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-7 gap-y-1"
          >
            {days.map(day => {
              const iso = format(day, 'yyyy-MM-dd')
              const count = counts[iso] ?? 0
              const weigh = weighInSet.has(iso)
              const outside = !isSameMonth(day, anchor)
              const today = isToday(day)
              const clickable = !outside && (count > 0 || weigh)
              const label = `${format(day, 'EEEE d MMMM', { locale: fr })}${count > 0 ? `, ${count} séance${count > 1 ? 's' : ''}` : ''}${weigh ? ', pesée' : ''}`
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!clickable}
                  onClick={() => onDayClick?.(iso)}
                  aria-label={label}
                  className={cn(
                    'relative h-11 flex items-center justify-center',
                    clickable ? 'cursor-pointer' : 'cursor-default',
                    outside && 'invisible',
                  )}
                >
                  <span
                    className={cn(
                      'relative h-9 w-9 rounded-full grid place-items-center text-[15px] num-light',
                      count > 0 && 'bg-lift text-on-lift font-semibold',
                      count === 0 && 'text-dim',
                      today && count === 0 && 'ring-2 ring-ink text-ink font-semibold',
                      today && count > 0 && 'ring-2 ring-ink ring-offset-2 ring-offset-surface',
                    )}
                  >
                    {format(day, 'd')}
                    {count > 1 && (
                      <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-ink text-bg text-[10px] font-bold grid place-items-center leading-none">
                        {count}
                      </span>
                    )}
                  </span>
                  {weigh && <span className="absolute bottom-0 h-1 w-1 rounded-full bg-weigh" aria-hidden />}
                </button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-4 mt-3 text-[12px] text-dim">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-lift" /> Séance</span>
        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-weigh" /> Pesée</span>
      </div>
    </div>
  )
}