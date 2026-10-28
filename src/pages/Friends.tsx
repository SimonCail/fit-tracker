import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, Check, ChevronRight, Copy, Search, Share2, UserPlus, Users, X } from 'lucide-react'
import { differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Button, Card, Disc, EmptyState, ErrorNote, Input, SectionTitle, Skeleton } from '../components/ui'
import { PageHeader } from '../components/Layout'
import { Avatar } from '../components/Avatar'
import { useAuth } from '../hooks/useAuth'
import { useSettings } from '../store/settings'
import {
  FriendError,
  acceptFriendRequest,
  cachedFriendSessions,
  cachedMyProfile,
  deleteFriendRequest,
  ensureProfile,
  listFriendSessions,
  refreshProfiles,
  useFriends,
  useIncomingRequests,
  useOutgoingRequests,
  withProfiles,
  normalizeCode,
  sendFriendRequest,
  setProfilePhoto,
  shareLink,
  type Friend,
  type FriendRequest,
  type PublicProfile,
} from '../lib/friends'
import type { Session } from '../lib/types'
import { fileToAvatar } from '../lib/photo'

type FriendSummary = { lastDate: string | null; thisWeek: number }

export function FriendsPage() {
  const { user } = useAuth()
  const preferredName = useSettings(s => s.profile.name)
  const [params, setParams] = useSearchParams()

  const [me, setMe] = useState<PublicProfile | null>(() => (user ? cachedMyProfile(user.uid) : null))
  // Live: a request sent or accepted by someone shows up here without reloading the page.
  const friendsLive = useFriends()
  const incoming = useIncomingRequests().data ?? []
  const outgoing = useOutgoingRequests().data ?? []
  const [profilesVersion, setProfilesVersion] = useState(0)
  const friends = useMemo(
    () => (friendsLive.data ? withProfiles(friendsLive.data) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- profilesVersion: the profile cache was filled
    [friendsLive.data, profilesVersion],
  )
  const [summaries, setSummaries] = useState<Record<string, FriendSummary>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let alive = true
    ensureProfile(user, preferredName)
      .then(p => { if (alive) setMe(p) })
      .catch(e => { if (alive && !cachedMyProfile(user.uid)) setError((e as Error).message) })
    return () => { alive = false }
  }, [user, preferredName])

  // Names/photos and a light activity summary per friend: cached ones first, then refreshed in the background.
  const friendIds = (friendsLive.data ?? []).map(f => f.uid).join(',')
  useEffect(() => {
    const ids = friendIds ? friendIds.split(',') : []
    if (ids.length === 0) return
    let alive = true
    const fromCache: Record<string, FriendSummary> = {}
    for (const id of ids) {
      const c = cachedFriendSessions(id, 40)
      if (c) fromCache[id] = summarize(c)
    }
    setSummaries(prev => ({ ...prev, ...fromCache }))
    refreshProfiles(ids, true).then(() => { if (alive) setProfilesVersion(v => v + 1) })
    for (const id of ids) {
      listFriendSessions(id, 40)
        .then(list => { if (alive) setSummaries(prev => ({ ...prev, [id]: summarize(list) })) })
        .catch(() => { if (alive) setSummaries(prev => (prev[id] ? prev : { ...prev, [id]: { lastDate: null, thisWeek: 0 } })) })
    }
    return () => { alive = false }
  }, [friendIds])

  const [busyReq, setBusyReq] = useState<string | null>(null)
  async function onRequest(r: FriendRequest, action: 'accept' | 'delete') {
    if (busyReq) return
    setBusyReq(r.id)
    try {
      if (action === 'accept' && me) await acceptFriendRequest(r, me)
      else await deleteFriendRequest(r)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyReq(null)
    }
  }

  useEffect(() => {
    if (friendsLive.error && !friendsLive.data) setError(friendsLive.error.message)
  }, [friendsLive.error, friendsLive.data])

  // Shared link: /friends?code=ABC123 pre-fills the add form.
  const codeFromLink = params.get('code')

  if (error) return <><PageHeader title="Amis" /><ErrorNote message={error} /></>

  return (
    <>
      <PageHeader title="Amis" kicker={friends ? `${friends.length} ami${friends.length > 1 ? 's' : ''}` : undefined} />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-x-8 items-start">
        <div className="space-y-10 min-w-0">
          {incoming.length > 0 && me && (
            <section>
              <SectionTitle>Demandes reçues</SectionTitle>
              <Card className="overflow-hidden">
                {incoming.map(r => (
                  <RequestRow
                    key={r.id}
                    name={r.fromName}
                    sub={`le ${format(r.createdAt, 'd MMMM', { locale: fr })}`}
                    actions={
                      <>
                        <Button
                          size="icon-sm"
                          variant="secondary"
                          aria-label={`Refuser ${r.fromName}`}
                          disabled={busyReq === r.id}
                          onClick={() => onRequest(r, 'delete')}
                        >
                          <X size={16} />
                        </Button>
                        <Button
                          size="sm"
                          disabled={busyReq === r.id}
                          onClick={() => onRequest(r, 'accept')}
                        >
                          <Check size={16} strokeWidth={2.5} /> {busyReq === r.id ? 'Ajout…' : 'Accepter'}
                        </Button>
                      </>
                    }
                  />
                ))}
              </Card>
            </section>
          )}

          <section>
            <SectionTitle>Tes amis</SectionTitle>
            {!friends ? (
              <Skeleton className="h-48 rounded-[var(--radius-card)]" />
            ) : friends.length === 0 ? (
              <Card>
                <EmptyState
                  className="px-5 py-8"
                  icon={<Users size={28} />}
                  title="Personne pour l’instant"
                  subtitle="Envoie ton code à quelqu’un, ou entre le sien. Une fois la demande acceptée, vous voyez chacun les séances et les records de l’autre."
                />
              </Card>
            ) : (
              <FriendList friends={friends} summaries={summaries} />
            )}
          </section>
        </div>

        <div className="space-y-10 min-w-0">
          <MyProfile me={me} onChange={setMe} />
          {me && (
            <AddFriend
              me={me}
              initialCode={codeFromLink ?? ''}
              onDone={() => {
                if (codeFromLink) setParams({}, { replace: true })
              }}
            />
          )}

          {outgoing.length > 0 && (
            <section>
              <SectionTitle>En attente</SectionTitle>
              <Card className="overflow-hidden">
                {outgoing.map(r => (
                  <RequestRow
                    key={r.id}
                    name={r.toName}
                    sub="n’a pas encore répondu"
                    actions={
                      <Button size="sm" variant="ghost" disabled={busyReq === r.id} onClick={() => onRequest(r, 'delete')}>
                        Annuler
                      </Button>
                    }
                  />
                ))}
              </Card>
            </section>
          )}

          <p className="text-[13px] text-faint px-1 leading-snug">
            Tes amis voient tes séances, tes charges et tes records. Tes pesées et tes réglages restent privés.
          </p>
        </div>
      </div>
    </>
  )
}

