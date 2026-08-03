import { Option } from "effect";
import type { Player, Position, RosterPick } from "../content/types";
import type { CustomRanking } from "./custom-rankings";
import type { DraftPlatformAdapter } from "../content/adapters/types";
import { getOpponents } from "../data/schedule";
import { normalizeTeam } from "../utils/teams";
import { playerKey } from '../content/player-key';


/**
 * Next Best Pick scoring.
 *
 * This module is intentionally self-contained: it consumes plain data
 * (roster, available players, custom rankings, prepared per-position need)
 * and exposes a pure scoring entry point plus small helpers used to prepare
 * that data. The actual scoring formula lives in `scorePlayer` and is meant
 * to be the one place to tweak when the algorithm changes. All tunable
 * knobs are collected in `SCORE_WEIGHTS` and the constants below.
 */

// ----- Tunable knobs -----
export const SCORE_WEIGHTS = {
  /** Weight for the ADP-vs-my-rank value component. */
  rank: 1.0,
  adpValue: .5,
  /** Weight for the team-construction need component. */
  need: 10.0,
  /** Bonus when a candidate shares a team with any already-rostered player. */
  stackAny: 3,
  /** Additional bonus when that rostered teammate is a quarterback. */
  stackQb: 8,
  /** Weight for the Week 17 opponent-correlation component. */
  week17: 3,
} as const;

/** Maximum magnitude for normalized need scores. */
export const NEED_CLAMP = 50;
export const NEED_ENABLED_PICK = 25;
export const TARGET_MIN_COUNT: ReadonlyMap<Position, readonly [number, number]> = new Map([
  ['QB', [2, 110]],
  ['TE', [2, 150]],
  ['RB', [5, 190]],
  ['WR', [7, 190]],
]);
export const POSITION_COUNT_CAP: ReadonlyMap<Position, number> = new Map([
  ['QB', 3],
  ['TE', 4],
  ['RB', 7],
  ['WR', 9],
]);
export const POSITIONAL_NEED_SCALE: ReadonlyMap<Position, number> = new Map([
  ['QB', .5],
  ['TE', .5],
  ['RB', 1],
  ['WR', 1],
]);
/** Positions whose need is gated until the draft is past this pick. */
export const LATE_NEED_POSITIONS: ReadonlySet<Position> = new Set(['QB', 'TE']);
/** Picks before this overall pick do not receive positive QB/TE need weight. */
export const LATE_NEED_ENABLED_PICK = 90;
/** Default ADP window used to scale the ADP-vs-rank delta. */
export const RANK_BASE_ADAPTS_TO = 50;
export const DEFAULT_UPCOMING_POOL = 30;
export const DEFAULT_TOP_N = 15;

export interface PositionNeed {
  position: Position;
  current: number;
  target: number;
  count: number;
}

export interface ScoreBreakdown {
  rank: number;
  adp: number;
  need: number;
  stack: number;
  week17: number;
}

/** Count of rostered players connected to a candidate via team overlap. */
export interface StackDetail {
  /** Total rostered players on the connected team. */
  count: number;
  /** Whether any of those rostered players is a quarterback. */
  hasQb: boolean;
}

export interface ScoredPlayer {
  player: Player;
  myRank: number;
  score: number;
  breakdown: ScoreBreakdown;
  /** Rostered teammates on the candidate's team. */
  stackDetail: StackDetail;
  /** Rostered players on the candidate's Week 17 opponent team. */
  week17Detail: StackDetail;
}

export interface NextBestPickInput {
  roster: ReadonlyArray<RosterPick>;
  available: ReadonlyArray<Player>;
  customRankings: ReadonlyArray<CustomRanking> | null;
  positionNeeds: ReadonlyArray<PositionNeed>;
  /** Current overall draft pick; used to gate late-round-only need boosts. */
  currentPick?: number;
  upcomingPoolSize?: number;
  topN?: number;
}

// ----- Public entry -----

