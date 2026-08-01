# Phase 2: Storage (AdpStore) + Cache (RosterCache) as Effect Layers

## Goal

Convert the two mutable class singletons (`AdpStore`, `RosterCache`) into Effect services backed by `Ref` and `Layer`. This is the core fix for the "data storage/access" pain point.

## Context

Currently:
- `AdpStore` is a class with a `Map<string, number>`, manual `chrome.storage.local` try/catch fallback to `localStorage`, and a promise-based load guard.
- `RosterCache` is a class with a `Map<string, CachedRosterPick>` and manual `Date.now()` bookkeeping.
- Both are instantiated as module-level singletons (`const adpStore = new AdpStore()` in `App.tsx`, `const rosterCacheRef = useRef(new RosterCache())`).

## Files to create/modify

### 1. Create `src/content/adp-store.ts` (rewrite)

Use `Context.Tag` + `Layer.effect` + `Ref`.

```typescript
import { Context, Effect, Layer, Ref } from "effect";
import type { Player, Position } from "./types";

const STORAGE_KEY = "dh_adp_data";

interface AdpRecord {
  name: string;
  team: string;
  position: Position;
  adp: number;
  updatedAt: number;
}

// Service interface
interface AdpStoreService {
  readonly load: Effect<never, never, void>;
  readonly update: (players: ReadonlyArray<Player>) => Effect<never, never, void>;
  readonly get: (name: string, team: string, position: Position) => Effect<never, never, number | undefined>;
}

// Tag
export class AdpStore extends Context.Tag("AdpStore")<
  AdpStore,
  AdpStoreService
>() {}

// Live implementation
export const AdpStoreLive = Layer.effect(
  AdpStore,
  Effect.gen(function*() {
    const cache = yield* Ref.make(new Map<string, number>());
    const loaded = yield* Ref.make(false);

    const key = (name: string, team: string, position: Position) =>
      `${name}::${team}::${position}`;

    const loadFromChrome = Effect.tryPromise({
      try: () => chrome.storage.local.get(STORAGE_KEY),
      catch: () => new Error("chrome.storage.local.get failed"),
    }).pipe(
      Effect.map((result) => (result[STORAGE_KEY] ?? []) as AdpRecord[]),
      Effect.catchAll(() => Effect.succeed([] as AdpRecord[])),
    );

    const loadFromLocalStorage = Effect.sync(() => {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AdpRecord[]) : [];
    }).pipe(
      Effect.catchAll(() => Effect.succeed([] as AdpRecord[])),
    );

    const loadFromStorage = loadFromChrome.pipe(
      Effect.catchAll(() => loadFromLocalStorage),
    );

    const load = Effect.gen(function*() {
      const already = yield* Ref.get(loaded);
      if (already) return;

      const records = yield* loadFromStorage;
      yield* Ref.update(cache, (m) => {
        for (const r of records) {
          m.set(key(r.name, r.team, r.position), r.adp);
        }
        return m;
      });
      yield* Ref.set(loaded, true);
    }).pipe(Effect.once); // Effect.once replaces the manual promise guard — only runs once

    const persist = Effect.gen(function*() {
      const map = yield* Ref.get(cache);
      const records: AdpRecord[] = [];
      const now = Date.now();
      for (const [k, adp] of map) {
        const parts = k.split("::");
        records.push({ name: parts[0], team: parts[1], position: parts[2] as Position, adp, updatedAt: now });
      }
      yield* Effect.tryPromise(() => chrome.storage.local.set({ [STORAGE_KEY]: records })).pipe(
        Effect.catchAll(() =>
          Effect.sync(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(records)))
        ),
      );
    });

    const update = (players: ReadonlyArray<Player>) =>
      Effect.gen(function*() {
        let changed = false;
        for (const p of players) {
          const k = key(p.name, p.team, p.position);
          const existing = yield* Ref.get(cache).pipe(Effect.map((m) => m.get(k)));
          if (existing !== p.adp) {
            yield* Ref.update(cache, (m) => { m.set(k, p.adp); return m; });
            changed = true;
          }
        }
        if (changed) yield* persist;
      });

    const get = (name: string, team: string, position: Position) =>
      Ref.get(cache).pipe(Effect.map((m) => m.get(key(name, team, position))));

    return { load: Effect.once(load), update, get } as const;
  })
);
```

