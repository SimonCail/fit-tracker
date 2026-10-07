import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Card, Disc, EmptyState, ErrorNote, Segmented, SectionTitle, Skeleton, Tag } from '../components/ui'
import { PageHeader } from '../components/Layout'
import { listSessions } from '../lib/db'
import type { Session } from '../lib/types'
import { computeRecords, runningRecords, type ExerciseRecord } from '../lib/records'
import { slugifyExerciseName } from '../lib/exerciseName'
import { frNum, fromKg } from '../lib/units'
import { useSettings } from '../store/settings'

type Sort = 'recent' | 'load' | 'name'

export function RecordsPage() {
  const nav = useNavigate()
  const { unit } = useSettings()
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('recent')

  useEffect(() => {
    listSessions(500).then(setSessions).catch(e => setError((e as Error).message))
  }, [])

  const { records, events } = useMemo(() => computeRecords(sessions ?? []), [sessions])
  const run = useMemo(() => runningRecords(sessions ?? []), [sessions])

  const sorted = useMemo(() => {
    const r = [...records]
    if (sort === 'recent') r.sort((a, b) => b.date.localeCompare(a.date))
    if (sort === 'load') r.sort((a, b) => b.weight - a.weight || b.reps - a.reps)
    if (sort === 'name') r.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    return r
  }, [records, sort])

  const load = (w: number, bw: boolean) => (bw ? (w > 0 ? `+${frNum(fromKg(w, unit), 1)}` : 'PDC') : frNum(fromKg(w, unit), 1))
  const open = (r: { name: string; key: string }) => nav(`/exercise/${slugifyExerciseName(r.name)}?key=${encodeURIComponent(r.key)}`)

  if (error) return <><PageHeader back title="Records" /><ErrorNote message={error} /></>
  if (!sessions) return <><PageHeader back title="Records" /><Skeleton className="h-96 rounded-[var(--radius-card)]" /></>
  if (records.length === 0 && !run.far) {
    return (
      <>
        <PageHeader back title="Records" />
        <EmptyState title="Pas encore de record" subtitle="Dès que tu notes des séries, ta meilleure charge sur chaque exercice apparaît ici, datée." />
      </>
    )
  }

  return (
    <>
      <PageHeader back title="Records" kicker={`${records.length} exercice${records.length > 1 ? 's' : ''}`} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-x-8 items-start">
        {records.length > 0 && (
          <section>
            <SectionTitle
              action={
                <Segmented
                  size="sm"
                  className="w-[220px]"
                  value={sort}
                  onChange={setSort}
                  options={[{ value: 'recent', label: 'Récents' }, { value: 'load', label: 'Charge' }, { value: 'name', label: 'A–Z' }]}
                />
              }
            >
              Palmarès
            </SectionTitle>
            <Card className="overflow-hidden">
              <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_7rem_5.5rem_6rem_1.25rem] gap-3 px-4 py-2.5 text-[12px] font-semibold text-faint hairline-b">
                <span>Exercice</span>
                <span className="text-right">Meilleure série</span>
                <span className="text-right">1RM estimé</span>
                <span className="text-right">Date</span>
                <span />
              </div>
              {sorted.map(r => <RecordRow key={r.key} r={r} unit={unit} load={load} onClick={() => open(r)} />)}
            </Card>
            <p className="text-[12px] text-faint mt-2 px-1">1RM estimé avec la formule de Brzycki sur tes séries de 12 reps ou moins.</p>
          </section>
        )}
        <section>
          {events.length > 0 && (
            <>
              <SectionTitle>Derniers records battus</SectionTitle>
              <Card className="overflow-hidden">
                {events.slice(0, 8).map((e, i) => (
                  <button
                    key={`${e.key}-${e.date}-${i}`}
                    onClick={() => nav(`/session/${e.sessionId}`)}
                    className="w-full text-left flex items-center gap-3 px-4 py-3 hairline-b last:shadow-none cursor-pointer active:bg-surface-2 hover:bg-surface-2/60"
                  >
                    <Disc plate="pr" size={20} />
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold truncate">{e.name}</span>
                      <span className="block text-[13px] text-dim">
                        {format(parseISO(e.date), 'd MMMM yyyy', { locale: fr })}, avant {load(e.previous, e.bodyweight)} {unit}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block num text-[22px]">{load(e.weight, e.bodyweight)}<span className="text-[12px] font-semibold text-dim ml-0.5">{unit}</span></span>
                      <span className="block num-light text-[15px] text-pr">+{frNum(fromKg(e.weight - e.previous, unit), 1)}</span>
                    </span>
                  </button>
                ))}
              </Card>
            </>
          )}

          {(run.pace || run.far || run.long) && (
            <div className={events.length ? 'mt-10' : ''}>
              <SectionTitle>Course</SectionTitle>
              <Card className="overflow-hidden">
                {run.pace && <RunRow label="Meilleure allure" value={paceStr(run.pace.value)} unit="/km" date={run.pace.date} note={`sur ${frNum(run.pace.km, 1)} km`} onClick={() => nav(`/session/${run.pace!.id}`)} />}
                {run.far && <RunRow label="Plus longue distance" value={frNum(run.far.value, 1)} unit="km" date={run.far.date} onClick={() => nav(`/session/${run.far!.id}`)} />}
                {run.long && <RunRow label="Plus longue durée" value={durationStr(run.long.value)} date={run.long.date} onClick={() => nav(`/session/${run.long!.id}`)} />}
              </Card>
            </div>
          )}
        </section>

      </div>
    </>
  )
}

