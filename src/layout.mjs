// src/layout.mjs: what every generated page shares.

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
