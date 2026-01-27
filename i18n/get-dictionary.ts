import type { Locale } from './config'

// Define dictionary type based on structure
export type Dictionary = typeof import('./dictionaries/th.json')

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  th: () => import('./dictionaries/th.json').then((m) => m.default),
  en: () => import('./dictionaries/en.json').then((m) => m.default),
}

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]()
}
