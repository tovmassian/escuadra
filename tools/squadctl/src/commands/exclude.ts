import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.ts';
import {
  EMPTY_DECISIONS,
  addNotInSquad,
  validateDecisions,
  type DecisionFile,
} from '../lib/decisions.ts';
import { formatAndWrite } from '../lib/write-json.ts';

interface ExcludeReport {
  team: string;
  title: string;
  reason: string;
  alreadyRecorded: boolean;
}

/** The answer to a dual membership the source cannot explain itself.
 *
 *  A player belongs to exactly one club — the one they actually play for. When
 *  both articles annotate the loan (`other=on loan from` / `other=at [[X]]
 *  until`), reconciliation resolves it with no help. This command is for the
 *  residue: a completed transfer that one club's article has not caught up
 *  with, where the two listings are identical in form and only the real world
 *  says which is right.
 *
 *  Keyed on the article title rather than the display name, and recorded in
 *  `data/decisions.json` rather than by editing the squad file, because squad
 *  files are generated and a hand edit is undone by the next apply. */
export default class Exclude extends BaseCommand<ExcludeReport> {
  static description =
    'Record that a squad article lists a player who does not belong in that squad, so apply drops the row.';

  static args = {
    team: Args.string({ description: 'Team id, e.g. ver', required: true }),
    title: Args.string({
      description: 'Article title of the player to drop from that squad',
      required: true,
    }),
  };

  static flags = {
    reason: Flags.string({
      description: 'Why the source is wrong — printed back on every apply',
      required: true,
    }),
  };

  static examples = [
    '<%= config.bin %> exclude ver "Rafik Belghali" --reason "transferred to Torino; Verona\'s article is stale"',
  ];

  async run(): Promise<ExcludeReport> {
    const { args, flags } = await this.parse(Exclude);

    const file = path.join(this.dataDir, 'decisions.json');
    let decisions: DecisionFile = EMPTY_DECISIONS;
    if (existsSync(file)) {
      const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
      const problems = validateDecisions(parsed);
      if (problems.length > 0) {
        this.error(`data/decisions.json is invalid:\n  ${problems.join('\n  ')}`, { exit: 5 });
      }
      const loaded = parsed as DecisionFile;
      decisions = {
        splits: loaded.splits,
        aliases: loaded.aliases ?? [],
        titleAliases: loaded.titleAliases ?? [],
        notInSquad: loaded.notInSquad ?? [],
      };
    }

    const entry = { team: args.team, title: args.title, reason: flags.reason };
    const updated = addNotInSquad(decisions, entry);
    if (updated === null) {
      this.report(`already recorded: "${args.title}" is excluded from ${args.team}`);
      return { ...entry, alreadyRecorded: true };
    }

    await formatAndWrite(file, `${JSON.stringify(updated, null, 2)}\n`);
    this.report(`recorded: ${args.team} does not include "${args.title}" — ${flags.reason}`);
    this.report('  now re-run: npm run squadctl -- apply <envelopes>');

    return { ...entry, alreadyRecorded: false };
  }
}
