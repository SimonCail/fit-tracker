import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, EmptyState, SectionTitle, Skeleton, Tag } from '../components/ui'
import { PageHeader } from '../components/Layout'
import { listSessions } from '../lib/db'
import type { ExerciseSet, Session } from '../lib/types'
import { normalizeExerciseName } from '../lib/exerciseName'
import { estimate1RM, frNum, fromKg, round } from '../lib/units'
import { setMaxWeightKg, setTotalReps, setVolumeKg } from '../lib/setMath'
import { useSettings } from '../store/settings'
import { cn } from '../lib/cn'

type HistorySet = ExerciseSet & { sessionId: string; date: string }

export function ExerciseHistoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { unit } = useSettings()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listSessions(500).then(setSessions).finally(() => setLoading(false))
  }, [])

  const normKey = params.get('key') || slug || ''

  const { displayName, allSets, byDate, record, best1RM, volumeTotal, bodyweight } = useMemo(() => {
    const sets: HistorySet[] = []
    const nameCounts = new Map<string, number>()
    let bodyweight = false
    for (const s of sessions) {
      for (const ex of s.exercises) {
        if (normalizeExerciseName(ex.name) !== normKey) continue
        nameCounts.set(ex.name, (nameCounts.get(ex.name) ?? 0) + 1)
        if (ex.bodyweight) bodyweight = true
        for (const set of ex.sets) sets.push({ ...set, sessionId: s.id, date: s.date })
      }
    }
    sets.sort((a, b) => a.date.localeCompare(b.date))
    let displayName = normKey
    let top = 0
    for (const [n, c] of nameCounts) if (c > top) { displayName = n; top = c }
    const byDateMap = new Map<string, { date: string; max: number; volume: number }>()
    for (const s of sets) {
      const row = byDateMap.get(s.date) ?? { date: s.date, max: 0, volume: 0 }
      row.max = Math.max(row.max, setMaxWeightKg(s))
      row.volume += setVolumeKg(s)
      byDateMap.set(s.date, row)
    }
    const byDate = [...byDateMap.values()].sort((a, b) => a.date.localeCompare(b.date))
    const record = sets.reduce((m, s) => Math.max(m, setMaxWeightKg(s)), 0)
    // Estimated 1RM — only meaningful for loaded movements in a sane rep range.
    const best1RM = bodyweight
      ? 0
      : sets.reduce((m, s) => (s.reps > 0 && s.reps <= 12 ? Math.max(m, estimate1RM(Number(s.weight), s.reps)) : m), 0)
    const volumeTotal = sets.reduce((v, s) => v + setVolumeKg(s), 0)
    return { displayName, allSets: sets, byDate, record, best1RM, volumeTotal, bodyweight }
  }, [sessions, normKey])

  const chartData = useMemo(() => byDate.map(d => ({ date: d.date, value: round(fromKg(d.max, unit), 1) })), [byDate, unit])

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
      <>
        <PageHeader back kicker="Exercice" />
        <Skeleton className="h-10 w-2/3 mb-6" />
        <Skeleton className="h-24 mb-4 rounded-[var(--radius-card)]" />
        <Skeleton className="h-56 rounded-[var(--radius-card)]" />
      </>
    )
  }

  if (allSets.length === 0) {
    return (
      <>
        <PageHeader back kicker="Exercice" title={displayName} />
        <EmptyState title="Aucune série notée" subtitle="Ajoute cet exercice dans une séance et note une série : sa progression s’affichera ici." />
      </>
    )
  }

  const recordValue = record > 0 ? frNum(fromKg(record, unit), 1) : null
  const totalReps = allSets.reduce((n, s) => n + setTotalReps(s), 0)
  const vol = fromKg(volumeTotal, unit)

  return (
    <>
      <PageHeader back kicker={bodyweight ? 'Exercice au poids du corps' : 'Exercice'} title={displayName} />

      <Card className="grid grid-cols-3 py-4">
        <Stat label={bodyweight ? 'Lest max' : 'Record'} value={recordValue ? `${bodyweight ? '+' : ''}${recordValue}` : '–'} unit={recordValue ? unit : undefined} tone="pr" />
        {best1RM > 0 ? (
          <Stat label="1RM estimé" value={frNum(fromKg(best1RM, unit), 0)} unit={unit} />
        ) : (
          <Stat label="Répétitions" value={String(totalReps)} />
        )}
        {bodyweight ? (
          <Stat label="Séries" value={String(allSets.length)} />
        ) : (
          <Stat label="Volume total" value={vol >= 1000 ? frNum(vol / 1000, 1) : String(Math.round(vol))} unit={vol >= 1000 ? (unit === 'kg' ? 't' : 'k lb') : unit} />
        )}
      </Card>
      {best1RM > 0 && (
        <p className="text-[12px] text-faint mt-2 px-1">1RM estimé avec la formule de Brzycki, à partir de ta meilleure série de 12 reps ou moins.</p>
      )}

      {chartData.length >= 2 && (
        <section className="mt-8">
          <SectionTitle>Charge max par séance</SectionTitle>
          <Card className="p-4 sm:p-5">
            <div className="h-48 sm:h-56 -ml-2 -mr-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="liftFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-lift)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--color-lift)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={d => format(parseISO(d), 'd MMM', { locale: fr })} minTickGap={24} tickMargin={8} stroke="var(--color-faint)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis width={34} domain={['dataMin - 2', 'dataMax + 2']} tickFormatter={v => frNum(Number(v), 0)} stroke="var(--color-faint)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-surface-2)', border: 'none', borderRadius: 12, fontSize: 13, color: 'var(--color-ink)' }}
                    cursor={{ stroke: 'var(--color-line-strong)' }}
                    labelFormatter={d => format(parseISO(d as string), 'EEEE d MMMM', { locale: fr })}
                    formatter={v => [`${frNum(Number(v), 1)} ${unit}`, 'Charge max']}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-lift)"
                    strokeWidth={2.5}
                    fill="url(#liftFill)"
                    dot={(p: { cx?: number; cy?: number; payload?: { value: number }; index?: number }) => {
                      const isRecord = recordValue !== null && p.payload && p.payload.value === round(fromKg(record, unit), 1)
                      return (
                        <circle
                          key={p.index}
                          cx={p.cx}
                          cy={p.cy}
                          r={isRecord ? 5 : 0}
                          fill="var(--color-pr)"
                          stroke="var(--color-surface)"
                          strokeWidth={2}
                        />
                      )
                    }}
                    activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--color-lift)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[12px] text-dim mt-2 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-pr" /> Record</p>
          </Card>
        </section>
      )}

      <section className="mt-8">
        <SectionTitle>Toutes les séances</SectionTitle>
        <div className="grid gap-3 lg:grid-cols-2 items-start">
          {setsByDateDesc.map(([date, sets]) => {
            const dayMax = sets.reduce((m, s) => Math.max(m, setMaxWeightKg(s)), 0)
            const hasRecord = record > 0 && dayMax === record
            return (
              <Card key={date} className="overflow-hidden">
                <button
                  onClick={() => nav(`/session/${sets[0].sessionId}`)}
                  className="w-full flex items-center gap-2 px-4 pt-3.5 pb-2 text-left cursor-pointer"
                >
                  <span className="font-semibold first-letter:uppercase">{format(parseISO(date), 'EEEE d MMMM yyyy', { locale: fr })}</span>
                  {hasRecord && <Tag tone="pr">Record</Tag>}
                  <ChevronRight size={18} className="text-faint ml-auto" />
                </button>
                <div className="flex flex-wrap gap-1.5 px-4 pb-4">
                  {sets.map(s => {
                    const top = record > 0 && setMaxWeightKg(s) === record
                    return (
                      <span
                        key={s.id}
                        className={cn(
                          'rounded-[10px] px-2.5 h-9 flex items-center gap-1 num text-[18px]',
                          top ? 'bg-pr/15 text-pr' : 'bg-surface-2',
                        )}
                      >
                        {s.reps}×{bodyweight && Number(s.weight) <= 0 ? 'PDC' : `${bodyweight ? '+' : ''}${frNum(fromKg(Number(s.weight), unit), 1)}`}
                        {s.drops?.map(d => (
                          <span key={d.id} className="text-dim">
                            {' → '}{d.reps}×{bodyweight && Number(d.weight) <= 0 ? 'PDC' : frNum(fromKg(Number(d.weight), unit), 1)}
                          </span>
                        ))}
                      </span>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      </section>
    </>
  )
}

function Stat({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: 'pr' }) {
  return (
    <div className="text-center px-1">
      <p className="flex items-baseline justify-center gap-0.5">
        <span className={cn('num text-[32px]', tone === 'pr' && 'text-pr')}>{value}</span>
        {unit && <span className="text-[12px] font-semibold text-dim">{unit}</span>}
      </p>
      <p className="text-[12px] text-faint mt-1">{label}</p>
    </div>
  )
}