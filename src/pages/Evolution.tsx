import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion } from 'framer-motion'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Footprints, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, EmptyState, Label, Skeleton } from '../components/ui'
import { listSessions, listWeighIns } from '../lib/db'
import type { Session, WeighIn } from '../lib/types'
import { fromKg, round } from '../lib/units'
import { useSettings } from '../store/settings'

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

  const slotDeltas = useMemo(() => {
    // Separate deltas for morning and evening so we only compare like-with-like.
    function deltaFor(slot: 'morning' | 'evening'): number | null {
      const filtered = weighIns
        .filter(w => w.date >= cutoff && (w.slot ?? 'morning') === slot)
        .sort((a, b) => a.date.localeCompare(b.date))
      if (filtered.length < 2) return null
      const first = round(fromKg(filtered[0].weight, unit), 1)
      const last = round(fromKg(filtered[filtered.length - 1].weight, unit), 1)
      return round(last - first, 1)
    }
    return { morning: deltaFor('morning'), evening: deltaFor('evening') }
  }, [weighIns, cutoff, unit])


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
            <div className="flex items-baseline justify-between gap-2 mb-4 flex-wrap">
              <Label>Poids corporel</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {slotDeltas.morning !== null && (
                  <DeltaBadge label="Matin" value={slotDeltas.morning} unit={unit} dotColor="var(--color-accent)" />
                )}
                {slotDeltas.evening !== null && (
                  <DeltaBadge label="Soir" value={slotDeltas.evening} unit={unit} dotColor="#a78bfa" />
                )}
              </div>
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

          <RunningSection sessions={sessions} cutoff={cutoff} />
        </div>
      )}
    </motion.div>
  )
}

function DeltaBadge({ label, value, unit, dotColor }: { label: string; value: number; unit: 'kg' | 'lb'; dotColor: string }) {
  const color = value < 0 ? 'var(--color-success)' : value > 0 ? 'var(--color-accent)' : 'var(--color-text-dim)'
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-2.5 py-0.5 text-xs font-medium"
      style={{ color }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
      <span className="text-[10px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-medium">{label}</span>
      {value > 0 ? <TrendingUp size={11} /> : value < 0 ? <TrendingDown size={11} /> : null}
      <span className="tabular">{value > 0 ? '+' : ''}{value} {unit}</span>
    </span>
  )
}

