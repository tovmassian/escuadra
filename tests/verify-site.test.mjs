import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const privacyPages = [
  'privacy.html',
  'privacy.es.html',
  'privacy.fr.html',
  'privacy.it.html',
  'privacy.de.html',
];
const pages = ['index.html', ...privacyPages, 'support.html'];
const siteUrl = 'https://tovmassian.github.io/escuadra/';
const appStoreUrl = 'https://apps.apple.com/us/app/escuadra/id6810705505';
const allowedExternalLinks = ['https://github.com/tovmassian/escuadra/issues', appStoreUrl, siteUrl];
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

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  assert.match(html, /href="site\.css"/, `${page} loads shared CSS`);
  assert.match(html, /src="site\.mjs"/, `${page} loads shared enhancement`);
  assert.match(html, /href="privacy(\.[a-z]{2})?\.html"/, `${page} links privacy`);
  assert.match(html, /href="support\.html"/, `${page} links support`);
  for (const [url] of html.matchAll(/https?:\/\/[^"'\s<)]+/g)) {
    assert.ok(
      allowedExternalLinks.some((allowed) => url.startsWith(allowed)),
      `${page} has no external resource beyond the allowed links (found ${url})`,
    );
  }

  for (const [, target] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (target === '#') assert.fail(`${page} has a placeholder link to #`);
    if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('//')) continue;
    const localPath = target.split(/[?#]/, 1)[0];
    if (localPath) assert.ok(existsSync(localPath), `${page} references missing local file: ${localPath}`);
  }
}

for (const [page, requiredText] of [
  ['privacy.html', 'Escuadra has no account, no sign-in and no advertising'],
  ['support.html', 'GitHub Issues'],
]) {
  const html = readFileSync(page, 'utf8');
  assert.match(html, /<main/, `${page} has a main landmark`);
  assert.equal((html.match(/<h1/g) ?? []).length, 1, `${page} has exactly one h1`);
  assert.match(html, /data-theme-toggle/, `${page} has a theme toggle`);
  assert.match(html, /href="index\.html"/, `${page} links home`);
  assert.match(html, new RegExp(requiredText), `${page} retains its key copy`);
}

for (const page of privacyPages) {
  const html = readFileSync(page, 'utf8');
  assert.match(html, /<main/, `${page} has a main landmark`);
  assert.equal((html.match(/<h1/g) ?? []).length, 1, `${page} has exactly one h1`);
  for (const other of privacyPages) {
    assert.ok(html.includes(`href="${other}"`), `${page} links ${other}`);
    assert.ok(
      html.includes(`href="${siteUrl}${other}"`),
      `${page} declares ${other} as an alternate`,
    );
  }
  assert.match(html, /hreflang="x-default"/, `${page} declares the English page as the default`);
  assert.doesNotMatch(
    html,
    /does not collect any personal data/,
    `${page} carries the current policy`,
  );
}
for (const page of privacyPages.slice(1)) {
  assert.match(readFileSync(page, 'utf8'), /<p><em>/, `${page} ends with the translation notice`);
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
assert.match(home, /Fully offline/, 'home includes the offline fact');
assert.match(home, /No account\. No ads\. No data collected\./, 'home includes the trust statement');
for (const path of screenshots) assert.match(home, new RegExp(path.replace('.', '\\.')), `home references ${path}`);

console.log(`Verified ${pages.length} pages and ${screenshots.length} local screenshots.`);
