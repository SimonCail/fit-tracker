import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, GitMerge, LineChart, MoreHorizontal, PersonStanding, Search, SquarePen, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Button, Card, EmptyState, Input, Modal, ModalContent, ModalTitle, Skeleton, Tag, useConfirm } from '../components/ui'
import { PageHeader } from '../components/Layout'
import { getExerciseAggregates, listWeighIns, renameExerciseEverywhere, setExerciseBodyweightEverywhere, type ExerciseAggregate } from '../lib/db'
import { normalizeExerciseName, slugifyExerciseName } from '../lib/exerciseName'
import { frNum, fromKg } from '../lib/units'
import { useSettings } from '../store/settings'
import { cn } from '../lib/cn'

type Panel = 'menu' | 'rename' | 'merge'

export function ExercisesPage() {
  const nav = useNavigate()
  const { unit } = useSettings()
  const confirm = useConfirm()
  const [aggregates, setAggregates] = useState<ExerciseAggregate[]>([])
  const [latestBwKg, setLatestBwKg] = useState(0)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<ExerciseAggregate | null>(null)
  const [panel, setPanel] = useState<Panel>('menu')
  const [renameValue, setRenameValue] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const [res, weighIns] = await Promise.all([getExerciseAggregates(normalizeExerciseName), listWeighIns(20)])
      setAggregates(res)
      setLatestBwKg(weighIns[0]?.weight ?? 0)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return aggregates
    const q = normalizeExerciseName(query)
    return aggregates.filter(a => a.key.includes(q) || a.variantNames.some(n => normalizeExerciseName(n).includes(q)))
  }, [aggregates, query])

  function openMenu(agg: ExerciseAggregate) {
    setActive(agg)
    setPanel('menu')
    setRenameValue(agg.displayName)
  }

  function closeMenu() {
    setActive(null)
  }

  function openHistory(agg: ExerciseAggregate) {
    nav(`/exercise/${slugifyExerciseName(agg.displayName)}?key=${encodeURIComponent(agg.key)}`)
  }

  async function toggleBodyweight(agg: ExerciseAggregate) {
    closeMenu()
    if (agg.bodyweight) {
      const ok = await confirm({
        title: `Ne plus compter « ${agg.displayName} » au poids du corps ?`,
        description: 'Les charges déjà notées restent telles quelles, mais ton poids de corps ne sera plus ajouté dans les totaux.',
        confirmLabel: 'Désactiver',
      })
      if (!ok) return
      setBusy(true)
      try {
        await setExerciseBodyweightEverywhere(agg.key, false, 0, normalizeExerciseName)
        await load()
      } finally {
        setBusy(false)
      }
      return
    }
    let convertExisting = false
    if (latestBwKg > 0 && agg.bestWeightKg > 0) {
      convertExisting = await confirm({
        title: `Compter « ${agg.displayName} » au poids du corps`,
        description: `Tes anciennes séries incluent-elles ton poids ? Si oui, on retire ${frNum(latestBwKg, 1)} kg de chaque série pour ne garder que le lest. Sinon, elles sont gardées telles quelles comme du lest.`,
        confirmLabel: `Retirer ${frNum(latestBwKg, 1)} kg`,
        cancelLabel: 'Garder tel quel',
      })
    } else {
      const ok = await confirm({
        title: `Compter « ${agg.displayName} » au poids du corps`,
        description: 'La charge devient facultative : 0 = poids du corps seul, une valeur = lest ajouté.',
        confirmLabel: 'Activer',
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      await setExerciseBodyweightEverywhere(agg.key, true, convertExisting ? latestBwKg : 0, normalizeExerciseName)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function applyRename(e: React.FormEvent) {
    e.preventDefault()
    if (!active) return
    const newName = renameValue.trim()
    if (!newName) return
    setBusy(true)
    try {
      await renameExerciseEverywhere(active.key, newName, normalizeExerciseName)
      closeMenu()
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function mergeInto(source: ExerciseAggregate, targetName: string) {
    closeMenu()
    const ok = await confirm({
      title: `Fusionner dans « ${targetName} » ?`,
      description: `Les ${source.totalSets} séries de « ${source.displayName} » seront rattachées à « ${targetName} ». Impossible d’annuler.`,
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
    <>
      <PageHeader title="Exercices" />

      <div className="relative mb-5 lg:max-w-xl">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Chercher un exercice" className="pl-11" type="search" aria-label="Chercher un exercice" />
      </div>

      {loading ? (
        <Skeleton className="h-80 rounded-[var(--radius-card)]" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query ? 'Aucun exercice trouvé' : 'Aucun exercice pour l’instant'}
          subtitle={query ? 'Vérifie l’orthographe ou essaie un mot plus court.' : 'Chaque exercice que tu ajoutes dans une séance apparaît ici avec ses records.'}
        />
      ) : (
        <Card className={cn('overflow-hidden lg:grid lg:grid-cols-2 lg:gap-x-6', busy && 'opacity-60 pointer-events-none')}>
          {filtered.map(agg => (
            <div key={agg.key} className="flex items-center hairline-b last:shadow-none">
              <button onClick={() => openHistory(agg)} className="flex-1 min-w-0 flex items-center gap-3 pl-4 py-3.5 text-left cursor-pointer active:bg-surface-2">
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold truncate">{agg.displayName}</span>
                    {agg.bodyweight && <Tag>PDC</Tag>}
                  </span>
                  <span className="block text-[13px] text-dim truncate">
                    {agg.totalSets} série{agg.totalSets > 1 ? 's' : ''}
                    {agg.lastUsedIso && `, dernière fois le ${format(parseISO(agg.lastUsedIso), 'd MMM', { locale: fr })}`}
                  </span>
                </span>
                {agg.bestWeightKg > 0 && (
                  <span className="shrink-0 text-right">
                    <span className="flex items-baseline justify-end gap-0.5">
                      <span className="num text-[22px]">{agg.bodyweight ? '+' : ''}{frNum(fromKg(agg.bestWeightKg, unit), 1)}</span>
                      <span className="text-[12px] font-semibold text-dim">{unit}</span>
                    </span>
                    <span className="block text-[11px] text-faint">record</span>
                  </span>
                )}
              </button>
              <button onClick={() => openMenu(agg)} className="h-14 w-12 grid place-items-center text-faint hover:text-ink cursor-pointer shrink-0" aria-label={`Options pour ${agg.displayName}`}>
                <MoreHorizontal size={20} />
              </button>
            </div>
          ))}
        </Card>
      )}

      <Modal open={!!active} onOpenChange={o => { if (!o) closeMenu() }}>
        <ModalContent>
          {active && panel === 'menu' && (
            <>
              <ModalTitle className="t-title text-[24px] pr-8">{active.displayName}</ModalTitle>
              {active.variantNames.length > 1 && (
                <p className="text-[14px] text-dim mt-1">
                  Aussi écrit : {active.variantNames.filter(v => v !== active.displayName).join(', ')}
                </p>
              )}
              <div className="mt-5 rounded-[12px] bg-surface-2 overflow-hidden">
                <MenuRow icon={<LineChart size={19} />} label="Voir la progression" onClick={() => { closeMenu(); openHistory(active) }} />
                <MenuRow icon={<SquarePen size={19} />} label="Renommer partout" onClick={() => setPanel('rename')} />
                <MenuRow
                  icon={<PersonStanding size={19} />}
                  label={active.bodyweight ? 'Ne plus compter au poids du corps' : 'Compter au poids du corps'}
                  onClick={() => toggleBodyweight(active)}
                />
                {aggregates.length > 1 && (
                  <MenuRow icon={<GitMerge size={19} />} label="Fusionner avec un autre exercice" onClick={() => setPanel('merge')} />
                )}
              </div>
            </>
          )}

          {active && panel === 'rename' && (
            <form onSubmit={applyRename}>
              <ModalTitle className="t-title text-[24px]">Renommer</ModalTitle>
              <p className="text-[14px] text-dim mt-1">Le nouveau nom s’applique à toutes tes séances passées.</p>
              <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} autoFocus className="mt-5" aria-label="Nouveau nom" />
              <div className="grid grid-cols-2 gap-2 mt-5">
                <Button type="button" variant="secondary" onClick={() => setPanel('menu')}>Retour</Button>
                <Button type="submit" disabled={busy || !renameValue.trim() || renameValue.trim() === active.displayName}>Renommer</Button>
              </div>
            </form>
          )}

          {active && panel === 'merge' && (
            <>
              <ModalTitle className="t-title text-[24px]">Fusionner dans…</ModalTitle>
              <p className="text-[14px] text-dim mt-1">Pratique pour regrouper deux orthographes du même exercice.</p>
              <div className="mt-5 rounded-[12px] bg-surface-2 overflow-hidden max-h-[45dvh] overflow-y-auto">
                {aggregates.filter(a => a.key !== active.key).map(c => (
                  <button
                    key={c.key}
                    onClick={() => mergeInto(active, c.displayName)}
                    className="w-full text-left flex items-center gap-3 px-4 h-[52px] hairline-b last:shadow-none cursor-pointer active:bg-line/50"
                  >
                    <span className="flex-1 font-medium truncate">{c.displayName}</span>
                    <span className="text-[13px] text-faint">{c.totalSets} séries</span>
                  </button>
                ))}
              </div>
              <Button variant="secondary" className="w-full mt-4" onClick={() => setPanel('menu')}>Retour</Button>
            </>
          )}

          <button onClick={closeMenu} className="absolute right-3 top-3 sm:top-4 h-10 w-10 grid place-items-center rounded-full bg-surface-2 text-dim cursor-pointer" aria-label="Fermer">
            <X size={18} />
          </button>
        </ModalContent>
      </Modal>
    </>
  )
}

function MenuRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left flex items-center gap-3.5 px-4 h-[54px] hairline-b last:shadow-none cursor-pointer active:bg-line/50">
      <span className="text-dim">{icon}</span>
      <span className="flex-1 font-medium">{label}</span>
      <ChevronRight size={18} className="text-faint" />
    </button>
  )
}