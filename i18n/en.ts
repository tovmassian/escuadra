// The English catalog, the source every other language is typed against:
// `Messages = typeof en`. Deliberately not `as const` — its strings widen to
// `string`, so a translation can hold different words while a missing key, an
// extra key or a wrong parameter list still fails `npm run typecheck`.
// Values are strings, or functions when they take parameters; each function
// writes its own plural. No `Intl`: dates and plurals are written out here.
// Escuadra and a la escuadra come from ./names and are never translated.
// Short labels carry a length budget ("≤ N chars: where") that translators
// write to (#141, Text expansion). Spec: #141.

import { A_LA_ESCUADRA_TITLE } from './names';

/** A squad's `lastUpdated`, split so each language orders it its own way. */
export interface CalendarDate {
  day: number;
  /** 1–12. */
  month: number;
  year: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Spain's", but "Netherlands'". English only: each catalog writes its own. */
function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

export const en = {
  common: {
    /** "Level 2": the round header, results, the share text and picture. */
    level: (level: number) => `Level ${level}`,
  },
  formats: {
    /** "21 Aug 2026". */
    date: ({ day, month, year }: CalendarDate) => `${day} ${MONTHS[month - 1] ?? ''} ${year}`,
  },
  /** The word under a position tile's code, and in Study's spoken label. */
  positions: { GK: 'Keeper', DF: 'Defender', MF: 'Midfield', FW: 'Forward' },
  /** Slot names, spoken before a slot's value. */
  slots: { NAME: 'Name', POS: 'Position', AGE: 'Age', CLUB: 'Club', NAT: 'Nationality' },
  round: {
    /** ≤ 12 chars: the prompt row once a question is scored. */
    correct: 'Correct',
    missed: 'Missed',
    whoWears: (no: number) => `Who wears ${no}?`,
    askPosition: 'Position?',
    askClub: 'Which club?',
    askNationality: 'Nationality?',
    /** ≤ 14 chars: the footer button on the last question. */
    seeResults: 'See results',
    /** ≤ 8 chars: the auto-next bar's label before "· tap to skip". */
    next: 'Next',
    nextQuestion: 'Next question',
    gotItNext: 'Got it — next',
    /** The auto-next bar: one line of `ctaLabel` at 360 dp, ≤ 26 chars in all. */
    tapToSkip: (label: string) => `${label} · tap to skip`,
    /** A slot chip's screen-reader label, by slot state. */
    slotSpoken: {
      given: (slot: string, value: string) => `${slot}: ${value}`,
      active: (slot: string) => `${slot}: being asked`,
      pending: (slot: string) => `${slot}: asked next`,
      correct: (slot: string, value: string) => `${slot}: ${value}, right`,
      wrong: (slot: string, value: string) => `${slot}: ${value}, the right answer`,
      notAsked: (slot: string, value: string) => `${slot}: ${value}, not asked`,
    },
  },
  study: {
    /** The header's count, unfiltered. */
    players: (count: number) => (count === 1 ? `${count} player` : `${count} players`),
    /** The header's count, filtered. */
    shownOf: (shown: number, total: number) => `${shown} of ${total}`,
    /** Spoken for a member with no shirt number yet. */
    noNumber: 'no number',
    /** Spoken in place of a name while Hide names is on. */
    nameHidden: 'name hidden',
  },
  credits: {
    /** The licence's change note, after the author and licence. */
    cropped: 'cropped',
  },
  results: {
    /** The flawless round's title. */
    flawlessTitle: A_LA_ESCUADRA_TITLE,
    flawlessVerdict: (team: string, season: string, level: number) =>
      `${team} · ${season}, level ${level}. Nothing missed.`,
    /** Also the share picture's title for a pass. */
    clearedTitle: (level: number) => `Level ${level} cleared`,
    clearedVerdict: 'You knew most of the starting XI.',
    failTitle: 'These are the ones to learn',
    /** `target` is "8/10". */
    toClear: (target: string, level: number) => `Score ${target} to clear level ${level}.`,
    toUnlock: (target: string, level: number) => `Score ${target} to unlock level ${level}.`,
    /** A missed card's line when the name was wrong. */
    youPicked: (picked: string) => `You picked ${picked}`,
    nameRight: 'Name right',
    nameAndPositionRight: 'Name and position right',
    /** A missed card's line after a later part, following "Name right · ". */
    wrongPart: {
      position: (right: string, picked: string) => `position is ${right}, you said ${picked}`,
      club: (right: string, picked: string) => `club is ${right}, you said ${picked}`,
      nationality: (right: string, picked: string) => `nationality is ${right}, you said ${picked}`,
    },
  },
  share: {
    /** The share sheet's title, the results Share button's label, Android's share dialog. */
    title: 'Share your round',
    /** The share picture's title below a pass: it speaks to whoever receives it. */
    stillLearning: 'Still learning',
    /** The share picture's question to its receiver. */
    question: (team: string) => `Can you name ${possessive(team)} squad?`,
  },
  ladder: {
    /** ≤ 14 chars: the Play card's button. */
    play: 'Play',
    /** ≤ 14 chars: the Play card's button once the level has a score. */
    playAgain: 'Play Again',
    /** Under a locked rung. `target` is "8/10". */
    unlockHint: (target: string, level: number) => `Score ${target} on L${level}`,
    rungLocked: (title: string, hint: string) => `${title}, locked, ${hint}`,
    rungBest: (title: string, correct: number, total: number) =>
      `${title}, best ${correct} of ${total}`,
  },
  picker: {
    /** ≤ 6 chars: the league pill that clears the filter. */
    allLeagues: 'ALL',
    /** A team row's mono meta line, never played. */
    notPlayed: (season: string) => `${season} · NOT PLAYED`,
    /** A team row's mono meta line, with its best score. */
    played: (season: string, level: number, correct: number, total: number) =>
      `${season} · LEVEL ${level} · BEST ${correct}/${total}`,
  },
  about: {
    version: (version: string) => `Version ${version}`,
    /** In brackets after the version on a build's own bundle. */
    builtIn: 'built-in',
  },
};

export type Messages = typeof en;
