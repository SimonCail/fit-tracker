import { collection, deleteDoc, doc, getDocs, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore'
import { auth, db } from './firebase'
import { pingReaction } from './friendNotify'
import { cachedProfile, getProfile } from './friends'

/**
 * Reactions on a session: users/{owner}/sessions/{sessionId}/reactions/{reactorUid}.
 * One reaction per friend per session (picking another emoji replaces it). Any emoji works;
 * QUICK_REACTIONS are just the shortcuts shown first.
 */
export const QUICK_REACTIONS = ['🔥', '💪', '👏', '😮', '❤️', '😂', '🐐', '🫡'] as const

export type Reaction = { uid: string; emoji: string; name: string; at: number }

const reactionsCol = (owner: string, sessionId: string) => collection(db, 'users', owner, 'sessions', sessionId, 'reactions')

/**
 * Keep only the first emoji typed (one "character" as the user sees it, e.g. 👍🏽 or 👨‍👩‍👧).
 * Returns null when the text has no emoji.
 */
export function firstEmoji(text: string): string | null {
  const t = text.trim()
  if (!t) return null
  const seg = typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t)].map(s => s.segment)
    : Array.from(t)
  const hit = seg.find(g => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g))
  return hit && hit.length <= 32 ? hit : null
}

export async function listReactions(owner: string, sessionId: string): Promise<Reaction[]> {
  const snap = await getDocs(reactionsCol(owner, sessionId))
  const list = snap.docs
    .map(d => {
      const data = d.data()
      return {
        uid: d.id,
        emoji: String(data.emoji ?? ''),
        name: String(data.name ?? 'Un ami'),
        at: data.at instanceof Timestamp ? data.at.toMillis() : Date.now(),
      }
    })
    .filter(r => r.emoji)
    .sort((a, b) => a.at - b.at)
  return dropDeletedAccounts(owner, sessionId, list)
}

/**
 * A deleted account has no public profile any more. Its reactions are hidden for everyone,
 * and removed for good when the owner of the session sees them (the cleanup at deletion
 * can miss some: sessions of ex-friends, an interrupted deletion, an old app version…).
 */
async function dropDeletedAccounts(owner: string, sessionId: string, list: Reaction[]): Promise<Reaction[]> {
  const me = auth.currentUser?.uid
  const exists = await Promise.all(
    list.map(async r => {
      if (r.uid === me) return true
      const known = cachedProfile(r.uid)
      const p = known !== undefined ? known : await getProfile(r.uid).catch(() => undefined)
      return p !== null // unknown (offline, error) → keep it
    }),
  )
  const gone = list.filter((_, i) => !exists[i])
  if (gone.length && me === owner) {
    for (const r of gone) void deleteDoc(doc(reactionsCol(owner, sessionId), r.uid)).catch(() => {})
  }
  return list.filter((_, i) => exists[i])
}

/**
 * Set my reaction on a friend's session, or remove it with `null`.
 * Also keeps an index in my own tree (users/{me}/reactionsGiven) so that deleting my
 * account can find and remove every reaction I left.
 */
export async function setReaction(owner: string, sessionId: string, emoji: string | null, myName: string) {
  const me = auth.currentUser?.uid
  if (!me) throw new Error('not authenticated')
  const ref = doc(db, 'users', owner, 'sessions', sessionId, 'reactions', me)
  const indexRef = doc(db, 'users', me, 'reactionsGiven', `${owner}_${sessionId}`)
  const batch = writeBatch(db)
  if (emoji === null) {
    batch.delete(ref)
    batch.delete(indexRef)
  } else {
    batch.set(ref, { emoji, name: myName.slice(0, 40), at: serverTimestamp() })
    batch.set(indexRef, { owner, sessionId })
  }
  await batch.commit()
  // Let the owner know (the server sends it only once per friend and session, if they opted in).
  if (emoji !== null) void pingReaction(owner, sessionId)
}

/** Group reactions by emoji: most used first, then the earliest. */
export function groupReactions(list: Reaction[]) {
  const map = new Map<string, Reaction[]>()
  for (const r of list) map.set(r.emoji, [...(map.get(r.emoji) ?? []), r])
  return [...map.entries()]
    .map(([emoji, people]) => ({ emoji, people }))
    .sort((a, b) => b.people.length - a.people.length || a.people[0].at - b.people[0].at)
}