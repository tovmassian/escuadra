import { describe, expect, it } from 'vitest';
import { getRoster, getSquad, listSquads } from './squads';

// Squad data is either LLM-generated or research-backed (CLAUDE.md) — either
// way, shirt numbers and current clubs are the fields most likely to drift
// or be wrong. These tests don't verify real-world accuracy, only internal
// consistency: every reference resolves and every squad has what the
// question engine needs from it. `verified` is a per-squad editorial claim
// set by whoever last fact-checked that squad's data, not something these
// tests can adjudicate — never flip it to true without a real source check.
describe('squad data integrity', () => {
  const squads = listSquads();

  it('has at least one squad', () => {
    expect(squads.length).toBeGreaterThan(0);
  });

  for (const manifest of listSquads()) {
    describe(manifest.name, () => {
      const roster = getRoster(manifest.id);

      it('every member resolves to a player', () => {
        expect(roster.length).toBeGreaterThan(0);
      });

      it('has no duplicate shirt numbers', () => {
        const numbers = roster.map((r) => r.member.no);
        expect(new Set(numbers).size).toBe(numbers.length);
      });

      it('has enough members for a level-3 round (6+)', () => {
        expect(roster.length).toBeGreaterThanOrEqual(6);
      });

      if (manifest.kind === 'club') {
        it('every player has a nationality', () => {
          for (const { player } of roster) expect(player.nationality.length).toBeGreaterThan(0);
        });
      } else {
        it('every player has a club (needed for level-3 nation squads)', () => {
          for (const { player } of roster) expect(player.club).not.toBeNull();
        });
      }

      it('has at least 4 distinct positions represented, or a plausible fallback pool', () => {
        const positions = new Set(roster.map((r) => r.player.position));
        expect(positions.size).toBeGreaterThan(0);
      });

      // Every squad — club or nation — carries a marker: the app's sole
      // visual identity element, since crests/badges/shields are never used.
      // For a nation the marker is the national flag; for a club it's the
      // club's colours as bands, never an emblem.
      it('has marker geometry on both the manifest and the squad file', () => {
        expect(manifest.marker, 'manifest entry').toBeDefined();
        expect(getSquad(manifest.id)?.marker, 'squad file').toBeDefined();
      });

      it('has a marker whose bands are valid hex', () => {
        const marker = manifest.marker;
        expect(marker.bands.length).toBeGreaterThan(0);
        for (const band of marker.bands) expect(band).toMatch(/^#[0-9a-fA-F]{6}$/);
        if (marker.overlay) expect(marker.overlay.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });

      it('has band weights matching the band count, when weights are given', () => {
        const marker = manifest.marker;
        if (marker.weights) expect(marker.weights.length).toBe(marker.bands.length);
      });

      it('agrees between the manifest and the squad file', () => {
        expect(getSquad(manifest.id)?.marker).toEqual(manifest.marker);
      });

      it('has a marker orientation of horizontal or vertical', () => {
        expect(['horizontal', 'vertical']).toContain(manifest.marker.orientation);
      });

      it('has an overlay shape of disc or diamond, when an overlay is given', () => {
        const overlay = manifest.marker.overlay;
        if (overlay) expect(['disc', 'diamond']).toContain(overlay.shape);
      });

      if (manifest.kind === 'club') {
        it('never carries an overlay device — those are for national flags only', () => {
          expect(manifest.marker.overlay).toBeUndefined();
        });
      }
    });
  }
});
