import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Unit } from '../lib/units'

/** 'system' follows the device (Nuit / Craie). The others are fixed palettes, see index.css. */
export type Theme = 'system' | 'dark' | 'light' | 'slate' | 'forest' | 'plum' | 'sand' | 'rose'

type ResolvedTheme = Exclude<Theme, 'system'>

export type ThemeMeta = {
  value: Theme
  label: string
  /** Swatch colours for the picker (must match index.css). */
  bg: string
  surface: string
  accent: string
}

const THEME_INFO: Record<ResolvedTheme, { dark: boolean; bg: string; surface: string; accent: string; label: string }> = {
  dark: { label: 'Nuit', dark: true, bg: '#000000', surface: '#151515', accent: '#F3F2EE' },
  light: { label: 'Craie', dark: false, bg: '#F2F2EF', surface: '#FFFFFF', accent: '#131312' },
  slate: { label: 'Ardoise', dark: true, bg: '#0D1117', surface: '#161B23', accent: '#C4B5FD' },
  forest: { label: 'Forêt', dark: true, bg: '#0A110D', surface: '#121C16', accent: '#C5E86C' },
  plum: { label: 'Prune', dark: true, bg: '#110B13', surface: '#1B131E', accent: '#E58BD0' },
  sand: { label: 'Sable', dark: false, bg: '#F1EADF', surface: '#FBF7F0', accent: '#6B4A2B' },
  rose: { label: 'Rose', dark: false, bg: '#F6E9E8', surface: '#FFF8F7', accent: '#7C3A8F' },
}

export const THEMES: ThemeMeta[] = [
  { value: 'system', label: 'Auto', bg: '#000000', surface: '#F2F2EF', accent: '#888888' },
  ...(Object.keys(THEME_INFO) as ResolvedTheme[]).map(k => ({
    value: k,
    label: THEME_INFO[k].label,
    bg: THEME_INFO[k].bg,
    surface: THEME_INFO[k].surface,
    accent: THEME_INFO[k].accent,
  })),
]

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type WeeklyPlan = Record<DayKey, string | null>

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
export const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Lundi', tue: 'Mardi', wed: 'Mercredi', thu: 'Jeudi', fri: 'Vendredi', sat: 'Samedi', sun: 'Dimanche',
}

export function dateToDayKey(d: Date): DayKey {
  // JS: Sunday=0, Monday=1...
  const idx = d.getDay()
  const map: Record<number, DayKey> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' }
  return map[idx]
}

type Profile = {
  name: string | null
  heightCm: number | null
  birthYear: number | null
  sex: 'male' | 'female' | 'other' | null
}

export type Reminders = {
  enabled: boolean
  time: string // "HH:mm"
}

type SettingsState = {
  theme: Theme
  unit: Unit
  restSeconds: number
  sound: boolean
  vibration: boolean
  profile: Profile
  weeklyPlan: WeeklyPlan
  reminders: Reminders
  /** Empty-bar weight for the plate calculator, in each unit system. */
  bar: { kg: number; lb: number }
  /** Sessions per week to keep the regularity streak going. */
  weeklyGoal: number
  setWeeklyGoal: (n: number) => void
  setBar: (unit: Unit, value: number) => void
  setTheme: (t: Theme) => void
  setUnit: (u: Unit) => void
  setRestSeconds: (s: number) => void
  setSound: (b: boolean) => void
  setVibration: (b: boolean) => void
  setProfile: (p: Partial<Profile>) => void
  setPlanDay: (day: DayKey, label: string | null) => void
  setReminders: (p: Partial<Reminders>) => void
}

const emptyPlan: WeeklyPlan = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null }

export const useSettings = create<SettingsState>()(
  persist(
    set => ({
      theme: 'dark',
      unit: 'kg',
      restSeconds: 90,
      sound: true,
      vibration: true,
      profile: { name: null, heightCm: null, birthYear: null, sex: null },
      weeklyPlan: emptyPlan,
      reminders: { enabled: false, time: '20:00' },
      bar: { kg: 20, lb: 45 },
      weeklyGoal: 2,
      setWeeklyGoal: n => set({ weeklyGoal: Math.max(1, Math.min(7, Math.round(n))) }),
      setBar: (u, value) => set(s => ({ bar: { ...(s.bar ?? { kg: 20, lb: 45 }), [u]: value } })),
      setTheme: t => set({ theme: t }),
      setUnit: u => set({ unit: u }),
      setRestSeconds: s => set({ restSeconds: s }),
      setSound: b => set({ sound: b }),
      setVibration: b => set({ vibration: b }),
      setProfile: p => set(s => ({ profile: { ...s.profile, ...p } })),
      setPlanDay: (day, label) => set(s => ({ weeklyPlan: { ...s.weeklyPlan, [day]: label } })),
      setReminders: p => set(s => ({ reminders: { ...s.reminders, ...p } })),
    }),
    { name: 'fit-tracker:settings' },
  ),
)

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  const resolved: ResolvedTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : (theme in THEME_INFO ? theme : 'dark')
  const info = THEME_INFO[resolved]
  root.classList.toggle('dark', info.dark)
  root.dataset.theme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', info.bg)
}

export function watchSystemTheme(onChange: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}