import { useMemo, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, House, BookOpen, TrendingUp, Dumbbell, Plus, Settings } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button, Disc } from './ui'
import { SettingsSheet } from './Settings'
import { NewSessionSheet } from './NewSessionSheet'
import { SyncNotice } from './SyncNotice'
import { LayoutCtx, useLayout } from './layoutContext'
import { cn } from '../lib/cn'

const TABS = [
  { to: '/', label: 'Accueil', icon: House, end: true },
  { to: '/history', label: 'Journal', icon: BookOpen },
  { to: '/evolution', label: 'Progrès', icon: TrendingUp },
  { to: '/exercises', label: 'Exercices', icon: Dumbbell },
] as const

export function Layout() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const loc = useLocation()
  // Inside a session the tab bar steps aside: the screen is for logging sets.
  const focusMode = loc.pathname.startsWith('/session/')

  const actions = useMemo(
    () => ({ openSettings: () => setSettingsOpen(true), openNewSession: () => setNewOpen(true) }),
    [],
  )

  return (
    <LayoutCtx.Provider value={actions}>
      <div className="min-h-[100dvh] flex flex-col">
        <DesktopBar pathname={loc.pathname} />

        <main
          className={cn(
            'flex-1 w-full mx-auto max-w-xl md:max-w-2xl lg:max-w-none px-4 sm:px-6 lg:px-10 xl:px-14',
            focusMode ? 'pb-10' : 'pb-[calc(env(safe-area-inset-bottom)+6.5rem)] sm:pb-14',
          )}
        >
          <Outlet />
        </main>

        {!focusMode && <MobileTabBar pathname={loc.pathname} onNew={() => setNewOpen(true)} />}

        <SyncNotice raised={!focusMode} top={focusMode} />
        <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
        <NewSessionSheet open={newOpen} onOpenChange={setNewOpen} />
      </div>
    </LayoutCtx.Provider>
  )
}

function isActive(pathname: string, to: string, end?: boolean) {
  return end ? pathname === to : pathname.startsWith(to)
}

function DesktopBar({ pathname }: { pathname: string }) {
  const { openSettings, openNewSession } = useLayout()
  return (
    <header className="hidden sm:block sticky top-0 z-30 bar hairline-b safe-top">
      <div className="max-w-2xl lg:max-w-none mx-auto px-6 lg:px-10 xl:px-14 h-16 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Accueil">
          <Disc size={22} />
          <span className="t-heading text-[18px]">Fit</span>
        </Link>
        <nav className="flex-1 flex items-center gap-1">
          {TABS.map(t => {
            const active = isActive(pathname, t.to, 'end' in t ? t.end : false)
            return (
              <Link
                key={t.to}
                to={t.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative h-16 px-3 flex items-center text-[14px] font-semibold transition-colors',
                  active ? 'text-ink' : 'text-dim hover:text-ink',
                )}
              >
                {t.label}
                {active && (
                  <motion.span
                    layoutId="desktop-tab"
                    className="absolute left-3 right-3 bottom-0 h-[2px] bg-ink"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
              </Link>
            )
          })}
        </nav>
        <Button size="sm" onClick={openNewSession}>
          <Plus size={16} strokeWidth={2.5} /> Séance
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={openSettings} aria-label="Réglages">
          <Settings size={18} />
        </Button>
      </div>
    </header>
  )
}

function MobileTabBar({ pathname, onNew }: { pathname: string; onNew: () => void }) {
  const [left, right] = [TABS.slice(0, 2), TABS.slice(2)]
  return (
    <nav
      aria-label="Navigation principale"
      className="sm:hidden fixed bottom-0 inset-x-0 z-30 bar hairline-t pb-safe"
    >
      <div className="grid grid-cols-5 items-stretch h-[62px] max-w-xl mx-auto">
        {left.map(t => <TabLink key={t.to} tab={t} pathname={pathname} />)}
        <div className="flex items-center justify-center">
          <button
            onClick={onNew}
            aria-label="Nouvelle séance"
            className="h-12 w-12 rounded-full bg-ink text-bg grid place-items-center active:scale-95 transition-transform cursor-pointer"
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>
        </div>
        {right.map(t => <TabLink key={t.to} tab={t} pathname={pathname} />)}
      </div>
    </nav>
  )
}

function TabLink({ tab, pathname }: { tab: (typeof TABS)[number]; pathname: string }) {
  const active = isActive(pathname, tab.to, 'end' in tab ? tab.end : false)
  const Icon = tab.icon
  return (
    <Link
      to={tab.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-col items-center justify-center gap-1 transition-colors',
        active ? 'text-ink' : 'text-faint active:text-dim',
      )}
    >
      <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
      <span className={cn('text-[11px] leading-none', active ? 'font-bold' : 'font-medium')}>{tab.label}</span>
    </Link>
  )
}

/**
 * Page header. Mobile shows the settings button on top-level pages (desktop has it in the bar).
 * `back` replaces it with a back arrow for detail pages.
 */
export function PageHeader({
  title,
  kicker,
  back,
  actions,
  className,
}: {
  title?: ReactNode
  kicker?: ReactNode
  back?: boolean
  actions?: ReactNode
  className?: string
}) {
  const nav = useNavigate()
  const { openSettings } = useLayout()
  return (
    <header className={cn('pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:pt-8 pb-5', className)}>
      <div className="flex items-center gap-2 min-h-11 -mx-1.5">
        {back ? (
          <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label="Retour" className="text-ink">
            <ChevronLeft size={24} />
          </Button>
        ) : null}
        <div className="flex-1 min-w-0 px-1.5">
          {kicker && <p className="text-[14px] text-dim font-medium first-letter:uppercase truncate">{kicker}</p>}
        </div>
        {actions}
        {!back && (
          <Button variant="ghost" size="icon" onClick={openSettings} aria-label="Réglages" className="sm:hidden">
            <Settings size={21} />
          </Button>
        )}
      </div>
      {title && <h1 className="t-title text-[36px] sm:text-[44px] mt-1 break-words">{title}</h1>}
    </header>
  )
}