// Captures every Escuadra screen from the web build. Default (`npm run
// shots`) writes design/screens/, for the Claude Design handoff. `--profile=
// store` (`npm run shots:store`) instead writes design/store/ at Apple's
// 6.9" App Store dimensions, and `--profile=play` (`npm run shots:play`)
// writes design/play/ at a Play-valid 1080×1920 (9:16) as JPEGs — see
// scripts/screenshot-profiles.ts for every profile's exact viewport/scale/
// format/output facts. See design/SCREENS.md for what each captured file
// shows.
//
// These are web-rendered, not device truth: safe-area insets are zero on web,
// so padding reads differently than on an iPhone. Good enough for structure
// and hierarchy, not for exact spacing.
//
// Every capture is deterministic on purpose — fixed seeds, fixed answers, a
// fixed viewport per profile — so a re-run only moves a PNG when the app
// actually changed and design can diff a capture against the previous turn's.
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { killServerTree, startExpoWeb, waitForServer } from './dev-server.mjs';
import {
  assertProfileDimensions,
  outDirFor,
  readJpegDimensions,
  readPngDimensions,
  resolveLanguageArg,
  resolveProfile,
} from './screenshot-profiles.ts';

// Mirrors LANGUAGE_NAMES in i18n/names.ts, which an .mjs cannot import: each language
// in itself, as Settings' language row shows it.
const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
};

const PORT = 8082;
const BASE = `http://localhost:${PORT}`;
const PROFILE = resolveProfile(process.argv.slice(2));
// `--lang=de` (#145) captures in one language, into `<profile dir>/de/`. The
// app reads `languagePreference` from its persisted store, so each page seeds
// it before the app loads; without the flag the app follows the browser.
const LANGUAGE = resolveLanguageArg(process.argv.slice(2));
const OUT_DIR = outDirFor(PROFILE, LANGUAGE);

// Fixed so a round is reproducible and design can diff turn against turn.
const SEED = 20260821;
// Barcelona's own first level-3 question at SEED is a goalkeeper, and the
// nationality shot wants a subject worth putting in front of design. This seed
// puts Lamine Yamal (10, FW) there instead, against four different flags. Only
// that one capture uses it, so every other screen still diffs on SEED.
const NATIONALITY_SEED = 20260832;

// How long to wait after a navigation. The root layout holds the splash until
// the persisted store has hydrated, so `networkidle` now fires before the app
// has painted anything — this window has to cover that wait plus the entry
// animation that follows it. Home's is the long pole: its letter cascade runs
// well past the 300ms per-animation budget that governs mid-round motion. The
// Results cascade (strip, strike, card rise) is the other long one, so it
// reuses this.
const SETTLE_MS = 2200;
// After answering one part, which only has to outlast that part's reveal —
// well inside the 300ms budget, so this is generous rather than tuned.
const REVEAL_MS = 500;
// After a tap that only swaps what is already on screen, like the team
// picker's Clubs/National Teams segment.
const SWAP_MS = 400;
// After opening the share sheet: its slide is 240 ms, and the card in it
// needs its fonts. `SETTLE_MS` would be a long wait for a single modal.
const SHEET_MS = 600;
// Between an answer and tapping its "next" control. Well inside the question
// screen's 1,200 ms auto-advance, so the tap always lands on this question.
const TAP_TO_NEXT_MS = 250;
// Player photos load from Wikimedia, and the stage shows the team's colours
// until one has: a shot waits for every image to finish (or this long), then
// for the photo's fade-in, so it captures the photo rather than a race.
const IMAGE_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Capture session
// ---------------------------------------------------------------------------

/**
 * One Playwright page pinned to one theme, plus the filename suffix that
 * theme's shots carry. Owning all three — page, suffix and the page-error
 * watch — is what lets the shot list below read as a short script instead of
 * threading the same arguments through every call.
 */
