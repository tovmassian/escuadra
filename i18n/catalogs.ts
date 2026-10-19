// Every reviewed catalog, by language (#145). React-free, so the catalog tests
// and the review sheet read the same table the app does. ./useT.ts picks one.
import { de } from './de';
import { en, type Messages } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import type { SupportedLanguage } from './resolveLanguage';

/** Adding a language to `SUPPORTED_LANGUAGES` without its catalog fails the typecheck. */
export const CATALOGS: Record<SupportedLanguage, Messages> = { en, de, fr, es, it };
