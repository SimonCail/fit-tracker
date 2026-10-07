import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close
export const SheetTitle = DialogPrimitive.Title

type SheetContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  children?: ReactNode
  side?: 'right' | 'bottom'
  /** Accessible title, used when no visible <SheetTitle> is rendered. */
  label?: string
}

export const SheetContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  ({ className, children, side = 'right', label, ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
      <DialogPrimitive.Content
        ref={ref}
        aria-describedby={undefined}
        className={cn(
          'fixed z-50 flex flex-col bg-bg outline-none',
          side === 'right' &&
            'top-0 right-0 bottom-0 w-full sm:max-w-md sm:border-l sm:border-line data-[state=open]:animate-sheet-in-right data-[state=closed]:animate-sheet-out-right',
          side === 'bottom' &&
            'left-0 right-0 bottom-0 max-h-[90dvh] rounded-t-[20px] bg-surface sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-full sm:max-w-lg data-[state=open]:animate-sheet-in-up data-[state=closed]:animate-sheet-out-down',
          className,
        )}
        {...props}
      >
        {side === 'bottom' && (
          <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-line-strong" aria-hidden />
        )}
        <DialogPrimitive.Close
          className={cn(
            'absolute right-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-dim hover:text-ink transition-colors cursor-pointer',
            side === 'right' ? 'top-[calc(env(safe-area-inset-top,0px)+0.75rem)]' : 'top-4',
          )}
        >
          <X size={18} />
          <span className="sr-only">Fermer</span>
        </DialogPrimitive.Close>
        {label && <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
)
SheetContent.displayName = 'SheetContent'

export function SheetHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-5 pb-3 pr-16 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)]', className)}>
      {children}
    </div>
  )
}

export function SheetBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]', className)}>{children}</div>
}