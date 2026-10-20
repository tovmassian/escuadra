// A catalog flattened to its texts (#145), for the catalog tests and the
// review sheet. A function is called with placeholders ("{1}", "{2}"…), so
// "Who wears {1}?" shows where its value goes. React-free.
import type { Messages } from './en';
import type { Language } from './resolveLanguage';

export interface Leaf {
  /** "round.whoWears", "ladder.levels.2.title", "about.intro.0". */
  path: string;
  /** The text, or a function's text with "{1}"… in place of its arguments. */
  text: string;
  /** A function's parameter count; 0 for a plain string. */
  arity: number;
  /** A function's own call, for the review sheet's singular and zero forms. */
  call?: (...args: unknown[]) => string;
}

const PLACEHOLDERS = ['{1}', '{2}', '{3}', '{4}', '{5}'];

/** Functions whose argument is not a value to write into the text. */
const SAMPLE_ARGS: Readonly<Record<string, readonly unknown[]>> = {
  'formats.date': [{ day: 21, month: 8, year: 2026 }],
  'formats.longDate': [{ day: 21, month: 8, year: 2026 }],
};

/** What a language has not translated yet: About and privacy (#146) and the
 *  store listing (#147). Each language drops `about.` when its About lands. */
export const LATER_PATHS: Readonly<Record<Language, readonly string[]>> = {
  en: [],
  de: ['store.'],
  fr: ['store.'],
  es: ['store.'],
  it: ['store.'],
};

export function isLater(path: string, language: Language): boolean {
  return LATER_PATHS[language].some((prefix) => path.startsWith(prefix));
}

export function catalogLeaves(messages: Messages): Leaf[] {
  const leaves: Leaf[] = [];
  const walk = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      leaves.push({ path, text: value, arity: 0 });
    } else if (typeof value === 'function') {
      // A catalog function takes values and returns a string; `Function` has
      // no call signature this file can use without saying so.
      const fn = value as (...args: unknown[]) => unknown;
      const call = (...args: unknown[]) => String(fn(...args));
      const args = SAMPLE_ARGS[path] ?? PLACEHOLDERS.slice(0, fn.length);
      let text: string;
      try {
        text = call(...args);
      } catch (error) {
        // A translation that throws must not hide the rest of the catalog:
        // the tests that compare texts then name this path.
        text = `⚠ threw: ${error instanceof Error ? error.message : String(error)}`;
      }
      leaves.push({ path, text, arity: fn.length, call });
    } else if (value !== null && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        walk(child, path === '' ? key : `${path}.${key}`);
      }
    }
  };
  walk(messages, '');
  return leaves;
}
