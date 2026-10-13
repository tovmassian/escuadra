// Photo POC lookup. Run locally: `node scripts/poc/fetch-photos.ts esp`.
// For each squad member: Wikipedia's free lead image for their article, then
// that file's credit from Commons. Writes data/poc/photos.<squad>.json and a
// coverage report beside it. Spec:
// docs/superpowers/specs/2026-10-13-wikimedia-photo-poc-design.md.
//
// Run it on a developer machine. Wikimedia's APIs throttle shared cloud
// egress IPs — they answered 429 to a cloud session after fewer than ten
// requests — while upload.wikimedia.org (image serving) stayed open.
import { readFileSync, readdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import type { PhotoFile } from '../../types/photo';
import type { Player, Squad } from '../../types/squad';
import { formatAndWrite } from '../../tools/squadctl/src/lib/write-json.ts';
import {
  BATCH_SIZE,
  chunk,
  creditsByFile,
  fileKey,
  leadImagesByTitle,
  renderReport,
  type CreditOutcome,
  type PlayerRow,
  type ReportRow,
} from './lib/photo-records.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
// Wikimedia policy allows refusing a generic or absent User-Agent. The
// contact is the public repository, as squadctl's is.
const USER_AGENT = 'escuadra-photo-poc/0.1 (https://github.com/tovmassian/escuadra)';
const DELAY_MS = 500;
const MAX_RETRIES = 4;
const THUMB_WIDTH = 512;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** One polite GET: a pause before every request, and exponential backoff
 *  (honouring Retry-After) on 429. */
async function getJson(url: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    await sleep(DELAY_MS);
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get('retry-after'));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.json();
  }
}

function queryUrl(base: string, params: Record<string, string>): string {
  const search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    ...params,
  });
  return `${base}?${search.toString()}`;
}

function findSquadFile(squadId: string): string {
  const dir = path.join(REPO_ROOT, 'data', 'squads');
  const match = (readdirSync(dir, { recursive: true }) as string[]).find(
    (f) => path.basename(f) === `${squadId}.json`,
  );
  if (match === undefined) throw new Error(`no squad file named ${squadId}.json under data/squads`);
  return path.join(dir, match);
}

/** Formats through squadctl's shared writer (so `npm run check` stays green),
 *  into a temp file renamed into place — a failed run never leaves a partial
 *  file behind. The temp name keeps the extension so prettier picks the parser. */
async function writeAtomically(target: string, content: string): Promise<void> {
  const ext = path.extname(target);
  const temp = `${target.slice(0, -ext.length)}.tmp${ext}`;
  await formatAndWrite(temp, content);
  renameSync(temp, target);
}

