// CLI guard the squad skills run against every roster envelope before it is
// acted on. Skills cannot import a module, so the contract is reachable as a
// command:
//   node scripts/envelope-check.ts <envelope.json...>
//   node scripts/envelope-check.ts --against <storedSquad.json> <envelope.json...>
// The --against form also reports how much of the stored roster the envelope
// changes, warning past BLAST_RADIUS_THRESHOLD. That warning is advisory by
// design: an on-demand run has an operator reading the report. Promoting it to
// a hard failure is the documented change if this ever runs on a schedule.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  BLAST_RADIUS_THRESHOLD,
  changeRatio,
  validateEnvelope,
  type RosterEnvelope,
} from './roster-envelope.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

/** Display names of a stored squad's members, resolved through players.json. */
function storedMemberNames(squadPath: string): string[] {
  const squad = readJson(squadPath) as unknown;
  if (typeof squad !== 'object' || squad === null) {
    throw new Error('squad must be an object');
  }
  const members = (squad as { members?: unknown }).members;
  if (members !== undefined && !Array.isArray(members)) {
    throw new Error('squad.members must be an array');
  }
  const players = readJson(path.join(REPO_ROOT, 'data', 'players.json')) as {
    id: string;
    name: string;
  }[];
  const nameById = new Map(players.map((player) => [player.id, player.name]));
  const names: string[] = [];
  for (const member of members ?? []) {
    const memberObj = member as { playerId?: string };
    const name = memberObj.playerId === undefined ? undefined : nameById.get(memberObj.playerId);
    if (name !== undefined) names.push(name);
  }
  return names;
}

const argv = process.argv.slice(2);
let againstPath: string | undefined;
let paths = argv;

const flagIndex = argv.indexOf('--against');
if (flagIndex !== -1) {
  const value = argv[flagIndex + 1];
  if (value === undefined) {
    console.error('--against needs the path of a stored squad file');
    process.exit(2);
  }
  againstPath = value;
  paths = [...argv.slice(0, flagIndex), ...argv.slice(flagIndex + 2)];
}

if (paths.length === 0) {
  console.error(
    'usage: node scripts/envelope-check.ts [--against <storedSquad.json>] <envelope.json...>',
  );
  process.exit(2);
}

let storedRoster: string[] | undefined;
if (againstPath !== undefined) {
  try {
    storedRoster = storedMemberNames(againstPath);
  } catch (error) {
    console.error(`could not read stored squad ${againstPath} — ${(error as Error).message}`);
    process.exit(2);
  }
}

let failed = false;
for (const filePath of paths) {
  let parsed: unknown;
  try {
    parsed = readJson(filePath);
  } catch (error) {
    console.error(`${filePath}: not readable as JSON — ${(error as Error).message}`);
    failed = true;
    continue;
  }

  const errors = validateEnvelope(parsed);
  if (errors.length > 0) {
    for (const message of errors) console.error(`${filePath}: ${message}`);
    failed = true;
    continue;
  }

  console.log(`${filePath}: OK`);

  if (storedRoster !== undefined) {
    const envelope = parsed as RosterEnvelope;
    const ratio = changeRatio(
      storedRoster,
      envelope.members.map((member) => member.name),
    );
    const percent = Math.round(ratio * 100);
    if (ratio > BLAST_RADIUS_THRESHOLD) {
      console.warn(
        `${filePath}: BLAST RADIUS — ${percent}% of the stored roster changes ` +
          `(threshold ${Math.round(BLAST_RADIUS_THRESHOLD * 100)}%). Confirm the source page ` +
          `was not restructured or vandalised before writing.`,
      );
    } else {
      console.log(`${filePath}: change ratio ${percent}%`);
    }
  }
}

process.exit(failed ? 1 : 0);
