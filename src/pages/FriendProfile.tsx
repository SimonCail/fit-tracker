import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, SmilePlus, UserMinus } from 'lucide-react'
import { format, parseISO, startOfWeek, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Button, Card, Disc, EmptyState, ErrorNote, Modal, ModalContent, ModalTitle, Segmented, SectionTitle, Skeleton, Tag, useConfirm } from '../components/ui'
import { PageHeader } from '../components/Layout'
import { listSessions } from '../lib/db'
import { cachedFriendSessions, cachedProfile, getFriend, isPermissionDenied, listFriendSessions, removeFriend, type Friend } from '../lib/friends'
import { computeRecords, runningRecords, type ExerciseRecord } from '../lib/records'
import { setMaxWeightKg, setVolumeKg } from '../lib/setMath'
import { frNum, fromKg, type Unit } from '../lib/units'
import { useSettings } from '../store/settings'
import { cn } from '../lib/cn'
import type { Session } from '../lib/types'
import { Avatar } from '../components/Avatar'
import { useAuth } from '../hooks/useAuth'
import { displayNameFor } from '../lib/friends'
import { QUICK_REACTIONS, groupReactions, listReactions, setReaction, type Reaction } from '../lib/reactions'
import { EmojiPicker } from '../components/EmojiPicker'
import { weeklyStreak } from '../lib/streak'

type View = 'compare' | 'records' | 'sessions'

export function FriendProfilePage() {
  const { uid = '' } = useParams()
  const nav = useNavigate()
  const confirm = useConfirm()
  const unit = useSettings(s => s.unit)
  // Shown at once from what the Amis page already loaded, then refreshed.
  const [friend, setFriend] = useState<Friend | null>(() => {
    const p = cachedProfile(uid)
    return p ? { uid, name: p.name, photo: p.photo, since: 0 } : null
  })
  const [theirs, setTheirs] = useState<Session[] | null>(() => cachedFriendSessions(uid) ?? null)
  const [mine, setMine] = useState<Session[]>([])
  const [error, setError] = useState<string | null>(null)
  const [gone, setGone] = useState(false)
  const [view, setView] = useState<View>('compare')

  useEffect(() => {
    let alive = true
    listSessions(500).then(m => { if (alive) setMine(m) }).catch(() => {})
    ;(async () => {
      // In parallel: the friendship check doesn't hold up the sessions.
      const [f, t] = await Promise.all([getFriend(uid), listFriendSessions(uid)])
      if (!alive) return
      if (!f) { setGone(true); return }
      setFriend(f)
      setTheirs(t)
    })().catch(e => {
      if (!alive) return
      if (isPermissionDenied(e)) setGone(true)
      else setError((e as Error).message)
    })
    return () => { alive = false }
  }, [uid])

  const theirRecords = useMemo(() => computeRecords(theirs ?? []), [theirs])
  const myRecords = useMemo(() => computeRecords(mine), [mine])
  const run = useMemo(() => runningRecords(theirs ?? []), [theirs])
  const stats = useMemo(() => activityStats(theirs ?? []), [theirs])
  const streak = useMemo(() => weeklyStreak(theirs ?? [], 1), [theirs])

  const duel = useMemo(() => {
    const myMap = new Map(myRecords.records.map(r => [r.key, r]))
    return theirRecords.records
      .filter(r => myMap.has(r.key))
      .map(r => ({ theirs: r, mine: myMap.get(r.key)! }))
      .sort((a, b) => b.theirs.date.localeCompare(a.theirs.date))
  }, [myRecords, theirRecords])

  async function onRemove() {
    if (!friend) return
    const ok = await confirm({
      title: `Retirer ${friend.name} ?`,
      description: 'Vous ne verrez plus les séances l’un de l’autre. Vous pourrez vous rajouter avec vos codes.',
      confirmLabel: 'Retirer',
      danger: true,
    })
    if (!ok) return
    await removeFriend(friend.uid)
    nav('/friends', { replace: true })
  }

  if (gone) {
    return (
      <>
        <PageHeader back title="Ami" />
        <EmptyState title="Plus dans tes amis" subtitle="Cette personne ne fait plus partie de tes amis, ses séances ne sont donc plus visibles." />
      </>
    )
  }
  if (error) return <><PageHeader back title="Ami" /><ErrorNote message={error} /></>
  if (!friend || !theirs) {
    return (
      <>
        <PageHeader back title=" " />
        <Skeleton className="h-28 rounded-[var(--radius-card)]" />
        <Skeleton className="h-80 rounded-[var(--radius-card)] mt-6" />
      </>
    )
  }

  const hasDuel = duel.length > 0
  const activeView: View = view === 'compare' && !hasDuel ? 'records' : view

  return (
    <>
      <PageHeader
        back
        title={
          <span className="flex items-center gap-3">
            <Avatar name={friend.name} photo={friend.photo} size={48} />
            <span className="min-w-0 break-words">{friend.name}</span>
          </span>
        }
        kicker={friend.since ? `Amis depuis ${format(friend.since, 'MMMM yyyy', { locale: fr })}` : undefined}
      />

      <div className="grid grid-cols-3 gap-2 min-w-0">
        <Stat label="Cette semaine" value={stats.week} />
        <Stat label="30 derniers jours" value={stats.month} />
        <Stat label={streak.current > 1 ? 'Semaines d’affilée' : 'Semaine d’affilée'} value={streak.current} />
      </div>

      {theirs.length === 0 ? (
        <EmptyState title="Pas encore de séance" subtitle={`Dès que ${friend.name} note une séance, elle apparaît ici.`} />
      ) : (
        <>
          <Segmented
            className="mt-8"
            value={activeView}
            onChange={setView}
            options={[
              ...(hasDuel ? [{ value: 'compare' as const, label: 'Face à face' }] : []),
              { value: 'records', label: 'Records' },
              { value: 'sessions', label: 'Séances' },
            ]}
          />

          <div className="mt-6">
            {activeView === 'compare' && <Compare rows={duel} unit={unit} name={friend.name} />}
            {activeView === 'records' && <RecordsView records={theirRecords.records} events={theirRecords.events} run={run} unit={unit} />}
            {activeView === 'sessions' && <SessionsView sessions={theirs} unit={unit} owner={friend.uid} />}
          </div>
        </>
      )}

      <Button variant="danger-soft" className="w-full sm:w-auto mt-12" onClick={onRemove}>
        <UserMinus size={18} /> Retirer de mes amis
      </Button>
    </>
  )
}

