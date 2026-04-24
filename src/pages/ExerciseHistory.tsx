import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Flame, TrendingUp } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion } from 'framer-motion'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts'
import { Button, Card, EmptyState, Skeleton } from '../components/ui'
import { listSessions } from '../lib/db'
import type { ExerciseSet, Session } from '../lib/types'
import { normalizeExerciseName } from '../lib/exerciseName'
import { fromKg, round } from '../lib/units'
import { useSettings } from '../store/settings'

type HistorySet = ExerciseSet & { sessionId: string; date: string }

export function ExerciseHistoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { unit } = useSettings()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const all = await listSessions(500)
        setSessions(all)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const normKey = params.get('key') || slug || ''

  const { displayName, allSets, byDate, record, volumeTotal } = useMemo(() => {
    const sets: HistorySet[] = []
    const nameCounts = new Map<string, number>()
    for (const s of sessions) {
      for (const ex of s.exercises) {
        if (normalizeExerciseName(ex.name) !== normKey) continue
        nameCounts.set(ex.name, (nameCounts.get(ex.name) ?? 0) + 1)
        for (const set of ex.sets) {
          sets.push({ ...set, sessionId: s.id, date: s.date })
        }
      }
    }
    // Sort chronologically
    sets.sort((a, b) => a.date.localeCompare(b.date))
    // Display name = most frequent spelling
    let displayName = normKey
    let best = 0
    for (const [n, c] of nameCounts) if (c > best) { displayName = n; best = c }
    // Daily max for chart
    const byDateMap = new Map<string, { date: string; max: number; volume: number }>()
    for (const s of sets) {
      const row = byDateMap.get(s.date) ?? { date: s.date, max: 0, volume: 0 }
      const wKg = Number(s.weight)
      if (wKg > row.max) row.max = wKg
      row.volume += s.reps * wKg
      byDateMap.set(s.date, row)
    }
    const byDate = [...byDateMap.values()].sort((a, b) => a.date.localeCompare(b.date))
    const record = sets.reduce((m, s) => Math.max(m, Number(s.weight)), 0)
    const volumeTotal = sets.reduce((v, s) => v + s.reps * Number(s.weight), 0)
    return { displayName, allSets: sets, byDate, record, volumeTotal }
  }, [sessions, normKey])

  const chartData = useMemo(() => {
    return byDate.map(d => ({ date: d.date, value: round(fromKg(d.max, unit), 1) }))
  }, [byDate, unit])

  const setsByDateDesc = useMemo(() => {
    const map = new Map<string, HistorySet[]>()
    for (const s of allSets) {
      const arr = map.get(s.date) ?? []
      arr.push(s)
      map.set(s.date, arr)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [allSets])

  if (loading) {
    return (
      <div className="py-6">
        <Skeleton className="h-10 w-40 mb-4" />
        <Skeleton className="h-24 mb-4 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    )
  }

  if (allSets.length === 0) {
    return (
      <div className="py-6">
        <header className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label="Retour">
            <ArrowLeft size={18} />
          </Button>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-text-dim)] font-medium">Exercice</p>
        </header>
        <EmptyState title="Pas encore de série" subtitle="Cet exercice n'a pas encore de données." />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="py-6"
    >
      <header className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label="Retour">
          <ArrowLeft size={18} />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-text-dim)] font-medium">Exercice</p>
          <h1 className="font-display text-2xl tracking-tight truncate">{displayName}</h1>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <StatCell label="Record" value={round(fromKg(record, unit), 1).toString()} suffix={unit} icon={<TrendingUp size={12} />} />
        <StatCell label="Séries" value={String(allSets.length)} />
        <StatCell label="Volume" value={formatBigNum(fromKg(volumeTotal, unit))} suffix={unit} icon={<Flame size={12} />} />
      </div>

      {chartData.length >= 2 && (
        <Card className="p-4 mb-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-dim)] font-medium mb-2">
            Progression — poids max par jour
          </p>
          <div className="h-44 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="exercise-chart-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={d => format(parseISO(d), 'd MMM', { locale: fr })} stroke="var(--color-text-dim)" fontSize={11} tickMargin={8} />
                <YAxis stroke="var(--color-text-dim)" fontSize={11} width={32} domain={['dataMin - 2', 'dataMax + 2']} />
                <RechartsTooltip
                  contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, fontSize: 12, fontFamily: 'var(--font-mono)' }}
                  labelFormatter={d => format(parseISO(d as string), 'd MMM yyyy', { locale: fr })}
                  formatter={v => [`${v} ${unit}`, 'Max']}
                />
                <Area type="monotone" dataKey="value" stroke="var(--color-accent)" strokeWidth={2.5} fill="url(#exercise-chart-grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-dim)] font-medium mb-3 px-1">
        Toutes les séries
      </p>
      <div className="space-y-3">
        {setsByDateDesc.map(([date, sets]) => (
          <Card key={date} className="p-4">
            <button
              onClick={() => nav(`/session/${sets[0].sessionId}`)}
              className="text-[10px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-medium mb-2 hover:text-[color:var(--color-accent)] transition-colors cursor-pointer capitalize"
            >
              {format(parseISO(date), 'EEEE d MMMM yyyy', { locale: fr })} → ouvrir la séance
            </button>
            <div className="space-y-1">
              {sets.map((s, i) => (
                <div key={s.id} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-2 py-1 text-sm">
                  <span className="text-[10px] font-mono tabular text-[color:var(--color-text-dim)] text-center">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-display tabular text-center">{s.reps}</span>
                  <span className="font-display tabular text-center">
                    {round(fromKg(Number(s.weight), unit), 1)}<span className="text-[10px] text-[color:var(--color-text-dim)] ml-1">{unit}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </motion.div>
  )
}

function StatCell({ label, value, suffix, icon }: { label: string; value: string; suffix?: string; icon?: React.ReactNode }) {
  return (
    <Card className="p-3">
      <p className="text-[9px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-medium flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="font-display tabular text-lg leading-tight mt-0.5">
        {value}
        {suffix && <span className="text-[color:var(--color-text-dim)] text-[10px] ml-0.5">{suffix}</span>}
      </p>
    </Card>
  )
}

function formatBigNum(v: number): string {
  if (v >= 1000) return `${Math.round((v / 1000) * 10) / 10}k`
  return String(Math.round(v))
}
