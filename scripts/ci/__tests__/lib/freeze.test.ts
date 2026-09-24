import { describe, expect, it } from 'vitest';
import { findFreeze, freezeTitle, type Issue } from '../../lib/freeze.ts';

const url = 'https://github.com/tovmassian/escuadra/issues/';
const issues: Issue[] = [
  { number: 80, title: 'OTA freeze: android@1.0.0 (Play production review, #51)', url: `${url}80` },
  { number: 81, title: 'OTA freeze: ios@1.1.0', url: `${url}81` },
  { number: 82, title: 'Discuss an OTA freeze: ios@1.0.0 policy', url: `${url}82` },
];

describe('findFreeze', () => {
  it('matches exactly one platform and version, suffix allowed', () => {
    expect(findFreeze(issues, 'android', '1.0.0')?.number).toBe(80);
    expect(findFreeze(issues, 'ios', '1.1.0')?.number).toBe(81);
  });

  it('lets other versions and platforms through, and ignores lookalike titles', () => {
    expect(findFreeze(issues, 'ios', '1.0.0')).toBeUndefined();
    expect(findFreeze(issues, 'android', '1.1.0')).toBeUndefined();
    const longer: Issue = { number: 83, title: 'OTA freeze: ios@1.0.01', url: `${url}83` };
    expect(findFreeze([longer], 'ios', '1.0.0')).toBeUndefined();
  });

  it('matches the title it writes', () => {
    const own: Issue = { number: 84, title: freezeTitle('ios', '1.0.0'), url: `${url}84` };
    expect(findFreeze([own], 'ios', '1.0.0')?.number).toBe(84);
  });
});
