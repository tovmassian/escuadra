// Captures the six Escuadra screens from the web build into design/screens/,
// for the Claude Design handoff. See design/SCREENS.md.
//
// These are web-rendered, not device truth: safe-area insets are zero on web,
// so padding reads differently than on an iPhone. Good enough for structure
// and hierarchy, not for exact spacing.
import { spawn, spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const PORT = 8082;
const BASE = `http://localhost:${PORT}`;
const OUT = 'design/screens';
// Fixed so a round is reproducible and design can diff turn against turn.
const SEED = 20260821;
const VIEWPORT = { width: 390, height: 844 }; // iPhone 14 logical size

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

async function shoot(page, path, file, pageErrorRef) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  // Let fonts settle and the entry animations finish. Every animation is
  // under 300ms by constraint, so 600ms is comfortably past all of them.
  await page.waitForTimeout(600);
  assertNoPageError(pageErrorRef);
  await page.screenshot({ path: `${OUT}/${file}` });
  console.log(`captured ${file}`);
}

// Server-rendered markup can paint fine while the client bundle is dead —
// exactly the class of bug this branch had to fix — so shoot() would happily
// screenshot the SSR-only output for every shot with no other signal
// something is wrong. Check this after navigation/settle and before each
// screenshot so a dead client fails on the first shot, not seven misleading
// PNGs later when the results loop needs live JS to click through and finds
// nothing responds.
function assertNoPageError(pageErrorRef) {
  if (pageErrorRef.error) {
    throw new Error(
      `page error: client JS is dead, screenshots would be server-rendered only — ${pageErrorRef.error}`,
    );
  }
}

const server = spawn('npx', ['expo', 'start', '--web', '--port', String(PORT)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, BROWSER: 'none', CI: '1' },
});

let browser;
try {
  await mkdir(OUT, { recursive: true });
  await waitForServer();

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });

  // Recorded here, not thrown here: a throw inside a Playwright event
  // handler doesn't propagate through this function's try/finally, so it
  // would either crash the process before cleanup runs or get swallowed
  // silently. Instead the handler just records the error, and
  // assertNoPageError() throws it from inside the normal control flow at
  // each checkpoint below.
  const pageErrorRef = { error: null };
  page.on('pageerror', (error) => {
    pageErrorRef.error = error;
  });

  await shoot(page, '/', '01-home.png', pageErrorRef);
  await shoot(page, '/team-picker', '02-team-picker-clubs.png', pageErrorRef);

  await page.getByText('National Teams').click();
  await page.waitForTimeout(400);
  assertNoPageError(pageErrorRef);
  await page.screenshot({ path: `${OUT}/03-team-picker-nations.png` });
  console.log('captured 03-team-picker-nations.png');

  await shoot(page, '/team/bar/difficulty', '04-difficulty.png', pageErrorRef);
  await shoot(page, '/team/bar/study', '05-study.png', pageErrorRef);
  await shoot(page, `/play/bar/1?seed=${SEED}`, '06-question-l1.png', pageErrorRef);
  await shoot(page, `/play/bar/3?seed=${SEED}`, '07-question-l3.png', pageErrorRef);

  // Results cannot be reached by URL: the session store is deliberately
  // ephemeral, so the round has to actually be played. Answer the first
  // option each time until the router lands on /results.
  await page.goto(`${BASE}/play/bar/1?seed=${SEED}`, { waitUntil: 'networkidle' });
  for (let i = 0; i < 60; i++) {
    assertNoPageError(pageErrorRef);
    if (page.url().includes('/results')) break;
    const next = page.getByTestId('app-button').first();
    // The footer button is present but disabled ("Select an answer") before
    // a part is answered — isVisible() alone is true even while disabled,
    // so check enabled state too or the loop clicks a no-op forever.
    if (
      (await next.isVisible().catch(() => false)) &&
      (await next.isEnabled().catch(() => false))
    ) {
      await next.click();
    } else {
      const option = page.getByTestId('answer-option').first();
      if (!(await option.isVisible().catch(() => false))) break;
      await option.click();
    }
    await page.waitForTimeout(250);
  }
  if (!page.url().includes('/results')) {
    throw new Error('never reached the results screen — check the testIDs from Step 2');
  }
  await page.waitForTimeout(600);
  assertNoPageError(pageErrorRef);
  await page.screenshot({ path: `${OUT}/08-results.png` });
  console.log('captured 08-results.png');
} finally {
  await browser?.close();
  killServerTree(server);
}
