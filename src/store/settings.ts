import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Unit } from '../lib/units'

export type Theme = 'light' | 'dark' | 'system'

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
  const resolved = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.theme = resolved
  const themeColor = resolved === 'dark' ? '#0A0A0B' : '#FAFAFA'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor)
}

export function watchSystemTheme(onChange: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