async function openCapture(browser, { colorScheme, suffix }) {
  const page = await browser.newPage({
    viewport: PROFILE.viewport,
    deviceScaleFactor: PROFILE.deviceScaleFactor,
    colorScheme,
  });

  // Recorded here, not thrown here: a throw inside a Playwright event handler
  // doesn't propagate through the caller's try/finally, so it would either
  // crash the process before cleanup runs or get swallowed silently. The
  // handler just records the error and `assertLive()` throws it from inside
  // normal control flow.
  let pageError = null;
  page.on('pageerror', (error) => {
    pageError = error;
  });

  if (LANGUAGE) {
    // Merged into whatever the store already holds, so a best score written
    // by an earlier round on this page survives the next navigation.
    await page.addInitScript((language) => {
      const key = 'escuadra-progress';
      let stored = null;
      try {
        stored = JSON.parse(localStorage.getItem(key) ?? 'null');
      } catch {
        stored = null;
      }
      const next = stored ?? { state: {}, version: 0 };
      next.state = { ...next.state, languagePreference: language };
      localStorage.setItem(key, JSON.stringify(next));
    }, LANGUAGE);
  }

  const ext = PROFILE.format === 'jpeg' ? 'jpg' : 'png';

  const capture = {
    page,

    /** The suffixed filename a base name is captured as. */
    file: (base) => `${base}${suffix}.${ext}`,

    /**
     * Server-rendered markup can paint fine while the client bundle is dead,
     * and a screenshot of that looks plausible with no other signal something
     * is wrong. Checking before every screenshot and every interaction means a
     * dead client fails on the first shot, not ten misleading PNGs later.
     */
    assertLive() {
      if (pageError) {
        throw new Error(
          `page error: client JS is dead, screenshots would be server-rendered only — ${pageError}`,
        );
      }
    },

    /** Navigate, wait out the entry animation, and confirm the client is alive. */
    async open(path) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(SETTLE_MS);
      capture.assertLive();
    },

    /**
     * Tap something by its visible text. `exact` is on by default so an answer
     * label can't match a longer string that happens to contain it.
     */
    async tap(text, { exact = true, wait = REVEAL_MS } = {}) {
      capture.assertLive();
      await page.getByText(text, { exact }).click();
      await page.waitForTimeout(wait);
    },

    /** Tap something by its `testID`, for controls that have no text of their own to find. */
    async tapId(testId, { wait = REVEAL_MS } = {}) {
      capture.assertLive();
      await page.getByTestId(testId).click();
      await page.waitForTimeout(wait);
    },

    /**
     * Tap the question's "next" control: the auto-next bar after a right
     * answer, or "Got it — next" after a miss. The bar moves on by itself
     * after `durations.autoAdvance` (1,200 ms), so callers tap within it.
     */
    async tapNext({ wait = REVEAL_MS } = {}) {
      capture.assertLive();
      await page.getByTestId('question-next').click();
      await page.waitForTimeout(wait);
    },

    async shoot(base) {
      capture.assertLive();
      await page
        .waitForFunction(() => [...document.images].every((image) => image.complete), null, {
          timeout: IMAGE_TIMEOUT_MS,
        })
        .catch(() => {});
      await page.waitForTimeout(REVEAL_MS);
      const filePath = `${OUT_DIR}/${capture.file(base)}`;
      await page.screenshot({
        path: filePath,
        type: PROFILE.format,
        ...(PROFILE.format === 'jpeg' ? { quality: 92 } : {}),
      });
      if (PROFILE.expectedDimensions) {
        const buffer = await readFile(filePath);
        const dims =
          PROFILE.format === 'jpeg' ? readJpegDimensions(buffer) : readPngDimensions(buffer);
        assertProfileDimensions(PROFILE, dims, filePath);
      }
      console.log(`captured ${capture.file(base)}`);
    },

    close: () => page.close(),
  };

  return capture;
}

// ---------------------------------------------------------------------------
// Level-3 third part
// ---------------------------------------------------------------------------

// The level-3 third part, captured twice — two genuinely different questions,
// not one screen shot twice. `squad.kind` decides what the last part asks: a
// nation squad asks the player's club, a club squad asks their nationality,
// and only nationality options carry flag images. Design needs to see both.
//
// `name`/`position` are the *correct* answers to that squad's first question
// at that seed. `position` is the position's data code (GK/DF/MF/FW), tapped
// by `testID`. They are seed- and data-bound on purpose: if the squad data or
// the seed moves, Playwright fails on the missing option rather than quietly
// capturing some other player's question.
const L3_THIRD_PART_SHOTS = [
  {
    file: '08-question-l3',
    path: `/play/esp/3?seed=${SEED}`,
    name: 'Robin Le Normand',
    position: 'DF',
  },
  {
    file: '08-question-l3-nationality',
    path: `/play/bar/3?seed=${NATIONALITY_SEED}`,
    name: 'Lamine Yamal',
    position: 'FW',
  },
];

/**
 * Captured mid-question, not on arrival. A level-3 question has three parts
 * and only the first is on screen when the round starts; the state worth
 * handing design is the last one, where the whole layout is in play at once —
 * the name and position slots carrying their verdicts, and the third part's
 * options still open.
 *
 * Both earlier parts must be answered *correctly*: asking stops on a wrong
 * part (invariant 7), so a wrong pick ends the question and the third part
 * never renders at all.
 */