function isLogged(s: Session) {
  return s.type === 'running' ? (s.distanceMeters ?? 0) > 0 || (s.durationSeconds ?? 0) > 0 : s.exercises.some(e => e.sets.length > 0)
}

function activityStats(sessions: Session[]) {
  const logged = sessions.filter(isLogged)
  const week = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const month = format(subDays(new Date(), 29), 'yyyy-MM-dd')
  return {
    week: logged.filter(s => s.date >= week).length,
    month: logged.filter(s => s.date >= month).length,
  }
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="px-3.5 py-3">
      <p className="num text-[32px] leading-none">{value}</p>
      <p className="text-[12px] text-dim mt-1.5 leading-tight">{label}</p>
    </Card>
  )
}

function loadStr(w: number, bw: boolean, unit: Unit) {
  if (bw) return w > 0 ? `+${frNum(fromKg(w, unit), 1)}` : 'PDC'
  return frNum(fromKg(w, unit), 1)
}

/** Compare by heaviest load, then reps at that load. */
function cmp(a: ExerciseRecord, b: ExerciseRecord) {
  return a.weight - b.weight || a.reps - b.reps
}

function Compare({ rows, unit, name }: { rows: { theirs: ExerciseRecord; mine: ExerciseRecord }[]; unit: Unit; name: string }) {
  const firstName = name.split(/\s+/)[0]
  const wins = rows.filter(r => cmp(r.mine, r.theirs) > 0).length
  const losses = rows.filter(r => cmp(r.mine, r.theirs) < 0).length
  return (
    <section>
      <SectionTitle action={<span className="text-[13px] text-dim">{wins} pour toi, {losses} pour {firstName}</span>}>
        Exercices en commun
      </SectionTitle>
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-3 px-4 py-2.5 text-[12px] font-semibold text-faint hairline-b">
          <span>Exercice</span>
          <span className="text-right">Toi</span>
          <span className="text-right truncate">{firstName}</span>
        </div>
        {rows.map(({ theirs, mine }) => {
          const c = cmp(mine, theirs)
          return (
            <div key={theirs.key} className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-3 px-4 py-3 hairline-b last:shadow-none">
              <span className="flex items-center gap-2 min-w-0">
                <span className="font-semibold truncate">{theirs.name}</span>
                {(theirs.bodyweight || mine.bodyweight) && <Tag>PDC</Tag>}
              </span>
              <Cell r={mine} unit={unit} lead={c > 0} />
              <Cell r={theirs} unit={unit} lead={c < 0} />
            </div>
          )
        })}
      </Card>
      <p className="text-[12px] text-faint mt-2 px-1">Meilleure charge sur chaque exercice que vous faites tous les deux, puis le nombre de reps à cette charge.</p>
    </section>
  )
}

