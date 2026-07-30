# Phase 1: Install Effect + Schema Types + Schedule Access

## Goal

Install Effect dependencies, replace plain interfaces with Effect Schema definitions, and wrap the schedule data access in Effect. The project should still compile and all existing tests must pass.

## Steps

### 1. Install dependencies

```bash
npm install effect @effect/schema
```

No need to install anything else — `vite` bundles all ESM deps.

### 2. Convert `src/content/types.ts` to Effect Schema

Replace the existing plain interfaces with Effect Schema definitions. Export both the `Schema` and the `Type` for backward compatibility so existing callers continue to compile.

**Pattern:**

```typescript
import { Schema } from "@effect/schema";

export const Position = Schema.Literal("QB", "RB", "WR", "TE");
export type Position = Schema.Schema.Type<typeof Position>;

export const Player = Schema.Struct({
  rank: Schema.Number,
  name: Schema.String,
  position: Position,
  team: Schema.String,
  adp: Schema.Number,
  byeWeek: Schema.Number,
  isDrafted: Schema.Boolean,
});
export type Player = Schema.Schema.Type<typeof Player>;

// Same pattern for RosterPick (14 fields)
// Same pattern for StackTarget (4 fields)
// Same pattern for DraftState (4 fields) — or remove it since it's unused
```

**Requirements:**
- Every field must be present — these are "trusted" schemas for now (you decode from data you control, not untrusted input), so no `Schema.optional` needed.
- Export both the Schema const and the Type alias so existing code still works.
- The `CachedRosterPick` interface in `roster-cache.ts` can stay as-is (internal to that module).

### 3. Wrap `src/data/schedule.ts` in Effect

Current:
```typescript
import scheduleData from './schedule.json';
const schedule = scheduleData as Record<string, OpponentRow>;
export function getOpponents(teamAbbr: string): OpponentRow | null {
  return schedule[teamAbbr] ?? null;
}
```

Target:
```typescript
import { Effect, Option } from "effect";
// keep the import + cast as-is, just wrap the function

export const getOpponents = (teamAbbr: string): Effect<never, never, Option<Option<OpponentRow>>> => {
  return Option.fromNullable(schedule[teamAbbr]);
};
```

Wait — simpler approach. Use `Option` but keep the return type compatible:

```typescript
import { Option } from "effect";

export const getOpponents = (team: string): Option<OpponentRow> =>
  Option.fromNullable(schedule[team]);
```

Then update the caller in `OpponentsTable.tsx`:

```typescript
import { Option } from "effect";

// inside component:
const opps = pick.team ? getOpponents(pick.team) : Option.none();

// rendering becomes:
<td style={styles.td}>{Option.isSome(opps) ? opps.value.week15 : '—'}</td>
```

Or even simpler — import `Option` and use `Option.match`:

```typescript
{Option.match(opps, {
  onNone: () => <td style={styles.td}>—</td>,
  onSome: (o) => <>
    <td style={styles.td}>{o.week15}</td>
    <td style={styles.td}>{o.week16}</td>
    <td style={styles.td}>{o.week17}</td>
  </>,
})}
```

### 4. Verify

```bash
npx tsc --noEmit
npx vitest run
```

Both must pass. The schedule test will need a small update since `getOpponents` now returns `Option<OpponentRow>` instead of `OpponentRow | null`.
