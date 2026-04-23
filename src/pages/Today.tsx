import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Flame, Plus, Scale, Trophy, ChevronRight, CalendarPlus, Sunrise, Moon, Pencil, Check, X } from 'lucide-react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion } from 'framer-motion'
import {
  Button,
  Card,
  EmptyState,
  Input,
  Skeleton,
  Label,
  Modal,
  ModalContent,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useConfirm,
} from '../components/ui'
import {
  deleteWeighIn,
  findOrCreateSessionOnDate,
  listSessions,
  listWeighIns,
  setWeighIn,
} from '../lib/db'
import type { Session, WeighIn, WeighSlot } from '../lib/types'
import { formatWeight, fromKg, round, toKg } from '../lib/units'
import { dateToDayKey, useSettings } from '../store/settings'
import { maybeFireReminder } from '../lib/notifications'
import { MonthlyCalendar } from '../components/MonthlyCalendar'

const todayIso = () => format(new Date(), 'yyyy-MM-dd')
const yesterdayIso = () => format(new Date(Date.now() - 86_400_000), 'yyyy-MM-dd')

export function Today() {
  const nav = useNavigate()
  const { unit, profile, weeklyPlan, reminders } = useSettings()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<Session[]>([])
  const [weighIns, setWeighIns] = useState<WeighIn[]>([])
  const [error, setError] = useState<string | null>(null)
  const [datePickerOpen, setDatePickerOpen] = useState(false)

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
  const todaySession = sessions.find(s => s.date === todayKey)
  const todayMorning = weighIns.find(w => w.date === todayKey && w.slot === 'morning')
  const todayEvening = weighIns.find(w => w.date === todayKey && w.slot === 'evening')
  const todayPlan = weeklyPlan[dateToDayKey(new Date())]

  // Reminder notification: check on mount + when tab becomes visible
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
  const lastWeighIn = weighIns[0]
  const weekSessions = sessions.filter(s => differenceInCalendarDays(new Date(), parseISO(s.date)) < 7)
  const weekVolume = weekSessions.reduce((acc, s) => {
    for (const ex of s.exercises) for (const set of ex.sets) acc += set.reps * Number(set.weight)
    return acc
  }, 0)
  const streak = computeStreak(sessions)
  const sessionCounts = useMemo(() => {
    const out: Record<string, number> = {}
    for (const s of sessions) out[s.date] = (out[s.date] ?? 0) + 1
    return out
  }, [sessions])
  const weighInDates = useMemo(() => weighIns.map(w => w.date), [weighIns])

  async function goToSession(date: string) {
    const s = await findOrCreateSessionOnDate(date)
    nav(`/session/${s.id}`)
  }

  const greeting = getGreeting(profile.name)

  if (loading) return <TodaySkeleton />

  if (error) {
    return (
      <div className="py-10">
        <Card className="p-5 border-[color:var(--color-danger)]/40">
          <p className="font-medium text-[color:var(--color-danger)] mb-1">Erreur de chargement</p>
          <p className="text-sm text-[color:var(--color-text-dim)] break-words">{error}</p>
        </Card>
      </div>
    )
  }

  return (
    <>
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.06 } } }}
        className="py-8 space-y-10"
      >
        <Section>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-dim)] font-medium">
            {format(new Date(), "EEEE d MMMM", { locale: fr })}
          </p>
          <h1 className="font-display text-5xl sm:text-6xl leading-[1.05] mt-2">{greeting}</h1>
        </Section>

        <Section>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat value={streak} label="Streak" suffix={streak > 1 ? 'jours' : 'jour'} accent={streak > 0} icon={<Flame size={14} />} />
            <Stat value={weekSessions.length} label="Cette semaine" suffix="séances" />
            <Stat value={formatTonnage(weekVolume, unit)} label="Tonnage 7j" suffix={unit} />
          </div>
        </Section>

        <Section>
          <div className="grid gap-3 sm:grid-cols-2">
            <SessionAction
              todaySession={todaySession}
              todayPlan={todayPlan}
              onToday={() => goToSession(todayKey)}
              onPickDate={() => setDatePickerOpen(true)}
            />
            <WeightCard
              unit={unit}
              date={todayKey}
              morning={todayMorning}
              evening={todayEvening}
              lastWeighIn={lastWeighIn}
              onChanged={load}
            />
          </div>
        </Section>

        <Section>
          <Label className="block mb-3">Calendrier</Label>
          <Card className="p-5">
            <MonthlyCalendar
              counts={sessionCounts}
              weighInDates={weighInDates}
              onDayClick={d => nav(`/history?d=${d}`)}
            />
          </Card>
        </Section>

        {sessions.length > 0 ? (
          <Section>
            <div className="flex items-baseline justify-between mb-3">
              <Label>Récent</Label>
              <button
                onClick={() => nav('/history')}
                className="text-xs text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] flex items-center gap-1 cursor-pointer transition-colors"
              >
                Tout voir <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {sessions.slice(0, 5).map(s => (
                <SessionRow key={s.id} session={s} onClick={() => nav(`/session/${s.id}`)} showDate />
              ))}
            </div>
          </Section>
        ) : (
          <EmptyState
            icon={<Trophy size={32} />}
            title="Prêt pour la première ?"
            subtitle="Commence par loguer une séance ou enregistrer ton poids. Ton évolution se dessinera toute seule."
          />
        )}
      </motion.div>

      <DatePickerModal
        open={datePickerOpen}
        onOpenChange={setDatePickerOpen}
        sessionsByDate={sessions.map(s => s.date)}
        onPick={async date => {
          setDatePickerOpen(false)
          await goToSession(date)
        }}
      />
    </>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      variants={{
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
      }}
    >
      {children}
    </motion.section>
  )
}

