// One of squadctl's two networked files — `fetch`'s; wikimedia-fetch.ts is
// `enrich`'s. Both send their requests through lib/http.ts. Everything else
// is pure and testable without a socket.
//
// Two requests per team, never more: the section list, then that section's
// raw wikitext. No per-player article is ever fetched — that request was the
// dominant cost of the old pipeline. (`enrich` keeps the same rule: its
// per-player data comes in batches of 50 titles, never one request each.)
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { WikiFetchError, WikimediaHttp } from './http.ts';
import { selectSquadSection, type SectionTitle, type WikiSection } from './wikitext-parse.ts';

const API = 'https://en.wikipedia.org/w/api.php';
const RAW = 'https://en.wikipedia.org/w/index.php';

export interface WikiFetchOptions {
  /** Directory holding `<slug>.<index>.wikitext` and `<slug>.meta.json`. */
  cacheDir: string;
  /** Re-parse from cache and make no requests at all. */
  offline: boolean;
  userAgent?: string;
  /** Pause before each request. 150 teams is 300 requests; at ~200ms of
   *  courtesy delay the whole sweep is still under two minutes. */
  delayMs?: number;
}

export interface FetchedSection {
  index: string;
  sectionTitle: SectionTitle;
  wikitext: string;
  fromCache: boolean;
}

interface SectionMeta {
  index: string;
  sectionTitle: SectionTitle;
  fetchedAt: string;
}

/** Filesystem-safe stand-in for an article title. */
export function cacheSlug(title: string): string {
  return title.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
}

interface SectionsResponse {
  parse?: { title?: string; sections?: WikiSection[] };
}

/** The section index is ALWAYS re-resolved online and never trusted from a
 *  previous run: a squad section's number moves as an article is edited
 *  (Arsenal's was 24 on the day this was written, and that is not stable).
 *
 *  `redirects=1` matters: a registry `source` naming a redirect (AS Monaco ->
 *  AS Monaco FC) otherwise resolves against the redirect stub itself, which
 *  carries no sections at all, and reads as "no squad section found" rather
 *  than what it is. The response's own `parse.title` is the canonical title
 *  MediaWiki actually resolved to, and the raw-wikitext request below must
 *  use that — `action=raw` does not follow redirects the way `action=parse`
 *  does, so fetching by the original title 404s even once the section index
 *  is resolved correctly. */
async function resolveSection(
  title: string,
  http: WikimediaHttp,
): Promise<{ index: string; sectionTitle: SectionTitle; resolvedTitle: string }> {
  const url = `${API}?action=parse&page=${encodeURIComponent(title)}&redirects=1&prop=sections&format=json`;
  const body = await http.getText(url);
  let parsed: SectionsResponse;
  try {
    parsed = JSON.parse(body) as SectionsResponse;
  } catch {
    throw new WikiFetchError(`sections response for ${title} was not JSON`, 'network');
  }
  const sections = parsed.parse?.sections;
  if (!Array.isArray(sections)) {
    throw new WikiFetchError(`no sections returned for ${title}`, 'network');
  }
  const selected = selectSquadSection(sections);
  if (!selected) {
    throw new WikiFetchError(`no squad section found on ${title}`, 'no-section');
  }
  return {
    index: selected.index,
    sectionTitle: selected.title,
    resolvedTitle: parsed.parse?.title ?? title,
  };
}

function metaPath(cacheDir: string, title: string): string {
  return path.join(cacheDir, `${cacheSlug(title)}.meta.json`);
}

function wikitextPath(cacheDir: string, title: string, index: string): string {
  return path.join(cacheDir, `${cacheSlug(title)}.${index}.wikitext`);
}

function readCached(cacheDir: string, title: string): FetchedSection {
  let meta: SectionMeta;
  try {
    meta = JSON.parse(readFileSync(metaPath(cacheDir, title), 'utf8')) as SectionMeta;
  } catch {
    throw new WikiFetchError(
      `--offline: nothing cached for ${title} (run once without --offline first)`,
      'network',
    );
  }
  try {
    return {
      index: meta.index,
      sectionTitle: meta.sectionTitle,
      wikitext: readFileSync(wikitextPath(cacheDir, title, meta.index), 'utf8'),
      fromCache: true,
    };
  } catch {
    throw new WikiFetchError(`--offline: cached wikitext for ${title} is missing`, 'network');
  }
}

/** Resolves the squad section and returns its raw wikitext. The response is
 *  written to the cache BEFORE any parsing happens, so a parser change can be
 *  re-run against it at zero network cost and a changed result is
 *  attributable to the parser rather than to Wikipedia. */
export async function fetchSquadSection(
  title: string,
  options: WikiFetchOptions,
): Promise<FetchedSection> {
  if (options.offline) return readCached(options.cacheDir, title);

  const http = new WikimediaHttp({ userAgent: options.userAgent, delayMs: options.delayMs ?? 200 });
  const { index, sectionTitle, resolvedTitle } = await resolveSection(title, http);

  const url = `${RAW}?title=${encodeURIComponent(resolvedTitle)}&action=raw&section=${encodeURIComponent(index)}`;
  const wikitext = await http.getText(url);

  mkdirSync(options.cacheDir, { recursive: true });
  writeFileSync(wikitextPath(options.cacheDir, title, index), wikitext);
  const meta: SectionMeta = { index, sectionTitle, fetchedAt: new Date().toISOString() };
  writeFileSync(metaPath(options.cacheDir, title), `${JSON.stringify(meta, null, 2)}\n`);

  return { index, sectionTitle, wikitext, fromCache: false };
}

/** Titles with something cached, for reporting what `--offline` can serve. */
export function cachedTitles(cacheDir: string): string[] {
  try {
    return readdirSync(cacheDir)
      .filter((f) => f.endsWith('.meta.json'))
      .map((f) => f.replace(/\.meta\.json$/, ''))
      .sort();
  } catch {
    return [];
  }
}
