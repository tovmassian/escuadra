import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const pages = ['index.html', 'privacy.html', 'support.html'];
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
  assert.match(html, /href="privacy\.html"/, `${page} links privacy`);
  assert.match(html, /href="support\.html"/, `${page} links support`);
  assert.doesNotMatch(html, /https?:\/\/(?!github\.com\/tovmassian\/escuadra\/issues)/, `${page} has no external resource`);

  for (const [, target] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (target.startsWith('https://github.com/tovmassian/escuadra/issues')) continue;
    if (/^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith('//')) continue;
    const localPath = target.split(/[?#]/, 1)[0];
    if (localPath) assert.ok(existsSync(localPath), `${page} references missing local file: ${localPath}`);
  }
}

for (const [page, requiredText] of [
  ['privacy.html', 'Escuadra does not collect any data about you.'],
  ['support.html', 'GitHub Issues'],
]) {
  const html = readFileSync(page, 'utf8');
  assert.match(html, /<main/, `${page} has a main landmark`);
  assert.equal((html.match(/<h1/g) ?? []).length, 1, `${page} has exactly one h1`);
  assert.match(html, /data-theme-toggle/, `${page} has a theme toggle`);
  assert.match(html, /href="index\.html"/, `${page} links home`);
  assert.match(html, new RegExp(requiredText), `${page} retains its key copy`);
}

const home = readFileSync('index.html', 'utf8');
assert.match(home, /<h1>Know the squad\. Cold\.<\/h1>/, 'home has the approved headline');
assert.match(home, /Ten fast questions\. One squad you can name under pressure\./, 'home has the approved supporting copy');
assert.match(home, />Coming soon</, 'home has an honest release status');
assert.match(home, /10-question rounds/, 'home includes the round fact');
assert.match(home, /Club &amp; national squads/, 'home includes the squad fact');
assert.match(home, /Fully offline/, 'home includes the offline fact');
assert.match(home, /No account\. No ads\. No data collected\./, 'home includes the trust statement');
for (const path of screenshots) assert.match(home, new RegExp(path.replace('.', '\\.')), `home references ${path}`);

console.log(`Verified ${pages.length} pages and ${screenshots.length} local screenshots.`);
