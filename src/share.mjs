// src/share.mjs: what a page shows when its link is shared (Instagram DMs and story
// links, WhatsApp, iMessage, X, Facebook, Slack). Link previews run no script and read
// only the Open Graph tags, so every generated page declares them, with a share card
// in its own language: assets/share/<language>.png, drawn by src/share-images.mjs from
// the card below and the site's own stylesheet.
import { createHash } from 'node:crypto';
import { LANGUAGES } from '../language.mjs';
import { SITE_URL, folderOf } from './layout.mjs';

/** Open Graph's recommended size, which every app crops from without losing the copy. */
export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 630;

/** Each language's Open Graph locale. French follows France, as the site's words do. */
export const SHARE_LOCALES = { en: 'en_GB', es: 'es_ES', fr: 'fr_FR', it: 'it_IT', de: 'de_DE' };

export const shareImagePath = (language) => `assets/share/${language}.png`;

/** What assets/share/cards.json records for each card it was drawn from. */
export const cardHash = (html) => createHash('sha256').update(html).digest('hex');

/** A text value as an attribute: one line, no markup. */
export const plain = (html) =>
  html
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');

/** The card's words, read out: what the image says, in the order it says it. */
export const shareAlt = (text) =>
  plain(['Escuadra', text.home.hero.eyebrow, text.home.hero.title, text.layout.releaseStatus].join(' · '));

/** The Open Graph tags of `file` in the page's language, and X's large card. */
export function shareTags(page, file, { title, description }) {
  const url = `${SITE_URL}${folderOf(page.language)}${file === 'index.html' ? '' : file}`;
  const meta = (property, content) => `    <meta property="${property}" content="${content}" />`;
  return [
    meta('og:type', 'website'),
    meta('og:site_name', 'Escuadra'),
    meta('og:title', plain(title)),
    meta('og:description', plain(description)),
    meta('og:url', url),
    meta('og:locale', SHARE_LOCALES[page.language]),
    ...LANGUAGES.filter((language) => language !== page.language).map((language) =>
      meta('og:locale:alternate', SHARE_LOCALES[language]),
    ),
    meta('og:image', `${SITE_URL}${shareImagePath(page.language)}`),
    meta('og:image:type', 'image/png'),
    meta('og:image:width', SHARE_WIDTH),
    meta('og:image:height', SHARE_HEIGHT),
    meta('og:image:alt', shareAlt(page.text)),
    `    <meta name="twitter:card" content="summary_large_image" />`,
  ].join('\n');
}

const wallRow = (from) =>
  Array.from({ length: 23 }, (_, i) => from + i).join(' ');

/**
 * The share card: Home's hero at 1200 × 630, in the dark palette, without the store
 * badges (their artwork is only for the page itself). Paths are relative to the site
 * root; src/share-images.mjs sets the base. Nothing here names a player or shows a
 * photo, a flag or a crest.
 */
export function shareCard(language, text) {
  const hero = text.home.hero;
  return `<!doctype html>
<html lang="${language}" data-theme="dark">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="site.css" />
    <style>
      html, body { width: ${SHARE_WIDTH}px; height: ${SHARE_HEIGHT}px; margin: 0; overflow: hidden; }
      body { position: relative; }
      .wall, .hero-fade { inset: 0; }
      .wall-row { animation: none; font-size: 200px; }
      .card-brand { position: absolute; top: 52px; left: 72px; font-size: 30px; }
      /* assets/mark.svg, inline: Chrome loads no CSS mask from a file:// page. */
      .card-mark { width: 38px; height: 38px; color: var(--mark); }
      .card-copy { position: absolute; left: 72px; bottom: 76px; width: 720px; }
      .card-copy .eyebrow { margin-bottom: 26px; font-size: 18px; }
      .card-copy .corner { width: 18px; height: 18px; }
      .card-copy h1 { max-width: 640px; margin: 0 0 30px; font-size: 84px; }
      .card-status { margin: 0; color: var(--ink-2); font-family: var(--mono); font-weight: 600; font-size: 18px; }
      .card-number { position: absolute; left: 820px; top: 118px; }
    </style>
  </head>
  <body>
    <div class="wall" aria-hidden="true">
      <div class="wall-row"><span>${wallRow(1)}</span></div>
      <div class="wall-row"><span>${wallRow(5)}</span></div>
      <div class="wall-row"><span>${wallRow(16)}</span></div>
      <div class="wall-row"><span>${wallRow(17)}</span></div>
    </div>
    <div class="hero-fade" aria-hidden="true"></div>
    <div class="brand card-brand">
      <svg class="card-mark" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
        <rect x="14" y="10" width="40" height="10" />
        <rect x="44" y="10" width="10" height="40" />
        <circle cx="33.5" cy="31" r="7.5" />
      </svg>
      <span>escuadra</span>
    </div>
    <div class="card-copy">
      <p class="eyebrow"><span class="corner"></span>${hero.eyebrow}</p>
      <h1 class="display">${hero.title}</h1>
      <p class="card-status">${text.layout.releaseStatus}</p>
    </div>
    <div class="hero-number card-number" aria-hidden="true">
      <span class="lit numbers">7</span>
      <svg class="hero-mark" viewBox="0 0 64 64">
        <g fill="currentColor">
          <rect x="14" y="10" width="40" height="10" />
          <rect x="44" y="10" width="10" height="40" />
        </g>
        <circle cx="35" cy="31" r="9" fill="currentColor" />
        <rect x="16" y="44" width="7" height="7" fill="currentColor" opacity="0.55" />
        <rect x="5" y="53" width="5" height="5" fill="currentColor" opacity="0.3" />
      </svg>
    </div>
  </body>
</html>
`;
}
