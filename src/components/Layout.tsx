import { useMemo, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, House, BookOpen, TrendingUp, Dumbbell, Plus, Settings, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button, Disc } from './ui'
import { SettingsSheet } from './Settings'
import { NewSessionSheet } from './NewSessionSheet'
import { SyncNotice } from './SyncNotice'
import { LayoutCtx, useLayout } from './layoutContext'
import { cn } from '../lib/cn'

type Tab = {
  to: string
  label: string
  icon: typeof House
  end?: boolean
  /** Other pages that belong to this tab (keeps it highlighted there). */
  also?: string[]
}

const HOME: Tab = { to: '/', label: 'Accueil', icon: House, end: true }
const JOURNAL: Tab = { to: '/history', label: 'Journal', icon: BookOpen, also: ['/session/'] }
const PROGRESS: Tab = { to: '/evolution', label: 'Progrès', icon: TrendingUp, also: ['/records', '/exercises', '/exercise/'] }
const EXERCISES: Tab = { to: '/exercises', label: 'Exercices', icon: Dumbbell, also: ['/exercise/'] }
const FRIENDS: Tab = { to: '/friends', label: 'Amis', icon: Users }

// Phone: 4 tabs around the big "+" button; Exercices is reached from Progrès.
const MOBILE_TABS: Tab[] = [HOME, JOURNAL, PROGRESS, FRIENDS]
// Desktop has room for everything.
const DESKTOP_TABS: Tab[] = [HOME, JOURNAL, { ...PROGRESS, also: ['/records'] }, EXERCISES, FRIENDS]

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
        {/* Solid band behind the iPhone status bar: content no longer slides under the clock, and iOS stops drawing its blur there. */}
        <div aria-hidden className="sm:hidden fixed top-0 inset-x-0 z-40 h-[env(safe-area-inset-top)] bg-bg pointer-events-none" />
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

function isActive(pathname: string, tab: Tab) {
  if (tab.end) return pathname === tab.to
  return pathname.startsWith(tab.to) || (tab.also ?? []).some(p => pathname.startsWith(p))
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
          {DESKTOP_TABS.map(t => {
            const active = isActive(pathname, t)
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
                    className="absolute left-3 right-3 bottom-0 h-[2px] bg-accent"
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
  const [left, right] = [MOBILE_TABS.slice(0, 2), MOBILE_TABS.slice(2)]
  return (
    <nav
      aria-label="Navigation principale"
      className="sm:hidden fixed bottom-0 inset-x-0 z-30 bar bar-extend hairline-t pb-tabbar"
    >
      <div className="grid grid-cols-5 items-stretch h-[62px] max-w-xl mx-auto">
        {left.map(t => <TabLink key={t.to} tab={t} pathname={pathname} />)}
        <div className="flex items-center justify-center">
          <button
            onClick={onNew}
            aria-label="Nouvelle séance"
            className="h-12 w-12 rounded-full bg-accent text-on-accent grid place-items-center active:scale-95 transition-transform cursor-pointer"
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>
        </div>
        {right.map(t => <TabLink key={t.to} tab={t} pathname={pathname} />)}
      </div>
    </nav>
  )
}

function TabLink({ tab, pathname }: { tab: Tab; pathname: string }) {
  const active = isActive(pathname, tab)
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
 * Page header. Mobile shows the settings button on top-level pages (desktop has it in the bar). `back` replaces them with a back arrow for detail pages.
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
  const kickerEl = kicker && <p className="text-[14px] text-dim font-medium first-letter:uppercase truncate">{kicker}</p>
  const titleEl = title && <h1 className="t-title text-[36px] sm:text-[44px] break-words">{title}</h1>

  // Detail pages: back arrow on its own row, title underneath (like iOS).
  if (back) {
    return (
      <header className={cn('pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:pt-8 pb-5', className)}>
        <div className="flex items-center gap-2 min-h-11 -mx-1.5">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label="Retour" className="text-ink">
            <ChevronLeft size={24} />
          </Button>
          <div className="flex-1 min-w-0 px-1.5">{kickerEl}</div>
          {actions}
        </div>
        {title && <div className="mt-1">{titleEl}</div>}
      </header>
    )
  }

  // Top-level pages: the title shares its row with the Amis / Réglages buttons.
  return (
    <header className={cn('pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:pt-8 pb-5', className)}>
      <div className="flex items-center gap-3 min-h-11">
        {/* With a kicker (e.g. the date), it shares the icons' row and the title goes below. */}
        <div className="flex-1 min-w-0">{kicker ? kickerEl : titleEl}</div>
        <div className="flex items-center shrink-0 -mr-1.5">
          {actions}
          <Button variant="ghost" size="icon" onClick={openSettings} aria-label="Réglages" className="sm:hidden">
            <Settings size={21} />
          </Button>
        </div>
      </div>
      {kicker && title && <div className="mt-3">{titleEl}</div>}
    </header>
  )
}