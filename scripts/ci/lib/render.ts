// Markdown for the release-gate PR comment. Pure: every hash and number comes in
// through the view. A hidden marker lets each run edit the one comment in place, and
// the preview section is a slot the `preview` job fills in afterwards.
import type { Issue } from './freeze.ts';
import type { Finding } from './pr.ts';
import { PLATFORMS, PLATFORM_NAMES, short, type Platform, type Verdict } from './release.ts';

export const COMMENT_MARKER = '<!-- release-gate -->';
const PREVIEW_START = '<!-- preview -->';
const PREVIEW_END = '<!-- /preview -->';

export interface GateView {
  baseRef: string;
  version: string;
  verdicts: Verdict[];
  errors: string[];
  explanations: Partial<Record<Platform, string>>;
  labels: Platform[];
  freezes: Issue[];
  findings: Finding[];
  dependencies: string[];
  warnings: string[];
}

function row(verdict: Verdict, version: string): string {
  const name = PLATFORM_NAMES[verdict.platform];
  const pr = `\`${short(verdict.fingerprint)}\``;
  switch (verdict.kind) {
    case 'open':
      return `| ${name} | open | — | ${pr} | ✅ no ${version} build yet |`;
    case 'pending':
      return `| ${name} | building | build ${verdict.build.appBuildVersion} · runtime pending | ${pr} | ❌ wait for the build |`;
    case 'match':
      return `| ${name} | locked | build ${verdict.build.appBuildVersion} · \`${short(verdict.runtime)}\` | ${pr} | ✅ OTA-compatible |`;
    case 'mismatch':
      return `| ${name} | locked | build ${verdict.build.appBuildVersion} · \`${short(verdict.runtime)}\` | ${pr} | ❌ runtime changed |`;
  }
}

export function renderGate(view: GateView): string {
  const lines = [
    COMMENT_MARKER,
    `### release-gate · \`${view.baseRef}\` (${view.version})`,
    '',
    '| Platform | State | Shipped build | This PR | |',
    '| --- | --- | --- | --- | --- |',
    ...view.verdicts.map((verdict) => row(verdict, view.version)),
    '',
  ];
  for (const error of view.errors) lines.push(`❌ ${error}`, '');
  for (const platform of PLATFORMS) {
    const explanation = view.explanations[platform];
    if (!explanation) continue;
    lines.push(
      `<details><summary>Why the ${PLATFORM_NAMES[platform]} runtime changed</summary>`,
      '',
      '```',
      explanation,
      '```',
      '',
      '</details>',
      '',
    );
  }
  const labels = view.labels.map((platform) => `ota:${platform}`).join(', ');
  const freezes = view.freezes.map((issue) => `#${issue.number} (${issue.title})`).join(', ');
  const preview = view.labels.length ? 'after this check passes' : 'nothing to publish';
  lines.push(
    `**Labels:** ${labels || 'none, so nothing is published'} · **Freeze:** ${freezes || 'none'}`,
    '',
    `${PREVIEW_START}**Preview:** ${preview}${PREVIEW_END}`,
  );
  if (view.labels.length) {
    lines.push(
      '',
      "`ota:*` confirms this PR doesn't change what data leaves the device (guardrail 4).",
    );
  }
  lines.push(
    '',
    "Once merged, whatever here isn't on `main` yet goes there as a PR of `git cherry-pick -x` commits.",
  );
  if (view.findings.length || view.dependencies.length) {
    lines.push('', '**Check against guardrail 4** (informational):');
    for (const finding of view.findings)
      lines.push(`- \`${finding.file}\`: ${finding.line.slice(0, 120)}`);
    for (const change of view.dependencies) lines.push(`- dependency ${change}`);
  }
  for (const warning of view.warnings) lines.push('', `⚠️ ${warning}`);
  return lines.join('\n');
}

export function renderBadBranch(baseRef: string): string {
  return `${COMMENT_MARKER}\n❌ \`${baseRef}\` isn't a release branch: PRs into \`release/*\` must target \`release/X.Y.Z\`.`;
}

/** The gate's comment with its preview line replaced: how the preview job reports. */
export function withPreview(body: string, text: string): string {
  const line = `${PREVIEW_START}**Preview:** ${text}${PREVIEW_END}`;
  const start = body.indexOf(PREVIEW_START);
  const end = body.indexOf(PREVIEW_END);
  if (start < 0 || end < start) return `${body}\n\n${line}`;
  return body.slice(0, start) + line + body.slice(end + PREVIEW_END.length);
}
