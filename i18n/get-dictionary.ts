import { defaultLocale, type Locale } from './config'

// Define dictionary type based on structure
export type Dictionary = typeof import('./dictionaries/th.json')

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  th: () => import('./dictionaries/th.json').then((m) => m.default),
  en: () => import('./dictionaries/en.json').then((m) => m.default),
}

// Accept any string: the [locale] segment matches ANY first path part, so bots/typos hit
// this with invalid locales (e.g. /wp-admin). Falling back to the default locale instead of
// calling `dictionaries[locale]()` on undefined avoids a 500 ("b[a] is not a function") —
// the [locale] layout still returns a proper 404 for unknown locales.
export async function getDictionary(locale: string): Promise<Dictionary> {
  const load = dictionaries[locale as Locale] ?? dictionaries[defaultLocale]
  return load()
}
