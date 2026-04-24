import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion } from 'framer-motion'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Card, EmptyState, Label, Skeleton, Badge } from '../components/ui'
import { listSessions, listWeighIns } from '../lib/db'
import type { Session, WeighIn } from '../lib/types'
import { estimate1RM, fromKg, round } from '../lib/units'
import { useSettings } from '../store/settings'

type ExerciseStats = {
  name: string
  bestWeightKg: number
  bestReps: number
  best1RMKg: number
  totalSets: number
  totalVolumeKg: number
  series: { date: string; weight: number }[]
}

const RANGES = [
  { key: '30d', label: '30J', days: 30 },
  { key: '90d', label: '90J', days: 90 },
  { key: '1y', label: '1A', days: 365 },
  { key: 'all', label: 'TOUT', days: 10000 },
] as const

export function Evolution() {
  const { unit } = useSettings()
  const [weighIns, setWeighIns] = useState<WeighIn[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('90d')

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

  const weightSeries = useMemo(() => {
    const byDate = new Map<string, { date: string; morning: number | null; evening: number | null }>()
    for (const w of weighIns) {
      if (w.date < cutoff) continue
      const row = byDate.get(w.date) ?? { date: w.date, morning: null, evening: null }
      const v = round(fromKg(w.weight, unit), 1)
      if (w.slot === 'evening') row.evening = v
      else row.morning = v // default for legacy entries without slot
      byDate.set(w.date, row)
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, [weighIns, cutoff, unit])

  const lastWeight = useMemo(() => {
    if (weightSeries.length === 0) return null
    const last = weightSeries[weightSeries.length - 1]
    // Prefer evening (latest of the day), else morning
    return last.evening ?? last.morning
  }, [weightSeries])

  const weightDelta = useMemo(() => {
    if (weightSeries.length < 2 || lastWeight === null) return null
    const first = weightSeries.find(r => r.morning !== null || r.evening !== null)
    if (!first) return null
    const firstV = first.morning ?? first.evening
    if (firstV === null) return null
    return round(lastWeight - firstV, 1)
  }, [weightSeries, lastWeight])

  const stats = useMemo(() => computeStats(sessions.filter(s => s.date >= cutoff)), [sessions, cutoff])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="py-8">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-dim)] font-medium">Progression</p>
        <h1 className="font-display text-5xl leading-[1.05] mt-2">Évolution</h1>
      </div>

      <div className="inline-flex rounded-full bg-[color:var(--color-surface-2)] border border-[color:var(--color-border)] p-1 mb-6">
        {RANGES.map(r => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`px-3 h-8 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              range === r.key ? 'bg-[color:var(--color-bg)] text-[color:var(--color-text)]' : 'text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      ) : error ? (
        <Card className="p-5 border-[color:var(--color-danger)]/40">
          <p className="font-medium text-[color:var(--color-danger)] mb-1">Erreur de chargement</p>
          <p className="text-sm text-[color:var(--color-text-dim)] break-words">{error}</p>
        </Card>
      ) : (
        <div className="space-y-10">
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <Label>Poids corporel</Label>
              {weightDelta !== null && (
                <Badge className={weightDelta < 0 ? 'text-[color:var(--color-success)]' : weightDelta > 0 ? 'text-[color:var(--color-accent)]' : ''}>
                  {weightDelta > 0 ? <TrendingUp size={12} /> : weightDelta < 0 ? <TrendingDown size={12} /> : null}
                  {weightDelta > 0 ? '+' : ''}{weightDelta} {unit}
                </Badge>
              )}
            </div>
            {weightSeries.length >= 2 ? (
              <Card className="p-5">
                <div className="flex items-baseline justify-between mb-4">
                  <div className="flex items-baseline gap-3">
                    <p className="font-display text-5xl tabular leading-none">{lastWeight}</p>
                    <p className="text-sm text-[color:var(--color-text-dim)]">{unit}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-[color:var(--color-text-dim)] font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[color:var(--color-accent)]" />
                      Matin
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#a78bfa]" />
                      Soir
                    </span>
                  </div>
                </div>
                <div className="h-52 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weightSeries}>
                      <defs>
                        <linearGradient id="morningGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="eveningGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--color-border)" vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={d => format(parseISO(d), 'd MMM', { locale: fr })}
                        stroke="var(--color-text-dim)"
                        fontSize={11}
                        tickMargin={8}
                      />
                      <YAxis stroke="var(--color-text-dim)" fontSize={11} width={36} domain={['dataMin - 1', 'dataMax + 1']} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 12,
                          fontSize: 12,
                          fontFamily: 'var(--font-mono)',
                        }}
                        labelFormatter={d => format(parseISO(d as string), 'd MMM yyyy', { locale: fr })}
                        formatter={(v, name) => [v !== null && v !== undefined ? `${v} ${unit}` : '—', name]}
                      />
                      <Area
                        type="monotone"
                        dataKey="morning"
                        name="Matin"
                        stroke="var(--color-accent)"
                        strokeWidth={2.5}
                        fill="url(#morningGrad)"
                        connectNulls
                        dot={{ r: 3, fill: 'var(--color-accent)', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="evening"
                        name="Soir"
                        stroke="#a78bfa"
                        strokeWidth={2.5}
                        fill="url(#eveningGrad)"
                        connectNulls
                        dot={{ r: 3, fill: '#a78bfa', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            ) : (
              <EmptyState title="Pas assez de pesées" subtitle="Enregistre au moins 2 pesées pour voir la courbe." />
            )}
          </section>

          <section>
            <div className="flex items-baseline justify-between mb-4">
              <Label>Records par exercice</Label>
              <span className="text-xs text-[color:var(--color-text-dim)]">{stats.length} exercices</span>
            </div>
            {stats.length === 0 ? (
              <EmptyState title="Pas encore d'exercices" subtitle="Ajoute des séries pour voir tes PR et courbes de progression." />
            ) : (
              <div className="space-y-3">
                {stats.map(s => <ExerciseCard key={s.name} stats={s} unit={unit} />)}
              </div>
            )}
          </section>
        </div>
      )}
    </motion.div>
  )
}

function ExerciseCard({ stats, unit }: { stats: ExerciseStats; unit: 'kg' | 'lb' }) {
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-display text-2xl leading-tight">{stats.name}</h3>
        <span className="text-xs text-[color:var(--color-text-dim)]">{stats.totalSets} séries</span>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-dim)] font-medium">PR</p>
          <p className="font-display text-2xl tabular">
            {round(fromKg(stats.bestWeightKg, unit), 1)}<span className="text-xs text-[color:var(--color-text-dim)] ml-1">{unit}</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-dim)] font-medium">1RM ≈</p>
          <p className="font-display text-2xl tabular">
            {round(fromKg(stats.best1RMKg, unit), 0)}<span className="text-xs text-[color:var(--color-text-dim)] ml-1">{unit}</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-dim)] font-medium">Tonnage</p>
          <p className="font-display text-2xl tabular">
            {formatBigNum(fromKg(stats.totalVolumeKg, unit))}<span className="text-xs text-[color:var(--color-text-dim)] ml-1">{unit}</span>
          </p>
        </div>
      </div>
      {stats.series.length >= 2 && (
        <div className="h-20 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.series.map(p => ({ date: p.date, value: round(fromKg(p.weight, unit), 1) }))}>
              <defs>
                <linearGradient id={`g-${stats.name}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                }}
                labelFormatter={d => format(parseISO(d as string), 'd MMM', { locale: fr })}
                formatter={v => [`${v} ${unit}`, 'Max']}
              />
              <Area type="monotone" dataKey="value" stroke="var(--color-accent)" strokeWidth={2} fill={`url(#g-${stats.name})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

function computeStats(sessions: Session[]): ExerciseStats[] {
  const byName = new Map<string, { reps: number; weightKg: number; date: string }[]>()
  for (const s of sessions) {
    for (const ex of s.exercises) {
      const key = ex.name.trim()
      if (!key) continue
      const arr = byName.get(key) ?? []
      for (const set of ex.sets) arr.push({ reps: set.reps, weightKg: Number(set.weight), date: s.date })
      byName.set(key, arr)
    }
  }
  const out: ExerciseStats[] = []
  for (const [name, sets] of byName) {
    if (sets.length === 0) continue
    const bestWeightKg = Math.max(...sets.map(s => s.weightKg))
    const bestReps = Math.max(...sets.map(s => s.reps))
    const best1RMKg = Math.max(...sets.map(s => estimate1RM(s.weightKg, s.reps)))
    const totalVolumeKg = sets.reduce((n, s) => n + s.reps * s.weightKg, 0)
    const byDate = new Map<string, number>()
    for (const s of sets) byDate.set(s.date, Math.max(byDate.get(s.date) ?? 0, s.weightKg))
    const series = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, weight]) => ({ date, weight }))
    out.push({ name, bestWeightKg, bestReps, best1RMKg, totalSets: sets.length, totalVolumeKg, series })
  }
  out.sort((a, b) => b.totalSets - a.totalSets)
  return out
}

function formatBigNum(v: number): string {
  if (v >= 1000) return `${round(v / 1000, 1)}k`
  return String(Math.round(v))
}
