// scripts/evals/sandbox/gh.ts
// The GitHub CLI inside an eval sandbox (spec §5.1). It answers reads from the
// case's fixtures, refuses every write, and returns the gh.log line either way,
// so a grader can tell a run that tried to write. Copied into each sandbox next
// to gh-cli.ts, so it imports nothing but Node built-ins.

export interface IssueFixture {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED';
  body: string;
  comments: { author: string; body: string }[];
  labels: string[];
  milestone: string | null;
  /** The board's Size field, or null when the issue has none. */
  size: string | null;
  /** "real snapshot YYYY-MM-DD…" or "synthetic". */
  source: string;
  /** What the cases that load it test. */
  why: string;
}

export interface PrFixture {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  headRefName: string;
  baseRefName: string;
  body: string;
}

export interface Store {
  issues: IssueFixture[];
  prs: PrFixture[];
  /** The checked-out branch, for `gh pr view` with no argument. */
  currentBranch: string | null;
}

export interface GhResult {
  code: number;
  stdout: string;
  stderr: string;
  /** The gh.log line: READ, WRITE or UNSUPPORTED, then the command. */
  log: string;
}

/** Runs a jq expression over JSON text and returns its raw output, as `gh --jq` does. */
export type Jq = (input: string, expression: string) => string;

type Json = string | number | boolean | null | Json[] | JsonObject;
interface JsonObject {
  [key: string]: Json;
}
type Answer = Omit<GhResult, 'log'>;

interface Parsed {
  positional: string[];
  flags: Map<string, string[]>;
  switches: Set<string>;
}

const OWNER = 'tovmassian';
const REPO = `${OWNER}/escuadra`;
const WEB = `https://github.com/${REPO}`;

// The verbs that only read. Any other verb of these groups writes.
const READS: Record<string, string[]> = {
  issue: ['view', 'list', 'status'],
  pr: ['view', 'list', 'status', 'diff', 'checks'],
  repo: ['view'],
  auth: ['status'],
  project: ['view', 'list', 'field-list', 'item-list'],
  label: ['list'],
  release: ['view', 'list'],
  run: ['view', 'list'],
  workflow: ['view', 'list'],
  search: ['issues', 'prs', 'code', 'commits', 'repos'],
  gist: ['view', 'list'],
  secret: ['list'],
  variable: ['list'],
};

const VALUED = new Set([
  '--json',
  '--jq',
  '-q',
  '--template',
  '-t',
  '--repo',
  '-R',
  '--state',
  '-s',
  '--limit',
  '-L',
  '--search',
  '-S',
  '--head',
  '-H',
  '--base',
  '-B',
  '--label',
  '-l',
  '--assignee',
  '-a',
  '--author',
  '-A',
  '--milestone',
  '-m',
]);

const API_VALUED = new Set([
  '--method',
  '-X',
  '--field',
  '-F',
  '--raw-field',
  '-f',
  '--header',
  '-H',
  '--jq',
  '-q',
  '--template',
  '-t',
  '--input',
  '--hostname',
  '--cache',
  '--preview',
  '-p',
]);

export function handle(args: string[], store: Store, jq: Jq): GhResult {
  const log = (kind: string) => `${kind} gh ${args.map(quote).join(' ')}`;
  if (isWrite(args)) {
    return {
      code: 1,
      stdout: '',
      stderr: 'gh (sandbox): this is a dry run, so writes to GitHub are refused.\n',
      log: log('WRITE'),
    };
  }
  const answer = read(args, store, jq);
  if (answer === null) {
    const command = args.slice(0, 2).join(' ');
    return {
      code: 1,
      stdout: '',
      stderr: `gh (sandbox): \`gh ${command}\` is not supported here.\n`,
      log: log('UNSUPPORTED'),
    };
  }
  return { ...answer, log: log('READ') };
}

export function isWrite(args: string[]): boolean {
  const [group = '', verb = ''] = args;
  if (group === 'api') return apiWrites(parse(args.slice(1), API_VALUED));
  const reads = READS[group];
  return reads !== undefined && !reads.includes(verb);
}

function read(args: string[], store: Store, jq: Jq): Answer | null {
  const [group, verb] = args;
  const flags = () => parse(args.slice(2), VALUED);
  if (group === 'issue' && verb === 'view') return issueView(flags(), store, jq);
  if (group === 'issue' && verb === 'list') return issueList(flags(), store, jq);
  if (group === 'auth' && verb === 'status') {
    return ok(`github.com\n  ✓ Logged in to github.com account ${OWNER} (sandbox)\n`);
  }
  return null;
}

// `gh api` sends POST once fields are given, unless --method says otherwise;
// a GraphQL call reads unless its query is a mutation.
function apiWrites(p: Parsed): boolean {
  const fields = fieldPairs(p);
  if (p.positional[0] === 'graphql') return /\bmutation\b/.test(fields.get('query') ?? '');
  const method = first(p, '--method', '-X') ?? (fields.size > 0 ? 'POST' : 'GET');
  return method.toUpperCase() !== 'GET';
}

function issueView(p: Parsed, store: Store, jq: Jq): Answer {
  const ref = p.positional[0] ?? '';
  const issue = findIssue(store, ref);
  if (!issue) {
    return fail(
      `GraphQL: Could not resolve to an issue or pull request with the number of ${ref}. (repository.issue)\n`,
    );
  }
  const withComments = p.switches.has('--comments') || p.switches.has('-c');
  return output(issueJson(issue), p, jq, () => issueText(issue, withComments));
}

