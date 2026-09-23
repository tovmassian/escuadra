import { describe, expect, it } from 'vitest';
import { explainMismatch, listBuilds, listUpdateGroups, republishGroup } from './eas.ts';
import { fakeRunner, json } from './fake-runner.ts';

describe('eas wrappers', () => {
  it('asks build:list for one platform, profile and version', async () => {
    const runner = fakeRunner(() => json([]));
    await listBuilds(runner, { platform: 'ios', profile: 'production', appVersion: '1.0.0' });
    expect(runner.calls[0]?.args).toEqual([
      'build:list',
      '--platform',
      'ios',
      '--build-profile',
      'production',
      '--limit',
      '50',
      '--json',
      '--non-interactive',
      '--app-version',
      '1.0.0',
    ]);
  });

  it('reads currentPage from update:list and the new group from update:republish', async () => {
    const runner = fakeRunner(({ args }) =>
      args[0] === 'update:list'
        ? json({ name: 'production', currentPage: [{ group: 'g1' }] })
        : json([{ id: 'u', group: 'g2', platform: 'ios' }]),
    );
    expect(await listUpdateGroups(runner, 'production', 'ios', 'abc', 1)).toEqual([
      { group: 'g1' },
    ]);
    expect(await republishGroup(runner, 'g1', 'ios', 'Rollback: drill')).toBe('g2');
  });

  it('keeps fingerprint:compare output from its verdict line on', async () => {
    const runner = fakeRunner(() => ({
      code: 0,
      stdout:
        'Using environment: production\n🔄 Fingerprint a616db89 from ANDROID build differs\n📁 modified file: .gitignore',
      stderr: '- Computing project fingerprint\n',
    }));
    expect(await explainMismatch(runner, 'b1')).toBe(
      '🔄 Fingerprint a616db89 from ANDROID build differs\n📁 modified file: .gitignore',
    );
  });
});
