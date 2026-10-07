import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Copy, Share, CornerDownRight, History, Plus, Timer, Trash2, X } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import {
  Button,
  Card,
  Disc,
  EmptyState,
  Input,
  Label,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Spinner,
  Tag,
  useConfirm,
} from '../components/ui'
import {
  addExercise,
  addSet,
  addSetDrop,
  deleteExercise,
  deleteSession,
  deleteSet,
  deleteSetDrop,
  getDistinctExerciseNames,
  getSession,
  insertSet,
  listSessions,
  updateRunningSession,
  updateSession,
  updateSet,
  updateSetDrop,
} from '../lib/db'
import type { Exercise, ExerciseSet, Session, SetDrop } from '../lib/types'
import { frNum, fromKg, parseDecimal, round, toKg } from '../lib/units'
import { normalizeExerciseName, slugifyExerciseName } from '../lib/exerciseName'
import { buildPreviousPerformances, findLastSimilarSession } from '../lib/similarSession'
import type { PreviousPerformance } from '../lib/similarSession'
import { setMaxWeightKg, setTotalReps, setVolumeKg } from '../lib/setMath'
import { useSettings } from '../store/settings'
import { RestTimer } from '../components/RestTimer'
import { PlateCalculator } from '../components/PlateCalculator'
import { renderSessionImage, shareSessionImage } from '../lib/sessionImage'
import { cn } from '../lib/cn'

