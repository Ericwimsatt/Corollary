import { describe, it, expect, beforeEach } from 'vitest';
import { Effect, Layer } from 'effect';
import { AvailableStore, AvailableStoreLive } from '../src/content/available-store';
import type { Player } from '../src/content/types';

function player(name: string, position: Player['position'], team: string, adp: number, rank = 0): Player {
  return { rank, name, position, team, adp, byeWeek: 0, isDrafted: false };
}

const DRAFT_A = 'draftkings:A';
const DRAFT_B = 'draftkings:B';

async function run<E>(effect: Effect.Effect<E, never, AvailableStore>) {
  return Effect.runPromise(effect.pipe(Effect.provide(AvailableStoreLive)));
}

beforeEach(() => {
  // The jsdom test environment doesn't provide chrome.storage or localStorage,
  // so there is nothing shared to clear. Each test gets a fresh AvailableStore
  // instance through `Effect.provide(AvailableStoreLive)`, which gives it
  // empty in-memory Refs; the persist path silently no-ops when neither
  // storage backend is available.
});

describe('AvailableStore', () => {
  it('merges incoming players with cached instead of replacing', async () => {
    const first = [player('Alpha', 'QB', 'DET', 50, 12)];
    const second = [player('Bravo', 'RB', 'GB', 30, 8)];

    await run(
      Effect.gen(function*() {
        const store = yield* AvailableStore;
        yield* store.load;
        yield* store.switchDraft(DRAFT_A);
        yield* store.merge(first);
        yield* store.merge(second);
        const all = yield* store.getAll;
        const names = all.map((p) => p.name).sort();
        expect(names).toEqual(['Alpha', 'Bravo']);
      }),
    );
  });

  it('ignores a second switchDraft to the same draft id', async () => {
    await run(
      Effect.gen(function*() {
        const store = yield* AvailableStore;
        yield* store.load;
        yield* store.switchDraft(DRAFT_A);
        yield* store.merge([player('Alpha', 'QB', 'DET', 50, 12)]);
        yield* store.switchDraft(DRAFT_A); // no-op
        const all = yield* store.getAll;
        expect(all).toHaveLength(1);
        expect(all[0].name).toBe('Alpha');
      }),
    );
  });

  it('retains the player catalog when the draft id changes', async () => {
    await run(
      Effect.gen(function*() {
        const store = yield* AvailableStore;
        yield* store.load;
        yield* store.switchDraft(DRAFT_A);
        yield* store.merge([player('Alpha', 'QB', 'DET', 50, 12)]);
        yield* store.switchDraft(DRAFT_B);
        const all = yield* store.getAll;
        expect(all).toHaveLength(1);
        expect(all[0].name).toBe('Alpha');
      }),
    );
  });

  it('removes drafted players', async () => {
    await run(
      Effect.gen(function*() {
        const store = yield* AvailableStore;
        yield* store.load;
        yield* store.switchDraft(DRAFT_A);
        yield* store.merge([
          player('Alpha', 'QB', 'DET', 50, 12),
          player('Bravo', 'RB', 'GB', 30, 8),
        ]);
        yield* store.excludeDrafted([
          { name: 'Alpha', team: 'DET', position: 'QB' },
        ]);
        const all = yield* store.getAll;
        expect(all).toHaveLength(1);
        expect(all[0].name).toBe('Bravo');
      }),
    );
  });

  it('removes a catalog player when the draft board omits its source ID', async () => {
    await run(
      Effect.gen(function*() {
        const store = yield* AvailableStore;
        yield* store.load;
        yield* store.switchDraft(DRAFT_A);
        yield* store.merge([{
          ...player('Bijan Robinson', 'RB', 'ATL', 2, 2),
          sourcePlayerId: 'underdog:bijan',
        }]);
        yield* store.excludeDrafted([{
          name: 'Bijan Robinson', team: 'ATL', position: 'RB',
        }]);
        expect(yield* store.getAll).toHaveLength(0);
      }),
    );
  });

  it('only excludes drafted players from the current draft', async () => {
    await run(
      Effect.gen(function*() {
        const store = yield* AvailableStore;
        yield* store.load;
        yield* store.switchDraft(DRAFT_A);
        yield* store.merge([player('Alpha', 'QB', 'DET', 50, 12)]);
        yield* store.excludeDrafted([{ name: 'Alpha', team: 'DET', position: 'QB' }]);
        expect(yield* store.getAll).toHaveLength(0);

        yield* store.switchDraft(DRAFT_B);
        const nextDraft = yield* store.getAll;
        expect(nextDraft).toHaveLength(1);
        expect(nextDraft[0].name).toBe('Alpha');
      }),
    );
  });

  it('survives live filters by retaining previously-seen players', async () => {
    // Simulate the user filtering the available table to WRs only.
    await run(
      Effect.gen(function*() {
        const store = yield* AvailableStore;
        yield* store.load;
        yield* store.switchDraft(DRAFT_A);

        yield* store.merge([
          player('Alpha', 'QB', 'DET', 50, 12),
          player('Bravo', 'RB', 'GB', 30, 8),
          player('Charlie', 'WR', 'MIN', 60, 10),
        ]);
        yield* store.merge([
          player('Charlie', 'WR', 'MIN', 60, 10), // now only WRs visible
        ]);
        const all = yield* store.getAll;
        expect(all.map((p) => p.name).sort()).toEqual(['Alpha', 'Bravo', 'Charlie']);
      }),
    );
  });

  it('refreshes stale rank/adp/byeWeek on a player when seen again', async () => {
    await run(
      Effect.gen(function*() {
        const store = yield* AvailableStore;
        yield* store.load;
        yield* store.switchDraft(DRAFT_A);

        yield* store.merge([player('Alpha', 'QB', 'DET', 50, 12)]);
        yield* store.merge([{
          ...player('Alpha', 'QB', 'DET', 50, 12),
          adp: 40,
          byeWeek: 7,
        }]);
        const all = yield* store.getAll;
        expect(all).toHaveLength(1);
        expect(all[0].adp).toBe(40);
        expect(all[0].byeWeek).toBe(7);
      }),
    );
  });

  it('normalizes team aliases when keying cached players', async () => {
    await run(
      Effect.gen(function*() {
        const store = yield* AvailableStore;
        yield* store.load;
        yield* store.switchDraft(DRAFT_A);
        yield* store.merge([player('Alpha', 'QB', 'LA', 50, 12)]); // LA -> LAR
        yield* store.merge([player('Alpha', 'QB', 'LAR', 50, 12)]);
        const all = yield* store.getAll;
        expect(all).toHaveLength(1);
      }),
    );
  });

  it('keeps abbreviated same-team players separate by stable source ID', async () => {
    await run(
      Effect.gen(function*() {
        const store = yield* AvailableStore;
        yield* store.load;
        yield* store.switchDraft(DRAFT_A);
        yield* store.merge([
          { ...player('B. Robinson', 'RB', 'ATL', 20, 10), sourcePlayerId: 'draftkings:bijan' },
          { ...player('B. Robinson', 'RB', 'ATL', 90, 80), sourcePlayerId: 'draftkings:brian' },
        ]);
        const all = yield* store.getAll;
        expect(all).toHaveLength(2);
        expect(new Set(all.map(entry => entry.sourcePlayerId))).toEqual(
          new Set(['draftkings:bijan', 'draftkings:brian']),
        );
      }),
    );
  });
});
