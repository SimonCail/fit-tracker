import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Edit3, Search, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion } from 'framer-motion'
import { Button, Card, EmptyState, Input, Skeleton, Tooltip, TooltipContent, TooltipTrigger, useConfirm } from '../components/ui'
import { getExerciseAggregates, renameExerciseEverywhere, type ExerciseAggregate } from '../lib/db'
import { normalizeExerciseName, slugifyExerciseName } from '../lib/exerciseName'
import { formatWeight, fromKg } from '../lib/units'
import { useSettings } from '../store/settings'

export function ExercisesPage() {
  const nav = useNavigate()
  const { unit } = useSettings()
  const confirm = useConfirm()
  const [aggregates, setAggregates] = useState<ExerciseAggregate[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [renamingKey, setRenamingKey] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await getExerciseAggregates(normalizeExerciseName)
      setAggregates(res)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return aggregates
    const q = normalizeExerciseName(query)
    return aggregates.filter(a =>
      a.key.includes(q) ||
      a.variantNames.some(n => normalizeExerciseName(n).includes(q)),
    )
  }, [aggregates, query])

  async function applyRename(agg: ExerciseAggregate) {
    const newName = renameValue.trim()
    if (!newName) return
    setBusy(true)
    try {
      await renameExerciseEverywhere(agg.key, newName, normalizeExerciseName)
      setRenamingKey(null)
      setRenameValue('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function mergeInto(source: ExerciseAggregate, targetName: string) {
    const ok = await confirm({
      title: `Fusionner "${source.displayName}" dans "${targetName}" ?`,
      description: `Toutes les séries de "${source.displayName}" seront renommées en "${targetName}". Action irréversible.`,
      confirmLabel: 'Fusionner',
    })
    if (!ok) return
    setBusy(true)
    try {
      await renameExerciseEverywhere(source.key, targetName, normalizeExerciseName)
      await load()
    } finally {
      setBusy(false)
    }
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
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--color-text-dim)] font-medium">Bibliothèque</p>
          <h1 className="font-display text-2xl tracking-tight">Mes exercices</h1>
        </div>
      </header>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--color-text-dim)]" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filtrer…"
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Aucun exercice" subtitle="Dès que tu loges des séries, ils apparaîtront ici." />
      ) : (
        <div className="space-y-2">
          {filtered.map(agg => (
            <Card key={agg.key} className="p-4">
              {renamingKey === agg.key ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    placeholder="Nouveau nom"
                    autoFocus
                    className="flex-1"
                  />
                  <Button variant="accent" size="icon" onClick={() => applyRename(agg)} disabled={busy || !renameValue.trim()} aria-label="Valider">
                    <Check size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setRenamingKey(null); setRenameValue('') }} aria-label="Annuler">
                    <X size={16} />
                  </Button>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => nav(`/exercise/${slugifyExerciseName(agg.displayName)}?key=${encodeURIComponent(agg.key)}`)}
                    className="flex-1 min-w-0 text-left cursor-pointer group"
                  >
                    <p className="font-medium truncate group-hover:text-[color:var(--color-accent)] transition-colors">{agg.displayName}</p>
                    <div className="flex items-center gap-2 text-[11px] text-[color:var(--color-text-dim)] mt-1 flex-wrap">
                      <span>{agg.totalSets} séries</span>
                      <span className="opacity-40">·</span>
                      <span>Record: {formatWeight(agg.bestWeightKg, unit, 1)}</span>
                      <span className="opacity-40">·</span>
                      <span>Volume: {formatBigNum(fromKg(agg.totalVolumeKg, unit))} {unit}</span>
                      {agg.lastUsedIso && (
                        <>
                          <span className="opacity-40">·</span>
                          <span>Vu {format(parseISO(agg.lastUsedIso), 'd MMM', { locale: fr })}</span>
                        </>
                      )}
                    </div>
                    {agg.variantNames.length > 1 && (
                      <p className="text-[10px] text-[color:var(--color-text-dim)] mt-1 italic truncate">
                        Variantes vues : {agg.variantNames.filter(v => v !== agg.displayName).join(', ')}
                      </p>
                    )}
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => { setRenamingKey(agg.key); setRenameValue(agg.displayName) }}
                          className="p-1.5 rounded-full text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-2)] transition-colors cursor-pointer"
                          aria-label="Renommer"
                        >
                          <Edit3 size={14} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left">Renommer toutes les occurrences</TooltipContent>
                    </Tooltip>
                    <MergeIntoMenu agg={agg} all={aggregates} onMerge={mergeInto} busy={busy} />
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  )
}

function MergeIntoMenu({
  agg,
  all,
  onMerge,
  busy,
}: {
  agg: ExerciseAggregate
  all: ExerciseAggregate[]
  onMerge: (source: ExerciseAggregate, targetName: string) => void
  busy: boolean
}) {
  const [open, setOpen] = useState(false)
  const candidates = all.filter(a => a.key !== agg.key).slice(0, 8)

  if (candidates.length === 0) return null

  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(v => !v)}
            disabled={busy}
            className="p-1.5 rounded-full text-[color:var(--color-text-dim)] hover:text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent-soft)] transition-colors cursor-pointer"
            aria-label="Fusionner"
          >
            <ArrowRight size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Fusionner dans un autre</TooltipContent>
      </Tooltip>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-2xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-1 shadow-xl">
            <p className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-medium">Fusionner dans</p>
            {candidates.map(c => (
              <button
                key={c.key}
                onClick={() => { setOpen(false); onMerge(agg, c.displayName) }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-[color:var(--color-surface-2)] text-sm truncate cursor-pointer"
              >
                {c.displayName}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function formatBigNum(v: number): string {
  if (v >= 1000) return `${Math.round((v / 1000) * 10) / 10}k`
  return String(Math.round(v))
}
