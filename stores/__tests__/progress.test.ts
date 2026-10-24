import { beforeEach, describe, expect, it, vi } from 'vitest';

// The persisted store writes through AsyncStorage, which needs a native
// module; an in-memory stand-in records what would reach the disk.
const disk = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => disk.get(key) ?? null,
    setItem: async (key: string, value: string) => void disk.set(key, value),
    removeItem: async (key: string) => void disk.delete(key),
  },
}));

const { useProgress, migrateProgress } = await import('../progress');
const { listSquads } = await import('@/lib/squads');

beforeEach(() => {
  useProgress.setState({
    starredSquads: [],
    bestScores: {},
    lastPlayed: null,
    tipsSeen: [],
    tipsSkipped: false,
  });
});

describe('starred squads', () => {
  it('starts with none', () => {
    expect(useProgress.getInitialState().starredSquads).toEqual([]);
  });

  it('a toggle stars a team, newest first, and a second toggle removes it', () => {
    useProgress.getState().toggleStar('spain');
    useProgress.getState().toggleStar('arsenal');
    expect(useProgress.getState().starredSquads).toEqual(['arsenal', 'spain']);
    useProgress.getState().toggleStar('spain');
    expect(useProgress.getState().starredSquads).toEqual(['arsenal']);
  });

  it('persists as a list of squad ids', () => {
    useProgress.getState().toggleStar('spain');
    const stored = JSON.parse(disk.get('escuadra-progress') ?? '{}') as {
      state: { starredSquads: unknown };
    };
    expect(stored.state.starredSquads).toEqual(['spain']);
  });

  it('survives reset, like the other preferences', () => {
    useProgress.getState().toggleStar('spain');
    useProgress.getState().recordScore('spain', 1, 8, '2026-10-21');
    useProgress.getState().reset();
    expect(useProgress.getState().bestScores).toEqual({});
    expect(useProgress.getState().starredSquads).toEqual(['spain']);
  });
});

describe('best scores (#180)', () => {
  const OLD = '2026-08-14';
  const NOW = '2026-10-21';

  it('keeps the date of the squad a best was set on', () => {
    useProgress.getState().recordScore('arm', 1, 7, NOW);
    expect(useProgress.getState().bestScores['arm:1']).toEqual({ score: 7, squadUpdated: NOW });
  });

  it('keeps the higher score among rounds on the current squad', () => {
    useProgress.getState().recordScore('arm', 1, 9, NOW);
    useProgress.getState().recordScore('arm', 1, 6, NOW);
    expect(useProgress.getState().bestScores['arm:1']?.score).toBe(9);
  });

  it('replaces an outdated best with a round on the updated squad, even a lower one', () => {
    useProgress.getState().recordScore('arm', 1, 10, OLD);
    useProgress.getState().recordScore('arm', 1, 4, NOW);
    expect(useProgress.getState().bestScores['arm:1']).toEqual({ score: 4, squadUpdated: NOW });
  });
});

describe('migration from version 0', () => {
  const arm = listSquads().find((s) => s.id === 'arm');

  it("dates version 0's bare scores with the squad's current date", () => {
    const migrated = migrateProgress({ bestScores: { 'arm:1': 10, 'arm:2': 0 } }, 0);
    expect(migrated.bestScores).toEqual({
      'arm:1': { score: 10, squadUpdated: arm?.lastUpdated },
      'arm:2': { score: 0, squadUpdated: arm?.lastUpdated },
    });
  });

  it('leaves the other persisted fields as they were', () => {
    const migrated = migrateProgress({ bestScores: {}, starredSquads: ['arm'], haptics: false }, 0);
    expect(migrated.starredSquads).toEqual(['arm']);
    expect(migrated.haptics).toBe(false);
  });

  it('rehydrates a version 0 store from disk as current scores', async () => {
    disk.set(
      'escuadra-progress',
      JSON.stringify({ state: { bestScores: { 'arm:3': 6 } }, version: 0 }),
    );
    await useProgress.persist.rehydrate();
    expect(useProgress.getState().bestScores['arm:3']).toEqual({
      score: 6,
      squadUpdated: arm?.lastUpdated,
    });
    const stored = JSON.parse(disk.get('escuadra-progress') ?? '{}') as { version: number };
    expect(stored.version).toBe(1);
  });
});

