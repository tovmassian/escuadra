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
import { assertPortFree } from './port-free.ts';
import { seedLanguage } from './seed-language.mjs';
import {
  assertProfileDimensions,
  outDirFor,
  PROFILES,
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
// The level-1 and nationality shots are in the store listing, and want a subject
// worth putting in front of a newcomer. These seeds put Lamine Yamal (19, FW) first
// in Spain's level 1, and Kylian Mbappé (10, FW) first in Real Madrid's level 3,
// against four different flags. Only those two captures use them, so every other
// screen still diffs on SEED.
const LEVEL1_SEED = 20260823;
const NATIONALITY_SEED = 20260845;

// How long to wait after a navigation. The root layout holds the splash until
// the persisted store has hydrated, so `networkidle` now fires before the app
// has painted anything — this window has to cover that wait plus the entry
// animation that follows it. The Results cascade (strip, strike, card rise) is
// the long pole.
const SETTLE_MS = 2200;
// After answering one part, which only has to outlast that part's reveal —
// well inside the 300ms budget, so this is generous rather than tuned.
const REVEAL_MS = 500;
// After a tap that only swaps what is already on screen, like the team
// picker's Clubs/Nations tabs.
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

  if (LANGUAGE) await seedLanguage(page, LANGUAGE);

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

    /**
     * Navigate, wait out the entry animation, and confirm the client is alive.
     * Each load is a new launch that replays the launch intro (#182) over the
     * screen, so wait until it has left the page too: no shot can catch it.
     */
    async open(path) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(SETTLE_MS);
      await page.getByTestId('launch-intro').waitFor({ state: 'detached' });
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
    path: `/play/rma/3?seed=${NATIONALITY_SEED}`,
    name: 'Kylian Mbappé',
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

/** The correct answer to each question of `bar` level 1 at SEED: a flawless club round. */
const BARCELONA_ALL_CORRECT = [
  'Wojciech Szczęsny',
  'Frenkie de Jong',
  'Fermín López',
  'Anthony Gordon',
  'Gabriel Jesus',
  'Pedri',
  'Jules Koundé',
  'Brian Fariñas',
  'Gerard Martín',
  'Lamine Yamal',
];

// `resultTier` splits results three ways and each way is a different screen,
// so each gets a capture: a failed round leads with the missed player cards, a
// cleared round promotes `Play level 2` and keeps the cards, and a flawless
// round shows the ten player circles instead and celebrates.
//
// `then` runs on the same page once the screen is shot, so a state reached from
// the results screen is captured without playing the round a second time. The
// failed round opens the share sheet in both formats and the passed round opens
// its photo credits. A flawless Barcelona round, whose Results are not shot,
// opens the share sheet on Image, for the picture's celebrating variant in a
// club's colours, as the store listing shows it.
const RESULTS_SHOTS = [
  { file: '09-results', answers: ROUND_FIRST_OPTION, then: captureShareSheet },
  { file: '09-results-passed', answers: ROUND_ONE_MISS, then: captureCredits },
  { file: '09-results-flawless', answers: ROUND_ALL_CORRECT },
  { squad: 'bar', answers: BARCELONA_ALL_CORRECT, then: captureShareSheetImage },
];

/**
 * Plays a level-1 round to completion, then captures the results screen it
 * lands on, when given a file. Results cannot be reached by URL — the session
 * store is deliberately ephemeral, so the round has to actually be played.
 * Level 1 asks a single part per question, so each question is one answer tap
 * plus its next control.
 */
async function captureResults(capture, { file, squad, answers, then }) {
  await playRound(capture, answers, squad);
  // The long pole is the round strip, the strike and the card rise.
  await capture.page.waitForTimeout(SETTLE_MS);
  if (file) await capture.shoot(file);
  await then?.(capture);
}

/**
 * Opens a squad's level-1 round at SEED (Spain's unless named), answers every
 * question and lands on /results.
 */
async function playRound(capture, answers, squad = 'esp') {
  const path = `/play/${squad}/1?seed=${SEED}`;
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
 * green, under the team's bands.
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

/** A squad's `lastUpdated`, from the generated manifest. */
async function squadLastUpdated(squadId) {
  const manifest = JSON.parse(
    await readFile(new URL('../data/index.json', import.meta.url), 'utf8'),
  );
  const entry = manifest.find((s) => s.id === squadId);
  if (!entry) throw new Error(`no squad ${squadId} in data/index.json`);
  return entry.lastUpdated;
}

/**
 * Merge best scores into the persisted progress store, as finished rounds would, for a
 * shot that wants a squad part way up the ladder. `scores` is keyed like the store
 * (`${squadId}:${level}`, see `scoreKey` in lib/scoring.ts); each is set on the squad as
 * of `squadUpdated` (#180), so a date other than the squad's own shows it outdated. It
 * writes localStorage only, so the next `capture.open` reloads the page and rehydrates
 * from it.
 */
async function seedBestScores(capture, scores, squadUpdated) {
  const dated = Object.fromEntries(
    Object.entries(scores).map(([key, score]) => [key, { score, squadUpdated }]),
  );
  await capture.page.evaluate((seeded) => {
    const key = 'escuadra-progress';
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(key) ?? 'null');
    } catch {
      stored = null;
    }
    // Version 1 of stores/progress.ts: dated best scores.
    const next = stored ?? { state: {}, version: 1 };
    next.state = { ...next.state, bestScores: { ...next.state.bestScores, ...seeded } };
    localStorage.setItem(key, JSON.stringify(next));
  }, dated);
}

