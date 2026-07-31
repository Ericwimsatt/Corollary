import { Context, Effect, Layer, Ref } from "effect";
import { type Position, type RosterPick } from './types';

const STORAGE_KEY_PREFIX = 'dh_roster_';

export interface CachedRosterPick {
  name: string;
  team: string;
  position: Position;
  round: number;
  pick: number;
  overallPick: number;
  byeWeek: number;
  firstSeen: number;
  lastSeen: number;
  seenCount: number;
}

interface PersistedRoster {
  picks: CachedRosterPick[];
  updatedAt: number;
}

interface RosterCacheService {
  readonly switchDraft: (draftId: string) => Effect.Effect<void>;
  readonly update: (picks: ReadonlyArray<RosterPick>) => Effect.Effect<void>;
  readonly getAll: Effect.Effect<ReadonlyArray<RosterPick>>;
  readonly currentDraftId: Effect.Effect<string | null>;
}

export class RosterCache extends Context.Tag("RosterCache")<RosterCache, RosterCacheService>() {}

const loadFromChrome = (key: string): Effect.Effect<PersistedRoster | null, unknown, never> =>
  Effect.tryPromise({
    try: () => chrome.storage.local.get(key).then(r => (r[key] ?? null) as PersistedRoster | null),
    catch: () => new Error("chrome.storage.local.get failed"),
  });

const loadFromLocalStorage = (key: string) =>
  Effect.sync(() => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PersistedRoster) : null;
  }).pipe(
    Effect.catchAll(() => Effect.succeed(null as PersistedRoster | null)),
  );

const loadFromStorage = (key: string) =>
  loadFromChrome(key).pipe(
    Effect.catchAll(() => loadFromLocalStorage(key)),
    Effect.catchAll(() => Effect.succeed(null as PersistedRoster | null)),
  );

const persistToChrome = (key: string, data: PersistedRoster): Effect.Effect<void> =>
  Effect.tryPromise(() => chrome.storage.local.set({ [key]: data })).pipe(
    Effect.catchAll(() =>
      Effect.sync(() => localStorage.setItem(key, JSON.stringify(data))),
    ),
  );

const playerKey = (name: string, team: string, position: Position): string =>
  `${name}::${team}::${position}`;

const storageKey = (draftId: string): string =>
  `${STORAGE_KEY_PREFIX}${draftId}`;

const switchDraftImpl = (draftId: string) =>
  Effect.gen(function*() {
    const prevId = yield* Ref.get(draftsRef);
    if (prevId === draftId) return;

    if (prevId) {
      const all = yield* Ref.get(byDraftRef);
      const prevMap = all.get(prevId);
      if (prevMap && prevMap.size > 0) {
        const records: CachedRosterPick[] = Array.from(prevMap.values());
        yield* persistToChrome(storageKey(prevId), { picks: records, updatedAt: Date.now() });
      }
    }

    const all = yield* Ref.get(byDraftRef);
    const existing = all.get(draftId);
    if (existing) {
      yield* Ref.set(draftsRef, draftId);
      return;
    }

    const loaded = yield* loadFromStorage(storageKey(draftId));

    const newMap = new Map<string, CachedRosterPick>();
    if (loaded) {
      for (const pick of loaded.picks) {
        const k = playerKey(pick.name, pick.team, pick.position);
        newMap.set(k, pick);
      }
    }

    yield* Ref.update(byDraftRef, m => { m.set(draftId, newMap); return m; });
    yield* Ref.set(draftsRef, draftId);
  });

const updateImpl = (picks: ReadonlyArray<RosterPick>) =>
  Effect.gen(function*() {
    const id = yield* Ref.get(draftsRef);
    if (!id) return;

    const now = Date.now();
    let added = false;
    yield* Ref.update(byDraftRef, (all) => {
      const current = all.get(id);
      if (!current) return all;
      for (const pick of picks) {
        const k = playerKey(pick.name, pick.team, pick.position);
        const existing = current.get(k);
        if (!existing) {
          current.set(k, {
            name: pick.name,
            team: pick.team,
            position: pick.position,
            round: pick.round,
            pick: pick.pick,
            overallPick: pick.overallPick > 0 ? pick.overallPick : current.size + 1,
            byeWeek: pick.byeWeek,
            firstSeen: now,
            lastSeen: now,
            seenCount: 1,
          });
          added = true;
        } else {
          let changed = false;
          if (pick.overallPick > 0 && existing.overallPick !== pick.overallPick) {
            existing.overallPick = pick.overallPick;
            existing.round = pick.round;
            existing.pick = pick.pick;
            changed = true;
          }
          if (existing.byeWeek === 0 && pick.byeWeek !== 0) {
            existing.byeWeek = pick.byeWeek;
            changed = true;
          }
          if (changed) {
            existing.lastSeen = now;
            existing.seenCount += 1;
            added = true;
          }
        }
      }
      return all;
    });

    if (added) {
      const all = yield* Ref.get(byDraftRef);
      const currentMap = all.get(id);
      if (currentMap) {
        yield* persistToChrome(storageKey(id), {
          picks: Array.from(currentMap.values()),
          updatedAt: now,
        });
      }
    }
  });

const getAllImpl = Effect.gen(function*() {
  const id = yield* Ref.get(draftsRef);
  if (!id) return [];
  const all = yield* Ref.get(byDraftRef);
  const current = all.get(id);
  if (!current) return [];
  return Array.from(current.values()).map((e) => ({
    name: e.name,
    team: e.team,
    position: e.position,
    round: e.round,
    pick: e.pick,
    overallPick: e.overallPick,
    byeWeek: e.byeWeek,
    adp: 0,
  }));
});

const draftsRef = Ref.unsafeMake<string | null>(null);
const byDraftRef = Ref.unsafeMake(new Map<string, Map<string, CachedRosterPick>>());

const service: RosterCacheService = {
  switchDraft: switchDraftImpl,
  update: updateImpl,
  getAll: getAllImpl,
  currentDraftId: Ref.get(draftsRef),
};

export const RosterCacheLive: Layer.Layer<RosterCache> =
  Layer.succeed(RosterCache, service);
