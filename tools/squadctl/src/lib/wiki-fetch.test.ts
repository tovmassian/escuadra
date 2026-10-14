import { describe, expect, it } from 'vitest';
import { cacheSlug } from './wiki-fetch.ts';

describe('cacheSlug', () => {
  it('makes an article title safe as a filename', () => {
    expect(cacheSlug('Arsenal F.C.')).toBe('Arsenal_F.C.');
    expect(cacheSlug('Atlético Madrid')).toBe('Atl_tico_Madrid');
    expect(cacheSlug('Spain national football team')).toBe('Spain_national_football_team');
  });

  it('never emits a path separator', () => {
    expect(cacheSlug('A/B\\C')).not.toMatch(/[/\\]/);
  });
});