/**
 * Scroll every scrollable element taller than its box to its end. The page's ScrollView is
 * the one that is. Set `scrollTop`: react-native-web replaces the node's `scrollTo` with one
 * that takes an object, so `scrollTo(0, y)` silently does nothing.
 */
async function scrollToEnd(capture) {
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
}

/**
 * Write the starred squads (#179) into the persisted progress store, newest
 * first, as taps on Difficulty's star would. Like `seedBestScores`, it writes
 * localStorage only, for the next `capture.open` to rehydrate.
 */
async function seedStarred(capture, squadIds) {
  await capture.page.evaluate((starred) => {
    const key = 'escuadra-progress';
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(key) ?? 'null');
    } catch {
      stored = null;
    }
    const next = stored ?? { state: {}, version: 0 };
    next.state = { ...next.state, starredSquads: starred };
    localStorage.setItem(key, JSON.stringify(next));
  }, squadIds);
}

/**
 * Mark the How to play tips (#183) skipped in the persisted progress store, as a tap on
 * Skip tips would. Like `seedStarred`, it writes localStorage only, for the next
 * `capture.open` to rehydrate.
 */
async function seedTipsSkipped(capture) {
  await capture.page.evaluate(() => {
    const key = 'escuadra-progress';
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(key) ?? 'null');
    } catch {
      stored = null;
    }
    const next = stored ?? { state: {}, version: 1 };
    next.state = { ...next.state, tipsSkipped: true };
    localStorage.setItem(key, JSON.stringify(next));
  });
}

/**
 * One screen's How to play steps (#183): open it, then shoot each step and tap Next to the
 * following one. The layer fades in over `REVEAL_MS`, which `shoot` also waits out, but
 * waiting here first keeps a slow layer from being shot half-drawn.
 */
async function captureTips(capture, path, base, steps) {
  await capture.open(path);
  await shootTipSteps(
    capture,
    Array.from({ length: steps }, (_, index) => `${base}-tip-${index + 1}`),
  );
}

/**
 * The tip layer already on screen: shoot each step under its name (a `null` name is a step
 * only tapped past) and tap Next to the following one.
 */
async function shootTipSteps(capture, names) {
  for (const [index, name] of names.entries()) {
    await capture.page.getByTestId('tips-layer').waitFor({ state: 'visible' });
    await capture.page.waitForTimeout(REVEAL_MS);
    if (name) await capture.shoot(name);
    if (index < names.length - 1) await capture.tapId('tip-next');
  }
}

