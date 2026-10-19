// The web privacy pages (#146): About's Privacy section, word for word, in
// every language, for gh-pages (CLAUDE.md guardrail 4). The policy is
// versioned: these are POLICY_VERSION's pages, in POLICY_DIR, and every link
// out of that folder climbs back to the site root. privacy.html stays the 1.x
// policy, and a published folder is never edited once its version ships, bar
// the one regeneration described at POLICY_DIR.
// Written into <dir>/privacy/2/ by `PRIVACY_PAGES=<dir>
// PRIVACY_UPDATED=YYYY-MM-DD npx vitest run scripts/privacy-pages.test.ts` —
// a Vitest run, because Node alone cannot load the catalogs' extensionless
// imports.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CATALOGS } from '@/i18n/catalogs';
import type { CalendarDate } from '@/i18n/en';
import { ESCUADRA, ESCUADRA_WORDMARK, LANGUAGE_NAMES } from '@/i18n/names';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n/resolveLanguage';
import { translationNotice } from '@/i18n/translationNotice';
import { SHARE_URL } from '@/lib/shareResult';

export const SITE_URL = SHARE_URL;

// The version these pages state, and their folder. A version that changes
// what leaves the device gets a new folder, and a published folder is never
// edited after its version ships: a store listing may still link it. The one
// exception comes when a later version gets its own folder. Then this folder's
// applies line gains an upper bound (say "2.0 to 2.x"), and the new folder's
// earlier-versions link points at this one instead of privacy.html. That
// single regeneration is the only edit a published folder ever gets.
export const POLICY_VERSION = '2.0';
export const POLICY_DIR = 'privacy/2/';

/**
 * From POLICY_DIR back to the site root, where the site's own files are: one
 * `../` per folder, so the two cannot drift apart.
 */
const ROOT = '../'.repeat(POLICY_DIR.split('/').filter(Boolean).length);

/** Each language's file in POLICY_DIR. English is the folder's index. */
export const PAGE_FILES: Readonly<Record<SupportedLanguage, string>> = {
  en: 'index.html',
  es: 'es.html',
  fr: 'fr.html',
  it: 'it.html',
  de: 'de.html',
};

/** A page's public URL: the folder itself for English. */
export function pageUrl(language: SupportedLanguage): string {
  return `${SITE_URL}${POLICY_DIR}${language === 'en' ? '' : PAGE_FILES[language]}`;
}

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
      (other) => `    <link rel="alternate" hreflang="${other}" href="${pageUrl(other)}" />`,
    ),
    `    <link rel="alternate" hreflang="x-default" href="${pageUrl('en')}" />`,
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
    `    <link rel="icon" type="image/x-icon" href="${ROOT}assets/favicon.ico" />`,
    `    <title>${e(site.title)} — ${ESCUADRA}</title>`,
    `    <link rel="canonical" href="${pageUrl(language)}" />`,
    ...alternates,
    THEME_SCRIPT,
    `    <link rel="stylesheet" href="${ROOT}site.css" />`,
    `    <script type="module" src="${ROOT}site.mjs"></script>`,
    '  </head>',
    '  <body>',
    '    <header class="site-header shell">',
    `      <a class="brand" href="${ROOT}index.html" aria-label="${e(site.home)}">`,
    '        <span class="brand-mark" aria-hidden="true">',
    `          <img src="${ROOT}assets/favicon.ico" alt="" />`,
    '        </span>',
    `        <span>${ESCUADRA_WORDMARK}</span>`,
    '      </a>',
    `      <nav aria-label="${e(site.nav.utility)}">`,
    `        <a href="${PAGE_FILES[language]}">${e(privacy.heading)}</a><a href="${ROOT}support.html">${e(site.nav.support)}</a>`,
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
    `      <p class="applies">${e(site.appliesTo(POLICY_VERSION))} <a href="${ROOT}privacy.html" hreflang="en">${e(site.earlierVersions)}</a></p>`,
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
    `        <a href="${ROOT}index.html">${e(site.nav.home)}</a><a href="${ROOT}support.html">${e(site.nav.support)}</a>`,
    '      </nav>',
    `      <span class="release-status">${e(site.releaseStatus)}</span>`,
    '    </footer>',
    '  </body>',
    '</html>',
    '',
  ].join('\n');
}

/**
 * Reads the writer's PRIVACY_UPDATED, "YYYY-MM-DD", into a date, or null when
 * the text is not a date that exists: 2026-02-31 would otherwise print as a
 * day the pages never went live.
 */
export function parseUpdated(text: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  // A UTC Date rolls an impossible day over into the next month, so a real
  // date is exactly one that comes back unchanged.
  const check = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const real =
    check.getUTCFullYear() === date.year &&
    check.getUTCMonth() === date.month - 1 &&
    check.getUTCDate() === date.day;
  return real ? date : null;
}

/** Writes every language's page to <dir>/privacy/2/, creating the folders. */
export function writePrivacyPages(dir: string, updated: CalendarDate): void {
  const folder = path.join(dir, POLICY_DIR);
  mkdirSync(folder, { recursive: true });
  for (const language of SUPPORTED_LANGUAGES) {
    writeFileSync(path.join(folder, PAGE_FILES[language]), privacyPage(language, updated));
  }
}