async function captureLevel3ThirdPart(capture, shot) {
  await capture.open(shot.path);
  await capture.tap(shot.name);
  await capture.tapId(`answer-position-${shot.position}`);
  await capture.shoot(shot.file);
}

// ---------------------------------------------------------------------------
// Results, one capture per scoring tier
// ---------------------------------------------------------------------------

// Every answer below is one option label per question, in order, for the ten
// questions of `esp` level 1 at SEED. Spelling them out is what makes each
// tier reproducible: the round is deterministic under a fixed seed, so if the
// squad data or the seed moves, Playwright fails on a missing option rather
// than quietly capturing whatever round it managed to answer.

/** The correct answer to each question — a flawless round. */
const ROUND_ALL_CORRECT = [
  'Robin Le Normand',
  'Víctor Muñoz',
  'Josep Martínez',
  'Rodri',
  'Roberto Fernández',
  'Mikel Merino',
  'Aymeric Laporte',
  'Dean Huijsen',
  'Dani Olmo',
  'Iván Fresneda',
];

/** The same round with the last question deliberately missed — 9/10. */
const ROUND_ONE_MISS = [...ROUND_ALL_CORRECT.slice(0, -1), 'Dean Huijsen'];

/**
 * The first listed option of each question, which lands 1/10. This is the
 * round the failed-tier capture has always shown — it used to be produced by
 * blindly clicking the topmost option — so it stays spelled out here to keep
 * `09-results.png` from moving under an unrelated refactor.
 */
const ROUND_FIRST_OPTION = [
  'Marc Cucurella',
  'Roberto Fernández',
  'Unai Simón',
  'Dani Olmo',
  'Lamine Yamal',
  'Fermín López',
  'Robin Le Normand',
  'Iván Fresneda',
  'Álex Baena',
  'Iván Fresneda',
];

// `resultTier` splits results three ways and each way is a different screen,
// so each gets a capture: a failed round leads with the missed player cards, a
// cleared round promotes `Play level 2` and keeps the cards, and a flawless
// round shows the ten player circles instead and celebrates.
//
// `then` runs on the same page once the screen is shot, so a state reached from
// the results screen is captured without playing the round a second time. The
// failed round opens the share sheet in both formats, the passed round opens its
// photo credits, and the flawless round opens the share sheet once more on
// Image, for the picture's celebrating variant.
const RESULTS_SHOTS = [
  { file: '09-results', answers: ROUND_FIRST_OPTION, then: captureShareSheet },
  { file: '09-results-passed', answers: ROUND_ONE_MISS, then: captureCredits },
  { file: '09-results-flawless', answers: ROUND_ALL_CORRECT, then: captureShareSheetImage },
];

/**
 * Plays a level-1 round to completion, then captures the results screen it
 * lands on. Results cannot be reached by URL — the session store is
 * deliberately ephemeral, so the round has to actually be played. Level 1 asks
 * a single part per question, so each question is one answer tap plus its
 * next control.
 */
async function captureResults(capture, { file, answers, then }) {
  const path = `/play/esp/1?seed=${SEED}`;
  await capture.open(path);

  for (const label of answers) {
    // Short wait: a right answer moves on by itself after 1,200 ms, so the
    // next control is tapped well within it.
    await capture.tap(label, { wait: TAP_TO_NEXT_MS });
    await capture.tapNext();
  }

  if (!capture.page.url().includes('/results')) {
    throw new Error(
      `answered all ${answers.length} questions of ${path} but never landed on /results — ` +
        `the answer labels above no longer match the round this seed builds`,
    );
  }
  // The long pole is the round strip, the strike and the card rise.
  await capture.page.waitForTimeout(SETTLE_MS);
  await capture.shoot(file);
  await then?.(capture);
}

/**
 * The share sheet over the results screen, once on its Image tab (the default)
 * and once on Text. The picture's squares and the message's bubble both come
 * from the round just shot.
 */
async function captureShareSheet(capture) {
  await capture.tapId('results-share', { wait: SHEET_MS });
  await capture.shoot('09-results-share');
  await capture.tapId('share-format-text', { wait: SWAP_MS });
  await capture.shoot('09-results-share-text');
}

/**
 * The photo credits sheet over the passed round's results: every photo the
 * round showed, credited, in a sheet as tall as the list.
 */
async function captureCredits(capture) {
  await capture.tapId('photo-credits', { wait: SHEET_MS });
  await capture.shoot('09-results-credits');
}

/**
 * The share sheet on its Image tab after a flawless round: the picture's
 * a la escuadra variant, with the strike's ball and trail and every square
 * green.
 */
