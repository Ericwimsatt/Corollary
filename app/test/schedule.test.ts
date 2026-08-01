import { describe, it, expect } from 'vitest';
import { Option } from 'effect';
import { getOpponents } from '../src/data/schedule';

describe('getOpponents', () => {
  it('returns opponents for weeks 15-17', () => {
    const opps = getOpponents('CIN');
    expect(Option.isSome(opps)).toBe(true);
    if (Option.isSome(opps)) {
      expect(opps.value.week15).toBe('CAR');
      expect(opps.value.week16).toBe('IND');
      expect(opps.value.week17).toBe('BAL');
    }
  });

  it('returns none for unknown team', () => {
    expect(Option.isNone(getOpponents('XXX'))).toBe(true);
  });
});
