// The web privacy pages (#146): About's Privacy section, word for word, in
// every language, for gh-pages (CLAUDE.md guardrail 4). Written by
// `PRIVACY_PAGES=<dir> PRIVACY_UPDATED=YYYY-MM-DD npx vitest run
// scripts/privacy-pages.test.ts` — a Vitest run, because Node alone cannot
// load the catalogs' extensionless imports.
import { CATALOGS } from '@/i18n/catalogs';
import type { CalendarDate } from '@/i18n/en';
import { ESCUADRA, ESCUADRA_WORDMARK, LANGUAGE_NAMES } from '@/i18n/names';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n/resolveLanguage';
import { translationNotice } from '@/i18n/translationNotice';
import { SHARE_URL } from '@/lib/shareResult';

export const SITE_URL = SHARE_URL;

export const PAGE_FILES: Readonly<Record<SupportedLanguage, string>> = {
  en: 'privacy.html',
  es: 'privacy.es.html',
  fr: 'privacy.fr.html',
  it: 'privacy.it.html',
  de: 'privacy.de.html',
};

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const THEME_SCRIPT = `    <script>
      try {
        const saved = localStorage.getItem('escuadra-site-theme');
        const theme =
          saved === 'light' || saved === 'dark'
            ? saved
            : matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light';
        document.documentElement.dataset.theme = theme;
      } catch {
        document.documentElement.dataset.theme = matchMedia(
          '(prefers-color-scheme: dark)',
        ).matches
          ? 'dark'
          : 'light';
      }
      document.documentElement.dataset.js = 'true';
    </script>`;

export function privacyPage(language: SupportedLanguage, updated: CalendarDate): string {
  const t = CATALOGS[language];
  const { privacy, site } = t.about;
  const e = escapeHtml;
  const notice = translationNotice(language);
  const p = (text: string) => `      <p>${e(text)}</p>`;

  const alternates = [
    ...SUPPORTED_LANGUAGES.map(
      (other) =>
        `    <link rel="alternate" hreflang="${other}" href="${SITE_URL}${PAGE_FILES[other]}" />`,
    ),
    `    <link rel="alternate" hreflang="x-default" href="${SITE_URL}${PAGE_FILES.en}" />`,
  ];
  const languageLinks = SUPPORTED_LANGUAGES.map((other) => {
    const current = other === language ? ' aria-current="page"' : '';
    return `<a href="${PAGE_FILES[other]}" hreflang="${other}" lang="${other}"${current}>${e(LANGUAGE_NAMES[other])}</a>`;
  }).join('');

  return [
    '<!doctype html>',
    `<html lang="${language}">`,
    '  <head>',
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '    <link rel="icon" type="image/x-icon" href="assets/favicon.ico" />',
    `    <title>${e(site.title)} — ${ESCUADRA}</title>`,
    `    <link rel="canonical" href="${SITE_URL}${PAGE_FILES[language]}" />`,
    ...alternates,
    THEME_SCRIPT,
    '    <link rel="stylesheet" href="site.css" />',
    '    <script type="module" src="site.mjs"></script>',
    '  </head>',
    '  <body>',
    '    <header class="site-header shell">',
    `      <a class="brand" href="index.html" aria-label="${e(site.home)}">`,
    '        <span class="brand-mark" aria-hidden="true">',
    '          <img src="assets/favicon.ico" alt="" />',
    '        </span>',
    `        <span>${ESCUADRA_WORDMARK}</span>`,
    '      </a>',
    `      <nav aria-label="${e(site.nav.utility)}">`,
    `        <a href="${PAGE_FILES[language]}">${e(privacy.heading)}</a><a href="support.html">${e(site.nav.support)}</a>`,
    '      </nav>',
    '      <button',
    '        type="button"',
    '        class="theme-toggle"',
    '        data-theme-toggle',
    `        data-label-light="${e(site.theme.light)}"`,
    `        data-label-dark="${e(site.theme.dark)}"`,
    `        data-label-to-light="${e(site.theme.toLight)}"`,
    `        data-label-to-dark="${e(site.theme.toDark)}"`,
    '        aria-pressed="false"',
    '      >',
    '        <span class="theme-toggle-icon" aria-hidden="true">◐</span',
    '        ><span data-theme-toggle-label></span>',
    '      </button>',
    '    </header>',
    '    <main class="legal-page shell">',
    `      <nav class="language-nav" aria-label="${e(site.languages)}">${languageLinks}</nav>`,
    `      <h1>${e(site.title)}</h1>`,
    `      <p class="updated">${e(site.updated(t.formats.date(updated)))}</p>`,
    '',
    `      <p><strong>${e(privacy.lead)}</strong></p>`,
    ...privacy.paragraphs.map(p),
    ...privacy.sections.flatMap((section) => [
      '',
      `      <h2>${e(section.heading)}</h2>`,
      ...section.paragraphs.map(p),
    ]),
    ...(notice ? ['', `      <p><em>${e(notice)}</em></p>`] : []),
    '    </main>',
    '    <footer class="site-footer shell">',
    `      <span>&copy; ${ESCUADRA}</span>`,
    `      <nav aria-label="${e(site.nav.footer)}">`,
    `        <a href="index.html">${e(site.nav.home)}</a><a href="support.html">${e(site.nav.support)}</a>`,
    '      </nav>',
    `      <span class="release-status">${e(site.releaseStatus)}</span>`,
    '    </footer>',
    '  </body>',
    '</html>',
    '',
  ].join('\n');
}
