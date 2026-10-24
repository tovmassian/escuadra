import { describe, expect, it } from 'vitest';
import { scoreSummary, squadScores, withoutSquad } from '@/lib/reset';

const at = (score: number) => ({ score, squadUpdated: '2026-10-01' });
const bests = {
  'arm:1': at(10),
  'arm:3': at(6),
  'arm:2': at(8),
  'ars:1': at(7),
  'arsenal-women:1': at(5),
};

describe('withoutSquad', () => {
  it("drops one squad's scores and keeps every other squad's", () => {
    expect(withoutSquad(bests, 'arm')).toEqual({
      'ars:1': at(7),
      'arsenal-women:1': at(5),
    });
  });

  it('matches the whole id, not a prefix of another', () => {
    expect(Object.keys(withoutSquad(bests, 'ars'))).toEqual([
      'arm:1',
      'arm:3',
      'arm:2',
      'arsenal-women:1',
    ]);
  });

  it('returns the same object when the squad has no scores', () => {
    expect(withoutSquad(bests, 'esp')).toBe(bests);
  });
});

describe('squadScores', () => {
  it("lists a squad's bests by level", () => {
    expect(squadScores(bests, 'arm')).toEqual([
      { level: 1, score: 10 },
      { level: 2, score: 8 },
      { level: 3, score: 6 },
    ]);
  });

  it('is empty for a squad never played', () => {
    expect(squadScores(bests, 'esp')).toEqual([]);
  });
});

describe('scoreSummary', () => {
  it('counts scores and the teams they belong to', () => {
    expect(scoreSummary(bests)).toEqual({ scores: 5, teams: 3 });
  });

  it('is zero with nothing played', () => {
    expect(scoreSummary({})).toEqual({ scores: 0, teams: 0 });
  });
});
