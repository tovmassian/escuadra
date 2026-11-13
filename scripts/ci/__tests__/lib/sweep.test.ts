import { describe, expect, it } from 'vitest';
import {
  BODY_LIMIT,
  SWEEP_MARKER,
  isSweepBranch,
  sweepBody,
  sweepBranch,
  teamBlocks,
  teamsWithNewPlayers,
  type SweepView,
} from '../../lib/sweep.ts';

// squadctl's own output, as `fetch` and `apply` print it (trimmed from a real nation sweep).
const FETCH = [
  'fetch: 4 team(s) -> /tmp/envelopes',
  '  aus: 24 members from "Current squad"',
  '  tga: FAILED — Manase Talakai: pos="" is not one of GK/DF/MF/FW',
  '  uzb: 26 members from "Current squad"',
  '      warning:  shirt number 5 listed for Rustam Ashurmatov and Jakhongir Urozov — written without a number',
  '  zam: 27 members from "Current squad"',
  'fetch: 3 fetched, 1 failed',
  'next:     npm run squadctl -- apply /tmp/envelopes --dry-run',
  '          drop --dry-run to write',
].join('\n');

const APPLY = [
  '  afg: unchanged — 23 parsed, 0 new, 0 departed',
  '      warning:  5 member(s) with no shirt number',
  '  aus: conflicted (verified: false) — 24 parsed, 7 new, 11 departed',
  '      conflict: roster changed 54% against the stored squad',
  '      warning:  7 new player id(s): tom-glover, joe-gauci',
  '  atm: conflicted (verified: false) — 25 parsed, 1 new, 1 departed',
  '      conflict: possible rename — stored "Álex Grimaldo" (grimaldo) left the squad, source lists "Alejandro Grimaldo"',
  '      fix:      one person:  npm run squadctl -- rename grimaldo "Alejandro Grimaldo"',
  '  uzb: written — 26 parsed, 4 new, 4 departed',
  '      warning:  4 new player id(s): rustam-ashurmatov, dilshod-murtozoev',
  '  fro: written — 24 parsed, 0 new, 5 departed',
  '  zam: held — 0 of 27 members numbered; a round asks 10',
  '  xyz: FAILED — no identity colour',
  'apply: 2 written, 1 unchanged, 2 conflicted, 1 held, 1 failed, 552 orphans',
  '2 team(s) need a decision before they can verify — run the fix above, then re-run apply.',
  'next:     npm run squadctl -- enrich --only aus,uzb',
].join('\n');

const view = (over: Partial<SweepView> = {}): SweepView => ({
  base: 'release/2.0.0',
  branch: 'data/sweep-2026-11-16',
  runUrl: 'https://github.com/tovmassian/escuadra/actions/runs/1',
  fetch: FETCH,
  apply: APPLY,
  enrich: { teams: ['aus', 'uzb'], code: 0, output: '  photos:   3 found · 1 none' },
  ...over,
});

describe('sweep naming', () => {
  it('dates the branch', () => {
    expect(sweepBranch('2026-11-16')).toBe('data/sweep-2026-11-16');
  });

  it('knows its own branches and nobody else’s', () => {
    expect(isSweepBranch('data/sweep-2026-11-16')).toBe(true);
    expect(isSweepBranch('data/162-fifa-nations')).toBe(false);
  });
});

describe('teamBlocks', () => {
  it('groups each team line with its indented details', () => {
    const blocks = teamBlocks(APPLY);
    expect(blocks.map((b) => `${b.id}:${b.status}`)).toEqual([
      'afg:unchanged',
      'aus:conflicted',
      'atm:conflicted',
      'uzb:written',
      'fro:written',
      'zam:held',
      'xyz:failed',
    ]);
    expect(blocks[2]?.lines).toHaveLength(3);
  });

  it("reads fetch's report too: a fetched team is ok", () => {
    expect(teamBlocks(FETCH).map((b) => `${b.id}:${b.status}`)).toEqual([
      'aus:ok',
      'tga:failed',
      'uzb:ok',
      'zam:ok',
    ]);
  });

  it('drops colour codes', () => {
    expect(teamBlocks('  \u001b[31maus\u001b[39m: \u001b[1mFAILED\u001b[22m — x')[0]?.status).toBe(
      'failed',
    );
  });
});

describe('teamsWithNewPlayers', () => {
  it('names the teams that added player records, which enrich must look up', () => {
    expect(teamsWithNewPlayers(APPLY)).toEqual(['aus', 'uzb']);
  });

  it('is empty when nobody new arrived', () => {
    expect(teamsWithNewPlayers('  afg: unchanged — 23 parsed, 0 new, 0 departed')).toEqual([]);
  });
});

describe('sweepBody', () => {
  it('leads with what to do before merging and how merging ships it', () => {
    const body = sweepBody(view());
    expect(body.startsWith(SWEEP_MARKER)).toBe(true);
    expect(body).toContain('`release/2.0.0`');
    expect(body).toContain('`ota:android`');
    expect(body).toContain('`release-gate`');
    expect(body).toContain('verified');
  });

  it('puts conflicted and failed teams first, with their fix commands', () => {
    const body = sweepBody(view());
    const needs = body.slice(body.indexOf('Needs a decision'), body.indexOf('<details>'));
    expect(needs).toContain('aus: conflicted');
    expect(needs).toContain('rename grimaldo "Alejandro Grimaldo"');
    expect(needs).toContain('xyz: FAILED');
    expect(needs).toContain('tga: FAILED');
    expect(needs).not.toContain('uzb: written');
  });

  it('lists written and held teams, and never the unchanged ones', () => {
    const body = sweepBody(view());
    expect(body).toContain('uzb: written');
    expect(body).toContain('zam: held');
    expect(body).not.toContain('afg');
  });

  it('carries the totals', () => {
    expect(sweepBody(view())).toContain('apply: 2 written, 1 unchanged, 2 conflicted');
    expect(sweepBody(view())).toContain('fetch: 3 fetched, 1 failed');
  });

  it('says when nothing needs a decision', () => {
    const body = sweepBody(
      view({ apply: '  uzb: written — 26 parsed, 4 new, 4 departed', fetch: '' }),
    );
    expect(body).toContain('Nothing needs a decision');
  });

  it("gives the local enrich command when Wikimedia couldn't be reached", () => {
    const body = sweepBody(view({ enrich: { teams: ['aus', 'uzb'], code: 1, output: '' } }));
    expect(body).toContain('node tools/squadctl/bin/dev.js enrich --only aus,uzb');
    expect(body).toContain('no photo yet');
  });

  it('lists birth conflicts enrich held photos for', () => {
    const body = sweepBody(
      view({
        enrich: {
          teams: ['aus'],
          code: 4,
          output: '  conflict: birth date on torres ("Ferran Torres") — stored 1998-02-29',
        },
      }),
    );
    expect(body).toContain('birth date on torres');
  });

  it('says nothing about photos when nobody new arrived', () => {
    expect(sweepBody(view({ enrich: undefined }))).not.toContain('enrich');
  });

  it('stays under GitHub’s body limit, pointing at the run for the rest', () => {
    const many = Array.from(
      { length: 4000 },
      (_, i) => `  t${i}: written — 26 parsed, 4 new, 4 departed`,
    ).join('\n');
    const body = sweepBody(view({ apply: many }));
    expect(body.length).toBeLessThanOrEqual(BODY_LIMIT);
    expect(body).toContain('actions/runs/1');
  });
});