/**
 * The How to play tips on the round and Results (#184). A question's tips show on the first
 * question of a level's first round, before any answer, so each is a plain open. Results'
 * show about 1.2 s after the first round ever, so the question tips are seeded seen and a
 * round is played to reach them; the seeding is repeated so Results is unseen again for the
 * passed round, whose first tip is only tapped past.
 */
async function captureRoundTips(capture) {
  // The two rounds below write Spain's best score and last-played, which the picker, Study
  // and Difficulty shots after this would show; the store is put back as it was when done.
  const progress = await readProgress(capture);
  await captureTips(capture, `/play/esp/1?seed=${SEED}`, '06b-question-l1', 2);
  await capture.open(`/play/esp/2?seed=${SEED}`);
  await shootTipSteps(capture, ['07b-question-l2-tip']);
  await capture.open(`/play/esp/3?seed=${SEED}`);
  await shootTipSteps(capture, ['08b-question-l3-tip']);

  const seen = ['picker', 'difficulty', 'study', 'question-1', 'question-2', 'question-3'];
  await seedTips(capture, { seen, skipped: false });
  await playRound(capture, ROUND_FIRST_OPTION);
  await shootTipSteps(capture, ['09b-results-tip-1', '09b-results-tip-2']);

  await seedTips(capture, { seen, skipped: false });
  await playRound(capture, ROUND_ONE_MISS);
  await shootTipSteps(capture, [null, '09c-results-tip-pass']);

  await writeProgress(capture, progress);
}

/** The persisted progress store as stored (or null), for `writeProgress` to put back. */
async function readProgress(capture) {
  return capture.page.evaluate(() => localStorage.getItem('escuadra-progress'));
}

/**
 * Put back what `readProgress` read. Like `seedStarred`, it writes localStorage only, for
 * the next `capture.open` to rehydrate.
 */
async function writeProgress(capture, stored) {
  await capture.page.evaluate((value) => {
    if (value === null) localStorage.removeItem('escuadra-progress');
    else localStorage.setItem('escuadra-progress', value);
  }, stored);
}

/**
 * Set which How to play tips (#183, #184) the persisted progress store holds as seen, and
 * whether they are skipped. Like `seedStarred`, it writes localStorage only, for the next
 * `capture.open` to rehydrate.
 */
async function seedTips(capture, { seen, skipped }) {
  await capture.page.evaluate(
    ([tipsSeen, tipsSkipped]) => {
      const key = 'escuadra-progress';
      let stored = null;
      try {
        stored = JSON.parse(localStorage.getItem(key) ?? 'null');
      } catch {
        stored = null;
      }
      const next = stored ?? { state: {}, version: 1 };
      next.state = { ...next.state, tipsSeen, tipsSkipped };
      localStorage.setItem(key, JSON.stringify(next));
    },
    [seen, skipped],
  );
}

/**
 * Set the last team and level a round was started for, as Home's Continue
 * reads it (#181). Like `seedBestScores`, it writes localStorage only, for the
 * next `capture.open` to rehydrate.
 */
async function seedLastPlayed(capture, squadId, level) {
  await capture.page.evaluate(
    ([id, lvl]) => {
      const key = 'escuadra-progress';
      let stored = null;
      try {
        stored = JSON.parse(localStorage.getItem(key) ?? 'null');
      } catch {
        stored = null;
      }
      const next = stored ?? { state: {}, version: 1 };
      next.state = { ...next.state, lastPlayed: { squadId: id, level: lvl } };
      localStorage.setItem(key, JSON.stringify(next));
    },
    [squadId, level],
  );
}

/**
 * Open Home with Reduce Motion emulated, so the number wall (#181) stands at its
 * starting offsets and the PNG diffs cleanly; then restore motion for the
 * shots after it. Reanimated reads the setting as the page loads, and
 * `capture.open` reloads the page.
 */
async function openHomeStill(capture) {
  await capture.page.emulateMedia({ reducedMotion: 'reduce' });
  await capture.open('/');
  await capture.page.emulateMedia({ reducedMotion: 'no-preference' });
}

