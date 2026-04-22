import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { Reminders, WeeklyPlan } from '../store/settings'

export type PersistedPrefs = {
  weeklyPlan: WeeklyPlan
  reminders: Reminders
  timezone: string
}

export async function writePrefs(uid: string, prefs: Partial<PersistedPrefs>) {
  await setDoc(
    doc(db, 'users', uid, 'settings', 'main'),
    { ...prefs, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

export async function readPrefs(uid: string): Promise<Partial<PersistedPrefs> | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'settings', 'main'))
  if (!snap.exists()) return null
  return snap.data() as Partial<PersistedPrefs>
}

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