function RunningSection({ sessions, cutoff }: { sessions: Session[]; cutoff: string }) {
  const runs = useMemo(() => {
    return sessions
      .filter(s => s.type === 'running' && s.date >= cutoff)
      .filter(s => (s.distanceMeters ?? 0) > 0 || (s.durationSeconds ?? 0) > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [sessions, cutoff])

  const stats = useMemo(() => {
    let bestPaceSec: number | null = null
    let longestKm = 0
    let longestSec = 0
    for (const r of runs) {
      const km = (r.distanceMeters ?? 0) / 1000
      const sec = r.durationSeconds ?? 0
      if (km > longestKm) longestKm = km
      if (sec > longestSec) longestSec = sec
      if (km > 0 && sec > 0) {
        const pace = sec / km
        if (bestPaceSec === null || pace < bestPaceSec) bestPaceSec = pace
      }
    }
    const bestPaceStr = bestPaceSec !== null
      ? `${Math.floor(bestPaceSec / 60)}:${String(Math.round(bestPaceSec % 60)).padStart(2, '0')}`
      : '—'
    return { bestPaceStr, longestKm, longestSec, totalRuns: runs.length }
  }, [runs])

  const chartData = useMemo(() => {
    return runs
      .filter(r => (r.distanceMeters ?? 0) > 0 && (r.durationSeconds ?? 0) > 0)
      .map(r => {
        const km = (r.distanceMeters ?? 0) / 1000
        const paceSec = (r.durationSeconds ?? 0) / km
        return {
          date: r.date,
          pace: Math.round((paceSec / 60) * 100) / 100, // minutes/km decimal (for chart)
          km: Math.round(km * 100) / 100,
        }
      })
  }, [runs])

  const byRoute = useMemo(() => {
    const map = new Map<string, { name: string; runs: number; totalKm: number; bestPaceSec: number | null }>()
    for (const r of runs) {
      const name = r.route?.trim()
      if (!name) continue
      const entry = map.get(name) ?? { name, runs: 0, totalKm: 0, bestPaceSec: null }
      entry.runs += 1
      entry.totalKm += (r.distanceMeters ?? 0) / 1000
      const km = (r.distanceMeters ?? 0) / 1000
      if (km > 0 && (r.durationSeconds ?? 0) > 0) {
        const paceSec = (r.durationSeconds ?? 0) / km
        if (entry.bestPaceSec === null || paceSec < entry.bestPaceSec) entry.bestPaceSec = paceSec
      }
      map.set(name, entry)
    }
    return [...map.values()].sort((a, b) => b.runs - a.runs)
  }, [runs])

  if (runs.length === 0) return null

  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <Label className="flex items-center gap-1.5"><Footprints size={12} /> Course</Label>
        <span className="text-xs text-[color:var(--color-text-dim)]">{stats.totalRuns} sortie{stats.totalRuns > 1 ? 's' : ''}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <RunStat label="Record allure" value={stats.bestPaceStr} suffix="/km" />
        <RunStat label="Plus long" value={formatHMS(stats.longestSec)} />
        <RunStat label="Plus loin" value={`${Math.round(stats.longestKm * 10) / 10}`} suffix="km" />
      </div>

      {chartData.length >= 2 && (
        <Card className="p-4 mb-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-dim)] font-medium mb-2">
            Allure · min/km (plus bas = mieux)
          </p>
          <div className="h-40 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="pace-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={d => format(parseISO(d), 'd MMM', { locale: fr })} stroke="var(--color-text-dim)" fontSize={11} tickMargin={8} />
                <YAxis stroke="var(--color-text-dim)" fontSize={11} width={32} domain={['dataMin - 0.3', 'dataMax + 0.3']} reversed />
                <Tooltip
                  contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, fontSize: 12, fontFamily: 'var(--font-mono)' }}
                  labelFormatter={d => format(parseISO(d as string), 'd MMM yyyy', { locale: fr })}
                  formatter={(v, _n, item) => {
                    const n = Number(v)
                    const mm = Math.floor(n)
                    const ss = Math.round((n - mm) * 60)
                    const km = (item.payload as { km?: number })?.km
                    return [`${mm}:${String(ss).padStart(2, '0')} min/km${km ? ` · ${km}km` : ''}`, 'Allure']
                  }}
                />
                <Area type="monotone" dataKey="pace" stroke="#a78bfa" strokeWidth={2.5} fill="url(#pace-grad)" dot={{ r: 3, fill: '#a78bfa' }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {byRoute.length > 0 && (
        <Card className="p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-dim)] font-medium mb-3">
            Parcours
          </p>
          <div className="space-y-2">
            {byRoute.map(r => (
              <div key={r.name} className="flex items-center justify-between py-1.5 border-b border-[color:var(--color-border)] last:border-b-0">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{r.name}</p>
                  <p className="text-[11px] text-[color:var(--color-text-dim)]">
                    {r.runs} sortie{r.runs > 1 ? 's' : ''} · {Math.round(r.totalKm * 10) / 10} km cumulés
                  </p>
                </div>
                {r.bestPaceSec !== null && (
                  <div className="text-right shrink-0">
                    <p className="text-[9px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-medium">Record allure</p>
                    <p className="font-mono tabular text-sm font-semibold">
                      {Math.floor(r.bestPaceSec / 60)}:{String(Math.round(r.bestPaceSec % 60)).padStart(2, '0')}
                      <span className="text-[10px] text-[color:var(--color-text-dim)] ml-0.5">/km</span>
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </section>
  )
}

function RunStat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <Card className="p-3">
      <p className="text-[9px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-medium">{label}</p>
      <p className="font-display tabular text-lg leading-tight mt-0.5">
        {value}
        {suffix && <span className="text-[color:var(--color-text-dim)] text-[10px] ml-0.5">{suffix}</span>}
      </p>
    </Card>
  )
}

function formatHMS(totalSec: number): string {
  if (totalSec <= 0) return '—'
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`
  return `${m} min`
}

