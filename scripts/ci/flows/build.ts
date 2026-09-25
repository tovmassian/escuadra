// `store-build` for one platform. Production builds are gated on the version, the lock
// and the runtime and, with submit, open the review freeze. Every build's runtime is
// checked against the fingerprint the runner computed for the same commit, which
// answers "does a Linux runner agree with EAS?" on every build. §10 of the design.
import { done, failed, type Outcome } from '../lib/outcome.ts';
import {
  PLATFORM_NAMES,
  buildUrl,
  buildRuntime,
  lockState,
  parseReleaseBranch,
  short,
  type Platform,
} from '../lib/release.ts';
import { computeFingerprint, listBuilds, startBuild, viewBuild } from './eas.ts';
import { createFreeze } from './github.ts';
import type { Runner } from './runner.ts';

export interface BuildContext {
  repo: string;
  branch: string;
  platform: Platform;
  profile: 'production' | 'preview';
  submit: boolean;
  rebuild: boolean;
  appJsonVersion: string;
  account: string;
  runUrl: string;
}

export async function runStoreBuild(runner: Runner, ctx: BuildContext): Promise<Outcome> {
  const name = PLATFORM_NAMES[ctx.platform];
  const version = parseReleaseBranch(ctx.branch);
  if (!version)
    return failed(`\`${ctx.branch}\` isn't a release branch: builds run only on release/X.Y.Z.`);
  const production = ctx.profile === 'production';
  if (production && ctx.appJsonVersion !== version) {
    return failed(
      `\`app.json\` says ${ctx.appJsonVersion} but the branch is ${version}. Bump it first: a mismatched ` +
        `build would count as ${ctx.appJsonVersion} and lock the wrong branch.`,
    );
  }

  const productionBuilds = await listBuilds(runner, {
    platform: ctx.platform,
    profile: 'production',
    appVersion: version,
  });
  const lock = lockState(productionBuilds, ctx.platform, version);
  const fingerprint = await computeFingerprint(runner, ctx.platform);
  if (production && lock.state === 'pending') {
    return failed(`Build ${lock.build.appBuildVersion} of ${version} is still running.`);
  }
  if (production && lock.state === 'locked') {
    if (lock.runtime !== fingerprint) {
      return failed(
        `${name} ${version} is locked to \`${short(lock.runtime)}\` (build ${lock.build.appBuildVersion}); ` +
          `this commit is \`${short(fingerprint)}\`. A runtime change needs a new version.`,
      );
    }
    if (!ctx.rebuild) {
      return failed(
        `${name} ${version} is already built on this runtime (build ${lock.build.appBuildVersion}). ` +
          'Turn on rebuild only to embed newer JS for a review.',
      );
    }
  }

  const built = await startBuild(runner, ctx.platform, ctx.profile, production && ctx.submit);
  const started = built.find((candidate) => candidate.platform.toLowerCase() === ctx.platform);
  // eas-cli 24.7's --auto-submit JSON can report the status from enqueue (IN_QUEUE) for a
  // build that finished; a fresh build:view reports the settled one.
  const build = started && (await viewBuild(runner, started.id));
  const url = build ? buildUrl(ctx.account, build.id) : '(no build returned)';
  if (!build || build.status !== 'FINISHED') {
    return failed(`The ${name} build didn't finish (status ${build?.status ?? 'unknown'}): ${url}`);
  }
  const runtime = buildRuntime(build);
  if (runtime !== fingerprint) {
    return failed(
      `🚨 EAS built runtime \`${short(runtime)}\`, but the runner computed \`${short(fingerprint)}\` for the ` +
        `same commit: ${url}. Don't publish OTAs to this build until that's explained.`,
    );
  }
  if (!production && lock.state === 'locked' && runtime !== lock.runtime) {
    return failed(
      `Preview build ${url} runs \`${short(runtime)}\` but ${name} ${version} production runs ` +
        `\`${short(lock.runtime)}\`: it can't preview this version's OTAs.`,
    );
  }

  const lines = [
    `🏗️ ${ctx.profile} · ${name} · ${version} · build ${build.appBuildVersion} · runtime \`${short(runtime)}\` ✅ matches the runner`,
    url,
  ];
  if (production && ctx.submit) {
    const freezeUrl = await createFreeze(
      runner,
      ctx.repo,
      ctx.platform,
      version,
      `Build ${build.appBuildVersion} (${url}) was submitted by ${ctx.runUrl}. Production publishes for ` +
        `${ctx.platform}@${version} stay blocked until this issue is closed. Close it once the store review passes.`,
    );
    lines.push(
      `Freeze opened: ${freezeUrl}`,
      ctx.platform === 'ios'
        ? 'Next: Submit for Review in App Store Connect, then close the freeze once approved.'
        : 'Next: promote the build in Play Console, then close the freeze once approved.',
    );
  }
  if (!production)
    lines.push('Install it from the build page; it receives `preview` updates for this runtime.');
  return done(lines.join('\n\n'));
}
