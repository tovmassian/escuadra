// Captures the six Escuadra screens from the web build into design/screens/,
// for the Claude Design handoff. See design/SCREENS.md.
//
// These are web-rendered, not device truth: safe-area insets are zero on web,
// so padding reads differently than on an iPhone. Good enough for structure
// and hierarchy, not for exact spacing.
import { spawn } from 'node:child_process';
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

async function shoot(page, path, file) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  // Let fonts settle and the entry animations finish. Every animation is
  // under 300ms by constraint, so 600ms is comfortably past all of them.
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${file}` });
  console.log(`captured ${file}`);
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

  await shoot(page, '/', '01-home.png');
  await shoot(page, '/team-picker', '02-team-picker-clubs.png');

  await page.getByText('National Teams').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/03-team-picker-nations.png` });
  console.log('captured 03-team-picker-nations.png');

  await shoot(page, '/team/bar/difficulty', '04-difficulty.png');
  await shoot(page, '/team/bar/study', '05-study.png');
  await shoot(page, `/play/bar/1?seed=${SEED}`, '06-question-l1.png');
  await shoot(page, `/play/bar/3?seed=${SEED}`, '07-question-l3.png');

  // Results cannot be reached by URL: the session store is deliberately
  // ephemeral, so the round has to actually be played. Answer the first
  // option each time until the router lands on /results.
  await page.goto(`${BASE}/play/bar/1?seed=${SEED}`, { waitUntil: 'networkidle' });
  for (let i = 0; i < 60; i++) {
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
  await page.screenshot({ path: `${OUT}/08-results.png` });
  console.log('captured 08-results.png');
} finally {
  await browser?.close();
  server.kill();
}
