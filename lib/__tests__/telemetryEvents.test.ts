import { describe, expect, it } from 'vitest';
import {
  STUDY_FROM,
  TEAM_FROM,
  TELEMETRY_CONTEXT,
  TELEMETRY_EVENTS,
  buildPayload,
  contextPayload,
  countBucket,
  isTestMode,
  launchProps,
  nextAppPhase,
  paramOf,
  roundSeconds,
  telemetryGate,
  textSizeBucket,
  type LaunchInput,
  type TelemetryContextInput,
  type TelemetryEnvironment,
} from '../telemetryEvents';

const sendable: TelemetryEnvironment = {
  isDev: false,
  platform: 'ios',
  enabled: true,
  appId: 'APP-ID',
  installId: '7f3c1d2e-0000-4000-8000-000000000000',
  hasTextEncoder: true,
};

// Every event and property that may leave the device, and the context every
// signal carries. A change here is a disclosure review (CLAUDE.md, guardrail 4):
// About, the privacy pages and the store answers change with it.
describe('TELEMETRY_EVENTS', () => {
  it('is exactly the disclosed allowlist', () => {
    expect(TELEMETRY_EVENTS).toEqual({
      'TelemetryDeck.Session.started': [],
      'app.launched': [
        'languageSource',
        'theme',
        'haptics',
        'TelemetryDeck.Accessibility.isReduceMotionEnabled',
        'textSize',
        'starred',
        'teams',
      ],
      'team.opened': ['squad', 'kind', 'from', 'search'],
      'round.started': ['squad', 'kind', 'level', 'source'],
      'round.completed': [
        'squad',
        'kind',
        'level',
        'score',
        'aLaEscuadra',
        'previousBest',
        'missedName',
        'missedPosition',
        'missedClubOrNationality',
        'seconds',
      ],
      'round.left': ['squad', 'kind', 'level', 'question', 'score', 'seconds'],
      'study.opened': ['squad', 'kind', 'from', 'view'],
      'study.namesHidden': ['squad', 'kind'],
      'tips.closed': ['screen', 'skipped'],
      'intro.skipped': [],
      'result.shared': ['squad', 'kind', 'level', 'score', 'format'],
      'picker.noResults': ['kind'],
      'progress.reset': ['scope', 'squad'],
    });
  });

  it('puts exactly the disclosed context on every signal', () => {
    expect(TELEMETRY_CONTEXT).toEqual([
      'TelemetryDeck.AppInfo.version',
      'TelemetryDeck.AppInfo.buildNumber',
      'TelemetryDeck.Device.platform',
      'TelemetryDeck.Device.systemMajorVersion',
      'update',
      'language',
    ]);
  });

  it('never lets an event property shadow the context', () => {
    const context = new Set<string>(TELEMETRY_CONTEXT);
    for (const keys of Object.values(TELEMETRY_EVENTS)) {
      for (const key of keys) expect(context.has(key), key).toBe(false);
    }
  });
});

describe('buildPayload', () => {
  it('stringifies every value', () => {
    expect(
      buildPayload('round.completed', {
        squad: 'arm',
        kind: 'club',
        level: 3,
        score: 10,
        aLaEscuadra: true,
        previousBest: 'none',
        missedName: 0,
        missedPosition: 0,
        missedClubOrNationality: 0,
        seconds: 80,
      }),
    ).toEqual({
      squad: 'arm',
      kind: 'club',
      level: '3',
      score: '10',
      aLaEscuadra: 'true',
      previousBest: 'none',
      missedName: '0',
      missedPosition: '0',
      missedClubOrNationality: '0',
      seconds: '80',
    });
  });

  it('leaves out a property the level does not ask', () => {
    expect(
      buildPayload('round.completed', {
        squad: 'esp',
        kind: 'nation',
        level: 1,
        score: 7,
        aLaEscuadra: false,
        previousBest: 8,
        missedName: 3,
        seconds: 50,
      }),
    ).toEqual({
      squad: 'esp',
      kind: 'nation',
      level: '1',
      score: '7',
      aLaEscuadra: 'false',
      previousBest: '8',
      missedName: '3',
      seconds: '50',
    });
  });

  it('drops keys outside the allowlist even if a caller smuggles them in', () => {
    const props = { squad: 'esp', kind: 'nation', squadName: 'Spain' } as unknown as {
      squad: string;
      kind: 'nation';
    };
    expect(buildPayload('study.namesHidden', props)).toEqual({ squad: 'esp', kind: 'nation' });
  });

  it('sends nothing but the event for an event without properties', () => {
    expect(buildPayload('intro.skipped', {})).toEqual({});
  });
});

