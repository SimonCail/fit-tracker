import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'
import { doc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore'
import { app, db } from './firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

export const fcmConfigured = Boolean(VAPID_KEY)

const TOKEN_LS_KEY = 'fit-tracker:fcm-token'

/** Register for FCM: requests permission, gets token, stores in Firestore under users/{uid}/fcmTokens/{token}. */
export async function registerFCM(uid: string): Promise<string | null> {
  if (!fcmConfigured) {
    console.warn('FCM: VITE_FIREBASE_VAPID_KEY missing — push notifications disabled.')
    return null
  }
  if (!(await isSupported())) return null
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null

  try {
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/firebase-cloud-messaging-push-scope' })
    const messaging = getMessaging(app)
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg })
    if (!token) return null

    await setDoc(doc(db, 'users', uid, 'fcmTokens', token), {
      createdAt: serverTimestamp(),
      userAgent: navigator.userAgent,
      platform: (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform ?? null,
    })
    localStorage.setItem(TOKEN_LS_KEY, token)

    // Handle foreground messages (when tab is open and focused).
    onMessage(messaging, payload => {
      console.log('[FCM] foreground payload', payload)
      // Don't show a notification — the user is already looking at the app.
    })

    return token
  } catch (e) {
    console.warn('FCM registration failed', e)
    return null
  }
}

/** Remove the token from Firestore (called on signout / disabling reminders). */
export async function unregisterFCM(uid: string) {
  const token = localStorage.getItem(TOKEN_LS_KEY)
  if (!token) return
  try {
    await deleteDoc(doc(db, 'users', uid, 'fcmTokens', token))
  } catch (e) {
    console.warn('FCM unregister failed', e)
  }
  localStorage.removeItem(TOKEN_LS_KEY)
}
