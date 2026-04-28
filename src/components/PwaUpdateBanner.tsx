import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const HOURLY = 60 * 60 * 1000

export function PwaUpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      // Periodic background check + check whenever the app comes to the foreground.
      // Listeners persist for the page lifetime by design (one-shot setup).
      window.setInterval(() => registration.update(), HOURLY)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update()
      })
    },
    onRegisterError(error) {
      console.warn('Service worker registration failed', error)
    },
  })

  // Force a fresh update check on mount in case the SW was registered before this hook ran.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.getRegistration().then(r => r?.update()).catch(() => {})
  }, [])

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bottom-[max(7.5rem,calc(env(safe-area-inset-bottom)+5rem))] sm:bottom-6 z-50"
        >
          <div className="rounded-2xl bg-[color:var(--color-accent)] text-[color:var(--color-accent-text)] shadow-2xl px-4 py-3 flex items-center gap-3">
            <RefreshCw size={16} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">Nouvelle version dispo</p>
              <p className="text-[11px] opacity-75 leading-tight mt-0.5">Tape pour recharger l'app</p>
            </div>
            <button
              onClick={() => updateServiceWorker(true)}
              className="px-3 h-8 rounded-full bg-[color:var(--color-accent-text)]/15 hover:bg-[color:var(--color-accent-text)]/25 active:scale-95 text-xs font-semibold transition cursor-pointer"
              aria-label="Mettre à jour l'app"
            >
              Mettre à jour
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              className="p-1 rounded-full text-[color:var(--color-accent-text)]/70 hover:text-[color:var(--color-accent-text)] active:scale-90 transition cursor-pointer"
              aria-label="Fermer"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