function Stat({
  value,
  label,
  suffix,
  accent,
  icon,
}: {
  value: number | string
  label: string
  suffix?: string
  accent?: boolean
  icon?: React.ReactNode
}) {
  return (
    <Card className="p-4 transition-colors hover:border-[color:var(--color-border-strong)]">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && (
          <span className={accent ? 'text-[color:var(--color-accent)]' : 'text-[color:var(--color-text-dim)]'}>{icon}</span>
        )}
        <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-dim)] font-medium">
          {label}
        </p>
      </div>
      <p className={`font-display text-3xl sm:text-4xl tabular leading-none ${accent ? 'text-[color:var(--color-accent)]' : ''}`}>
        {value}
      </p>
      {suffix && <p className="text-xs text-[color:var(--color-text-dim)] mt-1">{suffix}</p>}
    </Card>
  )
}

function SessionAction({
  todaySession,
  todayPlan,
  onToday,
  onPickDate,
}: {
  todaySession?: Session
  todayPlan?: string | null
  onToday: () => void
  onPickDate: () => void
}) {
  const hasToday = !!todaySession
  const title = hasToday
    ? 'Reprendre la séance'
    : todayPlan || 'Commencer la séance'
  const subtitle = hasToday
    ? (todaySession?.notes || 'Séance du jour en cours')
    : todayPlan
      ? 'Planifié aujourd\'hui'
      : "Logue ton entraînement d'aujourd'hui"
  return (
    <div className="relative group h-full">
      <button
        onClick={onToday}
        className="h-full w-full flex flex-col text-left rounded-2xl p-5 bg-[color:var(--color-accent)] text-[color:var(--color-accent-text)] border border-[color:var(--color-accent)] transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:bg-[color:var(--color-accent-hover)] hover:shadow-[0_16px_40px_-12px_color-mix(in_srgb,var(--color-accent)_55%,transparent)] active:translate-y-0 active:scale-[0.99]"
      >
        <div className="flex items-center justify-between">
          <span className="w-10 h-10 rounded-2xl bg-[color:var(--color-accent-text)]/10 flex items-center justify-center">
            {hasToday ? <Pencil size={18} /> : <Plus size={18} />}
          </span>
          <ArrowRight size={16} className="opacity-60 group-hover:translate-x-1 transition-transform" />
        </div>
        <div className="mt-auto pt-6">
          <p className="font-display text-2xl leading-tight font-semibold">{title}</p>
          <p className="text-sm mt-1 opacity-75">{subtitle}</p>
        </div>
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onPickDate}
            className="absolute top-4 right-4 h-8 px-2.5 rounded-full bg-[color:var(--color-accent-text)]/10 hover:bg-[color:var(--color-accent-text)]/20 transition-colors cursor-pointer text-[color:var(--color-accent-text)] flex items-center gap-1.5 text-xs font-medium"
            aria-label="Antidater une séance"
          >
            <CalendarPlus size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Antidater</TooltipContent>
      </Tooltip>
    </div>
  )
}

