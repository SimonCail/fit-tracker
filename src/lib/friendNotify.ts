import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { fcmConfigured, registerFCM } from './fcm'
import { requestNotificationPermission } from './notifications'

/**
 * Push notifications about friends: a new friend request, a reaction on one of your sessions.
 * Opt-ins stored in users/{uid}/settings/main → notify.{friendRequests, reactions},
 * read by api/notify.ts. Uses the same FCM tokens as the session reminders.
 */

export type NotifyKind = 'friendRequests' | 'reactions'
export type NotifyPrefs = Record<NotifyKind, boolean>

export async function getNotifyPrefs(uid: string): Promise<NotifyPrefs> {
  const snap = await getDoc(doc(db, 'users', uid, 'settings', 'main'))
  const n = snap.exists() ? snap.data()?.notify : undefined
  return { friendRequests: n?.friendRequests === true, reactions: n?.reactions === true }
}

/** Turn one kind on or off. Returns the resulting state (false if notifications couldn't be allowed). */
export async function setNotifyPref(uid: string, kind: NotifyKind, on: boolean): Promise<boolean> {
  if (on) {
    if (!fcmConfigured) return false
    const permission = await requestNotificationPermission()
    if (permission !== 'granted') return false
    const token = await registerFCM(uid)
    if (!token) return false
  }
  await setDoc(
    doc(db, 'users', uid, 'settings', 'main'),
    { notify: { [kind]: on }, updatedAt: serverTimestamp() },
    { merge: true },
  )
  return on
}

/**
 * Ask the server to notify someone. Fire-and-forget: what triggered it is already saved,
 * a failed push changes nothing. The server checks it really happened and that they opted in.
 */
async function ping(body: Record<string, string>) {
  try {
    const user = auth.currentUser
    if (!user) return
    const token = await user.getIdToken()
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch (e) {
    console.warn('push request failed', e)
  }
}

export function pingFriendRequest(toUid: string) {
  return ping({ type: 'friend-request', to: toUid })
}

export function pingReaction(ownerUid: string, sessionId: string) {
  return ping({ type: 'reaction', to: ownerUid, sessionId })
}