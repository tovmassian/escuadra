// What the Home language sheet lists and what its chip says (#143). React-free
// like ./resolveLanguage.ts, so Vitest can test it.
import { resolveLanguage, type Language, type LanguagePreference } from './resolveLanguage';

/** Alphabetical by each language's own name: Deutsch, English, Español, Français, Italiano. */
const MENU_ORDER = ['de', 'en', 'es', 'fr', 'it'] as const satisfies readonly Language[];

export interface LanguageRow {
  /** What a tap stores in `languagePreference`. */
  preference: LanguagePreference;
  /** Whose name the row shows: the language itself, or for "Match phone" the
   *  one the phone resolves to. */
  language: Language;
}

/** "Match phone" first, naming the language the phone's own `deviceTags`
 *  resolve to — never the one picked in the app, which is what the app speaks
 *  now — then each supported language. */
export function languageRows(
  supported: readonly Language[],
  deviceTags: readonly string[],
): readonly LanguageRow[] {
  return [
    { preference: 'system', language: resolveLanguage('system', deviceTags, supported) },
    ...MENU_ORDER.filter((language) => supported.includes(language)).map((language) => ({
      preference: language,
      language,
    })),
  ];
}
