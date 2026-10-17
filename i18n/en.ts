// The English catalog, the source every other language is typed against:
// `Messages = typeof en`. Deliberately not `as const` — its strings widen to
// `string`, so a translation can hold different words while a missing key, an
// extra key or a wrong parameter list still fails `npm run typecheck`.
// Values are strings, or functions when they take parameters; each function
// writes its own plural. No `Intl`: dates and plurals are written out here.
// Escuadra and a la escuadra come from ./names and are never translated.
// Short labels carry a length budget ("≤ N chars: where") that translators
// write to (#141, Text expansion). Spec: #141.

/** A squad's `lastUpdated`, split so each language orders it its own way. */
export interface CalendarDate {
  day: number;
  /** 1–12. */
  month: number;
  year: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const en = {
  common: {
    /** "Level 2": the round header, results, the share text and picture. */
    level: (level: number) => `Level ${level}`,
  },
  formats: {
    /** "21 Aug 2026". */
    date: ({ day, month, year }: CalendarDate) => `${day} ${MONTHS[month - 1] ?? ''} ${year}`,
  },
};

export type Messages = typeof en;
