import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Flags } from '@oclif/core';
import { LEAGUES } from '../../../../scripts/roster-envelope.ts';
import type { Player, Squad } from '../../../../types/squad.ts';
import { BaseCommand } from '../base-command.ts';
import { colors } from '../lib/colors.ts';
import {
  BIRTH_STATUSES,
  PHOTO_STATUSES,
  birthConflictFixes,
  describeBirthConflict,
  enrichPlayer,
  playersInTeams,
  summarize,
  type BirthConflict,
  type EnrichSummary,
  type Lookups,
  type PlayerEnrichment,
} from '../lib/enrich-plan.ts';
import { creditsByFile, type CreditOutcome } from '../lib/photo-credit.ts';
import { readPlayers, writePlayers } from '../lib/players-file.ts';
import {
  COMMONS_API,
  REQUESTS,
  WIKIDATA_API,
  WIKIPEDIA_API,
  WikimediaClient,
} from '../lib/wikimedia-fetch.ts';
import {
  BATCH_SIZE,
  articlesByTitle,
  chunk,
  peopleById,
  trimEntities,
  type ArticleInfo,
  type PersonInfo,
} from '../lib/wikimedia-parse.ts';

interface PlayerRow {
  id: string;
  photo: PlayerEnrichment['photo'];
  birth: PlayerEnrichment['birth'];
  file: string | null;
  licence: string | null;
  imageSource: PlayerEnrichment['imageSource'];
}

interface EnrichReport {
  dryRun: boolean;
  offline: boolean;
  requests: number;
  summary: EnrichSummary;
  conflicts: BirthConflict[];
  /** One line per batch that failed after its retries. */
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
    const selected = this.select(players, flags.only);

    const client = new WikimediaClient({
      cacheDir: path.join(this.cacheDir, 'wikimedia'),
      offline: flags.offline,
    });
    const failures: string[] = [];
    const lookups = await this.lookUp(client, selected, failures);

    const results = selected.map((player) => enrichPlayer(player, lookups));
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
      players: results.map((r) => ({
        id: r.playerId,
        photo: r.photo,
        birth: r.birth,
        file: r.file,
        licence: r.licence,
        imageSource: r.imageSource,
      })),
      exitCode,
    };
  }

  private select(players: Player[], only: string | undefined): Player[] {
    if (only === undefined) return players;
    const ids = only
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id !== '');
    const squads = this.allSquads();
    const unknown = ids.filter((id) => !squads.some((s) => s.id === id));
    if (unknown.length > 0) this.error(`no squad file for: ${unknown.join(', ')}`, { exit: 5 });
    return playersInTeams(players, squads, ids);
  }

  /** Three stages, each in batches of 50: Wikipedia for the article, then
   *  Wikidata for its item, then Commons for every candidate image. A batch
   *  that fails is recorded and its players keep what they have. */
  private async lookUp(
    client: WikimediaClient,
    players: readonly Player[],
    failures: string[],
  ): Promise<Lookups> {
    const lookups = {
      articles: new Map<string, ArticleInfo>(),
      people: new Map<string, PersonInfo>(),
      credits: new Map<string, CreditOutcome>(),
      failedTitles: new Set<string>(),
      failedItems: new Set<string>(),
      failedFiles: new Set<string>(),
    };
    const sorted = (values: Iterable<string>) => [...new Set(values)].sort();

    const titles = sorted(players.flatMap((p) => (p.wikiTitle === null ? [] : [p.wikiTitle])));
    await this.stage('wikipedia', titles, failures, lookups.failedTitles, async (batch) => {
      const responses = await client.query(WIKIPEDIA_API, REQUESTS.articles(batch));
      for (const [title, info] of articlesByTitle(batch, responses)) {
        lookups.articles.set(title, info);
      }
    });

    const articles = [...lookups.articles.values()].flatMap((a) => (a.status === 'ok' ? [a] : []));
    const ids = sorted(articles.flatMap((a) => (a.qid === null ? [] : [a.qid])));
    await this.stage('wikidata', ids, failures, lookups.failedItems, async (batch) => {
      const responses = await client.query(WIKIDATA_API, REQUESTS.people(batch), trimEntities);
      for (const [id, person] of peopleById(responses)) lookups.people.set(id, person);
    });

    const files = sorted([
      ...articles.flatMap((a) => (a.image === null ? [] : [a.image])),
      ...[...lookups.people.values()].flatMap((p) =>
        p.human && p.image !== null ? [p.image] : [],
      ),
    ]);
    await this.stage('commons', files, failures, lookups.failedFiles, async (batch) => {
      const responses = await client.query(COMMONS_API, REQUESTS.credits(batch));
      for (const [file, outcome] of creditsByFile(responses)) lookups.credits.set(file, outcome);
    });

    return lookups;
  }

  private async stage(
    name: string,
    keys: readonly string[],
    failures: string[],
    failed: Set<string>,
    run: (batch: string[]) => Promise<void>,
  ): Promise<void> {
    const batches = chunk(keys, BATCH_SIZE);
    this.report(colors.dim(`  ${name}: ${keys.length} in ${batches.length} batch(es)`));
    for (const [index, batch] of batches.entries()) {
      try {
        await run(batch);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${name} batch ${index + 1}/${batches.length}: ${message}`);
        for (const key of batch) failed.add(key);
        this.report(`  ${colors.red('failed:')} ${name} batch ${index + 1} — ${message}`);
      }
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

  private allSquads(): Squad[] {
    const base = path.join(this.dataDir, 'squads');
    const dirs = [path.join(base, 'nation'), ...LEAGUES.map((l) => path.join(base, 'club', l))];
    return dirs.flatMap((dir) =>
      existsSync(dir)
        ? readdirSync(dir)
            .filter((f) => f.endsWith('.json'))
            .map((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as Squad)
        : [],
    );
  }
}
