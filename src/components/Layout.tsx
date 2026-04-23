import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Settings, Dumbbell, LineChart, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button, Tooltip, TooltipContent, TooltipTrigger } from './ui'
import { SettingsSheet } from './Settings'
import { cn } from '../lib/cn'

export function Layout() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const loc = useLocation()

  const tabs = [
    { to: '/', label: "Aujourd'hui", end: true },
    { to: '/history', label: 'Historique' },
    { to: '/evolution', label: 'Évolution' },
  ]

  const onSessionRoute = loc.pathname.startsWith('/session/')

  return (
    <div className="min-h-[100dvh] flex flex-col">
      {/* Top bar: desktop only (sm+). On mobile we use a bottom tab bar exclusively. */}
      <div className="sticky top-0 z-30 pointer-events-none hidden sm:block">
        <div className="safe-top pt-3 pb-3 px-3">
          <div className="max-w-xl mx-auto pointer-events-auto">
            <div className="liquid-glass rounded-full pl-3 pr-2 h-14 flex items-center gap-2">
              <Link to="/" className="flex items-center gap-2 group shrink-0">
                <div className="w-8 h-8 rounded-xl bg-[color:var(--color-text)] text-[color:var(--color-bg)] flex items-center justify-center group-hover:bg-[color:var(--color-accent)] group-hover:text-[color:var(--color-accent-text)] group-hover:rotate-[-8deg] transition-all duration-300">
                  <Dumbbell size={16} />
                </div>
                <span className="font-display text-lg tracking-tight">Fit</span>
              </Link>
              {!onSessionRoute && (
                <nav className="flex-1 flex justify-center">
                  <div className="relative inline-flex items-center p-1">
                    {tabs.map(t => {
                      const active = t.end ? loc.pathname === t.to : loc.pathname.startsWith(t.to)
                      return (
                        <Link
                          key={t.to}
                          to={t.to}
                          className={cn(
                            'relative px-3.5 h-8 flex items-center rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                            active
                              ? 'text-[color:var(--color-text)]'
                              : 'text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]',
                          )}
                        >
                          {active && (
                            <motion.div
                              layoutId="active-tab"
                              className="absolute inset-0 bg-[color:var(--color-surface-2)] rounded-full shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-text)_12%,transparent)]"
                              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                            />
                          )}
                          <span className="relative z-10">{t.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </nav>
              )}
              {onSessionRoute && <div className="flex-1" />}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} aria-label="Réglages" className="shrink-0">
                    <Settings size={18} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Réglages</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-xl w-full mx-auto px-4 pb-28 pt-4 sm:pt-0 safe-top sm:[padding-top:0]">
        <Outlet />
      </main>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      <MobileTabBar loc={loc.pathname} onSettingsClick={() => setSettingsOpen(true)} />
    </div>
  )
}

function MobileTabBar({ loc, onSettingsClick }: { loc: string; onSettingsClick: () => void }) {
  if (loc.startsWith('/session/')) return null
  const tabs = [
    { to: '/', icon: Clock, end: true, label: "Aujourd'hui" },
    { to: '/history', icon: Dumbbell, label: 'Historique' },
    { to: '/evolution', icon: LineChart, label: 'Évolution' },
  ]
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-20 pointer-events-none">
      <div className="max-w-xl mx-auto px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pointer-events-auto">
        <div className="liquid-glass rounded-full flex items-center justify-around p-1 h-14 relative">
          {tabs.map(({ to, icon: Icon, end, label }) => {
            const active = end ? loc === to : loc.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                className="relative flex-1 h-12 flex items-center justify-center rounded-full transition-colors"
              >
                {active && (
                  <motion.div
                    layoutId="active-mobile-tab"
                    className="absolute inset-0 bg-[color:var(--color-text)] rounded-full shadow-lg"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon
                  size={18}
                  className={cn(
                    'relative z-10 transition-colors',
                    active ? 'text-[color:var(--color-bg)]' : 'text-[color:var(--color-text-dim)]',
                  )}
                />
              </Link>
            )
          })}
          <button
            onClick={onSettingsClick}
            aria-label="Réglages"
            className="flex-1 h-12 flex items-center justify-center rounded-full text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] transition-colors cursor-pointer"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </nav>
  )
}
