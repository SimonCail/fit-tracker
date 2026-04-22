import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export { Button } from './button'
export { Input } from './input'
export { Card } from './card'
export { Switch } from './switch'
export * from './sheet'
export * from './modal'
export * from './tooltip'
export * from './confirm'
export * from './skeleton'

export function Label({ children, className, htmlFor }: { children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('text-xs uppercase tracking-[0.14em] text-[color:var(--color-text-dim)] font-medium', className)}
    >
      {children}
    </label>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-[color:var(--color-border)] border-t-[color:var(--color-accent)] h-6 w-6',
        className,
      )}
    />
  )
}

export function EmptyState({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="text-center py-12">
      {icon && <div className="flex justify-center mb-4 text-[color:var(--color-text-dim)]">{icon}</div>}
      <p className="font-display text-2xl text-[color:var(--color-text)]">{title}</p>
      {subtitle && <p className="text-sm text-[color:var(--color-text-dim)] mt-2 max-w-xs mx-auto">{subtitle}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  )
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-2)] px-2 py-0.5 text-xs font-medium text-[color:var(--color-text-dim)]',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Divider({ label }: { label?: string }) {
  if (!label)
    return <div className="h-px bg-[color:var(--color-border)]" />
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[color:var(--color-text-dim)] font-medium">
      <div className="flex-1 h-px bg-[color:var(--color-border)]" />
      <span>{label}</span>
      <div className="flex-1 h-px bg-[color:var(--color-border)]" />
    </div>
  )
}
