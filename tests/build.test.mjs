import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderSite } from '../src/build.mjs';
import en from '../src/text/en.mjs';
import { FRESH } from '../src/text/fresh.mjs';

test('every generated page on disk is what the generator renders: run `node src/build.mjs`', () => {
  for (const [path, html] of renderSite()) {
    assert.equal(readFileSync(path, 'utf8'), html, `${path} is out of date with its text file`);
  }
});

// The languages whose text file has landed; each joins this list when its file does.
const TRANSLATED = ['es', 'fr'];

/** Every leaf as [path, value]: home.try.steps.0 → 'Read the number…'. */
function leaves(value, path = []) {
  return typeof value === 'object' && value !== null
    ? Object.entries(value).flatMap(([key, child]) => leaves(child, [...path, key]))
    : [[path.join('.'), value]];
}
const slots = (value) => [...String(value).matchAll(/\{\w+\}|<[^>]+>/g)].map(([m]) => m).sort();
// Words that are the same in every language: names, numbers, codes, Escuadra's own.
const SAME_IN_ALL = /^(Escuadra|A la escuadra|Club|Nat|Name|Pos|Age|\{score\} of \{total\}|Real Madrid · 2026\/27.*|Barcelona · 2026\/27.*|[A-Z]{2,3})$/;

for (const language of TRANSLATED) {
  const file = await import(`../src/text/${language}.mjs`);
  const text = file.default;
  // A text file may name the keys that are rightly the same as English in it
  // (German keeps "Support"): `export const SAME_AS_ENGLISH = ['layout.nav.support']`.
  const sameAsEnglish = file.SAME_AS_ENGLISH ?? [];

  test(`${language} has en.mjs's shape, slots and markup`, () => {
    const mine = new Map(leaves(text));
    // A fresh headline may break its lines differently: only its <br />s may differ.
    const breaksFree = (path, list) => (FRESH.includes(path) ? list.filter((s) => s !== '<br />') : list);
    for (const [path, value] of leaves(en)) {
      assert.ok(mine.has(path), `${language} has ${path}`);
      assert.deepEqual(
        breaksFree(path, slots(mine.get(path))),
        breaksFree(path, slots(value)),
        `${language}'s ${path} keeps en's {slots} and tags`,
      );
    }
    assert.equal(mine.size, leaves(en).length, `${language} has no key en lacks`);
  });

  test(`${language} leaves nothing in English`, () => {
    const english = new Map(leaves(en));
    for (const [path, value] of leaves(text)) {
      if (path.startsWith('countries.') || SAME_IN_ALL.test(value)) continue;
      if (sameAsEnglish.includes(path)) continue;
      assert.notEqual(value, english.get(path), `${language}'s ${path} is translated`);
    }
  });

  test(`${language} writes every fresh line`, () => {
    const mine = new Map(leaves(text));
    for (const path of FRESH) assert.ok(mine.get(path), `${language} has ${path}`);
  });
}
