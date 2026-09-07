// Minimal ANSI, no dependency. Colour is decoration: it must never change what
// the output says, and it must vanish the moment anything other than a human
// terminal is reading.
//
// Off when stdout is not a TTY (piped to a file or a pager), when NO_COLOR is
// set (https://no-color.org), and on a dumb terminal. `--json` output never
// passes through here at all — the base command suppresses human logging in
// that mode entirely.
const ESC = '\u001B[';

const ENABLED =
  process.stdout.isTTY === true &&
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== 'dumb';

const wrap =
  (open: number, close: number) =>
  (value: string): string =>
    ENABLED ? `${ESC}${open}m${value}${ESC}${close}m` : value;

export const colors = {
  /** Conflicts and failures — something needs a person. */
  red: wrap(31, 39),
  /** Warnings — worth reading, but nothing was blocked. */
  yellow: wrap(33, 39),
  /** A team was written. */
  blue: wrap(34, 39),
  /** A clean run: nothing is waiting on you. */
  green: wrap(32, 39),
  /** Non-events. `unchanged` is the absence of news, not news. */
  dim: wrap(2, 22),
  bold: wrap(1, 22),
};

export const colorEnabled = ENABLED;
