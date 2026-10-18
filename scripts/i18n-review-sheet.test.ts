import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES } from '@/i18n/resolveLanguage';
import { reviewSheet } from './i18n-review-sheet';

describe('reviewSheet', () => {
  const sheet = reviewSheet('en');

  it('shows each text beside English, with its placeholders and its limit', () => {
    expect(sheet).toContain('| round.whoWears | Who wears {1}? | Who wears {1}? |  |');
    expect(sheet).toContain('| home.startTraining | Start Training | Start Training | 18 |');
  });

  it('shows the singular where the wording changes', () => {
    expect(sheet).toMatch(/\| study\.players \| \{1\} players<br>1: 1 player/);
  });

  it('leaves About and the store tagline to #146 and #147', () => {
    expect(sheet).not.toContain('| about.');
    expect(sheet).not.toContain('| store.');
  });

  it('lists the country names', () => {
    expect(sheet).toContain('| ENG | England | England |');
  });
});

// `REVIEW_SHEET=de npx vitest run scripts/i18n-review-sheet.test.ts` writes the
// sheet next to that language's shots. Skipped in a normal run.
const requested = process.env.REVIEW_SHEET;
it.runIf(requested !== undefined)('writes design/play/<lang>/review.md', () => {
  const language = SUPPORTED_LANGUAGES.find((supported) => supported === requested);
  if (!language) {
    throw new Error(`REVIEW_SHEET=${requested}: supported are ${SUPPORTED_LANGUAGES.join(', ')}`);
  }
  const dir = path.join(process.cwd(), 'design/play', language);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'review.md'), reviewSheet(language));
});
