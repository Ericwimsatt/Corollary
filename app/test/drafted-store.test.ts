import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';
import { DraftedStore, DraftedStoreLive } from '../src/content/drafted-store';

describe('DraftedStore', () => {
  it('deduplicates sources by canonical player identity and preserves richer fields', async () => {
    const result = await Effect.runPromise(Effect.gen(function*() {
      const store = yield* DraftedStore;
      yield* store.switchDraft('test:draft');
      yield* store.merge([{
        name: 'Marvin Harrison Jr.', position: 'WR', team: 'ARI',
        overallPick: 0, round: 0, pick: 0, draftSlot: null, draftTeam: null,
      }]);
      yield* store.merge([{
        name: 'Marvin Harrison', position: 'WR', team: 'ARI',
        overallPick: 9, round: 1, pick: 9, draftSlot: 9, draftTeam: 'Team 9',
      }]);
      return yield* store.getAll;
    }).pipe(Effect.provide(DraftedStoreLive)));

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({
      overallPick: 9,
      draftSlot: 9,
      draftTeam: 'Team 9',
      playerKey: 'marvin harrison::ARI::WR',
    }));
  });
});
