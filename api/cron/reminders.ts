import type { VercelRequest, VercelResponse } from '@vercel/node'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging'
import { formatInTimeZone } from 'date-fns-tz'

const DEFAULT_TZ = 'Europe/Paris'
const WINDOW_MINUTES = 20

const DAY_MAP: Record<number, string> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
}

const DAY_LABELS: Record<string, string> = {
  mon: 'Lundi', tue: 'Mardi', wed: 'Mercredi', thu: 'Jeudi', fri: 'Vendredi', sat: 'Samedi', sun: 'Dimanche',
}

type Reminders = { enabled: boolean; time: string }
type WeeklyPlan = Record<string, string | null | undefined>
type Prefs = {
  reminders?: Reminders
  weeklyPlan?: WeeklyPlan
  timezone?: string
  lastNotifiedOn?: string
}

function initAdmin() {
  if (getApps().length) return
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT env var missing')
  let parsed
  try {
    parsed = JSON.parse(sa)
  } catch (e) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT is not valid JSON: ${(e as Error).message}`)
  }
  initializeApp({ credential: cert(parsed) })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const secret = process.env.CRON_SECRET
    const auth = req.headers.authorization ?? ''
    if (!secret || auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    const force = String(req.query.force ?? '') === 'true'

    try {
      initAdmin()
    } catch (e) {
      console.error('[reminders] admin init failed', e)
      return res.status(500).json({ error: 'admin init failed', detail: String(e) })
    }

    const db = getFirestore()
    const messaging = getMessaging()
    const nowUtc = new Date()

    // Iterate users directly to avoid needing a collectionGroup index.
    let userRefs
    try {
      userRefs = await db.collection('users').listDocuments()
    } catch (e) {
      console.error('[reminders] list users failed', e)
      return res.status(500).json({ error: 'list users failed', detail: String(e) })
    }

    const results: { uid: string; sent: number; total: number; plan?: string }[] = []
    const skipped: { uid: string; reason: string }[] = []

    for (const userRef of userRefs) {
      const uid = userRef.id
      try {
        const settingsSnap = await userRef.collection('settings').doc('main').get()
        if (!settingsSnap.exists) { skipped.push({ uid, reason: 'no-settings' }); continue }
        const prefs = settingsSnap.data() as Prefs
        if (!prefs.reminders?.enabled) { skipped.push({ uid, reason: 'reminders-disabled' }); continue }
        const tz = prefs.timezone || DEFAULT_TZ

        const localIso = formatInTimeZone(nowUtc, tz, 'yyyy-MM-dd')
        const localDayIso = Number(formatInTimeZone(nowUtc, tz, 'i')) // 1..7 (Mon..Sun)
        const jsDay = localDayIso === 7 ? 0 : localDayIso
        const dayKey = DAY_MAP[jsDay]
        const nowH = Number(formatInTimeZone(nowUtc, tz, 'H'))
        const nowM = Number(formatInTimeZone(nowUtc, tz, 'm'))
        const nowMinutes = nowH * 60 + nowM

        const plan = prefs.weeklyPlan?.[dayKey]
        if (!plan) { skipped.push({ uid, reason: 'no-plan' }); continue }

        const [rh, rm] = (prefs.reminders?.time ?? '20:00').split(':').map(Number)
        if (Number.isNaN(rh) || Number.isNaN(rm)) { skipped.push({ uid, reason: 'invalid-time' }); continue }
        const reminderMinutes = rh * 60 + rm
        const diffMinutes = nowMinutes - reminderMinutes
        if (diffMinutes < 0 || diffMinutes > WINDOW_MINUTES) { skipped.push({ uid, reason: 'out-of-window' }); continue }

        if (!force && prefs.lastNotifiedOn === localIso) { skipped.push({ uid, reason: 'already-notified' }); continue }

        const sessSnap = await db.collection(`users/${uid}/sessions`).where('date', '==', localIso).limit(1).get()
        if (!sessSnap.empty) { skipped.push({ uid, reason: 'session-exists' }); continue }

        const toksSnap = await db.collection(`users/${uid}/fcmTokens`).get()
        const tokens = Array.from(new Set(toksSnap.docs.map(t => t.id)))
        if (tokens.length === 0) { skipped.push({ uid, reason: 'no-tokens' }); continue }

        // Atomic claim: only ONE concurrent execution gets to send, others skip.
        if (!force) {
          const claimed = await db.runTransaction(async tx => {
            const snap = await tx.get(settingsSnap.ref)
            const curr = snap.data() as Prefs | undefined
            if (curr?.lastNotifiedOn === localIso) return false
            tx.update(settingsSnap.ref, { lastNotifiedOn: localIso })
            return true
          })
          if (!claimed) { skipped.push({ uid, reason: 'race-lost' }); continue }
        }

        // Data-only payload so the browser does NOT auto-display a notification.
        // Our service worker (firebase-messaging-sw.js) handles the display itself via onBackgroundMessage.
        const message: MulticastMessage = {
          tokens,
          data: {
            title: "Ta séance t'attend",
            body: `${DAY_LABELS[dayKey]} : ${plan}. Il est encore temps.`,
            day: dayKey,
            plan,
          },
          webpush: {
            headers: { Urgency: 'high' },
            fcmOptions: { link: '/' },
          },
        }

        const r = await messaging.sendEachForMulticast(message)

        const invalid: string[] = []
        r.responses.forEach((resp, i) => {
          if (!resp.success) {
            const code = resp.error?.code ?? ''
            if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
              invalid.push(tokens[i])
            }
          }
        })
        if (invalid.length) {
          await Promise.all(invalid.map(t => db.doc(`users/${uid}/fcmTokens/${t}`).delete()))
        }

        results.push({ uid, sent: r.successCount, total: tokens.length, plan: plan ?? undefined })
      } catch (e) {
        console.error(`[reminders] user ${uid} failed`, e)
        skipped.push({ uid, reason: `error: ${String(e)}` })
      }
    }

    return res.status(200).json({
      ok: true,
      at: nowUtc.toISOString(),
      notified: results.length,
      users_processed: userRefs.length,
      results,
      skipped,
    })
  } catch (e) {
    const err = e as Error
    console.error('[reminders] top-level crash', err)
    return res.status(500).json({
      error: 'top-level crash',
      detail: err?.message ?? String(err),
      stack: err?.stack?.split('\n').slice(0, 8).join('\n'),
    })
  }
}
