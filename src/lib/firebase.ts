import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

/**
 * Use the current host as authDomain when we're on a Vercel deployment that proxies
 * /__/auth/* and /__/firebase/* to the Firebase auth handler (see vercel.json). This makes
 * Google sign-in same-origin so credentials survive Chrome's cross-site cookie blocking and
 * Safari's strict storage policy — without it, signInWithRedirect lands back on the login
 * page silently because the credential set on firebaseapp.com can't be read from vercel.app.
 * Falls back to the env var (firebaseapp.com) for localhost dev and any unknown host.
 */
function resolveAuthDomain(): string | undefined {
  const fallback = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
  if (typeof window === 'undefined') return fallback
  const host = window.location.host
  if (host.endsWith('.vercel.app')) return host
  return fallback
}

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: resolveAuthDomain(),
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
