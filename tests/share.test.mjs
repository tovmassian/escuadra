import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { LANGUAGES } from '../language.mjs';
import { TEXTS, renderSite } from '../src/build.mjs';
import {
  SHARE_HEIGHT,
  SHARE_LOCALES,
  SHARE_WIDTH,
  cardHash,
  shareAlt,
  shareCard,
  shareImagePath,
} from '../src/share.mjs';

const siteUrl = 'https://tovmassian.github.io/escuadra/';
const property = (html, name) =>
  [...html.matchAll(new RegExp(`<meta property="${name}" content="([^"]*)" />`, 'g'))].map(
    (match) => match[1],
  );

test('each language has its share card, drawn from the current card: run `node src/share-images.mjs`', () => {
  const hashes = JSON.parse(readFileSync('assets/share/cards.json', 'utf8'));
  assert.deepEqual(Object.keys(hashes).sort(), [...LANGUAGES].sort());
  for (const language of LANGUAGES) {
    assert.equal(hashes[language], cardHash(shareCard(language, TEXTS[language])), `${language} card is current`);
    const png = readFileSync(shareImagePath(language));
    // PNG signature, then the IHDR chunk: width and height as 32-bit big-endian.
    assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG', `${language} card is a PNG`);
    assert.equal(png.readUInt32BE(16), SHARE_WIDTH, `${language} card is ${SHARE_WIDTH} wide`);
    assert.equal(png.readUInt32BE(20), SHARE_HEIGHT, `${language} card is ${SHARE_HEIGHT} high`);
    // WhatsApp shows no picture for an og:image over 300 KB.
    assert.ok(statSync(shareImagePath(language)).size < 300_000, `${language} card is under 300 KB`);
  }
});

test('the card names no player and shows no photo, flag or badge', () => {
  for (const language of LANGUAGES) {
    const card = shareCard(language, TEXTS[language]);
    assert.doesNotMatch(card, /<img|url\(|wikimedia|flags\/|badge/i, `${language} card draws only its own shapes`);
  }
});

test('every generated page describes itself to link previews, in its own language', () => {
  for (const [path, html] of renderSite()) {
    const language = path.includes('/') ? path.split('/')[0] : 'en';
    const file = path.split('/').pop();
    const text = TEXTS[language];
    const url = `${siteUrl}${language === 'en' ? '' : `${language}/`}${file === 'index.html' ? '' : file}`;
    const title = file === 'index.html' ? text.meta.homeTitle : text.meta.supportTitle;
    assert.deepEqual(property(html, 'og:type'), ['website'], `${path} og:type`);
    assert.deepEqual(property(html, 'og:site_name'), ['Escuadra'], `${path} og:site_name`);
    assert.deepEqual(property(html, 'og:title'), [title], `${path} og:title is its title`);
    assert.equal(property(html, 'og:description').length, 1, `${path} og:description`);
    assert.ok(property(html, 'og:description')[0].length > 50, `${path} og:description says something`);
    assert.match(html, /<meta\s+name="description"\s+content="[^"]{50,}"/, `${path} has a meta description`);
    assert.deepEqual(property(html, 'og:url'), [url], `${path} og:url is its canonical URL`);
    assert.ok(html.includes(`<link rel="canonical" href="${url}" />`), `${path} og:url matches canonical`);
    assert.deepEqual(property(html, 'og:locale'), [SHARE_LOCALES[language]], `${path} og:locale`);
    assert.equal(property(html, 'og:locale:alternate').length, LANGUAGES.length - 1, `${path} offers the other locales`);
    assert.deepEqual(property(html, 'og:image'), [`${siteUrl}${shareImagePath(language)}`], `${path} shares its language's card`);
    assert.deepEqual(property(html, 'og:image:width'), [String(SHARE_WIDTH)], `${path} og:image:width`);
    assert.deepEqual(property(html, 'og:image:height'), [String(SHARE_HEIGHT)], `${path} og:image:height`);
    assert.deepEqual(property(html, 'og:image:alt'), [shareAlt(text)], `${path} describes its card`);
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image" />'), `${path} asks X for the large card`);
  }
});
