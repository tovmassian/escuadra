import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import {
  SHARE_URL,
  SHARE_URL_DISPLAY,
  formatShareText,
  shareCardView,
  shareTextParts,
} from '../shareResult';

const G = '🟩';
const R = '🟥';

describe('formatShareText', () => {
  it('renders header, score with grid, and the site link', () => {
    const text = formatShareText(
      {
        teamName: 'Real Madrid',
        level: 2,
        outcomes: [true, true, false, true, true, true, true, false, true, true],
      },
      en,
    );
    expect(text).toBe(
      [
        'Escuadra · Real Madrid · Level 2',
        `8/10  ${G}${G}${R}${G}${G}${G}${G}${R}${G}${G}`,
        '',
        SHARE_URL,
      ].join('\n'),
    );
  });

  it('says a la escuadra, never "perfect", on a flawless round', () => {
    const text = formatShareText(
      { teamName: 'Spain', level: 3, outcomes: Array(10).fill(true) },
      en,
    );
    expect(text).toContain('10/10  a la escuadra');
    expect(text).not.toMatch(/perfect/i);
  });

  it('pins a flawless round exactly', () => {
    expect(
      formatShareText({ teamName: 'Spain', level: 3, outcomes: Array(10).fill(true) }, en),
    ).toBe(
      'Escuadra · Spain · Level 3\n10/10  a la escuadra  ' + G.repeat(10) + '\n\n' + SHARE_URL,
    );
  });

  it('pins an empty round exactly', () => {
    expect(formatShareText({ teamName: 'Spain', level: 1, outcomes: [] }, en)).toBe(
      'Escuadra · Spain · Level 1\n0/0  \n\n' + SHARE_URL,
    );
  });

  it('does not celebrate an empty round', () => {
    const text = formatShareText({ teamName: 'Spain', level: 1, outcomes: [] }, en);
    expect(text).not.toContain('a la escuadra');
  });

  it('ignores unanswered questions', () => {
    const text = formatShareText(
      { teamName: 'Spain', level: 1, outcomes: [true, null, false] },
      en,
    );
    expect(text).toContain(`1/2  ${G}${R}`);
  });

  it('uses only emoji squares — no flag (regional indicator) characters', () => {
    const text = formatShareText({ teamName: 'Argentina', level: 1, outcomes: [true, false] }, en);
    expect(text).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u);
  });

  it('links the marketing site, not a store', () => {
    expect(SHARE_URL).toBe('https://tovmassian.github.io/escuadra/');
  });
});

describe('shareTextParts', () => {
  it('splits the message into the pieces the preview bubble draws', () => {
    expect(
      shareTextParts({ teamName: 'Spain', level: 2, outcomes: [true, false, null, true] }, en),
    ).toEqual({
      header: 'Escuadra · Spain · Level 2',
      score: '2/3',
      verdict: null,
      squares: [true, false, true],
      url: SHARE_URL,
    });
  });

  it('carries the a la escuadra verdict on a flawless round', () => {
    expect(
      shareTextParts({ teamName: 'Spain', level: 1, outcomes: Array(10).fill(true) }, en).verdict,
    ).toBe('a la escuadra');
  });
});

describe('SHARE_URL_DISPLAY', () => {
  it('is the link without its scheme or trailing slash', () => {
    expect(SHARE_URL_DISPLAY).toBe('tovmassian.github.io/escuadra');
  });
});

describe('shareCardView', () => {
  const items = (pattern: string) =>
    [...pattern].map((c, i) => ({ no: i + 1, correct: c === '1' }));

  it('titles a failed round "Still learning"', () => {
    const view = shareCardView(
      {
        teamName: 'Spain',
        season: '2026',
        level: 1,
        items: items('0000111010'),
      },
      en,
    );
    expect(view).toMatchObject({ correct: 4, total: 10, tier: 'fail', title: 'Still learning' });
  });

  it('titles a passed round with its level', () => {
    const view = shareCardView(
      {
        teamName: 'Spain',
        season: '2026',
        level: 2,
        items: items('1111111001'),
      },
      en,
    );
    expect(view).toMatchObject({ correct: 8, tier: 'passed', title: 'Level 2 cleared' });
  });

  it('titles a flawless round a la escuadra', () => {
    const view = shareCardView(
      {
        teamName: 'Spain',
        season: '2026',
        level: 2,
        items: items('1111111111'),
      },
      en,
    );
    expect(view).toMatchObject({ correct: 10, tier: 'excellent', title: 'A la escuadra' });
  });

  it('names the team, season and level, asks the question and prints the link', () => {
    const view = shareCardView(
      { teamName: 'Spain', season: '2026', level: 2, items: items('1') },
      en,
    );
    expect(view.eyebrow).toBe('Spain · 2026 · Level 2');
    expect(view.question).toBe("Can you name Spain's squad?");
    expect(view.link).toBe('tovmassian.github.io/escuadra');
  });

  it('writes the possessive of a name ending in s with an apostrophe only', () => {
    const view = shareCardView(
      {
        teamName: 'Netherlands',
        season: '2026',
        level: 1,
        items: items('1'),
      },
      en,
    );
    expect(view.question).toBe("Can you name Netherlands' squad?");
  });
});
