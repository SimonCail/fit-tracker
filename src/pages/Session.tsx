import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Footprints, Plus, Timer, Trash2, Trophy } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AnimatePresence, motion } from 'framer-motion'
import { Button, Card, EmptyState, Input, Label, Spinner, Tooltip, TooltipContent, TooltipTrigger, useConfirm } from '../components/ui'
import {
  addExercise,
  addSet,
  deleteExercise,
  deleteSession,
  deleteSet,
  getDistinctExerciseNames,
  getSession,
  listSessions,
  updateRunningSession,
  updateSession,
  updateSet,
} from '../lib/db'
import type { Exercise, ExerciseSet, Session } from '../lib/types'
import { formatWeight, fromKg, round, toKg } from '../lib/units'
import { normalizeExerciseName, slugifyExerciseName } from '../lib/exerciseName'
import { useSettings } from '../store/settings'
import { RestTimer } from '../components/RestTimer'

export function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const confirm = useConfirm()
  const { unit, restSeconds } = useSettings()
  const [data, setData] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [exerciseNames, setExerciseNames] = useState<string[]>([])
  const [pastPR, setPastPR] = useState<Record<string, number>>({}) // exercise name -> best kg before THIS session
  const [timerOpen, setTimerOpen] = useState(false)
  const [prToast, setPrToast] = useState<{ name: string; weight: number } | null>(null)
  const notesTimer = useRef<number | null>(null)

  async function load() {
    if (!id) return
    const d = await getSession(id)
    setData(d)
    setNotes(d?.notes ?? '')
    setLoading(false)
  }

  // Initial load + build "past PR" map from all sessions except this one.
  useEffect(() => {
    if (!id) return
    ;(async () => {
      const [d, all, names] = await Promise.all([
        getSession(id),
        listSessions(200),
        getDistinctExerciseNames(),
      ])
      setData(d)
      setNotes(d?.notes ?? '')
      setExerciseNames(names)
      const prs: Record<string, number> = {}
      for (const sess of all) {
        if (sess.id === id) continue
        for (const ex of sess.exercises) {
          for (const set of ex.sets) {
            const n = ex.name.trim()
            prs[n] = Math.max(prs[n] ?? 0, Number(set.weight))
          }
        }
      }
      setPastPR(prs)
      setLoading(false)
    })()
  }, [id])

  function onNotesChange(v: string) {
    setNotes(v)
    if (!id) return
    if (notesTimer.current) window.clearTimeout(notesTimer.current)
    notesTimer.current = window.setTimeout(() => {
      updateSession(id, { notes: v || null }).catch(() => {})
    }, 500)
  }

  async function onAddExercise(name: string) {
    if (!id || !name.trim()) return
    await addExercise(id, name.trim())
    await load()
  }

  async function onDeleteSession() {
    if (!id) return
    const ok = await confirm({
      title: 'Supprimer cette séance ?',
      description: 'Cette action est définitive. Tous les exercices et séries seront supprimés.',
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    await deleteSession(id)
    nav('/', { replace: true })
  }

  function onSetAdded(exerciseName: string, weightKg: number) {
    const pr = pastPR[exerciseName.trim()] ?? 0
    if (weightKg > pr) {
      setPastPR(prev => ({ ...prev, [exerciseName.trim()]: weightKg }))
      setPrToast({ name: exerciseName, weight: weightKg })
      window.setTimeout(() => setPrToast(null), 3500)
    }
    // Timer never auto-opens — user triggers it manually via the header button.
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (!data || !id) return <EmptyState title="Séance introuvable" />

  return (
    <div className="py-6">
      <header className="flex items-center gap-2 mb-6">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label="Retour">
              <ArrowLeft size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Retour</TooltipContent>
        </Tooltip>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-text-dim)] font-medium capitalize">
            {format(new Date(data.date), 'EEEE d MMMM', { locale: fr })}
          </p>
        </div>
        {data.type !== 'running' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => setTimerOpen(true)} aria-label="Timer de repos">
                <Timer size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Timer de repos</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onDeleteSession} aria-label="Supprimer la séance">
              <Trash2 size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Supprimer</TooltipContent>
        </Tooltip>
      </header>

      {data.type === 'running' && (
        <div className="inline-flex items-center gap-2 mb-4 px-3 h-7 rounded-full bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] text-[10px] uppercase tracking-widest font-semibold">
          <Footprints size={12} /> Course
        </div>
      )}

      <input
        value={notes}
        onChange={e => onNotesChange(e.target.value)}
        placeholder={data.type === 'running' ? 'Titre (ex: Tour du parc)' : 'Titre de la séance'}
        className="w-full bg-transparent font-display text-4xl sm:text-5xl leading-[1.05] tracking-tight placeholder:text-[color:var(--color-text-dim)]/50 focus:outline-none focus:caret-[color:var(--color-accent)] border-b-2 border-transparent hover:border-[color:var(--color-border)] focus:border-[color:var(--color-accent)]/60 transition-colors pb-1 mb-8 cursor-text"
      />

      {data.type === 'running' ? (
        <RunningSessionView session={data} onChange={load} />
      ) : (
        <>
          <div className="space-y-4">
            {data.exercises.map((ex, i) => (
              <ExerciseCard
                key={ex.id}
                index={i + 1}
                sessionId={id}
                exercise={ex}
                unit={unit}
                previousPR={pastPR[ex.name.trim()] ?? 0}
                onChange={load}
                onSetAdded={onSetAdded}
              />
            ))}
          </div>

          <AddExercise suggestions={exerciseNames} onAdd={onAddExercise} />
        </>
      )}

      <RestTimer open={timerOpen} onClose={() => setTimerOpen(false)} defaultSeconds={restSeconds} />

      <AnimatePresence>
        {prToast && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed top-4 left-0 right-0 z-50 pointer-events-none flex justify-center safe-top"
          >
            <div className="pointer-events-auto rounded-full bg-[color:var(--color-accent)] text-white px-5 py-2.5 flex items-center gap-2 shadow-2xl">
              <Trophy size={16} />
              <span className="text-sm font-medium">
                Nouveau PR sur {prToast.name} — {formatWeight(prToast.weight, unit, 1)}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ExerciseCard({
  index,
  sessionId,
  exercise,
  unit,
  previousPR,
  onChange,
  onSetAdded,
}: {
  index: number
  sessionId: string
  exercise: Exercise
  unit: 'kg' | 'lb'
  previousPR: number
  onChange: () => void
  onSetAdded: (name: string, weightKg: number) => void
}) {
  const confirm = useConfirm()
  const nav = useNavigate()
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')
  const [adding, setAdding] = useState(false)
  const lastSet = exercise.sets[exercise.sets.length - 1]
  const bestKg = exercise.sets.reduce((m, s) => Math.max(m, Number(s.weight)), 0)
  const bestPreview = useMemo(() => {
    // Best = heaviest weight; ties broken by higher reps.
    const best = exercise.sets.reduce<ExerciseSet | null>((m, s) => {
      if (!m) return s
      const sw = Number(s.weight)
      const mw = Number(m.weight)
      if (sw > mw) return s
      if (sw === mw && s.reps > m.reps) return s
      return m
    }, null)
    if (!best) return null
    const volumeKg = exercise.sets.reduce((sum, s) => sum + Number(s.reps) * Number(s.weight), 0)
    return { set: best, volumeKg }
  }, [exercise.sets])

  async function onAddSet(e: React.FormEvent) {
    e.preventDefault()
    if (!reps || !weight || adding) return
    setAdding(true)
    const weightKg = toKg(Number(weight), unit)
    try {
      await addSet(sessionId, exercise.id, Number(reps), weightKg)
      setReps('')
      setWeight('')
      onChange()
      onSetAdded(exercise.name, weightKg)
    } finally {
      setAdding(false)
    }
  }

  function reuseLast() {
    if (!lastSet) return
    setReps(String(lastSet.reps))
    setWeight(String(round(fromKg(Number(lastSet.weight), unit), 1)))
  }

  return (
    <Card className="p-5">
      <header className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[color:var(--color-text-dim)]">#{String(index).padStart(2, '0')}</span>
          {previousPR > 0 && bestKg > previousPR && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-[color:var(--color-accent)] font-semibold">
              <Trophy size={10} /> PR
            </span>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: `Supprimer "${exercise.name}" ?`,
                  description: 'Toutes les séries de cet exercice seront supprimées.',
                  confirmLabel: 'Supprimer',
                  danger: true,
                })
                if (!ok) return
                await deleteExercise(sessionId, exercise.id)
                onChange()
              }}
              className="p-1.5 -m-1.5 rounded-full text-[color:var(--color-text-dim)] hover:text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10 transition-colors cursor-pointer shrink-0"
              aria-label="Supprimer l'exercice"
            >
              <Trash2 size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Supprimer l'exercice</TooltipContent>
        </Tooltip>
      </header>
      <button
        onClick={() => nav(`/exercise/${slugifyExerciseName(exercise.name)}?key=${encodeURIComponent(normalizeExerciseName(exercise.name))}`)}
        className="font-display text-2xl leading-tight text-left hover:text-[color:var(--color-accent)] transition-colors cursor-pointer inline-flex items-center gap-1.5 group"
        title="Voir l'historique de cet exercice"
      >
        {exercise.name}
        <span className="text-xs text-[color:var(--color-text-dim)] opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
      </button>

      {bestPreview && (
        <div className="grid grid-cols-3 gap-2 mt-3 mb-4 text-xs">
          <MiniStat label="Top" value={`${bestPreview.set.reps}×${round(fromKg(Number(bestPreview.set.weight), unit), 1)}`} />
          <MiniStat label="Volume" value={formatVolume(bestPreview.volumeKg, unit)} suffix={unit} />
          <MiniStat label="Séries" value={String(exercise.sets.length)} />
        </div>
      )}

      {exercise.sets.length > 0 && (
        <div className="mt-2">
          <div className="grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2 px-2 pb-1.5 border-b border-[color:var(--color-border)] text-[10px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-medium">
            <span>#</span>
            <span className="text-center">Reps</span>
            <span className="text-center">{unit}</span>
            <span />
          </div>
          <div className="divide-y divide-[color:var(--color-border)]">
            {exercise.sets.map((set, i) => (
              <SetRow
                key={set.id}
                sessionId={sessionId}
                exerciseId={exercise.id}
                index={i + 1}
                set={set}
                unit={unit}
                onChange={onChange}
              />
            ))}
          </div>
        </div>
      )}

      <form onSubmit={onAddSet} className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-medium pointer-events-none">reps</span>
          <Input
            type="number"
            value={reps}
            onChange={e => setReps(e.target.value)}
            min="0"
            inputMode="numeric"
            className="h-11 pl-14 text-right font-display text-lg tabular"
            placeholder="0"
          />
        </div>
        <div className="relative">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-medium pointer-events-none">{unit}</span>
          <Input
            type="number"
            step="0.5"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            min="0"
            inputMode="decimal"
            className="h-11 pr-10 text-right font-display text-lg tabular"
            placeholder="0.0"
          />
        </div>
        <Button type="submit" variant="accent" size="icon" disabled={adding || !reps || !weight} aria-label="Ajouter la série">
          <Plus size={18} />
        </Button>
      </form>
      {lastSet && !reps && !weight && (
        <button
          type="button"
          onClick={reuseLast}
          className="text-xs text-[color:var(--color-text-dim)] hover:text-[color:var(--color-accent)] mt-3 transition-colors cursor-pointer inline-flex items-center gap-1"
        >
          ↻ Reprendre {lastSet.reps} × {formatWeight(Number(lastSet.weight), unit, 1)}
        </button>
      )}
    </Card>
  )
}

