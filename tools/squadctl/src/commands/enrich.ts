import path from 'node:path';
import { Flags } from '@oclif/core';
import type { Player, Squad } from '../../../../types/squad.ts';
import { BaseCommand } from '../base-command.ts';
import { colors } from '../lib/colors.ts';
import { readDecisions } from '../lib/decisions.ts';
import {
  BIRTH_STATUSES,
  PHOTO_STATUSES,
  birthConflictFixes,
  describeBirthConflict,
  enrichPlayer,
  pendingFiles,
  summarize,
  type BirthConflict,
  type EnrichSummary,
  type Lookups,
  type PlayerEnrichment,
} from '../lib/enrich-plan.ts';
import { CREDITS, type CreditOutcome } from '../lib/photo-credit.ts';
import { readPlayers, writePlayers } from '../lib/players-file.ts';
import { playersInTeams, readSquad, seasonYears, squadFiles } from '../lib/squad-files.ts';
import { WikimediaClient, type Lookup } from '../lib/wikimedia-fetch.ts';
import { ARTICLES, PEOPLE, type ArticleInfo, type PersonInfo } from '../lib/wikimedia-parse.ts';

type PlayerRow = { id: string } & Pick<
  PlayerEnrichment,
  'photo' | 'birth' | 'file' | 'licence' | 'imageSource' | 'missing'
>;

interface EnrichReport {
  dryRun: boolean;
  offline: boolean;
  requests: number;
  summary: EnrichSummary;
  conflicts: BirthConflict[];
  /** One line per failed batch, or per group of keys no lookup answered. */
  failures: string[];
  players: PlayerRow[];
  exitCode: number;
}

// The same table as every other command: 1 network, 4 review needed, 5 repo.
const EXIT = { clean: 0, network: 1, conflicts: 4, repo: 5 } as const;

export default class Enrich extends BaseCommand<EnrichReport> {
  static description =
    "Write each player's Wikimedia Commons photo and credit, and fill unknown birth dates from Wikidata. Run after apply; touches the network unless --offline.";

  static flags = {
    only: Flags.string({ description: 'Comma-separated team ids: enrich only their members' }),
    offline: Flags.boolean({
      description: 'Re-run from .cache/wikimedia/ and make no requests at all.',
      default: false,
    }),
    'dry-run': Flags.boolean({
      description: 'Report everything that would change and write nothing.',
      default: false,
    }),
  };

  static examples = [
    '<%= config.bin %> enrich --dry-run',
    '<%= config.bin %> enrich --only esp,rma',
    '<%= config.bin %> enrich --offline',
  ];

  async run(): Promise<EnrichReport> {
    const { flags } = await this.parse(Enrich);
    const dryRun = flags['dry-run'];
    const players = readPlayers(this.dataDir);
    const squads = squadFiles(path.join(this.dataDir, 'squads')).map((f) => readSquad(f.path));
    const selected = this.select(players, squads, flags.only);
    const { decisions, problems } = readDecisions(this.dataDir);
    if (problems.length > 0) {
      this.error(`data/decisions.json is invalid:\n  ${problems.join('\n  ')}`, {
        exit: EXIT.repo,
      });
    }
    const context = {
      kept: new Map((decisions.keptBirths ?? []).map((k) => [k.player, k.birth])),
      seasonYears: seasonYears(squads),
    };

    const client = new WikimediaClient({
      cacheDir: path.join(this.cacheDir, 'wikimedia'),
      offline: flags.offline,
    });
    const failures: string[] = [];
    const lookups = await this.lookUp(client, selected, failures);

    const results = selected.map((player) => enrichPlayer(player, lookups, context));
    const summary = summarize(selected, results);
    const conflicts = results.flatMap((r) => (r.conflict === null ? [] : [r.conflict]));

    const next = new Map(players.map((p) => [p.id, p]));
    for (const result of results) next.set(result.playerId, result.player);
    if (!dryRun && summary.changed.records > 0)
      await writePlayers(this.dataDir, [...next.values()]);

    let exitCode: number = EXIT.clean;
    if (failures.length > 0) exitCode = Math.max(exitCode, EXIT.network);
    if (conflicts.length > 0) exitCode = Math.max(exitCode, EXIT.conflicts);
    this.print({ summary, conflicts, failures, results, dryRun, requests: client.requests });
    if (exitCode !== EXIT.clean) process.exitCode = exitCode;

    return {
      dryRun,
      offline: flags.offline,
      requests: client.requests,
      summary,
      conflicts,
      failures,
      players: results.map(({ playerId, photo, birth, file, licence, imageSource, missing }) => ({
        id: playerId,
        photo,
        birth,
        file,
        licence,
        imageSource,
        missing,
      })),
      exitCode,
    };
  }