function RecordRow({ r, unit, load, onClick }: { r: ExerciseRecord; unit: string; load: (w: number, bw: boolean) => string; onClick: () => void }) {
  const date = format(parseISO(r.date), 'd MMM yy', { locale: fr })
  return (
    <button
      onClick={onClick}
      className="w-full text-left grid grid-cols-[minmax(0,1fr)_auto_1.25rem] sm:grid-cols-[minmax(0,1fr)_7rem_5.5rem_6rem_1.25rem] items-center gap-3 px-4 py-3 hairline-b last:shadow-none cursor-pointer active:bg-surface-2 hover:bg-surface-2/60"
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2 min-w-0">
          <span className="font-semibold truncate">{r.name}</span>
          {r.bodyweight && <Tag>PDC</Tag>}
        </span>
        <span className="sm:hidden block text-[13px] text-dim">
          {date}{r.e1rm > 0 ? `, 1RM estimé ${frNum(fromKg(r.e1rm, unit as 'kg'), 0)} ${unit}` : ''}
        </span>
      </span>
      <span className="text-right whitespace-nowrap">
        <span className="num text-[24px]">{load(r.weight, r.bodyweight)}</span>
        {!(r.bodyweight && r.weight <= 0) && <span className="text-[12px] font-semibold text-dim ml-0.5">{unit}</span>}
        <span className="num-light text-[18px] text-dim ml-1">×{r.reps}</span>
      </span>
      <span className="hidden sm:block text-right num-light text-[18px] text-dim">
        {r.e1rm > 0 ? `${frNum(fromKg(r.e1rm, unit as 'kg'), 0)}` : '–'}
      </span>
      <span className="hidden sm:block text-right text-[13px] text-dim">{date}</span>
      <ChevronRight size={16} className="text-faint" />
    </button>
  )
}

function RunRow({ label, value, unit, date, note, onClick }: { label: string; value: string; unit?: string; date: string; note?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left flex items-center gap-3 px-4 py-3 hairline-b last:shadow-none cursor-pointer active:bg-surface-2 hover:bg-surface-2/60">
      <Disc plate="run" size={20} />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold">{label}</span>
        <span className="block text-[13px] text-dim">{format(parseISO(date), 'd MMMM yyyy', { locale: fr })}{note ? `, ${note}` : ''}</span>
      </span>
      <span className="num text-[24px] shrink-0">{value}{unit && <span className="text-[12px] font-semibold text-dim ml-0.5">{unit}</span>}</span>
    </button>
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