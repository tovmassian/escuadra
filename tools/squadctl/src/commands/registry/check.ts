import { readFileSync } from 'node:fs';
import path from 'node:path';
import { BaseCommand } from '../../base-command.ts';
import { deriveRegistry, diffRegistry } from '../../lib/derive-registry.ts';
import { validateRegistry, type TeamRegistry } from '../../lib/registry.ts';

interface CheckResult {
  teams: number;
  problems: string[];
}

/** Runs on every `npm run check`, not just once at bootstrap: `apply` copies
 *  `name`/`source`/`kind`/`league`/`identity` from `data/teams.json` onto
 *  the squad file it writes, but nothing otherwise verifies the two still
 *  agree. Edit the registry and forget to re-run `apply`, or add a squad
 *  file with no registry entry at all, and the repo drifts silently. */
export default class RegistryCheck extends BaseCommand<CheckResult> {
  static description = 'Verify data/teams.json still agrees with the squad files derived from it.';

  static examples = ['<%= config.bin %> registry check'];

  async run(): Promise<CheckResult> {
    await this.parse(RegistryCheck);

    const stored = this.loadRegistry();
    const derived = deriveRegistry(path.join(this.dataDir, 'squads'));
    const problems = diffRegistry(derived, stored);

    if (problems.length > 0) {
      this.error(
        `data/teams.json disagrees with the squad files it should match:\n  ${problems.join('\n  ')}`,
        { exit: 5 },
      );
    }

    this.report(`registry check: ${derived.length} teams agree with data/teams.json`);
    return { teams: derived.length, problems };
  }

  private loadRegistry(): TeamRegistry {
    let raw: string;
    try {
      raw = readFileSync(this.registryPath, 'utf8');
    } catch {
      this.error('no data/teams.json — run "squadctl registry init" first', { exit: 5 });
    }
    const parsed: unknown = JSON.parse(raw);
    const problems = validateRegistry(parsed);
    if (problems.length > 0) {
      this.error(`data/teams.json is invalid:\n  ${problems.join('\n  ')}`, { exit: 5 });
    }
    return parsed as TeamRegistry;
  }
}
