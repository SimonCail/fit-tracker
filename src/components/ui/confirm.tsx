import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
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
          <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
          <AlertDialogPrimitive.Content
            className={cn(
              'dialog-responsive fixed z-50 bg-surface outline-none',
              'inset-x-0 bottom-0 rounded-t-[20px] px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]',
              'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm sm:rounded-[var(--radius-card)] sm:p-6',
            )}
          >
            <AlertDialogPrimitive.Title className="t-heading text-[19px]">
              {opts?.title}
            </AlertDialogPrimitive.Title>
            {opts?.description && (
              <AlertDialogPrimitive.Description className="text-[15px] text-dim mt-2 leading-relaxed">
                {opts.description}
              </AlertDialogPrimitive.Description>
            )}
            <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <AlertDialogPrimitive.Cancel asChild>
                <Button variant="secondary">{opts?.cancelLabel ?? 'Annuler'}</Button>
              </AlertDialogPrimitive.Cancel>
              <AlertDialogPrimitive.Action asChild>
                <Button variant={opts?.danger ? 'danger' : 'primary'} onClick={() => settle(true)}>
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