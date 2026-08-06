import type { Player, Position, RosterPick } from '../content/types';
import draftKingsCsv from '../../NFL DraftKings Best Ball Rankings (6).csv?raw';

export interface HelperScenario { id: string; label: string; pick: number; rosterNames: string[]; }

export interface DraftBoardEntry {
  overallPick: number;
  round: number;
  slot: number;
  player: Player;
  isUser: boolean;
  /** overallPick - adp. Positive = player fell; negative = reached. */
  adpDelta: number;
}

// Maximum picks a player can slide or be reached from their ADP, applied to
// every pick in the simulation (the user's roster and opponent picks alike).
const ADP_SLIPPAGE = 5;
const TEAM_COUNT = 12;

// The helper uses the checked-in DraftKings export as its source of truth.
// ETR Rank drives the production scorer's rank component; ADP drives market
// availability and draft timing. Scenario names are normalized for small
// formatting differences such as "St Brown" vs "St. Brown".
const board = parseDraftKingsBoard(draftKingsCsv);
const players = new Map(board.map((player) => [normalizeName(player.name), player]));

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseDraftKingsBoard(csv: string): Player[] {
  return csv.split(/\r?\n/).slice(1).flatMap((line) => {
    const columns = line.split(',').map((value) => value.replace(/^\uFEFF?"|"$/g, '').trim());
    const [name, position, team, rankText, adpText] = columns;
    if (!name || !isPosition(position)) return [];
    const rank = Number(rankText);
    const adp = Number(adpText);
    if (!Number.isFinite(rank) || !Number.isFinite(adp)) return [];
    return [{ name, position, team: team === 'LA' ? 'LAR' : team, rank, adp, byeWeek: 0, isDrafted: false } satisfies Player];
  });
}

function isPosition(value: string): value is Position {
  return value === 'QB' || value === 'RB' || value === 'WR' || value === 'TE';
}

function getPlayer(name: string): Player | undefined {
  return players.get(normalizeName(name));
}

