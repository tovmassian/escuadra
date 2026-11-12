// src/share-images.mjs: draws assets/share/<language>.png, the card a shared link
// shows, with Chrome's headless screenshot. `node src/share-images.mjs`, from the
// site's root, after a change to the card or to the words it carries (Home's hero
// eyebrow and title, the release status). It records each card's hash in
// assets/share/cards.json, and tests/share.test.mjs fails when a card has changed
// since its image was drawn. CHROME names another browser binary.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TEXTS } from './build.mjs';
import { SHARE_HEIGHT, SHARE_WIDTH, cardHash, shareCard, shareImagePath } from './share.mjs';

const chrome =
  process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base = pathToFileURL(`${process.cwd()}/`).href;
const scratch = mkdtempSync(join(tmpdir(), 'escuadra-share-'));
const hashes = {};
mkdirSync('assets/share', { recursive: true });
try {
  for (const [language, text] of Object.entries(TEXTS)) {
    const card = shareCard(language, text);
    const page = join(scratch, `${language}.html`);
    writeFileSync(page, card.replace('<head>', `<head>\n    <base href="${base}" />`));
    execFileSync(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${SHARE_WIDTH},${SHARE_HEIGHT}`,
      '--virtual-time-budget=3000',
      `--screenshot=${shareImagePath(language)}`,
      pathToFileURL(page).href,
    ], { stdio: 'ignore' });
    hashes[language] = cardHash(card);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
writeFileSync('assets/share/cards.json', `${JSON.stringify(hashes, null, 2)}\n`);
