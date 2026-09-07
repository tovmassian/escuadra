import { describe, expect, it } from 'vitest';
import { applyCommand, displayPath } from './hints.ts';

const REPO = '/Users/x/escuadra';

describe('displayPath', () => {
  it('shortens a path inside the repo, since npm run starts from the repo root', () => {
    expect(displayPath(REPO, `${REPO}/.cache/envelopes/run-1`)).toBe('.cache/envelopes/run-1');
  });

  // A hint beginning ../../.. depends on a working directory the reader
  // cannot see, so an outside target stays absolute.
  it('keeps a path outside the repo absolute', () => {
    expect(displayPath(REPO, '/tmp/scratch/run-1')).toBe('/tmp/scratch/run-1');
  });

  it('keeps the repo root itself absolute rather than collapsing to empty', () => {
    expect(displayPath(REPO, REPO)).toBe(REPO);
  });
});

describe('applyCommand', () => {
  it('renders the runnable npm form', () => {
    expect(applyCommand(REPO, `${REPO}/.cache/envelopes/run-1`)).toBe(
      'npm run squadctl -- apply .cache/envelopes/run-1',
    );
  });

  it('adds --dry-run when asked', () => {
    expect(applyCommand(REPO, `${REPO}/.cache/envelopes/run-1`, true)).toBe(
      'npm run squadctl -- apply .cache/envelopes/run-1 --dry-run',
    );
  });
});
