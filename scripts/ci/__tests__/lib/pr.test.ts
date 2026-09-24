import { describe, expect, it } from 'vitest';
import {
  dependencyChanges,
  isDocsOrCiOnly,
  networkFindings,
  parsePlatform,
  platformsFromInput,
  platformsFromLabels,
} from '../../lib/pr.ts';

describe('platforms', () => {
  it('reads ota:* labels in a fixed order and ignores the rest', () => {
    expect(platformsFromLabels(['bug', 'ota:android', 'ota:ios'])).toEqual(['ios', 'android']);
    expect(platformsFromLabels(['release'])).toEqual([]);
  });

  it('reads a manual run input and refuses anything else', () => {
    expect(platformsFromInput('both')).toEqual(['ios', 'android']);
    expect(platformsFromInput('android')).toEqual(['android']);
    expect(() => platformsFromInput('all')).toThrow();
    expect(parsePlatform('ios')).toBe('ios');
    expect(() => parsePlatform('web')).toThrow();
  });
});

describe('isDocsOrCiOnly', () => {
  it('is true for docs, markdown, workflows and scripts/ci', () => {
    const files = [
      'docs/release.md',
      'CLAUDE.md',
      '.github/workflows/check.yml',
      'scripts/ci/gate.ts',
    ];
    expect(isDocsOrCiOnly(files)).toBe(true);
  });

  it('is false as soon as one file reaches the app', () => {
    expect(isDocsOrCiOnly(['docs/release.md', 'app/about.tsx'])).toBe(false);
  });
});

describe('networkFindings', () => {
  it('flags added network-looking lines in bundled files only', () => {
    const findings = networkFindings([
      {
        filename: 'lib/telemetry.ts',
        patch: "@@ -1 +1,2 @@\n+await fetch('https://nom.telemetrydeck.com/v2/', init);\n context",
      },
      { filename: 'docs/release.md', patch: '+see https://expo.dev' },
      { filename: 'app/about.tsx', patch: "-const old = fetch('x');\n+const label = 'About';" },
      { filename: 'assets/flags/es.png', patch: null },
    ]);
    expect(findings).toEqual([
      { file: 'lib/telemetry.ts', line: "await fetch('https://nom.telemetrydeck.com/v2/', init);" },
    ]);
  });
});

describe('dependencyChanges', () => {
  it('lists added, removed and changed runtime dependencies only', () => {
    const before = JSON.stringify({ dependencies: { expo: '~57.0.22', zustand: '^5.0.0' } });
    const after = JSON.stringify({
      dependencies: { expo: '~57.0.22', zustand: '^5.1.0', '@telemetrydeck/sdk': '^2.0.4' },
      devDependencies: { vitest: '^5.0.0' },
    });
    expect(dependencyChanges(before, after)).toEqual([
      'added @telemetrydeck/sdk@^2.0.4',
      'zustand ^5.0.0 → ^5.1.0',
    ]);
  });
});
