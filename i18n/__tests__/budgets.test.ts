// The length budgets (#141, Text expansion) as a test: every catalog's short
// labels fit the characters their space holds. i18n/en.ts carries the same
// budgets as comments for translators; the first test keeps the two in step.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LENGTH_BUDGETS } from '../budgets';
import { CATALOGS } from '../catalogs';
import { en } from '../en';
import { catalogLeaves } from '../leaves';
import { SUPPORTED_LANGUAGES } from '../resolveLanguage';

const source = readFileSync(path.join(process.cwd(), 'i18n/en.ts'), 'utf8');

describe('LENGTH_BUDGETS', () => {
  it('has one group per "≤ N chars" comment in en.ts, in the same order', () => {
    const commented = [...source.matchAll(/≤ (\d+) chars/g)].map((match) => Number(match[1]));
    expect(LENGTH_BUDGETS.map((group) => group.budget)).toEqual(commented);
  });

  it('names only paths that exist in the English catalog', () => {
    const paths = new Set(catalogLeaves(en).map((leaf) => leaf.path));
    const unknown = LENGTH_BUDGETS.flatMap(({ texts }) => Object.keys(texts))
      .map((name) => name.replace(/ \(.*\)$/, ''))
      .filter((name) => !paths.has(name));
    expect(unknown).toEqual([]);
  });

  it.each(SUPPORTED_LANGUAGES)('%s fits every budget', (language) => {
    const over = LENGTH_BUDGETS.flatMap(({ budget, texts }) =>
      Object.entries(texts)
        .map(([name, text]) => ({ name, budget, text: text(CATALOGS[language]) }))
        // Characters as a reader counts them: "É" is one, whatever its encoding.
        .filter(({ text }) => [...text.normalize('NFC')].length > budget),
    );
    expect(over).toEqual([]);
  });
});
