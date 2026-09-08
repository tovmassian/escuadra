import { describe, expect, it } from 'vitest';
import { EMPTY_DECISIONS, addAlias, addSplit, validateDecisions } from './decisions.ts';

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
