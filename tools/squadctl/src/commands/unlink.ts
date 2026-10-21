import path from 'node:path';
import { Args, Flags } from '@oclif/core';
import { titlesEquivalent } from '../../../../scripts/roster-envelope.ts';
import { BaseCommand } from '../base-command.ts';
import { addWrongLink, readDecisions } from '../lib/decisions.ts';
import { readPlayers, writePlayers } from '../lib/players-file.ts';
import { readSquad, squadFiles } from '../lib/squad-files.ts';
import { formatAndWrite } from '../lib/write-json.ts';

interface UnlinkReport {
  team: string;
  title: string;
  reason: string;
  alreadyRecorded: boolean;
  /** Members whose record carried the title and no longer does. */
  cleared: string[];
}

/** The answer to a birth conflict whose article is someone else's, when the
 *  player the squad lists has no article to `retitle` to. Nicaragua links its
 *  Emmanuel Gómez (born 2000) to a Gambian defender's article, born 1990, and
 *  Sierra Leone its Francis Koroma (born 2000) to a former player's.
 *
 *  Recorded in `data/decisions.json`, because `apply` fills a missing title
 *  from the row and would hand the wrong one straight back. Clears the title,
 *  and the photo that came through it, from the squad's members that carry
 *  it: with no title, `enrich` neither shows a photo nor checks a birth date
 *  against someone else's. */
export default class Unlink extends BaseCommand<UnlinkReport> {
  static description =
    "Record that a squad article links one of its players to someone else's article, and clear that title from the player.";

  static args = {
    team: Args.string({ description: 'Team id, e.g. nca', required: true }),
    title: Args.string({ description: 'The article title the squad links', required: true }),
  };

  static flags = {
    reason: Flags.string({
      description: 'Whose article it is instead — the decision overrules the source',
      required: true,
    }),
  };

  static examples = [
    '<%= config.bin %> unlink nca "Emmanuel Gómez" --reason "a Gambian defender born 1990; ours was born 2000 and has no article"',
  ];

  async run(): Promise<UnlinkReport> {
    const { args, flags } = await this.parse(Unlink);
    const { decisions, problems } = readDecisions(this.dataDir);
    if (problems.length > 0) {
      this.error(`data/decisions.json is invalid:\n  ${problems.join('\n  ')}`, { exit: 5 });
    }

    const squad = squadFiles(path.join(this.dataDir, 'squads'))
      .map((file) => readSquad(file.path))
      .find((s) => s.id === args.team);
    if (squad === undefined) this.error(`no squad file for ${args.team}`, { exit: 5 });

    const entry = { team: args.team, title: args.title, reason: flags.reason };
    const updated = addWrongLink(decisions, entry);
    if (updated !== null) {
      await formatAndWrite(
        path.join(this.dataDir, 'decisions.json'),
        `${JSON.stringify(updated, null, 2)}\n`,
      );
    }

    const members = new Set(squad.members.map((m) => m.playerId));
    const cleared: string[] = [];
    const players = readPlayers(this.dataDir).map((player) => {
      if (!members.has(player.id) || player.wikiTitle === null) return player;
      if (!titlesEquivalent(player.wikiTitle, args.title)) return player;
      cleared.push(player.id);
      return { ...player, wikiTitle: null, photo: null };
    });
    if (cleared.length > 0) await writePlayers(this.dataDir, players);

    this.report(
      `${updated === null ? 'already recorded' : 'recorded'}: ${args.team} links "${args.title}" to someone else — ${flags.reason}`,
    );
    if (cleared.length > 0) this.report(`  cleared the title from: ${cleared.join(', ')}`);
    this.report('  now re-run: npm run squadctl -- apply <envelopes>');

    return { ...entry, alreadyRecorded: updated === null, cleared };
  }
}