function summarize(sessions: Session[]): FriendSummary {
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const logged = sessions.filter(s => s.type === 'running' || s.exercises.some(e => e.sets.length > 0))
  return {
    lastDate: logged[0]?.date ?? null,
    thisWeek: logged.filter(s => s.date >= weekStart).length,
  }
}

function lastSeen(date: string | null): string {
  if (!date) return 'Aucune séance notée'
  const d = differenceInCalendarDays(new Date(), parseISO(date))
  if (d <= 0) return 'Séance aujourd’hui'
  if (d === 1) return 'Dernière séance hier'
  if (d < 7) return `Dernière séance il y a ${d} jours`
  return `Dernière séance le ${format(parseISO(date), 'd MMM', { locale: fr })}`
}

/** Lowercase, no accents, so "elodie" finds "Élodie". */
const fold = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

function FriendList({ friends, summaries }: { friends: Friend[]; summaries: Record<string, FriendSummary> }) {
  const nav = useNavigate()
  const [query, setQuery] = useState('')
  const q = fold(query)
  const shown = q ? friends.filter(f => fold(f.name).split(/\s+/).some(w => w.startsWith(q)) || fold(f.name).includes(q)) : friends
  const searchable = friends.length >= 4

  return (
    <>
      {searchable && (
        <div className="relative mb-3">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Chercher parmi tes ${friends.length} amis`}
            type="search"
            aria-label="Chercher un ami"
            className="pl-11 pr-11"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 grid place-items-center text-faint cursor-pointer" aria-label="Effacer la recherche">
              <X size={18} />
            </button>
          )}
        </div>
      )}
      {shown.length === 0 ? (
        <Card className="px-4 py-6">
          <p className="text-[15px] text-dim">Aucun ami ne s’appelle « {query.trim()} ».</p>
        </Card>
      ) : (
    <Card className="overflow-hidden">
      {shown.map(f => {
        const s = summaries[f.uid]
        return (
          <button
            key={f.uid}
            onClick={() => nav(`/friends/${f.uid}`)}
            className="w-full text-left flex items-center gap-3 px-4 py-3 hairline-b last:shadow-none cursor-pointer active:bg-surface-2 hover:bg-surface-2/60"
          >
            <Avatar name={f.name} photo={f.photo} />
            <span className="flex-1 min-w-0">
              <span className="block font-semibold truncate">{f.name}</span>
              <span className="block text-[13px] text-dim truncate">{s ? lastSeen(s.lastDate) : '…'}</span>
            </span>
            {s && s.thisWeek > 0 && (
              <span className="flex items-center gap-1.5 shrink-0" aria-label={`${s.thisWeek} séances cette semaine`}>
                <Disc size={14} />
                <span className="num text-[20px]">{s.thisWeek}</span>
                <span className="text-[12px] text-dim">cette sem.</span>
              </span>
            )}
            <ChevronRight size={16} className="text-faint shrink-0" />
          </button>
        )
      })}
    </Card>
      )}
    </>
  )
}

function RequestRow({ name, sub, actions }: { name: string; sub: string; actions: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hairline-b last:shadow-none">
      <Avatar name={name} />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold truncate">{name}</span>
        <span className="block text-[13px] text-dim truncate">{sub}</span>
      </span>
      <span className="flex items-center gap-2 shrink-0">{actions}</span>
    </div>
  )
}

function MyProfile({ me, onChange }: { me: PublicProfile | null; onChange: (p: PublicProfile) => void }) {
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  async function copy() {
    if (!me) return
    try {
      await navigator.clipboard.writeText(me.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard blocked: the code is on screen anyway */ }
  }

  async function share() {
    if (!me) return
    try {
      await navigator.share({
        title: 'Ajoute-moi sur Fit',
        text: `Mon code ami sur Fit : ${me.code}`,
        url: shareLink(me.code),
      })
    } catch { /* cancelled */ }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (!file || !me) return
    setBusy(true)
    setPhotoError(null)
    try {
      const photo = await fileToAvatar(file)
      await setProfilePhoto(photo)
      onChange({ ...me, photo })
    } catch (err) {
      setPhotoError((err as Error).message || 'Envoi impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function onRemovePhoto() {
    if (!me) return
    setBusy(true)
    try {
      await setProfilePhoto(null)
      onChange({ ...me, photo: null })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <SectionTitle>Ton profil</SectionTitle>
      <Card className="px-4 py-4">
        {me ? (
          <>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                aria-label={me.photo ? 'Changer la photo de profil' : 'Ajouter une photo de profil'}
                className="relative shrink-0 rounded-full cursor-pointer disabled:opacity-60"
              >
                <Avatar name={me.name} photo={me.photo} size={72} />
                <span className="absolute -bottom-0.5 -right-0.5 h-7 w-7 rounded-full bg-accent text-on-accent grid place-items-center shadow-[0_0_0_3px_var(--color-surface)]">
                  <Camera size={14} strokeWidth={2.4} />
                </span>
              </button>
              <div className="min-w-0">
                <p className="t-heading text-[19px] truncate">{me.name}</p>
                <p className="text-[13px] text-dim">Nom modifiable dans Réglages, Prénom.</p>
                {me.photo && (
                  <button type="button" onClick={onRemovePhoto} disabled={busy} className="text-[13px] font-semibold text-dim hover:text-ink mt-1 cursor-pointer disabled:opacity-50">
                    Retirer la photo
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
            </div>
            {busy && <p className="text-[13px] text-dim mt-2" role="status">Enregistrement…</p>}
            {photoError && <p className="text-[13px] text-danger mt-2" role="alert">{photoError}</p>}

            <div className="mt-5 pt-4 hairline-t">
              <p className="text-[13px] font-medium text-dim">Ton code ami</p>
              <p className="num text-[44px] leading-none tracking-[0.12em] mt-1.5" aria-label={`Code : ${me.code.split('').join(' ')}`}>
                {me.code}
              </p>
              <div className="flex gap-2 mt-4">
                <Button variant="secondary" size="sm" onClick={copy}>
                  {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copié' : 'Copier'}
                </Button>
                {canShare && (
                  <Button variant="secondary" size="sm" onClick={share}>
                    <Share2 size={16} /> Partager un lien
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <Skeleton className="h-40" />
        )}
      </Card>
    </section>
  )
}

function AddFriend({ me, initialCode, onDone }: { me: PublicProfile; initialCode: string; onDone: () => void }) {
  const [code, setCode] = useState(() => normalizeCode(initialCode))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const clean = useMemo(() => normalizeCode(code), [code])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const res = await sendFriendRequest(me, clean)
      setMsg({
        tone: 'ok',
        text: res.status === 'accepted'
          ? `${res.name} t’avait déjà ajouté·e : vous êtes amis.`
          : `Demande envoyée à ${res.name}.`,
      })
      setCode('')
      await onDone()
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof FriendError ? err.message : 'Envoi impossible. Vérifie ta connexion.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <SectionTitle>Ajouter quelqu’un</SectionTitle>
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="Code à 6 caractères"
          aria-label="Code ami"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={8}
          className="num text-[22px] tracking-[0.1em]"
        />
        <Button type="submit" disabled={busy || clean.length !== 6} className="h-12 shrink-0">
          <UserPlus size={18} /> {busy ? '…' : 'Ajouter'}
        </Button>
      </form>
      {msg && (
        <p role={msg.tone === 'error' ? 'alert' : 'status'} className={msg.tone === 'error' ? 'text-[14px] text-danger mt-2 px-1' : 'text-[14px] text-dim mt-2 px-1'}>
          {msg.text}
        </p>
      )}
    </section>
  )
}