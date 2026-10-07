import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { X } from 'lucide-react'
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
      window.setInterval(() => registration.update(), HOURLY)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update()
      })
    },
    onRegisterError(error) {
      console.warn('Service worker registration failed', error)
    },
  })

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.getRegistration().then(r => r?.update()).catch(() => {})
  }, [])

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed left-3 right-3 sm:left-auto sm:right-6 sm:w-96 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:bottom-6 z-50"
          role="status"
        >
          <div className="rounded-[12px] bg-ink text-bg pl-4 pr-2 py-2 flex items-center gap-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)]">
            <p className="flex-1 min-w-0 text-[14px] font-semibold">Une nouvelle version est prête</p>
            <button
              onClick={() => updateServiceWorker(true)}
              className="h-10 px-4 rounded-[12px] bg-bg text-ink text-[14px] font-semibold cursor-pointer active:scale-95 transition-transform"
            >
              Mettre à jour
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              className="h-10 w-10 grid place-items-center rounded-full opacity-70 hover:opacity-100 cursor-pointer"
              aria-label="Plus tard"
            >
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}