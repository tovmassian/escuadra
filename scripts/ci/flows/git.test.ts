import { describe, expect, it } from 'vitest';
import { fail, fakeRunner, ok } from './fake-runner.ts';
import { bringsMainCommits } from './git.ts';

/** Two merge bases with main; `onBase` says, in order, whether each is on the release branch. */
function history(onBase: boolean[]) {
  return fakeRunner(({ args }) => {
    if (args[1] === '--all') return ok('aaa\nbbb\n');
    if (args[1] === '--is-ancestor') return onBase.shift() ? ok() : fail(1, '');
    return undefined;
  });
}

describe('bringsMainCommits', () => {
  it('is false when every merge base with main is already on the release branch', async () => {
    expect(await bringsMainCommits(history([true, true]), 'release/1.0.0')).toBe(false);
  });

  it('is true when any merge base exists only on main', async () => {
    expect(await bringsMainCommits(history([true, false]), 'release/1.0.0')).toBe(true);
  });

  it('is false for unrelated histories', async () => {
    expect(
      await bringsMainCommits(
        fakeRunner(() => fail(1, '')),
        'release/1.0.0',
      ),
    ).toBe(false);
  });
});
