import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

/**
 * Google sign-in runs on the app's own domain: vercel.json forwards /__/auth/* to Firebase.
 * With the default *.firebaseapp.com domain, Safari/iPhone (and Chrome's storage partitioning)
 * sometimes lose the sign-in state halfway: "Unable to process request due to missing initial state".
 * Local dev keeps the Firebase domain (no proxy there).
 */
function authDomain(): string | undefined {
  const fallback = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
  if (!import.meta.env.PROD || typeof window === 'undefined') return fallback
  const host = window.location.hostname
  const local = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local') || /^\d+\.\d+\.\d+\.\d+$/.test(host)
  return local ? fallback : window.location.host
}

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: authDomain(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isConfigured = Boolean(config.apiKey && config.projectId && config.appId)

export const app = getApps()[0] ?? initializeApp(config)
export const auth = getAuth(app)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})