import { Schema } from "@effect/schema";

export const Position = Schema.Literal("QB", "RB", "WR", "TE");
export type Position = Schema.Schema.Type<typeof Position>;

export const Player = Schema.Struct({
  sourcePlayerId: Schema.optional(Schema.String),
  rank: Schema.Number,
  name: Schema.String,
  position: Position,
  team: Schema.String,
  adp: Schema.Number,
  byeWeek: Schema.Number,
  isDrafted: Schema.Boolean,
});
export type Player = Schema.Schema.Type<typeof Player>;

export const RosterPick = Schema.Struct({
  sourcePlayerId: Schema.optional(Schema.String),
  round: Schema.Number,
  pick: Schema.Number,
  overallPick: Schema.Number,
  name: Schema.String,
  position: Position,
  team: Schema.String,
  byeWeek: Schema.Number,
  adp: Schema.Number,
});
export type RosterPick = Schema.Schema.Type<typeof RosterPick>;

// A normalized draft-board event. Adapters will populate these from their live
// pick feed / draft board once the relevant DOM is available.
export interface DraftedPlayerObservation {
  /** Adapter-prefixed stable ID, for example `draftkings:693112`. */
  readonly sourcePlayerId?: string | null;
  readonly name: string;
  readonly position: Position;
  readonly team: string;
  readonly overallPick: number;
  readonly round: number;
  readonly pick: number;
  /** The fantasy-team slot (1..teamCount) that selected the player. */
  readonly draftSlot: number | null;
  /** Platform team/user label when one is present in the DOM. */
  readonly draftTeam: string | null;
}

export interface DraftedPlayer extends DraftedPlayerObservation {
  readonly playerKey: string;
}

export const StackTarget = Schema.Struct({
  qb: Player,
  rostered: Player,
  team: Schema.String,
  qbAdp: Schema.Number,
});
export type StackTarget = Schema.Schema.Type<typeof StackTarget>;

export const DraftState = Schema.Struct({
  roster: Schema.Array(RosterPick),
  available: Schema.Array(Player),
  userOnClock: Schema.Boolean,
  currentPick: Schema.Number,
});
export type DraftState = Schema.Schema.Type<typeof DraftState>;
