// Captures every Escuadra screen from the web build. Default (`npm run
// shots`) writes design/screens/, for the Claude Design handoff. `--profile=
// store` (`npm run shots:store`) instead writes design/store/ at Apple's
// 6.9" App Store dimensions — see scripts/screenshot-profiles.ts for both
// profiles' exact viewport/scale/output facts. See design/SCREENS.md for
// what each captured file shows.
//
// These are web-rendered, not device truth: safe-area insets are zero on web,
// so padding reads differently than on an iPhone. Good enough for structure
// and hierarchy, not for exact spacing.
//
// Every capture is deterministic on purpose — fixed seeds, fixed answers, a
// fixed viewport per profile — so a re-run only moves a PNG when the app
// actually changed and design can diff a capture against the previous turn's.
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  assertProfileDimensions,
  readPngDimensions,
  resolveProfile,
} from './screenshot-profiles.ts';

const PORT = 8082;
const BASE = `http://localhost:${PORT}`;
const PROFILE = resolveProfile(process.argv.slice(2));

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
// to roughly 1.6s once `MOTION_TIME_SCALE` is applied, far past the 300ms
// per-animation budget that governs mid-round motion. The results
// celebration cascade is the other long one, so it reuses this.
const SETTLE_MS = 2200;
// After answering one part, which only has to outlast that part's reveal —
// well inside the 300ms budget, so this is generous rather than tuned.
const REVEAL_MS = 500;
// After a tap that only swaps what is already on screen, like the team
// picker's Clubs/National Teams segment.
const SWAP_MS = 400;

// ---------------------------------------------------------------------------
// Dev server
// ---------------------------------------------------------------------------

async function waitForServer(timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Metro did not serve ${BASE} within ${timeoutMs}ms`);
}

// On Windows, spawning with `shell: true` makes the direct child a cmd.exe
// wrapper around the real `npx expo start --web` process tree. `server.kill()`
// only terminates that cmd.exe shell, leaving the Metro/expo grandchildren
// running and holding the port — the next run's waitForServer() then talks to
// the stale, orphaned server instead of a fresh one. `taskkill /T` kills the
// whole process tree rooted at the shell's PID.
function killServerTree(server) {
  if (!server.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
  } else {
    server.kill();
  }
}

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

  const capture = {
    page,

    /** The suffixed filename a base name is captured as. */
    file: (base) => `${base}${suffix}.png`,

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

    /** Tap the screen's primary button — the round's footer Continue. */
    async tapPrimaryButton({ wait = REVEAL_MS } = {}) {
      capture.assertLive();
      await page.getByTestId('app-button').first().click();
      await page.waitForTimeout(wait);
    },

    async shoot(base) {
      capture.assertLive();
      const filePath = `${PROFILE.outDir}/${capture.file(base)}`;
      await page.screenshot({ path: filePath });
      if (PROFILE.expectedDimensions) {
        assertProfileDimensions(PROFILE, readPngDimensions(await readFile(filePath)), filePath);
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
// at that seed. They are seed- and data-bound on purpose: if the squad data or
// the seed moves, Playwright fails on the missing option rather than quietly
// capturing some other player's question.
const L3_THIRD_PART_SHOTS = [
  {
    file: '08-question-l3',
    path: `/play/esp/3?seed=${SEED}`,
    name: 'Ferran Torres',
    position: 'FW',
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
 * answered name pill, greyed position chips, the part rail carrying two
 * verdicts, and the third part's options still open.
 *
 * Both earlier parts must be answered *correctly*: asking stops on a wrong
 * part (invariant 7), so a wrong pick ends the question and the third part
 * never renders at all.
 */
async function captureLevel3ThirdPart(capture, shot) {
  await capture.open(shot.path);
  await capture.tap(shot.name);
  await capture.tap(shot.position);
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
  'Ferran Torres',
  'Pedri',
  'Borja Iglesias',
  'Nico Williams',
  'Fabián Ruiz',
  'Rodri',
  'Eric García',
  'Álex Grimaldo',
  'Gavi',
  'Pedro Porro',
];

/** The same round with the last question deliberately missed — 9/10. */
const ROUND_ONE_MISS = [...ROUND_ALL_CORRECT.slice(0, -1), 'Marc Pubill'];

/**
 * The first listed option of each question, which lands 2/10. This is the
 * round the failed-tier capture has always shown — it used to be produced by
 * blindly clicking the topmost option — so it stays spelled out here to keep
 * `09-results.png` from moving under an unrelated refactor.
 */
const ROUND_FIRST_OPTION = [
  'Ferran Torres',
  'Gavi',
  'Nico Williams',
  'Mikel Oyarzabal',
  'Rodri',
  'Marcos Llorente',
  'Marc Cucurella',
  'Pau Cubarsí',
  'Gavi',
  'Marc Pubill',
];

// `resultTier` splits results three ways and each way is a different screen,
// so each gets a capture: a failed round leads with the missed list, a cleared
// round promotes `Play Level 2` while the missed list stays, and a flawless
// round drops the list entirely and celebrates.
const RESULTS_SHOTS = [
  { file: '09-results', answers: ROUND_FIRST_OPTION },
  { file: '09-results-passed', answers: ROUND_ONE_MISS },
  { file: '09-results-flawless', answers: ROUND_ALL_CORRECT },
];

/**
 * Plays a level-1 round to completion, then captures the results screen it
 * lands on. Results cannot be reached by URL — the session store is
 * deliberately ephemeral, so the round has to actually be played. Level 1 asks
 * a single part per question, so each question is one option tap plus
 * Continue (the footer button is the disabled "Select an answer" placeholder
 * until the question is scored).
 */
async function captureResults(capture, { file, answers }) {
  const path = `/play/esp/1?seed=${SEED}`;
  await capture.open(path);

  for (const label of answers) {
    await capture.tap(label);
    await capture.tapPrimaryButton();
  }

  if (!capture.page.url().includes('/results')) {
    throw new Error(
      `answered all ${answers.length} questions of ${path} but never landed on /results — ` +
        `the answer labels above no longer match the round this seed builds`,
    );
  }
  // The results celebration cascade is the longest animation in the app.
  await capture.page.waitForTimeout(SETTLE_MS);
  await capture.shoot(file);
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
    await capture.open('/');
    await capture.shoot('01-home');

    await capture.open('/team-picker');
    await capture.shoot('02-team-picker-clubs');
    // Same screen, other segment — a tap rather than a second navigation.
    await capture.tap('National Teams', { exact: false, wait: SWAP_MS });
    await capture.shoot('03-team-picker-nations');

    await capture.open('/team/rma/difficulty');
    await capture.shoot('04-difficulty');

    await capture.open('/team/int/study');
    await capture.shoot('05-study');

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

const server = spawn('npx', ['expo', 'start', '--web', '--port', String(PORT)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, BROWSER: 'none', CI: '1' },
});

let browser;
try {
  await mkdir(PROFILE.outDir, { recursive: true });
  await waitForServer();

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
