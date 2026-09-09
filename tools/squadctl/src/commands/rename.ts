import { Args } from '@oclif/core';
import { BaseCommand } from '../base-command.ts';
import { readPlayers, writePlayers } from '../lib/players-file.ts';
import { renamePlayer } from '../lib/rename.ts';

interface RenameReport {
  id: string;
  before: string;
  after: string;
  fullNameFollowed: boolean;
}

export default class Rename extends BaseCommand<RenameReport> {
  static description =
    "Point an existing player record at the source's spelling. Resolves a possible-rename or name-variant conflict without ever rewriting the player's id.";

  static args = {
    playerId: Args.string({ description: 'Existing player id, e.g. grimaldo', required: true }),
    name: Args.string({ description: 'Display name as the source spells it', required: true }),
  };

  static examples = [
    '<%= config.bin %> rename grimaldo "Álex Grimaldo"',
    '<%= config.bin %> rename danilo "Danilo Luiz"',
  ];

  async run(): Promise<RenameReport> {
    const { args } = await this.parse(Rename);
    const players = readPlayers(this.dataDir);

    const result = renamePlayer(players, args.playerId, args.name);
    if (result === null) {
      this.error(`no player with id "${args.playerId}" in data/players.json`, { exit: 5 });
    }
    if (result.before === result.after) {
      this.error(`"${args.playerId}" is already named ${result.after}`, { exit: 5 });
    }

    await writePlayers(this.dataDir, result.players);

    this.report(`renamed ${args.playerId}: "${result.before}" -> "${result.after}"`);
    if (result.fullNameFollowed) this.report('  fullName tracked name and moved with it');
    this.report('  now re-run: npm run squadctl -- apply <envelopes> --dry-run');

    return {
      id: args.playerId,
      before: result.before,
      after: result.after,
      fullNameFollowed: result.fullNameFollowed,
    };
  }
}
