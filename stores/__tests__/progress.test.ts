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

const { useProgress } = await import('../progress');

beforeEach(() => {
  useProgress.setState({ starredSquads: [], bestScores: {}, lastPlayed: null });
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
    useProgress.getState().recordScore('spain', 1, 8);
    useProgress.getState().reset();
    expect(useProgress.getState().bestScores).toEqual({});
    expect(useProgress.getState().starredSquads).toEqual(['spain']);
  });
});
