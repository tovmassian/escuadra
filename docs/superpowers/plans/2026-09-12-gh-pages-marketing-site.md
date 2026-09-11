# Escuadra gh-pages marketing site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the gh-pages utility homepage into a responsive, accessible, theme-aware Escuadra marketing site while preserving clear Privacy and Support pages.

**Architecture:** Keep the site entirely static: three HTML documents share a CSS custom-property design system and a tiny browser-module enhancement layer. A pure `theme.mjs` module is unit-tested with Node’s built-in test runner; `site.mjs` imports it to initialise manual theme preference and scroll reveals. The pages remain readable, navigable, and correctly themed without the enhancement module.

**Tech Stack:** Semantic HTML5, CSS custom properties and media queries, standards-based browser JavaScript modules, Node 24’s built-in `node:test` / `node:assert`, local PNG assets only.

**Spec:** `docs/superpowers/specs/2026-09-12-gh-pages-marketing-site-design.md`

## Global Constraints

- Keep exactly three public static pages: `index.html`, `privacy.html`, and `support.html`.
- Do not add a backend, form, waitlist, analytics, tracker, account, remote API, framework, external font, icon library, or third-party asset.
- The primary release status is non-interactive `Coming soon`; do not ship an empty or dead App Store link.
- Use only Escuadra-owned brand treatment and app screenshots; never add player photos, club crests, badges, logos, shields, or unlicensed imagery.
- Default to the system theme, offer an accessible persisted manual light/dark toggle, and use the same full semantic palette in both modes.
- All transition durations must be 300ms or less; `prefers-reduced-motion: reduce` must remove reveal and theme-transition movement.
- The site must work on narrow mobile screens, remain keyboard navigable, show visible focus, and use semantic headings/landmarks and meaningful image alt text.
- Privacy and Support must keep their factual meaning: Escuadra is offline, has no account, ads, analytics, or app network requests.
- Do not modify or stage unrelated existing untracked files or the visual-companion workspace under `.superpowers/`.

---

## Planned file structure

| File | Responsibility |
| --- | --- |
| `theme.mjs` | Pure theme constants and resolver functions, safe to import from Node tests and browser modules. |
| `site.mjs` | Browser-only theme-toggle persistence, system-theme change handling, and progressive reveal enhancement. |
| `site.css` | Both semantic palettes, layout, visual components, responsive rules, motion, focus, and reduced-motion rules. |
| `assets/marketing/*.png` | Six local, owned screen captures: home/question/results in matching dark/light pairs. |
| `index.html` | Marketing homepage: header, Matchcard hero, product proof, facts, trust statement, footer. |
| `privacy.html` | Existing policy copy inside the shared themed legal-page shell. |
| `support.html` | Existing support copy inside the shared themed legal-page shell. |
| `tests/theme.test.mjs` | Unit tests for pure preference resolution and toggling. |
| `scripts/verify-site.mjs` | Dependency-free structural regression check for page links, shared assets, local-only resources, and screenshot references. |

### Task 1: Create the testable theme contract

**Files:**
- Create: `theme.mjs`
- Create: `tests/theme.test.mjs`

**Interfaces:**
- Produces: `THEME_STORAGE_KEY: 'escuadra-site-theme'`, `isTheme(value): boolean`, `resolveTheme(storedTheme, systemPrefersDark): 'light' | 'dark'`, and `nextTheme(theme): 'light' | 'dark'`.
- Consumed by: `site.mjs` and the inline pre-paint bootstrap snippets in all three HTML documents.

- [ ] **Step 1: Write the failing unit tests for valid, missing, and invalid stored preferences**

```js
// tests/theme.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  THEME_STORAGE_KEY,
  isTheme,
  nextTheme,
  resolveTheme,
} from '../theme.mjs';

test('uses a valid saved preference ahead of the system setting', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('uses the system setting when no valid preference is stored', () => {
  assert.equal(resolveTheme(null, true), 'dark');
  assert.equal(resolveTheme(undefined, false), 'light');
  assert.equal(resolveTheme('sepia', true), 'dark');
});

test('exposes the supported theme vocabulary and toggle direction', () => {
  assert.equal(THEME_STORAGE_KEY, 'escuadra-site-theme');
  assert.equal(isTheme('light'), true);
  assert.equal(isTheme('dark'), true);
  assert.equal(isTheme('system'), false);
  assert.equal(nextTheme('light'), 'dark');
  assert.equal(nextTheme('dark'), 'light');
});
```

