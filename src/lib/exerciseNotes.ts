import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { trackWrite } from './sync'

/**
 * A lasting note per exercise (machine setting, seat height, cues…), shared by every
 * session where that exercise appears. Stored under users/{uid}/exerciseNotes/{key},
 * key = normalized exercise name. Private: friends can't read it.
 */
export type ExerciseNote = { key: string; name: string; text: string }

function uid() {
  const u = auth.currentUser
  if (!u) throw new Error('not authenticated')
  return u.uid
}
const col = () => collection(db, 'users', uid(), 'exerciseNotes')
const docId = (key: string) => encodeURIComponent(key).slice(0, 700)

export async function listExerciseNotes(): Promise<ExerciseNote[]> {
  const snap = await getDocs(col())
  return snap.docs.map(d => ({
    key: String(d.data().key ?? decodeURIComponent(d.id)),
    name: String(d.data().name ?? ''),
    text: String(d.data().text ?? ''),
  }))
}

/** Save the note, or delete it when the text is empty. */
export async function setExerciseNote(key: string, name: string, text: string) {
  const ref = doc(col(), docId(key))
  const clean = text.trim().slice(0, 1000)
  if (!clean) await trackWrite(deleteDoc(ref))
  else await trackWrite(setDoc(ref, { key, name, text: clean, updatedAt: serverTimestamp() }))
}