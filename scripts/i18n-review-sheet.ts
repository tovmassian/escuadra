// The sheet a native reviewer signs off (#145): every catalog text beside its
// English and its length limit, then the country names. Written next to that
// language's shots by `REVIEW_SHEET=de npx vitest run
// scripts/i18n-review-sheet.test.ts` — a Vitest run, because Node alone cannot
// load the catalogs' extensionless imports.
import type { FlagCode } from '@/assets/flags/generated';
import { LENGTH_BUDGETS } from '@/i18n/budgets';
import { CATALOGS } from '@/i18n/catalogs';
import { COUNTRY_NAMES } from '@/i18n/countries';
import { en } from '@/i18n/en';
import { catalogLeaves, isLater, type Leaf } from '@/i18n/leaves';
import { LANGUAGE_NAMES } from '@/i18n/names';
import type { SupportedLanguage } from '@/i18n/resolveLanguage';

const budgetByPath = new Map<string, number>(
  LENGTH_BUDGETS.flatMap(({ budget, texts }) =>
    Object.keys(texts).map((name) => [name.replace(/ \(.*\)$/, ''), budget] as const),
  ),
);

function cell(text: string): string {
  return text.replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

/** A text, then a function's wording for 1 and for 0 where it changes. */
function forms(leaf: Leaf): string {
  const { call } = leaf;
  if (!call || !/\{\d\}/.test(leaf.text)) return leaf.text;
  const extra = [1, 0].flatMap((n) => {
    try {
      const text = call(...Array<number>(leaf.arity).fill(n));
      return text === leaf.text.replace(/\{\d\}/g, String(n)) ? [] : [`${n}: ${text}`];
    } catch {
      return []; // A text parameter, not a count: a number has no `.endsWith`.
    }
  });
  return [leaf.text, ...extra].join('\n');
}

export function reviewSheet(language: SupportedLanguage): string {
  const name = LANGUAGE_NAMES[language];
  const theirs = new Map(catalogLeaves(CATALOGS[language]).map((leaf) => [leaf.path, leaf]));
  const rows = catalogLeaves(en)
    // A path #146/#147 translate, or one with no English text: nothing to review.
    .filter((leaf) => !isLater(leaf.path) && leaf.text !== '')
    .map((leaf) => {
      const translated = theirs.get(leaf.path);
      const limit = budgetByPath.get(leaf.path) ?? '';
      return `| ${leaf.path} | ${cell(forms(leaf))} | ${cell(translated ? forms(translated) : '')} | ${limit} |`;
    });
  // The English table's keys are exactly the FlagCodes (countries.test.ts).
  const codes = Object.keys(COUNTRY_NAMES.en) as FlagCode[];
  const countries = codes.map(
    (code) =>
      `| ${code} | ${cell(COUNTRY_NAMES.en[code])} | ${cell(COUNTRY_NAMES[language][code])} |`,
  );
  return [
    `# ${name}: review sheet (#145)`,
    '',
    'Reviewer: ______________ Signed off on: ______________',
    '',
    '- `{1}`, `{2}`… are filled in by the app: a number, a name or a label. "1:" and "0:" show the wording for one and for none, where it changes.',
    '- Limit is the most characters the space holds. A text that does not fit is rewritten, never shrunk.',
    '- Never translated: Escuadra, a la escuadra. Team and player names come from the data, so a sentence must not need an article or a case ending around one.',
    '- The screenshots in this folder show each text in place, in dark and in light.',
    '',
    '## Interface',
    '',
    `| Key | English | ${name} | Limit |`,
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    '## Countries',
    '',
    `| Code | English | ${name} |`,
    '| --- | --- | --- |',
    ...countries,
    '',
  ].join('\n');
}
