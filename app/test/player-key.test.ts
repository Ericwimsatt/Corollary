import { describe, expect, it } from 'vitest';
import { normalizePlayerName, playerKey } from '../src/content/player-key';

describe('player identity', () => {
  it('matches suffix and punctuation variants', () => {
    expect(normalizePlayerName('Marvin Harrison Jr.')).toBe(normalizePlayerName('Marvin Harrison'));
    expect(normalizePlayerName("D'Andre Swift")).toBe(normalizePlayerName('DAndre Swift'));
  });

  it('does not collapse players who only share a surname, team, and position', () => {
    const brian = playerKey({ name: 'Brian Robinson Jr.', team: 'ATL', position: 'RB' });
    const bijan = playerKey({ name: 'Bijan Robinson', team: 'ATL', position: 'RB' });
    expect(brian).not.toBe(bijan);
  });

  it('does not collapse players who share a team and position', () => {
    const josh = playerKey({ name: 'Josh Allen', team: 'BUF', position: 'QB' });
    const kyle = playerKey({ name: 'Kyle Allen', team: 'BUF', position: 'QB' });
    expect(josh).not.toBe(kyle);
  });

  it('normalizes team aliases', () => {
    expect(playerKey({ name: 'Puka Nacua', team: 'LA', position: 'WR' }))
      .toBe(playerKey({ name: 'Puka Nacua', team: 'LAR', position: 'WR' }));
  });

  it('uses a stable source ID ahead of an abbreviated name', () => {
    expect(playerKey({
      sourcePlayerId: 'draftkings:693112', name: 'B. Robinson', team: 'ATL', position: 'RB',
    })).toBe('id:draftkings:693112');
    expect(playerKey({
      sourcePlayerId: 'draftkings:999999', name: 'B. Robinson', team: 'ATL', position: 'RB',
    })).not.toBe('id:draftkings:693112');
  });
});
