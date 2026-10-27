import {
  EmailAuthProvider,
  GoogleAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'
import { db } from './firebase'

/**
 * Delete the account and everything tied to it, from the app (no server needed):
 *  1. the reactions this user left on friends' sessions,
 *  2. the friendships on both sides and pending friend requests,
 *  3. all their own data (sessions and the reactions on them, weigh-ins, notes, settings…),
 *  4. the public profile and friend code,
 *  5. the login itself.
 * Firebase only allows deleting a login right after signing in again, so `reauthenticate`
 * must be called first.
 */

export type DeleteStep = 'reactions' | 'friends' | 'data' | 'profile' | 'account'

export function usesPassword(user: User) {
  return user.providerData.some(p => p.providerId === 'password')
}

/** Sign in again (Google popup, or the password typed by the user). */
export async function reauthenticate(user: User, password?: string) {
  if (usesPassword(user)) {
    if (!user.email || !password) throw new Error('missing-password')
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password))
  } else {
    await reauthenticateWithPopup(user, new GoogleAuthProvider())
  }
}

async function deleteRefs(refs: DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db)
    for (const r of refs.slice(i, i + 400)) batch.delete(r)
    await batch.commit()
  }
}

export async function deleteAccount(user: User, onStep?: (s: DeleteStep) => void) {
  const uid = user.uid
  const mine = (name: string) => collection(db, 'users', uid, name)

  // 1. Reactions I left. The index covers recent ones; scanning friends' visible sessions
  //    catches older ones made before the index existed.
  onStep?.('reactions')
  const toDelete = new Map<string, DocumentReference>()
  const given = await getDocs(mine('reactionsGiven'))
  for (const d of given.docs) {
    const { owner, sessionId } = d.data() as { owner?: string; sessionId?: string }
    if (owner && sessionId) {
      const ref = doc(db, 'users', owner, 'sessions', sessionId, 'reactions', uid)
      toDelete.set(ref.path, ref)
    }
  }
  const friends = await getDocs(mine('friends'))
  for (const f of friends.docs) {
    try {
      const sessions = await getDocs(query(collection(db, 'users', f.id, 'sessions'), where('shared', '==', true)))
      const checks = await Promise.all(
        sessions.docs.map(async s => {
          const ref = doc(db, 'users', f.id, 'sessions', s.id, 'reactions', uid)
          return (await getDoc(ref)).exists() ? ref : null
        }),
      )
      for (const ref of checks) if (ref) toDelete.set(ref.path, ref)
    } catch { /* that friend's sessions aren't readable any more: nothing to clean there */ }
  }
  await deleteRefs([...toDelete.values()])

  // 2. Friendships (their side and mine) and pending requests.
  onStep?.('friends')
  await deleteRefs(friends.docs.map(f => doc(db, 'users', f.id, 'friends', uid)))
  const [sent, received] = await Promise.all([
    getDocs(query(collection(db, 'friendRequests'), where('from', '==', uid))),
    getDocs(query(collection(db, 'friendRequests'), where('to', '==', uid))),
  ])
  await deleteRefs([...sent.docs, ...received.docs].map(d => d.ref))

  // 3. My own data. Sub-collections aren't removed with their parent, so the reactions
  //    friends left on my sessions are deleted one by one first.
  onStep?.('data')
  const sessions = await getDocs(mine('sessions'))
  for (const s of sessions.docs) {
    const reactions = await getDocs(collection(s.ref, 'reactions'))
    await deleteRefs(reactions.docs.map(r => r.ref))
  }
  await deleteRefs(sessions.docs.map(s => s.ref))
  for (const name of ['weighIns', 'exerciseNotes', 'fcmTokens', 'settings', 'reactionsGiven', 'notifyLog', 'friends']) {
    const snap = await getDocs(mine(name))
    await deleteRefs(snap.docs.map(d => d.ref))
  }

  // 4. Public profile and friend code.
  onStep?.('profile')
  const profile = await getDoc(doc(db, 'profiles', uid))
  const code = profile.exists() ? (profile.data().code as string | undefined) : undefined
  await deleteRefs([...(code ? [doc(db, 'friendCodes', code)] : []), doc(db, 'profiles', uid)])

  // 5. The login. Local preferences of this device go too.
  onStep?.('account')
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('fit-tracker:')) localStorage.removeItem(k)
  } catch { /* ignore */ }
  await deleteUser(user)
}