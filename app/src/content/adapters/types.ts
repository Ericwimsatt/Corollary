import type { Effect } from "effect";
import type { DraftedPlayerObservation, Player, Position, RosterPick } from "../types";

export type PlatformId = "draftkings" | "underdog";

export interface CapitalCeiling {
  readonly pos: ReadonlyArray<Position>;
  readonly label: Position;
  readonly maxCapital: number;
}

/**
 * Per-factor weights applied when combining the Next Best Pick score
 * components. Lives on the adapter so each platform can dial the emphasis of
 * rank value vs. need vs. stacking independently.
 */
export interface ScoringWeights {
  /** Weight for the ADP-vs-my-rank value component. */
  readonly rank: number;
  readonly adpValue: number;
  /** Weight for the team-construction need component. */
  readonly need: number;
  /** Bonus when a candidate shares a team with any already-rostered player. */
  readonly stackAny: number;
  /** Additional bonus when that rostered teammate is a quarterback. */
  readonly stackQb: number;
  /** Weight for the Week 17 opponent-correlation component. */
  readonly week17: number;
}

/**
 * The complete set of tunable knobs that drive the Next Best Pick scoring
 * formula. All values are platform-scoped: DraftKings (longer, looser drafts)
 * and Underdog (shorter, tighter drafts) want different positional targets,
 * caps, and late-draft escalation, so each adapter carries its own config.
 */
export interface ScoringConfig {
  /** Per-factor weights used to combine score components. */
  readonly weights: ScoringWeights;
  /** Maximum magnitude for normalized need scores. */
  readonly needClamp: number;
  /** Picks before this overall pick do not receive any positive need weight. */
  readonly needEnabledPick: number;
  /**
   * Count-based "should have N by pick X" milestones per position. Each row is
   * `[target_count, due_by_pick]`; the most-urgent unsatisfied milestone adds
   * to the need index.
   */
  readonly targetMinCount: ReadonlyMap<Position, ReadonlyArray<readonly [number, number]>>;
  /** Hard cap on rostered count per position; saturation returns a penalty. */
  readonly positionCountCap: ReadonlyMap<Position, number>;
  /** Per-position multiplier applied to the computed need index. */
  readonly positionalNeedScale: ReadonlyMap<Position, number>;
  /** Positions whose positive need is gated until the draft is older. */
  readonly lateNeedPositions: ReadonlySet<Position>;
  /** Picks before this overall pick do not get positive QB/TE need weight. */
  readonly lateNeedEnabledPick: number;
  /** Pick at which the late-draft need scaling kicks in (hard cliff). */
  readonly needLateScaleStartPick: number;
  /** Pick at which the late-draft need scaling reaches its final value. */
  readonly needLateScaleEndPick: number;
  /** Need multiplier applied starting at `needLateScaleStartPick`. */
  readonly needLateScaleStart: number;
  /** Need multiplier reached at `needLateScaleEndPick` (and held after). */
  readonly needLateScaleEnd: number;
  /** Default ADP window used to scale the ADP-vs-rank delta. */
  readonly rankBaseAdaptsTo: number;
  /** Default candidate pool size when the caller does not pass one. */
  readonly defaultUpcomingPool: number;
  /** Default number of recommendations returned when not specified. */
  readonly defaultTopN: number;
}

export interface AvailablePlayerRow {
  readonly row: Element;
  readonly rankCell: HTMLElement | null;
  readonly playerCell: Element | null;
  readonly detailsContainer: HTMLElement | null;
  readonly annotationContainer: HTMLElement | null;
  readonly byeCell: HTMLElement | null;
  readonly byeNumber: HTMLElement | null;
  readonly byeNumberSpan: HTMLElement | null;
  readonly sourcePlayerId: string | null;
  readonly rank: number;
  readonly name: string;
  readonly position: Position;
  readonly team: string;
  readonly adp: number;
  readonly byeWeek: number;
}

export interface PlatformUiAdapter {
  readonly injectPageStyles: () => void;
  readonly findMountPoint: () => Element | null;
  readonly placeMount: (host: HTMLElement, mountPoint: Element) => void;
  readonly findAvailablePlayersBody: () => Element | null;
  readonly getAvailablePlayerRows: (body: Element) => ReadonlyArray<Element>;
  readonly parseAvailablePlayerRow: (row: Element) => AvailablePlayerRow | null;
}

export interface DraftedPlayerSource {
  /** Diagnostic label only; reconciliation never branches on this value. */
  readonly id: string;
  readonly read: Effect.Effect<ReadonlyArray<DraftedPlayerObservation>>;
}

export interface DraftPlatformAdapter {
  readonly id: PlatformId;
  readonly label: string;
  readonly teamCount: number;
  readonly roundCount: number;
  readonly capitalCeilings: ReadonlyArray<CapitalCeiling>;
  readonly draftCapital: (overallPick: number) => number;
  /** Platform-specific Next Best Pick scoring knobs. */
  readonly scoring: ScoringConfig;
  readonly getDraftId: Effect.Effect<string>;
  readonly readRoster: Effect.Effect<ReadonlyArray<RosterPick>>;
  readonly readAvailablePlayers: Effect.Effect<ReadonlyArray<Player>>;
  /** Any number of DOM sources can emit the same common draft-event shape. */
  readonly draftedPlayerSources: ReadonlyArray<DraftedPlayerSource>;
  readonly readUserPickNumber: Effect.Effect<number | null>;
  readonly isUserOnClock: () => boolean;
  readonly ui: PlatformUiAdapter;
}
