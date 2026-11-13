// squad-sweep: the words of the weekly data PR, read from squadctl's own report. Pure; the
// flow in flows/sweep.ts runs squadctl, git and gh. See docs/release.md ("Sweep squad data").
//
// squadctl's human report already names every conflict with the command that answers it,
// so the PR quotes it rather than re-rendering its JSON: that report is the release
// branch's squadctl, and its JSON shape may move on `main` without it.

export const SWEEP_MARKER = '<!-- squad-sweep -->';
export const SWEEP_TITLE = 'data: weekly sweep';
const PREFIX = 'data/sweep-';
/** GitHub refuses a longer PR body. */
export const BODY_LIMIT = 65_536;

export function sweepBranch(today: string): string {
  return `${PREFIX}${today}`;
}

export function isSweepBranch(ref: string): boolean {
  return ref.startsWith(PREFIX);
}

export type TeamStatus = 'ok' | 'written' | 'unchanged' | 'conflicted' | 'held' | 'failed';

/** One team's line in a squadctl report, with the indented lines under it. */
export interface TeamBlock {
  id: string;
  status: TeamStatus;
  lines: string[];
}

// eslint-disable-next-line no-control-regex -- matching the escape is the point
const ANSI = /\u001b\[[0-9;]*m/g;
const TEAM_LINE = /^ {2}([a-z0-9-]+): (FAILED|written|unchanged|conflicted|held|\d+ members)/;
const DETAIL_LINE = /^ {3,}\S/;

function statusOf(word: string): TeamStatus {
  if (word === 'FAILED') return 'failed';
  if (/^\d/.test(word)) return 'ok';
  return word as TeamStatus;
}

/** The team lines of a `fetch`, `apply` or `enrich` report; anything else is dropped. */
export function teamBlocks(output: string): TeamBlock[] {
  const blocks: TeamBlock[] = [];
  let current: TeamBlock | undefined;
  for (const line of output.replace(ANSI, '').split('\n')) {
    const team = TEAM_LINE.exec(line);
    if (team) {
      current = { id: team[1] ?? '', status: statusOf(team[2] ?? ''), lines: [line] };
      blocks.push(current);
    } else if (current && DETAIL_LINE.test(line)) {
      current.lines.push(line);
    } else {
      current = undefined;
    }
  }
  return blocks;
}

/** Teams whose apply added player records: `enrich` looks up their photos and births. */
export function teamsWithNewPlayers(applyOutput: string): string[] {
  return teamBlocks(applyOutput)
    .filter((block) => block.lines.some((line) => /\d+ new player id\(s\)/.test(line)))
    .map((block) => block.id);
}

export interface EnrichRun {
  teams: string[];
  /** squadctl's exit code: 0 clean, 1 Wikimedia unreachable, 4 birth conflicts. */
  code: number;
  output: string;
}

export interface SweepView {
  base: string;
  branch: string;
  runUrl: string;
  fetch: string;
  apply: string;
  enrich?: EnrichRun;
}

/** A text fence of `lines`, cut to `budget` characters with a pointer to the full run. */
function fence(lines: string[], budget: number, runUrl: string): string {
  const kept: string[] = [];
  let size = 0;
  for (const line of lines) {
    if (size + line.length + 1 > budget) {
      kept.push(`… ${lines.length - kept.length} more lines: the full report is in ${runUrl}`);
      break;
    }
    kept.push(line);
    size += line.length + 1;
  }
  return ['```text', ...kept, '```'].join('\n');
}

function details(summary: string, body: string): string {
  return `<details><summary>${summary}</summary>\n\n${body}\n\n</details>`;
}

const totals = (output: string, command: string): string[] =>
  output
    .replace(ANSI, '')
    .split('\n')
    .filter((line) => line.startsWith(`${command}: `) && !line.includes(' -> '));

function photos(enrich: EnrichRun, view: SweepView): string {
  const teams = enrich.teams.join(', ');
  const local = `node tools/squadctl/bin/dev.js enrich --only ${enrich.teams.join(',')}`;
  const output = enrich.output.trim()
    ? `\n\n${fence(enrich.output.replace(ANSI, '').split('\n'), 8_000, view.runUrl)}`
    : '';
  if (enrich.code === 1) {
    return `Wikimedia couldn't be reached from the runner, so the new players of ${teams} have no photo yet. Locally, on this branch: \`${local}\`, then commit and push.${output}`;
  }
  if (enrich.code === 4) {
    return `Looked up the new players of ${teams}. Some birth dates disagree with Wikidata, and their photos are held until each is answered (squadctl README, \`birth-mismatch\`).${output}`;
  }
  return `Looked up photos and birth dates for the new players of ${teams}.${output}`;
}

export function sweepBody(view: SweepView): string {
  const fetched = teamBlocks(view.fetch);
  const applied = teamBlocks(view.apply);
  const pick = (blocks: TeamBlock[], status: TeamStatus) =>
    blocks.filter((block) => block.status === status).flatMap((block) => block.lines);

  const decide = [
    ...pick(applied, 'conflicted'),
    ...pick(applied, 'failed'),
    ...pick(fetched, 'failed'),
  ];
  const written = pick(applied, 'written');
  const held = pick(applied, 'held');
  const warned = fetched
    .filter((block) => block.status === 'ok' && block.lines.length > 1)
    .flatMap((block) => block.lines);

  const sections = [
    SWEEP_MARKER,
    `Weekly squad sweep into \`${view.base}\`, from [this run](${view.runUrl}). Opened by squad-sweep, which re-applies on this branch each time it runs.`,
    '',
    '**Before merging**',
    '',
    `1. Answer every conflict below: until it is, its team is \`verified: false\`, which never ships. On \`${view.branch}\`, run the command the conflict names, commit and push, then **Actions → squad-sweep → Run workflow**: it re-applies here and rewrites this description.`,
    '2. A roster that moved by more than 40% (blast radius) is usually a new call-up. Read its diff; the next run clears it.',
    '3. Label `ota:android` and/or `ota:ios`. That runs `release-gate`; merging publishes the update to those platforms, and `pick-to-main` takes it to `main`.',
    '',
    '### Needs a decision',
    '',
    decide.length > 0
      ? fence(decide, 30_000, view.runUrl)
      : 'Nothing needs a decision: every team written is verified.',
  ];
  if (view.enrich) sections.push('', '### Photos', '', photos(view.enrich, view));
  if (written.length > 0) {
    const count = applied.filter((block) => block.status === 'written').length;
    sections.push('', details(`Written (${count})`, fence(written, 12_000, view.runUrl)));
  }
  if (held.length > 0) {
    sections.push(
      '',
      details(
        `Held (${held.length}): too few numbered players to play, so the stored squad stays`,
        fence(held, 5_000, view.runUrl),
      ),
    );
  }
  if (warned.length > 0) {
    sections.push('', details('Fetch warnings', fence(warned, 4_000, view.runUrl)));
  }
  const lines = [...totals(view.fetch, 'fetch'), ...totals(view.apply, 'apply')];
  if (lines.length > 0) sections.push('', '### Totals', '', fence(lines, 1_000, view.runUrl));
  return sections.join('\n');
}
