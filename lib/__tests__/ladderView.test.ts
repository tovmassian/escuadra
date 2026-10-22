import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import {
  focusedLevel,
  formatLastUpdated,
  heroLine,
  ladderRows,
  levelDescription,
  playLevelLabel,
  rungAccessibilityLabel,
  rungTag,
  statusLine,
  unlockHint,
} from '../ladderView';

describe('ladderRows', () => {
  it('unlocks level 1 with no history at all', () => {
    expect(ladderRows('bar', {})[0]?.status).toBe('unlocked');
  });

  it('locks levels 2 and 3 with no history at all', () => {
    const rows = ladderRows('bar', {});
    expect(rows[1]?.status).toBe('locked');
    expect(rows[2]?.status).toBe('locked');
  });

  it('keeps level 2 locked after a failed level 1', () => {
    // The results screen calls 5/10 a fail and offers a retry; the ladder
    // must agree rather than open the next level for merely finishing.
    expect(ladderRows('bar', { 'bar:1': 5 })[1]?.status).toBe('locked');
  });

  it('keeps level 2 locked one short of the pass mark', () => {
    expect(ladderRows('bar', { 'bar:1': 7 })[1]?.status).toBe('locked');
  });

  it('unlocks level 2 once level 1 reaches the pass mark', () => {
    expect(ladderRows('bar', { 'bar:1': 8 })[1]?.status).toBe('unlocked');
  });

  it('locks a level whose predecessor is locked, even if it has its own score', () => {
    // Scores recorded while the gate was lenient don't reopen a level whose
    // way in is still shut.
    const rows = ladderRows('bar', { 'bar:1': 5, 'bar:2': 9 });
    expect(rows[1]?.status).toBe('locked');
    expect(rows[2]?.status).toBe('locked');
  });

  it('reports a passed level as cleared, carrying the score', () => {
    const row = ladderRows('bar', { 'bar:1': 9 })[0];
    expect(row?.status).toBe('cleared');
    expect(row?.best).toEqual({ correct: 9, total: 10 });
  });

  it('keeps a failed level unlocked, carrying the score', () => {
    const row = ladderRows('bar', { 'bar:1': 5 })[0];
    expect(row?.status).toBe('unlocked');
    expect(row?.best).toEqual({ correct: 5, total: 10 });
  });

  it('shows no score on a locked level', () => {
    expect(ladderRows('bar', { 'bar:1': 5, 'bar:2': 9 })[1]?.best).toBeUndefined();
  });

  it('names the score that unlocks a level', () => {
    expect(unlockHint(2, en)).toBe('Score 8/10 on L1');
    expect(unlockHint(3, en)).toBe('Score 8/10 on L2');
  });

  it('carries no text in the rows', () => {
    expect(ladderRows('bar', {})[1]).toEqual({ level: 2, status: 'locked' });
  });

  it('does not leak progress between squads', () => {
    const rows = ladderRows('rma', { 'bar:1': 9 });
    expect(rows[0]?.status).toBe('unlocked');
    expect(rows[1]?.status).toBe('locked');
  });

  it('returns exactly three rows in level order', () => {
    expect(ladderRows('bar', {}).map((r) => r.level)).toEqual([1, 2, 3]);
  });
});

describe('formatLastUpdated', () => {
  it('formats an ISO date as day month year', () => {
    expect(formatLastUpdated('2026-08-21', en)).toBe('21 Aug 2026');
  });

  it('does not zero-pad the day', () => {
    expect(formatLastUpdated('2026-01-05', en)).toBe('5 Jan 2026');
  });
});

describe('focusedLevel', () => {
  it('focuses level 1 with no history at all', () => {
    expect(focusedLevel(ladderRows('bar', {}))).toBe(1);
  });

  it('focuses the next level once the one before it is cleared', () => {
    expect(focusedLevel(ladderRows('bar', { 'bar:1': 9 }))).toBe(2);
  });

  it('stays on a failed level, for a retry', () => {
    expect(focusedLevel(ladderRows('bar', { 'bar:1': 5 }))).toBe(1);
  });

  it('focuses the last level, as a replay, once every level is cleared', () => {
    expect(focusedLevel(ladderRows('bar', { 'bar:1': 9, 'bar:2': 8, 'bar:3': 8 }))).toBe(3);
  });

  it('falls back to level 1 for an empty ladder', () => {
    expect(focusedLevel([])).toBe(1);
  });
});

