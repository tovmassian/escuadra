import { describe, expect, it } from 'vitest';
import { fixture } from '../fixtures/load.ts';
import { gateErrors, lockState, verdictFor, type EasBuild } from './release.ts';
import {
  COMMENT_MARKER,
  renderBadBranch,
  renderGate,
  withPreview,
  type GateView,
} from './render.ts';

const builds = fixture<EasBuild[]>('builds.json');

function view(overrides: Partial<GateView> = {}): GateView {
  const verdicts = [
    verdictFor(
      'ios',
      lockState(builds, 'ios', '1.0.0'),
      '8b8b8840bd6e265b91976ef4690a9ef5cb632508',
    ),
    verdictFor(
      'android',
      lockState(builds, 'android', '1.0.0'),
      'c0a62aca64074feadd73c7042a3a9a8737a30405',
    ),
  ];
  return {
    baseRef: 'release/1.0.0',
    version: '1.0.0',
    verdicts,
    errors: gateErrors(verdicts, '1.0.0', false),
    explanations: { android: '🔄 Fingerprint differs\n📁 modified file: .gitignore' },
    labels: ['ios'],
    freezes: [],
    findings: [],
    dependencies: [],
    warnings: [],
    ...overrides,
  };
}

describe('renderGate', () => {
  it('shows a row per platform with the shipped build and this PR', () => {
    const body = renderGate(view());
    expect(body.startsWith(COMMENT_MARKER)).toBe(true);
    expect(body).toContain(
      '| iOS | locked | build 3 · `8b8b8840` | `8b8b8840` | ✅ OTA-compatible |',
    );
    expect(body).toContain(
      '| Android | locked | build 3 · `a616db89` | `c0a62aca` | ❌ runtime changed |',
    );
    expect(body).toContain('Why the Android runtime changed');
    expect(body).toContain('`release/1.0.1` from `release/1.0.0`');
    expect(body).toContain('**Labels:** ota:ios');
    expect(body).toContain('guardrail 4');
    expect(body).toContain("isn't on `main` yet goes there as a PR of `git cherry-pick -x`");
  });

  it('says nothing is published without labels, and lists guardrail-4 hints', () => {
    const body = renderGate(
      view({
        labels: [],
        findings: [{ file: 'lib/telemetry.ts', line: "fetch('https://x')" }],
        dependencies: ['added @telemetrydeck/sdk@^2.0.4'],
      }),
    );
    expect(body).toContain('none, so nothing is published');
    expect(body).toContain('- `lib/telemetry.ts`');
    expect(body).toContain('- dependency added @telemetrydeck/sdk@^2.0.4');
  });
});

describe('withPreview', () => {
  it('replaces only the preview line, repeatably', () => {
    const once = withPreview(renderGate(view()), 'iOS → group `1a2b3c4d`');
    const twice = withPreview(once, 'iOS → group `5e6f7a8b`');
    expect(twice).toContain('**Preview:** iOS → group `5e6f7a8b`');
    expect(twice).not.toContain('1a2b3c4d');
    expect(twice.split(COMMENT_MARKER)).toHaveLength(2);
  });
});

describe('renderBadBranch', () => {
  it('names the branch it refused', () => {
    expect(renderBadBranch('release-1.1.0')).toContain("`release-1.1.0` isn't a release branch");
  });
});
