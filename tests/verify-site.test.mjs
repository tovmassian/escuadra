import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path/posix';
import { QUESTIONS, photoPage, photoSources } from '../quiz.mjs';

// privacy.html is the 1.x policy and stays as it was, for installs still on 1.x.
// The 2.0 policy lives in privacy/2/, one page per language.
const policyPages = [
  { lang: 'en', file: 'index.html', url: 'privacy/2/' },
  { lang: 'es', file: 'es.html', url: 'privacy/2/es.html' },
  { lang: 'fr', file: 'fr.html', url: 'privacy/2/fr.html' },
  { lang: 'it', file: 'it.html', url: 'privacy/2/it.html' },
  { lang: 'de', file: 'de.html', url: 'privacy/2/de.html' },
];
const policyDir = 'privacy/2';
const policyPaths = policyPages.map(({ file }) => `${policyDir}/${file}`);
const pages = ['index.html', 'privacy.html', 'support.html', ...policyPaths];
const siteUrl = 'https://tovmassian.github.io/escuadra/';
const appStoreUrl = 'https://apps.apple.com/us/app/escuadra/id6810705505';
const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.tovmassian.escuadra';
// Player photos are Wikimedia's own thumbnails, hotlinked and credited as the app does
// (guardrail 1): each links its Commons page and its licence deed.
const commonsThumb = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/';
const commonsFilePage = 'https://commons.wikimedia.org/wiki/File:';
const commonsPageById = 'https://commons.wikimedia.org/w/index.php?curid=';
const allowedExternalLinks = [
  'https://github.com/tovmassian/escuadra/issues',
  appStoreUrl,
  playStoreUrl,
  siteUrl,
  commonsThumb,
  commonsFilePage,
  commonsPageById,
  'https://creativecommons.org/licenses/',
];
// How a page reaches the site root: '' at the root, '../../' in privacy/2/.
const rootOf = (page) => {
  const up = relative(dirname(page), '.');
  return up ? `${up}/` : '';
};
for (const path of ['site.css', 'site.mjs', 'theme.mjs', 'quiz.mjs']) {
  assert.ok(existsSync(path), `missing local asset: ${path}`);
}

