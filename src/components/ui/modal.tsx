import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '../../lib/cn'

export const Modal = DialogPrimitive.Root
export const ModalTrigger = DialogPrimitive.Trigger
export const ModalClose = DialogPrimitive.Close
export const ModalTitle = DialogPrimitive.Title
export const ModalDescription = DialogPrimitive.Description

/**
 * Bottom sheet on phones (thumb-reachable, swipe-friendly feel), centred card from `sm` up.
 * Always render a <ModalTitle> inside for screen readers.
 */
export const ModalContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { children?: ReactNode }
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
    <DialogPrimitive.Content
      ref={ref}
      aria-describedby={undefined}
      className={cn(
        'dialog-responsive fixed z-50 bg-surface outline-none',
        // phone: bottom sheet
        'inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[20px] px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]',
        // tablet / desktop: centred
        'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-[var(--radius-card)] sm:p-6 sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]',
        className,
      )}
      {...props}
    >
      <div className="sm:hidden mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" aria-hidden />
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
ModalContent.displayName = 'ModalContent'