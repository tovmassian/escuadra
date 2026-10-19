import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOGS } from '@/i18n/catalogs';
import { SUPPORTED_LANGUAGES } from '@/i18n/resolveLanguage';
import { translationNotice } from '@/i18n/translationNotice';
import { escapeHtml, PAGE_FILES, privacyPage, SITE_URL } from './privacy-pages';

const updated = { day: 21, month: 10, year: 2026 };

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

  it('declares its language and its alternates', () => {
    expect(html).toContain(`<html lang="${language}">`);
    for (const other of SUPPORTED_LANGUAGES) {
      expect(html).toContain(
        `<link rel="alternate" hreflang="${other}" href="${SITE_URL}${PAGE_FILES[other]}" />`,
      );
    }
    expect(html).toContain(
      `<link rel="alternate" hreflang="x-default" href="${SITE_URL}${PAGE_FILES.en}" />`,
    );
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

// `PRIVACY_PAGES=<dir> PRIVACY_UPDATED=2026-10-21 npx vitest run
// scripts/privacy-pages.test.ts` writes the five pages into <dir> (a gh-pages
// worktree). Skipped in a normal run.
const out = process.env.PRIVACY_PAGES;
it.runIf(out !== undefined)('writes the five privacy pages', () => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(process.env.PRIVACY_UPDATED ?? '');
  if (!match) throw new Error('PRIVACY_UPDATED=YYYY-MM-DD: the date the pages go live');
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const dir = path.resolve(out ?? '');
  mkdirSync(dir, { recursive: true });
  for (const language of SUPPORTED_LANGUAGES) {
    writeFileSync(path.join(dir, PAGE_FILES[language]), privacyPage(language, date));
  }
});
