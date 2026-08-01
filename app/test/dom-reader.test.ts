import { describe, it, expect, beforeEach } from 'vitest';
import { Effect } from 'effect';
import { setupDraftPage } from './fixtures/setup';
import { draftKingsAdapter } from '../src/content/adapters';

function run<A>(eff: Effect.Effect<A>): A {
  return Effect.runSync(eff);
}

describe('readRoster', () => {
  beforeEach(() => {
    setupDraftPage();
  });

  it('reads roster rows', () => {
    const roster = run(draftKingsAdapter.readRoster);
    expect(roster).toHaveLength(1);
    expect(roster[0].name).toBe('Ja\'Marr Chase');
    expect(roster[0].position).toBe('WR');
    expect(roster[0].byeWeek).toBe(6);
    expect(roster[0].overallPick).toBe(1);
  });
});

describe('readAvailablePlayers', () => {
  beforeEach(() => {
    setupDraftPage();
  });

  it('reads available players with ADP', () => {
    const players = run(draftKingsAdapter.readAvailablePlayers);
    expect(players.length).toBeGreaterThanOrEqual(4);
    const allen = players.find((p) => p.name === 'Josh Allen');
    expect(allen).toBeDefined();
    expect(allen!.position).toBe('QB');
    expect(allen!.team).toBe('BUF');
    expect(allen!.adp).toBe(25.4);
  });

  it('parses ADP as float', () => {
    const players = run(draftKingsAdapter.readAvailablePlayers);
    const chase = players.find((p) => p.name === 'Ja\'Marr Chase');
    expect(chase!.adp).toBe(3.0);
  });
});
