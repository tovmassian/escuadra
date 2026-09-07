import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Args, Flags } from '@oclif/core';
import {
  LEAGUES,
  validateEnvelope,
  type RosterEnvelope,
} from '../../../../scripts/roster-envelope.ts';
import type { Player, Squad } from '../../../../types/squad.ts';
import { BaseCommand } from '../base-command.ts';
import { assess, conflictCommand, describeConflict, type Conflict } from '../lib/assertions.ts';
import { colors } from '../lib/colors.ts';
import { validateRegistry, type TeamRegistry } from '../lib/registry.ts';
import { EMPTY_DECISIONS, validateDecisions, type DecisionFile } from '../lib/decisions.ts';
import { reconcileTeam } from '../lib/reconcile.ts';
import { formatAndWrite } from '../lib/write-json.ts';

interface TeamReport {
  id: string;
  status: 'written' | 'unchanged' | 'conflicted' | 'failed';
  verified: boolean;
  counts: { parsed: number; added: number; departed: number; newPlayers: number; noBirth: number };
  conflicts: Conflict[];
  warnings: string[];
}

interface RunReport {
  runId: string;
  dryRun: boolean;
  teams: TeamReport[];
  totals: {
    written: number;
    unchanged: number;
    conflicted: number;
    failed: number;
    orphans: number;
  };
  exitCode: number;
}

const EXIT = { clean: 0, unusable: 3, conflicts: 4, repo: 5 } as const;

export default class Apply extends BaseCommand<RunReport> {
  static description =
    'Reconcile a directory of roster envelopes against the repo and write squad files, players.json and the generated index.';

  static args = {
    envelopes: Args.string({ description: 'Directory of envelope JSON files', required: true }),
  };

  static flags = {
    'dry-run': Flags.boolean({
      description: 'Report everything that would change and write nothing.',
      default: false,
    }),
  };

