// The line that ends each translated privacy text (#141, "Translation"): the
// English text governs. Shown at the end of About's Privacy section and of
// that language's privacy page, so the two match word for word. English has
// none. Kept out of the catalogs, which must have English's shape.
import type { SupportedLanguage } from './resolveLanguage';

/** The sentence each notice translates, for the review sheet. Never shown: English has no notice. */
export const NOTICE_SOURCE =
  'This is a translation. If it differs from the English text, the English text applies.';

const NOTICES: Readonly<Record<Exclude<SupportedLanguage, 'en'>, string>> = {
  de: 'Dies ist eine Übersetzung. Weicht sie vom englischen Text ab, gilt der englische Text.',
  fr: 'Ceci est une traduction. En cas de divergence avec le texte anglais, c’est le texte anglais qui fait foi.',
  es: 'Esta es una traducción. Si difiere del texto en inglés, prevalece el texto en inglés.',
  it: 'Questa è una traduzione. In caso di differenze rispetto al testo inglese, prevale il testo inglese.',
};

export function translationNotice(language: SupportedLanguage): string | null {
  return language === 'en' ? null : NOTICES[language];
}
