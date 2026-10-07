import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarPlus, ChevronRight, Moon, Sunrise, X } from 'lucide-react'
import { addDays, differenceInCalendarDays, format, isToday, parseISO, startOfWeek, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Button,
  Card,
  Disc,
  EmptyState,
  ErrorNote,
  Input,
  Label,
  Modal,
  ModalContent,
  ModalTitle,
  Segmented,
  SectionTitle,
  Skeleton,
  useConfirm,
} from '../components/ui'
import { PageHeader } from '../components/Layout'
import { useLayout } from '../components/layoutContext'
import { deleteWeighIn, findOrCreateSessionOnDate, listSessions, listWeighIns, setWeighIn } from '../lib/db'
import type { Session, WeighIn, WeighSlot } from '../lib/types'
import { frNum, fromKg, parseDecimal, round, toKg } from '../lib/units'
import { setTotalReps, setVolumeKg } from '../lib/setMath'
import { dateToDayKey, useSettings } from '../store/settings'
import { maybeFireReminder } from '../lib/notifications'
import { MonthlyCalendar } from '../components/MonthlyCalendar'
import { weeklyAverage } from '../lib/weightTrend'
import { cn } from '../lib/cn'

const todayIso = () => format(new Date(), 'yyyy-MM-dd')

export function Today() {
  const nav = useNavigate()
  const { openNewSession } = useLayout()
  const { unit, profile, weeklyPlan, reminders } = useSettings()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<Session[]>([])
  const [weighIns, setWeighIns] = useState<WeighIn[]>([])
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  async function load() {
    setError(null)
    try {
      const [s, w] = await Promise.all([listSessions(120), listWeighIns(120)])
      setSessions(s)
      setWeighIns(w)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const todayKey = todayIso()
  const todaySessions = sessions.filter(s => s.date === todayKey).sort((a, b) => b.createdAt - a.createdAt)
  const todaySession = todaySessions[0]
  const todayPlan = weeklyPlan[dateToDayKey(new Date())]

  useEffect(() => {
    function check() {
      if (document.visibilityState !== 'visible') return
      maybeFireReminder({
        enabled: reminders.enabled,
        time: reminders.time,
        weeklyPlan,
        todaySessionExists: !!todaySession,
      })
    }
    check()
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [reminders.enabled, reminders.time, weeklyPlan, todaySession])

  const userBwKg = weighIns[0]?.weight ?? 0
  const weekSessions = sessions.filter(s => differenceInCalendarDays(new Date(), parseISO(s.date)) < 7)
  const weekVolume = weekSessions.reduce((acc, s) => {
    for (const ex of s.exercises) {
      const effective = ex.bodyweight ? userBwKg : 0
      for (const set of ex.sets) acc += setVolumeKg(set) + setTotalReps(set) * effective
    }
    return acc
  }, 0)
  const streak = computeStreak(sessions)
  const sessionCounts = useMemo(() => {
    const out: Record<string, number> = {}
    for (const s of sessions) out[s.date] = (out[s.date] ?? 0) + 1
    return out
  }, [sessions])
  const weighInDates = useMemo(() => weighIns.map(w => w.date), [weighIns])

  async function startToday() {
    if (todaySession) return nav(`/session/${todaySession.id}`)
    setStarting(true)
    try {
      const s = await findOrCreateSessionOnDate(todayKey, 'strength')
      nav(`/session/${s.id}`)
    } finally {
      setStarting(false)
    }
  }

  const header = (
    <PageHeader
      kicker={format(new Date(), 'EEEE d MMMM', { locale: fr })}
      title={greeting(profile.name)}
    />
  )

  if (loading) return <>{header}<TodaySkeleton /></>
  if (error) return <>{header}<ErrorNote message={error} /></>

  return (
    <>
      {header}

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10 lg:items-start">
        <div className="contents lg:flex lg:flex-col lg:gap-8">
        <TodayAction
          session={todaySession}
          plan={todayPlan}
          busy={starting}
          onStart={startToday}
          onOther={openNewSession}
        />

        <Week sessions={sessions} streak={streak} weekCount={weekSessions.length} weekVolumeKg={weekVolume} unit={unit} />

        <WeightBlock unit={unit} weighIns={weighIns} onChanged={load} />
        </div>

        <div className="contents lg:flex lg:flex-col lg:gap-8">
        <section>
          <SectionTitle>Calendrier</SectionTitle>
          <Card className="p-4 sm:p-5">
            <MonthlyCalendar
              counts={sessionCounts}
              weighInDates={weighInDates}
              onDayClick={d => nav(`/history?d=${d}`)}
            />
          </Card>
        </section>

        {sessions.length > 0 ? (
          <section>
            <SectionTitle
              action={
                <button onClick={() => nav('/history')} className="text-[14px] link">
                  Tout le journal
                </button>
              }
            >
              Dernières séances
            </SectionTitle>
            <Card className="overflow-hidden">
              {sessions.slice(0, 5).map(s => (
                <SessionRow key={s.id} session={s} onClick={() => nav(`/session/${s.id}`)} />
              ))}
            </Card>
          </section>
        ) : (
          <EmptyState
            title="Ton journal est vide"
            subtitle="Lance ta première séance ou note ton poids du matin : tout ce que tu enregistres apparaîtra ici."
          />
        )}
        </div>
      </div>
    </>
  )
}

/* ── Today's main action ─────────────────────────────────────────────── */

function TodayAction({
  session,
  plan,
  busy,
  onStart,
  onOther,
}: {
  session?: Session
  plan?: string | null
  busy: boolean
  onStart: () => void
  onOther: () => void
}) {
  const running = session?.type === 'running'
  const sets = session?.exercises.reduce((n, e) => n + e.sets.length, 0) ?? 0

  let overline: string
  let title: string
  let detail: string | null = null
  if (session) {
    overline = 'Séance en cours'
    title = session.notes || (running ? 'Course' : plan || 'Séance du jour')
    detail = running
      ? session.distanceMeters ? `${frNum(session.distanceMeters / 1000, 2)} km` : 'Distance à renseigner'
      : session.exercises.length === 0
        ? 'Aucun exercice pour l’instant'
        : `${session.exercises.length} exercice${session.exercises.length > 1 ? 's' : ''}, ${sets} série${sets > 1 ? 's' : ''}`
  } else {
    overline = plan ? 'Au programme aujourd’hui' : 'Rien de prévu aujourd’hui'
    title = plan || 'Commencer une séance'
  }

  return (
    <section>
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <Disc
            plate={running ? 'run' : 'lift'}
            empty={!session}
            size={56}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-dim">{overline}</p>
            <p className="t-title text-[28px] mt-1 break-words">{title}</p>
            {detail && <p className="text-[14px] text-dim mt-1.5">{detail}</p>}
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <Button size="lg" className="flex-1" onClick={onStart} disabled={busy}>
            {busy ? 'Ouverture…' : session ? 'Reprendre' : 'Commencer'}
            <ArrowRight size={18} strokeWidth={2.4} />
          </Button>
          <Button size="lg" variant="secondary" onClick={onOther} aria-label="Autre jour, course ou séance modèle" className="px-4">
            <CalendarPlus size={18} />
            <span className="hidden min-[400px]:inline">Autre</span>
          </Button>
        </div>
      </Card>
    </section>
  )
}

/* ── Week strip ──────────────────────────────────────────────────────── */

function Week({
  sessions,
  streak,
  weekCount,
  weekVolumeKg,
  unit,
}: {
  sessions: Session[]
  streak: number
  weekCount: number
  weekVolumeKg: number
  unit: 'kg' | 'lb'
}) {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const byDay = new Map<string, Session[]>()
  for (const s of sessions) {
    const arr = byDay.get(s.date) ?? []
    arr.push(s)
    byDay.set(s.date, arr)
  }
  const tonnage = fromKg(weekVolumeKg, unit)

  return (
    <section>
      <SectionTitle>Cette semaine</SectionTitle>
      <Card className="px-3 pt-4 pb-1">
        <ol className="grid grid-cols-7">
          {days.map(d => {
            const key = format(d, 'yyyy-MM-dd')
            const list = byDay.get(key) ?? []
            const today = isToday(d)
            const future = d > new Date() && !today
            const hasRun = list.some(s => s.type === 'running')
            const hasLift = list.some(s => s.type !== 'running')
            return (
              <li key={key} className="flex flex-col items-center gap-2" aria-label={`${format(d, 'EEEE', { locale: fr })} : ${list.length ? `${list.length} séance${list.length > 1 ? 's' : ''}` : 'aucune séance'}`}>
                <span className={cn('text-[12px] font-semibold capitalize', today ? 'text-ink' : 'text-faint')}>
                  {format(d, 'EEEEE', { locale: fr })}
                </span>
                <span className={cn('relative grid place-items-center h-9 w-9 rounded-full', today && 'ring-2 ring-ink ring-offset-2 ring-offset-surface')}>
                  {hasLift && hasRun ? (
                    <span className="relative w-7 h-7">
                      <Disc plate="lift" size={22} className="absolute left-0 top-0" />
                      <Disc plate="run" size={18} className="absolute right-0 bottom-0" />
                    </span>
                  ) : hasLift ? (
                    <Disc plate="lift" size={28} />
                  ) : hasRun ? (
                    <Disc plate="run" size={28} />
                  ) : (
                    <span className={cn(future && 'opacity-40')}><Disc empty size={26} /></span>
                  )}
                </span>
                <span className={cn('text-[12px] num-light', today ? 'text-ink' : 'text-faint')}>{format(d, 'd')}</span>
              </li>
            )
          })}
        </ol>
        <dl className="grid grid-cols-3 mt-3 hairline-t">
          <Figure value={String(streak)} unit={streak > 1 ? 'jours' : 'jour'} label="d’affilée" />
          <Figure value={String(weekCount)} unit={weekCount > 1 ? 'séances' : 'séance'} label="en 7 jours" />
          <Figure
            value={tonnage >= 1000 ? frNum(tonnage / 1000, 1) : String(Math.round(tonnage))}
            unit={tonnage >= 1000 ? (unit === 'kg' ? 't' : 'k lb') : unit}
            label="soulevées"
          />
        </dl>
      </Card>
    </section>
  )
}

function Figure({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="px-2 py-3.5 text-center">
      <dd className="flex items-baseline justify-center gap-1">
        <span className="num text-[32px]">{value}</span>
        <span className="text-[13px] font-semibold text-dim">{unit}</span>
      </dd>
      <dt className="text-[12px] text-faint mt-1 leading-tight">{label}</dt>
    </div>
  )
}

/* ── Body weight ─────────────────────────────────────────────────────── */

function WeightBlock({ unit, weighIns, onChanged }: { unit: 'kg' | 'lb'; weighIns: WeighIn[]; onChanged: () => void }) {
  const [otherOpen, setOtherOpen] = useState(false)
  const today = todayIso()
  const slotOf = (w: WeighIn) => w.slot ?? 'morning'
  const entry = (slot: WeighSlot) => weighIns.find(w => w.date === today && slotOf(w) === slot)
  const avg = weeklyAverage(weighIns, weighIns.some(w => (w.slot ?? 'morning') === 'morning') ? 'morning' : 'evening')
  const previous = (slot: WeighSlot) =>
    weighIns.filter(w => w.date < today && slotOf(w) === slot).sort((a, b) => b.date.localeCompare(a.date))[0]

  return (
    <section>
      <SectionTitle
        action={
          <button
            onClick={() => setOtherOpen(true)}
            className="text-[14px] link"
          >
            Autre date
          </button>
        }
      >
        Poids
      </SectionTitle>
      <Card className="overflow-hidden">
        <WeightSlotRow icon={<Sunrise size={18} />} label="Matin" slot="morning" date={today} unit={unit} entry={entry('morning')} previous={previous('morning')} onChanged={onChanged} />
        <WeightSlotRow icon={<Moon size={18} />} label="Soir" slot="evening" date={today} unit={unit} entry={entry('evening')} previous={previous('evening')} onChanged={onChanged} />
        {avg.now !== null && (
          <div className="flex items-baseline gap-2 px-4 py-3 hairline-t text-[13px] text-dim">
            <span>Moyenne sur 7 jours</span>
            <span className="num-light text-[18px] text-ink ml-auto">{frNum(fromKg(avg.now, unit), 1)}</span>
            <span className="font-semibold">{unit}</span>
            {avg.delta !== null && Math.abs(avg.delta) >= 0.05 && (
              <span className="num-light text-[17px] text-faint">
                {avg.delta > 0 ? '+' : '−'}{frNum(Math.abs(fromKg(avg.delta, unit)), 1)}
              </span>
            )}
          </div>
        )}
      </Card>
      <WeighInOtherDate
        open={otherOpen}
        onOpenChange={setOtherOpen}
        unit={unit}
        allWeighIns={weighIns}
        onSaved={() => { setOtherOpen(false); onChanged() }}
      />
    </section>
  )
}

function WeightSlotRow({
  icon,
  label,
  slot,
  date,
  unit,
  entry,
  previous,
  onChanged,
}: {
  icon: React.ReactNode
  label: string
  slot: WeighSlot
  date: string
  unit: 'kg' | 'lb'
  entry?: WeighIn
  previous?: WeighIn
  onChanged: () => void
}) {
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  function open() {
    const seed = entry ?? previous
    setValue(seed ? frNum(fromKg(seed.weight, unit), 1) : '')
    setEditing(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const n = parseDecimal(value)
    if (Number.isNaN(n) || n <= 0) return
    const kg = toKg(n, unit)
    if (kg < 20 || kg > 400) return
    setSaving(true)
    try {
      await setWeighIn(date, slot, kg)
      setEditing(false)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!entry) return
    const ok = await confirm({
      title: `Supprimer la pesée du ${label.toLowerCase()} ?`,
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    await deleteWeighIn(entry.id)
    onChanged()
  }

  const delta = entry && previous ? round(fromKg(entry.weight - previous.weight, unit), 1) : null

  if (editing) {
    return (
      <form onSubmit={save} className="flex items-center gap-2 px-4 py-3 hairline-b last:shadow-none">
        <span className="text-weigh shrink-0">{icon}</span>
        <div className="relative flex-1 min-w-0">
          <Input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
            onFocus={e => e.currentTarget.select()}
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
            autoComplete="off"
            placeholder="0,0"
            aria-label={`Poids du ${label.toLowerCase()}`}
            className="num text-[24px] pr-12 h-12"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-dim pointer-events-none">{unit}</span>
        </div>
        <Button type="submit" size="md" disabled={saving || !value}>OK</Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => setEditing(false)} aria-label="Annuler">
          <X size={18} />
        </Button>
      </form>
    )
  }

  if (!entry) {
    return (
      <button
        onClick={open}
        className="w-full flex items-center gap-3 px-4 h-[64px] hairline-b last:shadow-none text-left cursor-pointer active:bg-surface-2"
      >
        <span className="text-faint">{icon}</span>
        <span className="font-semibold flex-1">{label}</span>
        <span className="text-[14px] link">Noter</span>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 h-[64px] hairline-b last:shadow-none">
      <span className="text-weigh">{icon}</span>
      <span className="font-semibold w-14">{label}</span>
      <button onClick={open} className="flex-1 flex items-baseline gap-1.5 text-left cursor-pointer min-w-0" aria-label={`Modifier la pesée du ${label.toLowerCase()}`}>
        <span className="num text-[30px]">{frNum(fromKg(entry.weight, unit), 1)}</span>
        <span className="text-[14px] font-semibold text-dim">{unit}</span>
        {delta !== null && delta !== 0 && (
          <span
            className="num-light text-[17px] text-faint ml-1.5"
            title={`Par rapport au ${format(parseISO(previous!.date), 'd MMMM', { locale: fr })}`}
          >
            {delta > 0 ? '+' : '−'}{frNum(Math.abs(delta), 1)}
          </span>
        )}
      </button>
      <button onClick={remove} className="h-10 w-10 -mr-2 grid place-items-center rounded-full text-faint hover:text-danger cursor-pointer" aria-label="Supprimer">
        <X size={18} />
      </button>
    </div>
  )
}

function WeighInOtherDate({
  open,
  onOpenChange,
  unit,
  allWeighIns,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  unit: 'kg' | 'lb'
  allWeighIns: WeighIn[]
  onSaved: () => void
}) {
  const [date, setDate] = useState(todayIso())
  const [slot, setSlot] = useState<WeighSlot>('morning')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDate(format(subDays(new Date(), 1), 'yyyy-MM-dd'))
      setSlot('morning')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const existing = allWeighIns.find(w => w.date === date && (w.slot ?? 'morning') === slot)
    setValue(existing ? frNum(fromKg(existing.weight, unit), 1) : '')
  }, [open, date, slot, allWeighIns, unit])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const n = parseDecimal(value)
    if (Number.isNaN(n) || n <= 0) return
    const kg = toKg(n, unit)
    if (kg < 20 || kg > 400) return
    setSaving(true)
    try {
      await setWeighIn(date, slot, kg)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalTitle className="t-title text-[26px]">Pesée à une autre date</ModalTitle>
        <form onSubmit={save} className="mt-5 space-y-5">
          <div>
            <Label htmlFor="weigh-date" className="block mb-2">Date</Label>
            <Input id="weigh-date" type="date" value={date} onChange={e => setDate(e.target.value)} max={todayIso()} />
          </div>
          <div>
            <Label className="block mb-2">Moment</Label>
            <Segmented
              value={slot}
              onChange={setSlot}
              options={[
                { value: 'morning', label: <><Sunrise size={16} /> Matin</> },
                { value: 'evening', label: <><Moon size={16} /> Soir</> },
              ]}
            />
          </div>
          <div>
            <Label htmlFor="weigh-value" className="block mb-2">Poids</Label>
            <div className="relative">
              <Input
                id="weigh-value"
                type="text"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="0,0"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                autoComplete="off"
                className="num text-[28px] h-14 pr-12"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-dim pointer-events-none">{unit}</span>
            </div>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={saving || !value}>
            {saving ? 'Enregistrement…' : 'Enregistrer la pesée'}
          </Button>
        </form>
      </ModalContent>
    </Modal>
  )
}

/* ── Session row (shared look with the journal) ──────────────────────── */

function SessionRow({ session, onClick }: { session: Session; onClick: () => void }) {
  const running = session.type === 'running'
  const sets = session.exercises.reduce((n, e) => n + e.sets.length, 0)
  const sub = running
    ? [session.route, session.distanceMeters ? `${frNum(session.distanceMeters / 1000, 1)} km` : null].filter(Boolean).join(', ') || 'Course'
    : session.exercises.length
      ? session.exercises.map(e => e.name).slice(0, 3).join(', ') + (session.exercises.length > 3 ? '…' : '')
      : 'Séance vide'
  return (
    <button onClick={onClick} className="w-full text-left flex items-center gap-3.5 px-4 py-3.5 hairline-b last:shadow-none cursor-pointer active:bg-surface-2 hover:bg-surface-2/60">
      <Disc plate={running ? 'run' : 'lift'} size={22} />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold truncate">{session.notes || (running ? 'Course' : 'Séance')}</span>
        <span className="block text-[13px] text-dim truncate">{sub}</span>
      </span>
      <span className="text-right shrink-0">
        <span className="block text-[13px] font-semibold capitalize">{relativeDay(session.date)}</span>
        {!running && sets > 0 && <span className="block text-[12px] text-faint">{sets} séries</span>}
      </span>
      <ChevronRight size={18} className="text-faint shrink-0 -mr-1" />
    </button>
  )
}

function relativeDay(iso: string): string {
  const diff = differenceInCalendarDays(new Date(), parseISO(iso))
  if (diff === 0) return 'aujourd’hui'
  if (diff === 1) return 'hier'
  if (diff < 7) return format(parseISO(iso), 'EEEE', { locale: fr })
  return format(parseISO(iso), 'd MMM', { locale: fr })
}

function computeStreak(sessions: Session[]): number {
  if (sessions.length === 0) return 0
  const days = new Set(sessions.map(s => s.date))
  let streak = 0
  const cursor = new Date()
  if (!days.has(format(cursor, 'yyyy-MM-dd'))) cursor.setDate(cursor.getDate() - 1)
  while (days.has(format(cursor, 'yyyy-MM-dd'))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function greeting(name: string | null): string {
  const h = new Date().getHours()
  const who = name ? ` ${name}` : ''
  if (h < 5) return `Bonne nuit${who}`
  if (h < 18) return `Bonjour${who}`
  return `Bonsoir${who}`
}

function TodaySkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-[164px] rounded-[var(--radius-card)]" />
      <Skeleton className="h-[190px] rounded-[var(--radius-card)]" />
      <Skeleton className="h-[128px] rounded-[var(--radius-card)]" />
    </div>
  )
}