describe('contextPayload', () => {
  const ios: TelemetryContextInput = {
    os: 'ios',
    appVersion: '2.0.0',
    buildNumber: '41',
    osVersion: '18.1',
    update: 'a1b2c3d4',
    language: 'de',
  };

  it("names the app's version, build, platform, system and update, and the language", () => {
    expect(contextPayload(ios)).toEqual({
      'TelemetryDeck.AppInfo.version': '2.0.0',
      'TelemetryDeck.AppInfo.buildNumber': '41',
      'TelemetryDeck.Device.platform': 'iOS',
      'TelemetryDeck.Device.systemMajorVersion': '18',
      update: 'a1b2c3d4',
      language: 'de',
    });
  });

  it('reads Android by its release', () => {
    expect(contextPayload({ ...ios, os: 'android', osVersion: '15' })).toMatchObject({
      'TelemetryDeck.Device.platform': 'Android',
      'TelemetryDeck.Device.systemMajorVersion': '15',
    });
  });

  it('leaves out what it cannot read, never guessing', () => {
    expect(
      contextPayload({
        os: 'web',
        appVersion: null,
        buildNumber: null,
        osVersion: null,
        update: null,
        language: null,
      }),
    ).toEqual({});
  });
});

describe('the buckets', () => {
  it.each([
    [0, '0'],
    [1, '1'],
    [2, '2-5'],
    [5, '2-5'],
    [6, '6+'],
    [40, '6+'],
  ])('counts %i as %s', (n, bucket) => {
    expect(countBucket(n)).toBe(bucket);
  });

  it.each([
    [0.85, 'default'],
    [1, 'default'],
    [1.05, 'default'],
    [1.1, 'large'],
    [1.35, 'large'],
    [1.4, 'largest'],
    [3.1, 'largest'],
  ])('reads a font scale of %d as %s text', (scale, bucket) => {
    expect(textSizeBucket(scale)).toBe(bucket);
  });

  it.each([
    [0, 0],
    [4_999, 0],
    [5_000, 10],
    [61_000, 60],
    [3_600_000, 600],
    [-5, 0],
  ])('rounds %i ms of play to %i seconds', (ms, seconds) => {
    expect(roundSeconds(ms)).toBe(seconds);
  });
});

describe('nextAppPhase', () => {
  it('starts a session on a return from the background', () => {
    expect(nextAppPhase('background', 'active')).toEqual({
      phase: 'foreground',
      startsSession: true,
    });
  });

  it('goes to the background without starting one', () => {
    expect(nextAppPhase('foreground', 'background')).toEqual({
      phase: 'background',
      startsSession: false,
    });
  });

  it("ignores iOS's inactive, in either phase", () => {
    expect(nextAppPhase('background', 'inactive')).toEqual({
      phase: 'background',
      startsSession: false,
    });
    expect(nextAppPhase('foreground', 'inactive')).toEqual({
      phase: 'foreground',
      startsSession: false,
    });
  });

  it('does not start one for an active app that never left', () => {
    expect(nextAppPhase('foreground', 'active')).toEqual({
      phase: 'foreground',
      startsSession: false,
    });
  });
});

describe('paramOf', () => {
  it('accepts an allowed route param', () => {
    expect(paramOf('squads', TEAM_FROM)).toBe('squads');
    expect(paramOf('results', STUDY_FROM)).toBe('results');
  });

  it('refuses anything else', () => {
    expect(paramOf('home', TEAM_FROM)).toBeUndefined();
    expect(paramOf(undefined, TEAM_FROM)).toBeUndefined();
    expect(paramOf(['squads'], TEAM_FROM)).toBeUndefined();
  });
});

describe('launchProps', () => {
  const input: LaunchInput = {
    languageSource: 'picked',
    themePreference: 'light',
    haptics: false,
    reduceMotion: true,
    fontScale: 1.2,
    starredSquads: ['arm'],
    bestScores: { 'arm:1': {}, 'arm:2': {}, 'esp:1': {} },
  };

  it('describes the settings and the progress, in buckets', () => {
    expect(launchProps(input)).toEqual({
      languageSource: 'picked',
      theme: 'light',
      haptics: 'off',
      'TelemetryDeck.Accessibility.isReduceMotionEnabled': true,
      textSize: 'large',
      starred: '1',
      teams: '2-5',
    });
  });

  it('leaves out Reduce Motion when it could not be read', () => {
    expect(launchProps({ ...input, reduceMotion: null })).not.toHaveProperty(
      'TelemetryDeck.Accessibility.isReduceMotionEnabled',
    );
  });
});

describe('telemetryGate', () => {
  it('sends when every condition holds', () => {
    expect(telemetryGate(sendable)).toBe(true);
  });

  it.each<[string, Partial<TelemetryEnvironment>]>([
    ['in development', { isDev: true }],
    ['on web (screenshot capture runs the web build)', { platform: 'web' }],
    ['when the user opted out', { enabled: false }],
    ['before an install ID exists', { installId: null }],
    ['with no App ID configured', { appId: '' }],
    ['with no TextEncoder', { hasTextEncoder: false }],
  ])('is inert %s', (_, override) => {
    expect(telemetryGate({ ...sendable, ...override })).toBe(false);
  });
});

describe('isTestMode', () => {
  it('is false only on the production channel', () => {
    expect(isTestMode('production')).toBe(false);
    expect(isTestMode('preview')).toBe(true);
    expect(isTestMode(null)).toBe(true);
  });
});
