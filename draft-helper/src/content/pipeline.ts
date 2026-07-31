import { Effect, Layer } from "effect";
import type { Player, RosterPick } from "./types";
import { annotateStackTargets } from "./stack-annotator";
import { annotateByeWeekCounts } from "./bye-annotator";
import { annotateExternalRankings } from "./ranking-annotator";
import { RosterCache, RosterCacheLive } from "./roster-cache";
import { AvailableStore, AvailableStoreLive } from "./available-store";
import { getActiveAdapter, type DraftPlatformAdapter } from "./adapters";

export interface DraftData {
  readonly adapter: DraftPlatformAdapter;
  readonly draftId: string;
  readonly roster: ReadonlyArray<RosterPick>;
  readonly available: ReadonlyArray<Player>;
  readonly userPickNumber: number | null;
}

const refresh = Effect.gen(function*() {
  const adapter = getActiveAdapter();
  const draftId = yield* adapter.getDraftId;
  const rosterCache = yield* RosterCache;
  const availableStore = yield* AvailableStore;

  yield* availableStore.load;
  const persistedAvailable = yield* availableStore.getAll;
  yield* rosterCache.switchDraft(draftId);
  const userPickNumber = yield* adapter.readUserPickNumber;
  const roster = yield* adapter.readRoster;
  const available = yield* adapter.readAvailablePlayers;
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

  yield* annotateStackTargets(adapter, cached, available);
  yield* annotateByeWeekCounts(adapter, cached, available, persistedAvailable);
  yield* annotateExternalRankings(adapter);
  return { adapter, draftId, roster: cached, available, userPickNumber } as const;
});

const appLayer: Layer.Layer<RosterCache | AvailableStore> =
  Layer.mergeAll(RosterCacheLive, AvailableStoreLive);

export const runRefresh: Effect.Effect<DraftData> =
  refresh.pipe(Effect.provide(appLayer));
