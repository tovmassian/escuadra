import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Args } from '@oclif/core';
import type { Player } from '../../../../types/squad.ts';
import { BaseCommand } from '../base-command.ts';
import { renamePlayer } from '../lib/rename.ts';
import { formatAndWrite } from '../lib/write-json.ts';

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
    const playersPath = path.join(this.dataDir, 'players.json');
    const players = JSON.parse(readFileSync(playersPath, 'utf8')) as Player[];

    const result = renamePlayer(players, args.playerId, args.name);
    if (result === null) {
      this.error(`no player with id "${args.playerId}" in data/players.json`, { exit: 5 });
    }
    if (result.before === result.after) {
      this.error(`"${args.playerId}" is already named ${result.after}`, { exit: 5 });
    }

    await formatAndWrite(
      playersPath,
      `${JSON.stringify(
        [...result.players].sort((a, b) => a.id.localeCompare(b.id)),
        null,
        2,
      )}\n`,
    );

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
