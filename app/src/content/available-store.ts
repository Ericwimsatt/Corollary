import { Context, Effect, Layer, Ref } from "effect";
import type { Player } from './types';

const STORAGE_KEY = 'dh_available_data';

export interface AvailableData {
  players: Player[];
  updatedAt: number;
}

interface AvailableStoreService {
  readonly load: Effect.Effect<void>;
  readonly update: (players: ReadonlyArray<Player>) => Effect.Effect<void>;
  readonly getAll: Effect.Effect<ReadonlyArray<Player>>;
}

export class AvailableStore extends Context.Tag("AvailableStore")<AvailableStore, AvailableStoreService>() {}

export const AvailableStoreLive = Layer.effect(
  AvailableStore,
  Effect.gen(function*() {
    const cache = yield* Ref.make<Player[]>([]);
    const loaded = yield* Ref.make(false);

    const loadFromChrome = Effect.tryPromise({
      try: () => chrome.storage.local.get(STORAGE_KEY),
      catch: () => new Error("chrome.storage.local.get failed"),
    }).pipe(
      Effect.map((result) => (result[STORAGE_KEY] ?? null) as AvailableData | null),
      Effect.catchAll(() => Effect.succeed(null as AvailableData | null)),
    );

    const loadFromLocalStorage = Effect.sync(() => {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AvailableData) : null;
    }).pipe(
      Effect.catchAll(() => Effect.succeed(null as AvailableData | null)),
    );

    const load = Effect.gen(function*() {
      const already = yield* Ref.get(loaded);
      if (already) return;
      const data = yield* loadFromChrome.pipe(
        Effect.catchAll(() => loadFromLocalStorage),
      );
      if (data) {
        yield* Ref.set(cache, data.players);
      }
      yield* Ref.set(loaded, true);
    });

    const persist = (players: Player[]) =>
      Effect.gen(function*() {
        const data: AvailableData = { players, updatedAt: Date.now() };
        yield* Effect.tryPromise(() => chrome.storage.local.set({ [STORAGE_KEY]: data })).pipe(
          Effect.catchAll(() =>
            Effect.sync(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(data))),
          ),
        );
      });

    const update = (players: ReadonlyArray<Player>) =>
      Effect.gen(function*() {
        const arr = Array.from(players);
        yield* Ref.set(cache, arr);
        yield* persist(arr);
      });

    const getAll = Ref.get(cache);

    return { load, update, getAll } as const;
  }),
);
