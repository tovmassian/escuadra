// Pure: one envelope + what is stored -> a plan for what to write. No I/O, no
// decisions about whether the plan is acceptable — that is the assertion pass.
//
// The match key is the normalised name. No `wikiTitle` is stored anywhere:
// within a single squad normalised names are unique by construction, and the
// cross-squad collisions that do exist are exactly what step 2 flags rather
// than guesses at.
import {
  changeRatio,
  isTransliterationVariant,
  normalizeName,
  transliterate,
  type RosterEnvelope,
} from '../../../../scripts/roster-envelope.ts';
import type { Player, Squad, SquadMember } from '../../../../types/squad.ts';

export interface AmbiguousMatch {
  name: string;
  candidateIds: string[];
}

export interface PossibleRename {
  departedId: string;
  departedName: string;
  arrivedName: string;
  arrivedId: string;
}

export interface Departure {
  id: string;
  name: string;
}

/** A parsed row that could not be placed in the squad at all. Counted and
 *  named, because a squad quietly going 26 -> 25 trips no size guard. */
export interface OmittedRow {
  name: string;
  reason: string;
}

/** An extra name one player is known by, recorded because two sources name
 *  the same person differently and both are right. */
export interface AcceptedAlias {
  player: string;
  name: string;
}

/** An extra article title one player is known by, recorded because a source
 *  links a redirect rather than the canonical title — Atlético links
 *  `Alejandro Grimaldo` where Spain links `Álex Grimaldo`. Unlike a stored
 *  title this cannot be re-derived offline, which is why it is a decision. */
export interface TitleAlias {
  player: string;
  title: string;
}

/** An operator decision that a departure and an arrival really are two
 *  different people, recorded so the question is not asked every sweep. */
export interface AcceptedSplit {
  team: string;
  departed: string;
  arrived: string;
}

/** A match that only held once the non-decomposing letters were folded: the
 *  two sources disagree on how the player is spelled. */
export interface NameVariant {
  playerId: string;
  storedName: string;
  sourceName: string;
}

export interface TeamPlan {
  teamId: string;
  /** Fully built except `verified`, which the assertion pass decides, and
   *  `lastUpdated`, which the writer holds back unless something else moved. */
  squad: Squad;
  newPlayers: Player[];
  updatedPlayers: Player[];
  departed: Departure[];
  ambiguous: AmbiguousMatch[];
  possibleRenames: PossibleRename[];
  omitted: OmittedRow[];
  nameVariants: NameVariant[];
  generatedIds: string[];
  parsedCount: number;
  matchedCount: number;
  /** Members the squad gained. Distinct from `newPlayers`: a player already in
   *  players.json can join a squad without a record being created. */
  addedCount: number;
  noBirthCount: number;
  numberlessCount: number;
  captainCount: number;
  unknownTemplates: string[];
  callUpsOnly: boolean;
  /** Fraction of the roster that changed, or null when there is no stored
   *  squad to compare against — every new team would otherwise trip at 100%. */
  blastRadius: number | null;
  hadStoredSquad: boolean;
}

export interface ReconcileInput {
  envelope: RosterEnvelope;
  storedSquad: Squad | null;
  /** Every player known so far, including ones added earlier in this run, so
   *  ids stay unique across a whole sweep. */
  players: readonly Player[];
  /** Decisions already taken that a rename-looking pair is really two people.
   *  Without these the same question is re-asked every sweep. */
  acceptedSplits?: readonly AcceptedSplit[];
  /** Extra names players are known by, so a second source's spelling matches
   *  rather than looking like a rename. */
  aliases?: readonly AcceptedAlias[];
  /** Defaults to today. Passed explicitly in tests. */
  today?: string;
}

const nameTokens = (name: string): string[] => normalizeName(name).split(' ').filter(Boolean);

/** Conservative: it raises a flag, never a merge. A shared surname, or one
 *  name's tokens contained in the other's, is enough — the cost of a false
 *  positive is one glance, the cost of a miss is a duplicate person. */
