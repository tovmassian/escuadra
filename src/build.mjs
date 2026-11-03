// src/build.mjs: Home and Support in every language, from one template and one text
// file per language (#280). `node src/build.mjs`, from the site's root, writes them;
// tests/build.test.mjs fails when a page on disk differs from what this renders.
// Dependency-free, like the rest of the site.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { home } from './home.mjs';
import { support } from './support.mjs';
import en from './text/en.mjs';

export const TEXTS = { en };

/** Where a language's pages live: English at the root, the others in their folder. */
export const folderOf = (language) => (language === 'en' ? '' : `${language}/`);

export function renderSite() {
  const pages = new Map();
  for (const [language, text] of Object.entries(TEXTS)) {
    const page = { language, text, root: language === 'en' ? '' : '../' };
    pages.set(`${folderOf(language)}index.html`, home(page));
    pages.set(`${folderOf(language)}support.html`, support(page));
  }
  return pages;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [path, html] of renderSite()) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, html);
  }
}
