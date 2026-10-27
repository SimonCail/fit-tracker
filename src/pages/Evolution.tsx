import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Dumbbell, Flame, Minus, Plus } from 'lucide-react'
import { format, parseISO, startOfWeek, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from 'recharts'
import { Card, Disc, EmptyState, ErrorNote, Segmented, SectionTitle, Skeleton } from '../components/ui'
import { MUSCLE_GROUPS, muscleGroupOf, type MuscleGroup } from '../lib/muscles'
import { cn } from '../lib/cn'
import { PageHeader } from '../components/Layout'
import { listSessions, listWeighIns } from '../lib/db'
import type { Session, WeighIn, WeighSlot } from '../lib/types'
import { weeklyAverage, weightTrend } from '../lib/weightTrend'
import { frNum, fromKg, round } from '../lib/units'
import { setTotalReps, setVolumeKg } from '../lib/setMath'
import { useSettings } from '../store/settings'
import { weeklyStreak } from '../lib/streak'

const RANGES = [
  { key: '30d', label: '30 j', days: 30 },
  { key: '90d', label: '90 j', days: 90 },
  { key: '1y', label: '1 an', days: 365 },
  { key: 'all', label: 'Tout', days: 10000 },
] as const
type RangeKey = (typeof RANGES)[number]['key']

const axis = { stroke: 'var(--color-faint)', fontSize: 11, tickLine: false, axisLine: false } as const
const tooltipStyle = {
  background: 'var(--color-surface-2)',
  border: 'none',
  borderRadius: 12,
  fontSize: 13,
  color: 'var(--color-ink)',
  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
} as const
/** Size used before the container is measured — avoids Recharts' "width(-1)" warning. */
const INITIAL_SIZE = { width: 320, height: 200 }

export function Evolution() {
  const { unit } = useSettings()
  const [weighIns, setWeighIns] = useState<WeighIn[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<RangeKey>('90d')
  const [tab, setTab] = useState<ProgressTab>(() => {
    try {
      const t = localStorage.getItem(TAB_KEY)
      return t === 'run' || t === 'weight' ? t : 'lift'
    } catch { return 'lift' }
  })
  function pickTab(t: ProgressTab) {
    setTab(t)
    try { localStorage.setItem(TAB_KEY, t) } catch { /* ignore */ }
  }

  useEffect(() => {
    (async () => {
      try {
        const [w, s] = await Promise.all([listWeighIns(500), listSessions(500)])
        setWeighIns(w)
        setSessions(s)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const rangeDays = RANGES.find(r => r.key === range)!.days
  const cutoff = format(subDays(new Date(), rangeDays), 'yyyy-MM-dd')

  const hasRuns = sessions.some(
    s => s.type === 'running' && s.date >= cutoff && ((s.distanceMeters ?? 0) > 0 || (s.durationSeconds ?? 0) > 0),
  )

  return (
    <>
      <PageHeader title="Progrès" />

      <div className="grid grid-cols-2 gap-2 mb-8 lg:max-w-xl">
        <QuickLink to="/records" icon={<Disc plate="pr" size={20} />} label="Records" hint="Le palmarès" />
        <QuickLink to="/exercises" icon={<Dumbbell size={20} className="text-dim" />} label="Exercices" hint="Historique" />
      </div>

      {loading ? (
        <div className="space-y-8">
          <Skeleton className="h-64 rounded-[var(--radius-card)]" />
          <Skeleton className="h-80 rounded-[var(--radius-card)]" />
        </div>
      ) : error ? (
        <ErrorNote message={error} />
      ) : (
        <>
          <RegularitySection sessions={sessions} />

          {/* One topic at a time instead of a long scroll of every chart. */}
          <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <Segmented
              value={tab}
              onChange={pickTab}
              options={[{ value: 'lift', label: 'Muscu' }, { value: 'run', label: 'Course' }, { value: 'weight', label: 'Poids' }]}
              className="sm:w-[320px]"
            />
            <Segmented
              value={range}
              onChange={setRange}
              options={RANGES.map(r => ({ value: r.key, label: r.label }))}
              size="sm"
              className="sm:w-[280px]"
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-x-8 items-start">
            {tab === 'lift' && (
              <>
                <VolumeSection sessions={sessions} weighIns={weighIns} cutoff={cutoff} unit={unit} />
                <MuscleSection sessions={sessions} />
              </>
            )}
            {tab === 'run' && (hasRuns
              ? <RunningSection sessions={sessions} cutoff={cutoff} />
              : (
                <Card className="px-4 lg:col-span-2">
                  <EmptyState className="py-8" title="Aucune sortie sur la période" subtitle="Note une course ou choisis une période plus longue." />
                </Card>
              ))}
            {tab === 'weight' && <div className="lg:col-span-2 lg:max-w-3xl"><WeightSection weighIns={weighIns} cutoff={cutoff} unit={unit} /></div>}
          </div>
        </>
      )}
    </>
  )
}

type ProgressTab = 'lift' | 'run' | 'weight'
const TAB_KEY = 'fit-tracker:progress-tab'

function QuickLink({ to, icon, label, hint }: { to: string; icon: React.ReactNode; label: string; hint: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface px-4 h-16 active:bg-surface-2 hover:bg-surface-2/60 min-w-0"
    >
      {icon}
      <span className="flex-1 min-w-0">
        <span className="block font-semibold truncate">{label}</span>
        <span className="block text-[13px] text-dim truncate">{hint}</span>
      </span>
      <ChevronRight size={18} className="text-faint shrink-0" />
    </Link>
  )
}

/* ── Regularity ──────────────────────────────────────────────────────── */

function RegularitySection({ sessions }: { sessions: Session[] }) {
  const goal = useSettings(s => s.weeklyGoal ?? 2)
  const setGoal = useSettings(s => s.setWeeklyGoal)
  const st = useMemo(() => weeklyStreak(sessions, goal), [sessions, goal])
  const done = st.thisWeek
  const left = Math.max(0, goal - done)
  const scale = Math.max(goal, ...st.recent.map(w => w.count), 1)

  return (
    <section>
      <SectionTitle>Régularité</SectionTitle>
      <Card className="p-4 sm:p-5">
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-8">
          {/* Streak */}
          <div className="flex items-center gap-3.5">
            <span className={cn('h-14 w-14 rounded-full grid place-items-center shrink-0', st.current > 0 ? 'bg-pr/15 text-pr' : 'bg-surface-2 text-faint')}>
              <Flame size={28} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] text-dim">Ta série</p>
              <p className="flex items-baseline gap-1.5">
                <span className="num text-[40px] leading-none">{st.current}</span>
                <span className="text-[16px] font-semibold">semaine{st.current > 1 ? 's' : ''} de suite</span>
              </p>
              <p className="text-[13px] text-dim mt-1">
                à {goal} séance{goal > 1 ? 's' : ''} ou plus{st.best > st.current ? `, record ${st.best} semaines` : ''}
              </p>
            </div>
          </div>

          {/* This week */}
          <div>
            <p className="text-[13px] text-dim">Cette semaine</p>
            <p className="flex items-baseline gap-1.5">
              <span className="num text-[40px] leading-none">{done}</span>
              <span className="text-[16px] font-semibold text-dim">/ {goal} séance{goal > 1 ? 's' : ''}</span>
            </p>
            <div className="flex gap-1.5 mt-2" aria-hidden>
              {Array.from({ length: Math.max(goal, done) }).map((_, i) => (
                <span key={i} className={cn('h-2 flex-1 max-w-12 rounded-full', i < done ? 'bg-accent' : 'bg-surface-2')} />
              ))}
            </div>
            <p className="text-[13px] mt-2">
              {left === 0
                ? <span className="font-semibold">Objectif atteint, la série continue 🎉</span>
                : <span className="text-dim">Encore {left} pour {st.current > 0 ? 'garder ta série' : 'démarrer une série'}.</span>}
            </p>
          </div>
        </div>

        {/* Last 12 weeks as bars, with the goal as a dashed line. */}
        <div className="mt-6">
          <p className="text-[13px] text-dim mb-2">Séances par semaine, sur 12 semaines (la dernière barre = cette semaine)</p>
          <div className="relative h-28 flex items-end gap-1.5 sm:gap-2.5">
            <div
              className="absolute inset-x-0 z-10 border-t-[1.5px] border-dashed border-ink/50 pointer-events-none"
              style={{ bottom: `calc(${(goal / scale) * 82}% + 14px)` }}
              aria-hidden
            />
            {st.recent.map((w, i) => {
              const last = i === st.recent.length - 1
              return (
                <div key={w.week} className="flex-1 h-full flex flex-col justify-end items-center gap-1 min-w-0">
                  <span className={cn('num text-[13px]', w.count ? 'text-ink' : 'text-faint')}>{w.count || ''}</span>
                  <span
                    title={`Semaine du ${format(parseISO(w.week), 'd MMMM', { locale: fr })} : ${w.count} séance${w.count > 1 ? 's' : ''}`}
                    className={cn(
                      'w-full max-w-9 rounded-t-[6px] rounded-b-[2px]',
                      w.met ? 'bg-accent' : w.count > 0 ? 'bg-line-strong' : 'bg-surface-2',
                      last && !w.met && 'bg-line-strong/60',
                    )}
                    style={{ height: `calc(${(Math.max(w.count, 0.15) / scale) * 82}%)` }}
                  />
                  <span className={cn('text-[10px] leading-none whitespace-nowrap', last ? 'font-bold text-ink' : 'text-faint')}>
                    {last || i % 3 === 2 ? format(parseISO(w.week), 'd/MM') : '\u00a0'}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-dim mt-3">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-accent" /> Objectif atteint</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-line-strong" /> En dessous</span>
            <span className="flex items-center gap-1.5"><span className="w-4 border-t-[1.5px] border-dashed border-ink/50" /> Objectif ({goal} séance{goal > 1 ? 's' : ''})</span>
          </p>
        </div>

        <div className="mt-5 pt-4 hairline-t flex items-center justify-between gap-3">
          <span className="text-[14px] font-medium">Objectif par semaine</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full bg-surface-2">
              <button type="button" onClick={() => setGoal(goal - 1)} disabled={goal <= 1} aria-label="Baisser l’objectif" className="h-9 w-9 grid place-items-center cursor-pointer disabled:opacity-30">
                <Minus size={16} />
              </button>
              <span className="num text-[20px] w-6 text-center" aria-live="polite">{goal}</span>
              <button type="button" onClick={() => setGoal(goal + 1)} disabled={goal >= 7} aria-label="Monter l’objectif" className="h-9 w-9 grid place-items-center cursor-pointer disabled:opacity-30">
                <Plus size={16} />
              </button>
            </div>
            <span className="text-[13px] text-dim">séance{goal > 1 ? 's' : ''}</span>
          </div>
        </div>
      </Card>
    </section>
  )
}

/* ── Body weight ─────────────────────────────────────────────────────── */

function WeightSection({ weighIns, cutoff, unit }: { weighIns: WeighIn[]; cutoff: string; unit: 'kg' | 'lb' }) {
  const hasEvening = weighIns.some(w => w.slot === 'evening')
  const hasMorning = weighIns.some(w => (w.slot ?? 'morning') === 'morning')
  const [slot, setSlot] = useState<WeighSlot>(hasMorning ? 'morning' : 'evening')

  // The average is computed on all history, then trimmed, so the first days of the
  // range still get a full 7-day window behind them.
  const series = useMemo(
    () => weightTrend(weighIns, slot)
      .filter(p => p.date >= cutoff)
      .map(p => ({ date: p.date, raw: p.raw !== null ? round(fromKg(p.raw, unit), 1) : null, avg: round(fromKg(p.avg, unit), 2) })),
    [weighIns, slot, cutoff, unit],
  )
  const week = useMemo(() => weeklyAverage(weighIns, slot), [weighIns, slot])
  const last = series[series.length - 1]
  const rangeDelta = series.length >= 2 ? round(series[series.length - 1].avg - series[0].avg, 1) : null

  return (
    <section>
      <SectionTitle
        action={hasEvening && hasMorning ? (
          <Segmented
            size="sm"
            className="w-[150px]"
            value={slot}
            onChange={setSlot}
            options={[{ value: 'morning', label: 'Matin' }, { value: 'evening', label: 'Soir' }]}
          />
        ) : undefined}
      >
        Poids du corps
      </SectionTitle>
      {series.length >= 2 ? (
        <Card className="p-4 sm:p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="flex items-baseline gap-1">
                <span className="num text-[56px]">{week.now !== null ? frNum(fromKg(week.now, unit), 1) : frNum(last.avg, 1)}</span>
                <span className="text-[15px] font-semibold text-dim">{unit}</span>
              </p>
              <p className="text-[13px] text-dim mt-1">
                Moyenne des 7 derniers jours{week.count ? `, ${week.count} pesée${week.count > 1 ? 's' : ''}` : ''}
              </p>
            </div>
            <dl className="text-right space-y-1 pb-6">
              {week.delta !== null && <Delta label="En 7 jours" value={round(fromKg(week.delta, unit), 1)} unit={unit} />}
              {rangeDelta !== null && <Delta label="Sur la période" value={rangeDelta} unit={unit} />}
            </dl>
          </div>
          <div className="h-56 sm:h-64 mt-4 -ml-2 -mr-1">
            <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL_SIZE}>
              <ComposedChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="weighFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-weigh)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--color-weigh)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={d => format(parseISO(d), 'd MMM', { locale: fr })} minTickGap={24} tickMargin={8} {...axis} />
                <YAxis width={34} domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={v => frNum(Number(v), 0)} allowDecimals={false} {...axis} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ stroke: 'var(--color-line-strong)' }}
                  labelFormatter={d => format(parseISO(d as string), 'EEEE d MMMM', { locale: fr })}
                  formatter={(v, name) => [`${frNum(Number(v), 1)} ${unit}`, name]}
                />
                <Area type="monotone" dataKey="avg" name="Moyenne 7 j" stroke="var(--color-weigh)" strokeWidth={3} fill="url(#weighFill)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="raw" name="Pesée" stroke="none" dot={{ r: 2.5, fill: 'var(--color-dim)', strokeWidth: 0 }} activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--color-ink)' }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-5 mt-2 text-[12px] text-dim">
            <span className="flex items-center gap-1.5"><span className="h-[3px] w-4 rounded-full bg-weigh" /> Moyenne sur 7 jours</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-dim" /> Pesées</span>
          </div>
          <p className="text-[12px] text-faint mt-3 leading-snug">
            Le poids du jour varie d’un kilo selon l’eau et les repas : la moyenne montre la vraie tendance.
          </p>
        </Card>
      ) : (
        <Card className="px-4"><EmptyState title="Pas encore de courbe" subtitle="Il faut au moins deux pesées sur la période pour tracer ton évolution." className="py-8" /></Card>
      )}
    </section>
  )
}

function Delta({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex items-baseline justify-end gap-2">
      <dt className="text-[13px] text-dim">{label}</dt>
      <dd className="num text-[20px]">
        {value > 0 ? '+' : value < 0 ? '−' : '±'}{frNum(Math.abs(value), 1)}
        <span className="text-[12px] font-semibold text-dim ml-0.5">{unit}</span>
      </dd>
    </div>
  )
}

/* ── Muscle groups ───────────────────────────────────────────────────── */

type Span = 'this' | 'last' | 'avg'

function MuscleSection({ sessions }: { sessions: Session[] }) {
  const [span, setSpan] = useState<Span>('this')
  const thisMonday = startOfWeek(new Date(), { weekStartsOn: 1 })

  const { counts, others, max } = useMemo(() => {
    const weekKey = (d: string) => format(startOfWeek(parseISO(d), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const target = span === 'this'
      ? [format(thisMonday, 'yyyy-MM-dd')]
      : span === 'last'
        ? [format(subDays(thisMonday, 7), 'yyyy-MM-dd')]
        : [1, 2, 3, 4].map(i => format(subDays(thisMonday, 7 * i), 'yyyy-MM-dd'))
    const counts = new Map<MuscleGroup, number>()
    const others = new Set<string>()
    for (const s of sessions) {
      if (s.type === 'running' || !target.includes(weekKey(s.date))) continue
      for (const ex of s.exercises) {
        const g = muscleGroupOf(ex.name)
        if (g === 'Autres' && ex.sets.length) others.add(ex.name)
        counts.set(g, (counts.get(g) ?? 0) + ex.sets.length)
      }
    }
    if (span === 'avg') for (const [g, v] of counts) counts.set(g, v / 4)
    const max = Math.max(1, ...counts.values())
    return { counts, others: [...others], max }
  }, [sessions, span, thisMonday])

  const groups: MuscleGroup[] = [...MUSCLE_GROUPS, ...(counts.get('Autres') ? ['Autres' as const] : [])]
  const neglected = MUSCLE_GROUPS.filter(g => !counts.get(g))
  const total = [...counts.values()].reduce((a, b) => a + b, 0)

  return (
    <section>
      <SectionTitle>Séries par groupe musculaire</SectionTitle>
      <Card className="p-4 sm:p-5">
        <Segmented
          size="sm"
          value={span}
          onChange={setSpan}
          options={[{ value: 'this', label: 'Cette semaine' }, { value: 'last', label: 'Semaine passée' }, { value: 'avg', label: 'Moy. 4 sem.' }]}
        />
        {total === 0 ? (
          <p className="text-[14px] text-dim mt-5">Aucune série de muscu sur cette période.</p>
        ) : (
          <ul className="mt-5 space-y-2.5">
            {groups.map(g => {
              const v = counts.get(g) ?? 0
              return (
                <li key={g} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] items-center gap-3">
                  <span className={cn('text-[14px] font-medium', v === 0 && 'text-faint')}>{g}</span>
                  <span className="h-3 rounded-full bg-surface-2 overflow-hidden">
                    <span className="block h-full rounded-full bg-lift" style={{ width: `${(v / max) * 100}%` }} />
                  </span>
                  <span className={cn('num text-[20px] text-right', v === 0 && 'text-faint')}>{span === 'avg' ? frNum(v, 1) : v}</span>
                </li>
              )
            })}
          </ul>
        )}
        {total > 0 && neglected.length > 0 && (
          <p className="text-[14px] mt-5">
            <span className="font-semibold">Rien pour : </span>
            <span className="text-dim">{neglected.join(', ').toLowerCase()}.</span>
          </p>
        )}
        <p className="text-[12px] text-faint mt-3 leading-snug">
          Groupe deviné d’après le nom de l’exercice.{others.length > 0 ? ` Non classés : ${others.slice(0, 4).join(', ')}${others.length > 4 ? '…' : ''}.` : ''}
        </p>
      </Card>
    </section>
  )
}

/* ── Weekly tonnage ──────────────────────────────────────────────────── */

function VolumeSection({ sessions, weighIns, cutoff, unit }: { sessions: Session[]; weighIns: WeighIn[]; cutoff: string; unit: 'kg' | 'lb' }) {
  const bw = weighIns[0]?.weight ?? 0
  const weeks = useMemo(() => {
    const map = new Map<string, { week: string; tonnage: number; sessions: number }>()
    for (const s of sessions) {
      if (s.type === 'running' || s.date < cutoff) continue
      const wk = format(startOfWeek(parseISO(s.date), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const row = map.get(wk) ?? { week: wk, tonnage: 0, sessions: 0 }
      row.sessions += 1
      for (const ex of s.exercises) {
        const eff = ex.bodyweight ? bw : 0
        for (const set of ex.sets) row.tonnage += setVolumeKg(set) + setTotalReps(set) * eff
      }
      map.set(wk, row)
    }
    return [...map.values()]
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-16)
      .map(r => ({ ...r, value: round(fromKg(r.tonnage, unit) / 1000, 2) }))
  }, [sessions, cutoff, unit, bw])

  if (weeks.length < 2) return null
  const best = weeks.reduce((m, w) => (w.value > m.value ? w : m), weeks[0])
  const big = unit === 'kg' ? 't' : 'k lb'

  return (
    <section>
      <SectionTitle>Charge soulevée par semaine</SectionTitle>
      <Card className="p-4 sm:p-5">
        <p className="text-[14px] text-dim">
          Meilleure semaine : <span className="text-ink font-semibold">{frNum(best.value, 1)} {big}</span>, celle du {format(parseISO(best.week), 'd MMMM', { locale: fr })}
        </p>
        <div className="h-48 mt-4 -ml-2 -mr-1">
          <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL_SIZE}>
            <BarChart data={weeks} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="week" tickFormatter={d => format(parseISO(d), 'd/MM')} minTickGap={16} tickMargin={8} {...axis} />
              <YAxis width={34} tickFormatter={v => frNum(Number(v), 0)} {...axis} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: 'var(--color-surface-2)' }}
                labelFormatter={d => `Semaine du ${format(parseISO(d as string), 'd MMMM', { locale: fr })}`}
                formatter={(v, _n, item) => {
                  const n = (item.payload as { sessions: number }).sessions
                  return [`${frNum(Number(v), 1)} ${big}, ${n} séance${n > 1 ? 's' : ''}`, 'Total']
                }}
              />
              <Bar dataKey="value" fill="var(--color-lift)" radius={[6, 6, 2, 2]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </section>
  )
}

/* ── Running ─────────────────────────────────────────────────────────── */

/** Pace only compares fairly between runs of a similar length. */
const RUN_BANDS = [
  { key: 'short', label: '< 6 km', title: 'moins de 6 km', min: 0, max: 6 },
  { key: 'mid', label: '6–12 km', title: '6 à 12 km', min: 6, max: 12 },
  { key: 'long', label: '> 12 km', title: 'plus de 12 km', min: 12, max: Infinity },
] as const
type RunBand = (typeof RUN_BANDS)[number]['key']
const bandOf = (km: number): RunBand => RUN_BANDS.find(b => km >= b.min && km < b.max)!.key

function RunningSection({ sessions, cutoff }: { sessions: Session[]; cutoff: string }) {
  const runs = useMemo(
    () => sessions
      .filter(s => s.type === 'running' && s.date >= cutoff)
      .filter(s => (s.distanceMeters ?? 0) > 0 || (s.durationSeconds ?? 0) > 0)
      .sort((a, b) => a.date.localeCompare(b.date)),
    [sessions, cutoff],
  )

  // Each record keeps the run it comes from, so the card can say which outing it was.
  const stats = useMemo(() => {
    let fastest: { pace: number; run: Session } | null = null
    let longest: Session | null = null
    let farthest: Session | null = null
    let totalKm = 0
    for (const r of runs) {
      const km = (r.distanceMeters ?? 0) / 1000
      const sec = r.durationSeconds ?? 0
      totalKm += km
      if (km > 0 && (!farthest || km > (farthest.distanceMeters ?? 0) / 1000)) farthest = r
      if (sec > 0 && (!longest || sec > (longest.durationSeconds ?? 0))) longest = r
      if (km > 0 && sec > 0) {
        const p = sec / km
        if (!fastest || p < fastest.pace) fastest = { pace: p, run: r }
      }
    }
    return { fastest, longest, farthest, totalKm }
  }, [runs])

  const paced = useMemo(
    () => runs
      .filter(r => (r.distanceMeters ?? 0) > 0 && (r.durationSeconds ?? 0) > 0)
      .map(r => {
        const km = (r.distanceMeters ?? 0) / 1000
        return { date: r.date, pace: Math.round(((r.durationSeconds ?? 0) / km / 60) * 100) / 100, km: Math.round(km * 100) / 100, band: bandOf(km) }
      }),
    [runs],
  )
  const bandCounts = useMemo(() => {
    const c: Record<RunBand, number> = { short: 0, mid: 0, long: 0 }
    for (const p of paced) c[p.band]++
    return c
  }, [paced])
  const bands = RUN_BANDS.filter(b => bandCounts[b.key] > 0)
  // Default to the distance you run most often.
  const [pickedBand, setBand] = useState<RunBand | null>(null)
  const band: RunBand = pickedBand && bandCounts[pickedBand] > 0
    ? pickedBand
    : (bands.reduce<(typeof RUN_BANDS)[number] | null>((m, b) => (!m || bandCounts[b.key] > bandCounts[m.key] ? b : m), null)?.key ?? 'short')
  const chartData = useMemo(() => paced.filter(p => p.band === band), [paced, band])
  const bandInfo = RUN_BANDS.find(b => b.key === band)!

  const paceAxis = useMemo(() => {
    if (chartData.length === 0) return { domain: [5, 6] as [number, number], ticks: [5, 6] }
    let lo = Infinity
    let hi = -Infinity
    for (const d of chartData) { lo = Math.min(lo, d.pace); hi = Math.max(hi, d.pace) }
    const span = Math.max(hi - lo, 0.01)
    const step = [0.25, 0.5, 1, 2].find(s => span / s <= 4) ?? 2
    const low = Math.floor(lo / step) * step
    const high = Math.ceil(hi / step) * step
    const ticks: number[] = []
    for (let t = low; t <= high + 1e-9; t += step) ticks.push(Math.round(t * 1000) / 1000)
    return { domain: [low, high] as [number, number], ticks }
  }, [chartData])

  const byRoute = useMemo(() => {
    const map = new Map<string, { name: string; runs: number; totalKm: number; bestPaceSec: number | null }>()
    for (const r of runs) {
      const name = r.route?.trim()
      if (!name) continue
      const entry = map.get(name) ?? { name, runs: 0, totalKm: 0, bestPaceSec: null }
      const km = (r.distanceMeters ?? 0) / 1000
      entry.runs += 1
      entry.totalKm += km
      if (km > 0 && (r.durationSeconds ?? 0) > 0) {
        const p = (r.durationSeconds ?? 0) / km
        if (entry.bestPaceSec === null || p < entry.bestPaceSec) entry.bestPaceSec = p
      }
      map.set(name, entry)
    }
    return [...map.values()].sort((a, b) => b.runs - a.runs)
  }, [runs])

  if (runs.length === 0) return null

  return (
    <section className="lg:col-span-2">
      <SectionTitle action={<span className="text-[14px] text-dim">{runs.length} sortie{runs.length > 1 ? 's' : ''}, {frNum(stats.totalKm, 0)} km</span>}>
        Course
      </SectionTitle>

      <Card className="overflow-hidden mb-3">
        <p className="px-4 pt-3.5 pb-2 text-[13px] text-dim">Tes records sur la période, chacun sur sa propre sortie</p>
        {stats.fastest && (
          <RunRecord label="Meilleure allure" run={stats.fastest.run} value={paceStr(stats.fastest.pace)} unit="/km" />
        )}
        {stats.longest && (
          <RunRecord label="Sortie la plus longue" run={stats.longest} value={formatDuration(stats.longest.durationSeconds ?? 0)} />
        )}
        {stats.farthest && (
          <RunRecord label="Plus grande distance" run={stats.farthest} value={frNum((stats.farthest.distanceMeters ?? 0) / 1000, 1)} unit="km" />
        )}
      </Card>

      {paced.length >= 2 && (
        <Card className="p-4 sm:p-5 mb-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <p className="text-[14px] text-dim">Allure, à distance comparable</p>
            {bands.length > 1 && (
              <Segmented
                size="sm"
                className={bands.length === 3 ? 'w-full sm:w-[260px]' : 'w-full sm:w-[180px]'}
                value={band}
                onChange={setBand}
                options={bands.map(b => ({ value: b.key, label: b.label }))}
              />
            )}
          </div>
          {chartData.length < 2 ? (
            <p className="text-[14px] text-dim mt-4">
              Une seule sortie de {bandInfo.title} pour l’instant : il en faut deux pour voir une évolution.
            </p>
          ) : (
          <>
          <div className="h-44 sm:h-52 mt-4 -ml-2 -mr-1">
            <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL_SIZE}>
              <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="runFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-run)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--color-run)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={d => format(parseISO(d), 'd MMM', { locale: fr })} minTickGap={24} tickMargin={8} {...axis} />
                <YAxis width={40} domain={paceAxis.domain} ticks={paceAxis.ticks} tickFormatter={v => paceStr(Number(v) * 60)} reversed {...axis} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ stroke: 'var(--color-line-strong)' }}
                  labelFormatter={d => format(parseISO(d as string), 'EEEE d MMMM', { locale: fr })}
                  formatter={(v, _n, item) => {
                    const km = (item.payload as { km?: number })?.km
                    return [`${paceStr(Number(v) * 60)} /km${km ? ` sur ${frNum(km, 1)} km` : ''}`, 'Allure']
                  }}
                />
                <Area type="monotone" dataKey="pace" stroke="var(--color-run)" strokeWidth={2.5} fill="url(#runFill)" dot={{ r: 3, fill: 'var(--color-run)', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[12px] text-faint mt-2">
            {chartData.length} sorties de {bandInfo.title}. Plus la courbe monte, plus tu cours vite.
          </p>
          </>
          )}
        </Card>
      )}

      {byRoute.length > 0 && (
        <Card className="overflow-hidden">
          {byRoute.map(r => (
            <div key={r.name} className="flex items-center gap-3 px-4 py-3 hairline-b last:shadow-none">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{r.name}</p>
                <p className="text-[13px] text-dim">{r.runs} sortie{r.runs > 1 ? 's' : ''}, {frNum(r.totalKm, 1)} km au total</p>
              </div>
              {r.bestPaceSec !== null && (
                <div className="text-right shrink-0">
                  <p className="num text-[22px]">{paceStr(r.bestPaceSec)}<span className="text-[12px] font-semibold text-dim ml-0.5">/km</span></p>
                  <p className="text-[12px] text-faint">meilleure allure</p>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </section>
  )
}

/** One record line: what it is, which run it comes from (date, distance, time), and the value. */
function RunRecord({ label, run, value, unit }: { label: string; run: Session; value: string; unit?: string }) {
  const km = (run.distanceMeters ?? 0) / 1000
  const sec = run.durationSeconds ?? 0
  const detail = [
    km > 0 ? `${frNum(km, 1)} km` : null,
    sec > 0 ? `en ${formatDuration(sec)}` : null,
  ].filter(Boolean).join(' ')
  return (
    <Link
      to={`/session/${run.id}`}
      className="flex items-center gap-3 px-4 py-3 hairline-t active:bg-surface-2 hover:bg-surface-2/60"
    >
      <Disc plate="run" size={18} />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold">{label}</span>
        <span className="block text-[13px] text-dim truncate">
          {format(parseISO(run.date), 'd MMMM', { locale: fr })}{detail ? `, ${detail}` : ''}
        </span>
      </span>
      <span className="num text-[26px] shrink-0">
        {value}
        {unit && <span className="text-[12px] font-semibold text-dim ml-0.5">{unit}</span>}
      </span>
      <ChevronRight size={16} className="text-faint shrink-0" />
    </Link>
  )
}

function paceStr(secPerKm: number): string {
  const t = Math.round(secPerKm)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

function formatDuration(totalSec: number): string {
  if (totalSec <= 0) return '–'
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`
  return `${m} min`
}