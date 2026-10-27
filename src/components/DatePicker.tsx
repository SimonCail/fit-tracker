import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { Button, Modal, ModalContent, ModalTitle } from './ui'
import { cn } from '../lib/cn'

export type DayMark = 'strength' | 'running' | 'both'

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/**
 * Month calendar to pick a session date. Bottom sheet on phones, centred card on desktop.
 * Days that already have a session get a coloured dot; future days can't be picked.
 * Picking a day applies it right away and closes.
 */
export function DatePicker({
  open,
  onOpenChange,
  value,
  onChange,
  marks,
  title = 'Date de la séance',
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  value: string
  onChange: (date: string) => void
  marks?: Map<string, DayMark>
  title?: string
}) {
  const today = iso(new Date())
  const [month, setMonth] = useState(() => startOfMonth(parseISO(value)))

  function handleOpenChange(nextOpen: boolean) {
    // Reset the calendar before showing it so it always opens on the selected date.
    if (nextOpen) setMonth(startOfMonth(parseISO(value)))
    onOpenChange(nextOpen)
  }

  const days = useMemo(() => {
    const out: Date[] = []
    const last = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    for (let d = startOfWeek(month, { weekStartsOn: 1 }); d <= last; d = addDays(d, 1)) out.push(d)
    return out
  }, [month])

  const canGoNext = iso(startOfMonth(addMonths(month, 1))) <= today

  function pick(d: string) {
    if (d > today) return
    onOpenChange(false)
    if (d !== value) onChange(d)
  }

  const quick = [
    { label: 'Aujourd’hui', date: today },
    { label: 'Hier', date: iso(subDays(new Date(), 1)) },
    { label: 'Avant-hier', date: iso(subDays(new Date(), 2)) },
  ]

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalContent className="sm:max-w-sm">
        <ModalTitle className="t-title text-[26px]">{title}</ModalTitle>
        <p className="text-[14px] text-dim mt-1 first-letter:uppercase">
          Actuellement {format(parseISO(value), 'EEEE d MMMM yyyy', { locale: fr })}
        </p>

        <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0">
          {quick.map(q => (
            <button
              key={q.date}
              type="button"
              onClick={() => pick(q.date)}
              className={cn(
                'h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold cursor-pointer transition-colors',
                q.date === value ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink hover:bg-line',
              )}
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <Button variant="ghost" size="icon-sm" onClick={() => setMonth(m => addMonths(m, -1))} aria-label="Mois précédent" className="text-ink">
            <ChevronLeft size={20} />
          </Button>
          <p className="t-heading text-[17px] first-letter:uppercase" aria-live="polite">
            {format(month, 'MMMM yyyy', { locale: fr })}
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMonth(m => addMonths(m, 1))}
            disabled={!canGoNext}
            aria-label="Mois suivant"
            className="text-ink"
          >
            <ChevronRight size={20} />
          </Button>
        </div>

        <div className="grid grid-cols-7 mt-3 text-center text-[12px] font-semibold text-faint" aria-hidden>
          {WEEKDAYS.map((d, i) => <span key={i} className="h-7 grid place-items-center">{d}</span>)}
        </div>

        <div role="grid" className="grid grid-cols-7 gap-y-1">
          {days.map(d => {
            const key = iso(d)
            const inMonth = isSameMonth(d, month)
            const selected = key === value
            const isToday = key === today
            const future = key > today
            const mark = marks?.get(key)
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                aria-selected={selected}
                aria-label={format(d, 'EEEE d MMMM yyyy', { locale: fr }) + (mark ? ', séance déjà notée' : '')}
                disabled={future}
                onClick={() => pick(key)}
                className={cn(
                  'relative mx-auto h-11 w-11 rounded-full grid place-items-center num text-[19px] transition-colors cursor-pointer',
                  'disabled:cursor-not-allowed disabled:opacity-30',
                  !inMonth && 'text-faint',
                  selected ? 'bg-accent text-on-accent' : 'hover:bg-surface-2',
                  isToday && !selected && 'shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]',
                )}
              >
                {format(d, 'd')}
                {mark && !selected && (
                  <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5" aria-hidden>
                    {(mark === 'strength' || mark === 'both') && <span className="h-1 w-1 rounded-full bg-lift" />}
                    {(mark === 'running' || mark === 'both') && <span className="h-1 w-1 rounded-full bg-run" />}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {marks && marks.size > 0 && (
          <p className="flex items-center gap-4 text-[12px] text-dim mt-4">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-lift" /> Muscu</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-run" /> Course</span>
            <span className="text-faint">déjà notées</span>
          </p>
        )}
      </ModalContent>
    </Modal>
  )
}