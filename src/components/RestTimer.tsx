import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Pause, Play, RotateCcw, SkipForward, Timer as TimerIcon, X } from 'lucide-react'
import { Button } from './ui'
import { useSettings } from '../store/settings'

export function RestTimer({
  defaultSeconds,
  open,
  onClose,
}: {
  defaultSeconds: number
  open: boolean
  onClose: () => void
}) {
  const [remaining, setRemaining] = useState(defaultSeconds)
  const [running, setRunning] = useState(true)
  const { sound, vibration } = useSettings()
  const beeped = useRef(false)

  useEffect(() => {
    if (open) {
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

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const pct = defaultSeconds > 0 ? (1 - remaining / defaultSeconds) * 100 : 0
  const done = remaining === 0

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed left-4 right-4 bottom-4 z-40 safe-bottom max-w-xl mx-auto"
        >
          <div className="relative overflow-hidden rounded-3xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] shadow-2xl p-5">
            <div
              className="absolute bottom-0 left-0 h-1 bg-[color:var(--color-accent)] transition-[width] duration-1000 ease-linear"
              style={{ width: `${pct}%` }}
            />
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] flex items-center justify-center">
                <TimerIcon size={20} />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-dim)] font-medium">
                  {done ? 'Repos terminé' : 'Repos'}
                </p>
                <p className="font-mono text-4xl tabular leading-none mt-1 font-medium">
                  {mm}:{ss}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!done && (
                  <Button variant="ghost" size="icon" onClick={() => setRunning(r => !r)} aria-label={running ? 'Pause' : 'Reprendre'}>
                    {running ? <Pause size={18} /> : <Play size={18} />}
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => { setRemaining(defaultSeconds); setRunning(true); beeped.current = false }} aria-label="Reset">
                  <RotateCcw size={18} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setRemaining(0)} aria-label="Passer">
                  <SkipForward size={18} />
                </Button>
                <Button variant={done ? 'accent' : 'ghost'} size="icon" onClick={onClose} aria-label="Fermer">
                  <X size={18} />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
