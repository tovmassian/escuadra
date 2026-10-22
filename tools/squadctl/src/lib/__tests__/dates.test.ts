import { describe, expect, it } from 'vitest';
import { isCalendarDate } from '../dates.ts';

describe('isCalendarDate', () => {
  it('accepts a real date, leap day included', () => {
    expect(isCalendarDate('2000-02-29')).toBe(true);
  });

  it('refuses a date that does not exist, or is not YYYY-MM-DD', () => {
    expect(isCalendarDate('1998-02-29')).toBe(false);
    expect(isCalendarDate('2001-13-01')).toBe(false);
    expect(isCalendarDate('2001-1-01')).toBe(false);
    expect(isCalendarDate('01/01/2001')).toBe(false);
  });
});
