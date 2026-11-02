// Ticks the named `- [ ]` items of an issue body and leaves the rest. An item is named
// by its whole text after the checkbox; one that matches no checkbox, or two, stops the
// run before anything is written. The items left open go to the PR body with a reason.
import { runJson, runOk, type Runner } from '../../ci/flows/runner.ts';
import { REPO } from './board.ts';

const CHECKBOX = /^(\s*[-*] \[)([ xX])(\] )(.*)$/;

export function tickItems(body: string, items: string[]): { body: string; unticked: string[] } {
  const lines = body.split('\n');
  const matches = lines.map((line) => CHECKBOX.exec(line));
  for (const item of items) {
    const count = matches.filter((match) => match?.[4]?.trim() === item.trim()).length;
    if (count === 0) throw new Error(`No checkbox reads "${item}"`);
    if (count > 1) throw new Error(`${count} checkboxes read "${item}"`);
  }
  const wanted = new Set(items.map((item) => item.trim()));
  const unticked: string[] = [];
  const ticked = lines.map((line, index) => {
    const match = matches[index];
    if (!match) return line;
    const [, open = '', mark = ' ', close = '', text = ''] = match;
    if (wanted.has(text.trim())) return `${open}x${close}${text}`;
    if (mark === ' ') unticked.push(text.trim());
    return line;
  });
  return { body: ticked.join('\n'), unticked };
}

export function untickedReasons(unticked: string[]): string {
  if (unticked.length === 0) return 'Every checkbox in the issue is ticked.\n';
  const lines = unticked.map((item) => `- ${item}: <why>`);
  return `Unticked in the issue; say why in the PR body:\n${lines.join('\n')}\n`;
}

export async function tickIssue(runner: Runner, issue: number, items: string[]): Promise<string[]> {
  const { body } = await runJson<{ body: string }>(runner, 'gh', [
    'issue',
    'view',
    String(issue),
    '--repo',
    REPO,
    '--json',
    'body',
  ]);
  const result = tickItems(body, items);
  if (result.body !== body) {
    await runOk(runner, 'gh', [
      'issue',
      'edit',
      String(issue),
      '--repo',
      REPO,
      '--body',
      result.body,
    ]);
  }
  return result.unticked;
}
