import { doc, Timestamp, writeBatch } from 'firebase/firestore'
import { auth, db } from './firebase'
import { listSessions, listWeighIns } from './db'
import { listExerciseNotes, type ExerciseNote } from './exerciseNotes'
import type { Session, WeighIn } from './types'

/**
 * Backup file format (JSON). Version 1 = the old export (sessions + weighIns);
 * version 2 adds exercise notes. Both can be imported.
 */
export type Backup = {
  version: number
  exportedAt: string
  user: string | null
  sessions: Session[]
  weighIns: WeighIn[]
  exerciseNotes?: ExerciseNote[]
}

export async function buildBackup(): Promise<Backup> {
  const [sessions, weighIns, exerciseNotes] = await Promise.all([listSessions(5000), listWeighIns(5000), listExerciseNotes()])
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    user: auth.currentUser?.email ?? null,
    sessions,
    weighIns,
    exerciseNotes,
  }
}

export async function downloadBackup() {
  const backup = await buildBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fit-tracker-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export class BackupError extends Error {}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const validId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 200 && !v.includes('/')

/** Read a backup file and check it looks right, without writing anything yet. */
export async function parseBackupFile(file: File): Promise<Backup> {
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    throw new BackupError('Ce fichier n’est pas un JSON valide.')
  }
  if (!isObj(raw) || !Array.isArray(raw.sessions)) {
    throw new BackupError('Ce fichier ne ressemble pas à un export de Fit (pas de liste de séances).')
  }
  const sessions = (raw.sessions as unknown[]).filter(
    (s): s is Session => isObj(s) && validId(s.id) && typeof s.date === 'string' && ISO_DATE.test(s.date) && Array.isArray(s.exercises),
  )
  const weighIns = (Array.isArray(raw.weighIns) ? (raw.weighIns as unknown[]) : []).filter(
    (w): w is WeighIn => isObj(w) && validId(w.id) && typeof w.date === 'string' && ISO_DATE.test(w.date) && typeof w.weight === 'number',
  )
  const exerciseNotes = (Array.isArray(raw.exerciseNotes) ? (raw.exerciseNotes as unknown[]) : []).filter(
    (n): n is ExerciseNote => isObj(n) && typeof n.key === 'string' && n.key.length > 0 && typeof n.text === 'string',
  )
  if (sessions.length === 0 && weighIns.length === 0) throw new BackupError('Aucune séance ni pesée exploitable dans ce fichier.')
  return {
    version: typeof raw.version === 'number' ? raw.version : 1,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    user: typeof raw.user === 'string' ? raw.user : null,
    sessions,
    weighIns,
    exerciseNotes,
  }
}

/**
 * Write a backup into the account. Same ids = overwritten (so importing the same file
 * twice doesn't duplicate anything); everything else already in the account is kept.
 */
export async function importBackup(b: Backup, onProgress?: (done: number, total: number) => void) {
  const me = auth.currentUser?.uid
  if (!me) throw new Error('not authenticated')
  const ops: { path: string[]; data: Record<string, unknown> }[] = []

  for (const s of b.sessions) {
    ops.push({
      path: ['users', me, 'sessions', s.id],
      data: {
        date: s.date,
        notes: typeof s.notes === 'string' ? s.notes : null,
        type: s.type === 'running' ? 'running' : 'strength',
        exercises: s.exercises,
        shared: s.shared !== false,
        createdAt: Timestamp.fromMillis(typeof s.createdAt === 'number' ? s.createdAt : Date.parse(s.date)),
        ...(s.type === 'running'
          ? {
              distanceMeters: typeof s.distanceMeters === 'number' ? s.distanceMeters : null,
              durationSeconds: typeof s.durationSeconds === 'number' ? s.durationSeconds : null,
              route: typeof s.route === 'string' ? s.route : null,
            }
          : {}),
      },
    })
  }
  for (const w of b.weighIns) {
    ops.push({
      path: ['users', me, 'weighIns', w.id],
      data: {
        date: w.date,
        weight: w.weight,
        note: typeof w.note === 'string' ? w.note : null,
        slot: w.slot === 'evening' ? 'evening' : 'morning',
        createdAt: Timestamp.fromMillis(typeof w.createdAt === 'number' ? w.createdAt : Date.parse(w.date)),
      },
    })
  }
  for (const n of b.exerciseNotes ?? []) {
    ops.push({
      path: ['users', me, 'exerciseNotes', encodeURIComponent(n.key).slice(0, 700)],
      data: { key: n.key, name: n.name ?? '', text: n.text.slice(0, 1000), updatedAt: Timestamp.now() },
    })
  }

  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db)
    for (const op of ops.slice(i, i + 400)) {
      const [first, ...rest] = op.path
      batch.set(doc(db, first, ...rest), op.data)
    }
    await batch.commit()
    onProgress?.(Math.min(i + 400, ops.length), ops.length)
  }
  return { sessions: b.sessions.length, weighIns: b.weighIns.length, notes: b.exerciseNotes?.length ?? 0 }
}