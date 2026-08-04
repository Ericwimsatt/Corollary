import { Effect, Layer } from "effect";
import type { DraftedPlayer, Player, RosterPick } from "./types";
import { annotateStackTargets } from "./stack-annotator";
import { annotateByeWeekCounts } from "./bye-annotator";
import { RosterCache, RosterCacheLive } from "./roster-cache";
import { AvailableStore, AvailableStoreLive } from "./available-store";
import { getActiveAdapter, type DraftPlatformAdapter } from "./adapters";
import { normalizeTeam } from "../utils/teams";
import { DraftedStore, DraftedStoreLive } from './drafted-store';
import { findMatchingPlayer, playerKey } from './player-key';
import { readDraftObservations } from './observations';
import { mergeRosters, rosterFromDraftEvents } from './reconcile-draft';

export interface DraftData {
  readonly adapter: DraftPlatformAdapter;
  readonly draftId: string;
  readonly roster: ReadonlyArray<RosterPick>;
  readonly available: ReadonlyArray<Player>;
  readonly drafted: ReadonlyArray<DraftedPlayer>;
  readonly userPickNumber: number | null;
  readonly isUserOnClock: boolean;
}

function draftedKey(pick: {
  readonly sourcePlayerId?: string | null;
  readonly name: string;
  readonly team: string;
  readonly position: Player['position'];
}) {
  return {
    sourcePlayerId: pick.sourcePlayerId,
    name: pick.name,
    team: normalizeTeam(pick.team),
    position: pick.position,
  };
}

const refresh = Effect.gen(function*() {
  const adapter = getActiveAdapter();
  const observations = yield* readDraftObservations(adapter);
  const { draftId, userPickNumber, isUserOnClock } = observations;
  const rosterCache = yield* RosterCache;
  const availableStore = yield* AvailableStore;
  const draftedStore = yield* DraftedStore;

  yield* availableStore.load;
  yield* availableStore.switchDraft(draftId);
  yield* draftedStore.switchDraft(draftId);
  yield* rosterCache.switchDraft(draftId);
  const rosterObservation = observations.roster;
  const availableObservation = observations.availablePlayers;
  const draftedObservation = observations.draftedPlayers;

  yield* availableStore.merge(availableObservation);
  const catalog = yield* availableStore.getCatalog;
  // Some platforms expose only an abbreviated name in the draft feed. Resolve
  // it against the persistent catalog here so every adapter can emit the same
  // thin observation shape without owning identity or storage policy.
  const canonicalDraftedObservation = draftedObservation.map((event) => {
    const match = findMatchingPlayer(catalog, event);
    return match
      ? {
          ...event,
          sourcePlayerId: event.sourcePlayerId ?? match.sourcePlayerId ?? null,
          name: match.name,
          team: match.team,
          position: match.position,
        }
      : event;
  });
  yield* draftedStore.merge(canonicalDraftedObservation);
  const drafted = yield* draftedStore.getAll;
  yield* availableStore.learnDraftedPlayers(drafted);
  const updatedCatalog = yield* availableStore.getCatalog;
  const inferredRoster = rosterFromDraftEvents(drafted, updatedCatalog, userPickNumber, adapter.teamCount);
  // Draft events carry the exact pick; the roster DOM fills any missing rows/details.
  const roster = mergeRosters(inferredRoster, rosterObservation);

  const availableByKey = new Map(
    updatedCatalog.map((player) => [playerKey(player), player]),
  );
  const rosterWithByes = roster.map((pick) => {
    if (pick.byeWeek !== 0) return pick;
    const match = availableByKey.get(playerKey(pick)) ?? findMatchingPlayer(updatedCatalog, pick);
    return match?.byeWeek ? { ...pick, byeWeek: match.byeWeek } : pick;
  });

  // Exclude this draft's picks from recommendations without deleting them
  // from the cross-draft player catalog.
  yield* availableStore.excludeDrafted([
    ...drafted.map(draftedKey),
    ...rosterWithByes.map(draftedKey),
  ]);
  const cachedAvailable = yield* availableStore.getAll;

  yield* rosterCache.update(rosterWithByes);
  const cachedRoster = yield* rosterCache.getAll;
  const rosterForAnnotations = mergeRosters(rosterWithByes, cachedRoster);

  yield* annotateStackTargets(adapter, rosterForAnnotations, availableObservation);
  yield* annotateByeWeekCounts(adapter, rosterForAnnotations, availableObservation, updatedCatalog);
  return { adapter, draftId, roster: rosterForAnnotations, available: cachedAvailable, drafted, userPickNumber, isUserOnClock } as const;
});

const appLayer: Layer.Layer<RosterCache | AvailableStore | DraftedStore> =
  Layer.mergeAll(RosterCacheLive, AvailableStoreLive, DraftedStoreLive);

export const runRefresh: Effect.Effect<DraftData> =
  refresh.pipe(Effect.provide(appLayer));
