import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Today } from './pages/Today'
import { SessionPage } from './pages/Session'
import { History } from './pages/History'
import { Evolution } from './pages/Evolution'
import { ConfirmProvider, Spinner, TooltipProvider } from './components/ui'
import { applyTheme, useSettings, watchSystemTheme } from './store/settings'
import { deviceTimezone, readPrefs, writePrefs } from './lib/prefsSync'

function App() {
  const { user, loading } = useAuth()
  const theme = useSettings(s => s.theme)

  useEffect(() => {
    applyTheme(theme)
    if (theme === 'system') return watchSystemTheme(() => applyTheme('system'))
  }, [theme])

  // Sync weeklyPlan/reminders with Firestore (needed for Cloud Function reminders).
  useEffect(() => {
    if (!user) return
    let mounted = true
    // Hydrate: read remote prefs first, merge into local store.
    readPrefs(user.uid)
      .then(remote => {
        if (!mounted || !remote) return
        const s = useSettings.getState()
        const patch: Partial<ReturnType<typeof useSettings.getState>> = {}
        if (remote.weeklyPlan) patch.weeklyPlan = { ...s.weeklyPlan, ...remote.weeklyPlan }
        if (remote.reminders) patch.reminders = { ...s.reminders, ...remote.reminders }
        if (Object.keys(patch).length) useSettings.setState(patch)
      })
      .catch(e => console.warn('readPrefs failed', e))

    // Subscribe: write to Firestore whenever plan/reminders change (debounced).
    let debounce: number | null = null
    const unsub = useSettings.subscribe(state => {
      if (debounce) window.clearTimeout(debounce)
      debounce = window.setTimeout(() => {
        writePrefs(user.uid, {
          weeklyPlan: state.weeklyPlan,
          reminders: state.reminders,
          timezone: deviceTimezone(),
        }).catch(e => console.warn('writePrefs failed', e))
      }, 500)
    })
    return () => {
      mounted = false
      unsub()
      if (debounce) window.clearTimeout(debounce)
    }
  }, [user])

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <TooltipProvider>
      <ConfirmProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Today />} />
              <Route path="session/:id" element={<SessionPage />} />
              <Route path="history" element={<History />} />
              <Route path="evolution" element={<Evolution />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ConfirmProvider>
    </TooltipProvider>
  )
}

export default App
