import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Args } from '@oclif/core';
import { BaseCommand } from '../base-command.ts';
import {
  EMPTY_DECISIONS,
  addAlias,
  validateDecisions,
  type DecisionFile,
} from '../lib/decisions.ts';
import { readPlayers } from '../lib/players-file.ts';
import { formatAndWrite } from '../lib/write-json.ts';

interface AliasReport {
  player: string;
  name: string;
  alreadyRecorded: boolean;
}

/** The third answer to a `possible-rename`, and the only truthful one when two
 *  articles name the same person differently and both are right. `rename` only
 *  moves the conflict to the other squad; `split` asserts they are two people,
 *  which recreates the duplicate this whole mechanism exists to prevent. */
export default class Alias extends BaseCommand<AliasReport> {
  static description =
    'Record another name one player is known by, so a second source spelling matches instead of looking like a rename.';

  static args = {
    player: Args.string({ description: 'Existing player id', required: true }),
    name: Args.string({ description: 'The other name this player is known by', required: true }),
  };

  static examples = ['<%= config.bin %> alias grimaldo "Alejandro Grimaldo"'];

  async run(): Promise<AliasReport> {
    const { args } = await this.parse(Alias);

    const players = readPlayers(this.dataDir);
    const target = players.find((p) => p.id === args.player);
    if (target === undefined) {
      this.error(`no player with id "${args.player}" in data/players.json`, { exit: 5 });
    }
    if (target.name === args.name) {
      this.error(`"${args.player}" is already named ${args.name} — an alias would be a no-op`, {
        exit: 5,
      });
    }

    const file = path.join(this.dataDir, 'decisions.json');
    let decisions: DecisionFile = EMPTY_DECISIONS;
    if (existsSync(file)) {
      const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
      const problems = validateDecisions(parsed);
      if (problems.length > 0) {
        this.error(`data/decisions.json is invalid:\n  ${problems.join('\n  ')}`, { exit: 5 });
      }
      const loaded = parsed as DecisionFile;
      // Older files predate aliases and carry only splits.
      decisions = { splits: loaded.splits, aliases: loaded.aliases ?? [] };
    }

    const updated = addAlias(decisions, { player: args.player, name: args.name });
    if (updated === null) {
      this.report(`already recorded: ${args.player} is also known as "${args.name}"`);
      return { player: args.player, name: args.name, alreadyRecorded: true };
    }

    await formatAndWrite(file, `${JSON.stringify(updated, null, 2)}\n`);
    this.report(`recorded: ${args.player} ("${target.name}") is also known as "${args.name}"`);
    this.report('  both spellings now match this one record — re-run apply');
    return { player: args.player, name: args.name, alreadyRecorded: false };
  }
}