type Unit = 'kg' | 'lb'

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
  const [recapOpen, setRecapOpen] = useState(false)
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [prToast, setPrToast] = useState<{ name: string; weight: number; bodyweight: boolean } | null>(null)
  const notesTimer = useRef<number | null>(null)
  const [undo, setUndo] = useState<{ exerciseId: string; set: ExerciseSet; position: number } | null>(null)
  const undoTimer = useRef<number | null>(null)

  function onSetRemoved(exerciseId: string, set: ExerciseSet, position: number) {
    if (undoTimer.current) window.clearTimeout(undoTimer.current)
    setUndo({ exerciseId, set, position })
    undoTimer.current = window.setTimeout(() => setUndo(null), 5000)
  }

  const [sharing, setSharing] = useState(false)
  async function onShare() {
    if (!data) return
    setSharing(true)
    try {
      // Exercises where this session beat everything logged before it.
      const before: Record<string, number> = {}
      for (const sess of allSessions) {
        if (sess.id === data.id || sess.date > data.date) continue
        for (const ex of sess.exercises) for (const st of ex.sets) before[ex.name.trim()] = Math.max(before[ex.name.trim()] ?? 0, setMaxWeightKg(st))
      }
      const recs = new Set<string>()
      for (const ex of data.exercises) {
        const best = ex.sets.reduce((m, st) => Math.max(m, setMaxWeightKg(st)), 0)
        const prev = before[ex.name.trim()] ?? 0
        if (prev > 0 && best > prev) recs.add(ex.name.trim())
      }
      const blob = await renderSessionImage(data, unit, recs)
      await shareSessionImage(blob, data)
    } finally {
      setSharing(false)
    }
  }

  async function restoreRemoved() {
    if (!undo || !id) return
    const u = undo
    setUndo(null)
    await insertSet(id, u.exerciseId, u.set, u.position)
    await load()
  }

  async function load() {
    if (!id) return
    const d = await getSession(id)
    setData(d)
    setLoading(false)
  }

  useEffect(() => {
    if (!id) return
    setRecapOpen(false)
    ;(async () => {
      const [d, all, names] = await Promise.all([getSession(id), listSessions(200), getDistinctExerciseNames()])
      setData(d)
      setNotes(d?.notes ?? '')
      setExerciseNames(names)
      setAllSessions(all)
      const prs: Record<string, number> = {}
      for (const sess of all) {
        if (sess.id === id) continue
        for (const ex of sess.exercises) {
          for (const set of ex.sets) {
            const n = ex.name.trim()
            prs[n] = Math.max(prs[n] ?? 0, setMaxWeightKg(set))
          }
        }
      }
      setPastPR(prs)
      setLoading(false)
    })()
  }, [id])

  const lastSimilar = useMemo(() => (data ? findLastSimilarSession(data, allSessions) : null), [data, allSessions])
  const prevPerf = useMemo<Map<string, PreviousPerformance>>(
    () => (data ? buildPreviousPerformances(data, allSessions) : new Map()),
    [data, allSessions],
  )

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
      description: 'Les exercices et toutes les séries enregistrées seront effacés. Impossible de revenir en arrière.',
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    await deleteSession(id)
    nav('/', { replace: true })
  }

  function onSetAdded(exerciseName: string, weightKg: number, bodyweight: boolean) {
    const key = exerciseName.trim()
    const pr = pastPR[key] ?? 0
    if (weightKg > pr) {
      setPastPR(prev => ({ ...prev, [key]: weightKg }))
      // Only celebrate when there was a previous best to beat.
      if (pr > 0) {
        if ('vibrate' in navigator) navigator.vibrate?.([30, 40, 30])
        setPrToast({ name: exerciseName, weight: weightKg, bodyweight })
        window.setTimeout(() => setPrToast(null), 3500)
      }
    }
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>
  if (!data || !id) {
    return (
      <EmptyState
        className="pt-24"
        title="Séance introuvable"
        subtitle="Elle a peut-être été supprimée depuis un autre appareil."
        action={<Button onClick={() => nav('/')}>Retour à l’accueil</Button>}
      />
    )
  }

  const running = data.type === 'running'

  return (
    <div className={cn(timerOpen && 'pb-28')}>
      {/* Focus-mode top bar */}
      <div className="sticky top-0 sm:top-16 z-20 -mx-4 sm:-mx-6 lg:-mx-10 xl:-mx-14 px-2 sm:px-4 lg:px-8 xl:px-12 bar hairline-b safe-top">
        <div className="h-14 flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label="Retour" className="text-ink">
            <ChevronLeft size={24} />
          </Button>
          {!running && <span className="w-11" aria-hidden />}
          <p className="flex-1 min-w-0 text-center text-[15px] font-semibold first-letter:uppercase truncate">
            {format(new Date(data.date + 'T12:00:00'), 'EEEE d MMMM', { locale: fr })}
          </p>
          <Button variant="ghost" size="icon" onClick={onShare} disabled={sharing} aria-label="Partager la séance en image" className="text-ink">
            <Share size={20} />
          </Button>
          {!running && (
            <Button variant="ghost" size="icon" onClick={() => setTimerOpen(true)} aria-label="Minuteur de repos" className="text-ink">
              <Timer size={21} />
            </Button>
          )}
        </div>
      </div>

      <div className="pt-5">
        {running && <Tag tone="run" className="mb-3">Course</Tag>}
        <textarea
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          rows={1}
          placeholder={running ? 'Nommer la sortie' : 'Nommer la séance'}
          aria-label="Titre de la séance"
          className="w-full resize-none bg-transparent t-title text-[32px] sm:text-[40px] placeholder:text-faint outline-none [field-sizing:content] focus-visible:outline-none"
        />
      </div>

      {running ? (
        <RunningSessionView session={data} onChange={load} />
      ) : (
        <>
          {lastSimilar && (
            <button
              type="button"
              onClick={() => setRecapOpen(true)}
              className="mt-4 w-full flex items-center gap-3 rounded-[12px] bg-surface px-4 h-14 text-left cursor-pointer active:bg-surface-2"
            >
              <History size={18} className="text-dim shrink-0" />
              <span className="flex-1 min-w-0 truncate">
                <span className="font-semibold">Séance similaire</span>
                <span className="text-dim"> du {format(new Date(lastSimilar.session.date + 'T12:00:00'), 'd MMMM', { locale: fr })}</span>
              </span>
              <ChevronRight size={18} className="text-faint shrink-0" />
            </button>
          )}

          <div className="mt-6 space-y-4 xl:space-y-0 xl:grid xl:grid-cols-2 xl:gap-4 xl:items-start">
            {data.exercises.map(ex => (
              <ExerciseCard
                key={ex.id}
                sessionId={id}
                exercise={ex}
                unit={unit}
                previousPR={pastPR[ex.name.trim()] ?? 0}
                previous={prevPerf.get(normalizeExerciseName(ex.name))}
                onChange={load}
                onSetAdded={onSetAdded}
                onSetRemoved={onSetRemoved}
              />
            ))}
          </div>

          <AddExercise
            suggestions={exerciseNames}
            already={data.exercises.map(e => normalizeExerciseName(e.name))}
            onAdd={onAddExercise}
            first={data.exercises.length === 0}
          />
        </>
      )}

      <div className="mt-12 pt-5 hairline-t">
        <Button variant="danger-soft" className="w-full" onClick={onDeleteSession}>
          <Trash2 size={16} /> Supprimer la séance
        </Button>
      </div>

      <AnimatePresence>
        {undo && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className={cn('fixed inset-x-0 z-50 flex justify-center px-4 pointer-events-none', timerOpen ? 'bottom-[calc(env(safe-area-inset-bottom)+8.5rem)]' : 'bottom-[calc(env(safe-area-inset-bottom)+1rem)]')}
            role="status"
          >
            <div className="pointer-events-auto flex items-center gap-3 rounded-[12px] bg-ink text-bg pl-4 pr-1.5 h-12 shadow-[0_12px_32px_-10px_rgba(0,0,0,0.6)]">
              <span className="text-[14px] font-semibold">Série supprimée</span>
              <button onClick={restoreRemoved} className="h-9 px-3 rounded-[8px] bg-bg/15 text-[14px] font-semibold cursor-pointer">Annuler</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <RestTimer open={timerOpen} onClose={() => setTimerOpen(false)} defaultSeconds={restSeconds} />

      {lastSimilar && (
        <Sheet open={recapOpen} onOpenChange={setRecapOpen}>
          <SheetContent side="bottom">
            <SheetHeader className="pt-4">
              <p className="text-[14px] text-dim font-medium">Séance similaire</p>
              <SheetTitle className="t-title text-[26px] mt-1 first-letter:uppercase">
                {format(new Date(lastSimilar.session.date + 'T12:00:00'), 'EEEE d MMMM', { locale: fr })}
              </SheetTitle>
              {lastSimilar.session.notes && <p className="text-[15px] text-dim mt-1 truncate">{lastSimilar.session.notes}</p>}
            </SheetHeader>
            <SheetBody>
              <div className="space-y-5 pt-2">
                {lastSimilar.session.exercises.map(ex => (
                  <RecapExercise
                    key={ex.id}
                    exercise={ex}
                    unit={unit}
                    shared={lastSimilar.sharedKeys.has(normalizeExerciseName(ex.name))}
                  />
                ))}
              </div>
              <Button
                variant="secondary"
                className="w-full mt-6"
                onClick={() => { setRecapOpen(false); nav(`/session/${lastSimilar.session.id}`) }}
              >
                Ouvrir cette séance
              </Button>
            </SheetBody>
          </SheetContent>
        </Sheet>
      )}

      <AnimatePresence>
        {prToast && (
          <motion.div
            initial={{ y: -40, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className="fixed inset-x-0 top-0 z-50 pointer-events-none flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
            role="status"
          >
            <div className="rounded-[12px] bg-pr text-white pl-3 pr-5 py-3 flex items-center gap-3 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)] max-w-md">
              <motion.span
                initial={{ rotate: -120 }}
                animate={{ rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.05 }}
              >
                <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="12" r="11.25" fill="#fff" fillOpacity="0.22" />
                  <circle cx="12" cy="12" r="7.4" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.1" />
                  <circle cx="12" cy="12" r="2.4" fill="#fff" />
                </svg>
              </motion.span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold opacity-90">Nouveau record</span>
                <span className="block font-semibold truncate">
                  {prToast.name}{' '}
                  <span className="num text-[20px]">
                    {prToast.bodyweight ? `+${frNum(fromKg(prToast.weight, unit), 1)}` : frNum(fromKg(prToast.weight, unit), 1)}
                  </span>{' '}
                  {unit}
                </span>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Formatting helpers ──────────────────────────────────────────────── */

function loadText(weightKg: number, unit: Unit, bodyweight: boolean): string {
  if (bodyweight && weightKg <= 0) return 'PDC'
  return `${bodyweight ? '+' : ''}${frNum(fromKg(weightKg, unit), 1)}`
}

function compactSet(weightKg: number, reps: number, unit: Unit, bodyweight: boolean): string {
  return `${reps}×${loadText(weightKg, unit, bodyweight)}`
}

function compactSetWithDrops(s: ExerciseSet, unit: Unit, bodyweight: boolean): string {
  const main = compactSet(Number(s.weight), s.reps, unit, bodyweight)
  if (!s.drops || s.drops.length === 0) return main
  return `${main} → ${s.drops.map(d => compactSet(Number(d.weight), d.reps, unit, bodyweight)).join(' → ')}`
}

function formatVolume(kg: number, unit: Unit): string {
  const v = fromKg(kg, unit)
  if (v >= 10000) return unit === 'kg' ? `${frNum(v / 1000, 1)} t` : `${frNum(v / 1000, 1)}k lb`
  return `${Math.round(v).toLocaleString('fr-FR')} ${unit}`
}

/* ── Exercise card ───────────────────────────────────────────────────── */

function ExerciseCard({
  sessionId,
  exercise,
  unit,
  previousPR,
  previous,
  onChange,
  onSetAdded,
  onSetRemoved,
}: {
  sessionId: string
  exercise: Exercise
  unit: Unit
  previousPR: number
  previous?: PreviousPerformance
  onChange: () => void
  onSetAdded: (name: string, weightKg: number, bodyweight: boolean) => void
  onSetRemoved: (exerciseId: string, set: ExerciseSet, position: number) => void
}) {
  const confirm = useConfirm()
  const nav = useNavigate()
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')
  const [adding, setAdding] = useState(false)
  const [platesOpen, setPlatesOpen] = useState(false)
  const isBw = !!exercise.bodyweight
  const lastSet = exercise.sets[exercise.sets.length - 1]
  const bestKg = exercise.sets.reduce((m, s) => Math.max(m, setMaxWeightKg(s)), 0)
  const isPR = previousPR > 0 && bestKg > previousPR
  const step = unit === 'kg' ? 2.5 : 5

  // What to suggest in the quick-fill chips: this session's last set, else last time's first set.
  const reference = lastSet ?? previous?.sets[0]

  async function onAddSet(e: React.FormEvent) {
    e.preventDefault()
    if (!reps || adding) return
    if (!isBw && !weight) return
    const parsed = weight ? parseDecimal(weight) : 0
    if (Number.isNaN(parsed) || parsed < 0) return
    setAdding(true)
    const weightKg = toKg(parsed, unit)
    try {
      await addSet(sessionId, exercise.id, Number(reps), weightKg)
      setReps('')
      setWeight('')
      onChange()
      onSetAdded(exercise.name, weightKg, isBw)
    } finally {
      setAdding(false)
    }
  }

  function fill(r: number, wKg: number) {
    setReps(String(r))
    setWeight(frNum(fromKg(wKg, unit), 1))
  }

  const volume = exercise.sets.reduce((sum, s) => sum + setVolumeKg(s), 0)
  const totalReps = exercise.sets.reduce((n, s) => n + setTotalReps(s), 0)

  return (
    <Card className="p-4">
      <header className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => nav(`/exercise/${slugifyExerciseName(exercise.name)}?key=${encodeURIComponent(normalizeExerciseName(exercise.name))}`)}
            className="t-heading text-[20px] text-left cursor-pointer hover:underline underline-offset-4 decoration-line-strong"
          >
            {exercise.name}
          </button>
          {(isBw || isPR || exercise.sets.length > 0) && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {isPR && <Tag tone="pr">Record</Tag>}
              {isBw && <Tag>Poids du corps</Tag>}
              {exercise.sets.length > 0 && (
                <span className="text-[13px] text-dim">
                  {exercise.sets.length} série{exercise.sets.length > 1 ? 's' : ''}, {isBw ? `${totalReps} reps` : formatVolume(volume, unit)}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={async () => {
            const ok = await confirm({
              title: `Retirer « ${exercise.name} » ?`,
              description: 'Toutes les séries de cet exercice seront supprimées de la séance.',
              confirmLabel: 'Retirer',
              danger: true,
            })
            if (!ok) return
            await deleteExercise(sessionId, exercise.id)
            onChange()
          }}
          className="h-10 w-10 -mr-2 -mt-1.5 grid place-items-center rounded-full text-faint hover:text-danger cursor-pointer shrink-0"
          aria-label={`Retirer ${exercise.name}`}
        >
          <X size={18} />
        </button>
      </header>

      {previous && previous.sets.length > 0 && (
        <div className="mt-3 flex items-baseline gap-2 text-[13px] min-w-0">
          <span className="text-dim shrink-0">Dernière fois, {format(new Date(previous.date + 'T12:00:00'), 'd MMM', { locale: fr })}</span>
          <span className="flex gap-x-3 overflow-hidden whitespace-nowrap">
            {previous.sets.map(s => (
              <span key={s.id} className="num-light text-[16px] text-ink">{compactSetWithDrops(s, unit, previous.bodyweight)}</span>
            ))}
          </span>
        </div>
      )}

      {exercise.sets.length > 0 && (
        <ol className="mt-3 -mx-4">
          {exercise.sets.map((set, i) => (
            <SetRow
              key={set.id}
              sessionId={sessionId}
              exerciseId={exercise.id}
              exerciseName={exercise.name}
              index={i + 1}
              set={set}
              unit={unit}
              bodyweight={isBw}
              onChange={onChange}
              onSetAdded={onSetAdded}
              onRemoved={(st, pos) => onSetRemoved(exercise.id, st, pos)}
            />
          ))}
        </ol>
      )}
      {exercise.sets.length > 0 && <SwipeHint />}

      <form onSubmit={onAddSet} className="mt-4">
        <div className="grid grid-cols-[1fr_1.25fr_auto] gap-2 items-end">
          <NumField label="Reps" value={reps} onChange={setReps} inputMode="numeric" placeholder={reference ? String(reference.reps) : '0'} />
          <NumField
            label={isBw ? `Lest (${unit})` : unit}
            value={weight}
            onChange={setWeight}
            inputMode="decimal"
            placeholder={reference ? (isBw && Number(reference.weight) <= 0 ? '0' : frNum(fromKg(Number(reference.weight), unit), 1)) : isBw ? '0' : '0,0'}
          />
          <Button
            type="submit"
            size="icon"
            className="h-14 w-14 rounded-[12px]"
            disabled={adding || !reps || (!isBw && !weight)}
            aria-label={`Ajouter la série ${exercise.sets.length + 1}`}
          >
            <Plus size={24} strokeWidth={2.5} />
          </Button>
        </div>

        {(reference || !isBw) && (
          <div className="flex gap-2 mt-2.5 overflow-x-auto no-scrollbar -mx-4 px-4">
            {reference && (
              <QuickChip onClick={() => fill(reference.reps, Number(reference.weight))}>
                {lastSet ? 'Refaire' : 'Comme la dernière fois'} <span className="num text-[16px]">{reference.reps}×{loadText(Number(reference.weight), unit, isBw)}</span>
              </QuickChip>
            )}
            {reference && !isBw && (
              <QuickChip onClick={() => fill(reference.reps, Number(reference.weight) + toKg(step, unit))}>
                <span className="num text-[16px]">+{frNum(step, 1)}</span> {unit}
              </QuickChip>
            )}
            {reference && (
              <QuickChip onClick={() => fill(reference.reps + 1, Number(reference.weight))}>
                <span className="num text-[16px]">+1</span> rep
              </QuickChip>
            )}
            {!isBw && (
              <QuickChip onClick={() => setPlatesOpen(true)}>
                <Disc size={15} /> Disques
              </QuickChip>
            )}
          </div>
        )}
      </form>
      {!isBw && (
        <PlateCalculator
          open={platesOpen}
          onOpenChange={setPlatesOpen}
          initial={(() => {
            const typed = parseDecimal(weight)
            if (!Number.isNaN(typed) && typed > 0) return typed
            return reference ? round(fromKg(Number(reference.weight), unit), 2) : undefined
          })()}
        />
      )}
    </Card>
  )
}

function NumField({
  label,
  value,
  onChange,
  inputMode,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  inputMode: 'numeric' | 'decimal'
  placeholder: string
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-[12px] font-semibold text-dim mb-1 pl-1">{label}</span>
      <Input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        inputMode={inputMode}
        pattern={inputMode === 'numeric' ? '[0-9]*' : '[0-9]*[.,]?[0-9]*'}
        autoComplete="off"
        placeholder={placeholder}
        className="h-14 num text-[28px] text-center px-2 placeholder:text-faint/70"
      />
    </label>
  )
}

function QuickChip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 shrink-0 rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold text-ink flex items-center gap-1 cursor-pointer active:bg-line"
    >
      {children}
    </button>
  )
}

/* ── Set rows ────────────────────────────────────────────────────────── */

function SetRow({
  sessionId,
  exerciseId,
  exerciseName,
  index,
  set,
  unit,
  bodyweight,
  onChange,
  onSetAdded,
  onRemoved,
}: {
  sessionId: string
  exerciseId: string
  exerciseName: string
  index: number
  set: ExerciseSet
  unit: Unit
  bodyweight: boolean
  onChange: () => void
  onSetAdded: (name: string, weightKg: number, bodyweight: boolean) => void
  onRemoved: (set: ExerciseSet, position: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [reps, setReps] = useState(String(set.reps))
  const [weight, setWeight] = useState(frNum(fromKg(Number(set.weight), unit), 1))
  const [addingDrop, setAddingDrop] = useState(false)
  const [dropReps, setDropReps] = useState('')
  const [dropWeight, setDropWeight] = useState('')
  const [submittingDrop, setSubmittingDrop] = useState(false)

  function startEdit() {
    setReps(String(set.reps))
    setWeight(frNum(fromKg(Number(set.weight), unit), 1))
    setEditing(true)
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    const parsed = parseDecimal(weight || '0')
    if (Number.isNaN(parsed) || parsed < 0 || !reps) return
    await updateSet(sessionId, exerciseId, set.id, { reps: Number(reps), weight: toKg(parsed, unit) })
    setEditing(false)
    onChange()
  }

  async function remove() {
    await deleteSet(sessionId, exerciseId, set.id)
    onChange()
    onRemoved(set, index - 1)
  }

  async function duplicate() {
    await addSet(sessionId, exerciseId, set.reps, Number(set.weight))
    onChange()
    onSetAdded(exerciseName, Number(set.weight), bodyweight)
  }

  async function submitDrop(e: React.FormEvent) {
    e.preventDefault()
    if (!dropReps || submittingDrop) return
    if (!bodyweight && !dropWeight) return
    const parsed = dropWeight ? parseDecimal(dropWeight) : 0
    if (Number.isNaN(parsed) || parsed < 0) return
    setSubmittingDrop(true)
    const weightKg = toKg(parsed, unit)
    try {
      await addSetDrop(sessionId, exerciseId, set.id, Number(dropReps), weightKg)
      setDropReps('')
      setDropWeight('')
      setAddingDrop(false)
      onChange()
      onSetAdded(exerciseName, weightKg, bodyweight)
    } finally {
      setSubmittingDrop(false)
    }
  }

  return (
    <li className="hairline-t">
      {editing ? (
        <form onSubmit={save} className="flex items-center gap-2 px-4 py-2 bg-surface-2/60">
          <span className="w-6 num-light text-[15px] text-faint text-center shrink-0">{index}</span>
          <Input value={reps} onChange={e => setReps(e.target.value)} inputMode="numeric" autoFocus aria-label="Répétitions" className="h-11 num text-[22px] text-center px-1 bg-surface" />
          <span className="text-faint">×</span>
          <Input value={weight} onChange={e => setWeight(e.target.value)} inputMode="decimal" aria-label="Charge" className="h-11 num text-[22px] text-center px-1 bg-surface" />
          <Button type="submit" size="sm" className="h-11 shrink-0">OK</Button>
          <button type="button" onClick={() => setEditing(false)} className="h-11 w-9 grid place-items-center text-faint cursor-pointer shrink-0" aria-label="Annuler">
            <X size={18} />
          </button>
        </form>
      ) : (
        <SwipeRow onSwipeLeft={remove} onSwipeRight={duplicate}>
        <div className="flex items-center gap-1 pl-4 pr-2 h-[52px] bg-surface">
          <span className="w-6 num-light text-[15px] text-faint text-center shrink-0" aria-label={`Série ${index}`}>{index}</span>
          <button onClick={startEdit} className="flex-1 flex items-baseline gap-2 pl-2 h-full cursor-pointer text-left" aria-label={`Modifier la série ${index}`}>
            <span className="num text-[26px] self-center">{set.reps}</span>
            <span className="text-faint text-[15px] self-center">×</span>
            <span className="num text-[26px] self-center">{loadText(Number(set.weight), unit, bodyweight)}</span>
            {!(bodyweight && Number(set.weight) <= 0) && <span className="text-[13px] font-semibold text-dim self-center">{unit}</span>}
          </button>
          <button
            onClick={() => setAddingDrop(v => !v)}
            className={cn('h-10 px-2.5 rounded-full text-[12px] font-semibold flex items-center gap-1 cursor-pointer', addingDrop ? 'text-ink' : 'text-faint hover:text-ink')}
            aria-label="Ajouter une dégressive"
            aria-expanded={addingDrop}
          >
            <CornerDownRight size={15} /> Dégr.
          </button>
          <button onClick={duplicate} className="hidden sm:grid h-10 w-10 place-items-center rounded-full text-faint hover:text-ink cursor-pointer" aria-label={`Dupliquer la série ${index}`}>
            <Copy size={16} />
          </button>
          <button onClick={remove} className="hidden sm:grid h-10 w-10 place-items-center rounded-full text-faint hover:text-danger cursor-pointer" aria-label={`Supprimer la série ${index}`}>
            <Trash2 size={16} />
          </button>
        </div>
        </SwipeRow>
      )}

      {set.drops?.map(drop => (
        <DropRow key={drop.id} sessionId={sessionId} exerciseId={exerciseId} setId={set.id} drop={drop} unit={unit} bodyweight={bodyweight} onChange={onChange} />
      ))}

      {addingDrop && (
        <form onSubmit={submitDrop} className="flex items-center gap-2 pl-10 pr-4 pb-2.5">
          <CornerDownRight size={16} className="text-faint shrink-0" />
          <Input value={dropReps} onChange={e => setDropReps(e.target.value)} inputMode="numeric" placeholder="reps" autoFocus aria-label="Répétitions de la dégressive" className="h-11 num text-[20px] text-center px-1" />
          <Input value={dropWeight} onChange={e => setDropWeight(e.target.value)} inputMode="decimal" placeholder={bodyweight ? `lest ${unit}` : unit} aria-label="Charge de la dégressive" className="h-11 num text-[20px] text-center px-1" />
          <Button type="submit" size="sm" className="h-11 shrink-0" disabled={submittingDrop || !dropReps || (!bodyweight && !dropWeight)}>
            Ajouter
          </Button>
        </form>
      )}
    </li>
  )
}

function DropRow({
  sessionId,
  exerciseId,
  setId,
  drop,
  unit,
  bodyweight,
  onChange,
}: {
  sessionId: string
  exerciseId: string
  setId: string
  drop: SetDrop
  unit: Unit
  bodyweight: boolean
  onChange: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [reps, setReps] = useState(String(drop.reps))
  const [weight, setWeight] = useState(frNum(fromKg(Number(drop.weight), unit), 1))

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    const parsed = parseDecimal(weight || '0')
    if (Number.isNaN(parsed) || parsed < 0) return
    await updateSetDrop(sessionId, exerciseId, setId, drop.id, { reps: Number(reps), weight: toKg(parsed, unit) })
    setEditing(false)
    onChange()
  }

  async function remove() {
    await deleteSetDrop(sessionId, exerciseId, setId, drop.id)
    onChange()
  }

  if (editing) {
    return (
      <form onSubmit={save} className="flex items-center gap-2 pl-10 pr-4 py-1.5">
        <CornerDownRight size={16} className="text-faint shrink-0" />
        <Input value={reps} onChange={e => setReps(e.target.value)} inputMode="numeric" autoFocus aria-label="Répétitions" className="h-10 num text-[18px] text-center px-1" />
        <Input value={weight} onChange={e => setWeight(e.target.value)} inputMode="decimal" aria-label="Charge" className="h-10 num text-[18px] text-center px-1" />
        <Button type="submit" size="sm" className="h-10 shrink-0">OK</Button>
      </form>
    )
  }

  return (
    <div className="flex items-center gap-1 pl-10 pr-2 h-10 text-dim">
      <CornerDownRight size={15} className="text-faint shrink-0" />
      <button onClick={() => setEditing(true)} className="flex-1 flex items-baseline gap-1.5 pl-2 cursor-pointer text-left" aria-label="Modifier la dégressive">
        <span className="num text-[19px]">{drop.reps}</span>
        <span className="text-faint text-[13px]">×</span>
        <span className="num text-[19px]">{loadText(Number(drop.weight), unit, bodyweight)}</span>
      </button>
      <button onClick={remove} className="h-10 w-10 grid place-items-center rounded-full text-faint hover:text-danger cursor-pointer" aria-label="Supprimer la dégressive">
        <X size={15} />
      </button>
    </div>
  )
}

/* ── Recap of the similar session ────────────────────────────────────── */

function RecapExercise({ exercise, unit, shared }: { exercise: Exercise; unit: Unit; shared: boolean }) {
  const isBw = !!exercise.bodyweight
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <h4 className="t-heading text-[17px]">{exercise.name}</h4>
        {shared && <Tag>Aussi aujourd’hui</Tag>}
        {isBw && <Tag>Poids du corps</Tag>}
      </div>
      {exercise.sets.length === 0 ? (
        <p className="text-[14px] text-dim">Aucune série notée</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {exercise.sets.map(s => (
            <span key={s.id} className="rounded-[10px] bg-surface-2 px-2.5 h-9 flex items-center num text-[18px]">
              {compactSetWithDrops(s, unit, isBw)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Add exercise ────────────────────────────────────────────────────── */

function AddExercise({
  suggestions,
  already,
  onAdd,
  first,
}: {
  suggestions: string[]
  already: string[]
  onAdd: (name: string) => Promise<void> | void
  first: boolean
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const q = normalizeExerciseName(name)
  const pool = suggestions.filter(s => !already.includes(normalizeExerciseName(s)))
  const filtered = (q ? pool.filter(s => normalizeExerciseName(s).includes(q) && normalizeExerciseName(s) !== q) : pool).slice(0, 8)

  async function submit(v?: string) {
    const finalName = (v ?? name).trim()
    if (!finalName || busy) return
    setBusy(true)
    try {
      await onAdd(finalName)
      setName('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={cn(first ? 'mt-6' : 'mt-8')}>
      <Label htmlFor="add-exercise" className="block mb-2 text-[15px] text-ink font-semibold">
        {first ? 'Premier exercice' : 'Ajouter un exercice'}
      </Label>
      <form onSubmit={e => { e.preventDefault(); submit() }} className="flex gap-2">
        <Input
          id="add-exercise"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Développé couché, squat…"
          autoComplete="off"
          enterKeyHint="done"
        />
        <Button type="submit" disabled={!name.trim() || busy} className="h-12 shrink-0">
          Ajouter
        </Button>
      </form>
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {filtered.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => submit(s)}
              className="h-9 rounded-full bg-surface px-3.5 text-[14px] font-medium flex items-center gap-1.5 cursor-pointer active:bg-surface-2"
            >
              <Plus size={14} className="text-faint" /> {s}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

/* ── Running ─────────────────────────────────────────────────────────── */

function RunningSessionView({ session, onChange }: { session: Session; onChange: () => void }) {
  const [distanceKm, setDistanceKm] = useState(session.distanceMeters ? frNum(session.distanceMeters / 1000, 2) : '')
  const [durationMin, setDurationMin] = useState(session.durationSeconds ? String(Math.floor(session.durationSeconds / 60)) : '')
  const [durationSec, setDurationSec] = useState(session.durationSeconds ? String(session.durationSeconds % 60).padStart(2, '0') : '')
  const [route, setRoute] = useState(session.route ?? '')
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<number | null>(null)

  const distanceMeters = parseDecimal(distanceKm) > 0 ? Math.round(parseDecimal(distanceKm) * 1000) : null
  const durationSeconds = (() => {
    const total = (Number(durationMin) || 0) * 60 + (Number(durationSec) || 0)
    return total > 0 ? total : null
  })()

  function schedulePersist() {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(async () => {
      setSaving(true)
      try {
        await updateRunningSession(session.id, { distanceMeters, durationSeconds, route: route.trim() || null })
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
        const total = Math.round(secPerKm)
        return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
      })()
    : '–'

  return (
    <div className="mt-4 space-y-4">
      <Card className="grid grid-cols-3 py-4">
        <RunFigure label="Distance" value={distanceKm || '–'} unit="km" />
        <RunFigure label="Durée" value={durationMin ? `${durationMin}:${(durationSec || '00').padStart(2, '0')}` : '–'} />
        <RunFigure label="Allure" value={pace} unit="/km" />
      </Card>

      <Card className="p-4 space-y-4">
        <div>
          <Label htmlFor="run-distance" className="block mb-1.5">Distance</Label>
          <div className="relative">
            <Input id="run-distance" value={distanceKm} onChange={e => setDistanceKm(e.target.value)} inputMode="decimal" autoComplete="off" placeholder="0,00" className="num text-[24px] pr-12" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-dim pointer-events-none">km</span>
          </div>
        </div>
        <div>
          <Label className="block mb-1.5">Durée</Label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input value={durationMin} onChange={e => setDurationMin(e.target.value)} inputMode="numeric" aria-label="Minutes" placeholder="0" className="num text-[24px] pr-14" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-dim pointer-events-none">min</span>
            </div>
            <div className="relative flex-1">
              <Input value={durationSec} onChange={e => setDurationSec(e.target.value)} inputMode="numeric" aria-label="Secondes" placeholder="00" className="num text-[24px] pr-12" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-dim pointer-events-none">s</span>
            </div>
          </div>
        </div>
        <div>
          <Label htmlFor="run-route" className="block mb-1.5">Parcours</Label>
          <Input id="run-route" value={route} onChange={e => setRoute(e.target.value)} placeholder="Tour du parc, bord de l’eau…" />
          <p className="text-[13px] text-dim mt-1.5">Donne toujours le même nom à un trajet pour comparer tes temps dessus.</p>
        </div>
        <p className="text-[12px] text-faint h-4" aria-live="polite">{saving ? 'Enregistrement…' : ''}</p>
      </Card>
    </div>
  )
}

function RunFigure({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="text-center px-1">
      <p className="flex items-baseline justify-center gap-0.5">
        <span className="num text-[34px] text-run">{value}</span>
        {unit && <span className="text-[13px] font-semibold text-dim">{unit}</span>}
      </p>
      <p className="text-[12px] text-faint mt-1">{label}</p>
    </div>
  )
}


/* ── Swipe gestures on a set row ─────────────────────────────────────── */

const SWIPE_HINT_KEY = 'fit-tracker:swipe-hint-seen'
const SWIPE_THRESHOLD = 96

/** Swipe left to delete, right to duplicate. Taps still go through to the row. */
function SwipeRow({ children, onSwipeLeft, onSwipeRight }: { children: React.ReactNode; onSwipeLeft: () => void; onSwipeRight: () => void }) {
  const x = useMotionValue(0)
  const leftOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1])
  const rightOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0])
  const dragged = useRef(false)
  const [armed, setArmed] = useState<'left' | 'right' | null>(null)

  return (
    <div className="relative overflow-hidden">
      <motion.div style={{ opacity: leftOpacity }} className={cn('absolute inset-0 flex items-center pl-5 gap-2 text-[14px] font-semibold transition-colors', armed === 'right' ? 'bg-ink text-bg' : 'bg-surface-2 text-ink')} aria-hidden>
        <Copy size={18} /> Dupliquer
      </motion.div>
      <motion.div style={{ opacity: rightOpacity }} className={cn('absolute inset-0 flex items-center justify-end pr-5 gap-2 text-[14px] font-semibold text-white transition-colors', armed === 'left' ? 'bg-danger' : 'bg-danger/60')} aria-hidden>
        Supprimer <Trash2 size={18} />
      </motion.div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.55}
        dragSnapToOrigin
        style={{ x, touchAction: 'pan-y' }}
        onDragStart={() => { dragged.current = true }}
        onDrag={(_, info) => setArmed(info.offset.x <= -SWIPE_THRESHOLD ? 'left' : info.offset.x >= SWIPE_THRESHOLD ? 'right' : null)}
        onDragEnd={(_, info) => {
          setArmed(null)
          window.setTimeout(() => { dragged.current = false }, 50)
          if (info.offset.x <= -SWIPE_THRESHOLD || info.offset.x >= SWIPE_THRESHOLD) {
            try { localStorage.setItem(SWIPE_HINT_KEY, '1') } catch { /* ignore */ }
            if ('vibrate' in navigator) navigator.vibrate?.(12)
            if (info.offset.x < 0) onSwipeLeft()
            else onSwipeRight()
          }
        }}
        onClickCapture={e => { if (dragged.current) { e.stopPropagation(); e.preventDefault() } }}
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  )
}

function SwipeHint() {
  const [show] = useState(() => {
    try { return !localStorage.getItem(SWIPE_HINT_KEY) } catch { return false }
  })
  if (!show) return null
  return (
    <p className="sm:hidden text-[12px] text-faint px-0 pt-2">
      Glisse une série vers la gauche pour la supprimer, vers la droite pour la dupliquer.
    </p>
  )
}