// Taking a release-branch squash commit to `main`: which commits go, and the words
// around the pick. Pure; the flow in flows/pick.ts runs git and gh. See docs/release.md
// ("Branches").

const PICKED_FROM = /\(cherry picked from commit [0-9a-f]{7,40}\)/;

/** A commit carrying `-x`'s trailer came from `main` already: it never goes back. */
export function cameFromMain(message: string): boolean {
  return PICKED_FROM.test(message);
}

export function pickBranch(prNumber: number): string {
  return `pick/${prNumber}-to-main`;
}

/** The squash commit's subject, `(#N)` included, as picks made by hand keep it. */
export function pickTitle(message: string): string {
  return message.split('\n')[0]?.trim() ?? '';
}

export interface PickView {
  prNumber: number;
  baseRef: string;
  sha: string;
}

export function pickBody(view: PickView): string {
  return [
    `\`git cherry-pick -x ${view.sha.slice(0, 7)}\` of #${view.prNumber}, merged into \`${view.baseRef}\`. Opened by pick-to-main.`,
    '',
    'Before merging, drop anything that belongs to the release only, such as the `app.json` version of a patch release.',
  ].join('\n');
}

/** The commands for a pick the job couldn't make: what a person runs instead. */
export function manualPick(view: PickView): string {
  const branch = pickBranch(view.prNumber);
  return [
    '```bash',
    `git switch -c ${branch} origin/main`,
    `git cherry-pick -x ${view.sha}`,
    '```',
    `Resolve, then open a PR from \`${branch}\` into \`main\`.`,
  ].join('\n');
}
