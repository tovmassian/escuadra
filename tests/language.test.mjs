import assert from 'node:assert/strict';
import test from 'node:test';
import { LANGUAGES, resolveSiteLanguage } from '../language.mjs';

test('a language picked on the site wins', () => {
  for (const language of LANGUAGES) assert.equal(resolveSiteLanguage(language, ['de-DE']), language);
  // resolveSiteLanguage keeps its own copy of the list, so the two must agree.
  assert.deepEqual(LANGUAGES.map((l) => resolveSiteLanguage(l, [])), LANGUAGES);
});

test('otherwise the first of the browser’s languages the site has, as the app does', () => {
  assert.equal(resolveSiteLanguage(null, ['es-MX', 'en-US']), 'es');
  assert.equal(resolveSiteLanguage(null, ['ja-JP', 'fr_CA', 'de']), 'fr');
  assert.equal(resolveSiteLanguage(null, ['en-GB', 'es-ES']), 'en');
  assert.equal(resolveSiteLanguage('xx', ['IT-it']), 'it');
});

test('otherwise English', () => {
  assert.equal(resolveSiteLanguage(null, ['ja-JP']), 'en');
  assert.equal(resolveSiteLanguage(null, []), 'en');
});

test('it carries nothing from outside, so the page can inline its source', () => {
  const inlined = new Function(`return (${resolveSiteLanguage.toString()})`)();
  assert.equal(inlined(null, ['de-AT']), 'de');
});