export function rankNextBestPicks(input: NextBestPickInput): ScoredPlayer[] {
  const {
    roster,
    available,
    customRankings,
    positionNeeds,
    currentPick,
    upcomingPoolSize = DEFAULT_UPCOMING_POOL,
    topN = DEFAULT_TOP_N,
  } = input;

  const myRankIndex = buildMyRankIndex(customRankings);
  const rosterInfo = collectRosterTeams(roster);
  const { rosterTeams, qbTeams } = rosterInfo;
  const needByPosition = new Map<Position, PositionNeed>();
  for (const n of positionNeeds) needByPosition.set(n.position, n);

  const upcoming = pickUpcomingPool(available, upcomingPoolSize);

  const scored = upcoming.map((player) => {
    const myRank = resolveMyRank(player, myRankIndex);
    const need = needByPosition.get(player.position);
    const breakdown: ScoreBreakdown = {
      rank: 210 - myRank,
      adp: 210 - player.adp,
      need: scoreNeedComponent(player, need, currentPick),
      stack: scoreStackComponent(player, rosterTeams, qbTeams),
      week17: scoreWeek17Component(player, rosterTeams),
    };
    const score =
      SCORE_WEIGHTS.rank * breakdown.rank +
      SCORE_WEIGHTS.adpValue * breakdown.adp +
      SCORE_WEIGHTS.need * breakdown.need +
      breakdown.stack +
      SCORE_WEIGHTS.week17 * breakdown.week17;
    return {
      player,
      myRank,
      score,
      breakdown,
      stackDetail: stackDetailFor(player, rosterInfo),
      week17Detail: week17DetailFor(player, rosterInfo),
    };
  });

  scored.sort((a, b) => b.score - a.score || a.player.adp - b.player.adp);
  return scored.slice(0, topN);
}

// ----- Pick preparation (system-aware glue; not part of the scoring formula) -----

/**
 * Builds the per-position need records used as input to `rankNextBestPicks`.
 * Mirrors the capital math used by the Draft Capital chart so the two stay
 * consistent. Lives here so panel components don't need to reproduce it.
 */
export function buildPositionNeeds(
  roster: ReadonlyArray<RosterPick>,
  adapter: DraftPlatformAdapter,
  userPickNumber: number,
): PositionNeed[] {
  return adapter.capitalCeilings.map((ceiling) => {
    const players = roster.filter((p) => ceiling.pos.includes(p.position));
    const current = players.reduce((sum, p) => {
      const rosterIndex = roster.indexOf(p);
      const overall = overallFromUserPick(rosterIndex, userPickNumber, adapter.teamCount);
      return sum + adapter.draftCapital(overall);
    }, 0);
    return { position: ceiling.label, current, target: ceiling.maxCapital, count: players.length };
  });
}

function overallFromUserPick(rosterIndex: number, userPick: number, teamCount: number): number {
  const round = rosterIndex + 1;
  if (round % 2 === 1) return (round - 1) * teamCount + userPick;
  return round * teamCount - userPick + 1;
}

// ----- Scoring formula (the part to tweak) -----

function scoreNeedComponent(
  player: Player,
  need: PositionNeed | undefined,
  currentPick?: number,
): number {
  if (!need || need.target <= 0) return 0;
  const draftPick = currentPick && currentPick > 0
    ? currentPick
    : player.adp > 0
      ? player.adp
      : 9999;
  if (draftPick < NEED_ENABLED_PICK) return 0;
  const deficit = (need.target - need.current) / need.target;

  // QB and TE only receive positive need weight once the draft is past the
  // early rounds. Over-spending on those positions still gets punished at any
  // point (the negative side is always allowed).
  if (deficit > 0 && LATE_NEED_POSITIONS.has(player.position)) {
    if (draftPick < LATE_NEED_ENABLED_PICK) return 0;
  }
  const [target_count, due_by_pick] = TARGET_MIN_COUNT.get(player.position) ?? [0, 0];
  let count_need = 0;
  if (draftPick > due_by_pick && need.count < target_count){
    count_need = (target_count - need.count) / target_count;
  }
  const max_count = POSITION_COUNT_CAP.get(player.position) ?? 99;
  if (need.count >= max_count) return -50;

  const need_index = deficit + count_need;
  const position_scale = POSITIONAL_NEED_SCALE.get(player.position) ?? 1;

  return need_index * position_scale;
}

