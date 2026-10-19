import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOGS } from '@/i18n/catalogs';
import { SUPPORTED_LANGUAGES } from '@/i18n/resolveLanguage';
import { translationNotice } from '@/i18n/translationNotice';
import {
  escapeHtml,
  PAGE_FILES,
  pageUrl,
  POLICY_DIR,
  parseUpdated,
  POLICY_VERSION,
  privacyPage,
  SITE_URL,
  writePrivacyPages,
} from './privacy-pages';

const updated = { day: 21, month: 10, year: 2026 };

describe('the policy folder', () => {
  it('holds 2.0 in privacy/2/, English as the folder itself', () => {
    expect(POLICY_VERSION).toBe('2.0');
    expect(POLICY_DIR).toBe('privacy/2/');
    expect(PAGE_FILES).toEqual({
      en: 'index.html',
      es: 'es.html',
      fr: 'fr.html',
      it: 'it.html',
      de: 'de.html',
    });
    expect(pageUrl('en')).toBe(`${SITE_URL}privacy/2/`);
    expect(pageUrl('fr')).toBe(`${SITE_URL}privacy/2/fr.html`);
  });
});

describe.each(SUPPORTED_LANGUAGES)('the %s privacy page', (language) => {
  const html = privacyPage(language, updated);
  const paragraphs = [...html.matchAll(/<p>(.*?)<\/p>/gs)].map(([, inner]) => inner);

  it("reproduces its catalog's privacy paragraphs exactly, and nothing else", () => {
    const { privacy } = CATALOGS[language].about;
    const notice = translationNotice(language);
    expect(paragraphs).toEqual([
      `<strong>${escapeHtml(privacy.lead)}</strong>`,
      ...privacy.paragraphs.map(escapeHtml),
      ...privacy.sections.flatMap((section) => section.paragraphs.map(escapeHtml)),
      ...(notice ? [`<em>${escapeHtml(notice)}</em>`] : []),
    ]);
  });

  it('heads each section with its catalog heading', () => {
    const headings = [...html.matchAll(/<h2>(.*?)<\/h2>/g)].map(([, inner]) => inner);
    expect(headings).toEqual(
      CATALOGS[language].about.privacy.sections.map((section) => escapeHtml(section.heading)),
    );
  });

  it('declares its language, its canonical URL and its alternates', () => {
    expect(html).toContain(`<html lang="${language}">`);
    expect(html).toContain(`<link rel="canonical" href="${pageUrl(language)}" />`);
    for (const other of SUPPORTED_LANGUAGES) {
      expect(html).toContain(
        `<link rel="alternate" hreflang="${other}" href="${pageUrl(other)}" />`,
      );
    }
    expect(html).toContain(`<link rel="alternate" hreflang="x-default" href="${pageUrl('en')}" />`);
  });

  it('says under its date which versions it covers, and links the earlier policy', () => {
    const { site } = CATALOGS[language].about;
    const lines = html.split('\n').map((line) => line.trim());
    const at = lines.findIndex((line) => line.startsWith('<p class="updated">'));
    expect(at).toBeGreaterThan(-1);
    expect(lines[at + 1]).toBe(
      `<p class="applies">${escapeHtml(site.appliesTo(POLICY_VERSION))} <a href="../../privacy.html" hreflang="en">${escapeHtml(site.earlierVersions)}</a></p>`,
    );
  });

  // The page sits two folders down, so its home links must climb back to the
  // site root. A bare `index.html` would resolve inside the policy folder,
  // to the English privacy page, and the relative-link test below accepts it.
  it('links the brand and the footer home to the site root', () => {
    expect(html).toContain('<a class="brand" href="../../index.html"');
    expect(html).toContain('<a href="../../index.html">');
  });

  // The page sits two folders down: a link to the site's own files that
  // forgot to climb back would load nothing.
  it('reaches outside its folder only from the site root', () => {
    const local = [...html.matchAll(/\s(?:href|src)="([^"]*)"/g)]
      .map(([, url]) => url ?? '')
      .filter((url) => !/^[a-z][a-z+.-]*:/i.test(url));
    const siblings: readonly string[] = Object.values(PAGE_FILES);
    expect(local).not.toEqual([]);
    expect(local.filter((url) => !url.startsWith('../../') && !siblings.includes(url))).toEqual([]);
  });

  it('names its landmarks in its own language', () => {
    const { site } = CATALOGS[language].about;
    expect(html).toContain(`<nav aria-label="${escapeHtml(site.nav.utility)}">`);
    expect(html).toContain(`<nav aria-label="${escapeHtml(site.nav.footer)}">`);
  });

  it('links every language, marking its own', () => {
    for (const other of SUPPORTED_LANGUAGES) {
      expect(html).toContain(`href="${PAGE_FILES[other]}" hreflang="${other}" lang="${other}"`);
    }
    expect(html).toMatch(new RegExp(`href="${PAGE_FILES[language]}"[^>]*aria-current="page"`));
  });
});

