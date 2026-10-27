import type { VercelRequest, VercelResponse } from '@vercel/node'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging'

/**
 * POST /api/notify   Authorization: Bearer <Firebase ID token of the caller>
 *   { type: 'friend-request', to }           → "X veut t'ajouter"
 *   { type: 'reaction', to, sessionId }      → "X a réagi 🔥 à ta séance"
 *
 * The server checks that the thing really happened (the request / reaction document exists
 * and comes from the caller), notifies only once for it, and only if `to` turned that kind
 * of notification on (users/{to}/settings/main → notify.friendRequests / notify.reactions).
 */

function initAdmin() {
  if (getApps().length) return
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT env var missing')
  initializeApp({ credential: cert(JSON.parse(sa)) })
}

const UID = /^[A-Za-z0-9]{10,128}$/
const DOC_ID = /^[A-Za-z0-9_-]{1,128}$/

type Push = { title: string; body: string; tag: string; link: string }

async function sendTo(db: Firestore, to: string, push: Push) {
  const toks = await db.collection(`users/${to}/fcmTokens`).get()
  const tokens = toks.docs.map(t => t.id)
  if (tokens.length === 0) return { sent: 0, reason: 'no-tokens' }
  // Data-only payload: firebase-messaging-sw.js displays it.
  const message: MulticastMessage = {
    tokens,
    data: { ...push },
    webpush: { headers: { Urgency: 'high' }, fcmOptions: { link: push.link } },
  }
  const r = await getMessaging().sendEachForMulticast(message)
  const invalid = r.responses
    .map((resp, i) => (!resp.success && ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(resp.error?.code ?? '') ? tokens[i] : null))
    .filter((t): t is string => t !== null)
  await Promise.all(invalid.map(t => db.doc(`users/${to}/fcmTokens/${t}`).delete()))
  return { sent: r.successCount }
}

async function optedIn(db: Firestore, to: string, kind: 'friendRequests' | 'reactions') {
  const settings = await db.doc(`users/${to}/settings/main`).get()
  return settings.get(`notify.${kind}`) === true
}

/** "samedi 24 octobre" from "2026-10-24". */
function frDate(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })
  try {
    initAdmin()
    const header = req.headers.authorization ?? ''
    const idToken = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!idToken) return res.status(401).json({ error: 'missing token' })
    const caller = await getAuth().verifyIdToken(idToken).catch(() => null)
    if (!caller) return res.status(401).json({ error: 'invalid token' })

    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Record<string, unknown> | undefined
    const to = typeof body?.to === 'string' ? body.to : ''
    if (!UID.test(to) || to === caller.uid) return res.status(400).json({ error: 'bad request' })
    const from = caller.uid
    const db = getFirestore()

    if (body?.type === 'friend-request') {
      // The request must exist, and we notify only once for it.
      const reqRef = db.doc(`friendRequests/${from}_${to}`)
      const fresh = await db.runTransaction(async tx => {
        const snap = await tx.get(reqRef)
        if (!snap.exists || snap.get('notifiedAt')) return null
        tx.update(reqRef, { notifiedAt: FieldValue.serverTimestamp() })
        return snap.data() as { fromName?: string }
      })
      if (!fresh) return res.status(200).json({ ok: true, sent: 0, reason: 'no-request-or-already-notified' })
      if (!(await optedIn(db, to, 'friendRequests'))) return res.status(200).json({ ok: true, sent: 0, reason: 'opted-out' })
      const name = (fresh.fromName || 'Quelqu’un').slice(0, 40)
      const r = await sendTo(db, to, {
        title: 'Nouvelle demande d’ami',
        body: `${name} veut t’ajouter sur Fit.`,
        tag: `friend-request-${from}`,
        link: '/friends',
      })
      return res.status(200).json({ ok: true, ...r })
    }

    if (body?.type === 'reaction') {
      const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
      if (!DOC_ID.test(sessionId)) return res.status(400).json({ error: 'bad request' })
      const reaction = await db.doc(`users/${to}/sessions/${sessionId}/reactions/${from}`).get()
      if (!reaction.exists) return res.status(200).json({ ok: true, sent: 0, reason: 'no-reaction' })
      if (!(await optedIn(db, to, 'reactions'))) return res.status(200).json({ ok: true, sent: 0, reason: 'opted-out' })

      // Once per friend per session: changing your emoji afterwards doesn't notify again.
      const logRef = db.doc(`users/${to}/notifyLog/reaction_${sessionId}_${from}`)
      try {
        await logRef.create({ at: FieldValue.serverTimestamp() })
      } catch {
        return res.status(200).json({ ok: true, sent: 0, reason: 'already-notified' })
      }

      const session = await db.doc(`users/${to}/sessions/${sessionId}`).get()
      const date = frDate(String(session.get('date') ?? ''))
      const what = session.get('type') === 'running' ? 'ta sortie' : 'ta séance'
      const name = String(reaction.get('name') ?? 'Un ami').split(/\s+/)[0].slice(0, 40)
      const emoji = String(reaction.get('emoji') ?? '').slice(0, 32)
      const r = await sendTo(db, to, {
        title: `${name} a réagi ${emoji}`.trim(),
        body: date ? `À ${what} du ${date}.` : `À ${what}.`,
        tag: `reaction-${sessionId}-${from}`,
        link: `/session/${sessionId}`,
      })
      return res.status(200).json({ ok: true, ...r })
    }

    return res.status(400).json({ error: 'unknown type' })
  } catch (e) {
    console.error('[notify] failed', e)
    return res.status(500).json({ error: 'notify failed' })
  }
}