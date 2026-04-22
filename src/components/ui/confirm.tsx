import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { AlertTriangle } from 'lucide-react'
import { Button } from './button'
import { cn } from '../../lib/cn'

type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmCtx = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [open, setOpen] = useState(false)
  const resolverRef = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>(o => {
    return new Promise<boolean>(resolve => {
      setOpts(o)
      setOpen(true)
      resolverRef.current = resolve
    })
  }, [])

  function settle(v: boolean) {
    setOpen(false)
    resolverRef.current?.(v)
    resolverRef.current = null
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <AlertDialogPrimitive.Root open={open} onOpenChange={o => { if (!o) settle(false) }}>
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[6px] data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
          <AlertDialogPrimitive.Content
            className={cn(
              'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-sm',
              'rounded-2xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] shadow-2xl p-6',
              'data-[state=open]:animate-modal-in data-[state=closed]:animate-modal-out',
            )}
          >
            <div className="flex items-start gap-4">
              {opts?.danger && (
                <div className="w-10 h-10 rounded-xl bg-[color:var(--color-danger)]/15 text-[color:var(--color-danger)] flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <AlertDialogPrimitive.Title className="font-display text-lg font-semibold tracking-tight">
                  {opts?.title}
                </AlertDialogPrimitive.Title>
                {opts?.description && (
                  <AlertDialogPrimitive.Description className="text-sm text-[color:var(--color-text-dim)] mt-1.5 leading-relaxed">
                    {opts.description}
                  </AlertDialogPrimitive.Description>
                )}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <AlertDialogPrimitive.Cancel asChild>
                <Button variant="secondary">{opts?.cancelLabel ?? 'Annuler'}</Button>
              </AlertDialogPrimitive.Cancel>
              <AlertDialogPrimitive.Action asChild>
                <Button
                  variant={opts?.danger ? 'danger' : 'accent'}
                  onClick={() => settle(true)}
                  className={opts?.danger ? 'bg-[color:var(--color-danger)] text-white hover:bg-[color:var(--color-danger)]/90' : ''}
                >
                  {opts?.confirmLabel ?? 'Confirmer'}
                </Button>
              </AlertDialogPrimitive.Action>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>
    </ConfirmCtx.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmCtx)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
