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

function rosterKey(pick: Pick<RosterPick, 'name' | 'team' | 'position'>): string {
  return `${pick.name}::${pick.team}::${pick.position}`;
}

function mergeRosterForAnnotations(
  fresh: ReadonlyArray<RosterPick>,
  cached: ReadonlyArray<RosterPick>,
): ReadonlyArray<RosterPick> {
  const merged = new Map<string, RosterPick>();

  for (const pick of fresh) {
    merged.set(rosterKey(pick), pick);
  }

  for (const pick of cached) {
    const key = rosterKey(pick);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, pick);
    } else if (existing.byeWeek === 0 && pick.byeWeek !== 0) {
      merged.set(key, { ...existing, byeWeek: pick.byeWeek });
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.overallPick - b.overallPick);
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
  const rosterForAnnotations = mergeRosterForAnnotations(rosterWithByes, cached);

  yield* annotateStackTargets(adapter, rosterForAnnotations, available);
  yield* annotateByeWeekCounts(adapter, rosterForAnnotations, available, persistedAvailable);
  yield* annotateExternalRankings(adapter);
  return { adapter, draftId, roster: rosterForAnnotations, available, userPickNumber } as const;
});

const appLayer: Layer.Layer<RosterCache | AvailableStore> =
  Layer.mergeAll(RosterCacheLive, AvailableStoreLive);

export const runRefresh: Effect.Effect<DraftData> =
  refresh.pipe(Effect.provide(appLayer));
