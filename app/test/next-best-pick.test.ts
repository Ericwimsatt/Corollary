import { describe, it, expect } from 'vitest';
import {
  rankNextBestPicks,
  buildPositionNeeds,
  SCORE_WEIGHTS,
  LATE_NEED_ENABLED_PICK,
  type PositionNeed,
} from '../src/rankings/next-best-pick';
import type { Player, RosterPick } from '../src/content/types';
import type { DraftPlatformAdapter } from '../src/content/adapters/types';
import { draftKingsAdapter } from '../src/content/adapters/draftkings';

function player(name: string, position: Player['position'], team: string, adp: number, rank = 0): Player {
  return { rank, name, position, team, adp, byeWeek: 0, isDrafted: false };
}

function need(pos: PositionNeed['position'], current: number, target: number): PositionNeed {
  return { position: pos, current, target };
}

const baseRoster: RosterPick[] = [];

describe('rankNextBestPicks', () => {
  it('returns no more than 15 picks', () => {
    const available = Array.from({ length: 50 }, (_, i) =>
      player(`P${i}`, 'RB', 'DET', i + 1, i + 1),
    );
    const scored = rankNextBestPicks({
      roster: baseRoster,
      available,
      customRankings: null,
      positionNeeds: [
        need('QB', 0, 3000),
        need('RB', 0, 9000),
        need('WR', 0, 13000),
        need('TE', 0, 3000),
      ],
    });
    expect(scored).toHaveLength(15);
  });

  it('only considers the next 30 players by ADP as candidates', () => {
    const available: Player[] = [];
    for (let i = 1; i <= 60; i++) {
      available.push(player(`P${i}`, 'RB', 'DET', i, i));
    }
    const scored = rankNextBestPicks({
      roster: baseRoster,
      available,
      customRankings: null,
      positionNeeds: [],
    });
    const adps = scored.map((s) => s.player.adp).sort((a, b) => a - b);
    expect(adps[0]).toBeGreaterThanOrEqual(1);
    expect(adps[adps.length - 1]).toBeLessThanOrEqual(30);
  });

  it('ranks a player with a better ADP-vs-rank value above an equal-ADP player', () => {
    const a = player('Stud RB', 'RB', 'DET', 30, 10); // my rank 10 << ADP 30 → big value
    const b = player('Fair RB', 'RB', 'GB', 30, 30); // my rank == ADP
    const scored = rankNextBestPicks({
      roster: baseRoster,
      available: [a, b],
      customRankings: null,
      positionNeeds: [],
    });
    expect(scored[0].player.name).toBe('Stud RB');
    expect(scored[0].breakdown.rank).toBeGreaterThan(0);
    expect(scored[1].breakdown.rank).toBe(0);
  });

  it('boosts positions behind target capital', () => {
    const rb = player('RB Needs Capital', 'RB', 'DET', 30, 30);
    const te = player('TE Already Filled', 'TE', 'DET', 30, 30);
    const scored = rankNextBestPicks({
      roster: baseRoster,
      available: [rb, te],
      customRankings: null,
      positionNeeds: [
        need('QB', 0, 3000),
        need('RB', 0, 9000),
        need('WR', 0, 13000),
        need('TE', 3000, 3000),
      ],
    });
    expect(scored[0].player.name).toBe('RB Needs Capital');
    expect(scored[0].breakdown.need).toBeGreaterThan(0);
    expect(scored[1].breakdown.need).toBeLessThanOrEqual(0);
  });

  it('penalizes positions where lots of capital is already spent', () => {
    const te = player('TE Already Heavy', 'TE', 'DET', 30, 30);
    const wr = player('WR Wide Open', 'WR', 'DET', 30, 30);
    const scored = rankNextBestPicks({
      roster: baseRoster,
      available: [te, wr],
      customRankings: null,
      positionNeeds: [
        need('QB', 0, 3000),
        need('RB', 0, 9000),
        need('WR', 0, 13000),
        need('TE', 5000, 3000),
      ],
    });
    expect(scored[0].player.name).toBe('WR Wide Open');
    expect(scored.find((s) => s.player.name === 'TE Already Heavy')!.breakdown.need).toBeLessThan(0);
  });

  it('gives a stack bonus when the candidate shares a team with a rostered QB', () => {
    const rosteredQb: RosterPick[] = [
      { round: 1, pick: 1, overallPick: 1, name: 'Joe Burrow', position: 'QB', team: 'CIN', byeWeek: 6, adp: 55 },
    ];
    const cincy = player('CIN WR', 'WR', 'CIN', 30, 30);
    const other = player('Other WR', 'WR', 'DET', 30, 30);
    const scored = rankNextBestPicks({
      roster: rosteredQb,
      available: [cincy, other],
      customRankings: null,
      positionNeeds: [],
    });
    expect(scored[0].player.name).toBe('CIN WR');
    expect(scored[0].breakdown.stack).toBeCloseTo(SCORE_WEIGHTS.stackAny + SCORE_WEIGHTS.stackQb);
    expect(scored[1].breakdown.stack).toBe(0);
  });

  it('gives a Week 17 bonus when the candidate faces a rostered player in Week 17', () => {
    // BAL travels to CIN in week 17 per schedule.json, so a BAL player should
    // get the week17 boost when a CIN player is rostered.
    const rostered: RosterPick[] = [
      { round: 1, pick: 1, overallPick: 1, name: 'Ja\'Marr Chase', position: 'WR', team: 'CIN', byeWeek: 6, adp: 5 },
    ];
    const bal = player('BAL WR', 'WR', 'BAL', 30, 30);
    const other = player('DET WR', 'WR', 'DET', 30, 30);
    const scored = rankNextBestPicks({
      roster: rostered,
      available: [bal, other],
      customRankings: null,
      positionNeeds: [],
    });
    expect(scored[0].player.name).toBe('BAL WR');
    expect(scored[0].breakdown.week17).toBe(1);
    expect(scored[1].breakdown.week17).toBe(0);
  });

  it('falls back to imported custom rankings when the available rank is missing', () => {
    const a = player('Mystery Player', 'RB', 'DET', 30, 0); // no platform rank
    const custom = [{ name: 'Mystery Player', position: 'RB', team: 'DET', rank: 5 }];
    const scored = rankNextBestPicks({
      roster: baseRoster,
      available: [a],
      customRankings: custom,
      positionNeeds: [],
    });
    expect(scored[0].myRank).toBe(5);
    expect(scored[0].breakdown.rank).toBeGreaterThan(0);
  });

  it('prefers the available table rank over imported custom rankings', () => {
    const a = player('Either Way', 'RB', 'DET', 30, 20); // platform rank wins
    const custom = [{ name: 'Either Way', position: 'RB', team: 'DET', rank: 5 }];
    const scored = rankNextBestPicks({
      roster: baseRoster,
      available: [a],
      customRankings: custom,
      positionNeeds: [],
    });
    expect(scored[0].myRank).toBe(20);
  });

  it('falls back to ADP when neither platform rank nor custom rank is present', () => {
    const a = player('Unknown', 'RB', 'DET', 42, 0);
    const scored = rankNextBestPicks({
      roster: baseRoster,
      available: [a],
      customRankings: null,
      positionNeeds: [],
    });
    expect(scored[0].myRank).toBe(42);
    expect(scored[0].breakdown.rank).toBe(0);
  });

  it('returns empty when no available players have ADP', () => {
    const scored = rankNextBestPicks({
      roster: baseRoster,
      available: [player('No ADP', 'RB', 'DET', 0, 0)],
      customRankings: null,
      positionNeeds: [],
    });
    expect(scored).toHaveLength(0);
  });

  it('gates positive QB need before the late-need pick and opens it after', () => {
    const earlyQb = player('Early QB', 'QB', 'DET', 30, 30);
    const earlyRb = player('Early RB', 'RB', 'DET', 30, 30);
    const earlyScored = rankNextBestPicks({
      roster: baseRoster,
      available: [earlyQb, earlyRb],
      customRankings: null,
      positionNeeds: [
        need('QB', 0, 3000),
        need('RB', 0, 9000),
        need('WR', 0, 13000),
        need('TE', 0, 3000),
      ],
      currentPick: 20,
    });
    expect(earlyScored.find((s) => s.player.name === 'Early QB')!.breakdown.need).toBe(0);

    const lateQb = player('Late QB', 'QB', 'DET', LATE_NEED_ENABLED_PICK + 10, LATE_NEED_ENABLED_PICK + 10);
    const lateRb = player('Late RB', 'RB', 'DET', LATE_NEED_ENABLED_PICK + 10, LATE_NEED_ENABLED_PICK + 10);
    const lateScored = rankNextBestPicks({
      roster: baseRoster,
      available: [lateQb, lateRb],
      customRankings: null,
      positionNeeds: [
        need('QB', 0, 3000),
        need('RB', 0, 9000),
        need('WR', 0, 13000),
        need('TE', 0, 3000),
      ],
      currentPick: LATE_NEED_ENABLED_PICK + 1,
    });
    expect(lateScored.find((s) => s.player.name === 'Late QB')!.breakdown.need).toBeGreaterThan(0);
    expect(lateRb.name).not.toBe(lateQb.name); // sanity
  });

  it('still punishes over-spent QB/TE need even before the late-need pick', () => {
    const qb = player('Heavy QB', 'QB', 'DET', 30, 30);
    const scored = rankNextBestPicks({
      roster: baseRoster,
      available: [qb],
      customRankings: null,
      positionNeeds: [need('QB', 5000, 3000)],
      currentPick: 10,
    });
    expect(scored[0].breakdown.need).toBeLessThan(0);
  });
});

describe('buildPositionNeeds', () => {
  it('produces per-position need using the adapter capital math', () => {
    const adapter = draftKingsAdapter as DraftPlatformAdapter;
    const roster: RosterPick[] = [
      { round: 1, pick: 1, overallPick: 1, name: 'Top RB', position: 'RB', team: 'DET', byeWeek: 9, adp: 1 },
    ];
    const needs = buildPositionNeeds(roster, adapter, 1);
    const rb = needs.find((n) => n.position === 'RB');
    expect(rb).toBeDefined();
    expect(rb!.current).toBeGreaterThan(0);
    expect(rb!.target).toBe(9000);
  });
});