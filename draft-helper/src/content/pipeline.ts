import { Effect, Layer } from "effect";
import type { Player, RosterPick } from "./types";
import { readRoster, readAvailablePlayers, readUserPickNumber } from "./dom-reader";
import { annotateStackTargets } from "./stack-annotator";
import { annotateByeWeekCounts } from "./bye-annotator";
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
  const persistedAvailable = yield* availableStore.getAll;
  yield* rosterCache.switchDraft(draftId);
  const userPickNumber = yield* readUserPickNumber;
  const roster = yield* readRoster;
  const available = yield* readAvailablePlayers;
  const availableByKey = new Map(
    [...persistedAvailable, ...available].map((player) => [
      `${player.name}::${player.team}::${player.position}`,
      player,
    ]),
  );
  const rosterWithByes = roster.map((pick) => {
    if (pick.byeWeek !== 0) return pick;
    const match = availableByKey.get(`${pick.name}::${pick.team}::${pick.position}`);
    return match?.byeWeek ? { ...pick, byeWeek: match.byeWeek } : pick;
  });

  yield* availableStore.update(available);
  yield* rosterCache.update(rosterWithByes);
  const cached = yield* rosterCache.getAll;

  yield* annotateStackTargets(cached, available);
  yield* annotateByeWeekCounts(cached, available, persistedAvailable);
  yield* annotateExternalRankings;
  return { draftId, roster: cached, available, userPickNumber } as const;
});

const appLayer: Layer.Layer<RosterCache | AvailableStore> =
  Layer.mergeAll(RosterCacheLive, AvailableStoreLive);

export const runRefresh: Effect.Effect<DraftData> =
  refresh.pipe(Effect.provide(appLayer));