  async run(): Promise<RunReport> {
    const { args, flags } = await this.parse(Apply);
    const dryRun = flags['dry-run'];

    const registry = this.loadRegistry();
    const byTeamId = new Map(registry.map((e) => [e.id, e]));
    const envelopes = this.loadEnvelopes(args.envelopes);
    const decisions = this.loadDecisions();

    let players: Player[] = JSON.parse(
      readFileSync(path.join(this.dataDir, 'players.json'), 'utf8'),
    ) as Player[];

    const teams: TeamReport[] = [];
    const squadWrites: { file: string; squad: Squad }[] = [];
    let playersDirty = false;
    let exitCode: number = EXIT.clean;

    for (const envelope of envelopes) {
      const id = envelope.team.id;
      const entry = byTeamId.get(id);
      if (entry === undefined) {
        // apply needs the entry's identity and league, and inventing either is
        // exactly what the registry exists to prevent.
        teams.push(this.failed(id, [`no registry entry for ${id}`], envelope));
        exitCode = Math.max(exitCode, EXIT.repo);
        continue;
      }

      const squadFile = this.squadPath(envelope);
      const stored: Squad | null = existsSync(squadFile)
        ? (JSON.parse(readFileSync(squadFile, 'utf8')) as Squad)
        : null;

      const plan = reconcileTeam({
        envelope,
        storedSquad: stored,
        players,
        acceptedSplits: decisions.splits,
        aliases: decisions.aliases ?? [],
      });
      const verdict = assess(plan);

      if (verdict.failures.length > 0) {
        teams.push({
          id,
          status: 'failed',
          verified: false,
          counts: this.counts(plan),
          conflicts: verdict.conflicts,
          warnings: verdict.failures,
        });
        exitCode = Math.max(exitCode, EXIT.repo);
        this.report(
          `  ${id}: ${colors.red(colors.bold('FAILED'))} — ${verdict.failures.join('; ')}`,
        );
        continue;
      }

      const squad: Squad = {
        ...plan.squad,
        // The registry is authoritative for identity; an envelope fetched
        // before a colour was corrected must not write the old one back.
        primaryColor: entry.identity.primaryColor,
        secondaryColor: entry.identity.secondaryColor,
        marker: entry.identity.marker,
        verified: verdict.verified,
      };
      // lastUpdated moves only when the rest of the file did, so a no-op sweep
      // produces an empty git diff.
      // Keyed on THIS file's content alone. Folding players.json edits in here
      // meant one player's position correction rewrote the lastUpdated of every
      // unrelated squad that happened to contain them.
      const fileUnchanged =
        stored !== null &&
        JSON.stringify({ ...squad, lastUpdated: stored.lastUpdated }) === JSON.stringify(stored);
      if (!fileUnchanged) squad.lastUpdated = new Date().toISOString().slice(0, 10);

      players = this.mergePlayers(players, plan.newPlayers, plan.updatedPlayers);
      // Tracked separately from squad writes. Keying the whole write step on
      // `squadWrites.length` meant a run that only corrected player fields —
      // now the common case, since squad files hold nothing but memberships —
      // silently discarded every change.
      if (plan.newPlayers.length > 0 || plan.updatedPlayers.length > 0) playersDirty = true;
      if (!fileUnchanged) squadWrites.push({ file: squadFile, squad });

      // Conflicts outrank quietness: a team with an open question is never
      // filed as `unchanged`, or the run exits 4 while the report says
      // nothing is pending.
      // `written` describes THIS squad file. Folding players.json edits in
      // here reported teams as written whose file would not change at all.
      const status =
        verdict.conflicts.length > 0 ? 'conflicted' : fileUnchanged ? 'unchanged' : 'written';
      if (verdict.conflicts.length > 0) exitCode = Math.max(exitCode, EXIT.conflicts);

      teams.push({
        id,
        status,
        verified: verdict.verified,
        counts: this.counts(plan),
        conflicts: verdict.conflicts,
        warnings: [...verdict.warnings, ...verdict.informational],
      });

      const label =
        status === 'written'
          ? colors.blue('written')
          : status === 'conflicted'
            ? colors.red('conflicted')
            : // `unchanged` is the absence of news; it should not compete for
              // attention with the lines that do need reading.
              colors.dim('unchanged');
      this.report(
        `  ${id}: ${label}${verdict.verified ? '' : colors.red(' (verified: false)')} — ${plan.parsedCount} parsed, ${plan.newPlayers.length} new, ${plan.departed.length} departed`,
      );
      for (const conflict of verdict.conflicts) {
        this.report(`      ${colors.red('conflict:')} ${describeConflict(conflict)}`);
        const command = conflictCommand(conflict);
        if (command !== null) {
          this.report(`      ${colors.dim('fix:')}      ${colors.bold(command)}`);
        }
      }
      for (const warning of verdict.warnings) {
        this.report(`      ${colors.yellow('warning:')}  ${warning}`);
      }
    }

    // Orphans are kept and never auto-pruned: an orphan is precisely the record
    // reused, birth date intact, when that player appears in another squad.
    const referenced = new Set<string>();
    for (const file of this.allSquadFiles()) {
      const squad =
        squadWrites.find((w) => w.file === file)?.squad ??
        (JSON.parse(readFileSync(file, 'utf8')) as Squad);
      for (const member of squad.members) referenced.add(member.playerId);
    }
    const orphans = players.filter((p) => !referenced.has(p.id)).length;

    if (!dryRun && (squadWrites.length > 0 || playersDirty)) {
      for (const write of squadWrites) {
        await formatAndWrite(write.file, `${JSON.stringify(write.squad, null, 2)}\n`);
      }
      await formatAndWrite(
        path.join(this.dataDir, 'players.json'),
        `${JSON.stringify(
          [...players].sort((a, b) => a.id.localeCompare(b.id)),
          null,
          2,
        )}\n`,
      );
      // Regenerated once, at the end, never hand-edited.
      await import('../../../../scripts/gen-squads.ts');
    }

    const tally = (status: TeamReport['status']): number =>
      teams.filter((t) => t.status === status).length;
    const report: RunReport = {
      runId: new Date().toISOString().replace(/[:.]/g, '-'),
      dryRun,
      teams,
      totals: {
        written: tally('written'),
        unchanged: tally('unchanged'),
        conflicted: tally('conflicted'),
        failed: tally('failed'),
        orphans,
      },
      exitCode,
    };

    const summary = `apply${dryRun ? ' (dry run)' : ''}: ${report.totals.written} written, ${report.totals.unchanged} unchanged, ${report.totals.conflicted} conflicted, ${report.totals.failed} failed, ${orphans} orphans`;
    // Green earns its place on exactly one line: nothing is waiting on you.
    this.report(
      report.totals.failed > 0
        ? colors.red(summary)
        : report.totals.conflicted > 0
          ? colors.yellow(summary)
          : colors.green(summary),
    );
    if (report.totals.conflicted > 0) {
      this.report(
        colors.dim(
          `${report.totals.conflicted} team(s) need a decision before they can verify — run the fix above, then re-run apply.`,
        ),
      );
    }
    if (exitCode !== EXIT.clean) process.exitCode = exitCode;
    return report;
  }

