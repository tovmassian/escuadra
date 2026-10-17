// The names Escuadra never translates (#141, "Never translated"). Every
// catalog interpolates these rather than spelling them out, so no translation
// can reword them.

/** The product, in running text. */
export const ESCUADRA = 'Escuadra';

/** The wordmark's lowercase lettering: Home, the share picture, the feature graphic. */
export const ESCUADRA_WORDMARK = 'escuadra';

/** A flawless round, in running text: "…, a la escuadra". */
export const A_LA_ESCUADRA = 'a la escuadra';

/** A flawless round as a title, sentence-initial. */
export const A_LA_ESCUADRA_TITLE = 'A la escuadra';

/** Each language in itself, as the language sheet lists them (#143). Data, not
 *  translation: "Deutsch" is "Deutsch" in every catalog. */
export const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
} as const satisfies Record<'en' | 'es' | 'fr' | 'it' | 'de', string>;
