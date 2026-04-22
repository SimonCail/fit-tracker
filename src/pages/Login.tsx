import { useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
} from 'firebase/auth'
import { Dumbbell, Mail } from 'lucide-react'
import { motion } from 'framer-motion'
import { auth, isConfigured } from '../lib/firebase'
import { Button, Input } from '../components/ui'

type Mode = 'choose' | 'email' | 'magic'

const MAGIC_EMAIL_KEY = 'fit-tracker:magic-email'

export function Login() {
  const [mode, setMode] = useState<Mode>('choose')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const savedEmail = window.localStorage.getItem(MAGIC_EMAIL_KEY)
        || window.prompt('Confirme ton email pour finaliser la connexion :')
        || ''
      if (savedEmail) {
        setLoading(true)
        signInWithEmailLink(auth, savedEmail, window.location.href)
          .then(() => {
            window.localStorage.removeItem(MAGIC_EMAIL_KEY)
            window.history.replaceState({}, '', window.location.pathname)
          })
          .catch(e => setError(e.message))
          .finally(() => setLoading(false))
      }
    }
  }, [])

  async function onGoogle() {
    setError(null)
    setLoading(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function onEmailPassword(e: React.FormEvent, create = false) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (create) await createUserWithEmailAndPassword(auth, email, password)
      else await signInWithEmailAndPassword(auth, email, password)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function onMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await sendSignInLinkToEmail(auth, email, {
        url: window.location.origin,
        handleCodeInApp: true,
      })
      window.localStorage.setItem(MAGIC_EMAIL_KEY, email)
      setMagicSent(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 safe-top safe-bottom relative overflow-hidden grain">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm relative z-10"
      >
        <div className="flex flex-col items-start mb-12">
          <div className="w-10 h-10 rounded-xl bg-[color:var(--color-text)] text-[color:var(--color-bg)] flex items-center justify-center mb-8">
            <Dumbbell size={18} />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-dim)] font-medium">Fit · PWA</p>
          <h1 className="font-display text-6xl leading-[0.95] mt-3 tracking-tight">
            Entraîne-toi.<br />
            <span className="text-[color:var(--color-accent)]">Suis tout.</span>
          </h1>
          <p className="text-[color:var(--color-text-dim)] text-sm mt-4 leading-relaxed">
            Un carnet d'entraînement qui ne ressemble pas à un tableur. Séances, PR, poids corporel — synchronisés partout.
          </p>
        </div>

        {!isConfigured && (
          <div className="rounded-2xl p-4 mb-6 bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm">
            <p className="font-medium text-[color:var(--color-danger)] mb-1">Configuration manquante</p>
            <p className="text-[color:var(--color-text-dim)]">Remplis <code className="text-xs">.env.local</code> avec tes clés Firebase.</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl p-3 mb-4 bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm">
            <p className="text-[color:var(--color-danger)] break-words">{error}</p>
          </div>
        )}

        {magicSent ? (
          <div className="rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[color:var(--color-accent-soft)] mx-auto flex items-center justify-center mb-4">
              <Mail className="text-[color:var(--color-accent)]" size={20} />
            </div>
            <p className="font-display text-xl">Lien envoyé</p>
            <p className="text-sm text-[color:var(--color-text-dim)] mt-2">
              Ouvre l'email reçu sur <span className="text-[color:var(--color-text)]">{email}</span> pour te connecter.
            </p>
          </div>
        ) : mode === 'choose' ? (
          <div className="space-y-3">
            <Button onClick={onGoogle} disabled={loading} variant="secondary" size="lg" className="w-full justify-start">
              <GoogleIcon /> Continuer avec Google
            </Button>
            <Button onClick={() => setMode('magic')} disabled={loading} variant="secondary" size="lg" className="w-full justify-start">
              <Mail size={16} /> Lien magique par email
            </Button>
            <Button onClick={() => setMode('email')} disabled={loading} variant="ghost" size="lg" className="w-full justify-start">
              Email + mot de passe
            </Button>
          </div>
        ) : mode === 'magic' ? (
          <form onSubmit={onMagicLink} className="space-y-3">
            <Input
              type="email"
              placeholder="ton@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
            />
            <Button type="submit" variant="accent" size="lg" disabled={loading || !email} className="w-full">
              {loading ? 'Envoi…' : 'Recevoir le lien'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode('choose')} className="w-full">
              ← Retour
            </Button>
          </form>
        ) : (
          <form onSubmit={e => onEmailPassword(e, false)} className="space-y-3">
            <Input
              type="email"
              placeholder="ton@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
            />
            <Input
              type="password"
              placeholder="mot de passe"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              minLength={6}
            />
            <Button type="submit" variant="accent" size="lg" disabled={loading || !email || !password} className="w-full">
              {loading ? '…' : 'Se connecter'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={e => onEmailPassword(e, true)}
              disabled={loading || !email || !password}
              className="w-full"
            >
              Créer un compte avec cet email
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode('choose')} className="w-full">
              ← Retour
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.7 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C41.1 35.5 44 30.2 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  )
}
