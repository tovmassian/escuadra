// src/layout.mjs: what every generated page shares.

/** Fills {slots}: fill('Missed {n} of 3', { n: 2 }). Task 2 moves this into quiz.mjs. */
export function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (slot, key) => (key in values ? String(values[key]) : slot));
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