export function looksLikeRename(departedName: string, arrivedName: string): boolean {
  const a = nameTokens(departedName);
  const b = nameTokens(arrivedName);
  if (a.length === 0 || b.length === 0) return false;
  if (a.join(' ') === b.join(' ')) return false;
  if (a[a.length - 1] === b[b.length - 1]) return true;
  const setA = new Set(a);
  const setB = new Set(b);
  const contains = (outer: Set<string>, inner: Set<string>): boolean =>
    [...inner].every((token) => outer.has(token));
  return contains(setA, setB) || contains(setB, setA);
}

/** `firstname-lastname`, not a bare surname: collisions are far less likely at
 *  150 squads, and ids are never user-facing. Existing ids are never
 *  rewritten — renaming one breaks every squad file referencing it. */
export function playerId(name: string, taken: ReadonlySet<string>): string {
  const base =
    transliterate(normalizeName(name))
      .replace(/[^a-z0-9 ]/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join('-') || 'player';
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function sortMembers(members: SquadMember[]): SquadMember[] {
  // By shirt number ascending, null last, then by id so the order is total.
  return [...members].sort((a, b) => {
    if (a.no === null && b.no === null) return a.playerId.localeCompare(b.playerId);
    if (a.no === null) return 1;
    if (b.no === null) return -1;
    return a.no - b.no;
  });
}

export function reconcileTeam({
  envelope,
  storedSquad,
  players,
  acceptedSplits = [],
  aliases = [],
  today = new Date().toISOString().slice(0, 10),
}: ReconcileInput): TeamPlan {
  const byId = new Map(players.map((p) => [p.id, p]));
  // Every name a player answers to: their stored name plus any recorded
  // alias. Indexing both means a second source's spelling matches the person
  // it belongs to instead of looking like a rename.
  const namesOf = (player: Player): string[] => [
    player.name,
    ...aliases.filter((a) => a.player === player.id).map((a) => a.name),
  ];

  const byNorm = new Map<string, Player[]>();
  for (const player of players) {
    for (const name of namesOf(player)) {
      const key = normalizeName(name);
      const bucket = byNorm.get(key) ?? [];
      if (!bucket.includes(player)) byNorm.set(key, [...bucket, player]);
    }
  }

  const storedMembers = storedSquad?.members ?? [];
  // Grouped, not keyed one-to-one: two different real people can share a
  // normalised display name inside a single squad. Brazil carries both
  // `Ederson (footballer, born 1993)` (GK, Fenerbahce) and `Éderson
  // (footballer, born 1999)` (MF, Atalanta).
  const storedByNorm = new Map<string, SquadMember[]>();
  const storedNames: string[] = [];
  for (const member of storedMembers) {
    const player = byId.get(member.playerId);
    if (!player) continue;
    storedNames.push(normalizeName(player.name));
    for (const name of namesOf(player)) {
      const key = normalizeName(name);
      const bucket = storedByNorm.get(key) ?? [];
      if (!bucket.includes(member)) storedByNorm.set(key, [...bucket, member]);
    }
  }

  const takenIds = new Set(players.map((p) => p.id));
  const members: SquadMember[] = [];
  const newPlayers: Player[] = [];
  const updatedPlayers: Player[] = [];
  const ambiguous: AmbiguousMatch[] = [];
  const possibleRenames: PossibleRename[] = [];
  const omitted: OmittedRow[] = [];
  const nameVariants: NameVariant[] = [];
  const generatedIds: string[] = [];
  /** Stored members already claimed by a parsed row, so one record is never
   *  matched twice and departures are computed against what is left. */
  const consumed = new Set<string>();
  let matchedCount = 0;

  /** Within a name collision, separate the candidates on data both sides
   *  already carry. Deterministic and order-independent; returns null rather
   *  than guessing when nothing separates them. */
  const separate = (group: SquadMember[], row: (typeof envelope.members)[number]) => {
    for (const discriminator of [
      (m: SquadMember) => byId.get(m.playerId)?.position === row.position,
      (m: SquadMember) => byId.get(m.playerId)?.club === row.club,
      (m: SquadMember) => m.no === row.no,
    ]) {
      const narrowed = group.filter(discriminator);
      if (narrowed.length === 1) return narrowed[0];
    }
    return null;
  };

  const storedList = storedMembers.filter((m) => byId.has(m.playerId));
  const storedIds = new Set(storedMembers.map((m) => m.playerId));
  const heldGroups = new Set<string>();

  const splitAccepted = (departedId: string, arrivedName: string): boolean =>
    acceptedSplits.some(
      (d) =>
        d.team === envelope.team.id &&
        d.departed === departedId &&
        normalizeName(d.arrived) === normalizeName(arrivedName),
    );

  for (const row of envelope.members) {
    const key = normalizeName(row.name);
    // A held collision covers every row sharing that name: the group was
    // preserved wholesale on the first one, and letting a later row fall
    // through would create a third record for one of the same people.
    if (heldGroups.has(key)) continue;
    let player: Player | undefined;

    // 1. A stored member of THIS squad, by normalised name.
    const group = (storedByNorm.get(key) ?? []).filter((m) => !consumed.has(m.playerId));
    if (group.length === 1) {
      player = byId.get(group[0]?.playerId ?? '');
    } else if (group.length > 1) {
      const resolved = separate(group, row);
      if (resolved === undefined || resolved === null) {
        // Cannot tell which stored player this row means. HOLD the group
        // exactly as stored rather than dropping anyone: an unresolved
        // ambiguity must never quietly shorten a squad.
        if (!heldGroups.has(key)) {
          heldGroups.add(key);
          ambiguous.push({ name: row.name, candidateIds: group.map((m) => m.playerId) });
          for (const member of group) {
            consumed.add(member.playerId);
            members.push(buildMember(member.playerId, member.no, member.captain));
          }
        }
        continue;
      }
      player = byId.get(resolved.playerId);
    }
    if (player) {
      consumed.add(player.id);
      matchedCount += 1;
    }

    // 2. Otherwise look up players.json globally.
    if (!player) {
      const candidates = (byNorm.get(key) ?? []).filter((c) => !consumed.has(c.id));
      if (candidates.length === 1) {
        player = candidates[0];
        if (player) consumed.add(player.id);
      } else if (candidates.length > 1) {
        // Two real people share this normalised name and none of them is in
        // this squad, so there is nothing to hold. The row is left out, and
        // said so — never dropped in silence.
        ambiguous.push({ name: row.name, candidateIds: candidates.map((c) => c.id) });
        omitted.push({
          name: row.name,
          reason: `ambiguous against ${candidates.map((c) => c.id).join(', ')}`,
        });
        continue;
      }
    }

    if (player) {
      // Matched, but the two sources spell the player differently. Reported
      // rather than silently rewritten: which spelling is right is a human
      // call, not one the matcher should make.
      if (isTransliterationVariant(player.name, row.name)) {
        nameVariants.push({ playerId: player.id, storedName: player.name, sourceName: row.name });
      }
      // Field ownership by squad kind, so players.json converges.
      //
      // A player sits in at most one club squad and one nation squad, and the
      // two articles disagree: Atlético calls Simeone MF, Argentina calls him
      // FW. Overwriting from whichever ran last made every sweep flip the
      // value back, so a no-op run could never produce an empty diff (spec
      // §10). Each kind now owns the fields it is definitionally right about
      // and only fills blanks in the others.
      //
      //   club squad   -> owns `club` (they play there) and `position`
      //                   (its article tracks them week to week)
      //   nation squad -> owns `nationality` (they play for that country)
      const fromClub = envelope.team.kind === 'club';
      const merged: Player = {
        ...player,
        position: fromClub ? row.position : player.position,
        nationality: fromClub
          ? player.nationality || (row.nationality ?? '')
          : (row.nationality ?? player.nationality),
        club: fromClub ? (row.club ?? player.club) : (player.club ?? row.club ?? null),
        // A matched record inherits its birth date for free — no per-player
        // article request is ever made to recover one.
        birth: player.birth ?? row.birth ?? null,
      };
      if (JSON.stringify(merged) !== JSON.stringify(player)) updatedPlayers.push(merged);
      members.push(buildMember(player.id, row.no, row.captain));
      continue;
    }

    // 3. No match anywhere. Before creating a record, check whether this is one
    //    of the squad's OWN members under a new spelling — Wikipedia rewrites
    //    display names without the squad changing. Creating the record first
    //    and flagging afterwards is what put five duplicate people into
    //    players.json, and no later command can undo it, so this HOLDS.
    const renamed = storedList.find(
      (m) =>
        !consumed.has(m.playerId) && looksLikeRename(byId.get(m.playerId)?.name ?? '', row.name),
    );
    if (renamed !== undefined && !splitAccepted(renamed.playerId, row.name)) {
      const storedName = byId.get(renamed.playerId)?.name ?? renamed.playerId;
      possibleRenames.push({
        departedId: renamed.playerId,
        departedName: storedName,
        arrivedName: row.name,
        // What WOULD be created if this turns out to be two people.
        arrivedId: playerId(row.name, takenIds),
      });
      // The stored record keeps the slot, taking the row's number: in the
      // common case this really is that player, and freezing the old number
      // could collide with whoever now wears it.
      consumed.add(renamed.playerId);
      members.push(buildMember(renamed.playerId, row.no, row.captain));
      continue;
    }

    // 4. Genuinely new.
    const id = playerId(row.name, takenIds);
    takenIds.add(id);
    generatedIds.push(id);
    const created: Player = {
      id,
      name: row.name,
      fullName: row.fullName ?? row.name,
      birth: row.birth ?? null,
      position: row.position,
      nationality: row.nationality ?? '',
      club: row.club ?? null,
      photo: null,
      wikiTitle: null,
    };
    newPlayers.push(created);
    members.push(buildMember(id, row.no, row.captain));
  }

  // 5. An unmatched stored member has departed. Removed from members; the
  //    player record itself is kept, because it is exactly the record reused
  //    when that player turns up in another squad next window.
  const departed: Departure[] = [];
  for (const member of storedList) {
    if (consumed.has(member.playerId)) continue;
    departed.push({
      id: member.playerId,
      name: byId.get(member.playerId)?.name ?? member.playerId,
    });
  }

  const squad: Squad = {
    id: envelope.team.id,
    kind: envelope.team.kind,
    name: envelope.team.name,
    season: envelope.team.season,
    primaryColor: envelope.identity?.primaryColor ?? storedSquad?.primaryColor ?? '',
    secondaryColor: envelope.identity?.secondaryColor ?? storedSquad?.secondaryColor ?? '',
    verified: true,
    marker: envelope.identity?.marker ??
      storedSquad?.marker ?? { bands: [], orientation: 'vertical' },
    lastUpdated: storedSquad?.lastUpdated ?? today,
    source: envelope.team.source,
    members: sortMembers(members),
  };

  return {
    teamId: envelope.team.id,
    squad,
    newPlayers,
    updatedPlayers,
    departed,
    ambiguous,
    possibleRenames,
    omitted,
    nameVariants,
    generatedIds,
    parsedCount: envelope.members.length,
    matchedCount,
    addedCount: members.filter((m) => !storedIds.has(m.playerId)).length,
    noBirthCount: newPlayers.filter((p) => p.birth === null).length,
    numberlessCount: members.filter((m) => m.no === null).length,
    captainCount: members.filter((m) => m.captain === true).length,
    unknownTemplates: envelope.unknownTemplates ?? [],
    callUpsOnly: envelope.team.sectionTitle === 'Recent call-ups',
    blastRadius:
      storedSquad === null
        ? null
        : changeRatio(
            storedNames,
            envelope.members.map((m) => normalizeName(m.name)),
          ),
    hadStoredSquad: storedSquad !== null,
  };
}

function buildMember(playerId_: string, no: number | null, captain?: boolean): SquadMember {
  const member: SquadMember = { playerId: playerId_, no };
  if (captain === true) member.captain = true;
  return member;
}