- [ ] **Step 2: Run the new test file and confirm it fails because the module does not exist**

Run: `node --test tests/theme.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `theme.mjs`.

- [ ] **Step 3: Implement the dependency-free pure module**

```js
// theme.mjs
export const THEME_STORAGE_KEY = 'escuadra-site-theme';

export function isTheme(value) {
  return value === 'light' || value === 'dark';
}

export function resolveTheme(storedTheme, systemPrefersDark) {
  if (isTheme(storedTheme)) return storedTheme;
  return systemPrefersDark ? 'dark' : 'light';
}

export function nextTheme(theme) {
  return theme === 'dark' ? 'light' : 'dark';
}
```

- [ ] **Step 4: Run the theme tests and confirm all cases pass**

Run: `node --test tests/theme.test.mjs`

Expected: PASS with three passing subtests.

- [ ] **Step 5: Commit the independent contract**

```bash
git add theme.mjs tests/theme.test.mjs
git commit -m "test: define site theme contract"
```

### Task 2: Add owned marketing screenshots and a static-site verification command

**Files:**
- Create: `assets/marketing/home-dark.png` from `design/store/01-home.png`
- Create: `assets/marketing/home-light.png` from `design/store/01-home-light.png`
- Create: `assets/marketing/question-dark.png` from `design/store/06-question-l1.png`
- Create: `assets/marketing/question-light.png` from `design/store/06-question-l1-light.png`
- Create: `assets/marketing/results-dark.png` from `design/store/08-results-passed.png`
- Create: `assets/marketing/results-light.png` from `design/store/08-results-passed-light.png`
- Create: `scripts/verify-site.mjs`

**Interfaces:**
- Consumes: the approved owned screenshots from the existing untracked `design/store/` handoff directory.
- Produces: six local public assets and a zero-dependency command, `node scripts/verify-site.mjs`, which exits nonzero on missing shared assets, broken internal links, external resource URLs, or unpaired screenshots.
- Consumed by: all page tasks and final verification.

- [ ] **Step 1: Write the verifier first, with the exact expected pages and assets**

```js
// scripts/verify-site.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const pages = ['index.html', 'privacy.html', 'support.html'];
const screenshots = [
  'assets/marketing/home-dark.png',
  'assets/marketing/home-light.png',
  'assets/marketing/question-dark.png',
  'assets/marketing/question-light.png',
  'assets/marketing/results-dark.png',
  'assets/marketing/results-light.png',
];

for (const path of ['site.css', 'site.mjs', 'theme.mjs', ...screenshots]) {
  assert.ok(existsSync(path), `missing local asset: ${path}`);
}

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  assert.match(html, /href="site\.css"/, `${page} loads shared CSS`);
  assert.match(html, /src="site\.mjs"/, `${page} loads shared enhancement`);
  assert.match(html, /href="privacy\.html"/, `${page} links privacy`);
  assert.match(html, /href="support\.html"/, `${page} links support`);
  assert.doesNotMatch(html, /https?:\/\/(?!github\.com\/tovmassian\/escuadra\/issues)/, `${page} has no external resource`);
}

