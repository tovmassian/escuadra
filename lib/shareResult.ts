// Pure formatter for the Results screen's share text — built for pasting into
// a WhatsApp group, so plain text and emoji squares only. No flag emoji (they
// depend on an OS font; CLAUDE.md guardrail 2) and nothing crest-like.

import { isFlawless } from '@/lib/resultsView';

/** The marketing site links both stores; a store URL is wrong on the other platform. */
export const SHARE_URL = 'https://tovmassian.github.io/escuadra/';

export interface ShareInput {
  teamName: string;
  level: number;
  /** One entry per question, in order. `null` (unanswered) is left out. */
  outcomes: (boolean | null)[];
}

export function formatShareText({ teamName, level, outcomes }: ShareInput): string {
  const answered = outcomes.filter((o): o is boolean => o !== null);
  const correct = answered.filter(Boolean).length;
  const grid = answered.map((o) => (o ? '🟩' : '🟥')).join('');
  const verdict = isFlawless(correct, answered.length) ? 'a la escuadra  ' : '';

  return [
    `Escuadra · ${teamName} · Level ${level}`,
    `${correct}/${answered.length}  ${verdict}${grid}`,
    '',
    SHARE_URL,
  ].join('\n');
}
