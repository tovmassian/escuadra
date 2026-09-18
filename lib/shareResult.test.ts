import { describe, expect, it } from 'vitest';
import { SHARE_URL, formatShareText } from './shareResult';

const G = '🟩';
const R = '🟥';

describe('formatShareText', () => {
  it('renders header, score with grid, and the site link', () => {
    const text = formatShareText({
      teamName: 'Real Madrid',
      level: 2,
      outcomes: [true, true, false, true, true, true, true, false, true, true],
    });
    expect(text).toBe(
      [
        'Escuadra · Real Madrid · Level 2',
        `8/10  ${G}${G}${R}${G}${G}${G}${G}${R}${G}${G}`,
        SHARE_URL,
      ].join('\n'),
    );
  });

  it('says a la escuadra, never "perfect", on a flawless round', () => {
    const text = formatShareText({ teamName: 'Spain', level: 3, outcomes: Array(10).fill(true) });
    expect(text).toContain('10/10  a la escuadra');
    expect(text).not.toMatch(/perfect/i);
  });

  it('does not celebrate an empty round', () => {
    const text = formatShareText({ teamName: 'Spain', level: 1, outcomes: [] });
    expect(text).not.toContain('a la escuadra');
  });

  it('ignores unanswered questions', () => {
    const text = formatShareText({ teamName: 'Spain', level: 1, outcomes: [true, null, false] });
    expect(text).toContain(`1/2  ${G}${R}`);
  });

  it('uses only emoji squares — no flag (regional indicator) characters', () => {
    const text = formatShareText({ teamName: 'Argentina', level: 1, outcomes: [true, false] });
    expect(text).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u);
  });

  it('links the marketing site, not a store', () => {
    expect(SHARE_URL).toBe('https://tovmassian.github.io/escuadra/');
  });
});
