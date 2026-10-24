// Generates the two Play Store listing assets that don't fit the
// multi-screen capture pipeline (see capture-screens.mjs / `npm run
// shots:play` for phone screenshots): the 512×512 app icon export and the
// 1024×500 feature graphic. `--lang=<code>` writes the graphic in one language to
// design/play/<code>/. Both are release artefacts written to
// design/play/, gitignored like design/store/ — see .gitignore.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { killServerTree, startExpoWeb, waitForServer } from './dev-server.mjs';
import { resolveLanguageArg } from './screenshot-profiles.ts';
import { seedLanguage } from './seed-language.mjs';

const PORT = 8083;
const BASE = `http://localhost:${PORT}`;
const OUT_DIR = 'design/play';
// `--lang=de` renders the graphic's tagline in one language, into design/play/de/, beside
// that language's shots:play captures. Without it the app follows the browser, as before.
const LANGUAGE = resolveLanguageArg(process.argv.slice(2));
const GRAPHIC_DIR = LANGUAGE ? `${OUT_DIR}/${LANGUAGE}` : OUT_DIR;

// ---------------------------------------------------------------------------
// App icon — resize the existing 1024×1024 source to Play's required 512×512,
// 32-bit PNG with alpha. Canvas.drawImage + toDataURL, rather than a
// screenshot, so the output is an exact pixel resample of the source with no
// dependency on page layout or background compositing.
// ---------------------------------------------------------------------------

async function generateIcon(browser) {
  const source = await readFile('assets/images/icon.png');
  const dataUrl = `data:image/png;base64,${source.toString('base64')}`;
  const page = await browser.newPage();
  const resizedBase64 = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 512, 512);
    return canvas.toDataURL('image/png').split(',')[1];
  }, dataUrl);
  await page.close();

  const outPath = `${OUT_DIR}/icon-512.png`;
  await writeFile(outPath, Buffer.from(resizedBase64, 'base64'));
  console.log(`generated ${outPath}`);
}

// ---------------------------------------------------------------------------
// Feature graphic — capture the dedicated /store/feature-graphic route (see
// app/store/feature-graphic.tsx) at exactly 1024×500, as a JPEG so there is
// no ambiguity over Play's "no alpha" requirement.
// ---------------------------------------------------------------------------

async function generateFeatureGraphic(browser) {
  const page = await browser.newPage({
    viewport: { width: 512, height: 250 },
    deviceScaleFactor: 2,
  });
  if (LANGUAGE) await seedLanguage(page, LANGUAGE);
  await page.goto(`${BASE}/store/feature-graphic`, { waitUntil: 'networkidle' });
  // The launch intro (#182) plays over every route as the app opens, the graphic's
  // included: wait for the graphic, then for the intro to leave.
  const graphic = page.locator('[data-testid^="feature-graphic-"]');
  await graphic.waitFor();
  await page.getByTestId('launch-intro').waitFor({ state: 'detached' });
  if (LANGUAGE) {
    const rendered = await graphic.getAttribute('data-testid');
    if (rendered !== `feature-graphic-${LANGUAGE}`) {
      throw new Error(`--lang=${LANGUAGE}: the graphic rendered as ${rendered}`);
    }
  }
  await page.waitForTimeout(500);

  await mkdir(GRAPHIC_DIR, { recursive: true });
  const outPath = `${GRAPHIC_DIR}/feature-graphic.jpg`;
  await page.screenshot({ path: outPath, type: 'jpeg', quality: 92 });
  await page.close();
  console.log(`generated ${outPath}`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const server = startExpoWeb(PORT);

let browser;
try {
  await mkdir(OUT_DIR, { recursive: true });
  browser = await chromium.launch();

  // The icon resize needs no dev server, so it runs while Metro boots in the
  // background rather than waiting on it first.
  await generateIcon(browser);

  await waitForServer(BASE);
  await generateFeatureGraphic(browser);
} finally {
  await browser?.close();
  killServerTree(server);
}
