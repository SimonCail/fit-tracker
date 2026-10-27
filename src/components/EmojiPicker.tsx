import { lazy, Suspense } from 'react'

/**
 * Full emoji picker (every emoji, categories, search, skin tones), in French.
 * The library is only downloaded the first time it opens (see EmojiPickerInner.tsx),
 * and it uses the phone's own emoji font, so no images are fetched.
 */
const Inner = lazy(() => import('./EmojiPickerInner'))

export function EmojiPicker({ onPick, height = 360 }: { onPick: (emoji: string) => void; height?: number }) {
  return (
    <Suspense
      fallback={<div className="grid place-items-center text-[14px] text-dim" style={{ height }}>Chargement des emojis…</div>}
    >
      <Inner onPick={onPick} height={height} />
    </Suspense>
  )
}