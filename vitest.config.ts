import path from 'node:path';
import { defineConfig } from 'vitest/config';

// lib/ and stores/ hold pure logic worth unit-testing (per
// .claude/rules/quiz.md, lib/questionEngine.ts in particular must stay
// React-free and testable).
// scripts/ holds the roster-envelope contract shared by the squad data
// skills — pure and equally worth pinning; tools/ holds squadctl, whose
// parse/reconcile/assert layer is pure by design and network-free. theme/ and design/ are plain
// data — tokens, mark geometry, handoff re-exports — and are tested for
// internal consistency only. i18n/ resolves the language without React.
// Screens and components are verified on-device instead: no RN test renderer
// is configured here on purpose.
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'lib/**/*.test.ts',
      'i18n/**/*.test.ts',
      'scripts/**/*.test.ts',
      'tools/**/*.test.ts',
      'stores/**/*.test.ts',
      'theme/**/*.test.ts',
      'design/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
