// Shared base for every squadctl command.
//
// `--json` is global rather than per-command: `enableJsonFlag` gives every
// subclass the flag, suppresses human logging while it is set, and serialises
// whatever `run()` returns. Commands therefore always build one typed result
// object and never branch on output format themselves.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from '@oclif/core';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export abstract class BaseCommand<T> extends Command {
  static enableJsonFlag = true;

  /** tools/squadctl/src -> repo root. Overridable via the SQUADCTL_REPO_ROOT
   *  environment variable so a test can point a command at a fixture repo
   *  instead of this one — not a supported production flag, and no command
   *  ever needs to read it directly. */
  protected readonly repoRoot = process.env.SQUADCTL_REPO_ROOT ?? path.resolve(HERE, '../../..');

  protected get dataDir(): string {
    return path.join(this.repoRoot, 'data');
  }

  protected get registryPath(): string {
    return path.join(this.dataDir, 'teams.json');
  }

  protected get cacheDir(): string {
    return path.join(this.repoRoot, '.cache');
  }

  /** Human-readable progress. Silent under --json so the only thing on stdout
   *  is the result object. */
  protected report(message: string): void {
    if (!this.jsonEnabled()) this.log(message);
  }

  abstract run(): Promise<T>;
}
