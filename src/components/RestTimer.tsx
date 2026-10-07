import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pause, Play, RotateCcw, X } from 'lucide-react'
import { useSettings } from '../store/settings'
import { cn } from '../lib/cn'

export function RestTimer({
  defaultSeconds,
  open,
  onClose,
}: {
  defaultSeconds: number
  open: boolean
  onClose: () => void
}) {
  const [total, setTotal] = useState(defaultSeconds)
  const [remaining, setRemaining] = useState(defaultSeconds)
  const [running, setRunning] = useState(true)
  const { sound, vibration } = useSettings()
  const beeped = useRef(false)

  useEffect(() => {
    if (open) {
      setTotal(defaultSeconds)
      setRemaining(defaultSeconds)
      setRunning(true)
      beeped.current = false
    }
  }, [open, defaultSeconds])

  useEffect(() => {
    if (!open || !running) return
    const id = window.setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          window.clearInterval(id)
          if (!beeped.current) {
            beeped.current = true
            if (sound) playBeep()
            if (vibration && 'vibrate' in navigator) navigator.vibrate([120, 80, 120])
          }
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [open, running, sound, vibration])

  function adjust(delta: number) {
    setRemaining(r => {
      const next = Math.max(0, r + delta)
      if (next > 0) beeped.current = false
      setTotal(t => Math.max(t, next))
      return next
    })
    if (remaining + delta > 0) setRunning(true)
  }

  function restart() {
    setTotal(defaultSeconds)
    setRemaining(defaultSeconds)
    setRunning(true)
    beeped.current = false
  }

  const mm = Math.floor(remaining / 60)
  const ss = String(remaining % 60).padStart(2, '0')
  const progress = total > 0 ? 1 - remaining / total : 1
  const done = remaining === 0

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          exit={{ y: '110%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pointer-events-none"
          role="timer"
          aria-live="off"
        >
          <div
            className={cn(
              'pointer-events-auto max-w-xl mx-auto rounded-[var(--radius-card)] overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] transition-colors',
              done ? 'bg-ink text-bg' : 'bg-surface text-ink',
            )}
          >
            <div className="h-1 bg-black/10">
              <div
                className={cn('h-full transition-[width] duration-1000 ease-linear', done ? 'bg-bg/40' : 'bg-ink')}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-2 pl-5 pr-2.5 py-3">
              <div className="flex-1 min-w-0">
                <p className={cn('text-[13px] font-semibold', done ? 'opacity-85' : 'text-dim')}>
                  {done ? 'C’est reparti' : running ? 'Repos' : 'En pause'}
                </p>
                <p className="num text-[52px] leading-none mt-0.5" aria-label={`${mm} minutes ${ss} secondes`}>
                  {mm}:{ss}
                </p>
              </div>
              <TimerButton onClick={() => adjust(-15)} label="Retirer 15 secondes" done={done}>−15</TimerButton>
              <TimerButton onClick={() => adjust(15)} label="Ajouter 15 secondes" done={done}>+15</TimerButton>
              {done ? (
                <TimerButton onClick={restart} label="Relancer" done={done}><RotateCcw size={20} /></TimerButton>
              ) : (
                <TimerButton onClick={() => setRunning(r => !r)} label={running ? 'Pause' : 'Reprendre'} done={done}>
                  {running ? <Pause size={20} /> : <Play size={20} />}
                </TimerButton>
              )}
              <TimerButton onClick={onClose} label="Fermer le minuteur" done={done}><X size={20} /></TimerButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function TimerButton({ children, onClick, label, done }: { children: React.ReactNode; onClick: () => void; label: string; done: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        'h-12 w-12 shrink-0 rounded-full grid place-items-center num text-[18px] cursor-pointer active:scale-95 transition-transform',
        done ? 'bg-bg/15' : 'bg-surface-2',
      )}
    >
      {children}
    </button>
  )
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = 880
    g.gain.value = 0.2
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
    o.stop(ctx.currentTime + 0.5)
    setTimeout(() => ctx.close(), 700)
  } catch {
    /* ignore */
  }
}