function formatVolume(kg: number, unit: 'kg' | 'lb'): string {
  const v = fromKg(kg, unit)
  if (v >= 1000) return `${round(v / 1000, 1)}k`
  return String(Math.round(v))
}

function MiniStat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-xl bg-[color:var(--color-surface-2)]/60 border border-[color:var(--color-border)] px-3 py-2">
      <p className="text-[9px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-medium">{label}</p>
      <p className="font-display tabular text-sm leading-tight mt-0.5">
        {value}
        {suffix && <span className="text-[color:var(--color-text-dim)] text-[10px] ml-0.5">{suffix}</span>}
      </p>
    </div>
  )
}

function SetRow({
  sessionId,
  exerciseId,
  index,
  set,
  unit,
  onChange,
}: {
  sessionId: string
  exerciseId: string
  index: number
  set: ExerciseSet
  unit: 'kg' | 'lb'
  onChange: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [reps, setReps] = useState(String(set.reps))
  const [weight, setWeight] = useState(String(round(fromKg(Number(set.weight), unit), 1)))

  async function save() {
    await updateSet(sessionId, exerciseId, set.id, { reps: Number(reps), weight: toKg(Number(weight), unit) })
    setEditing(false)
    onChange()
  }

  async function remove() {
    await deleteSet(sessionId, exerciseId, set.id)
    onChange()
  }

  if (editing) {
    return (
      <div className="grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2 py-1.5 px-2 bg-[color:var(--color-accent-soft)] rounded-lg -mx-2">
        <span className="text-[10px] font-mono tabular text-[color:var(--color-text-dim)] text-center">{String(index).padStart(2, '0')}</span>
        <Input
          type="number"
          value={reps}
          onChange={e => setReps(e.target.value)}
          className="h-9 text-center font-display text-base tabular px-2"
          inputMode="numeric"
          autoFocus
        />
        <Input
          type="number"
          step="0.5"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          className="h-9 text-center font-display text-base tabular px-2"
          inputMode="decimal"
        />
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={save}
            className="p-1.5 rounded-full bg-[color:var(--color-accent)] text-[color:var(--color-accent-text)] hover:bg-[color:var(--color-accent-hover)] transition-colors cursor-pointer"
            aria-label="Enregistrer"
          >
            <Check size={12} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="group grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2 py-2.5 px-2 hover:bg-[color:var(--color-surface-2)]/60 cursor-pointer transition-colors"
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(true) } }}
    >
      <span className="text-[10px] font-mono tabular text-[color:var(--color-text-dim)] text-center">
        {String(index).padStart(2, '0')}
      </span>
      <span className="font-display text-lg tabular text-center leading-none">{set.reps}</span>
      <span className="font-display text-lg tabular text-center leading-none">
        {round(fromKg(Number(set.weight), unit), 1)}
      </span>
      <div className="flex items-center justify-end">
        <button
          onClick={e => { e.stopPropagation(); remove() }}
          className="p-1.5 rounded-full text-[color:var(--color-text-dim)]/60 hover:text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10 transition-all cursor-pointer"
          aria-label="Supprimer la série"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

function AddExercise({ suggestions, onAdd }: { suggestions: string[]; onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  const [focused, setFocused] = useState(false)
  const filtered = name
    ? suggestions.filter(s => s.toLowerCase().includes(name.toLowerCase()) && s.toLowerCase() !== name.toLowerCase()).slice(0, 6)
    : suggestions.slice(0, 6)

  function submit(v?: string) {
    const finalName = v ?? name
    if (!finalName.trim()) return
    onAdd(finalName)
    setName('')
  }

  return (
    <div className="mt-6 relative">
      <Label className="block mb-2">Ajouter un exercice</Label>
      <form onSubmit={e => { e.preventDefault(); submit() }} className="flex gap-2">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Ex: Développé couché"
        />
        <Button type="submit" variant="accent" disabled={!name.trim()}>
          <Plus size={16} /> Ajouter
        </Button>
      </form>
      {focused && filtered.length > 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-2 rounded-2xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-1 max-h-56 overflow-y-auto shadow-[var(--shadow-soft)]">
          {filtered.map(s => (
            <button
              key={s}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => submit(s)}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-[color:var(--color-surface-2)] text-sm"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}


function RunningSessionView({ session, onChange }: { session: Session; onChange: () => void }) {
  const [distanceKm, setDistanceKm] = useState(session.distanceMeters ? String(Math.round((session.distanceMeters / 1000) * 100) / 100) : '')
  const [durationMin, setDurationMin] = useState(session.durationSeconds ? String(Math.floor(session.durationSeconds / 60)) : '')
  const [durationSec, setDurationSec] = useState(session.durationSeconds ? String(session.durationSeconds % 60).padStart(2, '0') : '')
  const [route, setRoute] = useState(session.route ?? '')
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<number | null>(null)

  const distanceMeters = Number(distanceKm) > 0 ? Math.round(Number(distanceKm) * 1000) : null
  const durationSeconds = (() => {
    const m = Number(durationMin) || 0
    const s = Number(durationSec) || 0
    const total = m * 60 + s
    return total > 0 ? total : null
  })()

  function schedulePersist() {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(async () => {
      setSaving(true)
      try {
        await updateRunningSession(session.id, {
          distanceMeters,
          durationSeconds,
          route: route.trim() || null,
        })
        onChange()
      } finally {
        setSaving(false)
      }
    }, 500)
  }

  useEffect(() => { schedulePersist() /* eslint-disable-next-line */ }, [distanceKm, durationMin, durationSec, route])

  const pace = distanceMeters && durationSeconds
    ? (() => {
        const secPerKm = durationSeconds / (distanceMeters / 1000)
        const mm = Math.floor(secPerKm / 60)
        const ss = Math.round(secPerKm % 60)
        return `${mm}:${String(ss).padStart(2, '0')}`
      })()
    : '—'

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="grid grid-cols-3 gap-2 mb-5">
          <MiniStatRun label="Distance" value={distanceKm || '—'} suffix="km" />
          <MiniStatRun label="Durée" value={durationMin ? `${durationMin}:${(durationSec || '00').padStart(2, '0')}` : '—'} />
          <MiniStatRun label="Allure" value={pace} suffix="/km" />
        </div>

        <div className="space-y-3">
          <div>
            <Label className="block mb-1.5">Distance (km)</Label>
            <Input type="number" step="0.01" min="0" value={distanceKm} onChange={e => setDistanceKm(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <Label className="block mb-1.5">Durée</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input type="number" min="0" max="600" value={durationMin} onChange={e => setDurationMin(e.target.value)} inputMode="numeric" className="pr-10" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-medium pointer-events-none">min</span>
              </div>
              <span className="text-[color:var(--color-text-dim)]">:</span>
              <div className="relative flex-1">
                <Input type="number" min="0" max="59" value={durationSec} onChange={e => setDurationSec(e.target.value)} inputMode="numeric" className="pr-10" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-medium pointer-events-none">sec</span>
              </div>
            </div>
          </div>
          <div>
            <Label className="block mb-1.5">Parcours (optionnel)</Label>
            <Input value={route} onChange={e => setRoute(e.target.value)} placeholder="Tour du parc, Bord de Seine…" />
            <p className="text-[10px] text-[color:var(--color-text-dim)] mt-1.5">Donne un nom à ton parcours pour suivre ton progrès sur le même trajet.</p>
          </div>
          {saving && <p className="text-[10px] text-[color:var(--color-text-dim)]">Enregistrement…</p>}
        </div>
      </Card>
    </div>
  )
}

function MiniStatRun({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-xl bg-[color:var(--color-surface-2)]/60 border border-[color:var(--color-border)] px-3 py-2">
      <p className="text-[9px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-medium">{label}</p>
      <p className="font-display tabular text-lg leading-tight mt-0.5">
        {value}
        {suffix && <span className="text-[color:var(--color-text-dim)] text-[10px] ml-0.5">{suffix}</span>}
      </p>
    </div>
  )
}