console.log(`Verified ${pages.length} pages and ${screenshots.length} local screenshots.`);
```

The first run should fail because the shared style/module files and final page markup do not exist yet; keep this failure as the integration signal for later tasks.

- [ ] **Step 2: Copy exactly the six approved PNGs into the public asset directory**

Run:

```bash
mkdir -p assets/marketing
cp design/store/01-home.png assets/marketing/home-dark.png
cp design/store/01-home-light.png assets/marketing/home-light.png
cp design/store/06-question-l1.png assets/marketing/question-dark.png
cp design/store/06-question-l1-light.png assets/marketing/question-light.png
cp design/store/08-results-passed.png assets/marketing/results-dark.png
cp design/store/08-results-passed-light.png assets/marketing/results-light.png
```

Do not alter the source images in `design/store/`; they are a design handoff surface. Do not add team crests, player imagery, or external assets.

- [ ] **Step 3: Run the verifier and confirm the expected early failure is for site files, not screenshot files**

Run: `node scripts/verify-site.mjs`

Expected: FAIL with `missing local asset: site.css`. It must not report a missing screenshot.

- [ ] **Step 4: Commit the verified local asset set and verifier**

```bash
git add assets/marketing scripts/verify-site.mjs
git commit -m "feat: add local marketing site assets"
```

### Task 3: Implement the shared theme, motion, and accessibility layer

**Files:**
- Create: `site.css`
- Create: `site.mjs`
- Modify: `index.html` (head bootstrap and shared resource references only at this task)
- Modify: `privacy.html` (head bootstrap and shared resource references only at this task)
- Modify: `support.html` (head bootstrap and shared resource references only at this task)

**Interfaces:**
- Consumes: `resolveTheme`, `nextTheme`, and `THEME_STORAGE_KEY` from `theme.mjs`.
- Produces: a `[data-theme]` palette contract, `[data-theme-toggle]` controls, and `[data-reveal]` progressive reveal markers for the page content tasks.
- Consumed by: the homepage and legal-page markup in Tasks 4–5.

- [ ] **Step 1: Extend the theme unit tests with the browser-module invariants**

Append these tests to `tests/theme.test.mjs`:

```js
test('never returns an unsupported theme', () => {
  for (const stored of [null, undefined, '', 'light', 'dark', 'auto', 'sepia']) {
    assert.equal(isTheme(resolveTheme(stored, false)), true);
    assert.equal(isTheme(resolveTheme(stored, true)), true);
  }
});
```

- [ ] **Step 2: Run the theme test suite and confirm the expanded test passes before browser wiring**

Run: `node --test tests/theme.test.mjs`

Expected: PASS with four passing subtests.

- [ ] **Step 3: Add both complete semantic palettes and the shared interaction styles to `site.css`**

Implement the following contract; choose exact values from the visible app screenshots rather than adding arbitrary decorative colours:

```css
:root {
  color-scheme: light;
  --page: #f5f5f7;
  --surface: #ffffff;
  --ink: #11131a;
  --muted: #626977;
  --line: #d8dbe2;
  --accent: #4c50ba;
  --accent-strong: #393d9e;
  --focus: #4c50ba;
  --shadow: 0 18px 40px rgb(18 22 33 / 12%);
}

:root[data-theme='dark'] {
  color-scheme: dark;
  --page: #101218;
  --surface: #191d24;
  --ink: #f5f6fa;
  --muted: #adb3bf;
  --line: #393f4a;
  --accent: #9296eb;
  --accent-strong: #a9adff;
  --focus: #b6b9ff;
  --shadow: 0 18px 40px rgb(0 0 0 / 28%);
}

:focus-visible { outline: 3px solid var(--focus); outline-offset: 4px; }
[data-reveal] { opacity: 1; transform: none; }
:root[data-js='true'] [data-reveal] { opacity: 0; transform: translateY(12px); }
:root[data-js='true'] [data-reveal].is-visible { opacity: 1; transform: none; }
@media (prefers-reduced-motion: no-preference) {
  * { transition-duration: 180ms; transition-timing-function: ease; }
  [data-reveal] { transition-property: opacity, transform; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
```

Complete the same file with the mobile-first layout, header/footer, brand mark, text-link, screen-card, fact, trust, and legal-prose styles. Keep content contained at a readable desktop width, use comfortable phone padding, and avoid hiding content behind decoration.

- [ ] **Step 4: Implement progressive enhancement in `site.mjs`**

```js
// site.mjs
import { THEME_STORAGE_KEY, nextTheme, resolveTheme } from './theme.mjs';

const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: dark)');
let hasSavedPreference = false;

function setTheme(theme, persist) {
  root.dataset.theme = theme;
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      hasSavedPreference = true;
    } catch {
      hasSavedPreference = false;
    }
  }
  for (const toggle of document.querySelectorAll('[data-theme-toggle]')) {
    toggle.setAttribute('aria-pressed', String(theme === 'dark'));
    toggle.setAttribute('aria-label', `Switch to ${nextTheme(theme)} theme`);
    const label = toggle.querySelector('[data-theme-toggle-label]');
    if (label) label.textContent = theme === 'dark' ? 'Dark' : 'Light';
  }
}

