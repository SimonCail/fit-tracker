import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
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

export function Evolution() {
  const { unit } = useSettings()
  const [weighIns, setWeighIns] = useState<WeighIn[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<RangeKey>('90d')

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

  return (
    <>
      <PageHeader title="Progrès" />
      <Segmented
        value={range}
        onChange={setRange}
        options={RANGES.map(r => ({ value: r.key, label: r.label }))}
        size="sm"
        className="mb-4 lg:max-w-sm"
      />
      <Link
        to="/records"
        className="mb-8 flex items-center gap-3 rounded-[var(--radius-card)] bg-surface px-4 h-14 active:bg-surface-2 hover:bg-surface-2/60 lg:max-w-sm"
      >
        <Disc plate="pr" size={20} />
        <span className="flex-1 font-semibold">Records</span>
        <span className="text-[14px] text-dim">Le palmarès</span>
        <ChevronRight size={18} className="text-faint" />
      </Link>

      {loading ? (
        <div className="space-y-8">
          <Skeleton className="h-80 rounded-[var(--radius-card)]" />
          <Skeleton className="h-56 rounded-[var(--radius-card)]" />
        </div>
      ) : error ? (
        <ErrorNote message={error} />
      ) : (
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-x-8 items-start">
          <WeightSection weighIns={weighIns} cutoff={cutoff} unit={unit} />
          <MuscleSection sessions={sessions} />
          <VolumeSection sessions={sessions} weighIns={weighIns} cutoff={cutoff} unit={unit} />
          <RunningSection sessions={sessions} cutoff={cutoff} />
        </div>
      )}
    </>
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
            <ResponsiveContainer width="100%" height="100%">
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
          <ResponsiveContainer width="100%" height="100%">
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

function RunningSection({ sessions, cutoff }: { sessions: Session[]; cutoff: string }) {
  const runs = useMemo(
    () => sessions
      .filter(s => s.type === 'running' && s.date >= cutoff)
      .filter(s => (s.distanceMeters ?? 0) > 0 || (s.durationSeconds ?? 0) > 0)
      .sort((a, b) => a.date.localeCompare(b.date)),
    [sessions, cutoff],
  )

  const stats = useMemo(() => {
    let bestPace: number | null = null
    let longestKm = 0
    let longestSec = 0
    let totalKm = 0
    for (const r of runs) {
      const km = (r.distanceMeters ?? 0) / 1000
      const sec = r.durationSeconds ?? 0
      totalKm += km
      longestKm = Math.max(longestKm, km)
      longestSec = Math.max(longestSec, sec)
      if (km > 0 && sec > 0) {
        const p = sec / km
        if (bestPace === null || p < bestPace) bestPace = p
      }
    }
    return { bestPace, longestKm, longestSec, totalKm }
  }, [runs])

  const chartData = useMemo(
    () => runs
      .filter(r => (r.distanceMeters ?? 0) > 0 && (r.durationSeconds ?? 0) > 0)
      .map(r => {
        const km = (r.distanceMeters ?? 0) / 1000
        return { date: r.date, pace: Math.round(((r.durationSeconds ?? 0) / km / 60) * 100) / 100, km: Math.round(km * 100) / 100 }
      }),
    [runs],
  )

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

      <Card className="grid grid-cols-3 py-4 mb-3">
        <RunStat label="Meilleure allure" value={stats.bestPace !== null ? paceStr(stats.bestPace) : '–'} unit="/km" />
        <RunStat label="Plus longue" value={formatDuration(stats.longestSec)} />
        <RunStat label="Plus loin" value={frNum(stats.longestKm, 1)} unit="km" />
      </Card>

      {chartData.length >= 2 && (
        <Card className="p-4 sm:p-5 mb-3">
          <p className="text-[14px] text-dim">Allure par sortie, plus haut = plus rapide</p>
          <div className="h-44 sm:h-52 mt-4 -ml-2 -mr-1">
            <ResponsiveContainer width="100%" height="100%">
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

function RunStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="text-center px-1">
      <p className="flex items-baseline justify-center gap-0.5">
        <span className="num text-[30px]">{value}</span>
        {unit && <span className="text-[12px] font-semibold text-dim">{unit}</span>}
      </p>
      <p className="text-[12px] text-faint mt-1">{label}</p>
    </div>
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