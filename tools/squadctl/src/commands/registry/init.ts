import { existsSync } from 'node:fs';
import path from 'node:path';
import { Flags } from '@oclif/core';
import { BaseCommand } from '../../base-command.ts';
import { deriveRegistry } from '../../lib/derive-registry.ts';
import { validateRegistry } from '../../lib/registry.ts';
import { formatAndWrite } from '../../lib/write-json.ts';

interface InitResult {
  path: string;
  entries: number;
  clubs: number;
  nations: number;
}

/** Derives a registry entry for every squad already in the repo. Every field
 *  the registry needs is stored on the squad file already — including
 *  `identity`, the one field that is genuine design judgement — so existing
 *  teams cost no authoring at all and hand-authoring is confined to teams
 *  that do not exist yet. */
export default class RegistryInit extends BaseCommand<InitResult> {
  static description = 'Derive data/teams.json from the squad files already in the repo.';

  static flags = {
    force: Flags.boolean({
      description: 'Overwrite an existing data/teams.json instead of refusing.',
      default: false,
    }),
  };

  async run(): Promise<InitResult> {
    const { flags } = await this.parse(RegistryInit);

    if (existsSync(this.registryPath) && !flags.force) {
      // Merging new entries into a populated registry is an operator edit,
      // not something a bootstrap command should guess at.
      this.error(`${this.registryPath} already exists. Re-run with --force to replace it.`, {
        exit: 5,
      });
    }

    const entries = deriveRegistry(path.join(this.dataDir, 'squads'));
    const problems = validateRegistry(entries);
    if (problems.length > 0) {
      this.error(`derived registry is invalid:\n  ${problems.join('\n  ')}`, { exit: 5 });
    }

    await formatAndWrite(this.registryPath, `${JSON.stringify(entries, null, 2)}\n`);

    const clubs = entries.filter((e) => e.kind === 'club').length;
    this.report(
      `registry init: wrote ${entries.length} entries (${clubs} clubs, ${entries.length - clubs} nations) to data/teams.json`,
    );
    return {
      path: this.registryPath,
      entries: entries.length,
      clubs,
      nations: entries.length - clubs,
    };
  }
}
