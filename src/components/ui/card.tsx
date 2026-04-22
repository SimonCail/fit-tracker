import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-[color:var(--color-surface)] border border-[color:var(--color-border)] shadow-[var(--shadow-soft)]',
        className,
      )}
      {...props}
    />
  )
}
