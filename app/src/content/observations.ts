import { Effect } from 'effect';
import type { DraftedPlayerObservation, Player, RosterPick } from './types';
import type { DraftPlatformAdapter } from './adapters';

/** The complete, storage-agnostic snapshot emitted by a platform adapter. */
export interface DraftObservations {
  readonly draftId: string;
  readonly availablePlayers: ReadonlyArray<Player>;
  readonly draftedPlayers: ReadonlyArray<DraftedPlayerObservation>;
  readonly roster: ReadonlyArray<RosterPick>;
  readonly userPickNumber: number | null;
  readonly isUserOnClock: boolean;
}

/**
 * Collects all DOM readers into one common shape. Adapters only parse; stores
 * and the reconciliation pipeline decide how observations affect state.
 */
export function readDraftObservations(adapter: DraftPlatformAdapter): Effect.Effect<DraftObservations> {
  return Effect.gen(function*() {
    const draftId = yield* adapter.getDraftId;
    const userPickNumber = yield* adapter.readUserPickNumber;
    const isUserOnClock = adapter.isUserOnClock();
    const roster = yield* adapter.readRoster;
    const availablePlayers = yield* adapter.readAvailablePlayers;
    const draftedBatches = yield* Effect.all(adapter.draftedPlayerSources.map(source => source.read));

    return {
      draftId,
      userPickNumber,
      isUserOnClock,
      roster,
      availablePlayers,
      draftedPlayers: draftedBatches.flat(),
    };
  });
}
