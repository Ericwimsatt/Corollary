const TEAMS = 12;

export function adpToRound(adp: number): number {
  return Math.ceil(adp / TEAMS);
}
