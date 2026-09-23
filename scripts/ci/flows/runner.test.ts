import { describe, expect, it } from 'vitest';
import { fail, fakeRunner, json, ok } from './fake-runner.ts';
import { CommandError, createRunner, runJson, runOk } from './runner.ts';

describe('runOk and runJson', () => {
  it('return stdout, parse JSON, and throw CommandError on a non-zero exit', async () => {
    const runner = fakeRunner(({ args }) =>
      args[0] === 'good' ? json({ hash: 'abc' }) : fail(2, 'boom'),
    );
    await expect(runJson(runner, 'eas', ['good'])).resolves.toEqual({ hash: 'abc' });
    await expect(runOk(runner, 'eas', ['bad'])).rejects.toBeInstanceOf(CommandError);
  });

  it('skips the notices eas prints on stdout before the JSON, even with --json', async () => {
    // eas-cli 24.7.0, verbatim, for any command given --environment on an account with
    // no EAS environment variables.
    const notice =
      'No environment variables with visibility "Plain text" and "Sensitive" found for the "production" environment on EAS.\n\n';
    const runner = fakeRunner(({ args }) =>
      ok(
        args[0] === 'update'
          ? `${notice}[\n  { "id": "u" }\n]\n`
          : `${notice}{\n  "hash": "abc"\n}\n`,
      ),
    );
    await expect(runJson(runner, 'eas', ['fingerprint:generate'])).resolves.toEqual({
      hash: 'abc',
    });
    await expect(runJson(runner, 'eas', ['update'])).resolves.toEqual([{ id: 'u' }]);
  });
});

describe('createRunner', () => {
  it('runs a real command and reports its exit code', async () => {
    const runner = createRunner();
    const version = await runner.run('git', ['--version']);
    expect(version.code).toBe(0);
    expect(version.stdout).toMatch(/^git version/);
    expect((await runner.run('git', ['definitely-not-a-command'])).code).not.toBe(0);
  });
});
