import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CloudOff, RefreshCw } from 'lucide-react'
import { useSyncStatus } from '../lib/sync'
import { cn } from '../lib/cn'

type Mode = 'offline' | 'syncing' | 'synced' | null

/**
 * Tells the truth about where data lives. Offline: everything is kept on the phone.
 * Back online: shows the catch-up, then a short confirmation.
 */
export function SyncNotice({ raised, top }: { raised: boolean; top?: boolean }) {
  const { online, pending } = useSyncStatus()
  const [mode, setMode] = useState<Mode>(null)
  const wasBehind = useRef(false)

  useEffect(() => {
    if (!online) {
      wasBehind.current = true
      setMode('offline')
      return
    }
    if (pending > 0) {
      // Only show "syncing" if it lasts — normal writes finish before anyone notices.
      const t = window.setTimeout(() => { wasBehind.current = true; setMode('syncing') }, 1500)
      return () => window.clearTimeout(t)
    }
    if (wasBehind.current) {
      wasBehind.current = false
      setMode('synced')
      const t = window.setTimeout(() => setMode(null), 2500)
      return () => window.clearTimeout(t)
    }
    setMode(null)
  }, [online, pending])

  const text =
    mode === 'offline'
      ? pending > 0
        ? `Hors ligne · ${pending} modification${pending > 1 ? 's' : ''} gardée${pending > 1 ? 's' : ''} sur l’appareil`
        : 'Hors ligne · tout ce que tu notes reste sur l’appareil'
      : mode === 'syncing'
        ? 'Synchronisation…'
        : 'Tout est synchronisé'

  return (
    <AnimatePresence>
      {mode && (
        <motion.div
          initial={{ y: top ? -16 : 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: top ? -16 : 16, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          role="status"
          aria-live="polite"
          className={cn(
            'fixed z-40 left-1/2 -translate-x-1/2 sm:left-6 sm:translate-x-0 sm:bottom-6 pointer-events-none',
            top
              ? 'max-sm:top-[calc(env(safe-area-inset-top)+4rem)]'
              : raised ? 'bottom-[calc(env(safe-area-inset-bottom)+4.75rem)]' : 'bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]',
          )}
        >
          <div
            className={cn(
              'flex items-center gap-2 h-9 pl-3 pr-4 rounded-full text-[13px] font-semibold whitespace-nowrap shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)]',
              mode === 'offline' ? 'bg-ink text-bg' : 'bg-surface-2 text-ink',
            )}
          >
            {mode === 'offline' && <CloudOff size={15} />}
            {mode === 'syncing' && <RefreshCw size={15} className="animate-spin [animation-duration:1.6s]" />}
            {mode === 'synced' && <Check size={15} className="text-run" />}
            {text}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}