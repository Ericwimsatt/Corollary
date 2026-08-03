import type { Position } from './types';
import { normalizeTeam } from '../utils/teams';

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

/**
 * A platform-independent identity for joining observations of the same player.
 * Full given names are deliberately retained: Brian Robinson and Bijan
 * Robinson (or Josh Allen and Kyle Allen) must never collapse to one record.
 */
export function normalizePlayerName(name: string): string {
  const parts = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.'’`]/g, '')
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  while (parts.length > 1 && NAME_SUFFIXES.has(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts.join(' ');
}

export function playerKey(player: {
  readonly sourcePlayerId?: string | null;
  readonly name: string;
  readonly team: string;
  readonly position: Position | string;
}): string {
  if (player.sourcePlayerId) return `id:${player.sourcePlayerId}`;
  return namePlayerKey(player);
}

export function namePlayerKey(player: {
  readonly name: string;
  readonly team: string;
  readonly position: Position | string;
}): string {
  return `${normalizePlayerName(player.name)}::${normalizeTeam(player.team)}::${player.position.toUpperCase()}`;
}

export function findMatchingPlayer<T extends {
  readonly sourcePlayerId?: string | null;
  readonly name: string;
  readonly team: string;
  readonly position: Position | string;
}>(players: ReadonlyArray<T>, target: {
  readonly sourcePlayerId?: string | null;
  readonly name: string;
  readonly team: string;
  readonly position: Position | string;
}): T | undefined {
  if (target.sourcePlayerId) {
    const byId = players.find(player => player.sourcePlayerId === target.sourcePlayerId);
    if (byId) return byId;
  }

  const exactKey = namePlayerKey(target);
  const exact = players.find(player => namePlayerKey(player) === exactKey);
  if (exact) return exact;

  const targetName = normalizePlayerName(target.name).split(' ');
  const matches = players.filter(player => {
    if (normalizeTeam(player.team) !== normalizeTeam(target.team)) return false;
    if (player.position.toUpperCase() !== target.position.toUpperCase()) return false;
    const candidateName = normalizePlayerName(player.name).split(' ');
    if (candidateName.length < 2 || targetName.length < 2) return false;
    const firstMatches = candidateName[0][0] === targetName[0][0];
    const lastMatches = candidateName[candidateName.length - 1] === targetName[targetName.length - 1];
    const oneIsAbbreviated = candidateName[0].length === 1 || targetName[0].length === 1;
    return firstMatches && lastMatches && oneIsAbbreviated;
  });
  return matches.length === 1 ? matches[0] : undefined;
}
