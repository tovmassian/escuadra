import path from 'node:path';
import { defineConfig } from 'vitest/config';

// lib/ and stores/ hold pure logic worth unit-testing (per CLAUDE.md,
// lib/questionEngine.ts in particular must stay React-free and testable).
// theme/ and design/ are plain data — tokens, mark geometry, handoff
// re-exports — and are tested for internal consistency only. Screens and
// components are verified on-device instead: no RN test renderer is
// configured here on purpose.
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'lib/**/*.test.ts',
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
