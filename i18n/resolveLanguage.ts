// Which language the app speaks (#141, "Which language"). Deliberately free of
// React and react-native so it stays unit-testable — Vitest runs in a node
// environment, like theme/resolveTheme.ts. The hook that wraps this is
// ./useT.ts.

export const LANGUAGES = ['en', 'es', 'fr', 'it', 'de'] as const;
export type Language = (typeof LANGUAGES)[number];

/** `'system'` follows the phone, including its per-app language setting. */
export type LanguagePreference = 'system' | Language;

/** The languages with a reviewed catalog. #145 adds each one only after a
 *  native speaker signs it off; `i18n/useT.ts` needs a catalog for each. */
export const SUPPORTED_LANGUAGES = [
  'en',
  'de',
  'fr',
  'es',
  'it',
] as const satisfies readonly Language[];
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** `es-MX`, `de_AT`, `zh-Hans-CN` → `es`, `de`, `zh`. */
function primarySubtag(tag: string): string {
  return (tag.split(/[-_]/)[0] ?? '').toLowerCase();
}

/**
 * A supported language picked in the app wins; otherwise the first supported
 * language in the phone's list (its order is the user's preference order);
 * otherwise English.
 */
export function resolveLanguage<L extends Language>(
  preference: LanguagePreference,
  deviceTags: readonly string[],
  supported: readonly L[],
): L | 'en' {
  if (preference !== 'system') {
    const picked = supported.find((language) => language === preference);
    if (picked) return picked;
  }
  for (const tag of deviceTags) {
    const code = primarySubtag(tag);
    const match = supported.find((language) => language === code);
    if (match) return match;
  }
  return 'en';
}
