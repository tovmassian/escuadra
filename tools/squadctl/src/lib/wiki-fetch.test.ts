import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_AGENT, cacheSlug } from './wiki-fetch.ts';

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

describe('user agent', () => {
  // Wikimedia policy allows refusing a generic or absent agent, so this must
  // name the tool and carry a contact.
  it('names the tool and a contact that is not a personal address', () => {
    expect(DEFAULT_USER_AGENT).toContain('squadctl');
    expect(DEFAULT_USER_AGENT).toMatch(/https?:\/\//);
    expect(DEFAULT_USER_AGENT).not.toContain('@');
  });
});
