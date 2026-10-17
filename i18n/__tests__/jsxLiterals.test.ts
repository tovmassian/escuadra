// The guard behind "user-visible text lives in i18n/" (#142): a hard-coded
// string in app/ or components/ JSX fails `npm run lint`. Runs the real
// eslint.config.js, so the props list and allowlist are tested as configured.
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: process.cwd() });
const RULES = new Set(['react/jsx-no-literals', 'no-restricted-syntax']);

async function hits(jsx: string): Promise<number> {
  const code = `import { Text, View, Pressable } from 'react-native';\nexport function F({ t, on, n }: { t: { a: string }; on: boolean; n: number }) {\n  return (${jsx});\n}\n`;
  const [result] = await eslint.lintText(code, { filePath: 'components/LintFixture.tsx' });
  return (result?.messages ?? []).filter((m) => m.ruleId !== null && RULES.has(m.ruleId)).length;
}

describe('hard-coded UI strings fail lint', { timeout: 60_000 }, () => {
  it.each([
    ['JSX text', '<Text>Start Training</Text>'],
    ['a string child', "<Text>{'Start Training'}</Text>"],
    ['a template child', '<Text>{`Level ${n}`}</Text>'],
    ['a ternary child', "<Text>{on ? 'Show names' : 'Hide names'}</Text>"],
    ['a spoken label', '<Pressable accessibilityLabel="Close" />'],
    ['a template label', '<Pressable accessibilityLabel={`Score: ${n}`} />'],
    ['a ternary label', "<Pressable accessibilityLabel={on ? 'Show as list' : 'Show as cards'} />"],
    ['a custom label prop', '<View label="Study This Squad" />'],
    ['a hint', '<Pressable accessibilityHint="Reveals the name" />'],
  ])('%s', async (_, jsx) => {
    expect(await hits(jsx)).toBeGreaterThan(0);
  });

  it.each([
    ['catalog text', '<Text>{t.a}</Text>'],
    ['punctuation', "<Text>‹ {t.a}{' · '}/{n}</Text>"],
    [
      'props never shown or spoken',
      '<Pressable testID="x-close" accessibilityRole="button" pointerEvents="none" />',
    ],
    ['a ternary enum', "<Pressable accessibilityRole={on ? 'button' : undefined} />"],
    ['a joined line', "<Text>{[t.a, t.a].join(' · ')}</Text>"],
  ])('passes %s', async (_, jsx) => {
    expect(await hits(jsx)).toBe(0);
  });
});
