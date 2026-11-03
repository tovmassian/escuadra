# The site in five languages: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home and Support in English, Spanish, French, Italian and German, generated
from one template and one text file per language, with a smooth redirect to the
visitor's language (#280).

**Architecture:** A dependency-free Node generator in `src/` turns the template
(`src/home.mjs`, `src/support.mjs`, `src/layout.mjs`) and the text files
(`src/text/<lang>.mjs`) into `index.html` and `support.html` at the root (English) and in
`es/`, `fr/`, `it/` and `de/`. The generated pages are committed and served as they are.
`tests/build.test.mjs` fails when a page on disk differs from what the generator renders.
The teaser's words travel inside each page as a JSON block, so `quiz.mjs` stays pure and
each visitor downloads one language. An inline script at the top of the English pages
sends a visitor whose browser prefers Spanish, French, Italian or German to their language
before anything is painted, unless they picked a language on the site.

**Tech Stack:** Plain HTML, CSS and ES modules; Node 24 (`node --test`) for the
generator and the tests; Playwright from `main`'s `node_modules`, for the layout check
only (never a dependency of this branch).

**Spec:** `docs/superpowers/specs/2026-11-02-site-2-0-design.md` and issue #280's body.

## Global Constraints

- The branch is `gh-pages`, worked on in `.claude/worktrees/280-site-five-languages` on
  `docs/280-site-five-languages`. No `package.json`, no dependency, no build step at
  serve time. The check is `node --test tests/*.test.mjs`, run from the worktree root.
- `$S` is the session's scratch folder for this issue, never committed.
- Languages and their folders: `en` at the root, `es/`, `fr/`, `it/`, `de/`. The order
  everywhere is `en, es, fr, it, de`.
- Site URL: `https://tovmassian.github.io/escuadra/`. App Store link:
  `https://apps.apple.com/app/escuadra/id6810705505` (no `/us/`). Play link:
  `https://play.google.com/store/apps/details?id=com.tovmassian.escuadra`.
- **Never edit `privacy/2/` or `privacy.html`.** They are generated on `main` and published
  policy. `site.css` must keep the class names they use: `site-header`, `brand`,
  `brand-mark`, `theme-toggle`, `legal-page`, `language-nav`, `updated`, `applies`,
  `site-footer`.
- Guardrail 1: player photos stay Wikimedia thumbnails, hotlinked and credited; no visible
  text names a teaser player in its credit or carries a Commons file name.
- Guardrail 2: store badges are Apple's and Google's official artwork for that language,
  unmodified, never recoloured, greyed, faded, cropped or set inside a sentence, both at
  the one `.badge` height, black App Store badge first. Their trademark credit lines stay
  in English on every page (as the trademark holders publish them), marked `lang="en"` on
  translated pages.
- Guardrail 5 spirit: no new colour, spacing or font size outside `site.css`'s existing
  custom properties; reuse the `.theme-toggle` and `.language-nav` looks.
- _Escuadra_ and _a la escuadra_ are never translated. Club names are never translated;
  nations use the app's country names (`i18n/countries.ts` on `main`).
- Reused strings come word for word from `main`: `store/listing/<lang>.md` and
  `i18n/<lang>.ts`, `i18n/countries.ts`. French follows France usage.
- Every user-visible text goes through native-language expert review until a round comes
  back clean; a change of meaning goes to the owner.
- Motion: nothing new animates longer than 300 ms; Reduce Motion stills anything new.

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/build.mjs` | `renderSite()` → `Map<path, html>`; run as a script, writes the pages |
| `src/layout.mjs` | Shared pieces: head scripts, alternates, the redirect, header actions, language menu, badges, paths |
| `src/home.mjs` | Home's template: `home(page) → html` |
| `src/support.mjs` | Support's template: `support(page) → html` |
| `src/text/{en,es,fr,it,de}.mjs` | Each language's words; `en.mjs` is the source |
| `src/text/fresh.mjs` | The headline keys that are written afresh per language, not translated |
| `language.mjs` | Served: `LANGUAGES`, `LANGUAGE_STORAGE_KEY`, `resolveSiteLanguage()` |
| `quiz.mjs` | Served, pure: the round, and its words through `fill()` |
| `site.mjs` | Served: theme, reveals, teaser, language menu |
| `es/`, `fr/`, `it/`, `de/` | Generated `index.html` and `support.html` |
| `assets/badges/<lang>/` | The official localized badges; `assets/badges/README.md` names their sources |
| `tests/build.test.mjs` | Pages are up to date; text files match `en.mjs`'s shape |
| `tests/language.test.mjs` | `resolveSiteLanguage()` |
| `tests/quiz.test.mjs`, `tests/verify-site.test.mjs` | Existing, extended to every language |

A page object passes through every template: `{ language: 'es', text, root: '../' }`
(`root` is `''` for English).

---

### Task 1: The generator, with English rendered from the template

The English pages come out of the generator with the same content as today; only
whitespace inside text may change.

**Files:**
- Create: `src/build.mjs`, `src/layout.mjs`, `src/home.mjs`, `src/support.mjs`, `src/text/en.mjs`, `tests/build.test.mjs`
- Modify (regenerated): `index.html`, `support.html`

**Interfaces:**
- Produces: `renderSite(): Map<string, string>`; `TEXTS: Record<string, object>`;
  `folderOf(language): string`; `fill(template, values): string` (in `quiz.mjs`, Task 2;
  Task 1 has its own copy in `layout.mjs` and Task 2 replaces it with an import);
  `themeScript(): string` in `layout.mjs`; text shape below.

- [ ] **Step 1: Keep today's pages for comparison**

```bash
S="<the session's scratch folder>"
mkdir -p $S && git show HEAD:index.html > $S/index.before.html && git show HEAD:support.html > $S/support.before.html
```

- [ ] **Step 2: Write the failing up-to-date test**

`tests/build.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderSite } from '../src/build.mjs';