describe('escapeHtml', () => {
  it('escapes what HTML would read as markup', () => {
    expect(escapeHtml(`a < b & "c" > d`)).toBe('a &lt; b &amp; &quot;c&quot; &gt; d');
  });
});

describe('parseUpdated', () => {
  it('reads a real date', () => {
    expect(parseUpdated('2026-10-21')).toEqual({ day: 21, month: 10, year: 2026 });
    expect(parseUpdated('2028-02-29')).toEqual({ day: 29, month: 2, year: 2028 });
  });

  it('rejects a day the month does not have', () => {
    expect(parseUpdated('2026-02-31')).toBeNull();
    expect(parseUpdated('2026-02-29')).toBeNull();
    expect(parseUpdated('2026-04-31')).toBeNull();
    expect(parseUpdated('2026-13-01')).toBeNull();
    expect(parseUpdated('2026-00-10')).toBeNull();
    expect(parseUpdated('2026-10-00')).toBeNull();
  });

  it('rejects text that is not YYYY-MM-DD', () => {
    expect(parseUpdated('')).toBeNull();
    expect(parseUpdated('21 October 2026')).toBeNull();
    expect(parseUpdated('2026-1-5')).toBeNull();
  });
});

describe('writePrivacyPages', () => {
  it('writes every page into privacy/2/, creating it, and leaves the 1.x policy alone', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'escuadra-privacy-'));
    try {
      writeFileSync(path.join(dir, 'privacy.html'), 'the 1.x policy');
      writePrivacyPages(dir, updated);
      expect(readdirSync(dir).sort()).toEqual(['privacy', 'privacy.html']);
      expect(readFileSync(path.join(dir, 'privacy.html'), 'utf8')).toBe('the 1.x policy');
      expect(readdirSync(path.join(dir, POLICY_DIR)).sort()).toEqual(
        Object.values(PAGE_FILES).sort(),
      );
      for (const language of SUPPORTED_LANGUAGES) {
        expect(readFileSync(path.join(dir, POLICY_DIR, PAGE_FILES[language]), 'utf8')).toBe(
          privacyPage(language, updated),
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// `PRIVACY_PAGES=<dir> PRIVACY_UPDATED=2026-10-21 npx vitest run
// scripts/privacy-pages.test.ts` writes the five pages into <dir>/privacy/2/
// (<dir> is a gh-pages worktree). Skipped in a normal run.
const out = process.env.PRIVACY_PAGES;
it.runIf(out !== undefined)('writes the five privacy pages', () => {
  const date = parseUpdated(process.env.PRIVACY_UPDATED ?? '');
  if (!date) throw new Error('PRIVACY_UPDATED=YYYY-MM-DD: the date the pages go live');
  writePrivacyPages(path.resolve(out ?? ''), date);
});
