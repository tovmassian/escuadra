// Pure model for sharing a result (spec §4): the text message for chat apps,
// and the copy on the share picture. Plain text and drawn squares only — no
// flag emoji (they depend on an OS font; CLAUDE.md guardrail 2), nothing
// crest-like, and never a player's name or photo (spec §1).

import type { Messages } from '@/i18n/en';
import { A_LA_ESCUADRA, A_LA_ESCUADRA_TITLE, ESCUADRA } from '@/i18n/names';
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

export function shareTextParts(
  { teamName, level, outcomes }: ShareInput,
  messages: Messages,
): ShareTextParts {
  const squares = outcomes.filter((o): o is boolean => o !== null);
  const correct = squares.filter(Boolean).length;
  return {
    header: [ESCUADRA, teamName, messages.common.level(level)].join(' · '),
    score: `${correct}/${squares.length}`,
    verdict: isFlawless(correct, squares.length) ? A_LA_ESCUADRA : null,
    squares,
    url: SHARE_URL,
  };
}

/** The text preview, spoken: the score in words, since a screen reader can read
 *  "8/10" as a date. */
export function shareTextSpoken(input: ShareInput, messages: Messages): string {
  const { header, verdict, squares, url } = shareTextParts(input, messages);
  const score = messages.common.scoreSpoken(squares.filter(Boolean).length, squares.length);
  return `${header}. ${score}${verdict ? `, ${verdict}` : ''}. ${url}`;
}

export function formatShareText(input: ShareInput, messages: Messages): string {
  const { header, score, verdict, squares, url } = shareTextParts(input, messages);
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

// Results' fail title ("These are the ones to learn") speaks to the player;
// the picture speaks to whoever receives it, so a fail reads "Still learning".
function cardTitle(tier: ResultTier, level: number, messages: Messages): string {
  if (tier === 'excellent') return A_LA_ESCUADRA_TITLE;
  if (tier === 'passed') return messages.results.clearedTitle(level);
  return messages.share.stillLearning;
}

export function shareCardView(
  { teamName, season, level, items }: ShareCardInput,
  messages: Messages,
): ShareCardView {
  const correct = items.filter((i) => i.correct).length;
  const tier = resultTier(correct, items.length);
  return {
    eyebrow: [teamName, season, messages.common.level(level)].join(' · '),
    correct,
    total: items.length,
    tier,
    title: cardTitle(tier, level, messages),
    question: messages.share.question(teamName),
    link: SHARE_URL_DISPLAY,
  };
}
