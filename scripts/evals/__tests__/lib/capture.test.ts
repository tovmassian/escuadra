import { describe, expect, it } from 'vitest';
import { sizeFrom, toFixture } from '../../lib/capture.ts';

describe('toFixture', () => {
  it('flattens gh issue view JSON into a fixture', () => {
    const fixture = toFixture(
      {
        number: 117,
        title: 'fix(android): bold styles',
        state: 'OPEN',
        body: 'Body.',
        comments: [
          { author: { login: 'tovmassian' }, body: 'A note.' },
          { author: null, body: 'From a deleted account.' },
        ],
        labels: [{ name: 'bug' }],
        milestone: null,
      },
      'S',
      'The issue hands the owner the release route.',
      '2026-10-16',
    );
    expect(fixture).toEqual({
      number: 117,
      title: 'fix(android): bold styles',
      state: 'OPEN',
      body: 'Body.',
      comments: [
        { author: 'tovmassian', body: 'A note.' },
        { author: 'ghost', body: 'From a deleted account.' },
      ],
      labels: ['bug'],
      milestone: null,
      size: 'S',
      source: 'real snapshot 2026-10-16',
      why: 'The issue hands the owner the release route.',
    });
  });
});

describe('sizeFrom', () => {
  it('reads the first Size the board gives', () => {
    const response = {
      data: {
        repository: {
          issue: {
            projectItems: {
              nodes: [{ fieldValueByName: null }, { fieldValueByName: { name: 'M' } }],
            },
          },
        },
      },
    };
    expect(sizeFrom(response)).toBe('M');
  });

  it('gives null for an issue with no Size', () => {
    expect(
      sizeFrom({ data: { repository: { issue: { projectItems: { nodes: [] } } } } }),
    ).toBeNull();
  });
});