/**
 * The launch intro's end frame (#182). Under emulated Reduce Motion it holds
 * still until `launchIntro.end` (1,200 ms) after the app is ready, so shoot as
 * soon as it shows instead of waiting out `SETTLE_MS`, which outlasts it. Not
 * through `capture.shoot`, whose image wait and settle would also outlast it,
 * and so not checked against a store's dimensions: a launch frame is not a
 * listing shot, so only the design handoff takes it.
 */
async function shootLaunchIntro(capture) {
  if (PROFILE !== PROFILES.design) return;
  await capture.page.emulateMedia({ reducedMotion: 'reduce' });
  await capture.page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await capture.page.getByTestId('launch-intro').waitFor({ state: 'visible' });
  capture.assertLive();
  const file = capture.file('00-launch-intro');
  await capture.page.screenshot({
    path: `${OUT_DIR}/${file}`,
    type: PROFILE.format,
    ...(PROFILE.format === 'jpeg' ? { quality: 92 } : {}),
  });
  // A shot that raced into the fade would be a faded frame: fail it loudly.
  const opacity = await capture.page
    .getByTestId('launch-intro')
    .evaluate((el) => getComputedStyle(el).opacity);
  if (opacity !== '1') {
    throw new Error(`00-launch-intro: the intro was fading (opacity ${opacity}) as it was shot`);
  }
  console.log(`captured ${file}`);
  await capture.page.emulateMedia({ reducedMotion: 'no-preference' });
}

// ---------------------------------------------------------------------------
// A full pass
// ---------------------------------------------------------------------------

