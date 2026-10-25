// The telemetry allowlist and the pure decisions around it. Kept free of React
// Native and the SDK so Vitest can pin exactly what may leave the device —
// `lib/telemetry.ts` is the only module that actually sends anything.
//
// Every event, property and context key here is disclosed in the privacy policy
// and the store privacy declarations. Adding one is a disclosure review, not just a
// code change (CLAUDE.md guardrail 4). From 2.0.0 on, names and values are a
// contract: add, never rename (docs/superpowers/specs/2026-10-26-telemetry-2-0-design.md).

import type { Language, LanguageSource } from '@/i18n/resolveLanguage';
import type { Level } from '@/lib/questionEngine';
import type { ShareFormat } from '@/lib/shareResult';
import type { StudyView } from '@/lib/studyView';
import type { TipScreen } from '@/lib/tips';
import type { ThemePreference } from '@/theme/tokens';
import type { Squad } from '@/types/squad';

type SquadKind = Squad['kind'];

/** A count, coarsened: `0`, `1`, `2-5`, `6+`. */
export type CountBucket = '0' | '1' | '2-5' | '6+';
/** The font scale at the layout's own thresholds. */
export type TextSize = 'default' | 'large' | 'largest';
/** Where Difficulty was opened from: Home's Continue, Home's Your squads, the picker. */
export const TEAM_FROM = ['continue', 'squads', 'picker'] as const;
export type TeamFrom = (typeof TEAM_FROM)[number];
/** Where Study was opened from: Difficulty's ladder or Results. */
export const STUDY_FROM = ['ladder', 'results'] as const;
export type StudyFrom = (typeof STUDY_FROM)[number];
/** What built the round: Difficulty's Play, or Results' Retry or next level. */
export type RoundSource = 'ladder' | 'retry' | 'nextLevel';
export type ResetScope = 'team' | 'scores' | 'all';
/** The best score before this round, or `none` on a first play. */
export type PreviousBest = 'none' | number;

/** Allowed property names per event. A value's type lives in `TelemetryProps`. */
export const TELEMETRY_EVENTS = {
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
} as const satisfies Record<string, readonly string[]>;

export type TelemetryEvent = keyof typeof TELEMETRY_EVENTS;

/** A team, by its squad id (never its name), and whether it is a club or a nation. */
interface TeamProps {
  squad: string;
  kind: SquadKind;
}

type None = Record<string, never>;

export interface TelemetryProps {
  'TelemetryDeck.Session.started': None;
  'app.launched': {
    languageSource: LanguageSource;
    theme: ThemePreference;
    haptics: 'on' | 'off';
    'TelemetryDeck.Accessibility.isReduceMotionEnabled'?: boolean;
    textSize: TextSize;
    starred: CountBucket;
    /** Teams with a best score. */
    teams: CountBucket;
  };
  'team.opened': TeamProps & { from?: TeamFrom; search?: boolean };
  'round.started': TeamProps & { level: Level; source: RoundSource };
  'round.completed': TeamProps & {
    level: Level;
    score: number;
    aLaEscuadra: boolean;
    previousBest: PreviousBest;
    missedName: number;
    /** Levels 2 and 3. */
    missedPosition?: number;
    /** Level 3. */
    missedClubOrNationality?: number;
    seconds: number;
  };
  'round.left': TeamProps & { level: Level; question: number; score: number; seconds: number };
  'study.opened': TeamProps & { from?: StudyFrom; view: StudyView };
  'study.namesHidden': TeamProps;
  'tips.closed': { screen: TipScreen; skipped: boolean };
  'intro.skipped': None;
  'result.shared': TeamProps & { level: Level; score: number; format: ShareFormat };
  'picker.noResults': { kind: SquadKind };
  'progress.reset': { scope: ResetScope; squad?: string };
}

/**
 * The signal payload for an event: allowlisted keys only, every value a
 * string (TelemetryDeck stores payload values as strings anyway). Keys a
 * caller passes outside the allowlist are dropped, so a cast at a call site
 * cannot widen what is sent.
 */
export function buildPayload<E extends TelemetryEvent>(
  event: E,
  props: TelemetryProps[E],
): Record<string, string> {
  const payload: Record<string, string> = {};
  const values = props as Record<string, unknown>;
  for (const key of TELEMETRY_EVENTS[event] as readonly string[]) {
    if (values[key] !== undefined) payload[key] = String(values[key]);
  }
  return payload;
}

/** The context every signal carries, under TelemetryDeck's own names where it defines the fact. */
export const TELEMETRY_CONTEXT = [
  'TelemetryDeck.AppInfo.version',
  'TelemetryDeck.AppInfo.buildNumber',
  'TelemetryDeck.Device.platform',
  'TelemetryDeck.Device.systemMajorVersion',
  'update',
  'language',
] as const;

