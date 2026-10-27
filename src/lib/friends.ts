import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { auth, db } from './firebase'
import type { Session } from './types'
import { parseSession } from './db'
import { pingFriendRequest } from './friendNotify'

/**
 * Friends.
 *
 * Firestore layout (see firestore.rules):
 *   profiles/{uid}                    { name, code, photo? }  readable by any signed-in user (get only)
 *   friendCodes/{CODE}                { uid }                 claimed once, never reassigned
 *   friendRequests/{fromUid}_{toUid}  { from, to, fromName, toName, createdAt }
 *   users/{uid}/friends/{friendUid}   { name, since }         one doc on each side once accepted
 *
 * A friend can READ your sessions (never your weigh-ins or settings) because your own
 * friends list contains them. Removing a friend deletes both sides and the access goes with it.
 */

export type PublicProfile = { uid: string; name: string; code: string; photo: string | null }
export type Friend = { uid: string; name: string; since: number; photo: string | null }
export type FriendRequest = {
  id: string
  from: string
  to: string
  fromName: string
  toName: string
  createdAt: number
}

export class FriendError extends Error {}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O, 1/I
const CODE_LENGTH = 6

function me(): string {
  const u = auth.currentUser
  if (!u) throw new Error('not authenticated')
  return u.uid
}

function toMs(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis()
  if (typeof v === 'number') return v
  return Date.now()
}

function makeCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  return [...bytes].map(b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function displayNameFor(user: User, preferred: string | null): string {
  const raw = preferred?.trim() || user.displayName?.trim() || user.email?.split('@')[0] || 'Sportif'
  return raw.slice(0, 40)
}

const profileRef = (uid: string) => doc(db, 'profiles', uid)
const codeRef = (code: string) => doc(db, 'friendCodes', code)
const requestRef = (from: string, to: string) => doc(db, 'friendRequests', `${from}_${to}`)
const friendRef = (owner: string, friend: string) => doc(db, 'users', owner, 'friends', friend)

/** Make sure the signed-in user has a public profile with a friend code, and keep the name fresh. */
export async function ensureProfile(user: User, preferredName: string | null): Promise<PublicProfile> {
  const name = displayNameFor(user, preferredName)
  const snap = await getDoc(profileRef(user.uid))
  if (snap.exists()) {
    const data = snap.data()
    const code = String(data.code)
    if (data.name !== name) {
      await setDoc(profileRef(user.uid), { name, code, updatedAt: serverTimestamp() }, { merge: true })
    }
    return { uid: user.uid, name, code, photo: typeof data.photo === 'string' ? data.photo : null }
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeCode()
    const claimed = await runTransaction(db, async tx => {
      const existing = await tx.get(codeRef(code))
      if (existing.exists()) return false
      tx.set(codeRef(code), { uid: user.uid })
      tx.set(profileRef(user.uid), { name, code, updatedAt: serverTimestamp() })
      return true
    })
    if (claimed) return { uid: user.uid, name, code, photo: null }
  }
  throw new Error('Impossible de générer un code ami. Réessaie.')
}

export async function getProfile(uid: string): Promise<PublicProfile | null> {
  const snap = await getDoc(profileRef(uid))
  if (!snap.exists()) return null
  const d = snap.data()
  return {
    uid,
    name: String(d.name ?? 'Sportif'),
    code: String(d.code ?? ''),
    photo: typeof d.photo === 'string' ? d.photo : null,
  }
}

/** Set or remove (null) the profile photo — a small JPEG data URL, see lib/photo.ts. */
export async function setProfilePhoto(photo: string | null) {
  await setDoc(profileRef(me()), { photo, updatedAt: serverTimestamp() }, { merge: true })
}

export async function findProfileByCode(rawCode: string): Promise<PublicProfile | null> {
  const code = normalizeCode(rawCode)
  if (code.length !== CODE_LENGTH) return null
  const snap = await getDoc(codeRef(code))
  if (!snap.exists()) return null
  return getProfile(String(snap.data().uid))
}

function parseRequest(id: string, d: Record<string, unknown>): FriendRequest {
  return {
    id,
    from: String(d.from),
    to: String(d.to),
    fromName: String(d.fromName ?? 'Sportif'),
    toName: String(d.toName ?? 'Sportif'),
    createdAt: toMs(d.createdAt),
  }
}

export async function listIncomingRequests(): Promise<FriendRequest[]> {
  const snap = await getDocs(query(collection(db, 'friendRequests'), where('to', '==', me())))
  return snap.docs.map(d => parseRequest(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt)
}

export async function listOutgoingRequests(): Promise<FriendRequest[]> {
  const snap = await getDocs(query(collection(db, 'friendRequests'), where('from', '==', me())))
  return snap.docs.map(d => parseRequest(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt)
}

export async function countIncomingRequests(): Promise<number> {
  return (await listIncomingRequests()).length
}

export type SendResult = { status: 'sent' | 'accepted'; name: string }

/**
 * Send a friend request by code. If that person had already asked us, accept theirs instead
 * of creating a second request.
 */
export async function sendFriendRequest(mine: PublicProfile, rawCode: string): Promise<SendResult> {
  const target = await findProfileByCode(rawCode)
  if (!target) throw new FriendError('Aucun compte avec ce code. Vérifie les 6 caractères.')
  if (target.uid === mine.uid) throw new FriendError('C’est ton propre code.')

  const already = await getDoc(friendRef(mine.uid, target.uid))
  if (already.exists()) throw new FriendError(`${target.name} fait déjà partie de tes amis.`)

  const reverse = await getDoc(requestRef(target.uid, mine.uid))
  if (reverse.exists()) {
    await acceptFriendRequest(parseRequest(reverse.id, reverse.data()), mine)
    return { status: 'accepted', name: target.name }
  }

  await setDoc(requestRef(mine.uid, target.uid), {
    from: mine.uid,
    to: target.uid,
    fromName: mine.name,
    toName: target.name,
    createdAt: serverTimestamp(),
  })
  void pingFriendRequest(target.uid)
  return { status: 'sent', name: target.name }
}

export async function acceptFriendRequest(req: FriendRequest, mine: PublicProfile) {
  const batch = writeBatch(db)
  batch.set(friendRef(mine.uid, req.from), { name: req.fromName, since: serverTimestamp() })
  batch.set(friendRef(req.from, mine.uid), { name: mine.name, since: serverTimestamp() })
  batch.delete(requestRef(req.from, req.to))
  await batch.commit()
}

/** Decline an incoming request or cancel an outgoing one. */
export async function deleteFriendRequest(req: FriendRequest) {
  const batch = writeBatch(db)
  batch.delete(requestRef(req.from, req.to))
  await batch.commit()
}

export async function removeFriend(friendUid: string) {
  const uid = me()
  const batch = writeBatch(db)
  batch.delete(friendRef(uid, friendUid))
  batch.delete(friendRef(friendUid, uid))
  await batch.commit()
}

export async function listFriends(): Promise<Friend[]> {
  const snap = await getDocs(collection(db, 'users', me(), 'friends'))
  const friends = snap.docs.map(d => ({
    uid: d.id,
    name: String(d.data().name ?? 'Sportif'),
    since: toMs(d.data().since),
    photo: null as string | null,
  }))
  // Names may have changed since the friendship started: refresh from public profiles.
  await Promise.all(
    friends.map(async f => {
      try {
        const p = await getProfile(f.uid)
        if (p) { f.name = p.name; f.photo = p.photo }
      } catch { /* keep the stored name */ }
    }),
  )
  return friends.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

export async function getFriend(friendUid: string): Promise<Friend | null> {
  const snap = await getDoc(friendRef(me(), friendUid))
  if (!snap.exists()) return null
  const p = await getProfile(friendUid).catch(() => null)
  return {
    uid: friendUid,
    name: p?.name ?? String(snap.data().name ?? 'Sportif'),
    since: toMs(snap.data().since),
    photo: p?.photo ?? null,
  }
}

/**
 * A friend's sessions (read-only), only those they share, most recent first.
 * Fails with permission-denied if you're no longer friends.
 *
 * `shared == true` + order by date needs a composite index (firestore.indexes.json).
 * Until it is created, Firestore answers "failed-precondition": we then fall back to an
 * unordered read of everything shared (correct, just heavier) so the page still works.
 */
export async function listFriendSessions(friendUid: string, max = 1000): Promise<Session[]> {
  const col = collection(db, 'users', friendUid, 'sessions')
  let docs
  try {
    docs = (await getDocs(query(col, where('shared', '==', true), orderBy('date', 'desc'), limit(max)))).docs
  } catch (e) {
    if ((e as { code?: string })?.code !== 'failed-precondition') throw e
    if (!warnedMissingIndex) {
      warnedMissingIndex = true
      console.warn('Firestore index missing for friend sessions (shared + date). See firestore.indexes.json.', e)
    }
    docs = (await getDocs(query(col, where('shared', '==', true)))).docs
  }
  return docs
    .map(d => parseSession(d.id, d.data()))
    .sort((a, b) => (a.date !== b.date ? b.date.localeCompare(a.date) : b.createdAt - a.createdAt))
    .slice(0, max)
}
let warnedMissingIndex = false

export function isPermissionDenied(e: unknown): boolean {
  return (e as { code?: string })?.code === 'permission-denied'
}

export function shareLink(code: string): string {
  return `${window.location.origin}/friends?code=${code}`
}