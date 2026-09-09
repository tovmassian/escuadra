import { Args } from '@oclif/core';
import { BaseCommand } from '../base-command.ts';
import { readPlayers, writePlayers } from '../lib/players-file.ts';
import { forkPlayer } from '../lib/rename.ts';

interface ForkReport {
  from: string;
  created: string;
  title: string;
}

/** One of the three answers to a `title-mismatch`: two different real people
 *  share a display name, and the source is describing the other one. */
export default class Fork extends BaseCommand<ForkReport> {
  static description =
    'Write a second player record for a different real person who shares a display name, carrying the article title that identifies them.';

  static args = {
    playerId: Args.string({
      description: 'Existing player id the row was matched to',
      required: true,
    }),
    title: Args.string({ description: 'Article title of the OTHER person', required: true }),
  };

  static examples = ['<%= config.bin %> fork otavio "Otávio (footballer, born November 2005)"'];

  async run(): Promise<ForkReport> {
    const { args } = await this.parse(Fork);
    const players = readPlayers(this.dataDir);

    const existing = players.find((p) => p.wikiTitle === args.title);
    if (existing !== undefined) {
      this.error(`"${args.title}" is already ${existing.id} — nothing to fork`, { exit: 5 });
    }

    const result = forkPlayer(players, args.playerId, args.title);
    if (result === null) {
      this.error(`no player with id "${args.playerId}" in data/players.json`, { exit: 5 });
    }

    await writePlayers(this.dataDir, result.players);

    this.report(`forked ${args.playerId} -> ${result.created.id} ("${args.title}")`);
    this.report('  club, nationality and birth are filled by the next apply, not copied');
    this.report('  now re-run: npm run squadctl -- apply <envelopes>');

    return { from: args.playerId, created: result.created.id, title: args.title };
  }
}