test('every generated page on disk is what the generator renders: run `node src/build.mjs`', () => {
  for (const [path, html] of renderSite()) {
    assert.equal(readFileSync(path, 'utf8'), html, `${path} is out of date with its text file`);
  }
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `node --test tests/build.test.mjs`
Expected: FAIL, `Cannot find module '../src/build.mjs'`.

- [ ] **Step 4: Write `src/text/en.mjs`**

Every user-visible text of `index.html` and `support.html` becomes a value, with its
inner whitespace collapsed to single spaces: element text, `aria-label`, the `<title>`
and the meta description. Values are HTML fragments inserted as they are (`&amp;`,
`<br />`, `<b>`, `<span lang="es">` allowed); `{slot}`s are filled by the template.
Numbers, player names, club names, URLs, photo authors and licence names stay in the
template. Use exactly this shape and these values:

```js
// The site's English words, the source every other language follows (#280).
// Values are HTML fragments, inserted as they are; {slots} are filled by the
// template. `teaser` is plain text: site.mjs speaks and shows it.
export default {
  meta: {
    homeTitle: 'Escuadra — learn football squads by shirt number',
    homeDescription:
      'Who wears number 7? Learn every club in Europe’s top five leagues and over 150 national teams in quick rounds, then see exactly who you missed.',
    supportTitle: 'Support — Escuadra',
  },
  layout: {
    homeLabel: 'Escuadra home',
    utilityNav: 'Utility',
    footerNav: 'Footer',
    nav: {
      try: 'Try a question',
      how: 'How it works',
      squads: 'Squads',
      support: 'Support',
      privacy: 'Privacy',
      privacyPolicy: 'Privacy policy',
      privacy1x: 'Privacy policy for Escuadra 1.x',
      home: 'Home',
      report: 'Report a problem',
    },
    getApp: 'Get the app',
    theme: {
      light: 'Light',
      dark: 'Dark',
      toLight: 'Switch to light theme',
      toDark: 'Switch to dark theme',
    },
    releaseStatus: 'Now on the App Store and Google Play',
    badges: { appStore: 'Download on the App Store', googlePlay: 'Get it on Google Play' },
  },
  home: {
    hero: {
      eyebrow: 'Football squad trainer · iPhone &amp; Android',
      title: 'Know every<br />number.',
      lead: 'Who wears number 7? Learn every club in Europe’s top five leagues and over 150 national teams in quick rounds, then see exactly who you missed.',
      tryLink: 'Or try a question right here',
    },
    try: {
      eyebrow: 'Try one · Level 1',
      title: 'One number.<br />Four names.',
      body: 'This is how the app plays: a shirt number and a few clues, then you pick the player. Three questions here; ten in a round, for any squad you choose.',
      steps: [
        'Read the number and the clues: position, age, and club or nationality.',
        'Tap a name. Right or wrong, you know at once.',
        'At the end, see exactly who you missed.',
      ],
      level: 'Level 1',
      nameKey: 'Name',
      positionKey: 'Pos',
      ageKey: 'Age',
      resultEyebrow: 'Your round · 3 questions',
      playAgain: 'Play again',
    },
    credits: {
      title: 'Photo credits · 3',
      cropped: 'cropped',
      wikimedia:
        'These photos load from Wikimedia Commons, so Wikimedia receives your IP address and the details of each request, as any website does.',
    },
    how: {
      eyebrow: 'The ladder',
      title: 'Three levels.<br />Climb them squad by squad.',
      startHere: 'Start here',
      lockedSpoken: 'Locked: score 8 of 10 on level {level}',
      locked: 'Score 8/10 on L{level}',
      levels: [
        { title: 'Name from Number', body: 'Given a shirt number, pick the player from 4 options.' },
        { title: 'Name + Position', body: 'Pick the name, then the position — GK, DF, MF, or FW.' },
        {
          title: 'Full Profile',
          body: 'Name from 6 options, then position, then nationality — or club, for a national team.',
        },
      ],
      note: 'Each question is worth one point. On levels 2 and 3, you get the point only if every part is right: no partial credit.',
    },
    misses: {
      eyebrow: 'Results and Study',
      title: 'The misses are the point.',
      body: [
        'After every round, Results lays out each player you got wrong as a card to swipe through, so you can go over them before the next round.',
        'Study shows the whole squad as cards or a list. Switch on Hide names and test yourself.',
      ],
      stackLabel: 'Real Madrid · 2026/27 · Level 2 · 7/10',
      missedOf: 'Missed {n} of 3',
      missedPart: { name: 'Missed · name', position: 'Missed · position' },
    },
    squads: {
      eyebrow: 'What’s inside',
      title: 'From Arsenal<br />to Armenia.',
      stats: [
        { title: 'Clubs', body: 'Every club in Europe’s top five leagues.' },
        { title: 'National teams', body: 'From all six confederations.' },
        { title: 'Languages', body: 'English, Español, Français, Italiano and Deutsch.' },
      ],
      clubsLabel: 'Some of the clubs in Escuadra',
      nationsLabel: 'Some of the national teams in Escuadra',
      refreshed: 'Squads are refreshed each season — new teams arrive without an app update.',
    },
    share: {
      pictureLabel:
        'Escuadra’s share picture: Barcelona, 2026/27, level 1, 10 out of 10, a la escuadra. The ten shirt numbers, and “Can you name Barcelona’s squad?”',
      meta: 'Barcelona · 2026/27 · Level 1',
      question: 'Can you name Barcelona’s squad?',
      eyebrow: 'Ten out of ten',
      title: 'A flawless round has a name.',
      body: [
        'Spanish for a shot into the top corner of the goal. Go ten for ten and Escuadra says so.',
        'Then share the round as a picture or as text. No player photos, no names — friends can still play it.',
      ],
    },
    promises: {
      eyebrow: 'Made for short sessions',
      title: 'Nothing between you<br />and the squad.',
      items: [
        { title: 'No account. No ads.', body: 'Nothing to sign up for and nothing in the way. Open it and play.' },
        {
          title: 'Plays offline',
          body: 'Every squad lives on your phone. Photos load from Wikimedia Commons when you’re online; the team’s colours stand in when you’re not.',
        },
        {
          title: 'Credited photos',
          body: 'Player photos from Wikimedia Commons where one is available, each with its author and licence.',
        },
        {
          title: 'Five languages',
          body: 'English, Español, Français, Italiano and Deutsch. It follows your phone’s language, or you can pick one in Settings.',
        },
        { title: 'Light and dark', body: 'It follows your phone’s appearance, or you can choose one yourself.' },
        {
          title: 'Anonymous statistics you can switch off',
          body: 'Escuadra sends anonymous usage statistics unless you switch them off in Settings. <a href="{privacy}">The privacy policy</a> lists everything that leaves your device.',
        },
      ],
    },
    get: {
      title: 'Know the squad.<br />Cold.',
      body: 'Escuadra is on iPhone and Android.',
    },
    footer: {
      escuadraHeading: 'Escuadra',
      helpHeading: 'Help',
      affiliation:
        'Escuadra is an independent, unofficial study tool. It is not affiliated with, endorsed by, or connected to any confederation, league or competition, any national football association, any club, or the Wikimedia Foundation, and no player shown in a photo endorses it. Club, national team and confederation names are used for identification only and remain the property of their owners, as do any club marks visible in player photos.',
    },
  },
  support: {
    eyebrow: 'Support',
    title: 'Something<br />not right?',
    lead: 'A bug, a wrong shirt number, a squad you’d like added? The best place to reach the developer is GitHub Issues. Say what happened, on which phone, and with which team.',
    cta: 'Open an issue on GitHub',
    ctaNote: 'Opening an issue needs a free GitHub account.',
    kinds: [
      { title: 'Report a bug', sub: 'What you tapped, and what happened' },
      { title: 'Fix a squad', sub: 'The team, the player, the right number' },
      { title: 'Suggest a squad or a feature', sub: 'What would help you learn' },
    ],
    faqEyebrow: 'Questions',
    faqTitle: 'Before you write',
    faq: [
      {
        q: 'How do I unlock levels 2 and 3?',
        a: 'Score 8 out of 10 on level 1 to unlock level 2, and 8 out of 10 on level 2 to unlock level 3. Each team keeps its own ladder.',
      },
      {
        q: 'Why do some players have no photo?',
        a: 'Photos come from Wikimedia Commons, and only where Commons has one under a licence Escuadra can use. Without one, or offline before a photo has loaded, the question shows the team’s colours and the shirt number instead.',
      },
      {
        q: 'Does Escuadra work offline?',
        a: 'Yes. Every squad is stored on your phone, so the quiz works without a connection. Photos load from Wikimedia Commons when you’re online.',
      },
      {
        q: 'A shirt number or a player looks wrong.',
        a: 'Squads are compiled from Wikipedia and Wikidata, and each team shows when it was last updated. If something is out of date, open an issue naming the team and the player.',
      },
      {
        q: 'How do I change the language?',
        a: 'Escuadra follows your phone’s language. To pick another, open <b>Settings</b> and then <b>Language</b>: English, Español, Français, Italiano or Deutsch.',
      },
      {
        q: 'How do I switch off usage statistics?',
        a: 'Open <b>Settings</b> and switch off <b>Usage statistics</b>. About, in the app, lists everything that leaves your device, and so does the <a href="{privacy}">privacy policy</a>.',
      },
      {
        q: 'How do I start over?',
        a: 'On a team’s screen, the eraser button opens <b>Start over</b>, which sends that team back to unplayed. In Settings, <b>Clear all scores</b> does it for every team, and <b>Reset Escuadra</b> puts everything back to how it was on first launch.',
      },
    ],
  },
  countries: {
    ESP: 'Spain', ARG: 'Argentina', BRA: 'Brazil', FRA: 'France', ENG: 'England',
    JPN: 'Japan', GER: 'Germany', SEN: 'Senegal', ITA: 'Italy', MEX: 'Mexico',
    POR: 'Portugal', KOR: 'South Korea', NED: 'Netherlands', NGA: 'Nigeria',
    USA: 'United States', CRO: 'Croatia', URU: 'Uruguay', EGY: 'Egypt', COL: 'Colombia',
    AUS: 'Australia', CAN: 'Canada', GHA: 'Ghana', ARM: 'Armenia',
  },
  teaser: {
    positions: { GK: 'Keeper', DF: 'Defender', MF: 'Midfield', FW: 'Forward' },
    positionCodes: { GK: 'GK', DF: 'DF', MF: 'MF', FW: 'FW' },
    clueCodes: { club: 'Club', nat: 'Nat' },
    clueSpoken: { club: 'Club', nat: 'Nationality' },
    spoken: {
      name: 'Name: {name}.',
      beingAsked: 'being asked',
      clues: 'Position: {position}. Age: {age}. {clueLabel}: {clue}.',
      question: 'Question {n} of {total}. {team}. Who wears {number}? {clues}',
      score: 'Score: {score} of {answered}',
      result: '{score} of {total}',
    },
    whoWears: 'Who wears {number}?',
    hint: {
      tap: 'Tap your answer',
      right: 'Right. Next one coming…',
      rightLast: 'Right. Your round is next…',
    },
    next: 'Next',
    seeRound: 'See your round',
    live: {
      right: 'Right: {answer}.',
      wrong: 'Not quite. Number {number} is {answer}.',
      round: 'Your round: {score} of {total}. {title}.',
    },
    titles: { perfect: 'A la escuadra', learning: 'Still learning' },
    resultCopy: {
      perfect: 'Three for three. The app plays ten a round, across 96 clubs and 157 national teams.',
      learning:
        'Those are the ones to go over. The app plays ten questions a round, across 96 clubs and 157 national teams, and every miss waits for you on Results.',
    },
  },
};
```

Note: the theme labels and the language label are used from Task 4 on; Task 1 renders
the toggles as today (no `data-label-*`).

- [ ] **Step 5: Write `src/build.mjs`**

```js
// src/build.mjs: Home and Support in every language, from one template and one text
// file per language (#280). `node src/build.mjs`, from the site's root, writes them;
// tests/build.test.mjs fails when a page on disk differs from what this renders.
// Dependency-free, like the rest of the site.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { home } from './home.mjs';
import { support } from './support.mjs';
import en from './text/en.mjs';

export const TEXTS = { en };

/** Where a language's pages live: English at the root, the others in their folder. */
export const folderOf = (language) => (language === 'en' ? '' : `${language}/`);

export function renderSite() {
  const pages = new Map();
  for (const [language, text] of Object.entries(TEXTS)) {
    const page = { language, text, root: language === 'en' ? '' : '../' };
    pages.set(`${folderOf(language)}index.html`, home(page));
    pages.set(`${folderOf(language)}support.html`, support(page));
  }
  return pages;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [path, html] of renderSite()) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, html);
  }
}
```

- [ ] **Step 6: Write `src/layout.mjs` with the theme script**

```js
// src/layout.mjs: what every generated page shares.

/** Fills {slots}: fill('Missed {n} of 3', { n: 2 }). Task 2 moves this into quiz.mjs. */
export function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (slot, key) => (key in values ? String(values[key]) : slot));
}

/** Sets the theme before the first paint, as every page does. */
export function themeScript() {
  return `    <script>
      try {
        const saved = localStorage.getItem('escuadra-site-theme');
        const theme =
          saved === 'light' || saved === 'dark'
            ? saved
            : matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light';
        document.documentElement.dataset.theme = theme;
      } catch {
        document.documentElement.dataset.theme = matchMedia(
          '(prefers-color-scheme: dark)',
        ).matches
          ? 'dark'
          : 'light';
      }
      document.documentElement.dataset.js = 'true';
    </script>`;
}
```

- [ ] **Step 7: Write `src/home.mjs` and `src/support.mjs`**

Each exports one function returning the whole page as a template literal: today's
`index.html` / `support.html` with every text replaced by its `text` value, and
`${page.root}` before every local path (`site.css`, `site.mjs`, `assets/…`,
`support.html`, `privacy/2/`). Repeated markup is generated with `.map(...).join('')`
from the arrays: the three steps, the three rungs, the three stats, the six promises,
the three kinds, the seven FAQ items, and both marquees. The marquees keep their club
list in the template (clubs are never translated) and draw the nations from
`text.countries` in this order: `ESP ARG BRA FRA ENG JPN GER SEN ITA MEX POR KOR NED NGA
USA CRO URU EGY COL AUS CAN GHA ARM`, each twice (the second list `aria-hidden`).
`{privacy}` is filled with `${page.root}privacy/2/`. The teaser's first question stays
in the markup (it reads the same without JavaScript), filled from `QUESTIONS[0]` and
`text.teaser`: team `Spain`, number 19, `Pos` → `FW`, the clue `Club` → `Barcelona`,
`Who wears 19?`, the four options, `Tap your answer`, and its spoken line
`Name: being asked. Position: Forward. Age: 19. Club: Barcelona.`. The photo credits
are generated from `QUESTIONS` (teaser) and from a `MISS_CARDS` array in `home.mjs`
(Cucurella, Mbappé, Bellingham: number, name, position code, missed part, file, author),
in exactly the markup `tests/verify-site.test.mjs` matches today.

The beginning of `src/home.mjs`, to set the pattern:

```js
// src/home.mjs: Home's template. Text from the page's language; facts from quiz.mjs.
import { QUESTIONS, photoPage, photoSources } from '../quiz.mjs';
import { fill, themeScript } from './layout.mjs';

export function home(page) {
  const { text, root } = page;
  const t = text.home;
  return `<!doctype html>
<html lang="${page.language}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/x-icon" href="${root}assets/favicon.ico" />
    <title>${text.meta.homeTitle}</title>
    <meta
      name="description"
      content="${text.meta.homeDescription}"
    />
${themeScript()}
    ...
`;
}
```

- [ ] **Step 8: Generate, and compare with today's pages**

```bash
node src/build.mjs
norm() { tr -s ' \n\t' ' ' < "$1"; }
diff <(norm $S/index.before.html) <(norm index.html) && diff <(norm $S/support.before.html) <(norm support.html) && echo SAME
```

Expected: `SAME`. Any difference is a template mistake: fix the template, not the
comparison. (`S` as in Step 1.)

- [ ] **Step 9: Run every test**

Run: `node --test tests/*.test.mjs`
Expected: PASS, including `tests/verify-site.test.mjs` unchanged.

- [ ] **Step 10: Commit**

```bash
git add src tests/build.test.mjs index.html support.html
git commit -m "docs(site): Home and Support come from one template and an English text file (#280)"
```

---

### Task 2: The teaser speaks the page's language

**Files:**
- Modify: `quiz.mjs`, `site.mjs`, `src/layout.mjs`, `src/home.mjs`, `tests/quiz.test.mjs`, `tests/verify-site.test.mjs`
- Modify (regenerated): `index.html`

**Interfaces:**
- Consumes: `en.teaser`, `en.countries` (Task 1).
- Produces, in `quiz.mjs`: `fill(template, values)`, `teamName(item, words)`,
  `clueValue(question, words)`, `spokenClues(question, today, words)`,
  `spokenQuestion(index, today, words, questions = QUESTIONS)`. `QUESTIONS[i]` gains
  `country` (`'ESP' | 'JPN' | null`) and `clue` becomes `{ kind: 'club', value }` or
  `{ kind: 'nat', country }`. `summary().missed[i]` is `{ number, name, team, country }`.
  `POSITION_NAMES` is removed (the words carry `positions`).
- Produces, in pages: `<script type="application/json" id="site-words">` holding
  `{ root, ...text.teaser, countries: text.countries }`.

- [ ] **Step 1: Write the failing tests**

In `tests/quiz.test.mjs`, replace the imports and the first test, and add two:

```js
import en from '../src/text/en.mjs';
import {
  QUESTIONS,
  advance,
  ageOn,
  fill,
  photoPage,
  photoSources,
  pick,
  spokenQuestion,
  startRound,
  summary,
  teamName,
} from '../quiz.mjs';

const words = { ...en.teaser, countries: en.countries };

test('a question is spoken in words, never in the card’s codes', () => {
  assert.equal(
    spokenQuestion(1, new Date(2026, 10, 2), words),
    'Question 2 of 3. Arsenal. Who wears 7? Position: Forward. Age: 25. Nationality: England.',
  );
  for (const question of QUESTIONS) {
    assert.ok(words.positions[question.position], `${question.team}'s position has a spoken name`);
  }
});

