// scripts/evals/__tests__/sandbox/gh.test.ts
import { describe, expect, it } from 'vitest';
import { handle, isWrite, type IssueFixture, type Jq, type Store } from '../../sandbox/gh.ts';

function issue(fields: Partial<IssueFixture> & Pick<IssueFixture, 'number'>): IssueFixture {
  return {
    title: `Issue ${fields.number}`,
    state: 'OPEN',
    body: 'Body.',
    comments: [],
    labels: [],
    milestone: null,
    size: null,
    source: 'synthetic',
    why: 'test',
    ...fields,
  };
}

const STORE: Store = {
  issues: [
    issue({
      number: 126,
      title: 'fix: photo credits are cut off',
      labels: ['bug'],
      milestone: 'v2.0.0',
      size: 'S',
      body: 'Credits clip on iPhone.',
      comments: [{ author: 'tovmassian', body: 'Seen on a 17.' }],
    }),
    issue({ number: 115, title: 'feat(study): player cards', state: 'CLOSED', size: 'L' }),
    issue({ number: 9009, title: 'fix(theme): toggle label' }),
  ],
  prs: [],
  currentBranch: 'main',
};

// Echoes the expression, so a test can see that --jq reached jq with the right JSON.
const jq: Jq = (input, expression) => {
  const value = JSON.parse(input) as { title?: string };
  return `jq(${expression}) on ${value.title ?? 'a list'}\n`;
};
const gh = (...args: string[]) => handle(args, STORE, jq);
const numbers = (stdout: string) =>
  (JSON.parse(stdout) as { number: number }[]).map((item) => item.number);

describe('issue view', () => {
  it('prints only the --json fields asked for, and logs a read', () => {
    const result = gh('issue', 'view', '126', '--json', 'title,state,milestone');
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      title: 'fix: photo credits are cut off',
      state: 'OPEN',
      milestone: { title: 'v2.0.0' },
    });
    expect(result.log).toBe('READ gh issue view 126 --json title,state,milestone');
  });

  it('accepts #N and an issue URL', () => {
    expect(gh('issue', 'view', '#126', '--json', 'number').stdout).toContain('126');
    const url = 'https://github.com/tovmassian/escuadra/issues/126';
    expect(gh('issue', 'view', url, '--json', 'number').stdout).toContain('126');
  });

  it('hands --jq the selected JSON', () => {
    expect(gh('issue', 'view', '126', '--json', 'title', '--jq', '.title').stdout).toBe(
      'jq(.title) on fix: photo credits are cut off\n',
    );
  });

  it('names a field it does not have, as gh does', () => {
    const result = gh('issue', 'view', '126', '--json', 'size');
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Unknown JSON field: "size"');
  });

  it('prints the issue as text, comments included with --comments', () => {
    const text = gh('issue', 'view', '126', '--comments').stdout;
    expect(text).toContain('fix: photo credits are cut off #126');
    expect(text).toContain('Milestone: v2.0.0');
    expect(text).toContain('Credits clip on iPhone.');
    expect(text).toContain('Seen on a 17.');
  });

  it('fails for an issue the case has no fixture for', () => {
    const result = gh('issue', 'view', '42');
    expect(result.code).toBe(1);
    expect(result.log).toBe('READ gh issue view 42');
  });
});

describe('issue list', () => {
  it('lists open issues, newest first', () => {
    expect(numbers(gh('issue', 'list', '--json', 'number').stdout)).toEqual([9009, 126]);
  });

  it('includes closed issues with --state all', () => {
    expect(numbers(gh('issue', 'list', '--state', 'all', '--json', 'number').stdout)).toEqual([
      9009, 126, 115,
    ]);
  });

  it('filters by the words of --search, ignoring qualifiers', () => {
    const result = gh('issue', 'list', '--search', 'credits is:open', '--json', 'number');
    expect(numbers(result.stdout)).toEqual([126]);
  });
});

describe('writes', () => {
  it.each([
    ['pr', 'create', '--title', 'x', '--body', 'y'],
    ['issue', 'comment', '126', '--body', 'hi'],
    ['issue', 'edit', '126', '--add-label', 'bug'],
    ['project', 'item-edit', '--id', 'X'],
    ['api', 'repos/tovmassian/escuadra/issues/126/comments', '-f', 'body=hi'],
    ['api', '-X', 'PATCH', 'repos/tovmassian/escuadra/issues/126'],
    ['api', 'graphql', '-f', 'query=mutation { addComment(input: {}) { clientMutationId } }'],
  ])('refuses and logs gh %s %s', (...args: string[]) => {
    const result = gh(...args);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('dry run');
    expect(result.log.startsWith(`WRITE gh ${args[0]} `)).toBe(true);
  });

  it('treats a GraphQL query and a plain GET as reads', () => {
    expect(isWrite(['api', 'graphql', '-f', 'query=query { viewer { login } }'])).toBe(false);
    expect(isWrite(['api', 'repos/tovmassian/escuadra/milestones'])).toBe(false);
    expect(isWrite(['api', '-X', 'GET', 'search/issues', '-f', 'q=credits'])).toBe(false);
  });
});

describe('everything else', () => {
  it('logs an unsupported command and fails', () => {
    const result = gh('browse');
    expect(result.code).toBe(1);
    expect(result.log).toBe('UNSUPPORTED gh browse');
  });

  it('quotes arguments that hold spaces in the log', () => {
    expect(gh('issue', 'comment', '126', '--body', 'two words').log).toBe(
      'WRITE gh issue comment 126 --body "two words"',
    );
  });

  it('answers auth status as signed in', () => {
    expect(gh('auth', 'status').stdout).toContain('Logged in to github.com');
  });
});
