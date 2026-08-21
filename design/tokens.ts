// Handoff surface for the Claude Design project. A re-export, never a copy:
// theme/tokens.ts is the single definition, and design/handoff.test.ts pins
// object identity so this cannot quietly become a duplicate.
export * from '@/theme/tokens';