test('fills slots, and leaves an unknown one as it is', () => {
  assert.equal(fill('Who wears {number}?', { number: 7 }), 'Who wears 7?');
  assert.equal(fill('{a} and {b}', { a: 1 }), '1 and {b}');
});

test('a nation is named in the page’s language, a club as it is', () => {
  const es = { countries: { ESP: 'España' } };
  assert.equal(teamName(QUESTIONS[0], es), 'España');
  assert.equal(teamName(QUESTIONS[1], es), 'Arsenal');
});
```

In the summary test, the expected `missed` entries gain `country`, e.g.
`{ number: 7, name: 'Bukayo Saka', team: 'Arsenal', country: null }`.

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/quiz.test.mjs`
Expected: FAIL, `fill` / `teamName` not exported.

- [ ] **Step 3: Change `quiz.mjs`**

The three questions: Spain gains `country: 'ESP'` and `clue: { kind: 'club', value: 'Barcelona' }`;
Arsenal `country: null` and `clue: { kind: 'nat', country: 'ENG' }`; Japan `country: 'JPN'`
and `clue: { kind: 'club', value: 'Real Sociedad' }`. Update the header comment: a team's
`country` names a nation by its FIFA code, so each page shows it in its language; a club
has none, and its name is never translated. Replace `POSITION_NAMES`, `CLUE_NAMES`,
`spokenClues` and `spokenQuestion` with:

