import { describe, expect, it } from 'vitest';
import { cameFromMain, manualPick, pickBody, pickBranch, pickTitle } from '../../lib/pick.ts';

const SHA = '4a8b8a5c0000000000000000000000000000beef';

describe('cameFromMain', () => {
  it("recognises -x's trailer", () => {
    expect(
      cameFromMain(
        'fix: UI polish pass (#91) (#92)\n\n(cherry picked from commit b0eb46fd1234567)',
      ),
    ).toBe(true);
  });

  it('passes a commit written on the release branch', () => {
    expect(cameFromMain('fix(android): inset the icon (#94)\n\n* fix: …')).toBe(false);
  });
});

describe('pick naming', () => {
  it('names the branch after the PR', () => {
    expect(pickBranch(94)).toBe('pick/94-to-main');
  });

  it("keeps the squash commit's subject, (#N) included", () => {
    expect(pickTitle('fix(android): inset the icon (#94)\n\nbody')).toBe(
      'fix(android): inset the icon (#94)',
    );
  });
});

describe('pick text', () => {
  const view = { prNumber: 94, baseRef: 'release/1.0.1', sha: SHA };

  it('says where the pick came from and what to drop', () => {
    const body = pickBody(view);
    expect(body).toContain('`git cherry-pick -x 4a8b8a5` of #94, merged into `release/1.0.1`');
    expect(body).toContain('`app.json` version');
  });

  it('gives the full commands for a pick by hand', () => {
    expect(manualPick(view)).toContain(
      `git switch -c pick/94-to-main origin/main\ngit cherry-pick -x ${SHA}`,
    );
  });
});
