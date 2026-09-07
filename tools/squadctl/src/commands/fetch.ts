import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Flags } from '@oclif/core';
import { LEAGUES } from '../../../../scripts/roster-envelope.ts';
import { BaseCommand } from '../base-command.ts';
import { colors } from '../lib/colors.ts';
import { applyCommand, displayPath } from '../lib/hints.ts';
import { buildEnvelope } from '../lib/build-envelope.ts';
import { validateRegistry, wikiTitleFromSource, type TeamRegistry } from '../lib/registry.ts';
import { WikiFetchError, fetchSquadSection } from '../lib/wiki-fetch.ts';
import { parseSection } from '../lib/wikitext-parse.ts';

interface FetchTeamReport {
  id: string;
  status: 'fetched' | 'failed';
  sectionTitle: string | null;
  parsed: number;
  fromCache: boolean;
  failures: string[];
  warnings: string[];
}

interface FetchRunReport {
  runId: string;
  out: string;
  teams: FetchTeamReport[];
  totals: { fetched: number; failed: number };
  exitCode: number;
}

// Stable because scripts and skills branch on them. `4` means review needed,
// not broken.
const EXIT = { clean: 0, network: 1, noSection: 2, parse: 3 } as const;

export default class Fetch extends BaseCommand<FetchRunReport> {
  static description =
    "Read each registry team's squad section from Wikipedia into a roster envelope. Touches the network; writes no repo data.";

  static flags = {
    only: Flags.string({ description: 'Comma-separated team ids, e.g. sev,rma' }),
    league: Flags.string({ description: 'Restrict to one league', options: [...LEAGUES] }),
    kind: Flags.string({
      description: 'Restrict to clubs or nations',
      options: ['club', 'nation'],
    }),
    offline: Flags.boolean({
      description: 'Re-parse from .cache/wikitext/ and make no requests at all.',
      default: false,
    }),
    out: Flags.string({
      description: 'Envelope output directory (default .cache/envelopes/<runId>)',
    }),
  };

