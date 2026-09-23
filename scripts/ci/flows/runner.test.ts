import { describe, expect, it } from 'vitest';
import { fail, fakeRunner, json } from './fake-runner.ts';
import { CommandError, createRunner, runJson, runOk } from './runner.ts';

describe('runOk and runJson', () => {
  it('return stdout, parse JSON, and throw CommandError on a non-zero exit', async () => {
    const runner = fakeRunner(({ args }) =>
      args[0] === 'good' ? json({ hash: 'abc' }) : fail(2, 'boom'),
    );
    await expect(runJson(runner, 'eas', ['good'])).resolves.toEqual({ hash: 'abc' });
    await expect(runOk(runner, 'eas', ['bad'])).rejects.toBeInstanceOf(CommandError);
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