```js
/** Fills a page's {slots}: fill('Who wears {number}?', { number: 7 }). */
export function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (slot, key) => (key in values ? String(values[key]) : slot));
}

/** A team as the page names it: a nation in the page's language, a club as it is. */
export function teamName({ team, country }, words) {
  return country ? words.countries[country] : team;
}

/** The club or nationality clue, in the page's language. */
export function clueValue({ clue }, words) {
  return clue.kind === 'nat' ? words.countries[clue.country] : clue.value;
}

/** The clues, spoken: "Position: Forward. Age: 19. Club: Barcelona." */
export function spokenClues(question, today, words) {
  return fill(words.spoken.clues, {
    position: words.positions[question.position],
    age: ageOn(question.birth, today),
    clueLabel: words.clueSpoken[question.clue.kind],
    clue: clueValue(question, words),
  });
}

/** A question as it opens: "Question 2 of 3. Arsenal. Who wears 7? Position: …" */
export function spokenQuestion(index, today, words, questions = QUESTIONS) {
  const question = questions[index];
  return fill(words.spoken.question, {
    n: index + 1,
    total: questions.length,
    team: teamName(question, words),
    number: question.number,
    clues: spokenClues(question, today, words),
  });
}
```

and in `summary`, map each miss to
`{ number: question.number, name: question.answer, team: question.team, country: question.country }`.
In `src/layout.mjs`, delete `fill` and import it from `../quiz.mjs` wherever it is used.

- [ ] **Step 4: Run the quiz tests**

Run: `node --test tests/quiz.test.mjs`
Expected: PASS.

- [ ] **Step 5: Embed the words, and let `site.mjs` read them**

In `src/layout.mjs`:

```js
/** The teaser's words for site.mjs, so each page carries only its own language. */
export function wordsScript(page) {
  const words = { root: page.root, ...page.text.teaser, countries: page.text.countries };
  const json = JSON.stringify(words).replace(/</g, '\\u003c');
  return `    <script type="application/json" id="site-words">${json}</script>`;
}
```

`src/home.mjs` puts `${wordsScript(page)}` on the line after the `site.mjs` module
script, and fills the static first question from `text.teaser` (`positionCodes`,
`clueCodes`, `whoWears`, `hint.tap`, `spoken.name` with `beingAsked` +
`spokenClues(QUESTIONS[0], new Date(), words)`, `teamName`, `clueValue`), and the
first chip's flag `src` from `${root}assets/flags/…`. The static age is today's: on a
player's birthday the up-to-date test asks for a rebuild, which is the truth.

In `site.mjs`, at the top of `initialiseQuiz()`:

```js
  const wordsBlock = document.getElementById('site-words');
  if (!card || !wordsBlock) return;
  const words = JSON.parse(wordsBlock.textContent);
```

and replace every English literal in `render()` with its word, through `fill`:
`teamName(question, words)` for the team (and `teamName(miss, words)` in the missed
list); `fill(words.spoken.score, { score, answered })`; `words.titles.perfect` /
`words.titles.learning`; `words.resultCopy.perfect` / `.learning`;
`fill(words.spoken.result, { score, total })`;
`fill(words.live.round, { score, total, title })`;
`fill(words.spoken.name, { name: state.picked === null ? words.spoken.beingAsked : question.answer }) + ' ' + spokenClues(question, today, words)`;
`words.positionCodes[question.position]`; `words.clueCodes[question.clue.kind]`;
`clueValue(question, words)`; the flag from
`question.clue.kind === 'nat' ? \`${words.root}assets/flags/${question.clue.country}.png\` : null`;
`fill(words.whoWears, { number: question.number })`; `words.hint.tap` /
`words.hint.rightLast` / `words.hint.right`; `words.seeRound` / `words.next`;
`fill(words.live.right, { answer })`; `fill(words.live.wrong, { number, answer })`;
`spokenQuestion(state.index, today, words)`. Import `fill`, `teamName`, `clueValue`
from `./quiz.mjs`.

- [ ] **Step 6: Regenerate and run every test**

Run: `node src/build.mjs && node --test tests/*.test.mjs`
Expected: PASS. If `verify-site` trips on the JSON block's URLs, it is matching
`https?://` inside JSON: there are none, so the failure is real; fix the cause.

- [ ] **Step 7: Check the teaser in a browser**

```bash
python3 -m http.server 8787 >/dev/null 2>&1 &
```

Open `http://localhost:8787/#try`, play a round with one miss, and confirm the texts,
the flag on question 2, the missed list and Play again are as before; no console errors.
Stop the server.

- [ ] **Step 8: Commit**

```bash
git add quiz.mjs site.mjs src tests index.html
git commit -m "docs(site): the teaser takes its words from the page (#280)"
```

---

### Task 3: The four translations

Data only: nothing renders these files until Task 4.

**Files:**
- Create: `src/text/es.mjs`, `src/text/fr.mjs`, `src/text/it.mjs`, `src/text/de.mjs`, `src/text/fresh.mjs`
- Modify: `tests/build.test.mjs`

**Interfaces:**
- Consumes: `en.mjs`'s shape (Task 1), plus `layout.language` added here.
- Produces: one default export per language, the same shape as `en.mjs`; `FRESH` (a
  list of key paths) from `src/text/fresh.mjs`.

- [ ] **Step 1: Add the language label and the fresh keys**