const scenarioSeeds: Array<Omit<HelperScenario, 'id'> & { id: string }> = [
  { id: '01', label: '1.01 · first pick', pick: 1, rosterNames: ['Ja\'Marr Chase'] },
  { id: '01b', label: '1.12 · turn start', pick: 12, rosterNames: ['Malik Nabers'] },
  { id: '02', label: '2.04 · RB/WR start', pick: 4, rosterNames: ['CeeDee Lamb', 'De\'Von Achane'] },
  { id: '02b', label: '2.09 · elite WR + RB', pick: 9, rosterNames: ['Justin Jefferson', 'Derrick Henry'] },
  { id: '03', label: '3.02 · three-round core', pick: 2, rosterNames: ['Bijan Robinson', 'A.J. Brown', 'Chris Olave'] },
  { id: '03b', label: '3.11 · early TE', pick: 11, rosterNames: ['Malik Nabers', 'Jonathan Taylor', 'Trey McBride'] },
  { id: '04', label: '4.05 · balanced build', pick: 5, rosterNames: ['Amon-Ra St. Brown', 'Garrett Wilson', 'Tee Higgins', 'George Kittle'] },
  { id: '04b', label: '4.08 · RB / TE start', pick: 8, rosterNames: ['Breece Hall', 'Derrick Henry', 'Tee Higgins', 'George Kittle'] },
  { id: '05', label: '5.03 · first QB', pick: 3, rosterNames: ['Bijan Robinson', 'A.J. Brown', 'Chris Olave', 'James Cook', 'Deebo Samuel'] },
  { id: '05b', label: '5.10 · QB stack', pick: 10, rosterNames: ['Jahmyr Gibbs', 'Malik Nabers', 'Trey McBride', 'Kyler Murray', 'Rashee Rice'] },
  { id: '06', label: '6.01 · anchor + depth', pick: 1, rosterNames: ['Ja\'Marr Chase', 'A.J. Brown', 'Chris Olave', 'Deebo Samuel', 'George Kittle', 'Jaxon Smith-Njigba'] },
  { id: '06b', label: '6.07 · zero RB', pick: 7, rosterNames: ['Breece Hall', 'Derrick Henry', 'Nico Collins', 'Kyler Murray', 'Sam LaPorta', 'Zay Flowers'] },
  { id: '07', label: '7.04 · RB value pocket', pick: 4, rosterNames: ['CeeDee Lamb', 'De\'Von Achane', 'Chris Olave', 'James Cook', 'Sam LaPorta', 'Zay Flowers', 'Evan Engram'] },
  { id: '07b', label: '7.09 · stacked Lions', pick: 9, rosterNames: ['Justin Jefferson', 'Derrick Henry', 'Tee Higgins', 'George Kittle', 'Rachaad White', 'Mark Andrews', 'Jordan Love'] },
  { id: '08', label: '8.02 · QB decision', pick: 2, rosterNames: ['Bijan Robinson', 'A.J. Brown', 'Chris Olave', 'James Cook', 'Deebo Samuel', 'Jaxon Smith-Njigba', 'Evan Engram', 'Dak Prescott'] },
  { id: '08b', label: '8.11 · second TE', pick: 11, rosterNames: ['Malik Nabers', 'Jonathan Taylor', 'Trey McBride', 'Kyler Murray', 'Rashee Rice', 'Mark Andrews', 'Jordan Love', 'James Conner'] },
  { id: '09', label: '9.05 · late QB / WR', pick: 5, rosterNames: ['Amon-Ra St. Brown', 'Derrick Henry', 'Chris Olave', 'George Kittle', 'Sam LaPorta', 'Zay Flowers', 'Evan Engram', 'Courtland Sutton', 'George Pickens'] },
  { id: '09b', label: '9.08 · RB catch-up', pick: 8, rosterNames: ['Puka Nacua', 'Derrick Henry', 'Tee Higgins', 'George Kittle', 'Rachaad White', 'Mark Andrews', 'Jordan Love', 'Brian Thomas Jr.', 'Dallas Goedert'] },
  { id: '10', label: '10.03 · build the bench', pick: 3, rosterNames: ['Bijan Robinson', 'A.J. Brown', 'Chris Olave', 'James Cook', 'George Kittle', 'David Montgomery', 'Evan Engram', 'Courtland Sutton', 'Dak Prescott', 'Jake Ferguson'] },
  { id: '10b', label: '10.10 · loading on WR', pick: 10, rosterNames: ['Jahmyr Gibbs', 'Malik Nabers', 'Trey McBride', 'Kyler Murray', 'Rashee Rice', 'Mark Andrews', 'Jordan Love', 'Brian Thomas Jr.', 'Dallas Goedert', 'Tony Pollard'] },
  { id: '11', label: '11.04 · final starters', pick: 4, rosterNames: ['CeeDee Lamb', 'De\'Von Achane', 'Nico Collins', 'James Cook', 'Sam LaPorta', 'Zay Flowers', 'Evan Engram', 'Courtland Sutton', 'Dak Prescott', 'Jake Ferguson', 'Rome Odunze'] },
  { id: '11b', label: '11.09 · double stack', pick: 9, rosterNames: ['Ja\'Marr Chase', 'Joe Burrow', 'A.J. Brown', 'Tee Higgins', 'George Kittle', 'Zay Flowers', 'Mark Andrews', 'Tony Pollard', 'Baker Mayfield', 'Pat Freiermuth', 'Jaylen Waddle'] },
  { id: '12', label: '12.01 · deep QB room', pick: 1, rosterNames: ['Ja\'Marr Chase', 'A.J. Brown', 'Chris Olave', 'Deebo Samuel', 'George Kittle', 'Jaxon Smith-Njigba', 'Evan Engram', 'Dak Prescott', 'Jake Ferguson', 'Baker Mayfield', 'Chuba Hubbard', 'Rome Odunze'] },
  { id: '12b', label: '12.12 · final turn', pick: 12, rosterNames: ['Malik Nabers', 'Jonathan Taylor', 'Trey McBride', 'Deebo Samuel', 'Rashee Rice', 'Mark Andrews', 'Jordan Love', 'James Conner', 'Brock Purdy', 'Tony Pollard', 'Jordan Addison', 'Chuba Hubbard'] },
  { id: '13', label: '13.06 · endgame WR', pick: 6, rosterNames: ['Amon-Ra St. Brown', 'Garrett Wilson', 'Nico Collins', 'George Kittle', 'Sam LaPorta', 'Zay Flowers', 'Evan Engram', 'Courtland Sutton', 'George Pickens', 'Jake Ferguson', 'Rome Odunze', 'Chuba Hubbard', 'Pat Freiermuth'] },
];

