import { Args } from '@oclif/core';
import { BaseCommand } from '../base-command.ts';
import { readPlayers, writePlayers } from '../lib/players-file.ts';
import { retitlePlayer } from '../lib/rename.ts';

interface RetitleReport {
  id: string;
  before: string | null;
  after: string;
}

/** One of the three answers to a `title-mismatch`: same person, and Wikipedia
 *  moved their article. `fork` says two people; `alias --title` says one
 *  person under two titles, both of them right. */
export default class Retitle extends BaseCommand<RetitleReport> {
  static description =
    'Point an existing player record at a different Wikipedia article title, when the article moved and the person did not.';

  static args = {
    playerId: Args.string({ description: 'Existing player id, e.g. endrick', required: true }),
    title: Args.string({
      description: 'Article title as the source links it',
      required: true,
    }),
  };

  static examples = ['<%= config.bin %> retitle endrick "Endrick (footballer, born 2006)"'];

  async run(): Promise<RetitleReport> {
    const { args } = await this.parse(Retitle);
    const players = readPlayers(this.dataDir);

    const result = retitlePlayer(players, args.playerId, args.title);
    if (result === null) {
      this.error(`no player with id "${args.playerId}" in data/players.json`, { exit: 5 });
    }
    if (result.before === result.after) {
      this.error(`"${args.playerId}" already carries that title`, { exit: 5 });
    }

    await writePlayers(this.dataDir, result.players);

    this.report(`retitled ${args.playerId}: ${result.before ?? '(none)'} -> "${result.after}"`);
    this.report('  now re-run: npm run squadctl -- apply <envelopes> --dry-run');

    return { id: args.playerId, before: result.before, after: result.after };
  }
}
