import { useState } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { ArrowRight, BellRing, CalendarDays, Dumbbell, Flame, Lock, Mail, Scale, Timer, Zap } from 'lucide-react'
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
    <div className="relative min-h-[100dvh] flex flex-col overflow-hidden">
      <GridPattern />
      <BackgroundGlow />

      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full px-6 py-10 relative z-10 safe-top safe-bottom">
        {/* Logo with pulsing glow */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-2.5 mb-10"
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-[color:var(--color-accent)] opacity-20 blur-lg pulse-accent" />
            <div className="relative w-10 h-10 rounded-xl bg-[color:var(--color-text)] text-[color:var(--color-bg)] flex items-center justify-center">
              <Dumbbell size={18} />
            </div>
          </div>
          <span className="font-display text-xl tracking-tight">Fit Tracker</span>
        </motion.div>

        {/* Hero headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--color-text-dim)] font-semibold mb-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]">
              <span className="w-1 h-1 rounded-full bg-[color:var(--color-accent)] pulse-accent" />
              Nouveau
            </span>
            <span>App de muscu · PWA</span>
          </p>
          <h1 className="font-display text-[3.2rem] sm:text-[4rem] leading-[0.92] tracking-tight">
            Lève plus.<br />
            <span className="relative inline-block">
              <span className="relative z-10 text-[color:var(--color-accent)]">Vois tout.</span>
              <span className="absolute left-0 right-0 bottom-1 h-2 bg-[color:var(--color-accent)]/20 -skew-x-6" aria-hidden />
            </span>
          </h1>
          <p className="text-[color:var(--color-text-dim)] text-[15px] mt-5 leading-relaxed max-w-sm">
            Log tes séries, suis ton poids, garde ton streak. Installation en 1 tap sur ton tel.
            Sans tableau Excel, sans pub, sans friction.
          </p>
        </motion.div>

        {/* Feature cards with mini-previews */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 0.3 } } }}
          className="grid grid-cols-2 gap-2.5 mt-9"
        >
          <FeatureCard
            icon={<CalendarDays size={14} />}
            title="Planning hebdo"
            subtitle="Lundi pecs, jeudi dos…"
          >
            <div className="flex gap-0.5 mt-3">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex-1 h-6 rounded text-[8px] font-bold flex items-center justify-center',
                    [1, 3, 5].includes(i)
                      ? 'bg-[color:var(--color-accent)] text-[color:var(--color-accent-text)]'
                      : 'bg-[color:var(--color-surface-2)] text-[color:var(--color-text-dim)]',
                  )}
                >
                  {d}
                </div>
              ))}
            </div>
          </FeatureCard>

          <FeatureCard
            icon={<Flame size={14} />}
            title="Streak"
            subtitle="Motivation quotidienne"
          >
            <div className="flex items-baseline gap-1.5 mt-3">
              <span className="font-display text-2xl tabular text-[color:var(--color-accent)] leading-none">17</span>
              <span className="text-[10px] uppercase tracking-widest text-[color:var(--color-text-dim)] font-medium">jours</span>
            </div>
          </FeatureCard>

          <FeatureCard
            icon={<Timer size={14} />}
            title="Timer de repos"
            subtitle="Auto entre chaque série"
          >
            <div className="flex items-center gap-1 mt-3">
              <span className="font-mono text-lg tabular font-semibold leading-none">01:30</span>
              <span className="flex-1 h-1 rounded-full bg-[color:var(--color-surface-2)] overflow-hidden">
                <span className="block h-full w-2/3 bg-[color:var(--color-accent)]" />
              </span>
            </div>
          </FeatureCard>

          <FeatureCard
            icon={<BellRing size={14} />}
            title="Rappels"
            subtitle="Quand tu slack, pas plus"
          >
            <div className="flex items-center gap-2 mt-3">
              <div className="w-7 h-7 rounded-lg bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] flex items-center justify-center shrink-0">
                <Dumbbell size={12} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-[color:var(--color-text)] font-semibold truncate">Ta séance t'attend</p>
                <p className="text-[8px] text-[color:var(--color-text-dim)] truncate">Jeudi · Pecs & triceps</p>
              </div>
            </div>
          </FeatureCard>
        </motion.div>

        {/* Trust chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="flex items-center justify-center flex-wrap gap-x-4 gap-y-2 mt-7 text-[10px] uppercase tracking-[0.16em] text-[color:var(--color-text-dim)] font-medium"
        >
          <span className="flex items-center gap-1"><Lock size={10} /> Privé</span>
          <span className="opacity-40">·</span>
          <span className="flex items-center gap-1"><Zap size={10} /> Instant sync</span>
          <span className="opacity-40">·</span>
          <span className="flex items-center gap-1"><Scale size={10} /> kg / lb</span>
        </motion.div>

        {!isConfigured && (
          <div className="rounded-2xl p-4 mt-6 bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm">
            <p className="font-medium text-[color:var(--color-danger)] mb-1">Configuration manquante</p>
            <p className="text-[color:var(--color-text-dim)]">Remplis <code className="text-xs">.env.local</code> avec tes clés Firebase.</p>
          </div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-3 mt-5 bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/30 text-sm"
          >
            <p className="text-[color:var(--color-danger)] break-words">{error}</p>
          </motion.div>
        )}

        {/* Auth CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-8"
        >
          {mode === 'choose' ? (
            <div className="space-y-2.5">
              <Button
                onClick={onGoogle}
                disabled={loading}
                variant="accent"
                size="lg"
                className="w-full justify-center gap-3 h-14 text-base group relative overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <GoogleIcon size={18} />
                <span className="relative">Continuer avec Google</span>
                <ArrowRight size={16} className="opacity-70 relative group-hover:translate-x-0.5 transition-transform" />
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
            </div>
          ) : (
            <form onSubmit={e => onEmailPassword(e, false)} className="space-y-2.5">
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
                  Créer
                </Button>
              </div>
              <Button type="button" variant="ghost" onClick={() => setMode('choose')} className="w-full">
                ← Retour
              </Button>
            </form>
          )}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 1.1, duration: 0.8 }}
          className="text-[10px] text-center text-[color:var(--color-text-dim)] pt-5 leading-relaxed"
        >
          Tes données restent à toi. Stockées chez Firebase (Google), accessibles à toi seul.
        </motion.p>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  children?: React.ReactNode
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
      }}
      whileHover={{ y: -2 }}
      className={cn(
        'relative rounded-2xl p-3.5 bg-[color:var(--color-surface)]/70 border border-[color:var(--color-border)] backdrop-blur-sm',
        'hover:border-[color:var(--color-border-strong)] transition-colors overflow-hidden',
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="w-6 h-6 rounded-lg bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] flex items-center justify-center shrink-0">
          {icon}
        </span>
        <span className="text-[12px] font-semibold text-[color:var(--color-text)] leading-tight">{title}</span>
      </div>
      <p className="text-[10px] text-[color:var(--color-text-dim)] leading-tight">{subtitle}</p>
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
        backgroundSize: '48px 48px',
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
        className="absolute -top-40 -right-20 w-[500px] h-[500px] rounded-full opacity-40 pointer-events-none animate-[pulse_8s_ease-in-out_infinite]"
        style={{
          background: 'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 50%, transparent), transparent 65%)',
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
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.7 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C41.1 35.5 44 30.2 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
