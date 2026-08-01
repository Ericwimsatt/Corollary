import { Schema } from "@effect/schema";

export const Position = Schema.Literal("QB", "RB", "WR", "TE");
export type Position = Schema.Schema.Type<typeof Position>;

export const Player = Schema.Struct({
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
