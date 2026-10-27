import type { CSSProperties } from 'react'
import Picker, { Categories, EmojiStyle, Theme } from 'emoji-picker-react'

/**
 * The actual picker. Imported lazily by EmojiPicker.tsx so the library (and its French
 * emoji names) are only downloaded the first time someone opens it.
 */

const LABELS = {
  searchPlaceholder: 'Rechercher un emoji',
  searchLabel: 'Rechercher un emoji',
  searchClear: 'Effacer',
  searchResultsNone: 'Aucun emoji trouvé',
  searchResultsOne: '1 résultat',
  searchResultsMany: '%n résultats',
  categoryNavigation: 'Catégories',
  reactions: 'Réactions',
  expandReactions: 'Plus d’emojis',
  loading: 'Chargement…',
  loadingError: 'Impossible de charger les emojis',
  retryLoading: 'Réessayer',
  skinToneNeutral: 'Teint neutre',
  skinToneLight: 'Teint clair',
  skinToneMediumLight: 'Teint moyennement clair',
  skinToneMedium: 'Teint moyen',
  skinToneMediumDark: 'Teint moyennement foncé',
  skinToneDark: 'Teint foncé',
}

const CATEGORIES = [
  { category: Categories.SUGGESTED, name: 'Récents' },
  { category: Categories.SMILEYS_PEOPLE, name: 'Smileys et personnes' },
  { category: Categories.ANIMALS_NATURE, name: 'Animaux et nature' },
  { category: Categories.FOOD_DRINK, name: 'Nourriture et boissons' },
  { category: Categories.TRAVEL_PLACES, name: 'Voyages et lieux' },
  { category: Categories.ACTIVITIES, name: 'Activités' },
  { category: Categories.OBJECTS, name: 'Objets' },
  { category: Categories.SYMBOLS, name: 'Symboles' },
  { category: Categories.FLAGS, name: 'Drapeaux' },
]

/** Match the app's theme colours (the picker has a light and a dark set of variables). */
const THEME_VARS = Object.fromEntries(
  ['', 'dark-'].flatMap(p => [
    [`--epr-${p}bg-color`, 'var(--color-surface)'],
    [`--epr-${p}category-label-bg-color`, 'color-mix(in srgb, var(--color-surface) 92%, transparent)'],
    [`--epr-${p}text-color`, 'var(--color-ink)'],
    [`--epr-${p}hover-bg-color`, 'var(--color-surface-2)'],
    [`--epr-${p}hover-bg-color-reduced-opacity`, 'var(--color-surface-2)'],
    [`--epr-${p}focus-bg-color`, 'var(--color-surface-2)'],
    [`--epr-${p}highlight-color`, 'var(--color-accent)'],
    [`--epr-${p}search-input-bg-color`, 'var(--color-surface-2)'],
    [`--epr-${p}search-input-bg-color-active`, 'var(--color-surface-2)'],
    [`--epr-${p}picker-border-color`, 'transparent'],
    [`--epr-${p}category-icon-active-color`, 'var(--color-accent)'],
    [`--epr-${p}category-icon-inactive-color`, 'var(--color-faint)'],
    [`--epr-${p}skin-tone-picker-menu-color`, 'var(--color-surface-2)'],
  ]),
)

export default function EmojiPickerInner({ onPick, height }: { onPick: (emoji: string) => void; height: number }) {
  const dark = document.documentElement.classList.contains('dark')
  return (
    <Picker
      onEmojiClick={data => onPick(data.emoji)}
      theme={dark ? Theme.DARK : Theme.LIGHT}
      emojiStyle={EmojiStyle.NATIVE}
      width="100%"
      height={height}
      lazyLoadEmojis
      previewConfig={{ showPreview: false }}
      emojiData={() => import('emoji-picker-react/data/emojis-fr')}
      labels={LABELS}
      categories={CATEGORIES}
      style={{ ...THEME_VARS, '--epr-picker-border-radius': '12px', border: 'none' } as CSSProperties}
    />
  )
}