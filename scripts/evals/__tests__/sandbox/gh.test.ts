// scripts/evals/__tests__/sandbox/gh.test.ts
import { describe, expect, it } from 'vitest';
import {
  handle,
  isWrite,
  type IssueFixture,
  type Jq,
  type PrFixture,
  type Store,
} from '../../sandbox/gh.ts';

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

const pr9101: PrFixture = {
  number: 9101,
  title: 'fix(play): progress bar reaches 10 before Results (#9008)',
  state: 'OPEN',
  headRefName: 'fix/9008-progress-bar-last-step',
  baseRefName: 'main',
  body: 'Closes #9008',
};
const WITH_PR: Store = {
  ...STORE,
  prs: [pr9101],
  currentBranch: 'fix/9008-progress-bar-last-step',
};
const ghPr = (...args: string[]) => handle(args, WITH_PR, jq);

describe('pull requests', () => {
  it('lists open PRs, filtered by --head and --search', () => {
    expect(numbers(ghPr('pr', 'list', '--json', 'number').stdout)).toEqual([9101]);
    expect(numbers(ghPr('pr', 'list', '--head', 'fix/other', '--json', 'number').stdout)).toEqual(
      [],
    );
    expect(numbers(ghPr('pr', 'list', '--search', '9008', '--json', 'number').stdout)).toEqual([
      9101,
    ]);
  });

  it('views a PR by number, by branch, and for the current branch', () => {
    for (const ref of [['9101'], ['fix/9008-progress-bar-last-step'], []]) {
      expect(JSON.parse(ghPr('pr', 'view', ...ref, '--json', 'number').stdout)).toEqual({
        number: 9101,
      });
    }
  });

  it('fails for a branch with no PR', () => {
    expect(ghPr('pr', 'view', 'fix/none').code).toBe(1);
  });

  it('fails for a number with no PR as gh does, not as a branch', () => {
    const result = ghPr('pr', 'view', '9999');
    expect(result.code).toBe(1);
    expect(result.stderr).toBe(
      'GraphQL: Could not resolve to a PullRequest with the number of 9999. (repository.pullRequest)\n',
    );
  });

  it('lists merged PRs with --state merged, and only then', () => {
    const merged: Store = {
      ...WITH_PR,
      prs: [...WITH_PR.prs, { ...pr9101, number: 9100, state: 'MERGED', headRefName: 'feat/x' }],
    };
    const list = (...args: string[]) =>
      numbers(handle(['pr', 'list', ...args, '--json', 'number'], merged, jq).stdout);
    expect(list('--state', 'merged')).toEqual([9100]);
    expect(list()).toEqual([9101]);
    expect(list('--state', 'all')).toEqual([9101, 9100]);
  });

  it('logs a read it cannot answer as unsupported', () => {
    expect(ghPr('pr', 'diff', '9101').log).toBe('UNSUPPORTED gh pr diff 9101');
  });
});

describe('api', () => {
  const sizeQuery =
    'query($n:Int!){ repository(owner:"tovmassian", name:"escuadra"){ issue(number:$n){ projectItems(first:5){ nodes { fieldValueByName(name:"Size"){ ... on ProjectV2ItemFieldSingleSelectValue { name } } } } } } }';

  it('answers a GraphQL issue query with the board Size', () => {
    const result = gh('api', 'graphql', '-f', `query=${sizeQuery}`, '-F', 'n=126');
    const body = JSON.parse(result.stdout) as {
      data: { repository: { issue: { projectItems: { nodes: { fieldValueByName: unknown }[] } } } };
    };
    expect(body.data.repository.issue.projectItems.nodes[0]?.fieldValueByName).toEqual({
      name: 'S',
    });
    expect(result.log.startsWith('READ gh api graphql')).toBe(true);
  });

  it('finds a number written into the query, and gives null for no Size', () => {
    const query =
      'query={ repository(owner:"tovmassian",name:"escuadra"){ issue(number: 9009){ title } } }';
    const body = JSON.parse(gh('api', 'graphql', '-f', query).stdout) as {
      data: {
        repository: {
          issue: { title: string; projectItems: { nodes: { fieldValueByName: unknown }[] } };
        };
      };
    };
    expect(body.data.repository.issue.title).toBe('fix(theme): toggle label');
    expect(body.data.repository.issue.projectItems.nodes[0]?.fieldValueByName).toBeNull();
  });

  it('lists milestones and reads an issue over REST', () => {
    expect(JSON.parse(gh('api', 'repos/tovmassian/escuadra/milestones').stdout)).toEqual([
      { number: 1, title: 'v2.0.0', state: 'open' },
    ]);
    const issue = JSON.parse(gh('api', 'repos/tovmassian/escuadra/issues/115').stdout) as {
      state: string;
    };
    expect(issue.state).toBe('closed');
  });

  it('treats an API path it does not serve as unsupported', () => {
    expect(gh('api', 'user').log).toBe('UNSUPPORTED gh api user');
  });
});
