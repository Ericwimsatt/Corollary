import { Context, Effect, Layer, Ref } from "effect";
import type { DraftedPlayer, Player, Position } from './types';
import { normalizeTeam } from '../utils/teams';
import { findMatchingPlayer, namePlayerKey, playerKey } from './player-key';

const STORAGE_KEY = 'dh_available_data';

export interface AvailableData {
  players: Player[];
  updatedAt: number;
}

interface DraftedKey {
  readonly sourcePlayerId?: string | null;
  readonly name: string;
  readonly team: string;
  readonly position: Position;
}

function safeLocalSet(key: string, value: string): Effect.Effect<void> {
  return Effect.sync(() => {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  });
}

interface AvailableStoreService {
  readonly load: Effect.Effect<void>;
  readonly switchDraft: (draftId: string) => Effect.Effect<void>;
  readonly merge: (players: ReadonlyArray<Player>) => Effect.Effect<void>;
  readonly excludeDrafted: (drafted: ReadonlyArray<DraftedKey>) => Effect.Effect<void>;
  readonly learnDraftedPlayers: (drafted: ReadonlyArray<DraftedPlayer>) => Effect.Effect<void>;
  readonly getAll: Effect.Effect<ReadonlyArray<Player>>;
  readonly getCatalog: Effect.Effect<ReadonlyArray<Player>>;
}

export class AvailableStore extends Context.Tag("AvailableStore")<AvailableStore, AvailableStoreService>() {}

export const AvailableStoreLive = Layer.effect(
  AvailableStore,
  Effect.gen(function*() {
    const cache = yield* Ref.make<Player[]>([]);
    const loaded = yield* Ref.make(false);
    const draftIdRef = yield* Ref.make<string | null>(null);
    const draftedKeysRef = yield* Ref.make(new Set<string>());

    const loadFromChrome = Effect.tryPromise({
      try: () => chrome.storage.local.get(STORAGE_KEY),
      catch: () => new Error("chrome.storage.local.get failed"),
    }).pipe(
      Effect.map((result) => (result[STORAGE_KEY] ?? null) as AvailableData | null),
    );

    const loadFromLocalStorage = Effect.sync(() => {
      if (typeof localStorage === 'undefined') return null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as AvailableData) : null;
      } catch {
        return null;
      }
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

    // The catalog intentionally spans drafts. A new draft should inherit
    // players that have not appeared in the virtualized table yet.
    const switchDraft = (draftId: string) =>
      Effect.gen(function*() {
        if (!draftId) return;
        const previous = yield* Ref.get(draftIdRef);
        if (previous !== draftId) yield* Ref.set(draftedKeysRef, new Set());
        yield* Ref.set(draftIdRef, draftId);
      });

    const persist = (players: Player[]) =>
      Effect.gen(function*() {
        const data: AvailableData = { players, updatedAt: Date.now() };
        yield* Effect.tryPromise(() => chrome.storage.local.set({ [STORAGE_KEY]: data })).pipe(
          Effect.catchAll(() => safeLocalSet(STORAGE_KEY, JSON.stringify(data))),
        );
      });

    // Add or refresh entries by name::team::position. Players seen in earlier
    // refreshes but filtered out of the current view stay in cache, while
    // visible players get their latest rank/adp/byeWeek stored.
    const merge = (players: ReadonlyArray<Player>) =>
      Effect.gen(function*() {
        const current = yield* Ref.get(cache);
        const byKey = new Map<string, Player>();
        for (const p of current) byKey.set(playerKey(p), p);
        for (const p of players) {
          const incoming = { ...p, team: normalizeTeam(p.team) };
          const key = playerKey(incoming);
          const legacyKey = byKey.has(key) ? undefined : Array.from(byKey.entries())
            .find(([, cached]) => !cached.sourcePlayerId && namePlayerKey(cached) === namePlayerKey(incoming))?.[0];
          const existing = byKey.get(key) ?? (legacyKey ? byKey.get(legacyKey) : undefined);
          if (legacyKey && legacyKey !== key) byKey.delete(legacyKey);
          byKey.set(key, mergePlayer(existing, incoming));
        }
        const next = Array.from(byKey.values());
        yield* Ref.set(cache, next);
        yield* persist(next);
      });

    const excludeDrafted = (drafted: ReadonlyArray<DraftedKey>) =>
      Effect.gen(function*() {
        if (drafted.length === 0) return;
        const catalog = yield* Ref.get(cache);
        const removed = new Set<string>();
        for (const event of drafted) {
          removed.add(playerKey(event));
          const catalogPlayer = findMatchingPlayer(catalog, event);
          if (catalogPlayer) removed.add(playerKey(catalogPlayer));
        }
        yield* Ref.update(draftedKeysRef, current => new Set([...current, ...removed]));
      });

    const learnDraftedPlayers = (drafted: ReadonlyArray<DraftedPlayer>) =>
      Effect.gen(function*() {
        const identities = drafted.filter(event => event.sourcePlayerId);
        if (identities.length === 0) return;
        const current = yield* Ref.get(cache);
        const byKey = new Map(current.map(player => [playerKey(player), player]));
        let changed = false;
        for (const event of identities) {
          const key = playerKey(event);
          const existing = byKey.get(key);
          if (!existing) continue;
          const normalizedTeam = normalizeTeam(event.team);
          if (existing.name === event.name && existing.team === normalizedTeam) continue;
          byKey.set(key, { ...existing, name: event.name, team: normalizedTeam });
          changed = true;
        }
        if (!changed) return;
        const next = Array.from(byKey.values());
        yield* Ref.set(cache, next);
        yield* persist(next);
      });

    const getAll = Effect.gen(function*() {
      const players = yield* Ref.get(cache);
      const drafted = yield* Ref.get(draftedKeysRef);
      return players.filter(p => !drafted.has(playerKey(p)));
    });
    const getCatalog = Ref.get(cache);

    return { load, switchDraft, merge, excludeDrafted, learnDraftedPlayers, getAll, getCatalog } as const;
  }),
);

function mergePlayer(existing: Player | undefined, incoming: Player): Player {
  if (!existing) return incoming;
  return {
    sourcePlayerId: incoming.sourcePlayerId ?? existing.sourcePlayerId,
    rank: incoming.rank || existing.rank,
    name: incoming.name,
    position: incoming.position,
    team: incoming.team,
    adp: incoming.adp || existing.adp,
    byeWeek: incoming.byeWeek || existing.byeWeek,
    isDrafted: incoming.isDrafted,
  };
}
