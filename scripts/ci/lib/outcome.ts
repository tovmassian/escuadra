// What a flow reports to its entry point. Only `failed` fails the job; the summary is
// Markdown for the job summary and PR comments.
export interface Outcome {
  status: 'done' | 'skipped' | 'failed';
  summary: string;
}

export const done = (summary: string): Outcome => ({ status: 'done', summary });
export const skipped = (summary: string): Outcome => ({ status: 'skipped', summary });
export const failed = (summary: string): Outcome => ({ status: 'failed', summary });