/**
 * Every screen, in one theme. The order matters in one place: the rounds run
 * last, because finishing one writes a best score to the persisted progress
 * store, which would otherwise show on the team picker (its LEVEL n score) and
 * on Difficulty. The 04b and 04c difficulty captures seed their own scores on
 * squads no round touches.
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

    await shootLaunchIntro(capture);
    await openHomeStill(capture);
    await capture.shoot('01-home');

    // How to play (#183) shows once per screen on first open, so the tips are shot now,
    // on this fresh page, before anything else visits the picker, Difficulty or Study;
    // only for the design handoff, as a tip is not a listing shot. Then, in every
    // profile, they are marked skipped, as Skip tips would, so no later shot shows one.
    if (PROFILE === PROFILES.design) {
      await captureTips(capture, '/team-picker', '02c-team-picker', 2);
      await captureTips(capture, '/team/rma/difficulty', '04f-difficulty', 3);
      await captureTips(capture, '/team/int/study', '05b-study', 2);
      await captureRoundTips(capture);
    }
    await seedTipsSkipped(capture);

    await capture.open('/settings');
    await capture.shoot('01c-settings');
    await scrollToEnd(capture);
    await capture.shoot('01c-settings-end');
    await capture.tapId('settings-language', { wait: SHEET_MS });
    await capture.shoot('01c-settings-language');

    await capture.open('/about');
    await capture.shoot('01a-about');
    await capture.open('/licences');
    await capture.shoot('01d-licences');

    await capture.open('/team-picker');
    await capture.shoot('02-team-picker-clubs');
    // Same screen, other tab — a tap rather than a second navigation.
    await capture.tapId('kind-nation', { wait: SWAP_MS });
    await capture.shoot('03-team-picker-nations');
    // The rail's letters take no touches of their own (the rail is the target),
    // so Playwright's hit check refuses a locator click on one. Click its centre
    // with the mouse instead. S exists in every language's nation list.
    const box = await capture.page.getByTestId('rail-S').boundingBox();
    if (!box) throw new Error('the picker has no rail-S letter to jump to');
    await capture.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await capture.page.waitForTimeout(SWAP_MS);
    await capture.shoot('03b-team-picker-nations-jump');

    // A confederation picked, from a fresh open so the list starts at the top.
    await capture.open('/team-picker');
    await capture.tapId('kind-nation', { wait: SWAP_MS });
    await capture.tapId('confederation-UEFA', { wait: SWAP_MS });
    await capture.shoot('03c-team-picker-nations-uefa');

    await capture.open('/team/rma/difficulty');
    await capture.shoot('04-difficulty');

    // Seeded squads no later shot uses, so the rounds and results are unaffected.
    // Armenia's scores predate its squad's last update, so they show OUTDATED (#180).
    await seedBestScores(capture, { 'arm:1': 10, 'arm:2': 8, 'arm:3': 6 }, '2026-01-01');
    await capture.open('/team/arm/difficulty');
    await capture.shoot('04b-difficulty-nation');
    // Start over (#197): Armenia has scores, so the eraser shows. Its sheet is only opened,
    // never confirmed; the next open reloads the page and the scores stay.
    await capture.tapId('difficulty-start-over', { wait: SHEET_MS });
    await capture.shoot('04g-difficulty-start-over');

    await seedBestScores(
      capture,
      { 'liv:1': 10, 'liv:2': 9, 'liv:3': 8 },
      await squadLastUpdated('liv'),
    );
    await capture.open('/team/liv/difficulty');
    await capture.shoot('04c-difficulty-cleared');

    // Your squads (#179): Real Madrid, Barcelona and Spain starred by seed, Armenia
    // by a tap on its star, so it is the newest. The picker then shows each tab's
    // starred teams over its list, Nations with UEFA picked to show the group
    // ignores it. It opens on Nations, the newest starred team's tab (#187).
    await seedStarred(capture, ['esp', 'rma', 'bar']);
    await capture.open('/team/arm/difficulty');
    await capture.tapId('difficulty-star', { wait: SWAP_MS });
    await capture.shoot('04d-difficulty-starred');
    await capture.open('/team-picker');
    await capture.tapId('confederation-UEFA', { wait: SWAP_MS });
    await capture.shoot('03d-team-picker-nations-starred');
    await capture.tapId('kind-club', { wait: SWAP_MS });
    await capture.shoot('02b-team-picker-clubs-starred');

    // Home (#181), returning: Argentina to continue, every level cleared, so
    // Continue offers level 3 again (8/10, current), with England, Brazil and
    // Italy starred above. The store is put back once it is shot, so Argentina's
    // scores show on no later shot. Then Armenia, whose level-3 best is outdated,
    // with nothing starred, so the row is "All teams" alone. The rounds below
    // write their own last-played, so nothing later sees these.
    const progress = await readProgress(capture);
    await seedBestScores(
      capture,
      { 'arg:1': 10, 'arg:2': 9, 'arg:3': 8 },
      await squadLastUpdated('arg'),
    );
    await seedLastPlayed(capture, 'arg', 3);
    await seedStarred(capture, ['eng', 'bra', 'ita']);
    await openHomeStill(capture);
    await capture.shoot('01e-home-returning');
    await writeProgress(capture, progress);
    await seedLastPlayed(capture, 'arm', 3);
    await seedStarred(capture, []);
    await openHomeStill(capture);
    await capture.shoot('01f-home-outdated');

    // Difficulty with the squad done (#181): every level cleared and level 3 a
    // current 10/10, so the focused card is green. Arsenal's scores show on no
    // picker shot, since those ran above.
    await seedBestScores(
      capture,
      { 'ars:1': 9, 'ars:2': 8, 'ars:3': 10 },
      await squadLastUpdated('ars'),
    );
    await capture.open('/team/ars/difficulty');
    await capture.shoot('04e-difficulty-escuadra');

    // Your data (#197), with scores stored so Clear all scores shows a count. Each sheet is
    // opened and shot, never confirmed: the rounds below still see the seeded scores.
    await capture.open('/settings');
    await scrollToEnd(capture);
    await capture.shoot('01g-settings-your-data');
    await capture.tapId('settings-clear-scores', { wait: SHEET_MS });
    await capture.shoot('01h-settings-clear-scores');
    await capture.open('/settings');
    await scrollToEnd(capture);
    await capture.tapId('settings-reset', { wait: SHEET_MS });
    await capture.shoot('01i-settings-reset');

    await captureStudy(capture);

    await capture.open(`/play/esp/1?seed=${LEVEL1_SEED}`);
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

await assertPortFree(PORT);
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
