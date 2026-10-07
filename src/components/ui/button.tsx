import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

const button = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,color,transform,opacity] duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.97] select-none',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-bg hover:opacity-90',
        accent: 'bg-ink text-bg hover:opacity-90',
        secondary: 'bg-surface-2 text-ink hover:bg-line',
        ghost: 'text-dim hover:text-ink hover:bg-surface-2',
        danger: 'bg-danger text-white hover:brightness-110',
        'danger-soft': 'text-danger bg-danger/10 hover:bg-danger/15',
        outline: 'border border-line-strong text-ink hover:bg-surface-2',
      },
      size: {
        sm: 'h-9 px-3.5 text-[13px] rounded-[12px]',
        md: 'h-11 px-4 text-[15px] rounded-[var(--radius-control)]',
        lg: 'h-14 px-6 text-base rounded-[12px]',
        icon: 'h-11 w-11 rounded-full',
        'icon-sm': 'h-9 w-9 rounded-full',
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