async function main(): Promise<void> {
  const squadId = process.argv[2] ?? 'esp';
  const squad = JSON.parse(readFileSync(findSquadFile(squadId), 'utf8')) as Squad;
  const allPlayers = JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'data', 'players.json'), 'utf8'),
  ) as Player[];
  const players = new Map(allPlayers.map((p) => [p.id, p]));

  // A numberless member (no shirt number yet) has no `no` for PlayerRow, which
  // is `number`. Left out here and counted on stderr rather than given a fake 0.
  const numbered = squad.members.flatMap((member) =>
    member.no === null ? [] : [{ ...member, no: member.no }],
  );
  if (numbered.length < squad.members.length) {
    process.stderr.write(
      `Skipping ${squad.members.length - numbered.length} member(s) with no shirt number.\n`,
    );
  }
  const rows: PlayerRow[] = numbered
    .sort((a, b) => a.no - b.no)
    .map((member) => {
      const player = players.get(member.playerId);
      if (player === undefined) {
        throw new Error(`squad ${squadId} names unknown player ${member.playerId}`);
      }
      return {
        playerId: member.playerId,
        name: player.name,
        no: member.no,
        wikiTitle: player.wikiTitle,
      };
    });

  // Stage 1 — Wikipedia: each article's free lead image.
  const titles = [...new Set(rows.flatMap((r) => (r.wikiTitle === null ? [] : [r.wikiTitle])))];
  const leadImages = new Map<string, string | null>();
  const failedTitles = new Set<string>();
  for (const batch of chunk(titles, BATCH_SIZE)) {
    try {
      const response = await getJson(
        queryUrl(WIKIPEDIA_API, {
          prop: 'pageimages',
          piprop: 'name',
          pilicense: 'free',
          pilimit: String(BATCH_SIZE),
          redirects: '1',
          titles: batch.join('|'),
        }),
      );
      for (const [title, file] of leadImagesByTitle(batch, response)) leadImages.set(title, file);
    } catch (error) {
      process.stderr.write(`Wikipedia batch failed: ${String(error)}\n`);
      for (const title of batch) failedTitles.add(title);
    }
  }

  // Stage 2 — Commons: each file's thumbnail and credit.
  const files = [
    ...new Set([...leadImages.values()].flatMap((f) => (f === null ? [] : [fileKey(f)]))),
  ];
  const credits = new Map<string, CreditOutcome>();
  const failedFiles = new Set<string>();
  for (const batch of chunk(files, BATCH_SIZE)) {
    try {
      const response = await getJson(
        queryUrl(COMMONS_API, {
          prop: 'imageinfo',
          iiprop: 'url|extmetadata',
          iiurlwidth: String(THUMB_WIDTH),
          titles: batch.map((f) => `File:${f}`).join('|'),
        }),
      );
      for (const [file, outcome] of creditsByFile(response)) credits.set(file, outcome);
    } catch (error) {
      process.stderr.write(`Commons batch failed: ${String(error)}\n`);
      for (const file of batch) failedFiles.add(file);
    }
  }

  const photos: PhotoFile = {};
  const report = rows.map((row): ReportRow => {
    const none = { ...row, file: null, licence: null, missing: [] };
    if (row.wikiTitle === null) return { ...none, status: 'no-article' };
    if (failedTitles.has(row.wikiTitle)) return { ...none, status: 'lookup-failed' };
    const lead = leadImages.get(row.wikiTitle) ?? null;
    if (lead === null) return { ...none, status: 'no-free-image' };
    const file = fileKey(lead);
    const outcome = credits.get(file);
    if (failedFiles.has(file) || outcome === undefined) {
      return { ...none, file, status: 'lookup-failed' };
    }
    if (outcome.status === 'incomplete-licence') {
      return {
        ...none,
        file,
        licence: outcome.licence,
        missing: outcome.missing,
        status: outcome.status,
      };
    }
    if (outcome.status === 'unexpected-licence') {
      return { ...none, file, licence: outcome.licence, status: outcome.status };
    }
    photos[row.playerId] = outcome.credit;
    return { ...none, file, licence: outcome.credit.licence, status: 'ok' };
  });

  const sorted = Object.fromEntries(Object.entries(photos).sort(([a], [b]) => a.localeCompare(b)));
  const outDir = path.join(REPO_ROOT, 'data', 'poc');
  await writeAtomically(
    path.join(outDir, `photos.${squadId}.json`),
    `${JSON.stringify(sorted, null, 2)}\n`,
  );
  await writeAtomically(
    path.join(outDir, `photos.${squadId}.report.md`),
    renderReport(squad.name, report),
  );

  const usable = report.filter((r) => r.status === 'ok').length;
  process.stdout.write(
    `${squad.name}: ${usable}/${report.length} players have a usable photo. ` +
      `Report: data/poc/photos.${squadId}.report.md\n`,
  );
  if (
    titles.length > 0 &&
    failedTitles.size === 0 &&
    [...leadImages.values()].every((f) => f === null)
  ) {
    process.stderr.write(
      'Warning: no article returned a lead image. Compare a raw API response with ' +
        'scripts/poc/__tests__/fixtures/ before trusting this report.\n',
    );
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