  private counts(plan: ReturnType<typeof reconcileTeam>): TeamReport['counts'] {
    return {
      parsed: plan.parsedCount,
      added: plan.addedCount,
      departed: plan.departed.length,
      newPlayers: plan.newPlayers.length,
      noBirth: plan.noBirthCount,
    };
  }

  private failed(id: string, reasons: string[], envelope: RosterEnvelope): TeamReport {
    this.report(`  ${id}: ${colors.red(colors.bold('FAILED'))} — ${reasons.join('; ')}`);
    return {
      id,
      status: 'failed',
      verified: false,
      counts: {
        parsed: envelope.members.length,
        added: 0,
        departed: 0,
        newPlayers: 0,
        noBirth: 0,
      },
      conflicts: [],
      warnings: reasons,
    };
  }

  private mergePlayers(
    players: readonly Player[],
    added: readonly Player[],
    updated: readonly Player[],
  ): Player[] {
    const byId = new Map(players.map((p) => [p.id, p]));
    for (const player of updated) byId.set(player.id, player);
    for (const player of added) byId.set(player.id, player);
    return [...byId.values()];
  }

  private squadPath(envelope: RosterEnvelope): string {
    const base = path.join(this.dataDir, 'squads');
    return envelope.team.kind === 'nation'
      ? path.join(base, 'nation', `${envelope.team.id}.json`)
      : path.join(base, 'club', envelope.team.league ?? '', `${envelope.team.id}.json`);
  }

  private allSquadFiles(): string[] {
    const base = path.join(this.dataDir, 'squads');
    const files: string[] = [];
    const nation = path.join(base, 'nation');
    if (existsSync(nation)) {
      for (const f of readdirSync(nation).filter((n) => n.endsWith('.json'))) {
        files.push(path.join(nation, f));
      }
    }
    for (const league of LEAGUES) {
      const dir = path.join(base, 'club', league);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
        files.push(path.join(dir, f));
      }
    }
    return files;
  }

  private loadEnvelopes(dir: string): RosterEnvelope[] {
    if (!existsSync(dir)) this.error(`no such envelope directory: ${dir}`, { exit: EXIT.repo });
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort();
    if (files.length === 0) this.error(`no envelope files in ${dir}`, { exit: EXIT.repo });

    const envelopes: RosterEnvelope[] = [];
    for (const file of files) {
      const parsed: unknown = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
      const problems = validateEnvelope(parsed);
      if (problems.length > 0) {
        this.error(`${file} is not a valid envelope:\n  ${problems.join('\n  ')}`, {
          exit: EXIT.repo,
        });
      }
      envelopes.push(parsed as RosterEnvelope);
    }
    return envelopes;
  }

  private loadDecisions(): DecisionFile {
    const file = path.join(this.dataDir, 'decisions.json');
    if (!existsSync(file)) return EMPTY_DECISIONS;
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    const problems = validateDecisions(parsed);
    if (problems.length > 0) {
      this.error(`data/decisions.json is invalid:\n  ${problems.join('\n  ')}`, {
        exit: EXIT.repo,
      });
    }
    return parsed as DecisionFile;
  }

  private loadRegistry(): TeamRegistry {
    let raw: string;
    try {
      raw = readFileSync(this.registryPath, 'utf8');
    } catch {
      this.error('no data/teams.json — run "squadctl registry init" first', { exit: EXIT.repo });
    }
    const parsed: unknown = JSON.parse(raw);
    const problems = validateRegistry(parsed);
    if (problems.length > 0) {
      this.error(`data/teams.json is invalid:\n  ${problems.join('\n  ')}`, { exit: EXIT.repo });
    }
    return parsed as TeamRegistry;
  }
}