In `src/text/en.mjs`, `layout` gains `language: 'Language'` (the menu's name, Task 4)
and `languageCurrent: 'Language: {name}'` (its button's spoken name).

`src/text/fresh.mjs`:

```js
// The lines each language writes afresh rather than translates (#280): the owner
// picks them per language from reviewed drafts.
export const FRESH = [
  'home.hero.title',
  'home.try.title',
  'home.how.title',
  'home.misses.title',
  'home.squads.title',
  'home.share.title',
  'home.promises.title',
  'home.get.title',
  'support.title',
  'support.faqTitle',
];
```

- [ ] **Step 2: Write the failing shape tests**

Append to `tests/build.test.mjs`:

```js
import en from '../src/text/en.mjs';
import es from '../src/text/es.mjs';
import fr from '../src/text/fr.mjs';
import it from '../src/text/it.mjs';
import de from '../src/text/de.mjs';
import { FRESH } from '../src/text/fresh.mjs';

import * as esFile from '../src/text/es.mjs';
import * as frFile from '../src/text/fr.mjs';
import * as itFile from '../src/text/it.mjs';
import * as deFile from '../src/text/de.mjs';

const TRANSLATIONS = { es, fr, it, de };
// A text file may name the keys that are rightly the same as English in it
// (German keeps "Support"): `export const SAME_AS_ENGLISH = ['layout.nav.support']`.
const SAME_AS_ENGLISH = {
  es: esFile.SAME_AS_ENGLISH ?? [],
  fr: frFile.SAME_AS_ENGLISH ?? [],
  it: itFile.SAME_AS_ENGLISH ?? [],
  de: deFile.SAME_AS_ENGLISH ?? [],
};

/** Every leaf as [path, value]: home.try.steps.0 → 'Read the number…'. */
function leaves(value, path = []) {
  return typeof value === 'object' && value !== null
    ? Object.entries(value).flatMap(([key, child]) => leaves(child, [...path, key]))
    : [[path.join('.'), value]];
}
const slots = (value) => [...String(value).matchAll(/\{\w+\}|<[^>]+>/g)].map(([m]) => m).sort();
// Words that are the same in every language: names, numbers, codes, Escuadra's own.
const SAME_IN_ALL = /^(Escuadra|A la escuadra|Club|Nat|Name|Pos|Age|\{score\} of \{total\}|Real Madrid · 2026\/27.*|Barcelona · 2026\/27.*|[A-Z]{2,3})$/;

for (const [language, text] of Object.entries(TRANSLATIONS)) {
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
      if (SAME_AS_ENGLISH[language].includes(path)) continue;
      assert.notEqual(value, english.get(path), `${language}'s ${path} is translated`);
    }
  });

  test(`${language} writes every fresh line`, () => {
    const mine = new Map(leaves(text));
    for (const path of FRESH) assert.ok(mine.get(path), `${language} has ${path}`);
  });
}
```

`slots()` compares `{slot}`s and tags as a sorted list, so a translation may move a tag
but never drop or add one; only a fresh headline may break its lines differently.

- [ ] **Step 3: Run them to see them fail**

Run: `node --test tests/build.test.mjs`
Expected: FAIL, `Cannot find module '../src/text/es.mjs'`.

- [ ] **Step 4: Write the four text files, one language at a time**

Each starts with this header, in English:

```js
// The site's Spanish words (#280): en.mjs's shape. Reused word for word from main:
// store/listing/es.md (the promotional text, the description's sentences, the
// affiliation line), i18n/es.ts (positions and their codes, Settings' labels, level
// names, Hide names, Still learning, Who wears, Tap your answer) and i18n/countries.ts.
// The FRESH lines (fresh.mjs) are written afresh; the owner picks them.
```

Sources, read on `main` with the Read tool (in main's checkout):

| Key(s) | Source on `main` |
| --- | --- |
| `meta.homeDescription`, `home.hero.lead` | `store/listing/<lang>.md`, Promotional text |
| `home.footer.affiliation` | `store/listing/<lang>.md`, the description's affiliation sentences ("Escuadra es una herramienta de estudio independiente…" to "…fotos de los jugadores.") |
| `home.how.levels[*].title`, level bodies | `i18n/<lang>.ts`, `ladder.levels` (level 3 joins `descriptionClub` with the nation clause as en does) |
| `teaser.positions`, `teaser.positionCodes` | `i18n/<lang>.ts`, `positions`, `positionCodes` |
| `teaser.clueCodes` / `clueSpoken` | `i18n/<lang>.ts`, `slotCodes.CLUB`/`NAT` (in the site's case: first letter capital) and `slots.CLUB`/`NAT` |
| `teaser.whoWears`, `hint.tap`, `titles.learning` | `i18n/<lang>.ts`, `round.whoWears`, `round.tapYourAnswer`, `share.stillLearning` |
| `teaser.next` | `i18n/<lang>.ts`, `round.next` |
| `home.how.levels[1].body` codes | the language's `positionCodes`, as `ladder.levels.2.description` has them |
| Settings' names in `support.faq` (Settings, Language, Usage statistics, Start over, Clear all scores, Reset Escuadra), About, Results, Study, Hide names | `i18n/<lang>.ts`: `settings`, `about`, `results`, `study` titles and rows (Spanish: "Ajustes", "Plantilla", "Sin nombres", "Info"…) |
| `home.credits.cropped`, `credits.title` | `i18n/<lang>.ts`, `credits.cropped`, `credits.button(3)` |
| `share.question` | `i18n/<lang>.ts`, `share.question('Barcelona')` |
| `countries.*` | `i18n/countries.ts`, the language's block, by code |
| `layout.theme.*`, `layout.homeLabel`, `layout.utilityNav`, `layout.footerNav`, `layout.language`, `nav.privacy`, `nav.support`, `nav.home` | `privacy/2/<lang>.html` on this branch (`data-label-*`, `aria-label`s, link texts) |

Everything else is translated for a football fan on a phone, in the app's voice: short,
plain, direct (`tú`/`tu`/`du`, as the app's catalogs address the user). French follows
France usage. Keep `A la escuadra` and `Escuadra` as they are; the eyebrow of the share
section keeps _a la escuadra_ untranslated. Language names in `squads.stats[2].body`
and `promises.items[3].body` stay in their own language (`English, Español, Français,
Italiano` and the language's own "and"). `layout.badges.*` is the wording printed on
that language's official badge (Task 5 confirms it against the artwork).

For each `FRESH` key, write 2–3 options. Put the recommended one in the text file and
all of them, with a one-line note each (meaning, tone, length against the English), in
`$S/headlines/<lang>.json` as `{ "home.hero.title": [{ "text": "…", "note": "…", "recommended": true }, …] }`.
A headline has at most as many characters per line as the English one plus 35%, so it
holds at 375 px.

- [ ] **Step 5: Run the shape tests**

Run: `node --test tests/build.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/text tests/build.test.mjs
git commit -m "docs(site): Spanish, French, Italian and German text for Home and Support (#280)"
```

---

### Task 4: Five languages on the site: folders, switcher, redirect

**Files:**
- Create: `language.mjs`, `tests/language.test.mjs`
- Modify: `src/build.mjs`, `src/layout.mjs`, `src/home.mjs`, `src/support.mjs`, `site.mjs`, `site.css`, `tests/verify-site.test.mjs`
- Create (generated): `es/`, `fr/`, `it/`, `de/` (`index.html`, `support.html` each)
- Modify (regenerated): `index.html`, `support.html`

**Interfaces:**
- Consumes: `TEXTS`, `folderOf` (Task 1); the four text files (Task 3).
- Produces: `LANGUAGES`, `LANGUAGE_STORAGE_KEY`, `LANGUAGE_NAMES`,
  `resolveSiteLanguage(saved, deviceTags)` from `language.mjs`; in `layout.mjs`:
  `pageHref(page, language, file)`, `privacyHref(page)`, `alternates(page, file)`,
  `redirectScript(file)`, `languageMenu(page, file)`, `themeToggle(page)`.

- [ ] **Step 1: Write the failing language test**

`tests/language.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { LANGUAGES, resolveSiteLanguage } from '../language.mjs';

