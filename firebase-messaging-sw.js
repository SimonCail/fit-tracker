// Firebase Cloud Messaging service worker.
// This file must live at the web root (/firebase-messaging-sw.js).
// Keep config in sync with src/lib/firebase.ts — it's OK that it's public.

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyAkLNEAdNUUqtZN2kPAYDs2pbA2ff6ONzk',
  authDomain: 'fit-tracker-f28ce.firebaseapp.com',
  projectId: 'fit-tracker-f28ce',
  storageBucket: 'fit-tracker-f28ce.firebasestorage.app',
  messagingSenderId: '125318038137',
  appId: '1:125318038137:web:61dca7e5471c15cb3d0aa8',
})

const messaging = firebase.messaging()

// We receive data-only FCM payloads (see api/cron/reminders.ts and api/notify.ts).
// The browser does NOT auto-display for data-only messages, so we show the notification here ourselves —
// exactly once per push. `data.tag` keeps reminders and friend requests apart; `data.link` is
// the page to open on click.
messaging.onBackgroundMessage(payload => {
  const data = payload.data || {}
  const title = data.title || payload.notification?.title || 'Fit Tracker'
  const body = data.body || payload.notification?.body || ''
  const options = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag || 'fit-tracker-reminder',
    data,
    requireInteraction: false,
  }
  return self.registration.showNotification(title, options)
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || '/'
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) {
        if ('focus' in client) {
          if (link !== '/' && 'navigate' in client) {
            try { await client.navigate(link) } catch { /* cross-origin or unsupported: just focus */ }
          }
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(link)
    })(),
  )
})