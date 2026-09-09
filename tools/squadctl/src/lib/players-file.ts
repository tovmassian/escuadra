// The single reader and writer for data/players.json.
//
// Shared rather than repeated per command: `wikiTitle` has to be normalised on
// the way in, because every record written before the field existed carries no
// such key, and one command out of five forgetting to do it is a silent
// identity bug rather than a loud one.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Player } from '../../../../types/squad.ts';
import { formatAndWrite } from './write-json.ts';

/** Normalises `wikiTitle` to null so every consumer sees the field, whether or
 *  not the stored record predates it. The next write stamps it in. */
export function readPlayers(dataDir: string): Player[] {
  const raw = JSON.parse(readFileSync(path.join(dataDir, 'players.json'), 'utf8')) as (Omit<
    Player,
    'wikiTitle'
  > & { wikiTitle?: string | null })[];
  return raw.map((player) => ({ ...player, wikiTitle: player.wikiTitle ?? null }));
}

/** Always sorted by id, so a run that changed nothing produces an empty git
 *  diff. Goes through `formatAndWrite` for the same reason every other writer
 *  does: two writers with drifting prettier options is how a no-op sweep
 *  starts churning the diff. */
export async function writePlayers(dataDir: string, players: readonly Player[]): Promise<void> {
  await formatAndWrite(
    path.join(dataDir, 'players.json'),
    `${JSON.stringify(
      [...players].sort((a, b) => a.id.localeCompare(b.id)),
      null,
      2,
    )}\n`,
  );
}