export const scenarios: HelperScenario[] = scenarioSeeds.map(({ id, label, pick, rosterNames }) => ({ id, label, pick, rosterNames: rosterNames.filter((name) => getPlayer(name)) }));

export function getScenarioState(scenario: HelperScenario): { roster: RosterPick[]; available: Player[]; draftedByOthers: Player[]; draftBoard: DraftBoardEntry[] } {
  // Map each roster name to the user's slot in that round. Snake draft: odd
  // rounds go left→right (slot = position in round), even rounds go right→left
  // (slot = 12 - position + 1), matching how overall picks are numbered.
  const userSlots = scenario.rosterNames.map((name, index) => {
    const round = index + 1;
    const overallPick = round % 2 === 1 ? (round - 1) * TEAM_COUNT + scenario.pick : round * TEAM_COUNT - scenario.pick + 1;
    return { round, pick: scenario.pick, overallPick, intendedName: name };
  });

  // A pre-committed pick is "kept" only if the named player exists and would
  // still be on the board at that slot under the ±ADP_SLIPPAGE rule — i.e. the
  // slot is within 5 picks of the player's ADP in either direction. The user
  // never reaches more than 5 picks ahead of ADP, never slogs more than 5 picks
  // past it either. Kept picks are reserved so opponents won't poach them
  // before the user's slot; slots that can't be kept are redone by taking the
  // best remaining player within ±ADP_SLIPPAGE of that slot.
  const keepableNames = new Set<string>();
  for (const slot of userSlots) {
    const player = getPlayer(slot.intendedName);
    if (player && Math.abs(player.adp - slot.overallPick) <= ADP_SLIPPAGE) keepableNames.add(player.name);
  }

  const currentOverallPick = (userSlots.length + 1) * TEAM_COUNT - scenario.pick + 1;

  // Walk every pick in chronological order, resolving the user's slots inline so
  // a redone user pick sees the same board the opponents left behind it.
  const pool = [...players.values()].sort((a, b) => a.adp - b.adp);
  const taken = new Set<string>();
  const reserved = new Set(keepableNames);
  const draftedByOthers: Player[] = [];
  const draftBoard: DraftBoardEntry[] = [];
  const rosterByOverall = new Map<number, Player>();

  const pickBestWithinWindow = (overall: number): Player | undefined =>
    pool.find((player) =>
      !taken.has(player.name) &&
      !reserved.has(player.name) &&
      Math.abs(player.adp - overall) <= ADP_SLIPPAGE,
    ) ?? pool.find((player) => !taken.has(player.name) && !reserved.has(player.name));

  for (let overall = 1; overall < currentOverallPick; overall++) {
    const round = Math.floor((overall - 1) / TEAM_COUNT) + 1;
    const posInRound = (overall - 1) % TEAM_COUNT;
    const slot = round % 2 === 1 ? posInRound + 1 : TEAM_COUNT - posInRound;

    const nextSlot = userSlots.find((entry) => entry.overallPick === overall);
    if (nextSlot) {
      const keptPlayer = getPlayer(nextSlot.intendedName);
      let player: Player | undefined;
      if (keptPlayer && Math.abs(keptPlayer.adp - overall) <= ADP_SLIPPAGE && !taken.has(keptPlayer.name)) {
        player = keptPlayer;
      } else {
        player = pickBestWithinWindow(overall);
      }
      if (player) {
        taken.add(player.name);
        reserved.delete(player.name);
        rosterByOverall.set(overall, player);
        draftBoard.push({ overallPick: overall, round, slot, player, isUser: true, adpDelta: overall - player.adp });
      }
      continue;
    }

    const candidate = pickBestWithinWindow(overall);
    if (candidate) {
      taken.add(candidate.name);
      draftedByOthers.push(candidate);
      draftBoard.push({ overallPick: overall, round, slot, player: candidate, isUser: false, adpDelta: overall - candidate.adp });
    }
  }

  const roster: RosterPick[] = userSlots
    .map((slot): RosterPick | null => {
      const player = rosterByOverall.get(slot.overallPick);
      if (!player) return null;
      return {
        name: player.name,
        position: player.position,
        team: player.team,
        adp: player.adp,
        byeWeek: player.byeWeek,
        round: slot.round,
        pick: slot.pick,
        overallPick: slot.overallPick,
      };
    })
    .filter((entry): entry is RosterPick => entry !== null);

  const available = [...players.values()].filter((player) => !taken.has(player.name));
  return { roster, available, draftedByOthers, draftBoard };
}
