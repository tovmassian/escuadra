import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path/posix';

// privacy.html is the 1.x policy and stays as it was: both store listings link it.
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
const allowedExternalLinks = [
  'https://github.com/tovmassian/escuadra/issues',
  appStoreUrl,
  playStoreUrl,
  siteUrl,
];
// How a page reaches the site root: '' at the root, '../../' in privacy/2/.
const rootOf = (page) => {
  const up = relative(dirname(page), '.');
  return up ? `${up}/` : '';
};
const screenshots = [
  'assets/marketing/home-dark.png',
  'assets/marketing/home-light.png',
  'assets/marketing/question-dark.png',
  'assets/marketing/question-light.png',
  'assets/marketing/results-dark.png',
  'assets/marketing/results-light.png',
];
const expectedScreenshotFiles = screenshots.map((path) => path.slice('assets/marketing/'.length));

for (const path of ['site.css', 'site.mjs', 'theme.mjs', ...screenshots]) {
  assert.ok(existsSync(path), `missing local asset: ${path}`);
}

assert.deepEqual(
  readdirSync('assets/marketing').sort(),
  expectedScreenshotFiles.slice().sort(),
  'marketing screenshot directory contains only the expected paired captures',
);

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
  assert.ok(html.includes(`href="${root}privacy.html"`), `${page} links privacy`);
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
  // 1.x policy: both store listings still link it, so it keeps saying what 1.x does.
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
assert.match(home, /<h1>Know the squad\. Cold\.<\/h1>/, 'home has the approved headline');
assert.match(home, /Ten fast questions\. One squad you can name under pressure\./, 'home has the approved supporting copy');
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
assert.deepEqual(
  badgeLinks,
  [
    {
      href: appStoreUrl,
      label: 'Download Escuadra on the App Store',
      src: 'assets/badges/app-store-badge-black.svg',
    },
    {
      href: playStoreUrl,
      label: 'Get Escuadra on Google Play',
      src: 'assets/badges/google-play-badge.svg',
    },
  ],
  'home links both live listings, the black App Store badge first, one badge image each',
);
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
assert.match(home, /10-question rounds/, 'home includes the round fact');
assert.match(home, /Club &amp; national squads/, 'home includes the squad fact');
assert.match(home, /<h2>Works offline<\/h2>/, 'home includes the offline fact');
assert.ok(
  home.includes("Every round plays without a connection, and there's no account to make."),
  'home explains the offline fact',
);
assert.doesNotMatch(home, /Fully offline/, 'home no longer promises more than offline play');
assert.match(home, /No ads\. No account\. No personal data\./, 'home includes the trust statement');
assert.doesNotMatch(home, /No data collected/, 'home no longer claims that nothing is collected');
for (const path of screenshots) assert.match(home, new RegExp(path.replace('.', '\\.')), `home references ${path}`);

console.log(`Verified ${pages.length} pages and ${screenshots.length} local screenshots.`);
