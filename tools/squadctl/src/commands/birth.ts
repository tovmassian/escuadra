import { Args } from '@oclif/core';
import { BaseCommand } from '../base-command.ts';
import { readPlayers, writePlayers } from '../lib/players-file.ts';
import { setBirth } from '../lib/rename.ts';

interface BirthReport {
  id: string;
  before: string | null;
  after: string;
}

/** The "Wikidata is right" answer to an `enrich` birth-date conflict: the
 *  stored date was wrong. `retitle` says the title named someone else; a
 *  stored date that is right means correcting Wikidata instead. */
export default class Birth extends BaseCommand<BirthReport> {
  static description =
    "Set a player's stored birth date. Resolves an enrich birth-date conflict when Wikidata's date is the right one.";

  static args = {
    playerId: Args.string({ description: 'Existing player id, e.g. torres', required: true }),
    date: Args.string({ description: 'Birth date as YYYY-MM-DD', required: true }),
  };

  static examples = ['<%= config.bin %> birth torres 2000-02-29'];

  async run(): Promise<BirthReport> {
    const { args } = await this.parse(Birth);
    const players = readPlayers(this.dataDir);

    const result = setBirth(players, args.playerId, args.date);
    if (result === null) {
      this.error(`no player with id "${args.playerId}" in data/players.json`, { exit: 5 });
    }
    if ('invalid' in result) {
      this.error(`"${result.invalid}" is not a real YYYY-MM-DD date`, { exit: 5 });
    }
    if (result.before === result.after) {
      this.error(`"${args.playerId}" is already born ${result.after}`, { exit: 5 });
    }

    await writePlayers(this.dataDir, result.players);

    this.report(`birth ${args.playerId}: ${result.before ?? '(none)'} -> ${result.after}`);
    this.report('  now re-run: npm run squadctl -- enrich');

    return { id: args.playerId, before: result.before, after: result.after };
  }
}
