import { describe, expect, it } from 'vitest';
import {
  TELEMETRY_EVENTS,
  buildPayload,
  isTestMode,
  telemetryGate,
  type TelemetryEnvironment,
} from './telemetryEvents';

const sendable: TelemetryEnvironment = {
  isDev: false,
  platform: 'ios',
  enabled: true,
  appId: 'APP-ID',
  installId: '7f3c1d2e-0000-4000-8000-000000000000',
  hasTextEncoder: true,
};

describe('TELEMETRY_EVENTS', () => {
  it('is exactly the disclosed allowlist', () => {
    expect(Object.keys(TELEMETRY_EVENTS).sort()).toEqual([
      'app.launched',
      'result.shared',
      'round.completed',
      'round.started',
      'study.opened',
    ]);
  });
});

describe('buildPayload', () => {
  it('returns an empty payload for a prop-less event', () => {
    expect(buildPayload('app.launched', {})).toEqual({});
  });

  it('stringifies every value', () => {
    expect(
      buildPayload('round.completed', { kind: 'club', level: 3, score: 10, aLaEscuadra: true }),
    ).toEqual({ kind: 'club', level: '3', score: '10', aLaEscuadra: 'true' });
  });

  it('drops keys outside the allowlist even if a caller smuggles them in', () => {
    const props = { kind: 'nation', squadName: 'Spain' } as unknown as { kind: 'nation' };
    expect(buildPayload('study.opened', props)).toEqual({ kind: 'nation' });
  });

  it('keeps only level and score for a shared result', () => {
    expect(buildPayload('result.shared', { level: 2, score: 7 })).toEqual({
      level: '2',
      score: '7',
    });
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
