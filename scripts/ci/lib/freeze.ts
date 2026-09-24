// Store-review freezes. An open issue labelled `ota-freeze` and titled
// `OTA freeze: <platform>@<version>` stops production publishes for exactly that
// platform and version: a reviewer's device runs the binary under review and picks up
// updates for its runtime. See docs/release.md ("Freeze during store review").
import type { Platform } from './release.ts';

export const FREEZE_LABEL = 'ota-freeze';

const FREEZE_TITLE = /^OTA freeze: (ios|android)@(\d+\.\d+\.\d+)(?:\s|$)/;

export interface Issue {
  number: number;
  title: string;
  url: string;
}

export function freezeTitle(platform: Platform, version: string): string {
  return `OTA freeze: ${platform}@${version}`;
}

/** The open freeze covering this platform and version, if any. */
export function findFreeze(
  issues: Issue[],
  platform: Platform,
  version: string,
): Issue | undefined {
  return issues.find((issue) => {
    const match = FREEZE_TITLE.exec(issue.title);
    return match !== null && match[1] === platform && match[2] === version;
  });
}
