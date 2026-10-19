// The hooks every screen reads text through (#141). `useLocales()` re-renders
// when the phone's language changes, so `'system'` follows it without a
// restart. The resolution itself is ./resolveLanguage.ts, kept React-free.
import { getLocales, useLocales } from 'expo-localization';
import { useProgress } from '@/stores/progress';
import { CATALOGS } from './catalogs';
import type { Messages } from './en';
import {
  languageSource,
  resolveLanguage,
  SUPPORTED_LANGUAGES,
  type LanguageSource,
  type SupportedLanguage,
} from './resolveLanguage';

/** The language the app speaks now. */
export function useLanguage(): SupportedLanguage {
  const preference = useProgress((s) => s.languagePreference);
  const locales = useLocales();
  return resolveLanguage(
    preference,
    locales.map((locale) => locale.languageTag),
    SUPPORTED_LANGUAGES,
  );
}

/** The active catalog: `const t = useT();` then `t.round.whoWears(7)`. */
export function useT(): Messages {
  return CATALOGS[useLanguage()];
}

/** The language in use and where it came from, read outside React for the
 *  launch signal. Same resolution as `useLanguage()`. */
export function launchLanguage(): {
  language: SupportedLanguage;
  languageSource: LanguageSource;
} {
  const preference = useProgress.getState().languagePreference;
  const language = resolveLanguage(
    preference,
    getLocales().map((locale) => locale.languageTag),
    SUPPORTED_LANGUAGES,
  );
  return { language, languageSource: languageSource(preference, language) };
}