  private select(players: Player[], squads: Squad[], only: string | undefined): Player[] {
    if (only === undefined) return players;
    const ids = only
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id !== '');
    const unknown = ids.filter((id) => !squads.some((s) => s.id === id));
    if (unknown.length > 0) {
      this.error(`no squad file for: ${unknown.join(', ')}`, { exit: EXIT.repo });
    }
    return playersInTeams(players, squads, ids);
  }

  /** Wikipedia for each article, then Wikidata for its item, then Commons in
   *  passes: every photo's first candidate, then the item's image only for
   *  the photos whose first one proved unusable. A key no lookup answers is
   *  recorded as failed, and its players keep what they have. */
  private async lookUp(
    client: WikimediaClient,
    players: readonly Player[],
    failures: string[],
  ): Promise<Lookups> {
    const lookups = {
      articles: new Map<string, ArticleInfo>(),
      people: new Map<string, PersonInfo | null>(),
      credits: new Map<string, CreditOutcome>(),
      failedTitles: new Set<string>(),
      failedItems: new Set<string>(),
      failedFiles: new Set<string>(),
    };
    const sorted = (values: Iterable<string>) => [...new Set(values)].sort();

    const titles = sorted(players.flatMap((p) => (p.wikiTitle === null ? [] : [p.wikiTitle])));
    await this.stage(client, ARTICLES, titles, lookups.articles, lookups.failedTitles, failures);

    const ids = sorted(
      [...lookups.articles.values()].flatMap((a) =>
        a.status === 'ok' && a.qid !== null ? [a.qid] : [],
      ),
    );
    await this.stage(client, PEOPLE, ids, lookups.people, lookups.failedItems, failures);

    // Every pass answers or fails each file it asks for, so a file is never
    // asked twice and the passes end — at the latest after one per candidate.
    const asked = new Set<string>();
    for (;;) {
      const files = pendingFiles(players, lookups).filter((file) => !asked.has(file));
      if (files.length === 0) break;
      for (const file of files) asked.add(file);
      await this.stage(client, CREDITS, files, lookups.credits, lookups.failedFiles, failures);
    }
    return lookups;
  }

  private async stage<Info, Answer>(
    client: WikimediaClient,
    lookup: Lookup<Info, Answer>,
    keys: readonly string[],
    found: Map<string, Info>,
    failed: Set<string>,
    failures: string[],
  ): Promise<void> {
    this.report(colors.dim(`  ${lookup.name}: ${keys.length} to look up`));
    const result = await client.lookUp(lookup, keys);
    for (const [key, info] of result.found) found.set(key, info);
    for (const key of result.failed) failed.add(key);
    for (const failure of result.failures) {
      failures.push(failure);
      this.report(`  ${colors.red('failed:')} ${failure}`);
    }
  }

  private print({
    summary,
    conflicts,
    failures,
    results,
    dryRun,
    requests,
  }: {
    summary: EnrichSummary;
    conflicts: BirthConflict[];
    failures: string[];
    results: PlayerEnrichment[];
    dryRun: boolean;
    requests: number;
  }): void {
    const counts = <K extends string>(order: readonly K[], tally: Partial<Record<K, number>>) =>
      order
        .filter((k) => (tally[k] ?? 0) > 0)
        .map((k) => `${tally[k]} ${k}`)
        .join(' · ');
    this.report(`  photos:   ${counts(PHOTO_STATUSES, summary.photo)}`);
    this.report(`  births:   ${counts(BIRTH_STATUSES, summary.birth)}`);
    const licences = Object.entries(summary.licences).sort(
      ([a, x], [b, y]) => y - x || a.localeCompare(b),
    );
    this.report(`  licences: ${licences.map(([l, n]) => `${n} ${l}`).join(' · ')}`);

    for (const r of results.filter((r) => r.photo === 'refused-licence')) {
      this.report(`  ${colors.yellow('refused:')}  ${r.playerId} — ${r.licence} (${r.file})`);
    }
    for (const r of results.filter((r) => r.photo === 'incomplete-credit')) {
      this.report(
        `  ${colors.yellow('incomplete:')} ${r.playerId} — no ${r.missing.join(', ')} (${r.file})`,
      );
    }
    for (const r of results.filter((r) => r.photo === 'disambiguation')) {
      const title = r.player.wikiTitle ?? '';
      this.report(
        `  ${colors.yellow('warning:')}  ${r.playerId}'s title "${title}" leads to a disambiguation page`,
      );
      this.report(
        `      ${colors.dim('fix:')}      ${colors.bold(`npm run squadctl -- retitle ${r.playerId} "<their article title>"`)}`,
      );
      this.report(
        `                ${colors.bold(`npm run squadctl -- alias ${r.playerId} --title "${title}"`)}`,
      );
    }
    for (const conflict of conflicts) {
      this.report(`  ${colors.red('conflict:')} ${describeBirthConflict(conflict)}`);
      for (const [i, fix] of birthConflictFixes(conflict).entries()) {
        this.report(`      ${colors.dim(i === 0 ? 'fix:' : '    ')}      ${colors.bold(fix)}`);
      }
    }
    for (const failure of failures) this.report(`  ${colors.red('failed:')}   ${failure}`);

    const line = `enrich${dryRun ? ' (dry run)' : ''}: ${summary.players} players, ${summary.changed.photos} photo(s) and ${summary.changed.births} birth date(s) changed, ${conflicts.length} conflict(s), ${requests} request(s)`;
    this.report(
      failures.length > 0
        ? colors.red(line)
        : conflicts.length > 0
          ? colors.yellow(line)
          : colors.green(line),
    );
    if (conflicts.length > 0) {
      this.report(
        colors.dim(
          `${conflicts.length} birth date(s) need a decision; their photos are held until then.`,
        ),
      );
    }
  }
}
