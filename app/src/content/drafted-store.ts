import { Context, Effect, Layer, Ref } from 'effect';
import type { DraftedPlayer, DraftedPlayerObservation } from './types';
import { namePlayerKey, playerKey } from './player-key';

const STORAGE_KEY_PREFIX = 'dh_drafted_';

interface PersistedDraftedPlayers {
  readonly players: DraftedPlayer[];
  readonly updatedAt: number;
}

interface DraftedStoreService {
  readonly switchDraft: (draftId: string) => Effect.Effect<void>;
  readonly merge: (players: ReadonlyArray<DraftedPlayerObservation>) => Effect.Effect<void>;
  readonly getAll: Effect.Effect<ReadonlyArray<DraftedPlayer>>;
}

export class DraftedStore extends Context.Tag('DraftedStore')<DraftedStore, DraftedStoreService>() {}

function storageKey(draftId: string): string {
  return `${STORAGE_KEY_PREFIX}${draftId}`;
}

function load(key: string): Effect.Effect<PersistedDraftedPlayers | null> {
  return Effect.tryPromise(() => chrome.storage.local.get(key).then(result =>
    (result[key] ?? null) as PersistedDraftedPlayers | null,
  )).pipe(
    Effect.catchAll(() => Effect.sync(() => {
      if (typeof localStorage === 'undefined') return null;
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) as PersistedDraftedPlayers : null;
      } catch {
        return null;
      }
    })),
  );
}

function persist(key: string, data: PersistedDraftedPlayers): Effect.Effect<void> {
  return Effect.tryPromise(() => chrome.storage.local.set({ [key]: data })).pipe(
    Effect.catchAll(() => Effect.sync(() => {
      if (typeof localStorage === 'undefined') return;
      try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
    })),
  );
}

export const DraftedStoreLive = Layer.effect(
  DraftedStore,
  Effect.gen(function*() {
    const activeDraft = yield* Ref.make<string | null>(null);
    const players = yield* Ref.make(new Map<string, DraftedPlayer>());

    const switchDraft = (draftId: string) => Effect.gen(function*() {
      if (!draftId || draftId === (yield* Ref.get(activeDraft))) return;
      const saved = yield* load(storageKey(draftId));
      const next = new Map<string, DraftedPlayer>();
      for (const event of saved?.players ?? []) next.set(playerKey(event), event);
      yield* Ref.set(players, next);
      yield* Ref.set(activeDraft, draftId);
    });

    const merge = (observations: ReadonlyArray<DraftedPlayerObservation>) => Effect.gen(function*() {
      if (observations.length === 0) return;
      const draftId = yield* Ref.get(activeDraft);
      if (!draftId) return;
      yield* Ref.update(players, current => {
        const next = new Map(current);
        for (const observation of observations) {
          const directKey = playerKey(observation);
          const aliasKey = next.has(directKey)
            ? directKey
            : Array.from(next.entries()).find(([, event]) =>
                namePlayerKey(event) === namePlayerKey(observation)
              )?.[0];
          const existing = aliasKey ? next.get(aliasKey) : undefined;
          const key = observation.sourcePlayerId ? directKey : aliasKey ?? directKey;
          if (aliasKey && aliasKey !== key) next.delete(aliasKey);
          next.set(key, {
            ...observation,
            sourcePlayerId: observation.sourcePlayerId ?? existing?.sourcePlayerId ?? null,
            overallPick: observation.overallPick || existing?.overallPick || 0,
            round: observation.round || existing?.round || 0,
            pick: observation.pick || existing?.pick || 0,
            draftSlot: observation.draftSlot ?? existing?.draftSlot ?? null,
            draftTeam: observation.draftTeam ?? existing?.draftTeam ?? null,
            playerKey: key,
          });
        }
        return next;
      });
      const current = yield* Ref.get(players);
      yield* persist(storageKey(draftId), {
        players: Array.from(current.values()),
        updatedAt: Date.now(),
      });
    });

    return { switchDraft, merge, getAll: Ref.get(players).pipe(Effect.map(map => Array.from(map.values()))) };
  }),
);
