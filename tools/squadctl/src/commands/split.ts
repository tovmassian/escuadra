import path from 'node:path';
import { Args } from '@oclif/core';
import { BaseCommand } from '../base-command.ts';
import { addSplit, readDecisions } from '../lib/decisions.ts';
import { formatAndWrite } from '../lib/write-json.ts';

interface SplitReport {
  team: string;
  departed: string;
  arrived: string;
  alreadyRecorded: boolean;
}

/** The other answer to a `possible-rename`. `rename` says "one person, new
 *  spelling"; this says "two people, the source is right", and records it so
 *  the question is not asked again every sweep. */
export default class Split extends BaseCommand<SplitReport> {
  static description =
    'Record that a rename-looking departure and arrival are two different people, so the split is written and not re-flagged.';

  static args = {
    team: Args.string({ description: 'Squad id the conflict was reported on', required: true }),
    departed: Args.string({ description: 'Stored player id that left', required: true }),
    arrived: Args.string({ description: 'Name the source lists for the arrival', required: true }),
  };

  static examples = ['<%= config.bin %> split arg gonzalez "Nicolás González"'];

  async run(): Promise<SplitReport> {
    const { args } = await this.parse(Split);
    const file = path.join(this.dataDir, 'decisions.json');

    const { decisions, problems } = readDecisions(this.dataDir);
    if (problems.length > 0) {
      this.error(`data/decisions.json is invalid:\n  ${problems.join('\n  ')}`, { exit: 5 });
    }

    const split = { team: args.team, departed: args.departed, arrived: args.arrived };
    const updated = addSplit(decisions, split);
    if (updated === null) {
      this.report(`already recorded: ${args.departed} and "${args.arrived}" are different people`);
      return { ...split, alreadyRecorded: true };
    }

    await formatAndWrite(file, `${JSON.stringify(updated, null, 2)}\n`);
    this.report(
      `recorded: on ${args.team}, ${args.departed} and "${args.arrived}" are different people`,
    );
    this.report('  now re-run apply — the split will be written and no longer flagged');
    return { ...split, alreadyRecorded: false };
  }
}
