// Pure model for sharing a result (spec §4): the text message for chat apps,
// and the copy on the share picture. Plain text and drawn squares only — no
// flag emoji (they depend on an OS font; CLAUDE.md guardrail 2), nothing
// crest-like, and never a player's name or photo (spec §1).

import { isFlawless, resultTier, type ResultTier } from '@/lib/resultsView';

/** The marketing site links both stores; a store URL is wrong on the other platform. */
export const SHARE_URL = 'https://tovmassian.github.io/escuadra/';

/** The link as the share picture prints it: no scheme, no trailing slash. */
export const SHARE_URL_DISPLAY = SHARE_URL.replace(/^https:\/\//, '').replace(/\/$/, '');

/** How a result leaves the device; also `result.shared`'s `format`. */
export type ShareFormat = 'image' | 'text';

export interface ShareInput {
  teamName: string;
  level: number;
  /** One entry per question, in order. `null` (unanswered) is left out. */
  outcomes: (boolean | null)[];
}

/** The message's pieces, which the share sheet's preview draws as a chat bubble. */
export interface ShareTextParts {
  header: string;
  score: string;
  /** "a la escuadra" on a flawless round, otherwise null. */
  verdict: string | null;
  /** Answered questions only, in order. */
  squares: boolean[];
  url: string;
}

export function shareTextParts({ teamName, level, outcomes }: ShareInput): ShareTextParts {
  const squares = outcomes.filter((o): o is boolean => o !== null);
  const correct = squares.filter(Boolean).length;
  return {
    header: `Escuadra · ${teamName} · Level ${level}`,
    score: `${correct}/${squares.length}`,
    verdict: isFlawless(correct, squares.length) ? 'a la escuadra' : null,
    squares,
    url: SHARE_URL,
  };
}

export function formatShareText(input: ShareInput): string {
  const { header, score, verdict, squares, url } = shareTextParts(input);
  const grid = squares.map((o) => (o ? '🟩' : '🟥')).join('');
  return [header, `${score}  ${verdict ? `${verdict}  ` : ''}${grid}`, '', url].join('\n');
}

/** One question on the share picture: its shirt number and whether it was right. */
export interface ShareItem {
  no: number;
  correct: boolean;
}

export interface ShareCardInput {
  teamName: string;
  season: string;
  level: number;
  /** The round strip's items, in order. */
  items: readonly ShareItem[];
}

export interface ShareCardView {
  /** "Spain · 2026 · Level 2"; the card sets it in capitals. */
  eyebrow: string;
  correct: number;
  total: number;
  tier: ResultTier;
  title: string;
  question: string;
  link: string;
}

// "Spain's", but "Netherlands'".
function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

// Results' fail title ("These are the ones to learn") speaks to the player;
// the picture speaks to whoever receives it, so a fail reads "Still learning".
const TITLES: Record<ResultTier, (level: number) => string> = {
  fail: () => 'Still learning',
  passed: (level) => `Level ${level} cleared`,
  excellent: () => 'A la escuadra',
};

export function shareCardView({ teamName, season, level, items }: ShareCardInput): ShareCardView {
  const correct = items.filter((i) => i.correct).length;
  const tier = resultTier(correct, items.length);
  return {
    eyebrow: `${teamName} · ${season} · Level ${level}`,
    correct,
    total: items.length,
    tier,
    title: TITLES[tier](level),
    question: `Can you name ${possessive(teamName)} squad?`,
    link: SHARE_URL_DISPLAY,
  };
}