function scoreStackComponent(
  player: Player,
  rosterTeams: ReadonlySet<string>,
  qbTeams: ReadonlySet<string>,
): number {
  const team = normalizeTeam(player.team);
  if (!team) return 0;
  if (qbTeams.has(team)) return SCORE_WEIGHTS.stackAny + SCORE_WEIGHTS.stackQb;
  if (rosterTeams.has(team)) return SCORE_WEIGHTS.stackAny;
  return 0;
}

function scoreWeek17Component(
  player: Player,
  rosterTeams: ReadonlySet<string>,
): number {
  const team = normalizeTeam(player.team);
  if (!team) return 0;
  const opps = getOpponents(team);
  if (Option.isNone(opps)) return 0;
  const week17Opp = normalizeTeam(opps.value.week17);
  if (!week17Opp || !rosterTeams.has(week17Opp)) return 0;
  return 1;
}

// ----- Internal helpers -----

interface RosterTeamInfo {
  rosterTeams: Set<string>;
  qbTeams: Set<string>;
  /** Number of rostered players per normalized team. */
  countsByTeam: Map<string, number>;
  /** Number of rostered quarterbacks per normalized team. */
  qbCountsByTeam: Map<string, number>;
}

function collectRosterTeams(roster: ReadonlyArray<RosterPick>): RosterTeamInfo {
  const rosterTeams = new Set<string>();
  const qbTeams = new Set<string>();
  const countsByTeam = new Map<string, number>();
  const qbCountsByTeam = new Map<string, number>();
  for (const p of roster) {
    const team = normalizeTeam(p.team);
    if (!team) continue;
    rosterTeams.add(team);
    countsByTeam.set(team, (countsByTeam.get(team) ?? 0) + 1);
    if (p.position === "QB") {
      qbTeams.add(team);
      qbCountsByTeam.set(team, (qbCountsByTeam.get(team) ?? 0) + 1);
    }
  }
  return { rosterTeams, qbTeams, countsByTeam, qbCountsByTeam };
}

function stackDetailFor(player: Player, info: RosterTeamInfo): StackDetail {
  const team = normalizeTeam(player.team);
  if (!team) return { count: 0, hasQb: false };
  return {
    count: info.countsByTeam.get(team) ?? 0,
    hasQb: (info.qbCountsByTeam.get(team) ?? 0) > 0,
  };
}

function week17DetailFor(player: Player, info: RosterTeamInfo): StackDetail {
  const team = normalizeTeam(player.team);
  if (!team) return { count: 0, hasQb: false };
  const opps = getOpponents(team);
  if (Option.isNone(opps)) return { count: 0, hasQb: false };
  const week17Opp = normalizeTeam(opps.value.week17);
  if (!week17Opp) return { count: 0, hasQb: false };
  return {
    count: info.countsByTeam.get(week17Opp) ?? 0,
    hasQb: (info.qbCountsByTeam.get(week17Opp) ?? 0) > 0,
  };
}

function pickUpcomingPool(
  available: ReadonlyArray<Player>,
  poolSize: number,
): Player[] {
  const withAdp = available.filter((p) => p.adp > 0);
  const sorted = [...withAdp].sort((a, b) => a.adp - b.adp);
  const pool = sorted.slice(0, poolSize);
  if (pool.length < poolSize) {
    const fallback = available
      .filter((p) => p.adp <= 0 && p.rank > 0)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, poolSize - pool.length);
    pool.push(...fallback);
  }
  return pool;
}

function buildMyRankIndex(
  rankings: ReadonlyArray<CustomRanking> | null,
): Map<string, number> {
  const map = new Map<string, number>();
  if (!rankings) return map;
  for (const r of rankings) {
    const key = rankKey(r.name, r.team, r.position);
    if (r.rank > 0) map.set(key, r.rank);
  }
  return map;
}

function resolveMyRank(player: Player, myRankIndex: Map<string, number>): number {
  if (player.rank > 0) return player.rank;
  const custom = myRankIndex.get(rankKey(player.name, player.team, player.position));
  if (custom && custom > 0) return custom;
  return player.adp > 0 ? player.adp + 50 : 50;
}

function rankKey(name: string, team: string, position: string): string {
  return playerKey({ name, team, position });
}
