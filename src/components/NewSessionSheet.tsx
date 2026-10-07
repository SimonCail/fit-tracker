import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Dumbbell, Footprints } from 'lucide-react'
import { Button, Disc, Input, Label, Modal, ModalContent, ModalTitle, Segmented, Skeleton } from './ui'
import { createSession, duplicateSession, listSessions } from '../lib/db'
import type { Session, SessionType } from '../lib/types'
import { cn } from '../lib/cn'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/**
 * "New session" flow — reachable from the + in the tab bar and from the home screen.
 * Pick a type, a day (today by default) and optionally a past session to reuse as a template.
 */
export function NewSessionSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const nav = useNavigate()
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [date, setDate] = useState(iso(new Date()))
  const [type, setType] = useState<SessionType>('strength')
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setDate(iso(new Date()))
    setType('strength')
    setSourceId(null)
    setBusy(false)
    listSessions(120).then(setSessions).catch(() => setSessions([]))
  }, [open])

  // Distinct templates: most recent session per title, with at least one exercise.
  const templates = useMemo(() => {
    if (!sessions) return []
    const seen = new Set<string>()
    const out: Session[] = []
    for (const s of sessions) {
      if (s.type !== 'strength' || s.exercises.length === 0) continue
      const key = (s.notes?.trim().toLowerCase() || s.exercises.map(e => e.name.toLowerCase()).sort().join('|'))
      if (seen.has(key)) continue
      seen.add(key)
      out.push(s)
      if (out.length >= 12) break
    }
    return out
  }, [sessions])

  const clash = useMemo(
    () => !!sessions?.some(s => s.date === date && s.type === type && (s.type === 'running' || s.exercises.length > 0)),
    [sessions, date, type],
  )

  async function create() {
    setBusy(true)
    try {
      const s = sourceId && type === 'strength'
        ? await duplicateSession(sourceId, date)
        : await createSession(date, null, type)
      onOpenChange(false)
      nav(`/session/${s.id}`)
    } finally {
      setBusy(false)
    }
  }

  const today = iso(new Date())
  const yesterday = iso(subDays(new Date(), 1))
  const dayBefore = iso(subDays(new Date(), 2))

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="sm:max-w-lg">
        <ModalTitle className="t-title text-[26px]">Nouvelle séance</ModalTitle>

        <Segmented
          className="mt-5"
          value={type}
          onChange={v => { setType(v); if (v === 'running') setSourceId(null) }}
          options={[
            { value: 'strength', label: <><Dumbbell size={16} /> Muscu</> },
            { value: 'running', label: <><Footprints size={16} /> Course</> },
          ]}
        />

        <div className="mt-6">
          <Label className="block mb-2">Jour</Label>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0">
            <DayChip label="Aujourd'hui" value={today} current={date} onPick={setDate} />
            <DayChip label="Hier" value={yesterday} current={date} onPick={setDate} />
            <DayChip label={format(parseISO(dayBefore), 'EEEE', { locale: fr })} value={dayBefore} current={date} onPick={setDate} />
            <label
              className={cn(
                'relative h-10 shrink-0 rounded-full px-4 flex items-center text-[14px] font-semibold cursor-pointer',
                ![today, yesterday, dayBefore].includes(date) ? 'bg-ink text-bg' : 'bg-surface-2 text-ink',
              )}
            >
              {![today, yesterday, dayBefore].includes(date)
                ? format(parseISO(date), 'd MMM', { locale: fr })
                : 'Autre date'}
              <Input
                type="date"
                value={date}
                max={today}
                onChange={e => e.target.value && setDate(e.target.value)}
                className="absolute inset-0 opacity-0 h-full cursor-pointer"
                aria-label="Choisir une date"
              />
            </label>
          </div>
          {clash && (
            <p className="text-[13px] text-dim mt-2.5">
              Tu as déjà une séance {type === 'running' ? 'de course' : 'de muscu'} ce jour-là. Une deuxième sera créée à côté.
            </p>
          )}
        </div>

        {type === 'strength' && (
          <div className="mt-6">
            <Label className="block mb-2">Partir de</Label>
            <div className="rounded-[12px] bg-surface-2 overflow-hidden max-h-[38dvh] overflow-y-auto">
              <TemplateRow
                selected={sourceId === null}
                title="Séance vide"
                subtitle="Tu ajoutes les exercices au fur et à mesure"
                onClick={() => setSourceId(null)}
              />
              {sessions === null ? (
                <div className="p-3 space-y-2">
                  <Skeleton className="h-12 bg-surface" />
                  <Skeleton className="h-12 bg-surface" />
                </div>
              ) : (
                templates.map(s => (
                  <TemplateRow
                    key={s.id}
                    selected={sourceId === s.id}
                    title={s.notes || 'Séance sans titre'}
                    subtitle={`${s.exercises.map(e => e.name).slice(0, 3).join(', ')}${s.exercises.length > 3 ? ` +${s.exercises.length - 3}` : ''}`}
                    meta={format(parseISO(s.date), 'd MMM', { locale: fr })}
                    onClick={() => setSourceId(s.id)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        <Button size="lg" className="w-full mt-6" onClick={create} disabled={busy}>
          {busy ? 'Création…' : sourceId ? 'Reprendre cette séance' : 'Commencer'}
        </Button>
      </ModalContent>
    </Modal>
  )
}

function DayChip({ label, value, current, onPick }: { label: string; value: string; current: string; onPick: (v: string) => void }) {
  const active = value === current
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      className={cn(
        'h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold transition-colors cursor-pointer first-letter:uppercase',
        active ? 'bg-ink text-bg' : 'bg-surface-2 text-ink',
      )}
    >
      {label}
    </button>
  )
}

function TemplateRow({
  selected,
  title,
  subtitle,
  meta,
  onClick,
}: {
  selected: boolean
  title: string
  subtitle: string
  meta?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="w-full text-left flex items-center gap-3 px-4 py-3 hairline-b last:shadow-none cursor-pointer active:bg-line/50"
    >
      <span className="w-5 shrink-0 grid place-items-center">
        {selected ? <Disc size={18} /> : <span className="h-[18px] w-[18px] rounded-full border-[1.5px] border-line-strong" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="font-semibold truncate">{title}</span>
          {meta && <span className="text-[13px] text-faint shrink-0 ml-auto">{meta}</span>}
        </span>
        <span className="block text-[13px] text-dim truncate">{subtitle}</span>
      </span>
    </button>
  )
}