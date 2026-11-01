import { describe, expect, it } from 'vitest';
import { fakeRunner, json, ok } from '../../../ci/__tests__/fake-runner.ts';
import { tickIssue, tickItems, untickedReasons } from '../../issue-runner/dod.ts';

const BODY = [
  '### Work',
  '',
  '- [ ] Add the flag',
  '- [x] Read the spec',
  '',
  '### Definition of done',
  '',
  '- [ ] The three scripts and the hook',
  '  - [ ] nested: checked on a real iPhone',
  '- [ ] `npm run check` passes',
  '* [ ] the gh-pages push, after merge',
  '',
].join('\n');

describe('tickItems', () => {
  it('ticks the named items, leaves the rest, and returns those still open', () => {
    const result = tickItems(BODY, ['The three scripts and the hook', '`npm run check` passes']);
    expect(result.body).toContain('- [x] The three scripts and the hook');
    expect(result.body).toContain('- [x] `npm run check` passes');
    expect(result.body).toContain('- [ ] Add the flag');
    expect(result.body.split('\n')).toHaveLength(BODY.split('\n').length);
    expect(result.unticked).toEqual([
      'Add the flag',
      'nested: checked on a real iPhone',
      'the gh-pages push, after merge',
    ]);
  });

  it('keeps indentation and the bullet', () => {
    const { body } = tickItems(BODY, [
      'nested: checked on a real iPhone',
      'the gh-pages push, after merge',
    ]);
    expect(body).toContain('  - [x] nested: checked on a real iPhone');
    expect(body).toContain('* [x] the gh-pages push, after merge');
  });

  it('accepts an item already ticked', () => {
    expect(tickItems(BODY, ['Read the spec']).body).toBe(BODY);
  });

  it('refuses an item that matches no checkbox, naming it', () => {
    expect(() => tickItems(BODY, ['Add the flag', 'Ship it'])).toThrow(/Ship it/);
  });

  it('refuses an item that matches two checkboxes', () => {
    const twice = `${BODY}\n- [ ] Add the flag\n`;
    expect(() => tickItems(twice, ['Add the flag'])).toThrow(/2 checkboxes/);
  });

  it('matches the whole item text, not a prefix', () => {
    expect(() => tickItems(BODY, ['The three scripts'])).toThrow(/The three scripts/);
  });
});

describe('untickedReasons', () => {
  it('prints a line per open item, with room for the PR body to say why', () => {
    expect(untickedReasons(['Checked on a real iPhone'])).toBe(
      'Unticked in the issue; say why in the PR body:\n- Checked on a real iPhone: <why>\n',
    );
    expect(untickedReasons([])).toBe('Every checkbox in the issue is ticked.\n');
  });
});

describe('tickIssue', () => {
  it('reads the body, writes it back ticked, and returns the open items', async () => {
    const runner = fakeRunner((call) => {
      if (call.args[1] === 'view') return json({ body: BODY });
      if (call.args[1] === 'edit') return ok();
      return undefined;
    });
    const unticked = await tickIssue(runner, 207, ['Add the flag']);
    expect(runner.calls[0]?.args).toEqual([
      'issue',
      'view',
      '207',
      '--repo',
      'tovmassian/escuadra',
      '--json',
      'body',
    ]);
    const edit = runner.calls[1]?.args ?? [];
    expect(edit.slice(0, 5)).toEqual(['issue', 'edit', '207', '--repo', 'tovmassian/escuadra']);
    expect(edit[edit.indexOf('--body') + 1]).toContain('- [x] Add the flag');
    expect(unticked).toContain('`npm run check` passes');
  });

  it('writes nothing when an item is unknown', async () => {
    const runner = fakeRunner((call) =>
      call.args[1] === 'view' ? json({ body: BODY }) : undefined,
    );
    await expect(tickIssue(runner, 207, ['Ship it'])).rejects.toThrow(/Ship it/);
    expect(runner.calls).toHaveLength(1);
  });

  it('skips the write when nothing changes', async () => {
    const runner = fakeRunner((call) =>
      call.args[1] === 'view' ? json({ body: BODY }) : undefined,
    );
    await tickIssue(runner, 207, ['Read the spec']);
    expect(runner.calls).toHaveLength(1);
  });
});
