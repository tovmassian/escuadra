// The store listings (docs/superpowers/specs/2026-10-24-store-listings-design.md): the
// fields each store/listing/<lang>.md holds and the checks npm run check runs on them.
// Pure, and importing nothing from i18n/, so scripts/store-bundle.ts runs it under plain
// Node; scripts/__tests__/store-listing.test.ts holds LANGUAGES to SUPPORTED_LANGUAGES.

/** The languages with a listing: the app's supported languages (tested). */
export const LANGUAGES = ['en', 'es', 'fr', 'it', 'de'] as const;
export type ListingLanguage = (typeof LANGUAGES)[number];

/** Each language's locale in App Store Connect and in Play Console: one per language. */
export const STORE_LOCALES: Readonly<
  Record<ListingLanguage, { readonly appStore: string; readonly play: string }>
> = {
  en: { appStore: 'en-US', play: 'en-US' },
  es: { appStore: 'es-ES', play: 'es-ES' },
  fr: { appStore: 'fr-FR', play: 'fr-FR' },
  it: { appStore: 'it', play: 'it-IT' },
  de: { appStore: 'de-DE', play: 'de-DE' },
};

/**
 * Every field of a listing file, in order: the store that shows it and its limit in
 * characters. One Description serves both stores, and one What's new is written to
 * Play's 500.
 */
export const FIELDS = [
  { id: 'subtitle', name: 'Subtitle', store: 'App Store', limit: 30 },
  { id: 'promotionalText', name: 'Promotional text', store: 'App Store', limit: 170 },
  { id: 'keywords', name: 'Keywords', store: 'App Store', limit: 100 },
  { id: 'shortDescription', name: 'Short description', store: 'Google Play', limit: 80 },
  { id: 'description', name: 'Description', store: 'both', limit: 4000 },
  { id: 'whatsNew', name: "What's new", store: 'both', limit: 500 },
] as const;

export type Field = (typeof FIELDS)[number];
export type FieldId = Field['id'];
export type Listing = Readonly<Record<FieldId, string>>;

/** Play's most phone screenshots per language; Apple takes 10. */
export const MAX_SHOTS = 8;

/** A field's heading in a listing file: `Subtitle (App Store, 30)`. */
export function heading(field: Field): string {
  return `${field.name} (${field.store}, ${field.limit})`;
}

/** Characters as a reader counts them: code points, so é and ß are one each. */
export function charCount(text: string): number {
  return [...text].length;
}

export interface ParsedListing {
  /** The `# ` line: the language's name in itself. */
  readonly title: string | null;
  readonly sections: readonly { readonly heading: string; readonly body: string }[];
  /** Whether a non-empty line sits outside any field. */
  readonly stray: boolean;
}

/** Splits a listing file at its `## ` headings. A body runs to the next heading, trimmed. */
export function parseListing(markdown: string): ParsedListing {
  let title: string | null = null;
  let stray = false;
  const sections: { heading: string; lines: string[] }[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  for (const line of markdown.replaceAll('\r\n', '\n').split('\n')) {
    if (line.startsWith('## ')) {
      current = { heading: line.slice(3).trim(), lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    } else if (title === null && line.startsWith('# ')) {
      title = line.slice(2).trim();
    } else if (line.trim() !== '') {
      stray = true;
    }
  }
  return {
    title,
    stray,
    sections: sections.map(({ heading, lines }) => ({ heading, body: lines.join('\n').trim() })),
  };
}

function keywordProblems(keywords: string): string[] {
  if (keywords === '') return [];
  const words = keywords.split(',');
  const problems: string[] = [];
  if (words.some((word) => word !== word.trim())) {
    problems.push('Keywords have spaces around a comma, which spend the limit on nothing');
  }
  if (words.some((word) => word.trim() === '')) {
    problems.push('Keywords have an empty entry between commas');
  }
  const seen = new Set<string>();
  for (const word of words.map((each) => each.trim().toLocaleLowerCase())) {
    if (word !== '' && seen.has(word)) problems.push(`Keywords repeat "${word}"`);
    seen.add(word);
  }
  return problems;
}

/** What is wrong with one listing file, one sentence each; empty when nothing is. */
export function listingProblems(markdown: string): string[] {
  const parsed = parseListing(markdown);
  const problems: string[] = [];
  if (parsed.stray) {
    problems.push('text before the first field: every line belongs under a ## heading');
  }
  const expected = FIELDS.map(heading);
  const found = parsed.sections.map((section) => section.heading);
  if (found.join('\n') !== expected.join('\n')) {
    problems.push(
      `the fields must be exactly, in order: ${expected.join('; ')}. Found: ${found.join('; ') || 'none'}`,
    );
    return problems;
  }
  FIELDS.forEach((field, index) => {
    const body = parsed.sections[index]?.body ?? '';
    if (body === '') problems.push(`${field.name} is empty`);
    const count = charCount(body);
    if (count > field.limit) {
      problems.push(`${field.name} is ${count} characters, over its ${field.limit}`);
    }
    if (/\bSquad (Trainer|Game|Quiz)\b/.test(body)) {
      problems.push(`${field.name} calls the product something other than Escuadra (guardrail 6)`);
    }
    if (field.id === 'keywords') problems.push(...keywordProblems(body));
  });
  return problems;
}

/** The fields of a listing file by id. Throws what `listingProblems` finds. */
export function readListing(markdown: string): Listing {
  const problems = listingProblems(markdown);
  if (problems.length > 0) throw new Error(problems.join('\n'));
  const { sections } = parseListing(markdown);
  // listingProblems just proved the sections are FIELDS, in order.
  return Object.fromEntries(
    FIELDS.map((field, index) => [field.id, sections[index]?.body ?? '']),
  ) as Listing;
}

/** What a translation gets wrong against the English: a field left in English, a name translated. */
export function translationProblems(listing: Listing, english: Listing): string[] {
  return FIELDS.flatMap((field) => {
    const theirs = listing[field.id];
    const ours = english[field.id];
    const problems: string[] = [];
    if (theirs === ours) problems.push(`${field.name} is still the English text`);
    // Two separate checks: a field can keep the phrase and drop the name, or the reverse.
    if (/a la escuadra/i.test(ours) && !/a la escuadra/i.test(theirs)) {
      problems.push(`${field.name} must keep "a la escuadra" as it is`);
    }
    if (ours.includes('Escuadra') && !theirs.includes('Escuadra')) {
      problems.push(`${field.name} must keep the name Escuadra`);
    }
    return problems;
  });
}

/** What is wrong with store/screenshots.json's contents. */
export function screenshotProblems(shots: unknown): string[] {
  if (!Array.isArray(shots) || shots.some((shot) => typeof shot !== 'string')) {
    return ['store/screenshots.json must be a list of capture names'];
  }
  const problems: string[] = [];
  if (shots.length === 0) problems.push('store/screenshots.json lists no shots');
  if (shots.length > MAX_SHOTS) {
    problems.push(
      `store/screenshots.json lists ${shots.length} shots; Play takes at most ${MAX_SHOTS}`,
    );
  }
  if (new Set(shots).size !== shots.length)
    problems.push('store/screenshots.json lists a shot twice');
  return problems;
}

/** The privacy policy URL store/declarations.md declares, or null. */
export function declaredPrivacyUrl(declarations: string): string | null {
  return /^- Privacy policy URL: (\S+)$/m.exec(declarations)?.[1] ?? null;
}
