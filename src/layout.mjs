// src/layout.mjs: what every generated page shares.
import { LANGUAGES, LANGUAGE_NAMES, LANGUAGE_STORAGE_KEY, resolveSiteLanguage } from '../language.mjs';
import { fill } from '../quiz.mjs';

export const SITE_URL = 'https://tovmassian.github.io/escuadra/';
export const APP_STORE_URL = 'https://apps.apple.com/app/escuadra/id6810705505';
export const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.tovmassian.escuadra';

/** Where a language's pages live: English at the root, the others in their folder. */
export const folderOf = (language) => (language === 'en' ? '' : `${language}/`);

/** A link from this page to `file` in `language`: index.html, ../fr/support.html. */
export function pageHref(page, language, file) {
  return language === page.language ? file : `${page.root}${folderOf(language)}${file}`;
}

/** The 2.0 policy in the page's language. privacy/2/ is generated on main. */
export function privacyHref(page) {
  return `${page.root}privacy/2/${page.language === 'en' ? '' : `${page.language}.html`}`;
}

/** The public URL of `file` in `language`: the folder itself for index.html. */
const publicUrl = (language, file) =>
  `${SITE_URL}${folderOf(language)}${file === 'index.html' ? '' : file}`;

/** canonical and hreflang, as the privacy pages declare them. */
export function alternates(page, file) {
  return [
    `    <link rel="canonical" href="${publicUrl(page.language, file)}" />`,
    ...LANGUAGES.map(
      (language) =>
        `    <link rel="alternate" hreflang="${language}" href="${publicUrl(language, file)}" />`,
    ),
    `    <link rel="alternate" hreflang="x-default" href="${publicUrl('en', file)}" />`,
  ].join('\n');
}

/**
 * English pages only, first in <head>: a browser that prefers one of the other
 * languages goes there before anything is painted, unless a language was picked on
 * the site. location.replace leaves no English page in the history to go back to.
 * Crawlers and link previews run no script, so each language keeps its own page.
 */
export function redirectScript(file) {
  const target = file === 'index.html' ? '' : file;
  return `    <script>
      (function () {
        let saved = null;
        try { saved = localStorage.getItem('${LANGUAGE_STORAGE_KEY}'); } catch {}
        const language = (${resolveSiteLanguage.toString()})(saved, navigator.languages || [navigator.language || '']);
        if (language === 'en') return;
        document.documentElement.style.visibility = 'hidden';
        location.replace(language + '/${target}' + location.search + location.hash);
      })();
    </script>`;
}

export function themeToggle(page) {
  const theme = page.text.layout.theme;
  return `<button
          type="button"
          class="theme-toggle"
          data-theme-toggle
          data-label-light="${theme.light}"
          data-label-dark="${theme.dark}"
          data-label-to-light="${theme.toLight}"
          data-label-to-dark="${theme.toDark}"
        >
          <span class="theme-toggle-icon" aria-hidden="true">◐</span
          ><span data-theme-toggle-label></span>
        </button>`;
}

/** The language menu: a native disclosure, so it works without JavaScript. */
export function languageMenu(page, file) {
  const layout = page.text.layout;
  const links = LANGUAGES.map(
    (language) =>
      `<a href="${pageHref(page, language, file)}" hreflang="${language}" lang="${language}" data-language="${language}"${
        language === page.language ? ' aria-current="page"' : ''
      }>${LANGUAGE_NAMES[language]}</a>`,
  ).join('');
  return `<details class="language-menu" data-language-menu>
          <summary aria-label="${fill(layout.languageCurrent, { name: LANGUAGE_NAMES[page.language] })}"><span aria-hidden="true">${page.language.toUpperCase()}</span></summary>
          <nav class="language-nav" aria-label="${layout.language}">${links}</nav>
        </details>`;
}

/**
 * One block element, on one line when it fits in 100 columns and broken over three
 * otherwise, as the pages have always been written. Whitespace around a block's text
 * does not change how it renders.
 */
export function block(indent, open, text, close) {
  const pad = ' '.repeat(indent);
  const line = `${pad}${open}${text}${close}`;
  return line.length <= 100 ? line : `${pad}${open}\n${pad}  ${text}\n${pad}${close}`;
}

/** Sets the theme before the first paint, as every page does. */
export function themeScript() {
  return `    <script>
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
}

/** The teaser's words for site.mjs, so each page carries only its own language. */
export function wordsScript(page) {
  const words = { root: page.root, ...page.text.teaser, countries: page.text.countries };
  const json = JSON.stringify(words).replace(/</g, '\\u003c');
  return `    <script type="application/json" id="site-words">${json}</script>`;
}
