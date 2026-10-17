// The hooks every screen reads text through (#141). `useLocales()` re-renders
// when the phone's language changes, so `'system'` follows it without a
// restart. The resolution itself is ./resolveLanguage.ts, kept React-free.
import { useLocales } from 'expo-localization';
import { useProgress } from '@/stores/progress';
import { en, type Messages } from './en';
import { resolveLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from './resolveLanguage';

/** One catalog per supported language: adding a language to
 *  `SUPPORTED_LANGUAGES` without its catalog fails the typecheck. */
const CATALOGS: Record<SupportedLanguage, Messages> = { en };

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
