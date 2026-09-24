// The release-branch model: which version a branch carries, and whether each
// platform on it is still open or already locked to a shipped runtime. See
// docs/release.md ("Branches") and §4 of
// docs/superpowers/specs/2026-09-23-release-pipeline-design.md.
//
// Pure, like lib/questionEngine.ts: the flows fetch builds and fingerprints, and
// every decision lives here, where Vitest pins it.

export const PLATFORMS = ['ios', 'android'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_NAMES: Record<Platform, string> = { ios: 'iOS', android: 'Android' };

const RELEASE_BRANCH = /^release\/(\d+)\.(\d+)\.(\d+)$/;

/** The version `release/X.Y.Z` carries; null for any other branch name. */
export function parseReleaseBranch(ref: string): string | null {
  const match = RELEASE_BRANCH.exec(ref.replace(/^refs\/heads\//, ''));
  return match ? match.slice(1, 4).join('.') : null;
}

/** Where a runtime change on `version` goes instead: X.Y.Z → X.Y.(Z+1). */
export function nextPatch(version: string): string {
  const [major, minor, patch] = version.split('.');
  return `${major}.${minor}.${Number(patch) + 1}`;
}

/** The first eight characters of a hash, as comments and docs show them. */
export function short(hash: string | null | undefined): string {
  return hash ? hash.slice(0, 8) : 'unknown';
}

/** A build as `eas build:list --json` and `eas build --json` report it: the fields read here. */
export interface EasBuild {
  id: string;
  status: string;
  platform: string;
  buildProfile: string;
  appVersion: string;
  appBuildVersion?: string | null;
  runtime?: { version?: string | null } | null;
  fingerprint?: { hash?: string | null } | null;
  gitCommitHash?: string | null;
  createdAt: string;
}

// Unfinished builds lock too: otherwise a PR could move the runtime while a build of
// this version waits in the Free queue. Errored and cancelled builds don't.
const LOCKING_STATUSES = new Set(['NEW', 'IN_QUEUE', 'IN_PROGRESS', 'FINISHED']);

export type LockState =
  | { state: 'open' }
  | { state: 'locked'; build: EasBuild; runtime: string }
  | { state: 'pending'; build: EasBuild };

/** The runtime a build targets. Older builds report only the fingerprint hash: the same value. */
export function buildRuntime(build: EasBuild): string | null {
  return build.runtime?.version ?? build.fingerprint?.hash ?? null;
}

/**
 * The lock on one platform of `release/<version>`: the latest production build of that
 * version decides. `pending` means the build exists but EAS hasn't reported its runtime
 * yet; callers treat it as "wait", never as "open".
 */
export function lockState(builds: EasBuild[], platform: Platform, version: string): LockState {
  const latest = builds
    .filter(
      (build) =>
        build.platform.toLowerCase() === platform &&
        build.buildProfile === 'production' &&
        build.appVersion === version &&
        LOCKING_STATUSES.has(build.status),
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
  if (!latest) return { state: 'open' };
  const runtime = buildRuntime(latest);
  return runtime
    ? { state: 'locked', build: latest, runtime }
    : { state: 'pending', build: latest };
}

export type Verdict =
  | { platform: Platform; fingerprint: string; kind: 'open' }
  | { platform: Platform; fingerprint: string; kind: 'pending'; build: EasBuild }
  | {
      platform: Platform;
      fingerprint: string;
      kind: 'match' | 'mismatch';
      build: EasBuild;
      runtime: string;
    };

export function verdictFor(platform: Platform, lock: LockState, fingerprint: string): Verdict {
  switch (lock.state) {
    case 'open':
      return { platform, fingerprint, kind: 'open' };
    case 'pending':
      return { platform, fingerprint, kind: 'pending', build: lock.build };
    case 'locked':
      return {
        platform,
        fingerprint,
        kind: lock.runtime === fingerprint ? 'match' : 'mismatch',
        build: lock.build,
        runtime: lock.runtime,
      };
  }
}

/**
 * Everything that must stop a merge, in words; empty means the gate passes.
 * `bringsMainCommits` counts on an open branch too: every PR is squash-merged, so what a
 * release branch needs from `main` arrives by cherry-pick, never by merging `main`.
 */
export function gateErrors(
  verdicts: Verdict[],
  version: string,
  bringsMainCommits: boolean,
): string[] {
  const errors: string[] = [];
  for (const verdict of verdicts) {
    const name = PLATFORM_NAMES[verdict.platform];
    if (verdict.kind === 'mismatch') {
      errors.push(
        `${name}: this PR moves the runtime off build ${verdict.build.appBuildVersion} ` +
          `(\`${short(verdict.runtime)}\` → \`${short(verdict.fingerprint)}\`), so it isn't an ` +
          `OTA for ${version}. Put it on a new version: \`release/${nextPatch(version)}\` from ` +
          `\`release/${version}\`.`,
      );
    }
    if (verdict.kind === 'pending') {
      errors.push(
        `${name}: build ${verdict.build.appBuildVersion} of ${version} is still running. ` +
          'Re-run this check once it finishes.',
      );
    }
  }
  if (bringsMainCommits) {
    errors.push(
      "This PR brings commits from `main`'s history. Cut its branch from " +
        `\`release/${version}\` and \`git cherry-pick -x\` what it needs instead.`,
    );
  }
  return errors;
}