  async run(): Promise<FetchRunReport> {
    const { flags } = await this.parse(Fetch);

    const registry = this.loadRegistry();
    // Article title -> registry name, for every club we track. Nation squads
    // parse each member's club from wikitext, and the display text varies
    // between articles where the title does not.
    const clubNames = new Map<string, string>();
    for (const team of registry) {
      if (team.kind !== 'club') continue;
      const title = wikiTitleFromSource(team.source);
      if (title !== null) clubNames.set(title, team.name);
    }
    const selected = this.select(registry, flags);
    if (selected.length === 0) this.error('no registry entries matched those filters', { exit: 5 });

    const runId = new Date().toISOString().replace(/[:.]/g, '-');
    const out = flags.out ?? path.join(this.cacheDir, 'envelopes', runId);
    mkdirSync(out, { recursive: true });
    const wikitextCache = path.join(this.cacheDir, 'wikitext');

    this.report(
      `fetch: ${selected.length} team(s)${flags.offline ? ' from cache' : ''} -> ${displayPath(this.repoRoot, out)}`,
    );

    const teams: FetchTeamReport[] = [];
    let exitCode: number = EXIT.clean;
    const worst = (code: number): void => {
      exitCode = Math.max(exitCode, code);
    };

    for (const entry of selected) {
      const title = wikiTitleFromSource(entry.source);
      if (title === null) {
        teams.push(this.failed(entry.id, [`unreadable source URL ${entry.source}`]));
        worst(EXIT.network);
        continue;
      }

      try {
        const section = await fetchSquadSection(title, {
          cacheDir: wikitextCache,
          offline: flags.offline,
        });
        const parsed = parseSection(section.wikitext);
        const { envelope, failures, blankRows } = buildEnvelope({
          entry,
          sectionTitle: section.sectionTitle,
          parsed,
          clubNames,
        });

        if (envelope === null) {
          teams.push({
            id: entry.id,
            status: 'failed',
            sectionTitle: section.sectionTitle,
            parsed: parsed.rows.length,
            fromCache: section.fromCache,
            failures,
            warnings: [],
          });
          worst(EXIT.parse);
          this.report(
            `  ${entry.id}: ${colors.red(colors.bold('FAILED'))} — ${failures[0] ?? 'unknown'}`,
          );
          continue;
        }

        writeFileSync(path.join(out, `${entry.id}.json`), `${JSON.stringify(envelope, null, 2)}\n`);
        teams.push({
          id: entry.id,
          status: 'fetched',
          sectionTitle: section.sectionTitle,
          parsed: parsed.rows.length,
          fromCache: section.fromCache,
          failures: [],
          warnings: envelope.warnings,
        });
        this.report(
          `  ${entry.id}: ${envelope.members.length} members from "${section.sectionTitle}"${section.fromCache ? ' (cached)' : ''}${blankRows > 0 ? ` (${blankRows} blank row(s) skipped)` : ''}${envelope.warnings.length > 0 ? colors.yellow(` — ${envelope.warnings.length} warning(s)`) : ''}`,
        );
      } catch (error) {
        const failure = error instanceof WikiFetchError ? error : null;
        const message = error instanceof Error ? error.message : String(error);
        teams.push(this.failed(entry.id, [message]));
        // Per-team, never per-run: one restructured article must not block
        // the other 149 teams.
        worst(failure?.code === 'no-section' ? EXIT.noSection : EXIT.network);
        this.report(`  ${entry.id}: ${colors.red(colors.bold('FAILED'))} — ${message}`);
      }
    }

    const fetched = teams.filter((t) => t.status === 'fetched').length;
    const summary = `fetch: ${fetched} fetched, ${teams.length - fetched} failed`;
    this.report(teams.length - fetched > 0 ? colors.red(summary) : colors.green(summary));
    // The envelopes are useless until they are applied, and reconstructing the
    // run directory by hand is the one bit of friction this whole phase has.
    if (fetched > 0) {
      this.report(
        `${colors.dim('next:')}     ${colors.bold(applyCommand(this.repoRoot, out, true))}`,
      );
      this.report(colors.dim('          drop --dry-run to write'));
    }

    const report: FetchRunReport = {
      runId,
      out,
      teams,
      totals: { fetched, failed: teams.length - fetched },
      exitCode,
    };
    // The process exit code is the highest severity seen anywhere in the run.
    if (exitCode !== EXIT.clean) process.exitCode = exitCode;
    return report;
  }

  private failed(id: string, failures: string[]): FetchTeamReport {
    return {
      id,
      status: 'failed',
      sectionTitle: null,
      parsed: 0,
      fromCache: false,
      failures,
      warnings: [],
    };
  }

  private loadRegistry(): TeamRegistry {
    let raw: string;
    try {
      raw = readFileSync(this.registryPath, 'utf8');
    } catch {
      this.error(
        `no ${path.relative(this.repoRoot, this.registryPath)} — run "squadctl registry init" first`,
        { exit: 5 },
      );
    }
    const parsed: unknown = JSON.parse(raw);
    // Validated before the first network call, so a malformed registry fails
    // in milliseconds rather than halfway through 150 teams.
    const problems = validateRegistry(parsed);
    if (problems.length > 0) {
      this.error(`data/teams.json is invalid:\n  ${problems.join('\n  ')}`, { exit: 5 });
    }
    return parsed as TeamRegistry;
  }

  private select(
    registry: TeamRegistry,
    flags: { only?: string | undefined; league?: string | undefined; kind?: string | undefined },
  ): TeamRegistry {
    let selected = registry;
    if (flags.only !== undefined) {
      const wanted = new Set(
        flags.only
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id !== ''),
      );
      const known = new Set(registry.map((e) => e.id));
      const missing = [...wanted].filter((id) => !known.has(id));
      if (missing.length > 0) {
        this.error(`no registry entry for: ${missing.join(', ')}`, { exit: 5 });
      }
      selected = selected.filter((e) => wanted.has(e.id));
    }
    if (flags.league !== undefined) selected = selected.filter((e) => e.league === flags.league);
    if (flags.kind !== undefined) selected = selected.filter((e) => e.kind === flags.kind);
    return selected;
  }
}