function Cell({ r, unit, lead }: { r: ExerciseRecord; unit: Unit; lead: boolean }) {
  return (
    <span className={cn('text-right whitespace-nowrap', lead ? 'text-ink' : 'text-dim')}>
      {lead && <Disc plate="pr" size={10} className="inline-block mr-1 -translate-y-[3px]" />}
      <span className="num text-[22px]">{loadStr(r.weight, r.bodyweight, unit)}</span>
      <span className="num-light text-[15px] ml-0.5">×{r.reps}</span>
    </span>
  )
}

function RecordsView({
  records,
  events,
  run,
  unit,
}: {
  records: ExerciseRecord[]
  events: ReturnType<typeof computeRecords>['events']
  run: ReturnType<typeof runningRecords>
  unit: Unit
}) {
  const sorted = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date)), [records])
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-x-8 items-start">
      <section>
        <SectionTitle>Palmarès</SectionTitle>
        {sorted.length === 0 ? (
          <p className="text-dim px-1">Aucune série notée pour l’instant.</p>
        ) : (
          <Card className="overflow-hidden">
            {sorted.map(r => (
              <div key={r.key} className="flex items-center gap-3 px-4 py-3 hairline-b last:shadow-none">
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold truncate">{r.name}</span>
                    {r.bodyweight && <Tag>PDC</Tag>}
                  </span>
                  <span className="block text-[13px] text-dim">
                    {format(parseISO(r.date), 'd MMM yy', { locale: fr })}
                    {r.e1rm > 0 ? `, 1RM estimé ${frNum(fromKg(r.e1rm, unit), 0)} ${unit}` : ''}
                  </span>
                </span>
                <span className="text-right whitespace-nowrap">
                  <span className="num text-[24px]">{loadStr(r.weight, r.bodyweight, unit)}</span>
                  {!(r.bodyweight && r.weight <= 0) && <span className="text-[12px] font-semibold text-dim ml-0.5">{unit}</span>}
                  <span className="num-light text-[18px] text-dim ml-1">×{r.reps}</span>
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="space-y-10">
        {events.length > 0 && (
          <div>
            <SectionTitle>Derniers records battus</SectionTitle>
            <Card className="overflow-hidden">
              {events.slice(0, 6).map((e, i) => (
                <div key={`${e.key}-${e.date}-${i}`} className="flex items-center gap-3 px-4 py-3 hairline-b last:shadow-none">
                  <Disc plate="pr" size={20} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate">{e.name}</span>
                    <span className="block text-[13px] text-dim">{format(parseISO(e.date), 'd MMMM', { locale: fr })}</span>
                  </span>
                  <span className="num text-[22px] shrink-0">
                    {loadStr(e.weight, e.bodyweight, unit)}
                    <span className="text-[12px] font-semibold text-dim ml-0.5">{unit}</span>
                  </span>
                </div>
              ))}
            </Card>
          </div>
        )}
        {(run.pace || run.far) && (
          <div>
            <SectionTitle>Course</SectionTitle>
            <Card className="overflow-hidden">
              {run.pace && <RunLine label="Meilleure allure" value={paceStr(run.pace.value)} suffix="/km" />}
              {run.far && <RunLine label="Plus longue distance" value={frNum(run.far.value, 1)} suffix="km" />}
              {run.long && <RunLine label="Plus longue durée" value={durationStr(run.long.value)} />}
            </Card>
          </div>
        )}
      </section>
    </div>
  )
}

function RunLine({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hairline-b last:shadow-none">
      <Disc plate="run" size={20} />
      <span className="flex-1 font-semibold">{label}</span>
      <span className="num text-[24px]">
        {value}
        {suffix && <span className="text-[12px] font-semibold text-dim ml-0.5">{suffix}</span>}
      </span>
    </div>
  )
}

type KindFilter = 'all' | 'strength' | 'running'
type DateOrder = 'recent' | 'oldest'

function SessionsView({ sessions, unit, owner }: { sessions: Session[]; unit: Unit; owner: string }) {
  const [kind, setKind] = useState<KindFilter>('all')
  const [order, setOrder] = useState<DateOrder>('recent')
  const [shown, setShown] = useState(12)
  const [open, setOpen] = useState<string | null>(null)

  const allLogged = useMemo(() => sessions.filter(isLogged), [sessions])
  const hasBoth = allLogged.some(s => s.type === 'running') && allLogged.some(s => s.type !== 'running')
  const logged = useMemo(() => {
    const list = allLogged.filter(s => kind === 'all' || (kind === 'running' ? s.type === 'running' : s.type !== 'running'))
    return order === 'recent' ? list : [...list].reverse()
  }, [allLogged, kind, order])

  if (allLogged.length === 0) return <p className="text-dim px-1">Aucune séance remplie pour l’instant.</p>
  return (
    <section>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {hasBoth && (
          <Segmented
            size="sm"
            className="w-[240px]"
            value={kind}
            onChange={v => { setKind(v); setShown(12) }}
            options={[{ value: 'all', label: 'Tout' }, { value: 'strength', label: 'Muscu' }, { value: 'running', label: 'Course' }]}
          />
        )}
        <Segmented
          size="sm"
          className="w-[230px]"
          value={order}
          onChange={v => { setOrder(v); setShown(12) }}
          options={[{ value: 'recent', label: 'Plus récentes' }, { value: 'oldest', label: 'Plus anciennes' }]}
        />
        <span className="text-[13px] text-dim ml-auto">{logged.length} séance{logged.length > 1 ? 's' : ''}</span>
      </div>
      <Card className="overflow-hidden">
        {logged.slice(0, shown).map(s => {
          const isOpen = open === s.id
          const running = s.type === 'running'
          const volume = s.exercises.reduce((v, e) => v + e.sets.reduce((a, set) => a + setVolumeKg(set), 0), 0)
          return (
            <div key={s.id} className="hairline-b last:shadow-none">
              <button
                onClick={() => setOpen(isOpen ? null : s.id)}
                aria-expanded={isOpen}
                disabled={running}
                className="w-full text-left flex items-center gap-3 px-4 py-3 cursor-pointer disabled:cursor-default enabled:active:bg-surface-2 enabled:hover:bg-surface-2/60"
              >
                <Disc plate={running ? 'run' : 'lift'} size={20} />
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold first-letter:uppercase">
                    {format(parseISO(s.date), 'EEEE d MMMM', { locale: fr })}
                  </span>
                  <span className="block text-[13px] text-dim truncate">
                    {running
                      ? [s.distanceMeters ? `${frNum(s.distanceMeters / 1000, 1)} km` : null, s.durationSeconds ? durationStr(s.durationSeconds) : null, s.route].filter(Boolean).join(', ')
                      : s.exercises.filter(e => e.sets.length > 0).map(e => e.name).join(', ')}
                  </span>
                </span>
                {!running && (
                  <>
                    <span className="text-right shrink-0">
                      <span className="num text-[20px]">{frNum(fromKg(volume, unit) / 1000, 1)}</span>
                      <span className="text-[11px] font-semibold text-dim ml-0.5">{unit === 'kg' ? 't' : 'k lb'}</span>
                    </span>
                    <ChevronDown size={16} className={cn('text-faint shrink-0 transition-transform', isOpen && 'rotate-180')} />
                  </>
                )}
              </button>
              {isOpen && !running && (
                <div className="px-4 pb-4 pl-[3.25rem] space-y-2.5">
                  {s.exercises.filter(e => e.sets.length > 0).map(e => (
                    <div key={e.id}>
                      <p className="text-[14px] font-semibold">{e.name}</p>
                      <p className="text-[14px] text-dim num-light">
                        {e.sets
                          .map(set => `${loadStr(setMaxWeightKg(set), !!e.bodyweight, unit)}×${set.reps}${set.drops?.length ? '+' : ''}`)
                          .join('  ·  ')}
                      </p>
                    </div>
                  ))}
                  {s.notes && <p className="text-[13px] text-faint italic">{s.notes}</p>}
                </div>
              )}
              <ReactionBar owner={owner} sessionId={s.id} />
            </div>
          )
        })}
      </Card>
      {logged.length > shown && (
        <Button variant="ghost" className="w-full mt-2" onClick={() => setShown(n => n + 12)}>
          Voir plus
        </Button>
      )}
      <p className="text-[12px] text-faint mt-2 px-1">Volume de la séance = reps × charge, toutes séries confondues.</p>
    </section>
  )
}

/**
 * Reactions under a friend's session. Existing reactions show as pills (tap one to add
 * yours with the same emoji); "Réagir" opens a panel with shortcuts and the full emoji
 * picker (every emoji, search, skin tones). One reaction per person.
 */
function ReactionBar({ owner, sessionId }: { owner: string; sessionId: string }) {
  const { user } = useAuth()
  const preferredName = useSettings(s => s.profile.name)
  const [list, setList] = useState<Reaction[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    let alive = true
    listReactions(owner, sessionId).then(r => { if (alive) setList(r) }).catch(() => { if (alive) setList([]) })
    return () => { alive = false }
  }, [owner, sessionId])

  if (!user || list === null) return <div className="h-12" aria-hidden />
  const me = user.uid
  const mine = list.find(r => r.uid === me)?.emoji ?? null
  const groups = groupReactions(list)

  /** Toggle: the same emoji as mine removes it, any other replaces it. */
  async function react(emoji: string | null) {
    if (busy) return
    const next = emoji === mine ? null : emoji
    const name = displayNameFor(user!, preferredName)
    const before = list
    setList(prev => {
      const rest = (prev ?? []).filter(r => r.uid !== me)
      return next ? [...rest, { uid: me, emoji: next, name, at: Date.now() }] : rest
    })
    setPicking(false)
    setBusy(true)
    try {
      await setReaction(owner, sessionId, next, name)
    } catch {
      setList(before) // revert if the write was refused
    } finally {
      setBusy(false)
    }
  }

  // "Toi, Simon et Léa" style line.
  const names = list
    .slice()
    .sort((a, b) => (a.uid === me ? -1 : b.uid === me ? 1 : a.at - b.at))
    .map(r => (r.uid === me ? 'Toi' : r.name.split(/\s+/)[0]))
  const who = names.length <= 1 ? names[0] : `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`

  return (
    <div className="px-4 pb-3.5 pl-[3.25rem]">
      <div className="flex items-center gap-1.5 flex-wrap">
        {groups.map(g => {
          const isMine = g.emoji === mine
          return (
            <button
              key={g.emoji}
              type="button"
              onClick={() => react(g.emoji)}
              aria-pressed={isMine}
              aria-label={`${g.emoji}, ${g.people.length} réaction${g.people.length > 1 ? 's' : ''}${isMine ? ', la tienne : touche pour la retirer' : ''}`}
              className={cn(
                'h-10 pl-2.5 pr-3 rounded-full flex items-center gap-1.5 cursor-pointer transition-colors',
                isMine ? 'bg-accent/15 shadow-[inset_0_0_0_1.5px_var(--color-accent)]' : 'bg-surface-2 hover:bg-line',
              )}
            >
              <span className="text-[17px] leading-none" aria-hidden>{g.emoji}</span>
              <span className="num text-[16px]">{g.people.length}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="h-10 px-3 rounded-full flex items-center gap-1.5 text-[13px] font-semibold text-dim hover:text-ink hover:bg-surface-2 cursor-pointer transition-colors"
        >
          <SmilePlus size={16} /> {mine ? 'Changer' : 'Réagir'}
        </button>
      </div>

      {list.length > 0 && (
        <p className="text-[12px] text-dim mt-1.5">{who} {list.length > 1 ? 'ont' : names[0] === 'Toi' ? 'as' : 'a'} réagi</p>
      )}

      <Modal open={picking} onOpenChange={setPicking}>
        <ModalContent className="sm:max-w-md">
          <ModalTitle className="t-title text-[24px]">Réagir</ModalTitle>
          <div className="grid grid-cols-8 gap-1 mt-3">
            {QUICK_REACTIONS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => react(e)}
                aria-label={`Réagir ${e}`}
                className={cn(
                  'aspect-square rounded-[10px] grid place-items-center text-[24px] cursor-pointer transition-colors',
                  mine === e ? 'bg-accent/20 shadow-[inset_0_0_0_1.5px_var(--color-accent)]' : 'hover:bg-surface-2 active:bg-surface-2',
                )}
              >
                {e}
              </button>
            ))}
          </div>
          {/* data-no-swipe: scrolling the emoji grid must not close the sheet. */}
          <div className="mt-3 -mx-1" data-no-swipe>
            <EmojiPicker onPick={e => react(e)} height={340} />
          </div>
          {mine && (
            <Button variant="ghost" className="w-full mt-2" onClick={() => react(null)}>
              Retirer ma réaction {mine}
            </Button>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}

function paceStr(secPerKm: number) {
  const t = Math.round(secPerKm)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}
function durationStr(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}