test('a language picked on the site wins', () => {
  for (const language of LANGUAGES) assert.equal(resolveSiteLanguage(language, ['de-DE']), language);
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/language.test.mjs`
Expected: FAIL, `Cannot find module '../language.mjs'`.

- [ ] **Step 3: Write `language.mjs`**

```js
// language.mjs: which language the site speaks (#280). Mirrors the app's
// resolveLanguage (i18n/resolveLanguage.ts on main): a language picked here wins,
// then the first of the browser's languages the site has, then English. The English
// pages inline resolveSiteLanguage's own source in their <head>, so it may use
// nothing from outside itself.

export const LANGUAGES = ['en', 'es', 'fr', 'it', 'de'];
export const LANGUAGE_STORAGE_KEY = 'escuadra-site-language';
/** Each language in its own words, as the privacy pages' language-nav names them. */
export const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
};

export function resolveSiteLanguage(saved, deviceTags) {
  const languages = ['en', 'es', 'fr', 'it', 'de'];
  if (languages.includes(saved)) return saved;
  for (const tag of deviceTags) {
    const code = String(tag).split(/[-_]/)[0].toLowerCase();
    if (languages.includes(code)) return code;
  }
  return 'en';
}
```

Add a test asserting the inner list equals `LANGUAGES`:
`assert.deepEqual(LANGUAGES.map((l) => resolveSiteLanguage(l, [])), LANGUAGES)` (already
covered by the first test; keep it there).

- [ ] **Step 4: Run it**

Run: `node --test tests/language.test.mjs`
Expected: PASS.

- [ ] **Step 5: Add the layout pieces**

In `src/layout.mjs`:

```js
import { LANGUAGES, LANGUAGE_NAMES, LANGUAGE_STORAGE_KEY, resolveSiteLanguage } from '../language.mjs';
import { fill } from '../quiz.mjs';

export const SITE_URL = 'https://tovmassian.github.io/escuadra/';
export const APP_STORE_URL = 'https://apps.apple.com/app/escuadra/id6810705505';
export const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.tovmassian.escuadra';

const folderOf = (language) => (language === 'en' ? '' : `${language}/`);

/** A link from this page to `file` in `language`: index.html, ../fr/support.html. */
export function pageHref(page, language, file) {
  return language === page.language ? file : `${page.root}${folderOf(language)}${file}`;
}

/** The 2.0 policy in the page's language. privacy/2/ is generated on main. */
export function privacyHref(page) {
  return `${page.root}privacy/2/${page.language === 'en' ? '' : `${page.language}.html`}`;
}

/** The public URL of `file` in `language`: the folder itself for index.html. */
const publicUrl = (language, file) =>
  `${SITE_URL}${folderOf(language)}${file === 'index.html' ? '' : file}`;

/** canonical and hreflang, as the privacy pages declare them. */
export function alternates(page, file) {
  return [
    `    <link rel="canonical" href="${publicUrl(page.language, file)}" />`,
    ...LANGUAGES.map(
      (language) =>
        `    <link rel="alternate" hreflang="${language}" href="${publicUrl(language, file)}" />`,
    ),
    `    <link rel="alternate" hreflang="x-default" href="${publicUrl('en', file)}" />`,
  ].join('\n');
}

/**
 * English pages only, first in <head>: a browser that prefers one of the other
 * languages goes there before anything is painted, unless a language was picked on
 * the site. location.replace leaves no English page in the history to go back to.
 * Crawlers and link previews run no script, so each language keeps its own page.
 */
export function redirectScript(file) {
  const target = file === 'index.html' ? '' : file;
  return `    <script>
      (function () {
        let saved = null;
        try { saved = localStorage.getItem('${LANGUAGE_STORAGE_KEY}'); } catch {}
        const language = (${resolveSiteLanguage.toString()})(saved, navigator.languages || [navigator.language || '']);
        if (language === 'en') return;
        document.documentElement.style.visibility = 'hidden';
        location.replace(language + '/${target}' + location.search + location.hash);
      })();
    </script>`;
}

export function themeToggle(page) {
  const theme = page.text.layout.theme;
  return `<button
          type="button"
          class="theme-toggle"
          data-theme-toggle
          data-label-light="${theme.light}"
          data-label-dark="${theme.dark}"
          data-label-to-light="${theme.toLight}"
          data-label-to-dark="${theme.toDark}"
        >
          <span class="theme-toggle-icon" aria-hidden="true">◐</span
          ><span data-theme-toggle-label></span>
        </button>`;
}

/** The language menu: a native disclosure, so it works without JavaScript. */
export function languageMenu(page, file) {
  const layout = page.text.layout;
  const links = LANGUAGES.map(
    (language) =>
      `<a href="${pageHref(page, language, file)}" hreflang="${language}" lang="${language}" data-language="${language}"${
        language === page.language ? ' aria-current="page"' : ''
      }>${LANGUAGE_NAMES[language]}</a>`,
  ).join('');
  return `<details class="language-menu" data-language-menu>
          <summary aria-label="${fill(layout.languageCurrent, { name: LANGUAGE_NAMES[page.language] })}"><span aria-hidden="true">${page.language.toUpperCase()}</span></summary>
          <nav class="language-nav" aria-label="${layout.language}">${links}</nav>
        </details>`;
}
```

- [ ] **Step 6: Use them in both templates**

In `src/home.mjs` and `src/support.mjs`:
- `<html lang="${page.language}">`.
- In `<head>`, straight after the viewport meta: `${page.language === 'en' ? redirectScript(file) + '\n' : ''}`
  with `file` `'index.html'` / `'support.html'`; after `<title>` (and Home's description):
  `${alternates(page, file)}`.
- The header's actions: `languageMenu(page, file)` then `themeToggle(page)`, then (Home
  only) the Get the app pill. Support gains a `header-actions` wrapper like Home's.
- Home links: `index.html`, `support.html` stay bare (same folder); the privacy links use
  `privacyHref(page)` (and `{privacy}` is filled with it); `privacy.html` (1.x, English
  only) becomes `${root}privacy.html` with `hreflang="en"` on translated pages.
- Store links use `APP_STORE_URL` and `PLAY_URL`.
- On translated pages, the trademark credits paragraph gets `lang="en"`.

In `src/build.mjs`, import `es`, `fr`, `it`, `de` and set
`export const TEXTS = { en, es, fr, it, de };`.

- [ ] **Step 7: Style the menu**

In `site.css`, after the `.theme-toggle` rules, using only existing custom properties:

```css
/* The language menu: a disclosure the size of the theme toggle, its list a panel
   of the privacy pages' language pills. */
.language-menu {
  position: relative;
}
.language-menu summary {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--ink);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  list-style: none;
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.language-menu summary::-webkit-details-marker {
  display: none;
}
.language-menu summary:hover,
.language-menu[open] summary {
  border-color: var(--ink-2);
}
.language-menu .language-nav {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 10;
  display: grid;
  gap: 8px;
  min-width: 168px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface);
}
```

and widen the existing `.legal-page .language-nav a` rules (the pill look, its hover,
its `aria-current`) to `.language-nav a`, keeping `.legal-page .language-nav`'s own
layout rule as it is.

- [ ] **Step 8: Remember a picked language, and close the menu**

In `site.mjs`:

```js
import { LANGUAGE_STORAGE_KEY } from './language.mjs';

