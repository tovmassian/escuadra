// node scripts/store-bundle.ts [--review]
//
// The store listing at release (docs/release.md, Cut a release). With no flag it writes
// dist/store-listing/paste-sheet.md and, on a release/X.Y.Z checkout only (images must show
// the code that ships), copies each language's listed screenshots and feature graphic
// beside it. With --review it writes each translation's review sheet to
// dist/store-listing/review/. Both compare with the listing that is live: the highest
// version tag at or below app.json's version. The logic is ./store-listing.ts; this file
// only reads git and the disk.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  baselineTag,
  fieldStatuses,
  imageCopies,
  isReleaseBranch,
  LANGUAGES,
  parseListing,
  pasteSheet,
  readBaseline,
  readListing,
  reviewSheet,
  screenshotProblems,
  translationProblems,
  translationStatuses,
  type DeclarationStatus,
  type FieldId,
  type ImageStatus,
  type Listing,
  type ListingLanguage,
  type Status,
} from './store-listing.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'dist', 'store-listing');

const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file: string) => existsSync(path.join(ROOT, file));
const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const listingFile = (language: ListingLanguage) => `store/listing/${language}.md`;

/** A file as it was at `tag`; null with no tag, or when the file did not exist then. */
function atTag(tag: string | null, file: string): string | null {
  if (tag === null) return null;
  try {
    return git('show', `${tag}:${file}`);
  } catch {
    // The tag exists (it came from `git tag --list`), so a failure here is a path absent at it.
    return null;
  }
}

/** Whether every path matches `tag`. Exit 1 means they differ; any other failure is real. */
function sameAsTag(tag: string, paths: readonly string[]): boolean {
  try {
    git('diff', '--quiet', tag, '--', ...paths);
    return true;
  } catch (error) {
    if ((error as { status?: number }).status === 1) return false;
    throw error;
  }
}

const version: string = JSON.parse(read('app.json')).expo.version;
const tag = baselineTag(git('tag', '--list', 'v*').split('\n').filter(Boolean), version);
const newVersion = tag !== `v${version}`;

if (!exists(listingFile('en'))) {
  throw new Error(`${listingFile('en')} is missing: it is the source every translation follows`);
}

/** A language's listing file, read; the error names the file when it does not parse. */
function readListingFile(language: ListingLanguage): Listing {
  try {
    return readListing(read(listingFile(language)));
  } catch (error) {
    throw new Error(`${listingFile(language)}:\n${(error as Error).message}`);
  }
}

const english = readListingFile('en');

/** A language's listing, checked against the English. */
function listingOf(language: ListingLanguage): Listing {
  const listing = readListingFile(language);
  const problems = language === 'en' ? [] : translationProblems(listing, english);
  if (problems.length > 0) throw new Error(`${listingFile(language)}:\n${problems.join('\n')}`);
  return listing;
}

/** Which of a language's fields differ from the listing that is live. */
function ownStatuses(language: ListingLanguage, listing: Listing) {
  return fieldStatuses(listing, readBaseline(atTag(tag, listingFile(language))), newVersion);
}

const englishStatuses = ownStatuses('en', english);

/** A translation also follows the English: a field the English changed is entered again. */
function statusesOf(language: ListingLanguage, listing: Listing) {
  const own = ownStatuses(language, listing);
  return language === 'en' ? own : translationStatuses(own, englishStatuses);
}

function writeReviewSheets(): void {
  const dir = path.join(OUT, 'review');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const language of LANGUAGES) {
    if (language === 'en') continue;
    if (!exists(listingFile(language))) {
      console.log(`${language}: no listing file yet`);
      continue;
    }
    const listing = listingOf(language);
    const title = parseListing(read(listingFile(language))).title ?? language;
    const sheet = reviewSheet(title, listing, english, statusesOf(language, listing), tag);
    if (sheet === null) {
      console.log(`${language}: nothing changed since ${tag}`);
      continue;
    }
    writeFileSync(path.join(dir, `${language}.md`), sheet);
    console.log(`wrote dist/store-listing/review/${language}.md`);
  }
}

/** Images come only from a release branch, and only when they changed since `tag`. */
function imageStatus(shots: readonly string[], onReleaseBranch: boolean): ImageStatus {
  if (!onReleaseBranch) return 'release-only';
  if (tag === null) return 'paste';
  const before = atTag(tag, 'store/screenshots.json');
  const sameSet = before !== null && JSON.stringify(JSON.parse(before)) === JSON.stringify(shots);
  const watched = [
    ...shots.map((shot) => `design/screens/${shot}.png`),
    'app/store/feature-graphic.tsx',
    'i18n/',
  ];
  return sameSet && sameAsTag(tag, watched) ? 'skip' : 'paste';
}

/** Declarations must match the binary, so they too come only from a release branch. */
function declarationStatus(onReleaseBranch: boolean): DeclarationStatus {
  if (!onReleaseBranch) return 'release-only';
  return atTag(tag, 'store/declarations.md') === read('store/declarations.md') ? 'skip' : 'paste';
}

function copyImages(shots: readonly string[]): void {
  const copies = imageCopies(shots);
  const absent = copies.filter(({ from }) => !exists(from));
  if (absent.length > 0) {
    throw new Error(
      [
        `${absent.length} capture(s) missing, among them:`,
        ...absent.slice(0, 10).map(({ from }) => `  ${from}`),
        'Capture every language, then run this again:',
        '  for code in en es fr it de; do npm run shots:store -- --lang=$code && npm run shots:play -- --lang=$code && npm run gen:play-assets -- --lang=$code || break; done',
      ].join('\n'),
    );
  }
  for (const { from, to } of copies) {
    const target = path.join(OUT, to);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(ROOT, from), target);
  }
  console.log(`copied ${copies.length} images into dist/store-listing/`);
}

function writeBundle(): void {
  // A run that fails below must not leave the previous sheet beside no images.
  rmSync(path.join(OUT, 'paste-sheet.md'), { force: true });
  const missing = LANGUAGES.filter((language) => !exists(listingFile(language)));
  if (missing.length > 0) {
    throw new Error(
      `no listing for ${missing.join(', ')}: every language ships one (store/listing/<lang>.md)`,
    );
  }
  const listings = Object.fromEntries(
    LANGUAGES.map((language) => [language, listingOf(language)]),
  ) as Record<ListingLanguage, Listing>;
  const statuses = Object.fromEntries(
    LANGUAGES.map((language) => [language, statusesOf(language, listings[language])]),
  ) as Record<ListingLanguage, Readonly<Record<FieldId, Status>>>;

  const shots: unknown = JSON.parse(read('store/screenshots.json'));
  const shotProblems = screenshotProblems(shots);
  if (shotProblems.length > 0) throw new Error(shotProblems.join('\n'));
  const list = shots as string[];

  rmSync(path.join(OUT, 'app-store'), { recursive: true, force: true });
  rmSync(path.join(OUT, 'play'), { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const onReleaseBranch = isReleaseBranch(git('rev-parse', '--abbrev-ref', 'HEAD').trim());
  const images = imageStatus(list, onReleaseBranch);
  if (images === 'paste') copyImages(list);

  const sheet = pasteSheet({
    version,
    baseline: tag,
    listings,
    statuses,
    images,
    shotCount: list.length,
    declarations: declarationStatus(onReleaseBranch),
  });
  writeFileSync(path.join(OUT, 'paste-sheet.md'), sheet);
  console.log(`wrote dist/store-listing/paste-sheet.md (compared with ${tag ?? 'nothing yet'})`);
}

if (process.argv.includes('--review')) writeReviewSheets();
else writeBundle();
