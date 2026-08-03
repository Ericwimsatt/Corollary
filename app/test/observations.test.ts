import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';
import { readDraftObservations } from '../src/content/observations';
import type { DraftPlatformAdapter } from '../src/content/adapters';

describe('draft observations', () => {
  it('coalesces every drafted-player DOM source into the common input', async () => {
    const base = {
      name: 'Josh Allen', position: 'QB' as const, team: 'BUF',
      overallPick: 12, round: 1, pick: 12, draftSlot: 12, draftTeam: 'Team 12',
    };
    const adapter = {
      getDraftId: Effect.succeed('test:1'),
      readUserPickNumber: Effect.succeed(12),
      readRoster: Effect.succeed([]),
      readAvailablePlayers: Effect.succeed([]),
      isUserOnClock: () => true,
      draftedPlayerSources: [
        { id: 'live-panel', read: Effect.succeed([base]) },
        { id: 'draft-board', read: Effect.succeed([{ ...base, name: 'Bijan Robinson', position: 'RB' as const }]) },
      ],
    } as unknown as DraftPlatformAdapter;

    const observations = await Effect.runPromise(readDraftObservations(adapter));
    expect(observations.draftedPlayers.map(player => player.name)).toEqual([
      'Josh Allen',
      'Bijan Robinson',
    ]);
    expect(observations.isUserOnClock).toBe(true);
  });
});