function initialiseTheme() {
  let savedTheme = null;
  try { savedTheme = localStorage.getItem(THEME_STORAGE_KEY); } catch {}
  hasSavedPreference = savedTheme === 'light' || savedTheme === 'dark';
  setTheme(resolveTheme(savedTheme, media.matches), false);
  for (const toggle of document.querySelectorAll('[data-theme-toggle]')) {
    toggle.addEventListener('click', () => setTheme(nextTheme(root.dataset.theme), true));
  }
  media.addEventListener('change', (event) => {
    if (!hasSavedPreference) setTheme(resolveTheme(null, event.matches), false);
  });
}

function initialiseReveals() {
  const items = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((item) => item.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries, currentObserver) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      }
    }
  }, { threshold: 0.15 });
  items.forEach((item) => observer.observe(item));
}

initialiseTheme();
initialiseReveals();
```

The explicit `try`/`catch` blocks and label guard above are required: private-mode storage failures and a malformed toggle must not break navigation.

- [ ] **Step 5: Insert a matching pre-paint bootstrap in the head of every page and link shared files**

Place this before `site.css` and page body content, updating the theme key only if the constant in Task 1 changes:

```html
<script>
  try {
    const saved = localStorage.getItem('escuadra-site-theme');
    const theme = saved === 'light' || saved === 'dark'
      ? saved
      : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.js = 'true';
</script>
<link rel="stylesheet" href="site.css">
<script type="module" src="site.mjs"></script>
```

Use a `<button type="button" class="theme-toggle" data-theme-toggle>` with a child `<span data-theme-toggle-label></span>` in each shared header added by later tasks. Do not use an icon without text or an accessible label.

- [ ] **Step 6: Run tests and inspect the current expected integration failure**

Run:

```bash
node --test tests/theme.test.mjs
node scripts/verify-site.mjs
```

Expected: theme tests PASS. The verifier may still fail on shared navigation links until Tasks 4–5 replace the old page markup; it must not fail due to missing CSS, modules, or screenshots.

- [ ] **Step 7: Commit the shared layer**

```bash
git add theme.mjs site.mjs site.css index.html privacy.html support.html tests/theme.test.mjs
git commit -m "feat: add shared marketing site theme"
```

### Task 4: Build the Matchcard marketing homepage

**Files:**
- Modify: `index.html`
- Modify: `site.css`

**Interfaces:**
- Consumes: shared `site.css`, `site.mjs`, `[data-theme-toggle]`, `[data-reveal]`, and the six local `assets/marketing` PNGs.
- Produces: the complete public homepage that satisfies `scripts/verify-site.mjs` and needs no JavaScript to communicate the product.
- Consumed by: final visual/accessibility verification.

- [ ] **Step 1: Make the structural verifier fail specifically for homepage content requirements**

Extend `scripts/verify-site.mjs` with these homepage assertions:

```js
const home = readFileSync('index.html', 'utf8');
assert.match(home, /<h1>Know the squad\. Cold\.<\/h1>/, 'home has the approved headline');
assert.match(home, /Ten fast questions\. One squad you can name under pressure\./, 'home has the approved supporting copy');
assert.match(home, />Coming soon</, 'home has an honest release status');
assert.match(home, /10-question rounds/, 'home includes the round fact');
assert.match(home, /Club &amp; national squads/, 'home includes the squad fact');
assert.match(home, /Fully offline/, 'home includes the offline fact');
assert.match(home, /No account\. No ads\. No data collected\./, 'home includes the trust statement');
for (const path of screenshots) assert.match(home, new RegExp(path.replace('.', '\\.')), `home references ${path}`);
```

- [ ] **Step 2: Run the verifier and confirm homepage assertions fail against the old utility page**

Run: `node scripts/verify-site.mjs`

Expected: FAIL with `home has the approved headline`.

- [ ] **Step 3: Replace the homepage body with the approved semantic structure**

Use this exact content structure, then apply classes from `site.css` rather than inlining visual values:

```html
<header class="site-header shell">
  <a class="brand" href="index.html" aria-label="Escuadra home">
    <span class="brand-mark" aria-hidden="true"></span><span>escuadra</span>
  </a>
  <nav aria-label="Utility"><a href="privacy.html">Privacy</a><a href="support.html">Support</a></nav>
  <button type="button" class="theme-toggle" data-theme-toggle aria-pressed="false">
    <span class="theme-toggle-icon" aria-hidden="true">◐</span><span data-theme-toggle-label></span>
  </button>
</header>
<main>
  <section class="hero shell" aria-labelledby="hero-title">
    <div class="hero-copy" data-reveal>
      <p class="eyebrow">Football, learned</p>
      <h1 id="hero-title">Know the squad. Cold.</h1>
      <p>Ten fast questions. One squad you can name under pressure.</p>
      <span class="release-status">Coming soon</span>
    </div>
    <div class="matchcard-number" data-reveal aria-label="Shirt number 07">07</div>
    <div class="team-band" aria-hidden="true"></div>
  </section>
  <!-- proof, facts, and trust sections follow -->
</main>
```

The proof section must use three `figure` elements. Each contains paired `img`
elements with `screen-image screen-image--dark` and `screen-image screen-image--light`
classes so CSS can show the screenshot matching `data-theme`. Give descriptive
alt text such as `Escuadra's dark question screen shows shirt number 7 and four player answers`;
the paired light image should describe the same screen in light mode. Hide the
inactive paired image with `display: none`, not opacity, so it is excluded from
the accessibility tree.

Use exactly these fact headings and concise explanatory copy:

```html
<section class="facts shell" aria-label="How Escuadra works">
  <article data-reveal><h2>10-question rounds</h2><p>Fast sessions built for repetition, not filler.</p></article>
  <article data-reveal><h2>Club &amp; national squads</h2><p>Choose the team you want to know before the next match.</p></article>
  <article data-reveal><h2>Fully offline</h2><p>Your practice stays on your phone, with no account required.</p></article>
</section>
```

Follow it with the trust statement and a shared footer that repeats Privacy,
Support, and `Coming soon`. Ensure the only page `h1` is the hero headline.

- [ ] **Step 4: Style the Matchcard hero and proof content responsively**

In `site.css`, use grid/flex layouts, `clamp()` typography, and existing semantic variables. The desktop hero may place the number beside the copy; phone screens stack them and preserve readable type. The team band must be a simple rectangular gradient/strip with no crest-like framing. Give screenshot cards a modest device-like radius, local `var(--line)` border, and `var(--shadow)`, but never render a shield shape or false phone chrome.

- [ ] **Step 5: Run automated checks and a focused local browser smoke test**

Run:

```bash
node --test tests/theme.test.mjs
node scripts/verify-site.mjs
python3 -m http.server 4173
```

Open `http://localhost:4173/` while the server runs. Verify at a 390px-wide viewport and a desktop viewport: headline wraps naturally, three screenshots are visible/readable, no horizontal scrolling occurs, the `Coming soon` status is not a link, and no team emblem appears.

- [ ] **Step 6: Commit the homepage**

```bash
git add index.html site.css scripts/verify-site.mjs
git commit -m "feat: build Escuadra marketing homepage"
```

### Task 5: Restyle Privacy and Support in the shared shell

**Files:**
- Modify: `privacy.html`
- Modify: `support.html`
- Modify: `site.css`
- Modify: `scripts/verify-site.mjs`

**Interfaces:**
- Consumes: shared header/footer classes, theme toggle hook, and semantic palette from Tasks 3–4.
- Produces: utility pages visually coherent with the homepage while preserving their legal and support copy.
- Consumed by: final verification and deployment.

- [ ] **Step 1: Add legal-page checks to the structural verifier**

Add assertions which ensure both pages have a `main` landmark, one `h1`, a
theme toggle hook, an `index.html` home link, and the key factual sentences:

```js
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
```

- [ ] **Step 2: Run the verifier and confirm it fails before the shared-shell markup is added**

Run: `node scripts/verify-site.mjs`

Expected: FAIL with `privacy.html has a main landmark` or `privacy.html has a theme toggle`.

- [ ] **Step 3: Replace each page body with the shared header, a readable legal main, and the shared footer**

Use the same brand home link, Utility navigation, and accessible toggle from
Task 4. Keep the privacy title, 10 September 2026 updated date, all four local
storage items, Crash reports section, and Children section. Keep Support’s link
to `https://github.com/tovmassian/escuadra/issues` and its explanation of when
to use it. Do not invent an email address or contact form.

Wrap long-form prose in `main class="legal-page shell"`, preserve its heading
hierarchy (`h1` then `h2`s in Privacy), and use a plain footer with links back
to the other two pages. Add `data-reveal` only to nonessential visual blocks;
legal text must never remain hidden when JavaScript is unavailable.

- [ ] **Step 4: Add focused legal-page styles without narrowing the prose into cards**

Add a `.legal-page` reading measure, quiet date styling, paragraph spacing, and
`h2` rhythm using the existing semantic variables. Match the header/footer to
the homepage, but keep the main document surface simple and comfortable to read.
Do not use a marketing hero, giant shirt number, or screenshot cards on legal pages.

- [ ] **Step 5: Run all automated checks and manually traverse navigation**

Run:

```bash
node --test tests/theme.test.mjs
node scripts/verify-site.mjs
python3 -m http.server 4173
```

Visit `/`, `/privacy.html`, and `/support.html`. Toggle the theme on the home
page, refresh, then follow both page links and confirm the explicit theme remains
selected. Reset local storage in browser DevTools, switch the operating-system or
browser-emulated colour scheme, refresh, and confirm system-following behaviour.

- [ ] **Step 6: Commit the coherent legal and support pages**

```bash
git add privacy.html support.html site.css scripts/verify-site.mjs
git commit -m "feat: unify privacy and support site shell"
```

### Task 6: Perform release-grade accessibility, motion, and deployment checks

**Files:**
- Modify only if verification exposes a concrete issue: `index.html`, `privacy.html`, `support.html`, `site.css`, `site.mjs`, `scripts/verify-site.mjs`, or `tests/theme.test.mjs`

**Interfaces:**
- Consumes: the completed static site and automated checks from Tasks 1–5.
- Produces: verified gh-pages-ready site with no unaddressed design-spec requirement.

- [ ] **Step 1: Run the complete dependency-free regression suite**

Run:

```bash
node --test tests/theme.test.mjs
node scripts/verify-site.mjs
git diff --check
```

Expected: all Node tests pass, the verifier reports three pages and six local
screenshots, and `git diff --check` is silent.

- [ ] **Step 2: Verify light, dark, and reduced-motion rendering with browser DevTools**

Serve the root with `python3 -m http.server 4173`, then test `/` at 390px and a
desktop width. In DevTools Rendering, emulate `prefers-color-scheme: light` and
`dark`, and emulate `prefers-reduced-motion: reduce`. Confirm the selected site
theme shows matching app screenshots; no animations/reveals run in reduced-motion;
and theme switching is immediate in reduced-motion mode.

- [ ] **Step 3: Perform keyboard and network checks**

Starting from the browser address bar, use Tab and Shift+Tab through header links,
theme control, content links, and footer links on all pages. Confirm every focus
target has a visible outline, the toggle has a useful accessible name and state,
and no inactive screenshot is announced. In the Network panel, confirm all page
styles, scripts, and PNGs originate from the same GitHub Pages deployment; the
only permitted external destination is the user-initiated GitHub Issues support
link.

- [ ] **Step 4: Check generated-site paths on the actual gh-pages URL before deployment**

Use the repository’s configured GitHub Pages URL, not a guessed root-domain URL.
Confirm that `/privacy.html`, `/support.html`, `site.css`, `site.mjs`, `theme.mjs`,
and every `assets/marketing/*.png` request resolves under the repository subpath.
If Pages is configured to publish the root, no additional build step is required.

- [ ] **Step 5: Commit only concrete fixes found in verification**

If a fix was required:

```bash
git add index.html privacy.html support.html site.css site.mjs theme.mjs scripts/verify-site.mjs tests/theme.test.mjs assets/marketing
git commit -m "fix: polish marketing site release checks"
```

If no fix was required, make no empty commit.
