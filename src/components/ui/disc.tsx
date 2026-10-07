import { cn } from '../../lib/cn'

export type Plate = 'lift' | 'pr' | 'weigh' | 'run'

const plateVar: Record<Plate, string> = {
  lift: 'var(--color-lift)',
  pr: 'var(--color-pr)',
  weigh: 'var(--color-weigh)',
  run: 'var(--color-run)',
}

/**
 * A weight plate seen face-on: coloured disc, inner rim, centre hole.
 * Used as the marker for "something was done" — a training day, a record, a weigh-in.
 * `empty` draws only the outline (nothing logged yet).
 */
export function Disc({
  plate = 'lift',
  size = 16,
  empty,
  className,
  title,
}: {
  plate?: Plate
  size?: number
  empty?: boolean
  className?: string
  title?: string
}) {
  const c = plateVar[plate]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn('shrink-0', className)}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {empty ? (
        <>
          <circle cx="12" cy="12" r="10.5" fill="none" stroke="var(--color-line-strong)" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="2.2" fill="var(--color-line-strong)" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="11.25" fill={c} />
          <circle cx="12" cy="12" r="7.4" fill="none" stroke="#000" strokeOpacity="0.22" strokeWidth="1.1" />
          <circle cx="12" cy="12" r="2.4" fill="var(--color-bg)" />
        </>
      )}
    </svg>
  )
}