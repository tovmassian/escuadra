// Turns `gh issue view --json` output and the board's Size into an issue
// fixture (spec §6). Pure; capture-issue.ts runs the real gh.
import type { IssueFixture } from '../sandbox/gh.ts';

export interface GhIssue {
  number: number;
  title: string;
  state: string;
  body: string;
  comments: { author: { login: string } | null; body: string }[];
  labels: { name: string }[];
  milestone: { title: string } | null;
}

export interface SizeResponse {
  data?: {
    repository?: {
      issue?: {
        projectItems?: { nodes?: ({ fieldValueByName?: { name?: string } | null } | null)[] };
      };
    };
  };
}

export const SIZE_QUERY =
  'query($n:Int!){repository(owner:"tovmassian",name:"escuadra"){issue(number:$n){projectItems(first:5){nodes{fieldValueByName(name:"Size"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}';

export function toFixture(
  issue: GhIssue,
  size: string | null,
  why: string,
  date: string,
): IssueFixture {
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state === 'CLOSED' ? 'CLOSED' : 'OPEN',
    body: issue.body,
    comments: issue.comments.map((c) => ({ author: c.author?.login ?? 'ghost', body: c.body })),
    labels: issue.labels.map((label) => label.name),
    milestone: issue.milestone?.title ?? null,
    size,
    source: `real snapshot ${date}`,
    why,
  };
}

export function sizeFrom(response: SizeResponse): string | null {
  for (const node of response.data?.repository?.issue?.projectItems?.nodes ?? []) {
    const name = node?.fieldValueByName?.name;
    if (name) return name;
  }
  return null;
}
