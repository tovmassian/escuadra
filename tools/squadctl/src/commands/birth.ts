import path from 'node:path';
import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.ts';
import { addKeptBirth, dropKeptBirth, readDecisions } from '../lib/decisions.ts';
import { isCalendarDate } from '../lib/dates.ts';
import { readPlayers, writePlayers } from '../lib/players-file.ts';
import { setBirth } from '../lib/rename.ts';
import { formatAndWrite } from '../lib/write-json.ts';

interface BirthReport {
  id: string;
  before: string | null;
  after: string;
  kept: boolean;
  /** A set date replaced one a person had kept against Wikidata's; that
   *  keptBirths entry was removed with it. */
  droppedKept: boolean;
}

/** The answers to an `enrich` birth-date conflict that a command can give:
 *  `birth <id> <date>` when Wikidata's date is right and the stored one is
 *  not, `birth <id> --keep` when the stored date is right. The third answer,
 *  that the title names someone else, is `retitle`. For an
 *  `implausible-birth`, `birth <id> <date>` confirms Wikidata's date: once
 *  stored, it is checked against Wikidata rather than filled from it. */
export default class Birth extends BaseCommand<BirthReport> {
  static description =
    "Set a player's birth date, or keep the stored one against Wikidata's. Resolves an enrich birth-date conflict.";

  static args = {
    playerId: Args.string({ description: 'Existing player id, e.g. torres', required: true }),
    date: Args.string({ description: 'Birth date as YYYY-MM-DD (omit with --keep)' }),
  };

  static flags = {
    keep: Flags.boolean({
      description:
        'Record that the stored date stands against Wikidata, in data/decisions.json, so enrich stops asking.',
      default: false,
    }),
  };

  static examples = [
    '<%= config.bin %> birth torres 2000-02-29',
    '<%= config.bin %> birth matias-galarza --keep',
  ];

  async run(): Promise<BirthReport> {
    const { args, flags } = await this.parse(Birth);
    const players = readPlayers(this.dataDir);
    const target = players.find((p) => p.id === args.playerId);
    if (target === undefined) {
      this.error(`no player with id "${args.playerId}" in data/players.json`, { exit: 5 });
    }

    if (flags.keep) {
      if (args.date !== undefined) {
        this.error('--keep keeps the stored date; give no date with it', { exit: 5 });
      }
      if (target.birth === null || !isCalendarDate(target.birth)) {
        this.error(
          `"${args.playerId}" stores ${target.birth ?? 'no birth date'}, which is not a real date to keep — set one with: npm run squadctl -- birth ${args.playerId} <YYYY-MM-DD>`,
          { exit: 5 },
        );
      }
      const { decisions, problems } = readDecisions(this.dataDir);
      if (problems.length > 0) {
        this.error(`data/decisions.json is invalid:\n  ${problems.join('\n  ')}`, { exit: 5 });
      }
      const updated = addKeptBirth(decisions, { player: args.playerId, birth: target.birth });
      if (updated !== null) {
        await formatAndWrite(
          path.join(this.dataDir, 'decisions.json'),
          `${JSON.stringify(updated, null, 2)}\n`,
        );
      }
      this.report(
        `${updated === null ? 'already recorded' : 'recorded'}: ${args.playerId} keeps ${target.birth} against Wikidata`,
      );
      this.report('  now re-run: npm run squadctl -- enrich');
      return {
        id: args.playerId,
        before: target.birth,
        after: target.birth,
        kept: true,
        droppedKept: false,
      };
    }

    if (args.date === undefined) {
      this.error('give a YYYY-MM-DD date, or --keep to keep the stored one', { exit: 5 });
    }
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
    // A kept birth confirmed the date this replaces: it goes with it.
    const { decisions, problems } = readDecisions(this.dataDir);
    if (problems.length > 0) {
      this.error(`data/decisions.json is invalid:\n  ${problems.join('\n  ')}`, { exit: 5 });
    }
    const withoutKept = dropKeptBirth(decisions, args.playerId);

    await writePlayers(this.dataDir, result.players);
    if (withoutKept !== null) {
      await formatAndWrite(
        path.join(this.dataDir, 'decisions.json'),
        `${JSON.stringify(withoutKept, null, 2)}\n`,
      );
    }

    this.report(`birth ${args.playerId}: ${result.before ?? '(none)'} -> ${result.after}`);
    if (withoutKept !== null) {
      this.report(`  removed: the kept birth ${result.before ?? ''} from data/decisions.json`);
    }
    this.report('  now re-run: npm run squadctl -- enrich');

    return {
      id: args.playerId,
      before: result.before,
      after: result.after,
      kept: false,
      droppedKept: withoutKept !== null,
    };
  }
}
