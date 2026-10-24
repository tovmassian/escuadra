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
  for (const word of words.map((each) => each.trim().toLowerCase())) {
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

export type Status = 'paste' | 'skip';
/** Images are entered, unchanged, or not this checkout's to hand over. */
export type ImageStatus = Status | 'release-only';
/** Declarations must match the binary, so they too come only from a release branch. */
export type DeclarationStatus = Status | 'release-only';

type Version = readonly [number, number, number];

function versionOf(text: string): Version | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(text);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compareVersions(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * The tag of the listing that is live: the highest `vX.Y.Z` at or below app.json's
 * version. While a version is prepared that is the previous one; between versions, the
 * live one itself. A version's tag sits on its release branch, which later branches hold
 * only as cherry-picked copies, so it is found by name, never by walking history.
 */
export function baselineTag(tags: readonly string[], version: string): string | null {
  const ceiling = versionOf(version);
  if (ceiling === null) throw new Error(`app.json's version "${version}" is not X.Y.Z`);
  let best: { tag: string; version: Version } | null = null;
  for (const tag of tags) {
    const tagged = tag.startsWith('v') ? versionOf(tag.slice(1)) : null;
    if (tagged === null || compareVersions(tagged, ceiling) > 0) continue;
    if (best === null || compareVersions(tagged, best.version) > 0) best = { tag, version: tagged };
  }
  return best?.tag ?? null;
}

/** A listing file as it was at the baseline: null with none, or when it no longer parses. */
export function readBaseline(markdown: string | null): Listing | null {
  if (markdown === null) return null;
  try {
    return readListing(markdown);
  } catch {
    return null;
  }
}

/**
 * Which fields need entering. A field the baseline already holds is skipped. What's new
 * belongs to a version, not to the listing: every new version enters it, and an edit
 * between versions has no version to carry it.
 */
export function fieldStatuses(
  listing: Listing,
  baseline: Listing | null,
  newVersion: boolean,
): Readonly<Record<FieldId, Status>> {
  return Object.fromEntries(
    FIELDS.map((field) => {
      if (field.id === 'whatsNew') return [field.id, newVersion ? 'paste' : 'skip'];
      const same = baseline !== null && baseline[field.id] === listing[field.id];
      return [field.id, same ? 'skip' : 'paste'];
    }),
  ) as Record<FieldId, Status>;
}

/**
 * A translation's statuses: a field is entered when it or its English changed since the
 * baseline, so a translation left behind by an English edit reaches the reviewer and the
 * sheet instead of reading as unchanged.
 */
export function translationStatuses(
  own: Readonly<Record<FieldId, Status>>,
  english: Readonly<Record<FieldId, Status>>,
): Readonly<Record<FieldId, Status>> {
  return Object.fromEntries(
    FIELDS.map((field) => [
      field.id,
      own[field.id] === 'paste' || english[field.id] === 'paste' ? 'paste' : 'skip',
    ]),
  ) as Record<FieldId, Status>;
}

/** Whether a branch is a version's release branch, the only place images come from. */
export function isReleaseBranch(branch: string): boolean {
  return /^release\/\d+\.\d+\.\d+$/.test(branch);
}

/** Every image a release hands over: from its capture to its place in dist/store-listing/. */
export function imageCopies(
  shots: readonly string[],
): { readonly from: string; readonly to: string }[] {
  const copies = LANGUAGES.flatMap((language) => {
    const { appStore, play } = STORE_LOCALES[language];
    return [
      ...shots.flatMap((shot, index) => {
        const n = String(index + 1).padStart(2, '0');
        return [
          { from: `design/store/${language}/${shot}.png`, to: `app-store/${appStore}/${n}.png` },
          { from: `design/play/${language}/${shot}.jpg`, to: `play/${play}/${n}.jpg` },
        ];
      }),
      {
        from: `design/play/${language}/feature-graphic.jpg`,
        to: `play/${play}/feature-graphic.jpg`,
      },
    ];
  });
  return [...copies, { from: 'design/play/icon-512.png', to: 'play/icon-512.png' }];
}

export interface SheetInput {
  readonly version: string;
  readonly baseline: string | null;
  readonly listings: Readonly<Record<ListingLanguage, Listing>>;
  readonly statuses: Readonly<Record<ListingLanguage, Readonly<Record<FieldId, Status>>>>;
  readonly images: ImageStatus;
  readonly shotCount: number;
  readonly declarations: DeclarationStatus;
}

const FENCE = '~~~~';

/** Each console's own name for a field, where it differs from the listing file's. */
const APP_STORE_LABELS: Partial<Record<FieldId, string>> = {
  promotionalText: 'Promotional Text',
  whatsNew: "What's New in This Version",
};
const PLAY_LABELS: Partial<Record<FieldId, string>> = { description: 'Full description' };

function entry(label: string, status: Status, text: string, limit: number): string[] {
  if (status === 'skip') return [`- ${label}: skip, unchanged`, ''];
  return [
    `#### ${label} · paste · ${charCount(text)}/${limit}`,
    '',
    `${FENCE}text`,
    text,
    FENCE,
    '',
  ];
}

function imagesIntro(images: ImageStatus, baseline: string | null): string {
  switch (images) {
    case 'paste':
      return 'Images: **paste**, from `dist/store-listing/`.';
    case 'skip':
      return `Images: skip, the same as in ${baseline}.`;
    case 'release-only':
      return 'Images: none here. They show the code that ships, so they come only from a release branch.';
  }
}

/** The paste sheet: store, then locale, then field, in the order the consoles take them. */
export function pasteSheet(input: SheetInput): string {
  const { listings, statuses, images } = input;
  const last = String(input.shotCount).padStart(2, '0');
  const lines: string[] = [
    `# Paste sheet: ${input.version}`,
    '',
    input.baseline === null
      ? 'No earlier version is tagged, so everything is **paste**.'
      : `Compared with ${input.baseline}, the listing that is live: enter only what says **paste**.`,
    '',
    imagesIntro(images, input.baseline),
    '',
    '## App Store Connect',
    '',
  ];
  for (const language of LANGUAGES) {
    const locale = STORE_LOCALES[language].appStore;
    lines.push(`### ${locale}`, '');
    for (const field of FIELDS) {
      if (field.store === 'Google Play') continue;
      const label = APP_STORE_LABELS[field.id] ?? field.name;
      lines.push(
        ...entry(label, statuses[language][field.id], listings[language][field.id], field.limit),
      );
    }
    if (images === 'paste') {
      lines.push(`- Screenshots: \`app-store/${locale}/01.png\` to \`${last}.png\`, in order`, '');
    }
  }
  lines.push('## Google Play Console', '');
  for (const language of LANGUAGES) {
    const locale = STORE_LOCALES[language].play;
    lines.push(`### ${locale}`, '');
    for (const field of FIELDS) {
      if (field.store === 'App Store' || field.id === 'whatsNew') continue;
      const label = PLAY_LABELS[field.id] ?? field.name;
      lines.push(
        ...entry(label, statuses[language][field.id], listings[language][field.id], field.limit),
      );
    }
    if (images === 'paste') {
      lines.push(
        `- Screenshots: \`play/${locale}/01.jpg\` to \`${last}.jpg\`, in order`,
        `- Feature graphic: \`play/${locale}/feature-graphic.jpg\``,
        '',
      );
    }
  }
  if (images === 'paste') lines.push('- App icon: `play/icon-512.png`, in the default listing', '');
  // Play takes every language's release notes in one box, each inside its locale's tags.
  if (LANGUAGES.some((language) => statuses[language].whatsNew === 'paste')) {
    const notes = LANGUAGES.flatMap((language) => {
      const locale = STORE_LOCALES[language].play;
      return [`<${locale}>`, listings[language].whatsNew, `</${locale}>`];
    });
    lines.push(
      '### Release notes · paste, every language in one box',
      '',
      `${FENCE}text`,
      ...notes,
      FENCE,
      '',
    );
  } else {
    lines.push('### Release notes: skip, unchanged', '');
  }
  if (input.declarations === 'paste') {
    lines.push(
      '## Declarations · paste',
      '',
      "Enter what `store/declarations.md` says: App Privacy before Submit for Review, Data safety when the build is uploaded, and each store's privacy policy URL with its answers.",
      '',
    );
  } else if (input.declarations === 'release-only') {
    lines.push(
      '## Declarations: none here. They must match the binary, so they come only from a release branch.',
      '',
    );
  } else {
    lines.push('## Declarations: skip, unchanged', '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

/**
 * The sheet a native reviewer signs off: each changed field's English, then its
 * translation and count. `language` is the language's name in itself (its file's title).
 * Null when nothing in the language changed.
 */
export function reviewSheet(
  language: string,
  listing: Listing,
  english: Listing,
  statuses: Readonly<Record<FieldId, Status>>,
  baseline: string | null,
): string | null {
  const changed = FIELDS.filter((field) => statuses[field.id] === 'paste');
  if (changed.length === 0) return null;
  const quote = (text: string) => text.split('\n').map((line) => (line === '' ? '>' : `> ${line}`));
  const lines = [
    `# ${language}: store listing review`,
    '',
    'Reviewer: ______________ Signed off on: ______________',
    '',
    baseline === null
      ? '- Every field is here: this is the first listing.'
      : `- Only the fields that changed since ${baseline} are here.`,
    '- The limit is the most characters the store takes. A text that does not fit is rewritten, never cut.',
    '- Never translated: Escuadra, a la escuadra. Screens and buttons are named as the app names them in this language.',
    '',
    ...changed.flatMap((field) => [
      `## ${heading(field)}`,
      '',
      'English:',
      '',
      ...quote(english[field.id]),
      '',
      `${language}, ${charCount(listing[field.id])}/${field.limit}:`,
      '',
      ...quote(listing[field.id]),
      '',
    ]),
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}