describe('rungAccessibilityLabel', () => {
  it('announces a cleared rung with its best score and cleared', () => {
    const row = { level: 1, status: 'cleared', best: { correct: 8, total: 10 } } as const;
    expect(rungAccessibilityLabel(row, 'Name from Number', en)).toBe(
      'Name from Number, best 8 of 10, cleared',
    );
  });

  it('announces a 10/10 rung as a la escuadra', () => {
    const row = { level: 1, status: 'cleared', best: { correct: 10, total: 10 } } as const;
    expect(rungAccessibilityLabel(row, 'Name from Number', en)).toBe(
      'Name from Number, best 10 of 10, a la escuadra',
    );
  });

  it('announces a locked rung with what unlocks it', () => {
    const row = { level: 3, status: 'locked' } as const;
    expect(rungAccessibilityLabel(row, 'Full Profile', en)).toBe(
      'Full Profile, locked, score 8 of 10 on level 2',
    );
  });

  it('announces an unlocked rung by its title alone', () => {
    expect(rungAccessibilityLabel({ level: 2, status: 'unlocked' }, 'Name + Position', en)).toBe(
      'Name + Position',
    );
  });
});

describe('the ladder a player sees (#178 Test)', () => {
  // One club squad and one nation squad; scoreKey is `${squadId}:${level}`.
  for (const id of ['rma', 'arm']) {
    it(`${id}: a newcomer has level 1 open and focused, 2 and 3 locked`, () => {
      const rows = ladderRows(id, {});
      expect(rows.map((r) => r.status)).toEqual(['unlocked', 'locked', 'locked']);
      expect(focusedLevel(rows)).toBe(1);
    });

    it(`${id}: part way up, cleared rungs below the focused level`, () => {
      const rows = ladderRows(id, { [`${id}:1`]: 10, [`${id}:2`]: 8, [`${id}:3`]: 6 });
      expect(rows.map((r) => r.status)).toEqual(['cleared', 'cleared', 'unlocked']);
      expect(focusedLevel(rows)).toBe(3);
      expect(rows.map((r) => r.best && rungTag(r.best))).toEqual([
        'escuadra',
        'cleared',
        'cleared',
      ]);
    });

    it(`${id}: all three cleared, level 3 focused for a replay`, () => {
      const rows = ladderRows(id, { [`${id}:1`]: 9, [`${id}:2`]: 10, [`${id}:3`]: 8 });
      expect(rows.every((r) => r.status === 'cleared')).toBe(true);
      expect(focusedLevel(rows)).toBe(3);
    });
  }
});

describe('heroLine', () => {
  const members = Array.from({ length: 26 }, () => ({}) as never);
  it('reads national team, season and count for a nation', () => {
    expect(heroLine({ kind: 'nation', season: '2026', members }, undefined, en)).toBe(
      'National team · 2026 · 26 players',
    );
  });
  it('reads the league for a club', () => {
    expect(heroLine({ kind: 'club', season: '2025-26', members }, 'premier-league', en)).toBe(
      'Premier League · 2025-26 · 26 players',
    );
  });
  it('reads UCL for a club with no big-five league', () => {
    expect(heroLine({ kind: 'club', season: '2025-26', members }, 'ucl', en)).toBe(
      'UCL · 2025-26 · 26 players',
    );
  });
  it('leaves the league out when a club has none', () => {
    expect(heroLine({ kind: 'club', season: '2025-26', members }, undefined, en)).toBe(
      '2025-26 · 26 players',
    );
  });
});

describe('levelDescription', () => {
  it('ends level 3 with club for a nation squad', () => {
    expect(levelDescription(3, 'nation', en)).toBe(en.ladder.levels[3].descriptionNation);
    expect(levelDescription(3, 'nation', en)).toMatch(/club\.$/);
  });
  it('ends level 3 with nationality for a club squad', () => {
    expect(levelDescription(3, 'club', en)).toMatch(/nationality\.$/);
  });
  it('is the same for both kinds below level 3', () => {
    expect(levelDescription(1, 'club', en)).toBe(levelDescription(1, 'nation', en));
    expect(levelDescription(2, 'club', en)).toBe(en.ladder.levels[2].description);
  });
});

describe('rungTag', () => {
  it('is escuadra at 10/10', () => expect(rungTag({ correct: 10, total: 10 })).toBe('escuadra'));
  it('is cleared at 9 and 8', () => {
    expect(rungTag({ correct: 9, total: 10 })).toBe('cleared');
    expect(rungTag({ correct: 8, total: 10 })).toBe('cleared');
  });
});

describe('statusLine', () => {
  it('reads not played yet with no best', () => {
    expect(statusLine({ level: 1, status: 'unlocked' }, en)).toEqual({
      text: 'Not played yet',
      spoken: 'Not played yet',
    });
  });
  it('reads the best, written and spoken', () => {
    const row = { level: 3, status: 'unlocked', best: { correct: 6, total: 10 } } as const;
    expect(statusLine(row, en)).toEqual({ text: 'Your best · 6/10', spoken: 'Your best, 6 of 10' });
  });
});

describe('playLevelLabel', () => {
  it('names the level', () => expect(playLevelLabel(2, en)).toBe('Play level 2'));
});
