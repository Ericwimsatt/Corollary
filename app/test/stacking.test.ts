import { describe, it, expect } from 'vitest';
import { calcStackTargets } from '../src/utils/stacking';
import type { RosterPick, Player } from '../src/content/types';

describe('calcStackTargets', () => {
  it('suggests QB when WR/TE is rostered', () => {
    const roster: RosterPick[] = [
      { round: 1, pick: 3, name: 'Ja\'Marr Chase', position: 'WR', team: 'CIN', byeWeek: 6 },
    ];
    const available: Player[] = [
      { rank: 1, name: 'Joe Burrow', position: 'QB', team: 'CIN', adp: 55.6, byeWeek: 6, isDrafted: false },
    ];
    const targets = calcStackTargets(roster, available);
    expect(targets).toHaveLength(1);
    expect(targets[0].qb.name).toBe('Joe Burrow');
    expect(targets[0].rostered.name).toBe('Ja\'Marr Chase');
    expect(targets[0].team).toBe('CIN');
  });

  it('returns empty if no team QB available', () => {
    const roster: RosterPick[] = [
      { round: 1, pick: 3, name: 'Ja\'Marr Chase', position: 'WR', team: 'CIN', byeWeek: 6 },
    ];
    const available: Player[] = [
      { rank: 1, name: 'Josh Allen', position: 'QB', team: 'BUF', adp: 25.4, byeWeek: 7, isDrafted: false },
    ];
    expect(calcStackTargets(roster, available)).toHaveLength(0);
  });

  it('suggests QB when RB is rostered', () => {
    const roster: RosterPick[] = [
      { round: 1, pick: 3, name: 'Christian McCaffrey', position: 'RB', team: 'SF', byeWeek: 9 },
    ];
    const available: Player[] = [
      { rank: 1, name: 'Brock Purdy', position: 'QB', team: 'SF', adp: 80.2, byeWeek: 9, isDrafted: false },
    ];
    const targets = calcStackTargets(roster, available);
    expect(targets).toHaveLength(1);
    expect(targets[0].qb.name).toBe('Brock Purdy');
    expect(targets[0].rostered.name).toBe('Christian McCaffrey');
    expect(targets[0].team).toBe('SF');
  });

  it('sorts by ADP ascending', () => {
    const roster: RosterPick[] = [
      { round: 1, pick: 3, name: 'Ja\'Marr Chase', position: 'WR', team: 'CIN', byeWeek: 6 },
      { round: 2, pick: 4, name: 'Amon-Ra St. Brown', position: 'WR', team: 'DET', byeWeek: 6 },
    ];
    const available: Player[] = [
      { rank: 1, name: 'Jared Goff', position: 'QB', team: 'DET', adp: 102.8, byeWeek: 6, isDrafted: false },
      { rank: 2, name: 'Joe Burrow', position: 'QB', team: 'CIN', adp: 55.6, byeWeek: 6, isDrafted: false },
    ];
    const targets = calcStackTargets(roster, available);
    expect(targets).toHaveLength(2);
    expect(targets[0].qb.name).toBe('Joe Burrow');
    expect(targets[1].qb.name).toBe('Jared Goff');
  });

  it('ignores free agents when calculating stack targets', () => {
    const roster: RosterPick[] = [
      { round: 1, pick: 3, name: 'Unsigned Receiver', position: 'WR', team: 'FA', byeWeek: 0 },
      { round: 2, pick: 4, name: 'Ja\'Marr Chase', position: 'WR', team: 'CIN', byeWeek: 6 },
    ];
    const available: Player[] = [
      { rank: 1, name: 'Free Agent QB', position: 'QB', team: 'FA', adp: 12.3, byeWeek: 0, isDrafted: false },
      { rank: 2, name: 'Joe Burrow', position: 'QB', team: 'CIN', adp: 55.6, byeWeek: 6, isDrafted: false },
    ];
    const targets = calcStackTargets(roster, available);
    expect(targets).toHaveLength(1);
    expect(targets[0].qb.name).toBe('Joe Burrow');
    expect(targets[0].rostered.name).toBe('Ja\'Marr Chase');
  });
});