function WeightCard({
  unit,
  date,
  morning,
  evening,
  lastWeighIn,
  onChanged,
}: {
  unit: 'kg' | 'lb'
  date: string
  morning?: WeighIn
  evening?: WeighIn
  lastWeighIn?: WeighIn
  onChanged: () => void
}) {
  return (
    <Card className="p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-10 h-10 rounded-2xl bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] flex items-center justify-center">
            <Scale size={18} />
          </span>
          <div>
            <p className="font-display text-lg leading-tight">Poids</p>
            {lastWeighIn && !morning && !evening && (
              <p className="text-xs text-[color:var(--color-text-dim)]">
                dernier: {formatWeight(lastWeighIn.weight, unit, 1)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2 mt-auto">
        <WeightSlotRow
          icon={<Sunrise size={14} />}
          label="Matin"
          slot="morning"
          date={date}
          unit={unit}
          entry={morning}
          onChanged={onChanged}
        />
        <WeightSlotRow
          icon={<Moon size={14} />}
          label="Soir"
          slot="evening"
          date={date}
          unit={unit}
          entry={evening}
          onChanged={onChanged}
        />
      </div>
    </Card>
  )
}

function WeightSlotRow({
  icon,
  label,
  slot,
  date,
  unit,
  entry,
  onChanged,
}: {
  icon: React.ReactNode
  label: string
  slot: WeighSlot
  date: string
  unit: 'kg' | 'lb'
  entry?: WeighIn
  onChanged: () => void
}) {
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  function open() {
    setValue(entry ? String(round(fromKg(entry.weight, unit), 1)) : '')
    setEditing(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!value) return
    setSaving(true)
    try {
      await setWeighIn(date, slot, toKg(Number(value), unit))
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

  if (editing) {
    return (
      <form onSubmit={save} className="flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-medium pointer-events-none">
            {label}
          </span>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
            inputMode="decimal"
            placeholder="0.0"
            className="h-11 pl-[3.75rem] pr-10 text-lg font-semibold tabular min-w-0"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-medium pointer-events-none">
            {unit}
          </span>
        </div>
        <Button type="submit" variant="accent" size="icon-sm" disabled={saving || !value} aria-label="Enregistrer" className="shrink-0">
          <Check size={14} />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing(false)} aria-label="Annuler" className="shrink-0">
          <X size={14} />
        </Button>
      </form>
    )
  }

  if (entry) {
    return (
      <div className="group flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[color:var(--color-surface-2)]/60 transition-colors">
        <span className="text-[color:var(--color-text-dim)] shrink-0">{icon}</span>
        <span className="text-xs text-[color:var(--color-text-dim)] w-10 shrink-0 uppercase tracking-widest font-medium">{label}</span>
        <span className="font-display text-lg tabular flex-1 min-w-0 truncate">
          {round(fromKg(entry.weight, unit), 1)}
          <span className="text-xs text-[color:var(--color-text-dim)] ml-1">{unit}</span>
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={open}
              className="p-1.5 rounded-full text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface)] transition-colors cursor-pointer opacity-60 group-hover:opacity-100 shrink-0"
              aria-label="Modifier"
            >
              <Pencil size={13} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Modifier</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={remove}
              className="p-1.5 rounded-full text-[color:var(--color-text-dim)] hover:text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10 transition-colors cursor-pointer opacity-60 group-hover:opacity-100 shrink-0"
              aria-label="Supprimer"
            >
              <X size={13} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Supprimer</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <button
      onClick={open}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-dashed border-[color:var(--color-border)] hover:border-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-soft)] text-[color:var(--color-text-dim)] hover:text-[color:var(--color-accent)] transition-colors cursor-pointer"
    >
      <span>{icon}</span>
      <span className="text-xs uppercase tracking-widest w-10 font-medium">{label}</span>
      <span className="text-sm flex-1 text-left">Ajouter</span>
      <Plus size={14} />
    </button>
  )
}

function SessionRow({
  session,
  onClick,
  showDate,
}: {
  session: Session
  onClick: () => void
  showDate?: boolean
}) {
  const totalSets = session.exercises.reduce((n, e) => n + e.sets.length, 0)
  return (
    <button
      onClick={onClick}
      className="group w-full text-left flex items-center gap-4 py-3 border-b border-[color:var(--color-border)] last:border-b-0 hover:bg-[color:var(--color-surface-2)]/60 rounded-xl px-2 -mx-2 transition-all duration-200 cursor-pointer"
    >
      <div className="font-display text-2xl tabular w-12 text-center text-[color:var(--color-text-dim)] group-hover:text-[color:var(--color-accent)] transition-colors">
        {format(new Date(session.date), 'dd')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{session.notes || 'Séance'}</p>
        <p className="text-xs text-[color:var(--color-text-dim)] capitalize">
          {showDate ? format(new Date(session.date), 'EEEE d MMM', { locale: fr }) : format(new Date(session.createdAt), 'HH:mm')}
          {' · '}
          {session.exercises.length} exos · {totalSets} séries
        </p>
      </div>
      <ChevronRight size={16} className="text-[color:var(--color-text-dim)] group-hover:text-[color:var(--color-text)] group-hover:translate-x-1 transition-transform" />
    </button>
  )
}

function DatePickerModal({
  open,
  onOpenChange,
  sessionsByDate,
  onPick,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  sessionsByDate: string[]
  onPick: (date: string) => void
}) {
  const [date, setDate] = useState(todayIso())
  const sessionsSet = useMemo(() => new Set(sessionsByDate), [sessionsByDate])
  const existing = sessionsSet.has(date)

  useEffect(() => {
    if (open) setDate(todayIso())
  }, [open])

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-dim)] font-medium">Nouvelle séance</p>
        <h3 className="font-display text-2xl mt-1 font-semibold">Pour quelle date ?</h3>
        <p className="text-sm text-[color:var(--color-text-dim)] mt-2">
          Une seule séance par jour — si tu as déjà logué une séance ce jour-là, elle sera reprise.
        </p>

        <div className="flex gap-2 mt-6">
          <QuickDate label="Aujourd'hui" value={todayIso()} current={date} onChange={setDate} />
          <QuickDate label="Hier" value={yesterdayIso()} current={date} onChange={setDate} />
        </div>
        <div className="mt-3 min-w-0">
          <Label className="block mb-2">Autre date</Label>
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={todayIso()}
            className="h-11 w-full min-w-0"
          />
        </div>

        {existing && (
          <p className="text-xs text-[color:var(--color-accent)] mt-3 flex items-center gap-1.5">
            <Pencil size={12} /> Une séance existe déjà — elle sera ouverte.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="accent" onClick={() => onPick(date)}>
            {existing ? 'Reprendre' : 'Commencer'}
          </Button>
        </div>
      </ModalContent>
    </Modal>
  )
}

function QuickDate({ label, value, current, onChange }: { label: string; value: string; current: string; onChange: (d: string) => void }) {
  const active = value === current
  return (
    <button
      onClick={() => onChange(value)}
      className={`flex-1 h-10 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
        active
          ? 'bg-[color:var(--color-accent)] text-[color:var(--color-accent-text)]'
          : 'bg-[color:var(--color-surface-2)] text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-2)]/70 border border-[color:var(--color-border)]'
      }`}
    >
      {label}
    </button>
  )
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

function formatTonnage(totalKg: number, unit: 'kg' | 'lb'): string {
  const v = fromKg(totalKg, unit)
  if (v >= 1000) return `${round(v / 1000, 1)}k`
  return String(Math.round(v))
}

function getGreeting(name: string | null): string {
  const h = new Date().getHours()
  const who = name ? `, ${name}` : ''
  if (h < 6) return `Bonne nuit${who}.`
  if (h < 12) return `Bonjour${who}.`
  if (h < 18) return `Bel après-midi${who}.`
  return `Bonsoir${who}.`
}

function TodaySkeleton() {
  return (
    <div className="py-8 space-y-10">
      <div>
        <Skeleton className="h-3 w-40 mb-3" />
        <Skeleton className="h-14 w-3/4" />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
      <div>
        <Skeleton className="h-3 w-24 mb-3" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  )
}
