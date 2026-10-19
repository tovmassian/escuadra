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
const allowedExternalLinks = ['https://github.com/tovmassian/escuadra/issues', appStoreUrl, siteUrl];
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

// The 2.0 policy, in five languages.
for (const { lang, file } of policyPages) {
  const page = `${policyDir}/${file}`;
  const html = readFileSync(page, 'utf8');
  assert.match(html, new RegExp(`<html lang="${lang}"`), `${page} declares its language`);
  assert.equal((html.match(/<main/g) ?? []).length, 1, `${page} has one main landmark`);
  assert.equal((html.match(/<h1/g) ?? []).length, 1, `${page} has exactly one h1`);
  assert.match(html, /data-theme-toggle/, `${page} has a theme toggle`);
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
  assert.match(
    html,
    /<p class="applies">[^<]*<a href="\.\.\/\.\.\/privacy\.html">[^<]+<\/a><\/p>/,
    `${page} says which versions it covers and links the policy for earlier ones`,
  );
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
assert.match(home, />Now on the App Store</, 'home has an honest release status');
assert.doesNotMatch(home, /Soon on|coming soon to the App Store/i, 'home no longer says iOS is coming soon');
assert.ok(home.includes(`href="${appStoreUrl}"`), 'App Store badge links to the live listing');
// Google's badge rules forbid recolouring or greying the badge, and it may only
// promote an app you can get (or pre-register) on Play. Until the Play listing
// is live (#51), no Google Play artwork appears — only plain text.
for (const page of pages) {
  assert.doesNotMatch(
    readFileSync(page, 'utf8'),
    /google-play-badge|badge--google-play/,
    `${page} shows no Google Play badge until Escuadra is live on Google Play`,
  );
}
assert.match(home, /Coming soon to Android™ phones\./, 'home says Android is coming, in plain text');
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
assert.match(home, /Android is a\s+trademark of Google LLC\./, 'home attributes the Android trademark');
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
