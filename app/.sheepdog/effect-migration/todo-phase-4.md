# Phase 4: Pipeline + Stream + React Bridge + Cleanup

## Goal

This is the capstone phase. Extract all orchestration logic from `App.tsx` into a standalone Effect pipeline with `Stream`, then bridge it to React cleanly. Also wire up the `AdpStore` and `RosterCache` layers created in Phase 2.

## Files to create/modify

### 1. Create `src/content/pipeline.ts` — the Effect pipeline

This is the new file that owns all the orchestration. It replaces the imperative `refresh()` function in `App.tsx`.

```typescript
import { Effect, Stream, Layer } from "effect";
import type { Player, RosterPick } from "./types";
import { readRoster, readAvailablePlayers } from "./dom-reader";
import { annotateStackTargets } from "./stack-annotator";
import { AdpStore, AdpStoreLive } from "./adp-store";
import { RosterCache, RosterCacheLive } from "./roster-cache";

// The data that flows out of the pipeline into React
export interface DraftData {
  roster: ReadonlyArray<RosterPick>;
  available: ReadonlyArray<Player>;
}

// Single refresh cycle — the core pipeline
const refresh = Effect.gen(function*() {
  const adpStore = yield* AdpStore;
  const rosterCache = yield* RosterCache;

  yield* adpStore.load;

  const roster = yield* readRoster;
  const available = yield* readAvailablePlayers;

  yield* adpStore.update(available);
  yield* rosterCache.update(roster, (name, team, pos) =>
    Effect.runSync(adpStore.get(name, team, pos))
  );
  const cached = yield* rosterCache.getAll;

  // Annotate the DraftKings DOM with stack badges
  yield* annotateStackTargets(cached, available);

  return { roster: cached, available } as const;
});

// The full app layer with all services provided
const appLayer = Layer.mergeAll(AdpStoreLive, RosterCacheLive);
const refreshProvided = refresh.pipe(Effect.provide(appLayer));

// Build a Stream from the MutationObserver
export const draftStream: Stream<never, never, DraftData> = 
  Stream.async<DraftData>((emit) => {
    let running = false;

    const handler = () => {
      if (running) return; // prevent concurrent refreshes
      running = true;
      Effect.runPromise(refreshProvided).then(
        (data) => {
          running = false;
          emit.single(Effect.succeed(data));
        },
        (err) => {
          running = false;
          console.error("[DraftHelper] refresh failed", err);
          // Don't emit — keep last good state
        }
      );
    };

    const observer = new MutationObserver(handler);
    observer.observe(document.body, { childList: true, subtree: true });

    // Run once immediately
    handler();

    return () => observer.disconnect();
  }).pipe(
    Stream.debounce(150), // 150ms debounce prevents rapid re-renders
  );
```

**Key design decisions:**
- `appLayer` composes both services so they are provided to `refresh`
- `Stream.async` manages the MutationObserver lifecycle — cleanup on unsubscribe
- `running` flag prevents concurrent refreshes
- `.debounce(150)` handles rapid DOM mutations
- Errors are logged but don't crash the stream

### 2. `src/panels/App.tsx` — thin out to pure React

Remove all orchestration. Keep only state + rendering + the bridge to the Stream.

```typescript
import React, { useEffect, useState } from "react";
import type { RosterPick, Player } from "../content/types";
import { draftStream, type DraftData } from "../content/pipeline";
import CapitalChart from "./CapitalChart";
import OpponentsTable from "./OpponentsTable";

export default function App() {
  const [roster, setRoster] = useState<ReadonlyArray<RosterPick>>([]);
  const [available, setAvailable] = useState<ReadonlyArray<Player>>([]);
  const [loadCount, setLoadCount] = useState(0);
  const [userPickNumber, setUserPickNumber] = useState(1);
  const [useAdpCapital, setUseAdpCapital] = useState(false);

  useEffect(() => {
    const subscription = draftStream.pipe(
      Stream.runForEach((data: DraftData) =>
        Effect.sync(() => {
          setRoster(data.roster);
          setAvailable(data.available);
          setLoadCount((c) => c + 1);
        })
      )
    );

    const cancel = Effect.runFork(subscription);
    return () => cancel();
  }, []);

  // ... JSX stays identical (CapitalChart, OpponentsTable, inputs)
}
```

**What was removed from App.tsx:**
- `import { readRoster, readAvailablePlayers }` — moved to pipeline.ts
- `import { annotateStackTargets }` — moved to pipeline.ts
- `import { RosterCache }` — replaced by Layer
- `import { AdpStore }` — replaced by Layer
- `const adpStore = new AdpStore()` — replaced by Layer
- `refresh()` function — moved to pipeline.ts
- `observerRef` — replaced by Stream lifecycle
- `rosterCacheRef` — replaced by Layer
- `useEffect` body — now just subscribes to Stream

### 3. Create `src/hooks/useDraftStream.ts` (optional but clean)

If you want to extract the bridge pattern for reuse or clarity:

```typescript
import { useEffect, useState } from "react";
import { Effect, Stream } from "effect";
import { draftStream, type DraftData } from "../content/pipeline";

export function useDraftStream(): DraftData & { loadCount: number } {
  const [data, setData] = useState<DraftData & { loadCount: number }>({
    roster: [],
    available: [],
    loadCount: 0,
  });

  useEffect(() => {
    const sub = draftStream.pipe(
      Stream.runForEach((d) =>
        Effect.sync(() =>
          setData((prev) => ({
            ...d,
            loadCount: prev.loadCount + 1,
          }))
        )
      )
    );
    const cancel = Effect.runFork(sub);
    return () => cancel();
  }, []);

  return data;
}
```

Then App.tsx becomes:
```typescript
export default function App() {
  const { roster, available, loadCount } = useDraftStream();
  // ... just rendering
}
```

### 4. Cleanup: remove dead code

- `StackPanel.tsx` — it's imported but never rendered. Either wire it into `App.tsx` (add the calcStackTargets call and render it), or remove it and its import.
- `DraftState` interface in types.ts — unused. Either make it useful or remove it.
- The `console.log` calls in `dom-reader.ts` — already handled in Phase 3, but double-check there are no stragglers.

### 5. Update `src/panels/CapitalChart.tsx` if needed

If you changed `RosterPick[]` to `ReadonlyArray<RosterPick>` in types, the `indexOf` call on line 55 will need a small update:
```typescript
// Current: const rosterIndex = roster.indexOf(p);
// With ReadonlyArray, indexOf still works — no change needed unless you changed to ImmutableArray
```

### 6. Final verification

```bash
npx tsc --noEmit
npx vitest run
npx vite build
```

All three must pass cleanly.
