# Phase 3: DOM Reader + Stack Annotator + Stacking Utils as Effect

## Goal

Wrap the impure DOM scraping and DOM mutation functions in `Effect`, replacing `console.log` with `Effect.log` and null-checks with `Option`.

## Files to modify

### 1. `src/content/dom-reader.ts` — wrap in Effect

**Changes:**
- Each exported function returns `Effect<never, DomParseError, ...>` instead of a bare value
- Replace all `console.log(...)` with `Effect.logDebug(...)`, `Effect.logInfo(...)`, etc.
- Replace null returns with `Effect.fail(DomParseError)`
- Keep the DOM traversal logic identical — we're only wrapping, not rewriting the scraping

**Define a shared error type at the top:**
```typescript
class DomParseError {
  readonly _tag = "DomParseError";
  constructor(readonly context: string, readonly detail?: string) {}
}
```

**Pattern for each function:**

```typescript
export const readRoster = Effect.gen(function*() {
  yield* Effect.logDebug("[DraftHelper] readRoster");

  const containers = document.querySelectorAll('[class*="RosterTable"]');
  // ... same logic, but wrap each console.log with Effect.logDebug

  // Instead of returning bare array, wrap in Effect.succeed
  return picks;
}).pipe(
  Effect.catchAllDefect((defect) =>
    Effect.fail(new DomParseError("readRoster", String(defect)))
  ),
);
```

**Specific guidelines:**
- `console.group()` / `console.groupEnd()` → replace with `Effect.logDebug(...)` blocks. There is no direct Effect equivalent of group, so just use sequential logs with a clear prefix.
- `console.log(...)` → `Effect.logDebug(...)` (or `Effect.logInfo` for important things)
- Early returns like `return []` → `Effect.fail(new DomParseError("readRoster", "body not found"))`
- `console.warn/error` → `Effect.logWarn` / `Effect.logError`
- The `readRoster`, `readAvailablePlayers`, and `isUserOnClock` functions should all be wrapped

**Important:** This is purely a mechanical wrapping. Do NOT change the DOM query logic, selectors, or parsing strategy — only wrap in Effect and update return types.

### 2. `src/content/stack-annotator.ts` — wrap in Effect

Same pattern. Currently all DOM queries are side-effectful and `console.log` is sprinkled throughout.

```typescript
export const annotateStackTargets = (
  roster: ReadonlyArray<RosterPick>,
  available: ReadonlyArray<Player>
): Effect<never, DomMutationError, void> =>
  Effect.gen(function*() {
    yield* Effect.sync(() => {
      document.querySelectorAll(".dh-stack-badge").forEach((el) => el.remove());
    });

    // ... rest of the logic wrapped in Effect.sync where needed
  });
```

**Define a `DomMutationError`:**
```typescript
class DomMutationError {
  readonly _tag = "DomMutationError";
  constructor(readonly context: string) {}
}
```

Wrap all `document.querySelector` calls in `Effect.sync` (they're synchronous but impure). Where you find the table body, use `Option.fromNullable`:

```typescript
const body = Option.fromNullable(
  mobileSection?.querySelector('.BaseTable__body')
    ?? desktopSection?.querySelector('.BaseTable__body')
    ?? null
);

if (Option.isNone(body)) {
  yield* Effect.logDebug("[DraftHelper] No available players table body found for stack annotations");
  return;
}
```

### 3. `src/utils/stacking.ts` — wrap in Effect

This one is mostly pure already. The `guessTeam` function has a fallback loop that can be expressed more idiomatically with `Option` + `Stream.findFirst` or just `Option.fromNullable`:

```typescript
import { Option, Effect } from "effect";

// Instead of:
//   for (const p of allPlayers) {
//     if (lastName && pLower.endsWith(lastName)) return p.team;
//   }

// Use:
const byLastName = Option.fromNullable(
  allPlayers.find((p) =>
    lastName && p.name.toLowerCase().endsWith(lastName)
  )?.team ?? null
);
```

**Changes:**
- `calcStackTargets` can stay as a pure function (it only uses `Array.filter`/`Array.sort`/`Array.find`) — no Effect needed
- `guessTeam` — replace the two for-loops with `Option.fromNullable` + `Array.find`. This makes the fallback explicit and the `null` return type becomes `Option<string>`. Or leave it as-is since it's purely internal and already correct.

Actually, `calcStackTargets` is already pure. The only change needed is making `guessTeam` return `Option<string>` instead of `string | null` for consistency.

### 4. Update tests in `test/` to work with new types

The tests in `test/dom-reader.test.ts`, `test/stacking.test.ts` will need minimal updates:
- If functions now return `Effect`, wrap test assertions with `Effect.runSync` or use `@effect/vitest` helpers
- The test fixture setup in `test/fixtures/setup.ts` should remain unchanged

**For vitest with Effect, you have two options:**
1. (Simple) Call `Effect.runSync(fn())` in the test body
2. (Clean) Use `@effect/vitest` which provides an `it.effect` helper

Either approach is fine. Option 1 is simpler with fewer deps.

Example test update:
```typescript
// Before:
expect(readRoster()).toHaveLength(1);

// After:
expect(Effect.runSync(readRoster())).toHaveLength(1);
```

### 5. Verification

```bash
npx tsc --noEmit
npx vitest run
```

Both must pass.
