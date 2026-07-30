import { Effect, Layer } from "effect";
import type { Player, RosterPick } from "./types";
import { readRoster, readAvailablePlayers, readUserPickNumber } from "./dom-reader";
import { annotateStackTargets } from "./stack-annotator";
import { annotateExternalRankings } from "./ranking-annotator";
import { extractDraftId } from "./draft-id";
import { RosterCache, RosterCacheLive } from "./roster-cache";
import { AvailableStore, AvailableStoreLive } from "./available-store";

export interface DraftData {
  readonly draftId: string;
  readonly roster: ReadonlyArray<RosterPick>;
  readonly available: ReadonlyArray<Player>;
  readonly userPickNumber: number | null;
}

const refresh = Effect.gen(function*() {
  const draftId = yield* extractDraftId;
  const rosterCache = yield* RosterCache;
  const availableStore = yield* AvailableStore;

  yield* availableStore.load;
  yield* rosterCache.switchDraft(draftId);
  const userPickNumber = yield* readUserPickNumber;
  const roster = yield* readRoster;
  const available = yield* readAvailablePlayers;

  yield* availableStore.update(available);
  yield* rosterCache.update(roster);
  const cached = yield* rosterCache.getAll;

  yield* annotateStackTargets(cached, available);
  yield* annotateExternalRankings;
  return { draftId, roster: cached, available, userPickNumber } as const;
});

const appLayer: Layer.Layer<RosterCache | AvailableStore> =
  Layer.mergeAll(RosterCacheLive, AvailableStoreLive);

export const runRefresh: Effect.Effect<DraftData> =
  refresh.pipe(Effect.provide(appLayer));
