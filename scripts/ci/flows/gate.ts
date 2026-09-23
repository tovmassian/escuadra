// The `release-gate` check: a verdict per platform for a PR into release/X.Y.Z. It
// blocks on a runtime change, a build in flight, or `main` history reaching a locked
// branch; everything else it reports is informational. §6 of the design.
import { findFreeze } from '../lib/freeze.ts';
import { dependencyChanges, networkFindings, platformsFromLabels } from '../lib/pr.ts';
import {
  PLATFORMS,
  gateErrors,
  lockState,
  parseReleaseBranch,
  verdictFor,
  type Platform,
  type Verdict,
} from '../lib/release.ts';
import { COMMENT_MARKER, renderBadBranch, renderGate } from '../lib/render.ts';
import { computeFingerprint, explainMismatch, listBuilds } from './eas.ts';
import { basePackageJson, bringsMainCommits } from './git.ts';
import { openFreezes, pullRequestFiles, upsertComment } from './github.ts';
import type { Runner } from './runner.ts';

export interface GateContext {
  repo: string;
  baseRef: string;
  /** Null in a local dry run: no PR to read files from or comment on. */
  prNumber: number | null;
  labels: string[];
  appJsonVersion: string;
  /** package.json at the commit under test. */
  packageJson: string;
}

export interface GateReport {
  passed: boolean;
  body: string;
  /** The labelled platforms when the gate passed: what the preview job publishes. */
  publishable: Platform[];
  fingerprints: Partial<Record<Platform, string>>;
}

export async function runGate(runner: Runner, ctx: GateContext): Promise<GateReport> {
  const version = parseReleaseBranch(ctx.baseRef);
  if (!version) {
    const body = renderBadBranch(ctx.baseRef);
    return report(runner, ctx, { passed: false, body, publishable: [], fingerprints: {} });
  }

  const verdicts: Verdict[] = [];
  const fingerprints: Partial<Record<Platform, string>> = {};
  const explanations: Partial<Record<Platform, string>> = {};
  for (const platform of PLATFORMS) {
    const fingerprint = await computeFingerprint(runner, platform);
    fingerprints[platform] = fingerprint;
    const builds = await listBuilds(runner, {
      platform,
      profile: 'production',
      appVersion: version,
    });
    const verdict = verdictFor(platform, lockState(builds, platform, version), fingerprint);
    verdicts.push(verdict);
    if (verdict.kind === 'mismatch')
      explanations[platform] = await explainMismatch(runner, verdict.build.id);
  }

  const locked = verdicts.some((verdict) => verdict.kind !== 'open');
  const errors = gateErrors(
    verdicts,
    version,
    locked && (await bringsMainCommits(runner, ctx.baseRef)),
  );
  const labels = platformsFromLabels(ctx.labels);
  const issues = labels.length ? await openFreezes(runner, ctx.repo) : [];
  const files = ctx.prNumber === null ? [] : await pullRequestFiles(runner, ctx.repo, ctx.prNumber);
  const body = renderGate({
    baseRef: ctx.baseRef,
    version,
    verdicts,
    errors,
    explanations,
    labels,
    freezes: labels.flatMap((platform) => findFreeze(issues, platform, version) ?? []),
    findings: networkFindings(files),
    dependencies: dependencyChanges(await basePackageJson(runner, ctx.baseRef), ctx.packageJson),
    warnings:
      ctx.appJsonVersion === version
        ? []
        : [
            `\`app.json\` says ${ctx.appJsonVersion} but the branch is ${version}: bump it before the store build.`,
          ],
  });
  const passed = errors.length === 0;
  return report(runner, ctx, { passed, body, publishable: passed ? labels : [], fingerprints });
}

async function report(runner: Runner, ctx: GateContext, result: GateReport): Promise<GateReport> {
  if (ctx.prNumber !== null)
    await upsertComment(runner, ctx.repo, ctx.prNumber, COMMENT_MARKER, result.body);
  return result;
}
