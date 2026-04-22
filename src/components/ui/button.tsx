import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

const button = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.97] select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-[color:var(--color-text)] text-[color:var(--color-bg)] hover:bg-[color:var(--color-accent)] hover:text-[color:var(--color-accent-text)]',
        accent:
          'bg-[color:var(--color-accent)] text-[color:var(--color-accent-text)] hover:bg-[color:var(--color-accent-hover)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-accent)_40%,transparent),0_8px_24px_-8px_color-mix(in_srgb,var(--color-accent)_30%,transparent)]',
        secondary:
          'bg-[color:var(--color-surface)] text-[color:var(--color-text)] border border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]',
        ghost:
          'text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-2)]',
        danger:
          'bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger)]/20',
        outline:
          'border border-[color:var(--color-border-strong)] text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-2)]',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & { asChild?: boolean }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp ref={ref} className={cn(button({ variant, size, className }))} {...props} />
  },
)
Button.displayName = 'Button'