type TelemetryContextKey = (typeof TELEMETRY_CONTEXT)[number];

export interface TelemetryContextInput {
  /** `Platform.OS`. */
  os: string;
  appVersion: string | null;
  buildNumber: string | null;
  /** The system's version as the platform reports it: `18.1` on iOS, `15` on Android. */
  osVersion: string | null;
  /** The running update, as Settings names it (`updateTag`). */
  update: string | null;
  language: Language | null;
}

/** The context's payload. A value that can't be read is left out, never guessed. */
export function contextPayload(input: TelemetryContextInput): Record<string, string> {
  const platform = input.os === 'ios' ? 'iOS' : input.os === 'android' ? 'Android' : null;
  const values: Record<TelemetryContextKey, string | null> = {
    'TelemetryDeck.AppInfo.version': input.appVersion,
    'TelemetryDeck.AppInfo.buildNumber': input.buildNumber,
    'TelemetryDeck.Device.platform': platform,
    'TelemetryDeck.Device.systemMajorVersion': input.osVersion?.split('.')[0] || null,
    update: input.update,
    language: input.language,
  };
  const payload: Record<string, string> = {};
  for (const key of TELEMETRY_CONTEXT) {
    const value = values[key];
    if (value) payload[key] = value;
  }
  return payload;
}

export function countBucket(n: number): CountBucket {
  if (n <= 0) return '0';
  if (n === 1) return '1';
  return n <= 5 ? '2-5' : '6+';
}

/** Above 1.35 is where Results' fixed cards start to strain (the 2.0 handoff). */
export function textSizeBucket(fontScale: number): TextSize {
  if (fontScale <= 1.05) return 'default';
  return fontScale <= 1.35 ? 'large' : 'largest';
}

/** A round's active time, to the nearest 10 seconds, capped at 10 minutes. */
export function roundSeconds(ms: number): number {
  return Math.min(600, Math.max(0, Math.round(ms / 10_000) * 10));
}

export type AppPhase = 'foreground' | 'background';

/**
 * A session starts again when the app returns from the background, as
 * TelemetryDeck's own SDKs do on iOS. iOS's `inactive` (Control Center, a call
 * banner) is neither.
 */
export function nextAppPhase(
  phase: AppPhase,
  appState: string,
): { phase: AppPhase; startsSession: boolean } {
  if (appState === 'background') return { phase: 'background', startsSession: false };
  if (appState === 'active') return { phase: 'foreground', startsSession: phase === 'background' };
  return { phase, startsSession: false };
}

/** A route param, if it is one of the allowed values. */
export function paramOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

export interface LaunchInput {
  languageSource: LanguageSource;
  themePreference: ThemePreference;
  haptics: boolean;
  /** Null when the system could not say. */
  reduceMotion: boolean | null;
  fontScale: number;
  starredSquads: readonly string[];
  /** `stores/progress.ts`'s, keyed `${squadId}:${level}`. */
  bestScores: Record<string, unknown>;
}

/** `app.launched`'s properties: the settings, and how far the player has spread. */
export function launchProps(input: LaunchInput): TelemetryProps['app.launched'] {
  const teams = new Set(
    Object.keys(input.bestScores).map((key) => key.slice(0, key.lastIndexOf(':'))),
  );
  return {
    languageSource: input.languageSource,
    theme: input.themePreference,
    haptics: input.haptics ? 'on' : 'off',
    ...(input.reduceMotion === null
      ? {}
      : { 'TelemetryDeck.Accessibility.isReduceMotionEnabled': input.reduceMotion }),
    textSize: textSizeBucket(input.fontScale),
    starred: countBucket(input.starredSquads.length),
    teams: countBucket(teams.size),
  };
}

export interface TelemetryEnvironment {
  isDev: boolean;
  platform: string;
  enabled: boolean;
  appId: string;
  installId: string | null;
  hasTextEncoder: boolean;
}

/**
 * Whether a signal may be sent at all. Inert in development and on web — the
 * web build is what `npm run shots*` captures, so Playwright never sends —
 * when the user has opted out, and whenever the pieces a signal needs are
 * missing, so a misconfiguration fails silent rather than crashing.
 */
export function telemetryGate(env: TelemetryEnvironment): boolean {
  return (
    !env.isDev &&
    env.platform !== 'web' &&
    env.enabled &&
    env.appId !== '' &&
    env.installId !== null &&
    env.hasTextEncoder
  );
}

/** Everything but a production-channel build sends TelemetryDeck test signals. */
export function isTestMode(channel: string | null): boolean {
  return channel !== 'production';
}
