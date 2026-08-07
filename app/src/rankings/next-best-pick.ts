import { Option } from "effect";
import type { Player, Position, RosterPick } from "../content/types";
import type { CustomRanking } from "./custom-rankings";
import type { CapitalGoal, DraftPlatformAdapter, PositionScoringPolicy, ScoringConfig } from "../content/adapters/types";
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
// positional goals and caps differ. Anything you
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
export const NEED_CLAMP = 2.5;
/** Default ADP window used to scale the ADP-vs-rank delta. */
export const RANK_BASE_ADAPTS_TO = 50;
export const DEFAULT_UPCOMING_POOL = 30;
export const DEFAULT_TOP_N = 15;

const CAPITAL_GOALS: ReadonlyMap<Position, ReadonlyArray<CapitalGoal>> = new Map([
  ['QB', [{ fraction: 1, pick: 140 }]],
  ['RB', [{ fraction: .35, pick: 50 }, { fraction: .7, pick: 100 }, { fraction: 1, pick: 200 }]],
  ['WR', [{ fraction: .5, pick: 50 }, { fraction: .8, pick: 80 }, { fraction: 1, pick: 200 }]],
  ['TE', [{ fraction: .5, pick: 60 }, { fraction: .8, pick: 120 }, { fraction: 1, pick: 200 }]],
]);

const POSITION_POLICIES: ReadonlyMap<Position, PositionScoringPolicy> = new Map([
  ['QB', { capitalGoals: CAPITAL_GOALS.get('QB')!, maxCount: 3 }],
  ['RB', { capitalGoals: CAPITAL_GOALS.get('RB')!, maxCount: 7 }],
  ['WR', { capitalGoals: CAPITAL_GOALS.get('WR')!, maxCount: 9 }],
  ['TE', { capitalGoals: CAPITAL_GOALS.get('TE')!, maxCount: 4 }],
]);

function draftKingsCapital(overallPick: number): number {
  return Math.round(5000 * Math.exp(-Math.pow((overallPick - 1) / 57.5, 0.74)));
}

function underdogCapital(overallPick: number): number {
  return Math.round(5000 * Math.exp(-Math.pow((overallPick - 1) / 52, 0.74)));
}

/**
 * DraftKings scoring config. DraftKings snake drafts run 20 rounds and require
 * a three-QB final roster, while QB capital is targeted by pick 140.
 */
export const draftKingsScoring: ScoringConfig = {
  weights: SCORE_WEIGHTS,
  needClamp: NEED_CLAMP,
  positionPolicies: new Map([
    ...POSITION_POLICIES,
    ['QB', { capitalGoals: CAPITAL_GOALS.get('QB')!, maxCount: 3, minCountGoals: [{ count: 3, pick: 240 }] }],
  ]),
  draftCapital: draftKingsCapital,
  rankBaseAdaptsTo: RANK_BASE_ADAPTS_TO,
  defaultUpcomingPool: DEFAULT_UPCOMING_POOL,
  defaultTopN: DEFAULT_TOP_N,
};

/**
 * Underdog scoring config. Underdog contests are 18 rounds, so the WR cap is
 * tighter than DraftKings while the shared capital curves remain comparable.
 */
export const underdogScoring: ScoringConfig = {
  ...draftKingsScoring,
  positionPolicies: new Map([
    ['QB', { capitalGoals: CAPITAL_GOALS.get('QB')!, maxCount: 3 }],
    ['RB', { capitalGoals: CAPITAL_GOALS.get('RB')!, maxCount: 7 }],
    ['WR', { capitalGoals: CAPITAL_GOALS.get('WR')!, maxCount: 8 }],
    ['TE', { capitalGoals: CAPITAL_GOALS.get('TE')!, maxCount: 4 }],
  ]),
  draftCapital: underdogCapital,
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
      const overall = overallPickForRosterIndex(rosterIndex, userPickNumber, adapter.teamCount);
      return sum + adapter.draftCapital(overall);
    }, 0);
    return { position: ceiling.label, current, target: ceiling.maxCapital, count: players.length };
  });
}

export function overallPickForRosterIndex(rosterIndex: number, userPick: number, teamCount: number): number {
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
  const policy = scoring.positionPolicies.get(player.position);
  if (!policy) return 0;
  if (policy.maxCount !== undefined && need.count >= policy.maxCount) return -scoring.needClamp;

  const expectedFraction = capitalFractionAtPick(policy.capitalGoals, draftPick);
  const projectedCapital = need.current + scoring.draftCapital(draftPick);
  const projectedFraction = projectedCapital / need.target;
  const capitalGap = expectedFraction - projectedFraction;
  const capitalScore = capitalGap >= 0 ? capitalGap : capitalGap * 2;

  let countScore = 0;
  for (const goal of policy.minCountGoals ?? []) {
    if (draftPick >= goal.pick && need.count < goal.count) {
      countScore = Math.max(countScore, (goal.count - need.count) / goal.count);
    }
  }

  return clamp(capitalScore + countScore, -scoring.needClamp, scoring.needClamp);
}

function capitalFractionAtPick(goals: ReadonlyArray<CapitalGoal>, pick: number): number {
  if (goals.length === 0) return 0;
  const ordered = [...goals].sort((a, b) => a.pick - b.pick);
  const first = ordered[0];
  if (pick <= first.pick) return first.fraction * Math.max(0, pick) / first.pick;
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    if (pick <= current.pick) {
      const t = (pick - previous.pick) / (current.pick - previous.pick);
      return previous.fraction + (current.fraction - previous.fraction) * t;
    }
  }
  return ordered[ordered.length - 1].fraction;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
      // QB stack bonus applies symmetrically: when the rostered teammate is a
      // QB, or when the candidate is the QB being stacked with a rostered
      // skill player.
      if (p.position === "QB" || player.position === "QB") out += scoring.weights.stackQb;
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
