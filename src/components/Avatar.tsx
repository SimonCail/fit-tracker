import { cn } from '../lib/cn'

/** Round profile picture, or the person's initials when there is no photo. */
export function Avatar({
  name,
  photo,
  size = 40,
  className,
}: {
  name: string
  photo?: string | null
  size?: number
  className?: string
}) {
  if (photo) {
    return (
      <img
        src={photo}
        alt=""
        width={size}
        height={size}
        className={cn('shrink-0 rounded-full object-cover bg-surface-2', className)}
        style={{ width: size, height: size }}
      />
    )
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('')
  return (
    <span
      aria-hidden
      className={cn('shrink-0 rounded-full bg-surface-2 text-ink grid place-items-center font-bold', className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || '?'}
    </span>
  )
}