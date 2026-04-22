import { format } from 'date-fns'
import { DAY_LABELS, dateToDayKey, type WeeklyPlan } from '../store/settings'

const LAST_NOTIFY_KEY = 'fit-tracker:last-notify'

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export function notificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied'
  return Notification.permission
}

/**
 * Check whether we should fire a reminder right now, and if so fire it.
 * Called on app load + visibility change.
 */
export async function maybeFireReminder(opts: {
  enabled: boolean
  time: string // "HH:mm"
  weeklyPlan: WeeklyPlan
  todaySessionExists: boolean
}) {
  if (!opts.enabled) return
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const now = new Date()
  const todayKey = dateToDayKey(now)
  const plan = opts.weeklyPlan[todayKey]
  if (!plan) return
  if (opts.todaySessionExists) return

  const [h, m] = opts.time.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return
  const reminderAt = new Date(now)
  reminderAt.setHours(h, m, 0, 0)
  if (now < reminderAt) return

  const todayIso = format(now, 'yyyy-MM-dd')
  const last = localStorage.getItem(LAST_NOTIFY_KEY)
  if (last === todayIso) return

  try {
    const reg = await navigator.serviceWorker?.ready
    const payload: NotificationOptions = {
      body: `${DAY_LABELS[todayKey]} : ${plan}. Il est encore temps.`,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'daily-reminder',
      requireInteraction: false,
    }
    if (reg) {
      await reg.showNotification('Ta séance t\'attend', payload)
    } else if (typeof Notification !== 'undefined') {
      new Notification('Ta séance t\'attend', payload)
    }
    localStorage.setItem(LAST_NOTIFY_KEY, todayIso)
  } catch (e) {
    console.warn('reminder notification failed', e)
  }
}
