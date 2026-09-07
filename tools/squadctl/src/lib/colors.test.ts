import { describe, expect, it } from 'vitest';
import { colorEnabled, colors } from './colors.ts';

describe('colors', () => {
  // Vitest captures stdout, so isTTY is false here — which is exactly the
  // condition that must strip colour. Piping output to a file or a pager
  // must never embed escape codes.
  it('is disabled when stdout is not a terminal', () => {
    expect(colorEnabled).toBe(false);
  });

  it('returns the text untouched when disabled, so output is never altered', () => {
    expect(colors.red('conflict:')).toBe('conflict:');
    expect(colors.yellow('warning:')).toBe('warning:');
    expect(colors.blue('written')).toBe('written');
    expect(colors.green('done')).toBe('done');
    expect(colors.dim('unchanged')).toBe('unchanged');
  });
});
