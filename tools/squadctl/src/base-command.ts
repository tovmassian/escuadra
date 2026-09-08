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

  /** Keeps the documented exit code under `--json`.
   *
   *  oclif's own `catch` does `process.exitCode = process.exitCode ?? err.exitCode ?? 1`,
   *  but `this.error(msg, { exit: N })` builds a `CLIError` that carries the
   *  code at `oclif.exit` and never sets `exitCode` — so the `?? 1` always
   *  won. Without `--json` that went unnoticed, because the rethrow reaches
   *  oclif's top-level handler, which does read `oclif.exit`; under `--json`
   *  the error is serialised instead of rethrown, and the process exited 1.
   *
   *  That mattered more than a wrong number: `1` is "network / HTTP" in the
   *  exit-code table, so a `--json` consumer read a registry or repo error as
   *  a transient failure and retried it. `registry check` was affected on
   *  every failure, its only non-zero exit being a `this.error`. */
  override async catch(err: Parameters<Command['catch']>[0]): Promise<unknown> {
    const exit = (err as { oclif?: { exit?: number } }).oclif?.exit;
    if (exit !== undefined) process.exitCode = exit;
    return super.catch(err);
  }

  abstract run(): Promise<T>;
}
