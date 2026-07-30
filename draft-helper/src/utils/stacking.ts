import { type Player, type RosterPick, type StackTarget } from '../content/types';
import { isFreeAgentTeam, isNflTeam, normalizeTeam } from './teams';

export function calcStackTargets(
  roster: RosterPick[],
  available: Player[]
): StackTarget[] {
  const rosteredSkill = roster.filter(
    (p) => (p.position === 'RB' || p.position === 'WR' || p.position === 'TE') && !isFreeAgentTeam(p.team)
  );

  const allPlayers: Player[] = [
    ...roster.map(toPlayer),
    ...available,
  ].filter((p) => isNflTeam(p.team));

  const targets: StackTarget[] = [];

  for (const rostered of rosteredSkill) {
    let team = normalizeTeam(rostered.team);

    if (!team) {
      team = guessTeam(rostered.name, allPlayers) ?? '';
    }

    if (!isNflTeam(team)) continue;

    const teamQb = allPlayers.find(
      (p) => p.position === 'QB' && normalizeTeam(p.team) === team
    );

    if (teamQb) {
      targets.push({
        qb: teamQb,
        rostered: { ...rostered, rank: 0, adp: 0, isDrafted: true, byeWeek: rostered.byeWeek },
        team,
        qbAdp: teamQb.adp,
      });
    }
  }

  targets.sort((a, b) => a.qbAdp - b.qbAdp);
  return targets;
}

function toPlayer(pick: RosterPick): Player {
  return {
    rank: 0,
    name: pick.name,
    position: pick.position,
    team: pick.team,
    adp: 0,
    byeWeek: pick.byeWeek,
    isDrafted: true,
  };
}

function guessTeam(playerName: string, allPlayers: Player[]): string | null {
  const nameParts = playerName.toLowerCase().split(/\s+/);

  for (const p of allPlayers) {
    const pLower = p.name.toLowerCase();
    const lastName = nameParts[nameParts.length - 1];
    if (lastName && pLower.endsWith(lastName)) return normalizeTeam(p.team);
  }

  for (const p of allPlayers) {
    const pLower = p.name.toLowerCase();
    const firstName = nameParts[0];
    if (firstName && (pLower.startsWith(firstName) || pLower.includes(firstName)))
      return normalizeTeam(p.team);
  }

  return null;
}
