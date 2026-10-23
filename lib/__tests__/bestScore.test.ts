import { describe, expect, it } from 'vitest';
import { isOutdated, migrateBestScores, nextBest } from '@/lib/bestScore';

const OLD = '2026-08-14';
const NOW = '2026-10-21';

describe('isOutdated', () => {
  it('is false for a score set on the current squad', () => {
    expect(isOutdated({ score: 6, squadUpdated: NOW }, NOW)).toBe(false);
  });

  it('is true once the squad has been updated since', () => {
    expect(isOutdated({ score: 6, squadUpdated: OLD }, NOW)).toBe(true);
  });
});

describe('nextBest', () => {
  it('keeps a first round, even a 0/10', () => {
    expect(nextBest(undefined, 0, NOW)).toEqual({ score: 0, squadUpdated: NOW });
  });

  it('keeps the higher of two rounds on the current squad', () => {
    expect(nextBest({ score: 6, squadUpdated: NOW }, 8, NOW)).toEqual({
      score: 8,
      squadUpdated: NOW,
    });
    expect(nextBest({ score: 8, squadUpdated: NOW }, 6, NOW)).toEqual({
      score: 8,
      squadUpdated: NOW,
    });
  });

  it('keeps an equal score as it was', () => {
    const prev = { score: 7, squadUpdated: NOW };
    expect(nextBest(prev, 7, NOW)).toBe(prev);
  });

  it('replaces an outdated best with a round on the current squad, whatever its value', () => {
    expect(nextBest({ score: 10, squadUpdated: OLD }, 3, NOW)).toEqual({
      score: 3,
      squadUpdated: NOW,
    });
  });
});

describe('migrateBestScores', () => {
  const dates: Record<string, string> = { arm: NOW, 'ac-milan': OLD };
  const lastUpdatedOf = (id: string) => dates[id];

  it("stamps each score with its squad's current date, so it reads as current", () => {
    const migrated = migrateBestScores({ 'arm:1': 10, 'arm:3': 6 }, lastUpdatedOf);
    expect(migrated).toEqual({
      'arm:1': { score: 10, squadUpdated: NOW },
      'arm:3': { score: 6, squadUpdated: NOW },
    });
    expect(isOutdated(migrated['arm:1']!, NOW)).toBe(false);
  });

  it('reads the squad id from a key whose id holds a hyphen', () => {
    expect(migrateBestScores({ 'ac-milan:2': 4 }, lastUpdatedOf)).toEqual({
      'ac-milan:2': { score: 4, squadUpdated: OLD },
    });
  });

  it('keeps the score of a squad no longer in the data, with no date', () => {
    expect(migrateBestScores({ 'gone:1': 9 }, lastUpdatedOf)).toEqual({
      'gone:1': { score: 9, squadUpdated: '' },
    });
  });

  it('keeps a 0/10', () => {
    expect(migrateBestScores({ 'arm:2': 0 }, lastUpdatedOf)).toEqual({
      'arm:2': { score: 0, squadUpdated: NOW },
    });
  });
});
