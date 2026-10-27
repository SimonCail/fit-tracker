import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { Button, Input, Label, Modal, ModalContent, ModalTitle } from './ui'
import { deleteAccount, reauthenticate, usesPassword, type DeleteStep } from '../lib/deleteAccount'

const STEP_LABEL: Record<DeleteStep, string> = {
  reactions: 'Suppression de tes réactions…',
  friends: 'Retrait de tes amis…',
  data: 'Suppression de tes séances et pesées…',
  profile: 'Suppression de ton profil…',
  account: 'Suppression du compte…',
}
const CONFIRM_WORD = 'SUPPRIMER'

/**
 * Two safeguards before an irreversible delete: type a word, then sign in again
 * (Firebase requires a fresh sign-in to delete a login anyway).
 */
export function DeleteAccountDialog({ open, onOpenChange, user }: { open: boolean; onOpenChange: (v: boolean) => void; user: User }) {
  const [word, setWord] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<DeleteStep | null>(null)
  const [error, setError] = useState<string | null>(null)
  const needsPassword = usesPassword(user)
  const running = step !== null

  useEffect(() => {
    if (open) { setWord(''); setPassword(''); setStep(null); setError(null) }
  }, [open])

  async function onDelete(e: React.FormEvent) {
    e.preventDefault()
    if (word.trim().toUpperCase() !== CONFIRM_WORD || running) return
    setError(null)
    try {
      await reauthenticate(user, password)
    } catch (err) {
      setError(authMessage(err))
      return
    }
    try {
      await deleteAccount(user, setStep)
      // Signed out automatically: the app goes back to the login screen.
    } catch (err) {
      setStep(null)
      setError(
        (err as { code?: string })?.code === 'auth/requires-recent-login'
          ? 'La suppression a pris trop de temps. Relance-la : tes données déjà effacées le restent.'
          : 'Une erreur est survenue en cours de route. Vérifie ta connexion et relance la suppression.',
      )
    }
  }

  return (
    <Modal open={open} onOpenChange={v => { if (!running) onOpenChange(v) }}>
      <ModalContent>
        <ModalTitle className="t-title text-[26px]">Supprimer ton compte</ModalTitle>
        <div className="text-[15px] text-dim mt-2 space-y-2 leading-relaxed">
          <p>Tout sera effacé définitivement :</p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>tes séances, pesées, records et notes ;</li>
            <li>ton profil, ta photo et ton code ami ;</li>
            <li>tes amitiés et les réactions que tu as laissées chez tes amis.</li>
          </ul>
          <p>Pense à <span className="font-semibold text-ink">exporter tes données</span> avant si tu veux les garder.</p>
        </div>

        <form onSubmit={onDelete} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="del-word" className="block mb-1.5">Écris {CONFIRM_WORD} pour confirmer</Label>
            <Input id="del-word" value={word} onChange={e => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" disabled={running} />
          </div>
          {needsPassword && (
            <div>
              <Label htmlFor="del-pass" className="block mb-1.5">Ton mot de passe</Label>
              <Input id="del-pass" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" disabled={running} />
            </div>
          )}
          {!needsPassword && (
            <p className="text-[13px] text-dim">Une fenêtre Google va s’ouvrir pour confirmer que c’est bien toi.</p>
          )}

          {error && <p role="alert" className="rounded-[10px] px-3.5 py-2.5 text-[14px] bg-danger/12 text-danger">{error}</p>}
          {running && <p role="status" className="text-[14px] text-dim">{STEP_LABEL[step]}</p>}

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={running}>Annuler</Button>
            <Button
              type="submit"
              variant="danger"
              disabled={running || word.trim().toUpperCase() !== CONFIRM_WORD || (needsPassword && !password)}
            >
              {running ? 'Suppression…' : 'Supprimer'}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  )
}

function authMessage(e: unknown): string {
  switch ((e as { code?: string })?.code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Mot de passe incorrect.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Confirmation annulée.'
    case 'auth/popup-blocked':
      return 'Le navigateur a bloqué la fenêtre Google. Autorise les pop-ups puis réessaie.'
    case 'auth/user-mismatch':
      return 'Ce n’est pas le même compte Google. Choisis celui avec lequel tu es connecté.'
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Réessaie dans quelques minutes.'
    case 'auth/network-request-failed':
      return 'Pas de connexion. Vérifie ton réseau.'
    default:
      return 'Impossible de confirmer ton identité. Réessaie.'
  }
}