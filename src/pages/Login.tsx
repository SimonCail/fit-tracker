import { useState } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { ArrowRight, CalendarDays, Dumbbell, Flame, Lock, Mail, Scale, Timer, Zap } from 'lucide-react'
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
    <div className="relative h-[100dvh] flex flex-col overflow-hidden">
      <GridPattern />
      <BackgroundGlow />

      <div className="flex-1 min-h-0 flex flex-col max-w-md mx-auto w-full px-5 relative z-10 safe-top safe-bottom py-4">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-2 shrink-0"
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-[color:var(--color-accent)] opacity-20 blur-md pulse-accent" />
            <div className="relative w-8 h-8 rounded-lg bg-[color:var(--color-text)] text-[color:var(--color-bg)] flex items-center justify-center">
              <Dumbbell size={15} />
            </div>
          </div>
          <span className="font-display text-lg tracking-tight">Fit Tracker</span>
        </motion.div>

        {/* Hero — compact */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 sm:mt-8"
        >
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-text-dim)] font-semibold mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]">
              <span className="w-1 h-1 rounded-full bg-[color:var(--color-accent)] pulse-accent" />
              Nouveau
            </span>
            <span>App de muscu · PWA</span>
          </p>
          <h1 className="font-display text-[2.4rem] sm:text-5xl leading-[0.92] tracking-tight">
            Lève plus.<br />
            <span className="relative inline-block">
              <span className="relative z-10 text-[color:var(--color-accent)]">Vois tout.</span>
              <span className="absolute left-0 right-0 bottom-1 h-2 bg-[color:var(--color-accent)]/20 -skew-x-6" aria-hidden />
            </span>
          </h1>
          <p className="text-[color:var(--color-text-dim)] text-sm mt-3 leading-snug">
            Tes séries, ton poids, ton streak. Rappels intelligents. Pas de tableur, pas de pub.
          </p>
        </motion.div>

        {/* 3 feature mini-cards, single row */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } } }}
          className="grid grid-cols-3 gap-2 mt-5"
        >
          <FeatureCard icon={<CalendarDays size={13} />} label="Planning">
            <div className="flex gap-0.5">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={cn(
                    'flex-1 h-1.5 rounded-full',
                    [1, 3].includes(i) ? 'bg-[color:var(--color-accent)]' : 'bg-[color:var(--color-surface-2)]',
                  )}
                />
              ))}
            </div>
          </FeatureCard>
          <FeatureCard icon={<Flame size={13} />} label="Streak">
            <p className="font-display text-lg tabular text-[color:var(--color-accent)] leading-none">17<span className="text-[9px] text-[color:var(--color-text-dim)] font-sans ml-1">j</span></p>
          </FeatureCard>
          <FeatureCard icon={<Timer size={13} />} label="Repos">
            <p className="font-mono text-sm tabular font-semibold leading-none">01:30</p>
          </FeatureCard>
        </motion.div>

        {/* Spacer to push auth to bottom */}
        <div className="flex-1 min-h-[16px]" />

        {!isConfigured && (
          <div className="rounded-2xl p-3 mb-3 bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-xs shrink-0">
            <p className="font-medium text-[color:var(--color-danger)] mb-0.5">Configuration manquante</p>
            <p className="text-[color:var(--color-text-dim)]">Remplis <code className="text-xs">.env.local</code>.</p>
          </div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-2.5 mb-3 bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-xs shrink-0"
          >
            <p className="text-[color:var(--color-danger)] break-words">{error}</p>
          </motion.div>
        )}

        {/* Auth CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="shrink-0"
        >
          {mode === 'choose' ? (
            <div className="space-y-2">
              <Button
                onClick={onGoogle}
                disabled={loading}
                variant="accent"
                size="lg"
                className="w-full justify-center gap-3 h-13 text-[15px] group relative overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <GoogleIcon size={18} />
                <span className="relative">Continuer avec Google</span>
                <ArrowRight size={15} className="opacity-70 relative group-hover:translate-x-0.5 transition-transform" />
              </Button>
              <Button
                onClick={() => setMode('email')}
                disabled={loading}
                variant="secondary"
                size="md"
                className="w-full justify-center gap-2"
              >
                <Mail size={14} />
                Continuer avec un email
              </Button>
            </div>
          ) : (
            <form onSubmit={e => onEmailPassword(e, false)} className="space-y-2">
              <Input
                type="email"
                placeholder="ton@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                inputMode="email"
                className="h-11"
              />
              <Input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                minLength={6}
                className="h-11"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button type="submit" variant="accent" disabled={loading || !email || !password}>
                  {loading ? '…' : 'Se connecter'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={e => onEmailPassword(e, true)}
                  disabled={loading || !email || !password}
                >
                  Créer
                </Button>
              </div>
              <Button type="button" variant="ghost" onClick={() => setMode('choose')} className="w-full">
                ← Retour
              </Button>
            </form>
          )}

          {/* Trust chips in the same bottom area */}
          <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 mt-4 text-[9px] uppercase tracking-[0.16em] text-[color:var(--color-text-dim)] font-medium">
            <span className="flex items-center gap-1"><Lock size={9} /> Privé</span>
            <span className="opacity-40">·</span>
            <span className="flex items-center gap-1"><Zap size={9} /> Instant sync</span>
            <span className="opacity-40">·</span>
            <span className="flex items-center gap-1"><Scale size={9} /> kg / lb</span>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children?: React.ReactNode
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
      }}
      whileHover={{ y: -2 }}
      className={cn(
        'rounded-xl p-2.5 bg-[color:var(--color-surface)]/70 border border-[color:var(--color-border)] backdrop-blur-sm',
        'hover:border-[color:var(--color-border-strong)] transition-colors',
      )}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-5 h-5 rounded bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] flex items-center justify-center shrink-0">
          {icon}
        </span>
        <span className="text-[10px] uppercase tracking-widest font-semibold text-[color:var(--color-text-dim)] truncate">{label}</span>
      </div>
      {children}
    </motion.div>
  )
}

function GridPattern() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 opacity-[0.4] pointer-events-none z-0"
      style={{
        backgroundImage: `
          linear-gradient(to right, var(--color-border) 1px, transparent 1px),
          linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        maskImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, #000 40%, transparent 90%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, #000 40%, transparent 90%)',
      }}
    />
  )
}

function BackgroundGlow() {
  return (
    <>
      <div
        aria-hidden
        className="absolute -top-32 -right-20 w-[400px] h-[400px] rounded-full opacity-40 pointer-events-none animate-[pulse_8s_ease-in-out_infinite]"
        style={{
          background: 'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 50%, transparent), transparent 65%)',
          filter: 'blur(70px)',
        }}
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 30%, transparent), transparent 60%)',
          filter: 'blur(90px)',
        }}
      />
    </>
  )
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
