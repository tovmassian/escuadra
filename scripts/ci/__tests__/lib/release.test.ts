import { describe, expect, it } from 'vitest';
import { fixture } from '../fixtures/load.ts';
import {
  gateErrors,
  lockState,
  nextPatch,
  parseReleaseBranch,
  verdictFor,
  type EasBuild,
} from '../../lib/release.ts';

const builds = fixture<EasBuild[]>('builds.json');
const IOS_1_0_0 = '8b8b8840bd6e265b91976ef4690a9ef5cb632508';
const ANDROID_1_0_0 = 'a616db8911b507fe2e4b9502b1d48e24a397a84b';

/** A production build of 1.1.0 that EAS has queued but not finished. */
function queued(runtime: string | null): EasBuild {
  return {
    id: 'queued-build',
    status: 'IN_QUEUE',
    platform: 'IOS',
    buildProfile: 'production',
    appVersion: '1.1.0',
    appBuildVersion: '4',
    runtime: { version: runtime },
    fingerprint: { hash: runtime },
    gitCommitHash: null,
    createdAt: '2026-10-01T09:00:00.000Z',
  };
}

describe('parseReleaseBranch', () => {
  it('reads X.Y.Z from release/X.Y.Z, with or without refs/heads/', () => {
    expect(parseReleaseBranch('release/1.0.0')).toBe('1.0.0');
    expect(parseReleaseBranch('refs/heads/release/1.10.2')).toBe('1.10.2');
  });

  it('rejects every other name, including the old integration branch', () => {
    const others = ['main', 'release-1.1.0', 'release/1.1', 'release/1.1.0-rc1', 'x/release/1.0.0'];
    for (const ref of others) expect(parseReleaseBranch(ref)).toBeNull();
  });
});

describe('nextPatch', () => {
  it('moves to the next patch version', () => {
    expect(nextPatch('1.0.9')).toBe('1.0.10');
  });
});

describe('lockState', () => {
  it('locks iOS 1.0.0 to build 3, the latest production build, not build 2', () => {
    const lock = lockState(builds, 'ios', '1.0.0');
    expect(lock).toMatchObject({ state: 'locked', runtime: IOS_1_0_0 });
    expect(lock.state === 'locked' ? lock.build.appBuildVersion : null).toBe('3');
  });

  it('locks Android 1.0.0 to a616db89', () => {
    expect(lockState(builds, 'android', '1.0.0')).toMatchObject({
      state: 'locked',
      runtime: ANDROID_1_0_0,
    });
  });

  it('never lets a preview build lock: the #53 build says 1.0.0 but came from the 1.1.0 branch', () => {
    const previewOnly = builds.filter((build) => build.buildProfile === 'preview');
    expect(lockState(previewOnly, 'ios', '1.0.0')).toEqual({ state: 'open' });
  });

  it('is open while no production build of the version exists', () => {
    expect(lockState(builds, 'ios', '1.1.0')).toEqual({ state: 'open' });
  });

  it('ignores errored and cancelled builds', () => {
    const failed = [
      { ...queued(IOS_1_0_0), status: 'ERRORED' },
      { ...queued(IOS_1_0_0), status: 'CANCELED' },
    ];
    expect(lockState(failed, 'ios', '1.1.0')).toEqual({ state: 'open' });
  });

  it('locks on a queued build, pending while EAS has no runtime for it', () => {
    expect(lockState([queued(null)], 'ios', '1.1.0')).toMatchObject({ state: 'pending' });
    expect(lockState([queued(IOS_1_0_0)], 'ios', '1.1.0')).toMatchObject({
      state: 'locked',
      runtime: IOS_1_0_0,
    });
  });
});

describe('verdictFor and gateErrors', () => {
  const lockedIos = lockState(builds, 'ios', '1.0.0');
  const lockedAndroid = lockState(builds, 'android', '1.0.0');

  it('passes a PR that keeps both 1.0.0 runtimes', () => {
    const verdicts = [
      verdictFor('ios', lockedIos, IOS_1_0_0),
      verdictFor('android', lockedAndroid, ANDROID_1_0_0),
    ];
    expect(verdicts.map((verdict) => verdict.kind)).toEqual(['match', 'match']);
    expect(gateErrors(verdicts, '1.0.0', false)).toEqual([]);
  });

  it('blocks a runtime change and names the version it belongs on', () => {
    const moved = 'c0a62aca64074feadd73c7042a3a9a8737a30405';
    const [error] = gateErrors([verdictFor('android', lockedAndroid, moved)], '1.0.0', false);
    expect(error).toContain('`a616db89` → `c0a62aca`');
    expect(error).toContain('`release/1.0.1` from `release/1.0.0`');
  });

  it('blocks while a production build is pending', () => {
    const pending = verdictFor('ios', lockState([queued(null)], 'ios', '1.1.0'), IOS_1_0_0);
    expect(gateErrors([pending], '1.1.0', false)).toHaveLength(1);
  });

  it('blocks commits from main only once a platform is locked', () => {
    const open = [verdictFor('ios', { state: 'open' }, IOS_1_0_0)];
    const locked = [verdictFor('ios', lockedIos, IOS_1_0_0)];
    expect(gateErrors(open, '1.1.0', true)).toEqual([]);
    expect(gateErrors(locked, '1.0.0', true)[0]).toContain('brings commits from `main`');
  });
});
