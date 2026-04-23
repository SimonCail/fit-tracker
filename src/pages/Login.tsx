import { useState } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { ArrowRight, CalendarDays, Dumbbell, Mail, Timer, Trophy } from 'lucide-react'
import { motion } from 'framer-motion'
import { auth, isConfigured } from '../lib/firebase'
import { Button, Input } from '../components/ui'
import { cn } from '../lib/cn'

type Mode = 'choose' | 'email'

export function Login() {
  const [mode, setMode] = useState<Mode>('choose')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="relative min-h-[100dvh] flex flex-col overflow-hidden safe-top safe-bottom">
      <BackgroundGlow />

      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full px-6 py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-2 mb-12">
            <div className="w-9 h-9 rounded-xl bg-[color:var(--color-text)] text-[color:var(--color-bg)] flex items-center justify-center">
              <Dumbbell size={18} />
            </div>
            <span className="font-display text-xl tracking-tight">Fit</span>
          </div>

          <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--color-text-dim)] font-medium mb-4">
            Suivi musculation · PWA
          </p>
          <h1 className="font-display text-5xl sm:text-6xl leading-[0.95] tracking-tight">
            Lève plus. <br />
            <span className="text-[color:var(--color-accent)]">Vois tout.</span>
          </h1>
          <p className="text-[color:var(--color-text-dim)] text-base mt-5 leading-relaxed">
            Log tes séries, suis ton poids, garde ton streak. Un rappel quotidien quand tu slack.
            Tout synchronisé entre tes appareils — sans tableau Excel.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } } }}
          className="grid grid-cols-3 gap-2 mt-10"
        >
          <FeatureMini icon={<CalendarDays size={14} />} label="Planning hebdo" />
          <FeatureMini icon={<Timer size={14} />} label="Timer de repos" />
          <FeatureMini icon={<Trophy size={14} />} label="PR détectés" />
        </motion.div>

        {!isConfigured && (
          <div className="rounded-2xl p-4 mt-8 bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm">
            <p className="font-medium text-[color:var(--color-danger)] mb-1">Configuration manquante</p>
            <p className="text-[color:var(--color-text-dim)]">Remplis <code className="text-xs">.env.local</code> avec tes clés Firebase.</p>
          </div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-3 mt-6 bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm"
          >
            <p className="text-[color:var(--color-danger)] break-words">{error}</p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-10"
        >
          {mode === 'choose' ? (
            <div className="space-y-3">
              <Button
                onClick={onGoogle}
                disabled={loading}
                variant="accent"
                size="lg"
                className="w-full justify-center gap-3 h-14 text-base"
              >
                <GoogleIcon size={18} />
                Continuer avec Google
                <ArrowRight size={16} className="opacity-70" />
              </Button>
              <Button
                onClick={() => setMode('email')}
                disabled={loading}
                variant="secondary"
                size="lg"
                className="w-full justify-center gap-2 h-12"
              >
                <Mail size={16} />
                Continuer avec un email
              </Button>
              <p className="text-xs text-center text-[color:var(--color-text-dim)] pt-4 leading-relaxed">
                En continuant tu acceptes que tes données soient<br />
                synchronisées via Firebase (Google).
              </p>
            </div>
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
                className="h-12"
              />
              <Input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                minLength={6}
                className="h-12"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button type="submit" variant="accent" size="lg" disabled={loading || !email || !password} className="h-12">
                  {loading ? '…' : 'Se connecter'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={e => onEmailPassword(e, true)}
                  disabled={loading || !email || !password}
                  size="lg"
                  className="h-12"
                >
                  Créer un compte
                </Button>
              </div>
              <Button type="button" variant="ghost" onClick={() => setMode('choose')} className="w-full">
                ← Retour
              </Button>
            </form>
          )}
        </motion.div>
      </div>

      <footer className="relative z-10 px-6 pb-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-text-dim)] font-medium">
          Gratuit · Sans pub · Open-source
        </p>
      </footer>
    </div>
  )
}

function FeatureMini({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
      }}
      className={cn(
        'rounded-2xl p-3 bg-[color:var(--color-surface)]/60 border border-[color:var(--color-border)] backdrop-blur-sm',
        'flex flex-col items-start gap-2',
      )}
    >
      <span className="w-7 h-7 rounded-lg bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] flex items-center justify-center">
        {icon}
      </span>
      <span className="text-[11px] font-medium text-[color:var(--color-text)] leading-tight">{label}</span>
    </motion.div>
  )
}

function BackgroundGlow() {
  return (
    <>
      <div
        aria-hidden
        className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-40 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 45%, transparent), transparent 60%)',
          filter: 'blur(80px)',
        }}
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 30%, transparent), transparent 60%)',
          filter: 'blur(100px)',
        }}
      />
    </>
  )
}

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.7 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C41.1 35.5 44 30.2 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  )
}
