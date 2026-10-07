import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Moon, Search, Sunrise, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Card, Disc, EmptyState, ErrorNote, Input, Skeleton, useConfirm } from '../components/ui'
import { PageHeader } from '../components/Layout'
import { deleteWeighIn, listSessions, listWeighIns } from '../lib/db'
import type { Session, WeighIn } from '../lib/types'
import { frNum, fromKg } from '../lib/units'
import { setTotalReps, setVolumeKg } from '../lib/setMath'
import { useSettings } from '../store/settings'
import { cn } from '../lib/cn'

type Item =
  | { kind: 'session'; data: Session }
  | { kind: 'weigh'; data: WeighIn }

type Filter = 'all' | 'strength' | 'running' | 'weigh'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tout' },
  { value: 'strength', label: 'Muscu' },
  { value: 'running', label: 'Course' },
  { value: 'weigh', label: 'Pesées' },
]

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
  const [filter, setFilter] = useState<Filter>('all')
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
    let out = all
    if (dayFilter) out = out.filter(it => it.data.date === dayFilter)
    if (filter === 'weigh') out = out.filter(it => it.kind === 'weigh')
    if (filter === 'strength') out = out.filter(it => it.kind === 'session' && it.data.type !== 'running')
    if (filter === 'running') out = out.filter(it => it.kind === 'session' && it.data.type === 'running')
    const q = query.toLowerCase().trim()
    if (!q) return out
    return out.filter(it => {
      const parts: string[] = [it.data.date, format(parseISO(it.data.date), 'd MMMM yyyy EEEE', { locale: fr })]
      if (it.kind === 'session') {
        const s = it.data
        parts.push(s.notes ?? '', s.type === 'running' ? 'course running' : 'muscu musculation')
        for (const ex of s.exercises) parts.push(ex.name)
        if (s.route) parts.push(s.route)
        if (s.distanceMeters) parts.push(`${Math.round(s.distanceMeters / 100) / 10} km`)
      } else {
        const w = it.data
        parts.push(String(w.weight), `${w.weight} kg`, w.note ?? '', w.slot === 'morning' ? 'matin' : w.slot === 'evening' ? 'soir' : '', 'pesée poids')
      }
      return parts.join(' ').toLowerCase().includes(q)
    })
  }, [sessions, weighIns, query, dayFilter, filter])

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const it of items) {
      const arr = map.get(it.data.date) ?? []
      arr.push(it)
      map.set(it.data.date, arr)
    }
    return [...map.entries()]
  }, [items])

  async function removeWeigh(id: string) {
    const ok = await confirm({ title: 'Supprimer cette pesée ?', confirmLabel: 'Supprimer', danger: true })
    if (!ok) return
    await deleteWeighIn(id)
    await load()
  }

  const userBwKg = weighIns[0]?.weight ?? 0

  return (
    <>
      <PageHeader title="Journal" />

      <div className="relative lg:max-w-xl">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Exercice, parcours, date…"
          className="pl-11 pr-11"
          type="search"
          enterKeyHint="search"
          aria-label="Rechercher dans le journal"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 grid place-items-center text-faint cursor-pointer" aria-label="Effacer la recherche">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar -mx-4 px-4">
        {dayFilter && (
          <button
            onClick={() => setParams({})}
            className="h-9 shrink-0 rounded-full bg-ink text-bg pl-3.5 pr-2.5 text-[14px] font-semibold flex items-center gap-1.5 cursor-pointer"
            aria-label="Retirer le filtre de date"
          >
            <span className="first-letter:uppercase">{format(parseISO(dayFilter), 'EEEE d MMM', { locale: fr })}</span>
            <X size={16} />
          </button>
        )}
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={cn(
              'h-9 shrink-0 rounded-full px-4 text-[14px] font-semibold cursor-pointer transition-colors',
              filter === f.value ? 'bg-surface text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink)]' : 'bg-surface text-dim',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-6">
            {[0, 1, 2].map(i => (
              <div key={i}>
                <Skeleton className="h-5 w-40 mb-3" />
                <Skeleton className="h-[72px] rounded-[var(--radius-card)]" />
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorNote message={error} />
        ) : grouped.length === 0 ? (
          <EmptyState
            title={query || filter !== 'all' || dayFilter ? 'Aucun résultat' : 'Rien pour l’instant'}
            subtitle={
              query || filter !== 'all' || dayFilter
                ? 'Essaie un autre mot ou retire un filtre.'
                : 'Chaque séance et chaque pesée que tu notes s’ajoute ici, jour par jour.'
            }
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3 lg:gap-x-8 items-start">
            {grouped.map(([date, list]) => (
              <section key={date} aria-label={format(parseISO(date), 'EEEE d MMMM yyyy', { locale: fr })}>
                <h2 className="sticky top-0 sm:top-16 lg:static z-10 -mx-4 px-4 lg:mx-0 lg:px-0 py-2 bar lg:bg-transparent lg:backdrop-blur-none flex items-baseline gap-2 safe-top sm:pt-2">
                  <span className="num text-[24px]">{format(parseISO(date), 'd')}</span>
                  <span className="t-heading text-[15px] first-letter:uppercase">{format(parseISO(date), 'EEEE', { locale: fr })}</span>
                  <span className="text-[14px] text-faint">{format(parseISO(date), 'MMMM yyyy', { locale: fr })}</span>
                </h2>
                <Card className="overflow-hidden mt-1">
                  {list.map(it =>
                    it.kind === 'session' ? (
                      <SessionItem key={`s-${it.data.id}`} session={it.data} unit={unit} userBwKg={userBwKg} onClick={() => nav(`/session/${it.data.id}`)} />
                    ) : (
                      <WeighItem key={`w-${it.data.id}`} weighIn={it.data} unit={unit} onDelete={() => removeWeigh(it.data.id)} />
                    ),
                  )}
                </Card>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function SessionItem({ session, unit, userBwKg, onClick }: { session: Session; unit: 'kg' | 'lb'; userBwKg: number; onClick: () => void }) {
  const running = session.type === 'running'
  let figure: string | null = null
  let figureUnit = ''
  let sub: string

  if (running) {
    const km = (session.distanceMeters ?? 0) / 1000
    const sec = session.durationSeconds ?? 0
    if (km > 0) { figure = frNum(km, 1); figureUnit = 'km' }
    const bits: string[] = []
    if (session.route) bits.push(session.route)
    if (sec > 0) bits.push(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`)
    if (km > 0 && sec > 0) {
      const p = Math.round(sec / km)
      bits.push(`${Math.floor(p / 60)}:${String(p % 60).padStart(2, '0')} /km`)
    }
    sub = bits.join(', ') || 'Course'
  } else {
    const sets = session.exercises.reduce((n, e) => n + e.sets.length, 0)
    const tonnage = session.exercises.reduce((n, e) => {
      const eff = e.bodyweight ? userBwKg : 0
      return n + e.sets.reduce((m, s) => m + setVolumeKg(s) + setTotalReps(s) * eff, 0)
    }, 0)
    const t = fromKg(tonnage, unit)
    if (t > 0) {
      figure = t >= 1000 ? frNum(t / 1000, 1) : String(Math.round(t))
      figureUnit = t >= 1000 ? (unit === 'kg' ? 't' : 'k lb') : unit
    }
    sub = session.exercises.length
      ? `${session.exercises.length} exercice${session.exercises.length > 1 ? 's' : ''}, ${sets} série${sets > 1 ? 's' : ''}`
      : 'Séance vide'
  }

  return (
    <button onClick={onClick} className="w-full text-left flex items-center gap-3.5 px-4 py-3.5 hairline-b last:shadow-none cursor-pointer active:bg-surface-2 hover:bg-surface-2/60">
      <Disc plate={running ? 'run' : 'lift'} size={22} />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold truncate">{session.notes || (running ? 'Course' : 'Séance')}</span>
        <span className="block text-[13px] text-dim truncate">{sub}</span>
      </span>
      {figure && (
        <span className="shrink-0 flex items-baseline gap-0.5">
          <span className="num text-[22px]">{figure}</span>
          <span className="text-[12px] font-semibold text-dim">{figureUnit}</span>
        </span>
      )}
      <ChevronRight size={18} className="text-faint shrink-0 -mr-1" />
    </button>
  )
}

function WeighItem({ weighIn, unit, onDelete }: { weighIn: WeighIn; unit: 'kg' | 'lb'; onDelete: () => void }) {
  const label = weighIn.slot === 'evening' ? 'Pesée du soir' : weighIn.slot === 'morning' ? 'Pesée du matin' : 'Pesée'
  return (
    <div className="flex items-center gap-3.5 pl-4 pr-2 py-2.5 hairline-b last:shadow-none">
      <span className="w-[22px] grid place-items-center text-weigh">
        {weighIn.slot === 'evening' ? <Moon size={18} /> : <Sunrise size={18} />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold">{label}</span>
        {weighIn.note && <span className="block text-[13px] text-dim truncate">{weighIn.note}</span>}
      </span>
      <span className="shrink-0 flex items-baseline gap-0.5">
        <span className="num text-[22px]">{frNum(fromKg(weighIn.weight, unit), 1)}</span>
        <span className="text-[12px] font-semibold text-dim">{unit}</span>
      </span>
      <button onClick={onDelete} className="h-10 w-10 grid place-items-center rounded-full text-faint hover:text-danger cursor-pointer" aria-label="Supprimer cette pesée">
        <X size={17} />
      </button>
    </div>
  )
}