// Everything site.css loads (the fonts, the mark) is served from here.
const css = readFileSync('site.css', 'utf8');
for (const [, target] of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
  assert.ok(!/^[a-z][a-z\d+.-]*:|^\/\//i.test(target), `site.css loads nothing remote (${target})`);
  assert.ok(existsSync(target), `site.css references missing local file: ${target}`);
}
// The OFL asks that the licence travel with the fonts.
for (const face of readdirSync('assets/fonts', { withFileTypes: true }).filter((e) => e.isDirectory())) {
  const dir = `assets/fonts/${face.name}`;
  assert.ok(existsSync(`${dir}/OFL.txt`), `${dir} carries its OFL.txt`);
}
// A shipped image names its licence where it lives (main's docs/license.md).
for (const dir of ['assets/fonts', 'assets/flags']) {
  assert.ok(existsSync(`${dir}/README.md`), `${dir} names its source and licence`);
}

assert.deepEqual(
  readdirSync(policyDir).sort(),
  policyPages.map(({ file }) => file).sort(),
  'privacy/2 contains exactly the five language pages',
);

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const root = rootOf(page);
  assert.ok(html.includes(`href="${root}site.css"`), `${page} loads shared CSS`);
  assert.ok(html.includes(`src="${root}site.mjs"`), `${page} loads shared enhancement`);
  // Every live store ships 2.0, so the site's Privacy link is the 2.0 policy.
  // privacy.html, the 1.x policy, and the policy pages themselves link their own page.
  const policyLink = page.startsWith(`${policyDir}/`)
    ? 'index.html'
    : page === 'privacy.html'
      ? 'privacy.html'
      : `${root}privacy/2/`;
  assert.ok(html.includes(`href="${policyLink}"`), `${page} links the privacy policy`);
  assert.ok(html.includes(`href="${root}support.html"`), `${page} links support`);
  for (const [url] of html.matchAll(/https?:\/\/[^"'\s<)]+/g)) {
    assert.ok(
      allowedExternalLinks.some((allowed) => url.startsWith(allowed)),
      `${page} has no external resource beyond the allowed links (found ${url})`,
    );
  }

  // A local link is relative to the page that carries it, not to the cwd.
  for (const [, target] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (target === '#') assert.fail(`${page} has a placeholder link to #`);
    if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('//')) continue;
    const localPath = target.split(/[?#]/, 1)[0];
    if (localPath) {
      assert.ok(
        existsSync(join(dirname(page), localPath)),
        `${page} references missing local file: ${localPath}`,
      );
    }
  }
}

for (const [page, requiredText] of [
  // 1.x policy: installs still on 1.x rely on it, so it keeps saying what 1.x does.
  ['privacy.html', 'Escuadra does not collect any personal data about you.'],
  ['support.html', 'GitHub Issues'],
]) {
  const html = readFileSync(page, 'utf8');
  assert.equal((html.match(/<main/g) ?? []).length, 1, `${page} has one main landmark`);
  assert.equal((html.match(/<h1/g) ?? []).length, 1, `${page} has exactly one h1`);
  assert.match(html, /data-theme-toggle/, `${page} has a theme toggle`);
  assert.match(html, /href="index\.html"/, `${page} links home`);
  assert.match(html, new RegExp(requiredText), `${page} retains its key copy`);
}
assert.doesNotMatch(
  readFileSync('privacy.html', 'utf8'),
  /privacy\/2|TelemetryDeck|Wikimedia/,
  'privacy.html is the 1.x policy and says nothing about 2.0',
);

assert.match(
  readFileSync('privacy.html', 'utf8'),
  /<p class="correction">\s*Correction, 20 October 2026:/,
  'privacy.html carries the dated correction paragraph',
);

// The 2.0 policy, in five languages.
for (const { lang, file } of policyPages) {
  const page = `${policyDir}/${file}`;
  const html = readFileSync(page, 'utf8');
  assert.match(html, new RegExp(`<html lang="${lang}"`), `${page} declares its language`);
  assert.equal((html.match(/<main/g) ?? []).length, 1, `${page} has one main landmark`);
  assert.equal((html.match(/<h1/g) ?? []).length, 1, `${page} has exactly one h1`);
  assert.match(html, /data-theme-toggle/, `${page} has a theme toggle`);
  // site.mjs falls back to English when a label is missing, so a translated page
  // that lost its labels would ship an English toggle without any other sign.
  for (const label of ['light', 'dark', 'to-light', 'to-dark']) {
    assert.match(
      html,
      new RegExp(`data-label-${label}="[^"]+"`),
      `${page} has a non-empty data-label-${label} on its theme toggle`,
    );
  }
  if (lang !== 'en') {
    assert.doesNotMatch(
      html,
      /data-label-light="Light"/,
      `${page} translates the theme toggle`,
    );
  }
  assert.ok(html.includes('href="../../index.html"'), `${page} links home`);
  for (const sibling of policyPages) {
    assert.ok(html.includes(`href="${sibling.file}"`), `${page} links ${sibling.file}`);
    assert.ok(
      html.includes(`hreflang="${sibling.lang}" href="${siteUrl}${sibling.url}"`),
      `${page} declares ${sibling.url} as the ${sibling.lang} alternate`,
    );
  }
  assert.ok(
    html.includes(`hreflang="x-default" href="${siteUrl}privacy/2/"`),
    `${page} declares the English page as the default`,
  );
  const applies = html.match(
    /<p class="applies">[^<]*<a href="\.\.\/\.\.\/privacy\.html"([^>]*)>[^<]+<\/a><\/p>/,
  );
  assert.ok(
    applies,
    `${page} says which versions it covers and links the policy for earlier ones`,
  );
  // privacy.html is English only, so the link says so.
  assert.match(applies[1] ?? '', /\bhreflang="en"/, `${page} marks the 1.x policy link as English`);
  assert.doesNotMatch(
    html,
    /does not collect any personal data/,
    `${page} carries the current policy`,
  );
  if (lang === 'en') {
    assert.doesNotMatch(html, /<p><em>/, `${page} carries no translation notice`);
  } else {
    assert.match(
      html,
      /<p><em>[^<]+<\/em><\/p>\s*<\/main>/,
      `${page} ends with the translation notice`,
    );
  }
}

const home = readFileSync('index.html', 'utf8');
assert.equal((home.match(/<h1/g) ?? []).length, 1, 'home has exactly one h1');
assert.match(home, /<h1[^>]*>Know every<br \/>number\.<\/h1>/, 'home has the approved headline');
// The App Store promotional text, reviewed in store/listing/en.md.
assert.match(
  home,
  /Who wears number 7\? Learn every club in Europe’s top five leagues and over\s+150 national teams in quick rounds, then see exactly who you missed\./,
  'home has the approved supporting copy',
);
assert.match(home, /Know the squad\.<br \/>Cold\./, 'home keeps the earlier headline as its last call');
assert.match(home, /data-quiz>/, 'home carries the playable teaser');
assert.equal(
  (home.match(/data-quiz-option>/g) ?? []).length,
  4,
  'the teaser offers four names, as level 1 does',
);
// privacy/2/ takes its footer from main's catalogs, so only these three are pinned here.
for (const page of ['index.html', 'privacy.html', 'support.html']) {
  assert.match(
    readFileSync(page, 'utf8'),
    />Now on the App Store and Google Play</,
    `${page} has an honest release status`,
  );
}
assert.doesNotMatch(home, /soon/i, 'home no longer says either store is coming soon');
// Apple: with another store's badge in the layout, only the black App Store badge,
// placed first. Google: the badge may only promote an app you can get on Play.
const badgeLinks = [
  ...home.matchAll(
    /<a\s+href="([^"]+)"\s+aria-label="([^"]+)"\s*>\s*<img\s+class="badge[^"]*"\s+src="([^"]+)"\s+alt=""\s*\/>\s*<\/a>/g,
  ),
].map(([, href, label, src]) => ({ href, label, src }));
// Each link is named with its badge's own words, so voice control finds it (label in name).
const badgePair = [
  {
    href: appStoreUrl,
    label: 'Download on the App Store',
    src: 'assets/badges/app-store-badge-black.svg',
  },
  {
    href: playStoreUrl,
    label: 'Get it on Google Play',
    src: 'assets/badges/google-play-badge.svg',
  },
];
assert.ok(badgeLinks.length > 0, 'home links the store listings');
assert.deepEqual(
  badgeLinks,
  badgeLinks.map((_, i) => badgePair[i % 2]),
  'each place on home links both live listings, the black App Store badge first, one badge image each',
);
assert.equal(
  (home.match(/<img\s+class="badge/g) ?? []).length,
  badgeLinks.length,
  'every badge image is one of those links',
);
// Both badges are sized by the one .badge rule: the same height, as both stores'
// guidelines ask. Their widths follow their own artwork, which may not be stretched.
assert.equal(
  (home.match(/<img\s+class="badge"/g) ?? []).length,
  badgeLinks.length,
  'every badge image has only the shared badge class',
);
assert.doesNotMatch(css, /badge[^{]*\[src|google-play-badge|app-store-badge/, 'site.css sizes no badge apart');
// Both stores forbid recolouring, greying or fading their badges.
assert.doesNotMatch(
  readFileSync('site.css', 'utf8'),
  /\.badge[^{]*\{[^}]*\b(filter|opacity|mix-blend-mode)\s*:/,
  'site.css leaves the store badges unmodified',
);
assert.match(
  home,
  /Google Play and the\s+Google Play logo are\s+trademarks of Google LLC\./,
  'home credits Google Play and the Google Play logo, as the Play badge requires',
);
assert.match(
  home,
  /Apple and the Apple logo are trademarks of Apple Inc\., registered in\s+the U\.S\. and other countries\./,
  'home credits Apple and the Apple logo, as the App Store badge requires',
);
assert.match(
  home,
  /App Store is a service mark of Apple\s+Inc\., registered in the U\.S\. and other countries\./,
  'home credits the App Store service mark',
);
// privacy.html still names Android, and the credits cover the whole site.
assert.match(home, /Android is a trademark\s+of Google LLC\./, 'home attributes the Android trademark');
// 2.0 sends anonymous usage statistics, so home says so and links the policy.
assert.match(
  home,
  /Escuadra sends anonymous usage statistics unless you switch them off in\s+Settings\./,
  'home says what leaves the device',
);
assert.doesNotMatch(home, /No personal data|No data collected/, 'home makes no 1.x privacy claim');
assert.doesNotMatch(home, /Fully offline/, 'home no longer promises more than offline play');
// Photos cover about half the squad places, so nothing may promise one for every player.
assert.match(home, /where one is available/, 'home qualifies the player photos');
// The listing's affiliation line, word for word.
assert.match(
  home,
  /Escuadra is an independent, unofficial study tool\. It is not affiliated with,\s+endorsed by, or connected to any confederation, league or competition/,
  'home says Escuadra is unaffiliated',
);
assert.doesNotMatch(home, /assets\/marketing\//, 'home shows no 1.x screenshots');

// Every photo shown is credited on the page: its Commons page, its licence, "cropped".
// The file name only ever sits in a link, never in visible text (guardrail 1).
const imageSources = (className) =>
  [...home.matchAll(/<img\s[^>]*>/g)]
    .map(([tag]) => tag)
    .filter((tag) => tag.includes(`class="${className}"`))
    .map((tag) => tag.match(/\ssrc="([^"]+)"/)[1]);
const photoFiles = imageSources('miss-card-photo')
  .map((src) => decodeURIComponent(src.slice(commonsThumb.length).split('/')[2]));
const creditedFiles = [...home.matchAll(/href="([^"]+)"/g)]
  .map(([, href]) => href)
  .filter((href) => href.startsWith(commonsFilePage))
  .map((href) => decodeURIComponent(href.slice(commonsFilePage.length)));
assert.ok(photoFiles.length > 0, 'home shows the Results cards with their photos');
assert.deepEqual(photoFiles, creditedFiles, 'every photo is credited, once, in card order');
for (const credit of home.match(/<li>\s*<span class="photo-credits-player">[\s\S]*?<\/li>/g) ?? []) {
  assert.match(credit, /href="https:\/\/creativecommons\.org\/licenses\/[^"]+">CC [^<]+<\/a>\s*·\s*cropped/, 'a credit links its licence and says the photo is cropped');
}
assert.match(
  home,
  /These photos load from Wikimedia Commons, so Wikimedia receives your IP address and the\s+details of each request, as any website does\./,
  'home says the photos reach Wikimedia',
);
// The file names name the players; in visible text they would read as captions.
const visible = home.replace(/<[^>]*>/g, ' ');
for (const file of photoFiles) {
  assert.ok(!visible.includes(file.replace(/_/g, ' ')), `no visible text carries ${file}`);
}

// The teaser's stage opens on its first question's photo, and site.mjs swaps the rest.
// Each is credited under the card by its page id and its team and number, so neither
// the credit nor its link gives an answer away.
assert.deepEqual(imageSources('stage-photo'), [photoSources(QUESTIONS[0].photo).src], 'the stage opens on the first photo');
const teaserCredits = home.slice(home.indexOf('data-quiz'), home.indexOf('id="how"'));
for (const { team, number, photo, options } of QUESTIONS) {
  assert.ok(
    teaserCredits.includes(
      `<span class="photo-credits-player">${team} · ${number}</span>\n                  <a href="${photoPage(photo)}">${photo.author}</a>\n                  · <a href="${photo.licenceUrl}">${photo.licence}</a> · cropped`,
    ),
    `${team}'s photo is credited under the teaser`,
  );
  for (const name of options) {
    assert.ok(!teaserCredits.slice(teaserCredits.indexOf('photo-credits')).includes(name), `the teaser's credits never name ${name}`);
  }
}

console.log(`Verified ${pages.length} pages.`);
