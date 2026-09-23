import { describe, expect, it } from 'vitest';
import { fixture } from '../fixtures/load.ts';
import {
  alreadyPublished,
  cleanMessage,
  rollbackTarget,
  type UpdateGroupSummary,
  type UpdateInfo,
} from './updates.ts';

const history = fixture<UpdateGroupSummary[]>('updates-production.json');
const IOS = '8b8b8840bd6e265b91976ef4690a9ef5cb632508';
const ANDROID = 'a616db8911b507fe2e4b9502b1d48e24a397a84b';

describe('cleanMessage', () => {
  it('strips update:list decoration, even around nested quotes', () => {
    expect(cleanMessage('"Correct privacy text (#61)" (1 day ago by tovmassian27)')).toBe(
      'Correct privacy text (#61)',
    );
    expect(
      cleanMessage('"Republish "fix tapping" - group: 73b3" (1 week ago by tovmassian27)'),
    ).toBe('Republish "fix tapping" - group: 73b3');
    expect(cleanMessage('plain')).toBe('plain');
  });
});

describe('rollbackTarget', () => {
  it('previous: takes iOS from #61 back to the republished keyboard fix', () => {
    expect(rollbackTarget(history, 'ios', IOS, 'previous', null)).toMatchObject({
      kind: 'republish',
      from: { group: 'e43368a2-cfde-483d-a99d-fd1e9bc2691f' },
      to: { group: '02f7fad4-83fc-41f3-8a14-04892984be7d' },
    });
  });

  it("previous on today's Android history lands on the #44 test marker: why dry_run exists", () => {
    const target = rollbackTarget(history, 'android', ANDROID, 'previous', null);
    expect(target.kind === 'republish' ? cleanMessage(target.to.message) : null).toBe(
      'test(#44): OTA marker',
    );
  });

  it('never picks an update published to another runtime', () => {
    const orphan = '0e49e570-d666-4173-94b9-0e5d901ff7ee';
    expect(rollbackTarget(history, 'android', ANDROID, 'group', orphan).kind).toBe('error');
  });

  it('group: republishes a named earlier group and refuses the newest', () => {
    const earlier = '0bf0c4b2-ab28-40fd-ae16-aa5401699a17';
    const newest = '3f8c3721-9c5e-4850-b160-cfe33608dd7d';
    expect(rollbackTarget(history, 'android', ANDROID, 'group', earlier)).toMatchObject({
      kind: 'republish',
      to: { group: earlier },
    });
    expect(rollbackTarget(history, 'android', ANDROID, 'group', newest).kind).toBe('error');
  });

  it('refuses to guess when nothing earlier exists', () => {
    const onlyOne = history.filter((g) => g.group === 'e43368a2-cfde-483d-a99d-fd1e9bc2691f');
    expect(rollbackTarget(onlyOne, 'ios', IOS, 'previous', null).kind).toBe('error');
    expect(rollbackTarget([], 'ios', IOS, 'previous', null).kind).toBe('error');
  });

  it('embedded: always possible, and says what it replaces', () => {
    expect(rollbackTarget(history, 'ios', IOS, 'embedded', null)).toMatchObject({
      kind: 'embedded',
      from: { group: 'e43368a2-cfde-483d-a99d-fd1e9bc2691f' },
    });
    expect(rollbackTarget([], 'ios', IOS, 'embedded', null)).toEqual({
      kind: 'embedded',
      from: null,
    });
  });
});

describe('alreadyPublished', () => {
  const commit = 'daf142b21e841e33c8575ba3241b8a4bcdbf982b';
  const newest: UpdateInfo[] = [
    {
      id: 'u',
      group: 'g',
      platform: 'ios',
      runtimeVersion: IOS,
      gitCommitHash: commit,
      isRollBackToEmbedded: false,
    },
  ];

  it('is true only for the same platform and commit', () => {
    expect(alreadyPublished(newest, 'ios', commit)).toBe(true);
    expect(alreadyPublished(newest, 'android', commit)).toBe(false);
    expect(alreadyPublished(newest, 'ios', 'c5633fbcd25206a103cf0e5fd3a9ac9c820dc983')).toBe(false);
  });
});
