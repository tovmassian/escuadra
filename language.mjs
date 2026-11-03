// language.mjs: which language the site speaks (#280). Mirrors the app's
// resolveLanguage (i18n/resolveLanguage.ts on main): a language picked here wins,
// then the first of the browser's languages the site has, then English. The English
// pages inline resolveSiteLanguage's own source in their <head>, so it may use
// nothing from outside itself.

export const LANGUAGES = ['en', 'es', 'fr', 'it', 'de'];
export const LANGUAGE_STORAGE_KEY = 'escuadra-site-language';
/** Each language in its own words, as the privacy pages' language-nav names them. */
export const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
};

export function resolveSiteLanguage(saved, deviceTags) {
  const languages = ['en', 'es', 'fr', 'it', 'de'];
  if (languages.includes(saved)) return saved;
  for (const tag of deviceTags) {
    const code = String(tag).split(/[-_]/)[0].toLowerCase();
    if (languages.includes(code)) return code;
  }
  return 'en';
}