// A language picked here outlasts the browser's: the English pages read it before
// they redirect, so picking English stops the redirect for good.
function initialiseLanguageMenu() {
  for (const link of document.querySelectorAll('[data-language]')) {
    link.addEventListener('click', () => {
      try { localStorage.setItem(LANGUAGE_STORAGE_KEY, link.dataset.language); } catch {}
    });
  }
  const menus = [...document.querySelectorAll('[data-language-menu]')];
  document.addEventListener('click', (event) => {
    for (const menu of menus) if (!menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    for (const menu of menus) {
      if (menu.open) {
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    }
  });
}
```

and call `initialiseLanguageMenu();` after `initialiseTheme();`.

- [ ] **Step 9: Extend `tests/verify-site.test.mjs` to every language**

- Import `renderSite` from `../src/build.mjs` and `TEXTS`, and `LANGUAGES`.
- `appStoreUrl` becomes `'https://apps.apple.com/app/escuadra/id6810705505'`.
- `pages` becomes `[...renderSite().keys(), 'privacy.html', ...policyPaths]`.
- The per-page loop's policy link: generated pages link
  `` `${root}privacy/2/${lang === 'en' ? '' : `${lang}.html`}` `` where `lang` is the
  page's folder (`''` → `en`); the support link check for a generated page is
  `href="support.html"`; privacy pages keep theirs.
- A new block for every generated page:

```js
for (const path of renderSite().keys()) {
  const language = path.includes('/') ? path.split('/')[0] : 'en';
  const file = path.split('/').pop();
  const html = readFileSync(path, 'utf8');
  assert.match(html, new RegExp(`<html lang="${language}"`), `${path} declares its language`);
  for (const other of LANGUAGES) {
    const url = `${siteUrl}${other === 'en' ? '' : `${other}/`}${file === 'index.html' ? '' : file}`;
    assert.ok(html.includes(`hreflang="${other}" href="${url}"`), `${path} declares its ${other} alternate`);
  }
  assert.equal((html.match(/data-language="/g) ?? []).length, LANGUAGES.length, `${path} offers every language`);
  assert.match(html, new RegExp(`data-language="${language}" aria-current="page"`), `${path} marks its own language`);
  assert.equal(html.includes('location.replace'), language === 'en', `only the English ${file} redirects`);
  for (const label of ['light', 'dark', 'to-light', 'to-dark']) {
    assert.match(html, new RegExp(`data-label-${label}="[^"]+"`), `${path} labels its theme toggle`);
  }
  assert.equal((html.match(/<main/g) ?? []).length, 1, `${path} has one main landmark`);
  assert.equal((html.match(/<h1/g) ?? []).length, 1, `${path} has exactly one h1`);
  assert.match(html, />[^<]*(App Store)[^<]*Google Play</, `${path} has its release status`);
}
```

- The Home-only block (headline pins to the end) runs for every Home:
  `for (const path of [...renderSite().keys()].filter((p) => p.endsWith('index.html')))`,
  reading `home` from `path` and its `text` from `TEXTS[language]`. The English word pins
  (approved headline, promotional text, last call, "Escuadra sends anonymous usage
  statistics…", "where one is available", the affiliation line) stay as they are under
  `if (language === 'en')`; for every language they become
  `assert.ok(home.includes(text.home.hero.title))`-style pins on the same keys
  (`home.hero.title`, `home.hero.lead`, `home.get.title`, the statistics promise's body
  up to its link, `home.promises.items[2].body`, `home.footer.affiliation`). The badge,
  trademark-credit, photo-credit, file-name and teaser-credit checks run unchanged for
  every Home, with the teaser credits' team written `teamName(question, words)`, where
  `words = { countries: text.countries }`.

- [ ] **Step 10: Generate and run every test**

Run: `node src/build.mjs && node --test tests/*.test.mjs`
Expected: PASS. Badges on translated pages are still the English files; Task 5 changes
them and the badge test.

- [ ] **Step 11: Check the redirect in a browser**

With the server from Task 2 running, in Chrome: with the browser's language list
starting with Spanish, open `http://localhost:8787/`; it lands on `/es/` with no English
flash. Open the language menu, choose English: `/` stays English on reload. Choose
Français: `/` goes to `/fr/`. Clear the site's storage afterwards. (Task 8 automates this.)

- [ ] **Step 12: Commit**

```bash
git add language.mjs site.mjs site.css src tests index.html support.html es fr it de
git commit -m "docs(site): Home and Support in five languages, with a language menu and a redirect to the browser's language (#280)"
```

---

### Task 5: The official badges in each language

The owner approved downloading them (2026-11-03). Official sources only; never a
community copy, never a PNG cropped or scaled to fit.

**Files:**
- Create: `assets/badges/{es,fr,it,de}/app-store-badge-black.svg`, `assets/badges/{es,fr,it,de}/google-play-badge.svg`, `assets/badges/README.md`
- Modify: `src/layout.mjs` (or wherever the badges are drawn), `src/text/{es,fr,it,de}.mjs` (`layout.badges`), `tests/verify-site.test.mjs`

- [ ] **Step 1: Apple's badges**

```bash
for pair in es:es-es fr:fr-fr it:it-it de:de-de; do
  lang=${pair%%:*}; locale=${pair#*:}; mkdir -p assets/badges/$lang
  curl -fsSL "https://toolbox.marketingtools.apple.com/api/v2/badges/download-on-the-app-store/black/$locale" \
    -o assets/badges/$lang/app-store-badge-black.svg
  head -c 200 assets/badges/$lang/app-store-badge-black.svg; echo
done
```

Expected: each file starts with `<svg`.

- [ ] **Step 2: Google's badges**

Fetch `https://partnermarketinghub.withgoogle.com/brands/google-play/google-play/lockups-icons-badges/`
(it carries a signed, 24-hour link to the "Get it on Google Play" badge set, folder
65627). Download the set into `$S/play-badges/` (its own empty folder), unpack it, and
copy each language's **SVG** "Get it on Google Play" badge to
`assets/badges/<lang>/google-play-badge.svg` unchanged, using the same variant (black,
no padding) as today's English `assets/badges/google-play-badge.svg`
(`viewBox="0 0 238.96 70.87"`; the localized ones differ in width). **If the set has no
SVG, or no padding-free version, for a language: stop and report to the owner.** Don't
substitute a PNG.

- [ ] **Step 3: Read each badge's words**

Render each badge to PNG (Chrome, or Playwright) and read its printed words. Put them,
exactly, into that language's `layout.badges.appStore` / `.googlePlay` (the link's
accessible name must contain the visible words: label in name).

- [ ] **Step 4: Name the sources**

`assets/badges/README.md`:

```markdown
# Store badges

Apple's "Download on the App Store" badge (black) and Google's "Get it on Google Play"
badge, unmodified, one folder per language (English at this folder's root). Used only
as the stores' guidelines allow: linked to Escuadra's live listing, the App Store badge
first and black, both at the one `.badge` height, never recoloured, faded or set inside
a sentence, with Apple's and Google's credit lines in each page's footer, in English.

- Apple: https://toolbox.marketingtools.apple.com (`download-on-the-app-store/black/<locale>`),
  downloaded 2026-11-03 for es-es, fr-fr, it-it, de-de.
- Google: https://partnermarketinghub.withgoogle.com/brands/google-play/google-play/lockups-icons-badges/
  ("Get it on Google Play" badges), downloaded 2026-11-03.
```

- [ ] **Step 5: Draw each page's own badges, and test them**

The badges' `src` is `${root}assets/badges/${language === 'en' ? '' : `${language}/`}<file>`.
In `tests/verify-site.test.mjs`, the badge pair is built per Home from its language:
`label` from `TEXTS[language].layout.badges`, `src` as above (relative to the page),
`href` from the constants. Add, for every language folder:
`assert.ok(existsSync('assets/badges/README.md'))` and that each of the two files exists
and starts with `<svg`.

- [ ] **Step 6: Generate, run every test, look at the badges**

Run: `node src/build.mjs && node --test tests/*.test.mjs`
Expected: PASS. Open `/es/#get` at 375 px and 1440 px: both badges the same height,
App Store first.

- [ ] **Step 7: Commit**

```bash
git add assets/badges src tests es fr it de
git commit -m "docs(site): Apple's and Google's official badges in Spanish, French, Italian and German (#280)"
```

---

### Task 6: Native-language review, until a round is clean

**Files:**
- Modify: `src/text/{es,fr,it,de}.mjs`, and `$S/headlines/<lang>.json` when a fresh option changes
- Modify (regenerated): `es/`, `fr/`, `it/`, `de/`

- [ ] **Step 1: One fresh reviewer per language, per round**

For each language, dispatch a new subagent (never one that drafted or reviewed before)
as a native-speaker copy editor for that market (French: France). Give it: the English
and the target text file side by side (`src/text/en.mjs`, `src/text/<lang>.mjs`), the
rendered page paths (`<lang>/index.html`, `<lang>/support.html`), `$S/headlines/<lang>.json`,
and this brief:

> Review the Spanish words of Escuadra's website (a football squad memorisation app)
> against the English, as a native Spanish copy editor writing for football fans on
> phones. Report every error of grammar, spelling, punctuation (incl. ¿¡, «» or “”, as
> the app's catalog uses), register (the app says tú), idiom, football terminology and
> consistency with the app's own words. Strings marked as reused from the app or the
> store listing were already approved: report one only for a real error. For each
> finding: key, current text, proposed text, why, and whether it changes the meaning.
> Also rate each headline option in the JSON. If you find nothing, say "CLEAN".

- [ ] **Step 2: Apply, regenerate, repeat**

Apply every finding that does not change the meaning; collect the ones that do for the
owner (Task 7's sheet). Run `node src/build.mjs && node --test tests/*.test.mjs`, then a
new reviewer for the next round. Stop a language when a round returns CLEAN. Record
each round (language, round, findings count, CLEAN) in `$S/review-log.md` for the PR.

- [ ] **Step 3: Commit after each language comes back clean**

```bash
git add src/text es fr it de
git commit -m "docs(site): the <language> text after native review (#280)"
```

---

### Task 7: The owner picks the headlines

- [ ] **Step 1: Build the sheet**

One private page (an Artifact) with, per fresh key: the English, then per language its
reviewed options with notes, the recommended one marked; and a section for any
meaning-changing review findings, each with its options. Show each option as it sets in
the display face at 375 px (`Archivo ExtraCondensed`, the page's headline size), so
length is visible.

- [ ] **Step 2: Ask, then apply**

Ask the owner to pick (unmarked rows keep the recommendation). Put the picks into the
text files, regenerate, run every test. A pick that was not an option the reviewer saw
goes through one more review round (Task 6) for that language.

- [ ] **Step 3: Commit**

```bash
git add src/text es fr it de
git commit -m "docs(site): the owner's headlines in each language (#280)"
```

---

### Task 8: Every page at 375 and 1440 px, dark and light

**Files:**
- Create (scratch, not committed): `$S/layout-check.mjs`

- [ ] **Step 1: Write the check**

```js
// Layout check for #280: every generated page at 375 and 1440 px, light and dark.
// Playwright comes from main's node_modules; this branch has no dependencies.
import { chromium } from '<main's node_modules>/playwright/index.mjs';

const BASE = 'http://localhost:8787/';
const OUT = process.argv[2];
const pages = ['', 'support.html'];
const languages = ['en', 'es', 'fr', 'it', 'de'];
const failures = [];
const browser = await chromium.launch();

for (const language of languages) {
  for (const file of pages) {
    for (const width of [375, 1440]) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'en-US' });
        await context.addInitScript(([t, l]) => {
          localStorage.setItem('escuadra-site-theme', t);
          localStorage.setItem('escuadra-site-language', l);
        }, [theme, language]);
        const page = await context.newPage();
        const errors = [];
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
        page.on('pageerror', (e) => errors.push(String(e)));
        const url = `${BASE}${language === 'en' ? '' : `${language}/`}${file}`;
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (overflow > 0) failures.push(`${url} ${width} ${theme}: ${overflow}px sideways`);
        for (const e of errors) failures.push(`${url} ${width} ${theme}: console: ${e}`);
        await page.screenshot({ path: `${OUT}/${language}-${file || 'index'}-${width}-${theme}.png`, fullPage: true });
        await context.close();
      }
    }
  }
}

// The redirect: a Spanish browser lands on /es/; one that picked English stays.
for (const [locale, saved, expected] of [['es-ES', null, `${BASE}es/`], ['es-ES', 'en', BASE], ['ja-JP', null, BASE]]) {
  const context = await browser.newContext({ locale });
  if (saved) await context.addInitScript((s) => localStorage.setItem('escuadra-site-language', s), saved);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  if (page.url() !== expected) failures.push(`redirect ${locale}/${saved}: ${page.url()}, expected ${expected}`);
  await context.close();
}

await browser.close();
console.log(failures.length ? failures.join('\n') : 'ALL CLEAR');
process.exit(failures.length ? 1 : 0);
```

- [ ] **Step 2: Run it**

```bash
python3 -m http.server 8787 >/dev/null 2>&1 & SERVER=$!
mkdir -p $S/shots && node $S/layout-check.mjs $S/shots; kill $SERVER
```

Expected: `ALL CLEAR`.

- [ ] **Step 3: Look at every screenshot**

Open each of the 40 PNGs with the Read tool. Look for: a headline broken mid-word or
overflowing its column, a pill or chip whose label wraps or clips, the language menu
over the brand, a stat or rung misaligned against its neighbours. A fix goes into the
text (owner-approved headlines go back to the owner) or into `site.css` with existing
custom properties (`overflow-wrap`, `hyphens: auto` with the page's `lang`). Rerun Steps
2–3 until clean, and keep the 375 px Home screenshots in each language for the PR.

- [ ] **Step 4: Commit any fixes**

```bash
git add site.css src es fr it de index.html support.html
git commit -m "docs(site): every language fits at 375 and 1440 px (#280)"
```

---

### Task 9: The spec, and the PR

**Files:**
- Modify: `docs/superpowers/specs/2026-11-02-site-2-0-design.md`

- [ ] **Step 1: Record the languages and the generator**

Replace the decision "**English only.** Five languages would put every page through
native review." with:

```markdown
- **Five languages** (#280): Home and Support in English (the root), Spanish, French,
  Italian and German (`es/`, `fr/`, `it/`, `de/`), generated by `node src/build.mjs`
  from one template (`src/home.mjs`, `src/support.mjs`, `src/layout.mjs`) and one text
  file per language (`src/text/`). Never edit a generated page; `tests/build.test.mjs`
  fails when one is out of date. Strings the app or the store listing already has come
  from `main` word for word; the headlines in `src/text/fresh.mjs` are written afresh
  per language and picked by the owner. Every language passed native review.
- **The visitor's language.** The English pages send a browser that prefers Spanish,
  French, Italian or German to its language before the first paint; a language picked
  in the header's menu wins and is remembered, so picking English stops the redirect.
  Crawlers and link previews see each language's own page (`hreflang`, canonical).
  The privacy pages, generated on main, link the English Home, which redirects.
- **Badges per language**: Apple's and Google's official artwork in each language
  (`assets/badges/README.md`), unmodified; their credit lines stay in English.
```

and add `tests/build.test.mjs` and `tests/language.test.mjs` to the Checks section.

- [ ] **Step 2: Final check**

Run: `node src/build.mjs && git status --short && node --test tests/*.test.mjs`
Expected: no page changed by the build, every test passes.

- [ ] **Step 3: Commit, push the branch, open the PR**

```bash
git add docs/superpowers
git commit -m "docs(spec): the site in five languages (#280)"
git push -u origin docs/280-site-five-languages
gh pr create --base gh-pages --title "docs(site): the site in all five of the app's languages" --body-file $S/pr-body.md
```

The PR body: `Closes #280`; what changed and how the generator works (two sentences);
the redirect and how to stop it; the review log (`$S/review-log.md`); the owner's
headline picks; the 375 px screenshots per language (uploaded to the PR); the test
output; and a note that merging publishes the site, so the merge is the owner's.
