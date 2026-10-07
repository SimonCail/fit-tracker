import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export { Button } from './button'
export { Input } from './input'
export { Card } from './card'
export { Switch } from './switch'
export { Disc, type Plate } from './disc'
export * from './sheet'
export * from './modal'
export * from './tooltip'
export * from './confirm'
export * from './skeleton'

/** Field / section label. Sentence case, quiet — it names things, it doesn't shout. */
export function Label({ children, className, htmlFor }: { children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('text-[13px] font-medium text-dim', className)}>
      {children}
    </label>
  )
}

/** Section heading inside a page. */
export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-end justify-between gap-3 mb-3', className)}>
      <h2 className="t-heading text-[17px]">{children}</h2>
      {action}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Chargement"
      className={cn('animate-spin rounded-full border-2 border-line border-t-lift h-6 w-6', className)}
    />
  )
}

export function EmptyState({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('py-12 px-2', className)}>
      {icon && <div className="mb-4 text-faint">{icon}</div>}
      <p className="t-heading text-[20px]">{title}</p>
      {subtitle && <p className="text-[15px] text-dim mt-1.5 max-w-sm">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 h-7 text-[13px] font-medium text-ink', className)}>
      {children}
    </span>
  )
}

/** Small inline tag (e.g. "Poids du corps"). */
export function Tag({ children, className, tone = 'neutral' }: { children: ReactNode; className?: string; tone?: 'neutral' | 'pr' | 'run' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 h-5 text-[11px] font-semibold shrink-0',
        tone === 'neutral' && 'bg-surface-2 text-dim',
        tone === 'pr' && 'bg-pr/15 text-pr',
        tone === 'run' && 'bg-run/15 text-run',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Segmented control, iOS-style. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div role="radiogroup" className={cn('grid rounded-[14px] bg-surface-2 p-1', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(o => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-[10px] font-semibold transition-colors cursor-pointer',
              size === 'md' ? 'h-10 text-[14px]' : 'h-8 text-[13px]',
              active ? 'bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.18)]' : 'text-dim hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-danger/10 px-4 py-3.5">
      <p className="font-semibold text-danger">Impossible de charger tes données</p>
      <p className="text-[14px] text-dim mt-0.5 break-words">{message}. Vérifie ta connexion puis recharge la page.</p>
    </div>
  )
}