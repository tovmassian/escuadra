// How flows run the `eas`, `gh` and `git` CLIs. Flows take a Runner, so tests pass a
// fake (fake-runner.ts) and assert what ran — and, as much, what never did.
import { execFile } from 'node:child_process';

export type Tool = 'eas' | 'gh' | 'git';

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface Runner {
  run(tool: Tool, args: string[]): Promise<CommandResult>;
}

export class CommandError extends Error {
  readonly result: CommandResult;

  constructor(tool: Tool, args: string[], result: CommandResult) {
    // Only the subcommand: full arguments can hold whole comment bodies.
    super(
      `${tool} ${args[0] ?? ''} exited with ${result.code}: ${result.stderr.trim().slice(-2000)}`,
    );
    this.result = result;
  }
}

// EAS_CLI lets a local dry run use `npx --yes eas-cli@24.7.0` instead of a global `eas`.
function command(tool: Tool, args: string[]): [string, string[]] {
  const override = tool === 'eas' ? process.env.EAS_CLI : undefined;
  if (!override) return [tool, args];
  const [bin = 'eas', ...prefix] = override.split(' ').filter(Boolean);
  return [bin, [...prefix, ...args]];
}

export function createRunner(cwd: string = process.cwd()): Runner {
  return {
    run: (tool, args) =>
      new Promise((resolve) => {
        const [bin, fullArgs] = command(tool, args);
        execFile(bin, fullArgs, { cwd, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
          const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
          resolve({
            code,
            stdout: String(stdout),
            stderr: String(stderr) || (error?.message ?? ''),
          });
        });
      }),
  };
}

export async function runOk(runner: Runner, tool: Tool, args: string[]): Promise<string> {
  const result = await runner.run(tool, args);
  if (result.code !== 0) throw new CommandError(tool, args, result);
  return result.stdout;
}

// eas-cli prints notices on stdout even with --json — for any command given --environment,
// "No environment variables … found for the "production" environment on EAS." — so the JSON
// starts at the first line that opens an object or an array.
export async function runJson<T>(runner: Runner, tool: Tool, args: string[]): Promise<T> {
  const stdout = await runOk(runner, tool, args);
  const start = stdout.search(/^[[{]/m);
  return JSON.parse(start > 0 ? stdout.slice(start) : stdout) as T;
}
