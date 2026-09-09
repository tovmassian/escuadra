import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.ts';
import {
  EMPTY_DECISIONS,
  addAlias,
  addTitleAlias,
  validateDecisions,
  type DecisionFile,
} from '../lib/decisions.ts';
import { readPlayers } from '../lib/players-file.ts';
import { formatAndWrite } from '../lib/write-json.ts';
import { titlesEquivalent } from '../../../../scripts/roster-envelope.ts';

interface AliasReport {
  player: string;
  name?: string;
  title?: string;
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
    name: Args.string({ description: 'The other name this player is known by', required: false }),
  };

  static flags = {
    title: Flags.string({
      description: 'Record an alternative Wikipedia article title instead of a name',
    }),
  };

  static examples = [
    '<%= config.bin %> alias grimaldo "Alejandro Grimaldo"',
    '<%= config.bin %> alias grimaldo --title "Alejandro Grimaldo"',
  ];

  async run(): Promise<AliasReport> {
    const { args, flags } = await this.parse(Alias);

    if (flags.title === undefined && args.name === undefined) {
      this.error('pass either a name or --title', { exit: 5 });
    }

    const players = readPlayers(this.dataDir);
    const target = players.find((p) => p.id === args.player);
    if (target === undefined) {
      this.error(`no player with id "${args.player}" in data/players.json`, { exit: 5 });
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
      // Older files predate aliases and titleAliases and carry only splits.
      decisions = {
        splits: loaded.splits,
        aliases: loaded.aliases ?? [],
        titleAliases: loaded.titleAliases ?? [],
      };
    }

    if (flags.title !== undefined) {
      // Title alias mode
      if (target.wikiTitle !== null && titlesEquivalent(target.wikiTitle, flags.title)) {
        this.error(`"${args.player}" is already ${target.wikiTitle} — an alias would be a no-op`, {
          exit: 5,
        });
      }

      const updated = addTitleAlias(decisions, { player: args.player, title: flags.title });
      if (updated === null) {
        this.report(`already recorded: ${args.player} is also linked as "${flags.title}"`);
        return { player: args.player, title: flags.title, alreadyRecorded: true };
      }

      await formatAndWrite(file, `${JSON.stringify(updated, null, 2)}\n`);
      this.report(`recorded: ${args.player} ("${target.name}") is also linked as "${flags.title}"`);
      this.report('  both link targets now match this one record — re-run apply');
      return { player: args.player, title: flags.title, alreadyRecorded: false };
    } else {
      // Name alias mode (existing behavior)
      if (target.name === args.name) {
        this.error(`"${args.player}" is already named ${args.name} — an alias would be a no-op`, {
          exit: 5,
        });
      }

      const updated = addAlias(decisions, { player: args.player, name: args.name! });
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
}
