import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-12 w-full rounded-[var(--radius-control)] bg-surface-2 px-4 text-[16px] text-ink [-webkit-text-fill-color:var(--color-ink)] placeholder:text-faint placeholder:[-webkit-text-fill-color:var(--color-faint)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1.5px_var(--color-ink)] focus-visible:outline-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'