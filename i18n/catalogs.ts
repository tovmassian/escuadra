// Every reviewed catalog, by language (#145). React-free, so the catalog tests
// and the review sheet read the same table the app does. ./useT.ts picks one.
import { en, type Messages } from './en';
import type { SupportedLanguage } from './resolveLanguage';

/** Adding a language to `SUPPORTED_LANGUAGES` without its catalog fails the typecheck. */
export const CATALOGS: Record<SupportedLanguage, Messages> = { en };
