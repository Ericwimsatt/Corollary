import { describe, expect, it } from 'vitest';
import type { DraftedPlayer, Player, RosterPick } from '../src/content/types';
import { mergeRosters, rosterFromDraftEvents } from '../src/content/reconcile-draft';
import { playerKey } from '../src/content/player-key';

function drafted(overrides: Partial<DraftedPlayer> = {}): DraftedPlayer {
  const base = {
    name: 'Josh Allen', position: 'QB' as const, team: 'BUF', overallPick: 12,
    round: 1, pick: 12, draftSlot: 12, draftTeam: 'Team 12',
  };
  return { ...base, ...overrides, playerKey: playerKey({ ...base, ...overrides }) };
}

describe('draft reconciliation', () => {
  it('infers the user roster from draft events and enriches it from the catalog', () => {
    const catalog: Player[] = [{
      rank: 1, name: 'Josh Allen', position: 'QB', team: 'BUF', adp: 25.2,
      byeWeek: 7, isDrafted: false,
    }];
    const roster = rosterFromDraftEvents([drafted()], catalog, 12, 12);
    expect(roster).toEqual([expect.objectContaining({
      name: 'Josh Allen', overallPick: 12, byeWeek: 7, adp: 25.2,
    })]);
  });

  it('derives a snake-draft slot when a source cannot read the team slot', () => {
    const roundTwoFirstOverall = drafted({
      overallPick: 13, round: 2, pick: 1, draftSlot: null,
    });
    expect(rosterFromDraftEvents([roundTwoFirstOverall], [], 12, 12)).toHaveLength(1);
  });

  it('keeps exact draft-event pick data over less precise roster DOM data', () => {
    const exact: RosterPick = {
      round: 4, pick: 5, overallPick: 41, name: 'Bijan Robinson',
      position: 'RB', team: 'ATL', byeWeek: 0, adp: 0,
    };
    const dom: RosterPick = { ...exact, round: 2, pick: 2, overallPick: 2, byeWeek: 12 };
    expect(mergeRosters([exact], [dom])).toEqual([
      expect.objectContaining({ overallPick: 41, round: 4, byeWeek: 12 }),
    ]);
  });

  it('does not double count a full board name and abbreviated roster name', () => {
    const board: RosterPick = {
      sourcePlayerId: 'draftkings:11370', round: 3, pick: 3, overallPick: 27,
      name: 'Josh Allen', position: 'QB', team: 'BUF', byeWeek: 7, adp: 25,
    };
    const rosterView: RosterPick = {
      round: 1, pick: 1, overallPick: 1,
      name: 'J. Allen', position: 'QB', team: 'BUF', byeWeek: 7, adp: 0,
    };

    const merged = mergeRosters([board], [rosterView]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(expect.objectContaining({
      name: 'Josh Allen', sourcePlayerId: 'draftkings:11370', overallPick: 27,
    }));
  });
});
