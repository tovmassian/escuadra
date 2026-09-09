import { describe, expect, it } from 'vitest';
import {
  EMPTY_DECISIONS,
  addAlias,
  addSplit,
  addTitleAlias,
  validateDecisions,
  type DecisionFile,
} from './decisions.ts';

const split = { team: 'arg', departed: 'gonzalez', arrived: 'Nicolás González' };

describe('addSplit', () => {
  it('records a decision', () => {
    expect(addSplit(EMPTY_DECISIONS, split)?.splits).toEqual([split]);
  });

  // Re-running after a failed apply must not pile up entries.
  it('is idempotent, returning null when the decision is already recorded', () => {
    const once = addSplit(EMPTY_DECISIONS, split);
    expect(once).not.toBeNull();
    expect(addSplit(once!, split)).toBeNull();
  });

  it('keeps entries sorted so the file does not churn', () => {
    const a = addSplit(EMPTY_DECISIONS, { team: 'psg', departed: 'z', arrived: 'Z' })!;
    const b = addSplit(a, split)!;
    expect(b.splits.map((s) => s.team)).toEqual(['arg', 'psg']);
  });

  it('does not mutate the file it was given', () => {
    addSplit(EMPTY_DECISIONS, split);
    expect(EMPTY_DECISIONS.splits).toEqual([]);
  });
});

describe('validateDecisions', () => {
  it('accepts a well-formed file', () => {
    expect(validateDecisions({ splits: [split] })).toEqual([]);
  });

  it('rejects a missing splits array or a malformed entry', () => {
    expect(validateDecisions({})).toHaveLength(1);
    expect(validateDecisions({ splits: [{ team: 'arg' }] }).join()).toContain('departed');
  });
});

describe('addAlias', () => {
  const alias = { player: 'grimaldo', name: 'Alejandro Grimaldo' };

  // Atlético writes "Alejandro Grimaldo", Spain writes "Álex Grimaldo", and
  // both are right. rename only moves the conflict to the other squad and
  // split asserts something false, so this is the only truthful answer.
  it('records a second name for one player', () => {
    expect(addAlias(EMPTY_DECISIONS, alias)?.aliases).toEqual([alias]);
  });

  it('is idempotent', () => {
    const once = addAlias(EMPTY_DECISIONS, alias)!;
    expect(addAlias(once, alias)).toBeNull();
  });

  it('does not disturb recorded splits', () => {
    const withSplit = addSplit(EMPTY_DECISIONS, split)!;
    expect(addAlias(withSplit, alias)?.splits).toEqual([split]);
  });
});

describe('addTitleAlias', () => {
  const empty: DecisionFile = { splits: [], aliases: [], titleAliases: [] };

  it('records an extra article title one player is known by', () => {
    const updated = addTitleAlias(empty, { player: 'grimaldo', title: 'Alejandro Grimaldo' });
    expect(updated?.titleAliases).toEqual([{ player: 'grimaldo', title: 'Alejandro Grimaldo' }]);
  });

  it('is idempotent, so re-running after a failed apply piles up nothing', () => {
    const once = addTitleAlias(empty, { player: 'grimaldo', title: 'Alejandro Grimaldo' });
    expect(addTitleAlias(once!, { player: 'grimaldo', title: 'Alejandro Grimaldo' })).toBeNull();
  });

  it('sorts, so two people editing the file do not fight over order', () => {
    const a = addTitleAlias(empty, { player: 'zubimendi', title: 'Martín Zubimendi' })!;
    const b = addTitleAlias(a, { player: 'grimaldo', title: 'Alejandro Grimaldo' })!;
    expect(b.titleAliases?.map((t) => t.player)).toEqual(['grimaldo', 'zubimendi']);
  });

  it('leaves an older file that predates the field alone', () => {
    const updated = addTitleAlias(
      { splits: [], aliases: [] },
      {
        player: 'grimaldo',
        title: 'Alejandro Grimaldo',
      },
    );
    expect(updated?.titleAliases).toHaveLength(1);
  });
});

describe('validateDecisions with titleAliases', () => {
  it('accepts a file with no titleAliases at all', () => {
    expect(validateDecisions({ splits: [], aliases: [] })).toEqual([]);
  });

  it('rejects a non-array titleAliases', () => {
    expect(validateDecisions({ splits: [], titleAliases: 'nope' })).toEqual([
      'decisions.json "titleAliases" must be an array when present',
    ]);
  });

  it('names the offending entry and field', () => {
    expect(validateDecisions({ splits: [], titleAliases: [{ player: 'x' }] })).toEqual([
      'titleAliases[0].title must be a non-empty string',
    ]);
  });

  // Tests that entry-level errors from different arrays accumulate together,
  // not that the guard placement prevents errors being discarded (the guard
  // returns a literal array, so placement never affects it).
  it('accumulates entry-level errors across aliases and splits sections', () => {
    const result = validateDecisions({
      splits: [{ team: 'arg' }],
      aliases: [{ player: 'x' }],
    });
    expect(result).toContain('aliases[0].name must be a non-empty string');
    expect(result).toContain('splits[0].departed must be a non-empty string');
    expect(result).toContain('splits[0].arrived must be a non-empty string');
  });

  // Same as above: confirms entry-level errors from multiple arrays accumulate.
  // Not a regression guard for the guard move, since the move changes no
  // observable output (the guard returns a literal array, not one that
  // includes accumulated state).
  it('accumulates entry-level errors across titleAliases and splits sections', () => {
    const result = validateDecisions({
      splits: [{ team: 'arg' }],
      titleAliases: [{ player: 'x' }],
    });
    expect(result).toContain('titleAliases[0].title must be a non-empty string');
    expect(result).toContain('splits[0].departed must be a non-empty string');
    expect(result).toContain('splits[0].arrived must be a non-empty string');
  });
});
