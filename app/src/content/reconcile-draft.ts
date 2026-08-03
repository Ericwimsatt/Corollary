import type { DraftedPlayer, Player, RosterPick } from './types';
import { normalizeTeam } from '../utils/teams';
import { findMatchingPlayer, playerKey } from './player-key';

/** Merge roster views while retaining pick data from the authoritative input. */
export function mergeRosters(
  authoritative: ReadonlyArray<RosterPick>,
  fallback: ReadonlyArray<RosterPick>,
): ReadonlyArray<RosterPick> {
  const merged = new Map<string, RosterPick>();
  for (const pick of authoritative) merged.set(playerKey(pick), pick);

  for (const pick of fallback) {
    const key = playerKey(pick);
    const existing = merged.get(key) ?? findMatchingPlayer(Array.from(merged.values()), pick);
    const existingKey = existing ? playerKey(existing) : key;
    if (!existing) {
      merged.set(key, pick);
    } else if (existing.byeWeek === 0 && pick.byeWeek !== 0) {
      merged.set(existingKey, { ...existing, byeWeek: pick.byeWeek });
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.overallPick - b.overallPick);
}

export function isUsersDraftSlot(
  event: DraftedPlayer,
  userPickNumber: number | null,
  teamCount: number,
): boolean {
  if (userPickNumber === null) return false;
  if (event.draftSlot !== null) return event.draftSlot === userPickNumber;
  const pickInRound = ((event.overallPick - 1) % teamCount) + 1;
  return event.round % 2 === 1
    ? pickInRound === userPickNumber
    : teamCount - pickInRound + 1 === userPickNumber;
}

export function rosterFromDraftEvents(
  events: ReadonlyArray<DraftedPlayer>,
  catalog: ReadonlyArray<Player>,
  userPickNumber: number | null,
  teamCount: number,
): RosterPick[] {
  const byKey = new Map(catalog.map(player => [playerKey(player), player]));
  return events
    .filter(event => isUsersDraftSlot(event, userPickNumber, teamCount))
    .map(event => {
      const details = byKey.get(playerKey(event)) ?? findMatchingPlayer(catalog, event);
      return {
        ...(event.sourcePlayerId ? { sourcePlayerId: event.sourcePlayerId } : {}),
        round: event.round,
        pick: event.pick,
        overallPick: event.overallPick,
        name: event.name,
        position: event.position,
        team: normalizeTeam(event.team),
        byeWeek: details?.byeWeek ?? 0,
        adp: details?.adp ?? 0,
      };
    });
}
