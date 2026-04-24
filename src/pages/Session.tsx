import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Plus, Timer, Trash2, Trophy } from 'lucide-react'
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
  updateSession,
  updateSet,
} from '../lib/db'
import type { Exercise, ExerciseSet, Session } from '../lib/types'
import { estimate1RM, formatWeight, fromKg, round, toKg } from '../lib/units'
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => setTimerOpen(true)} aria-label="Timer de repos">
              <Timer size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Timer de repos</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onDeleteSession} aria-label="Supprimer la séance">
              <Trash2 size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Supprimer</TooltipContent>
        </Tooltip>
      </header>

      <input
        value={notes}
        onChange={e => onNotesChange(e.target.value)}
        placeholder="Titre de la séance"
        className="w-full bg-transparent font-display text-4xl sm:text-5xl leading-[1.05] tracking-tight placeholder:text-[color:var(--color-text-dim)]/50 focus:outline-none focus:caret-[color:var(--color-accent)] border-b-2 border-transparent hover:border-[color:var(--color-border)] focus:border-[color:var(--color-accent)]/60 transition-colors pb-1 mb-8 cursor-text"
      />

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
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')
  const [adding, setAdding] = useState(false)
  const lastSet = exercise.sets[exercise.sets.length - 1]
  const bestKg = exercise.sets.reduce((m, s) => Math.max(m, Number(s.weight)), 0)
  const bestPreview = useMemo(() => {
    const best = exercise.sets.reduce<ExerciseSet | null>((m, s) => (!m || Number(s.weight) > Number(m.weight) ? s : m), null)
    if (!best) return null
    return { set: best, oneRm: estimate1RM(Number(best.weight), best.reps) }
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
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-display text-[color:var(--color-text-dim)] tabular text-sm">#{String(index).padStart(2, '0')}</span>
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
              className="p-1.5 rounded-full text-[color:var(--color-text-dim)] hover:text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10 transition-colors cursor-pointer"
              aria-label="Supprimer l'exercice"
            >
              <Trash2 size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Supprimer</TooltipContent>
        </Tooltip>
      </div>
      <h3 className="font-display text-2xl leading-tight">{exercise.name}</h3>

      {bestPreview && (
        <div className="flex items-center gap-3 mt-2 text-xs text-[color:var(--color-text-dim)]">
          <span>Top: {bestPreview.set.reps} × {formatWeight(Number(bestPreview.set.weight), unit, 1)}</span>
          <span className="opacity-60">·</span>
          <span>1RM ≈ {formatWeight(bestPreview.oneRm, unit, 0)}</span>
          {previousPR > 0 && bestKg > previousPR && (
            <span className="text-[color:var(--color-accent)] font-medium flex items-center gap-1">
              <Trophy size={12} /> PR
            </span>
          )}
        </div>
      )}

      {exercise.sets.length > 0 && (
        <div className="mt-4 space-y-1">
          {exercise.sets.map((set, i) => (
            <SetRow
              key={set.id}
              sessionId={sessionId}
              exerciseId={exercise.id}
              index={i + 1}
              set={set}
              unit={unit}
              isTop={Number(set.weight) === bestKg}
              onChange={onChange}
            />
          ))}
        </div>
      )}

      <form onSubmit={onAddSet} className="mt-4 flex gap-2">
        <Input
          type="number"
          placeholder="reps"
          value={reps}
          onChange={e => setReps(e.target.value)}
          min="0"
          inputMode="numeric"
          className="flex-1 text-center font-display text-lg"
        />
        <Input
          type="number"
          step="0.5"
          placeholder={unit}
          value={weight}
          onChange={e => setWeight(e.target.value)}
          min="0"
          inputMode="decimal"
          className="flex-1 text-center font-display text-lg"
        />
        <Button type="submit" variant="accent" disabled={adding || !reps || !weight}>
          <Plus size={16} />
        </Button>
      </form>
      {lastSet && !reps && !weight && (
        <button
          type="button"
          onClick={reuseLast}
          className="text-xs text-[color:var(--color-text-dim)] hover:text-[color:var(--color-accent)] mt-2 transition-colors cursor-pointer inline-flex items-center gap-1"
        >
          ↻ Reprendre {lastSet.reps} × {formatWeight(Number(lastSet.weight), unit, 1)}
        </button>
      )}
    </Card>
  )
}

function SetRow({
  sessionId,
  exerciseId,
  index,
  set,
  unit,
  isTop,
  onChange,
}: {
  sessionId: string
  exerciseId: string
  index: number
  set: ExerciseSet
  unit: 'kg' | 'lb'
  isTop: boolean
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
      <div className="flex items-center gap-2 bg-[color:var(--color-surface-2)] rounded-2xl p-2">
        <span className="text-xs font-mono tabular text-[color:var(--color-text-dim)] w-8 text-center">{String(index).padStart(2, '0')}</span>
        <Input type="number" value={reps} onChange={e => setReps(e.target.value)} className="h-9 text-center" inputMode="numeric" />
        <span className="text-[color:var(--color-text-dim)] text-sm">×</span>
        <Input type="number" step="0.5" value={weight} onChange={e => setWeight(e.target.value)} className="h-9 text-center" inputMode="decimal" />
        <Button variant="accent" size="icon-sm" onClick={save}>
          <Check size={14} />
        </Button>
      </div>
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="group flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[color:var(--color-surface-2)] cursor-pointer border border-transparent hover:border-[color:var(--color-border)] transition-all duration-200"
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(true) } }}
    >
      <span className="text-xs font-mono tabular text-[color:var(--color-text-dim)] w-8 text-center">
        {String(index).padStart(2, '0')}
      </span>
      <span className="font-display text-xl tabular leading-none">{set.reps}</span>
      <span className="text-[color:var(--color-text-dim)] text-xs mt-1">reps</span>
      <span className="text-[color:var(--color-text-dim)] mx-1">·</span>
      <span className="font-display text-xl tabular leading-none">{round(fromKg(Number(set.weight), unit), 1)}</span>
      <span className="text-[color:var(--color-text-dim)] text-xs mt-1">{unit}</span>
      {isTop && (
        <span className="ml-2 text-[color:var(--color-accent)]">
          <Trophy size={12} />
        </span>
      )}
      <button
        onClick={e => { e.stopPropagation(); remove() }}
        className="ml-auto p-1.5 rounded-full text-[color:var(--color-text-dim)] hover:text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
        aria-label="Supprimer la série"
      >
        <Trash2 size={12} />
      </button>
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