async function captureShareSheetImage(capture) {
  await capture.tapId('results-share', { wait: SHEET_MS });
  await capture.shoot('09-results-share-flawless');
}

// ---------------------------------------------------------------------------
// Study, in its three states
// ---------------------------------------------------------------------------

/**
 * Study as cards (the default), as a list and with Hide names on. The chosen
 * view is persisted in the page's storage, so the shots run in an order that
 * starts each from the state it needs: the cards on a fresh page, the list
 * after one tap of the view toggle, then back to cards for Hide names. Hide
 * names itself is not persisted.
 */
async function captureStudy(capture) {
  await capture.open('/team/int/study');
  await capture.shoot('05-study');

  await capture.tapId('study-view-toggle', { wait: SWAP_MS });
  await capture.shoot('05-study-list');

  await capture.tapId('study-view-toggle', { wait: SWAP_MS });
  await capture.tapId('study-hide-names', { wait: SWAP_MS });
  await capture.shoot('05-study-hidden');
}

// ---------------------------------------------------------------------------
// A full pass
// ---------------------------------------------------------------------------

/**
 * Every screen, in one theme. The order matters in one place: the rounds run
 * last, because finishing one writes a best score to the persisted progress
 * store, which would otherwise surface as a `BEST n/10` sub-line on the team
 * picker and difficulty captures.
 */
async function captureTheme(browser, colorScheme, suffix) {
  const capture = await openCapture(browser, { colorScheme, suffix });

  try {
    // Settings (#175): Home's gear opens it, the language lives there. The `--lang`
    // check runs first, on Settings' language row, so a capture whose language did
    // not take fails before any shot is written.
    if (LANGUAGE) {
      await capture.open('/settings');
      const value = await capture.page.getByTestId('settings-language-value').innerText();
      if (value.trim() !== LANGUAGE_NAMES[LANGUAGE]) {
        throw new Error(`--lang=${LANGUAGE}: Settings' language row says "${value}"`);
      }
    }

    await capture.open('/');
    await capture.shoot('01-home');

    await capture.open('/settings');
    await capture.shoot('01c-settings');
    // The page's ScrollView is the one scrollable element taller than its box. Set
    // `scrollTop`: react-native-web replaces the node's `scrollTo` with one that takes an
    // object, so `scrollTo(0, y)` silently does nothing.
    await capture.page.evaluate(() => {
      for (const node of document.querySelectorAll('*')) {
        const { overflowY } = getComputedStyle(node);
        if (
          (overflowY === 'auto' || overflowY === 'scroll') &&
          node.scrollHeight > node.clientHeight
        ) {
          node.scrollTop = node.scrollHeight;
        }
      }
    });
    await capture.shoot('01c-settings-end');
    await capture.tapId('settings-language', { wait: SHEET_MS });
    await capture.shoot('01c-settings-language');

    await capture.open('/about');
    await capture.shoot('01a-about');
    await capture.tapId('about-licences', { wait: SHEET_MS });
    await capture.shoot('01a-about-licences');

    await capture.open('/team-picker');
    await capture.shoot('02-team-picker-clubs');
    // Same screen, other segment — a tap rather than a second navigation.
    await capture.tapId('segment-nation', { wait: SWAP_MS });
    await capture.shoot('03-team-picker-nations');

    await capture.open('/team/rma/difficulty');
    await capture.shoot('04-difficulty');

    await captureStudy(capture);

    await capture.open(`/play/esp/1?seed=${SEED}`);
    await capture.shoot('06-question-l1');

    await capture.open(`/play/esp/2?seed=${SEED}`);
    await capture.shoot('07-question-l2');

    for (const shot of L3_THIRD_PART_SHOTS) {
      await captureLevel3ThirdPart(capture, shot);
    }

    for (const shot of RESULTS_SHOTS) {
      await captureResults(capture, shot);
    }
  } finally {
    await capture.close();
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const server = startExpoWeb(PORT);

let browser;
try {
  await mkdir(OUT_DIR, { recursive: true });
  await waitForServer(BASE);

  browser = await chromium.launch();

  // Both themes, because both ship. The app's theme preference defaults to
  // 'system', which on web reads `prefers-color-scheme` — so emulating the
  // scheme is enough to drive the whole palette, with nothing to seed into
  // storage. Dark keeps the unsuffixed filenames: it is still the app's
  // default identity, and stable names let the design side diff a capture
  // against the previous turn's.
  await captureTheme(browser, 'dark', '');
  await captureTheme(browser, 'light', '-light');
} finally {
  await browser?.close();
  killServerTree(server);
}
