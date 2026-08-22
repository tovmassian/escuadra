import { describe, expect, it } from 'vitest';
import { teamProgress } from './pickerView';

describe('teamProgress', () => {
  it('returns null for a team that has never been played', () => {
    expect(teamProgress('bar', {})).toBeNull();
  });

  it('reports the only played level', () => {
    expect(teamProgress('bar', { 'bar:1': 7 })).toEqual({
      level: 1,
      correct: 7,
      total: 10,
      cleared: false,
    });
  });

  it('reports the highest level played, not the highest score', () => {
    // Level 3 is the meaningful progress marker even though level 1 scored higher.
    const progress = teamProgress('bar', { 'bar:1': 10, 'bar:3': 4 });
    expect(progress?.level).toBe(3);
    expect(progress?.correct).toBe(4);
  });

  it('marks a team cleared once a level is passed at 8/10', () => {
    expect(teamProgress('bar', { 'bar:1': 8 })?.cleared).toBe(true);
  });

  it('does not mark a team cleared below the pass ratio', () => {
    expect(teamProgress('bar', { 'bar:1': 7 })?.cleared).toBe(false);
  });

  it('marks cleared from any level, not only the highest played', () => {
    // Passed L1, then started L2 and did badly — the team is still cleared.
    expect(teamProgress('bar', { 'bar:1': 9, 'bar:2': 2 })?.cleared).toBe(true);
  });

  it('does not leak progress between squads', () => {
    expect(teamProgress('rma', { 'bar:1': 9 })).toBeNull();
  });

  it('treats a legitimate zero score as played', () => {
    expect(teamProgress('bar', { 'bar:1': 0 })).toEqual({
      level: 1,
      correct: 0,
      total: 10,
      cleared: false,
    });
  });
});