function issueList(p: Parsed, store: Store, jq: Jq): Answer {
  const state = (first(p, '--state', '-s') ?? 'open').toUpperCase();
  const label = first(p, '--label', '-l');
  const search = first(p, '--search', '-S');
  const limit = Number(first(p, '--limit', '-L') ?? 30);
  const issues = store.issues
    .filter((i) => state === 'ALL' || i.state === state)
    .filter((i) => label === undefined || i.labels.includes(label))
    .filter((i) => search === undefined || matches(search, `${i.title}\n${i.body}`))
    .sort((a, b) => b.number - a.number)
    .slice(0, limit);
  const text = () =>
    issues.map((i) => `${i.number}\t${i.state}\t${i.title}\t${i.labels.join(', ')}\n`).join('');
  return output(issues.map(issueJson), p, jq, text);
}

function findIssue(store: Store, ref: string): IssueFixture | undefined {
  const number = Number(ref.replace(/^.*\/issues\//, '').replace(/^#/, ''));
  return store.issues.find((i) => i.number === number);
}

function issueJson(i: IssueFixture): JsonObject {
  return {
    number: i.number,
    title: i.title,
    state: i.state,
    body: i.body,
    url: `${WEB}/issues/${i.number}`,
    closed: i.state === 'CLOSED',
    labels: i.labels.map((name) => ({ name })),
    milestone: i.milestone === null ? null : { title: i.milestone },
    comments: i.comments.map((c) => ({ author: { login: c.author }, body: c.body })),
    assignees: [{ login: OWNER }],
    author: { login: OWNER },
    projectItems: [
      { title: 'Escuadra', status: { name: i.state === 'CLOSED' ? 'Done' : 'Backlog' } },
    ],
  };
}

function issueText(i: IssueFixture, withComments: boolean): string {
  const lines = [
    `${i.title} #${i.number}`,
    `${i.state === 'OPEN' ? 'Open' : 'Closed'} • ${OWNER} opened • ${i.comments.length} comments`,
    `Labels: ${i.labels.join(', ')}`,
    `Milestone: ${i.milestone ?? ''}`,
    '',
    i.body,
    '',
  ];
  if (withComments) for (const c of i.comments) lines.push(`${c.author} • commented`, c.body, '');
  lines.push(`View this issue on GitHub: ${WEB}/issues/${i.number}`, '');
  return lines.join('\n');
}

// gh's search syntax, reduced to what triage needs: every plain word must
// appear; qualifiers such as is:open are ignored.
function matches(search: string, text: string): boolean {
  const haystack = text.toLowerCase();
  return search
    .split(/\s+/)
    .filter((word) => word !== '' && !word.includes(':'))
    .every((word) => haystack.includes(word.toLowerCase().replace(/^#/, '')));
}

function output(value: JsonObject | JsonObject[], p: Parsed, jq: Jq, text: () => string): Answer {
  const fields = first(p, '--json');
  if (fields === undefined) return ok(text());
  const names = fields
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
  const sample = Array.isArray(value) ? value[0] : value;
  const available = Object.keys(sample ?? {}).sort();
  const unknown = sample === undefined ? [] : names.filter((name) => !(name in sample));
  if (names.length === 0 || unknown.length > 0) {
    const problem =
      unknown.length > 0
        ? `Unknown JSON field: "${unknown[0]}"`
        : 'Specify one or more comma-separated fields for `--json`:';
    return fail(`${problem}\nAvailable fields:\n  ${available.join('\n  ')}\n`);
  }
  const pick = (item: JsonObject): JsonObject =>
    Object.fromEntries(names.map((name) => [name, item[name] ?? null]));
  return send(Array.isArray(value) ? value.map(pick) : pick(value), first(p, '--jq', '-q'), jq);
}

function send(value: Json, expression: string | undefined, jq: Jq): Answer {
  const json = JSON.stringify(value, null, 2);
  if (expression === undefined) return ok(`${json}\n`);
  try {
    const out = jq(json, expression);
    return ok(out === '' || out.endsWith('\n') ? out : `${out}\n`);
  } catch (error) {
    return fail(`${error instanceof Error ? error.message : String(error)}\n`);
  }
}

function parse(args: string[], valued: Set<string>): Parsed {
  const positional: string[] = [];
  const flags = new Map<string, string[]>();
  const switches = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';
    const eq = arg.startsWith('-') ? arg.indexOf('=') : -1;
    const name = eq > 0 ? arg.slice(0, eq) : arg;
    if (valued.has(name)) {
      const value = eq > 0 ? arg.slice(eq + 1) : (args[++i] ?? '');
      flags.set(name, [...(flags.get(name) ?? []), value]);
    } else if (arg.startsWith('-')) {
      switches.add(name);
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags, switches };
}

function first(p: Parsed, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = p.flags.get(name)?.[0];
    if (value !== undefined) return value;
  }
  return undefined;
}

function fieldPairs(p: Parsed): Map<string, string> {
  const pairs = new Map<string, string>();
  for (const name of ['--field', '-F', '--raw-field', '-f']) {
    for (const value of p.flags.get(name) ?? []) {
      const eq = value.indexOf('=');
      if (eq > 0) pairs.set(value.slice(0, eq), value.slice(eq + 1));
    }
  }
  return pairs;
}

function quote(arg: string): string {
  return /^[\w./:=@#,+-]+$/.test(arg) ? arg : JSON.stringify(arg);
}

function ok(stdout: string): Answer {
  return { code: 0, stdout, stderr: '' };
}

function fail(stderr: string): Answer {
  return { code: 1, stdout: '', stderr };
}
