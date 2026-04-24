import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Dumbbell, Footprints, Scale, ChevronRight, Search, Trash2, X, Sunrise, Moon } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion } from 'framer-motion'
import { Card, EmptyState, Input, Label, Skeleton, Badge, useConfirm, Tooltip, TooltipContent, TooltipTrigger } from '../components/ui'
import { deleteWeighIn, listSessions, listWeighIns } from '../lib/db'
import type { Session, WeighIn } from '../lib/types'
import { formatWeight } from '../lib/units'
import { useSettings } from '../store/settings'

type Item =
  | { kind: 'session'; data: Session }
  | { kind: 'weigh'; data: WeighIn }

export function History() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const { unit } = useSettings()
  const confirm = useConfirm()
  const [sessions, setSessions] = useState<Session[]>([])
  const [weighIns, setWeighIns] = useState<WeighIn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const dayFilter = params.get('d')

  async function load() {
    setError(null)
    try {
      const [s, w] = await Promise.all([listSessions(200), listWeighIns(240)])
      setSessions(s)
      setWeighIns(w)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const items = useMemo<Item[]>(() => {
    const all: Item[] = [
      ...sessions.map(s => ({ kind: 'session' as const, data: s })),
      ...weighIns.map(w => ({ kind: 'weigh' as const, data: w })),
    ]
    all.sort((a, b) => {
      if (a.data.date !== b.data.date) return b.data.date.localeCompare(a.data.date)
      return b.data.createdAt - a.data.createdAt
    })
    let filtered = all
    if (dayFilter) filtered = filtered.filter(it => it.data.date === dayFilter)
    if (!query.trim()) return filtered
    const q = query.toLowerCase().trim()
    return filtered.filter(it => {
      if (it.kind === 'session') {
        const s = it.data
        const parts: string[] = []
        parts.push(s.notes ?? '')
        parts.push(s.type === 'running' ? 'course running' : 'muscu musculation')
        parts.push(s.date) // allow searching by ISO date e.g. "2026-04"
        parts.push(format(parseISO(s.date), 'd MMMM yyyy EEEE', { locale: fr }))
        for (const ex of s.exercises) parts.push(ex.name)
        if (s.route) parts.push(s.route)
        if (s.distanceMeters) parts.push(`${Math.round(s.distanceMeters / 100) / 10} km`)
        return parts.join(' ').toLowerCase().includes(q)
      }
      const w = it.data
      const parts: string[] = []
      parts.push(String(w.weight))
      parts.push(`${w.weight} kg`)
      parts.push(w.note ?? '')
      parts.push(w.slot === 'morning' ? 'matin' : w.slot === 'evening' ? 'soir' : '')
      parts.push('pesée poids')
      parts.push(w.date)
      parts.push(format(parseISO(w.date), 'd MMMM yyyy EEEE', { locale: fr }))
      return parts.join(' ').toLowerCase().includes(q)
    })
  }, [sessions, weighIns, query, dayFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const it of items) {
      const k = it.data.date
      const arr = map.get(k) ?? []
      arr.push(it)
      map.set(k, arr)
    }
    return [...map.entries()]
  }, [items])

  async function removeWeigh(id: string) {
    const ok = await confirm({
      title: 'Supprimer cette pesée ?',
      description: 'Cette action est définitive.',
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    await deleteWeighIn(id)
    await load()
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="py-8">
      <div className="mb-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-dim)] font-medium">Journal</p>
        <h1 className="font-display text-5xl leading-[1.05] mt-2">Historique</h1>
      </div>

      <div className="relative mt-8 mb-6">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--color-text-dim)]" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher (exo, parcours, date, pesée…)"
          className="pl-10"
        />
      </div>

      {dayFilter && (
        <div className="mb-6 flex items-center gap-2">
          <Badge className="capitalize">
            {format(parseISO(dayFilter), 'EEEE d MMMM', { locale: fr })}
          </Badge>
          <button
            onClick={() => setParams({})}
            className="text-xs text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] flex items-center gap-1"
          >
            <X size={12} /> Retirer le filtre
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24 mb-3" />
              <Skeleton className="h-16 rounded-2xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <Card className="p-5 border-[color:var(--color-danger)]/40">
          <p className="font-medium text-[color:var(--color-danger)] mb-1">Erreur de chargement</p>
          <p className="text-sm text-[color:var(--color-text-dim)] break-words">{error}</p>
        </Card>
      ) : grouped.length === 0 ? (
        <EmptyState title="Rien ici" subtitle="Lance une séance ou enregistre une pesée — tout apparaîtra ici." />
      ) : (
        <div className="space-y-8">
          {grouped.map(([date, list]) => (
            <div key={date}>
              <div className="flex items-baseline gap-4 mb-3">
                <span className="font-display text-3xl tabular text-[color:var(--color-text)]">
                  {format(parseISO(date), 'dd')}
                </span>
                <div className="flex-1">
                  <Label>{format(parseISO(date), 'MMMM', { locale: fr })}</Label>
                  <p className="text-xs text-[color:var(--color-text-dim)] capitalize">
                    {format(parseISO(date), 'EEEE · yyyy', { locale: fr })}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {list.map(it =>
                  it.kind === 'session' ? (
                    <SessionCard key={`s-${it.data.id}`} session={it.data} unit={unit} onClick={() => nav(`/session/${it.data.id}`)} />
                  ) : (
                    <WeighInCard key={`w-${it.data.id}`} weighIn={it.data} unit={unit} onDelete={() => removeWeigh(it.data.id)} />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

function SessionCard({ session, unit, onClick }: { session: Session; unit: 'kg' | 'lb'; onClick: () => void }) {
  const isRunning = session.type === 'running'

  let subtitle: string
  if (isRunning) {
    const km = (session.distanceMeters ?? 0) / 1000
    const sec = session.durationSeconds ?? 0
    const parts: string[] = []
    if (km > 0) parts.push(`${Math.round(km * 10) / 10} km`)
    if (sec > 0) {
      const mm = Math.floor(sec / 60)
      const ss = sec % 60
      parts.push(mm > 0 ? `${mm}:${String(ss).padStart(2, '0')}` : `${ss}s`)
    }
    if (km > 0 && sec > 0) {
      const pace = sec / km
      parts.push(`${Math.floor(pace / 60)}:${String(Math.round(pace % 60)).padStart(2, '0')}/km`)
    }
    if (session.route) parts.unshift(session.route)
    subtitle = parts.length > 0 ? parts.join(' · ') : 'Course'
  } else {
    const sets = session.exercises.reduce((n, e) => n + e.sets.length, 0)
    const tonnage = session.exercises.reduce((n, e) => n + e.sets.reduce((m, s) => m + s.reps * Number(s.weight), 0), 0)
    subtitle = `${session.exercises.length} exos · ${sets} séries · ${formatWeight(tonnage, unit, 0).replace('.0', '')}`
  }

  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-2xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-4 hover:border-[color:var(--color-border-strong)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] active:translate-y-0 transition-all duration-200 cursor-pointer flex items-center gap-4"
    >
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
        isRunning
          ? 'bg-[#a78bfa]/15 text-[#a78bfa]'
          : 'bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]'
      }`}>
        {isRunning ? <Footprints size={18} /> : <Dumbbell size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{session.notes || (isRunning ? 'Course' : 'Séance')}</p>
        <p className="text-xs text-[color:var(--color-text-dim)] mt-0.5 truncate">
          {subtitle}
        </p>
      </div>
      <ChevronRight size={16} className="text-[color:var(--color-text-dim)] group-hover:translate-x-1 transition-transform" />
    </button>
  )
}

function WeighInCard({ weighIn, unit, onDelete }: { weighIn: WeighIn; unit: 'kg' | 'lb'; onDelete: () => void }) {
  const slotIcon = weighIn.slot === 'morning' ? <Sunrise size={18} /> : weighIn.slot === 'evening' ? <Moon size={18} /> : <Scale size={18} />
  const slotLabel = weighIn.slot === 'morning' ? 'Matin' : weighIn.slot === 'evening' ? 'Soir' : null
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-2xl bg-[color:var(--color-surface-2)] text-[color:var(--color-text)] flex items-center justify-center shrink-0">
        {slotIcon}
      </div>
      <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
        <p className="font-display text-xl tabular">{formatWeight(weighIn.weight, unit, 1)}</p>
        {slotLabel && (
          <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-text-dim)] font-medium">
            {slotLabel}
          </span>
        )}
        {weighIn.note && (
          <p className="text-xs text-[color:var(--color-text-dim)] truncate w-full">{weighIn.note}</p>
        )}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onDelete}
            className="p-2 rounded-full text-[color:var(--color-text-dim)] hover:text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10 transition-colors cursor-pointer"
            aria-label="Supprimer cette pesée"
          >
            <Trash2 size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Supprimer</TooltipContent>
      </Tooltip>
    </Card>
  )
}
