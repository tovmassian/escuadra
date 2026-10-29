// fingerprint.config.js skips package.json's scripts and the text of .gitignore
// (docs/release.md, "OTA or store build?"). Skipping the scripts is safe only while none
// of them but husky's runs during a native build: this holds package.json to that.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { SourceSkips } from 'expo/fingerprint';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const config = require('../../fingerprint.config.js') as { sourceSkips: readonly string[] };
const { scripts } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { scripts: Record<string, string> };

/**
 * What npm runs on an install, `npm ci` on EAS included: the install and prepare hooks,
 * and the dependencies hooks it runs whenever node_modules changes. Then the hooks EAS
 * Build runs around a native build.
 */
const BUILD_HOOK = /^(pre|post)?(install|prepare|dependencies)$|^prepublish$|^eas-build-/;

/** Husky's `prepare` writes git hooks and nothing native. */
const isHusky = ([name, command]: [string, string]) => name === 'prepare' && command === 'husky';

describe('fingerprint.config.js', () => {
  it('names only skips @expo/fingerprint knows, as it ignores any other without a word', () => {
    const unknown = config.sourceSkips.filter((name) => !(name in SourceSkips));
    expect(unknown).toEqual([]);
  });

  it.runIf(config.sourceSkips.includes('PackageJsonScriptsAll'))(
    'skips the scripts while none but husky runs during a native build',
    () => {
      const hooks = Object.entries(scripts).filter(([name]) => BUILD_HOOK.test(name));
      expect(hooks.filter((hook) => !isHusky(hook))).toEqual([]);
    },
  );
});