**Key changes from current class:**
- `loadPromise` + `loaded` flag → `Effect.once` (built-in dedup)
- try/catch on chrome.storage → `Effect.tryPromise` + `Effect.catchAll`
- Manual `cache.set` → `Ref.update` (transactional)
- Manual `persist()` call → Effect composed in `update`
- The fallback (chrome → localStorage) is explicit and composable

### 2. Rewrite `src/content/roster-cache.ts`

Apply the same pattern — `Context.Tag` + `Ref`:

```typescript
import { Context, Effect, Layer, Ref } from "effect";
import type { Position, RosterPick } from "./types";

export interface CachedRosterPick {
  name: string;
  team: string;
  position: Position;
  round: number;
  pick: number;
  overallPick: number;
  byeWeek: number;
  adp: number;
  firstSeen: number;
  lastSeen: number;
  seenCount: number;
}

interface RosterCacheService {
  readonly update: (
    picks: ReadonlyArray<RosterPick>,
    getAdp?: (name: string, team: string, position: Position) => number | undefined
  ) => Effect<never, never, void>;
  readonly getAll: Effect<never, never, ReadonlyArray<RosterPick>>;
}

export class RosterCache extends Context.Tag("RosterCache")<
  RosterCache,
  RosterCacheService
>() {}

export const RosterCacheLive = Layer.effect(
  RosterCache,
  Effect.gen(function*() {
    const map = yield* Ref.make(new Map<string, CachedRosterPick>());

    const key = (name: string, team: string, position: Position) =>
      `${name}::${team}::${position}`;

    const update = (
      picks: ReadonlyArray<RosterPick>,
      getAdp?: (name: string, team: string, position: Position) => number | undefined
    ) =>
      Ref.update(map, (current) => {
        const now = Date.now();
        for (const pick of picks) {
          const k = key(pick.name, pick.team, pick.position);
          const existing = current.get(k);
          if (existing) {
            current.set(k, {
              ...existing,
              lastSeen: now,
              seenCount: existing.seenCount + 1,
              round: pick.round > 0 ? pick.round : existing.round,
              pick: pick.pick > 0 ? pick.pick : existing.pick,
              byeWeek: pick.byeWeek > 0 ? pick.byeWeek : existing.byeWeek,
              team: pick.team || existing.team,
              adp: pick.adp > 0 ? pick.adp : existing.adp,
            });
          } else {
            const adp = pick.adp > 0 ? pick.adp : (getAdp?.(pick.name, pick.team, pick.position) ?? 0);
            current.set(k, {
              name: pick.name,
              team: pick.team,
              position: pick.position,
              round: pick.round,
              pick: pick.pick,
              overallPick: current.size + 1,
              byeWeek: pick.byeWeek,
              adp,
              firstSeen: now,
              lastSeen: now,
              seenCount: 1,
            });
          }
        }
        return current;
      });

    const getAll = Ref.get(map).pipe(
      Effect.map((m) =>
        Array.from(m.values()).map((e) => ({
          name: e.name,
          team: e.team,
          position: e.position,
          round: e.round,
          pick: e.pick,
          overallPick: e.overallPick,
          byeWeek: e.byeWeek,
          adp: e.adp,
        }))
      )
    );

    return { update, getAll } as const;
  })
);
```

**Key changes:**
- Class instance + `useRef` → Effect Layer (provided once at composition root)
- `this.map.set()` → `Ref.update(map, ...)` — returns new map, fully transactional
- Sealed `RosterPick[]` return type — no more `cachedRosterPick` leaking

### 3. Verification

```bash
npx tsc --noEmit
npx vitest run
```

Both must pass. These layers are not yet wired into `App.tsx` — that happens in Phase 4. For now we verify they compile and are semantically correct.
