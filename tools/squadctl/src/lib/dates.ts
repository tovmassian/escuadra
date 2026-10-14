// Birth dates as stored: `YYYY-MM-DD`, and only real ones. Shared by every
// writer and checker of a date — `birth`, `enrich`, decisions.json's
// validation and the app's data test — so none of them imports another's
// rules to validate one.

/** A real `YYYY-MM-DD` calendar date — 1998-02-29 is not one. */
export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