describe('how to play tips', () => {
  it('starts with nothing seen and nothing skipped', () => {
    const initial = useProgress.getInitialState();
    expect(initial.tipsSeen).toEqual([]);
    expect(initial.tipsSkipped).toBe(false);
  });

  it('marks a screen seen once', () => {
    useProgress.getState().markTipsSeen('picker');
    useProgress.getState().markTipsSeen('picker');
    useProgress.getState().markTipsSeen('study');
    expect(useProgress.getState().tipsSeen).toEqual(['picker', 'study']);
  });

  it('skips for good', () => {
    useProgress.getState().skipTips();
    expect(useProgress.getState().tipsSkipped).toBe(true);
  });

  it('survives reset', () => {
    useProgress.getState().markTipsSeen('difficulty');
    useProgress.getState().skipTips();
    useProgress.getState().reset();
    expect(useProgress.getState().tipsSeen).toEqual(['difficulty']);
    expect(useProgress.getState().tipsSkipped).toBe(true);
  });

  it('persists both', () => {
    useProgress.getState().markTipsSeen('picker');
    useProgress.getState().skipTips();
    const stored = JSON.parse(disk.get('escuadra-progress') ?? '{}') as {
      state: { tipsSeen: unknown; tipsSkipped: unknown };
    };
    expect(stored.state.tipsSeen).toEqual(['picker']);
    expect(stored.state.tipsSkipped).toBe(true);
  });
});

describe('resets (#197)', () => {
  const at = (score: number) => ({ score, squadUpdated: '2026-10-01' });

  it('resetSquad drops one squad and keeps Continue, the star and the tips', () => {
    useProgress.setState({
      bestScores: { 'arm:1': at(10), 'arm:2': at(8), 'esp:1': at(7) },
      lastPlayed: { squadId: 'arm', level: 2 },
      starredSquads: ['arm'],
      tipsSeen: ['difficulty'],
      tipsSkipped: true,
    });
    useProgress.getState().resetSquad('arm');
    const s = useProgress.getState();
    expect(s.bestScores).toEqual({ 'esp:1': at(7) });
    expect(s.lastPlayed).toEqual({ squadId: 'arm', level: 2 });
    expect(s.starredSquads).toEqual(['arm']);
    expect(s.tipsSeen).toEqual(['difficulty']);
    expect(s.tipsSkipped).toBe(true);
  });

  it('reset clears every score and Continue, and keeps the rest', () => {
    useProgress.setState({
      bestScores: { 'arm:1': at(10) },
      lastPlayed: { squadId: 'arm', level: 1 },
      starredSquads: ['arm'],
      tipsSkipped: true,
    });
    useProgress.getState().reset();
    const s = useProgress.getState();
    expect(s.bestScores).toEqual({});
    expect(s.lastPlayed).toBeNull();
    expect(s.starredSquads).toEqual(['arm']);
    expect(s.tipsSkipped).toBe(true);
  });

  it.each([true, false])(
    'factoryReset returns everything to first launch but keeps usage statistics %s',
    (telemetryEnabled) => {
      useProgress.setState({
        bestScores: { 'arm:1': at(10) },
        lastPlayed: { squadId: 'arm', level: 1 },
        themePreference: 'light',
        languagePreference: 'fr',
        installId: 'old-id',
        telemetryEnabled,
        haptics: false,
        studyView: 'list',
        reviewAskedVersion: '2.0.0',
        starredSquads: ['arm', 'esp'],
        tipsSeen: ['picker', 'results'],
        tipsSkipped: true,
      });
      useProgress.getState().factoryReset('new-id');
      const s = useProgress.getState();
      const initial = useProgress.getInitialState();
      expect(s.telemetryEnabled).toBe(telemetryEnabled);
      expect(s.reviewAskedVersion).toBe('2.0.0');
      expect(s.installId).toBe('new-id');
      for (const key of [
        'bestScores',
        'lastPlayed',
        'themePreference',
        'languagePreference',
        'haptics',
        'studyView',
        'starredSquads',
        'tipsSeen',
        'tipsSkipped',
      ] as const) {
        expect(s[key], key).toEqual(initial[key]);
      }
    },
  );

  it('factoryReset leaves no data field unhandled', () => {
    // A field added to the store later must be reset or kept on purpose: this
    // lists every data field, so a new one fails here until it is placed.
    const data = Object.entries(useProgress.getInitialState())
      .filter(([, value]) => typeof value !== 'function')
      .map(([key]) => key)
      .sort();
    expect(data).toEqual(
      [
        'bestScores',
        'haptics',
        'installId',
        'languagePreference',
        'lastPlayed',
        'reviewAskedVersion',
        'starredSquads',
        'studyView',
        'telemetryEnabled',
        'themePreference',
        'tipsSeen',
        'tipsSkipped',
      ].sort(),
    );
  });
});
