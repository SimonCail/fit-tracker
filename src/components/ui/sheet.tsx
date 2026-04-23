import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close

type SheetContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  children?: ReactNode
  side?: 'right' | 'bottom'
}

export const SheetContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  ({ className, children, side = 'right', ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed z-50 flex flex-col bg-[color:var(--color-bg)] shadow-2xl focus-visible:outline-none',
          side === 'right' &&
            'top-0 right-0 bottom-0 w-full sm:max-w-md border-l border-[color:var(--color-border)] data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out',
          side === 'bottom' &&
            'left-0 right-0 bottom-0 max-h-[90dvh] border-t border-[color:var(--color-border)] rounded-t-3xl',
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Close className="absolute top-[calc(env(safe-area-inset-top,0px)+1rem)] right-4 z-10 rounded-full p-2 text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-2)] transition-colors cursor-pointer">
          <X size={20} />
          <span className="sr-only">Fermer</span>
        </DialogPrimitive.Close>
        <DialogPrimitive.Title className="sr-only">Réglages</DialogPrimitive.Title>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
)
SheetContent.displayName = 'SheetContent'

export function SheetHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'px-6 pb-4 border-b border-[color:var(--color-border)] pt-[calc(env(safe-area-inset-top,0px)+2rem)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SheetBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex-1 overflow-y-auto px-6 py-4', className)}>{children}</div>
}
