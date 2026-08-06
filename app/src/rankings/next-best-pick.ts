import { Option } from "effect";
import type { Player, Position, RosterPick } from "../content/types";
import type { CustomRanking } from "./custom-rankings";
import type { DraftPlatformAdapter, ScoringConfig } from "../content/adapters/types";
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
//
// The literals below are the DraftKings-flavored baseline. They double as the
// test-default scoring and are surfaced as the `draftKingsScoring` config.
// Underdog gets its own `underdogScoring` config further down, where the
// positional targets, caps, and late-draft escalation differ. Anything you
// tweak here is what gets used when no adapter (or the DraftKings adapter) is
// driving; adjust `underdogScoring` to retune that platform independently.
export const SCORE_WEIGHTS = {
  rank: 1.0,
  adpValue: .5,
  need: 10.0,
  stackAny: 3,
  stackQb: 8,
  week17: 3,
} as const;

/** Maximum magnitude for normalized need scores. */
export const NEED_CLAMP = 50;
export const NEED_ENABLED_PICK = 25;
export const TARGET_MIN_COUNT: ReadonlyMap<Position, ReadonlyArray<readonly [number, number]>> = new Map([
  // DraftKings drafts run longer, so we want a third QB in the bag by pick 110.
  ['QB', [[3, 110]]],
  ['TE', [[2, 150]]],
  ['RB', [[5, 190]]],
  ['WR', [[3, 60], [7, 190]]],
]);
export const POSITION_COUNT_CAP: ReadonlyMap<Position, number> = new Map([
  ['QB', 4],
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
/**
 * Pick at which the late-draft need scaling kicks in (hard cliff). Before this
 * pick the multiplier is 1; at this pick it jumps to `NEED_LATE_SCALE_START`.
 */
export const NEED_LATE_SCALE_START_PICK = 90;
/** Pick at which the late-draft need scaling reaches its final value. */
export const NEED_LATE_SCALE_END_PICK = 180;
/** Need multiplier applied starting at `NEED_LATE_SCALE_START_PICK`. */
export const NEED_LATE_SCALE_START = 2;
/** Need multiplier reached at `NEED_LATE_SCALE_END_PICK` (and held after). */
export const NEED_LATE_SCALE_END = 3;
/** Default ADP window used to scale the ADP-vs-rank delta. */
export const RANK_BASE_ADAPTS_TO = 50;
export const DEFAULT_UPCOMING_POOL = 30;
export const DEFAULT_TOP_N = 15;

/**
 * DraftKings scoring config. DraftKings snake drafts run 20 rounds, so the
 * baseline wants a third QB and the late-draft need escalation stretches out
 * to pick 180 (round 15).
 */
export const draftKingsScoring: ScoringConfig = {
  weights: SCORE_WEIGHTS,
  needClamp: NEED_CLAMP,
  needEnabledPick: NEED_ENABLED_PICK,
  targetMinCount: TARGET_MIN_COUNT,
  positionCountCap: POSITION_COUNT_CAP,
  positionalNeedScale: POSITIONAL_NEED_SCALE,
  lateNeedPositions: LATE_NEED_POSITIONS,
  lateNeedEnabledPick: LATE_NEED_ENABLED_PICK,
  needLateScaleStartPick: NEED_LATE_SCALE_START_PICK,
  needLateScaleEndPick: NEED_LATE_SCALE_END_PICK,
  needLateScaleStart: NEED_LATE_SCALE_START,
  needLateScaleEnd: NEED_LATE_SCALE_END,
  rankBaseAdaptsTo: RANK_BASE_ADAPTS_TO,
  defaultUpcomingPool: DEFAULT_UPCOMING_POOL,
  defaultTopN: DEFAULT_TOP_N,
};

/**
 * Underdog scoring config. Underdog contests are 18 rounds, so positional
 * targets are tighter (want two QBs, eight WRs) and the late-draft need
 * escalation compresses to pick 162 (round 13.5).
 */
export const underdogScoring: ScoringConfig = {
  ...draftKingsScoring,
  targetMinCount: new Map<Position, ReadonlyArray<readonly [number, number]>>([
    ['QB', [[2, 110]]],
    ['TE', [[2, 150]]],
    ['RB', [[5, 190]]],
    ['WR', [[3, 60], [7, 190]]],
  ]),
  positionCountCap: new Map<Position, number>([
    ['QB', 3],
    ['TE', 4],
    ['RB', 7],
    ['WR', 8],
  ]),
  needLateScaleEndPick: 162,
};

/**
 * Default scoring used when a caller does not supply one (e.g. unit tests that
 * exercise the formula directly). Mirrors the DraftKings baseline so the
 * behaviors encoded in the test suite stay anchored to a single platform.
 */
export const DEFAULT_SCORING: ScoringConfig = draftKingsScoring;

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

/**
 * One row in the per-factor score breakdown shown alongside a recommendation.
 * `raw` is the pre-weight component value, `scale` is the weight applied to it,
 * and `scaled` is `raw * scale` — the actual points contributed to `score`.
 */
export interface ScoreContribution {
  label: string;
  raw: number;
  scale: number;
  scaled: number;
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
  /** Per-factor contribution rows for the recommendation breakdown table. */
  contributions: ScoreContribution[];
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
  /**
   * Platform-specific scoring knobs. Pass `adapter.scoring` from the active
   * draft platform so positional targets, caps, and late-draft escalation
   * match the contest format. Defaults to `DEFAULT_SCORING` (DraftKings
   * baseline) so direct callers and existing tests behave unchanged.
   */
  scoring?: ScoringConfig;
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
    scoring = DEFAULT_SCORING,
    currentPick,
    upcomingPoolSize = scoring.defaultUpcomingPool,
    topN = scoring.defaultTopN,
  } = input;

  const myRankIndex = buildMyRankIndex(customRankings);
  const rosterInfo = collectRosterTeams(roster);
  const { rosterTeams } = rosterInfo;
  const needByPosition = new Map<Position, PositionNeed>();
  for (const n of positionNeeds) needByPosition.set(n.position, n);

  const upcoming = pickUpcomingPool(available, upcomingPoolSize);
  const w = scoring.weights;

  const scored = upcoming.map((player) => {
    const myRank = resolveMyRank(player, myRankIndex);
    const need = needByPosition.get(player.position);
    const breakdown: ScoreBreakdown = {
      rank: 210 - myRank,
      adp: 210 - player.adp,
      need: scoreNeedComponent(player, need, currentPick, scoring),
      stack: scoreStackComponent(player, roster, scoring),
      week17: scoreWeek17Component(player, rosterTeams),
    };
    const contributions: ScoreContribution[] = [
      { label: 'Rank', raw: breakdown.rank, scale: w.rank, scaled: w.rank * breakdown.rank },
      { label: 'ADP', raw: breakdown.adp, scale: w.adpValue, scaled: w.adpValue * breakdown.adp },
      { label: 'Need', raw: breakdown.need, scale: w.need, scaled: w.need * breakdown.need },
      { label: 'Stack', raw: breakdown.stack, scale: 1, scaled: breakdown.stack },
      { label: 'Wk17', raw: breakdown.week17, scale: w.week17, scaled: w.week17 * breakdown.week17 },
    ];
    const score = contributions.reduce((sum, item) => sum + item.scaled, 0);
    return {
      player,
      myRank,
      score,
      breakdown,
      contributions,
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
  currentPick: number | undefined,
  scoring: ScoringConfig,
): number {
  if (!need || need.target <= 0) return 0;
  const draftPick = currentPick && currentPick > 0
    ? currentPick
    : player.adp > 0
      ? player.adp
      : 9999;
  if (draftPick < scoring.needEnabledPick) return 0;
  const deficit = (need.target - need.current) / need.target;

  // QB and TE only receive positive need weight once the draft is past the
  // early rounds. Over-spending on those positions still gets punished at any
  // point (the negative side is always allowed).
  if (deficit > 0 && scoring.lateNeedPositions.has(player.position)) {
    if (draftPick < scoring.lateNeedEnabledPick) return 0;
  }
  const milestones = scoring.targetMinCount.get(player.position) ?? [];
  let count_need = 0;
  for (const [target_count, due_by_pick] of milestones) {
    if (draftPick > due_by_pick && need.count < target_count) {
      count_need = Math.max(count_need, (target_count - need.count) / target_count);
    }
  }
  const max_count = scoring.positionCountCap.get(player.position) ?? 99;
  if (need.count >= max_count) return -scoring.needClamp;

  const need_index = deficit + count_need;
  const position_scale = scoring.positionalNeedScale.get(player.position) ?? 1;

  return need_index * position_scale * needLateScale(draftPick, scoring);
}

/**
 * Late-draft need multiplier. Stays at 1 until `needLateScaleStartPick`,
 * jumps to `needLateScaleStart` (hard cliff), then ramps linearly to
 * `needLateScaleEnd` at `needLateScaleEndPick` and holds thereafter.
 */
function needLateScale(draftPick: number, scoring: ScoringConfig): number {
  if (draftPick < scoring.needLateScaleStartPick) return 1;
  if (draftPick >= scoring.needLateScaleEndPick) return scoring.needLateScaleEnd;
  const span = scoring.needLateScaleEndPick - scoring.needLateScaleStartPick;
  const t = (draftPick - scoring.needLateScaleStartPick) / span;
  return scoring.needLateScaleStart + (scoring.needLateScaleEnd - scoring.needLateScaleStart) * t;
}

function scoreStackComponent(
  player: Player,
  roster: ReadonlyArray<RosterPick>,
  scoring: ScoringConfig,
): number {
  const team = normalizeTeam(player.team);
  if (!team) return 0;
  const team_matches = roster.filter((p) => normalizeTeam(p.team) === team);
  let out = 0;
  for (const p of team_matches) {
    if (p.position === player.position && p.position !== "WR") {
      out -= scoring.weights.stackAny * 3;
    } else {
      out += scoring.weights.stackAny;
      if (p.position === "QB") out += scoring.weights.stackQb;
    }
  }
  return out;
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
