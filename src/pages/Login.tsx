import { useState } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { ChevronLeft, Mail } from 'lucide-react'
import { motion } from 'framer-motion'
import { auth, isConfigured } from '../lib/firebase'
import { Button, Input, Label } from '../components/ui'

type Mode = 'choose' | 'email'

export function Login() {
  const [mode, setMode] = useState<Mode>('choose')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function onGoogle() {
    setError(null)
    setLoading(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (e) {
      setError(humanAuthError(e))
    } finally {
      setLoading(false)
    }
  }

  async function onEmailPassword(e: React.FormEvent, create = false) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      if (create) await createUserWithEmailAndPassword(auth, email, password)
      else await signInWithEmailAndPassword(auth, email, password)
    } catch (e) {
      setError(humanAuthError(e))
    } finally {
      setLoading(false)
    }
  }

  async function onResetPassword() {
    setError(null)
    setInfo(null)
    if (!email) {
      setError('Indique ton e-mail ci-dessus, puis touche « Mot de passe oublié ».')
      return
    }
    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, email)
      setInfo(`Lien envoyé à ${email}. Ouvre-le pour choisir un nouveau mot de passe ; tes données ne changent pas.`)
    } catch (e) {
      setError(humanAuthError(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-[100dvh] flex flex-col overflow-hidden">
      {/* The one bold gesture: a 20 kg plate rolling in from the corner. */}
      <motion.svg
        aria-hidden
        viewBox="0 0 400 400"
        initial={{ rotate: -50, x: 80, opacity: 0 }}
        animate={{ rotate: 0, x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 60, damping: 16, mass: 1.2 }}
        className="absolute -right-[38vw] -top-[22vw] w-[105vw] max-w-[620px] sm:-right-40 sm:-top-40"
      >
        <circle cx="200" cy="200" r="196" fill="var(--color-lift)" />
        <circle cx="200" cy="200" r="150" fill="none" stroke="#000" strokeOpacity="0.2" strokeWidth="5" />
        <circle cx="200" cy="200" r="118" fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth="2" />
        <circle cx="200" cy="200" r="38" fill="#000" fillOpacity="0.18" />
        <circle cx="200" cy="200" r="26" fill="var(--color-bg)" />
        <text x="200" y="322" textAnchor="middle" fill="#fff" fillOpacity="0.9" fontFamily="Big Shoulders Variable" fontWeight="800" fontSize="40">
          20 KG
        </text>
      </motion.svg>

      <div className="relative z-10 flex-1 flex flex-col max-w-md w-full mx-auto px-6 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <p className="t-heading text-[20px]">Fit</p>

        <div className="mt-auto pt-56 sm:pt-48">
          <h1 className="t-title text-[36px] min-[400px]:text-[40px] sm:text-[52px]">Ton carnet d’entraînement.</h1>
          <p className="text-[16px] text-dim mt-3 max-w-[34ch]">
            Séries, charges, pesées et sorties de course au même endroit. Tu vois ce qui progresse, séance après séance.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {!isConfigured && (
            <Note tone="error" text="Firebase n’est pas configuré : renseigne les variables dans .env.local." />
          )}
          {error && <Note tone="error" text={error} />}
          {info && <Note tone="info" text={info} />}

          {mode === 'choose' ? (
            <div className="space-y-2.5">
              <Button onClick={onGoogle} disabled={loading} size="lg" className="w-full bg-ink text-bg hover:brightness-100 hover:opacity-90">
                <GoogleIcon size={20} />
                Continuer avec Google
              </Button>
              <Button onClick={() => setMode('email')} disabled={loading} variant="secondary" size="lg" className="w-full">
                <Mail size={18} />
                Continuer avec un e-mail
              </Button>
            </div>
          ) : (
            <form onSubmit={e => onEmailPassword(e, false)} className="space-y-3">
              <div>
                <Label htmlFor="email" className="block mb-1.5">E-mail</Label>
                <Input id="email" type="email" placeholder="toi@exemple.fr" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
              </div>
              <div>
                <Label htmlFor="password" className="block mb-1.5">Mot de passe</Label>
                <Input id="password" type="password" placeholder="6 caractères minimum" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" minLength={6} />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={loading || !email || !password}>
                {loading ? 'Connexion…' : 'Se connecter'}
              </Button>
              <div className="flex items-center justify-between text-[14px] font-semibold">
                <button type="button" onClick={() => setMode('choose')} className="h-11 flex items-center gap-1 text-dim hover:text-ink cursor-pointer -ml-1">
                  <ChevronLeft size={18} /> Retour
                </button>
                <button type="button" onClick={e => onEmailPassword(e as unknown as React.FormEvent, true)} disabled={loading || !email || !password} className="h-11 link disabled:opacity-40">
                  Créer un compte
                </button>
              </div>
              <button type="button" onClick={onResetPassword} disabled={loading} className="w-full h-10 text-[14px] text-dim hover:text-ink cursor-pointer disabled:opacity-50">
                Mot de passe oublié
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function Note({ tone, text }: { tone: 'error' | 'info'; text: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role={tone === 'error' ? 'alert' : 'status'}
      className={tone === 'error' ? 'rounded-[10px] px-4 py-3 text-[14px] bg-danger/12 text-danger' : 'rounded-[10px] px-4 py-3 text-[14px] bg-surface-2 text-ink'}
    >
      {text}
    </motion.p>
  )
}

/** Firebase auth error codes → plain French. Falls back to the raw message. */
function humanAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code
  switch (code) {
    case 'auth/invalid-email': return 'Cette adresse e-mail n’est pas valide.'
    case 'auth/missing-password': return 'Indique ton mot de passe.'
    case 'auth/weak-password': return 'Mot de passe trop court : 6 caractères minimum.'
    case 'auth/email-already-in-use': return 'Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.'
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou mot de passe incorrect.'
    case 'auth/user-not-found': return 'Aucun compte avec cet e-mail. Touche « Créer un compte ».'
    case 'auth/too-many-requests': return 'Trop de tentatives. Réessaie dans quelques minutes.'
    case 'auth/network-request-failed': return 'Pas de connexion. Vérifie ton réseau et réessaie.'
    case 'auth/unauthorized-domain': return 'Ce domaine n’est pas autorisé dans Firebase Auth.'
    case 'auth/popup-blocked': return 'Le navigateur a bloqué la fenêtre Google. Autorise les pop-ups ou utilise ton e-mail.'
    case 'auth/popup-closed-by-user': return 'Connexion annulée.'
    case 'auth/cancelled-popup-request': return 'Plusieurs fenêtres de connexion ouvertes. Réessaie.'
    case 'auth/web-storage-unsupported': return 'Le stockage local est désactivé. Active les cookies ou utilise ton e-mail.'
    case 'auth/operation-not-supported-in-this-environment': return 'Connexion Google indisponible ici. Utilise ton e-mail.'
    default:
      return (e as Error)?.message ?? 'Erreur inconnue.'
  }
}

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.7 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C41.1 35.5 44 30.2 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}