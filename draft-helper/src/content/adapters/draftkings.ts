import { Effect } from "effect";
import type { Player, Position, RosterPick } from "../types";
import type { AvailablePlayerRow, DraftPlatformAdapter } from "./types";

const ACTIVE_USER = '[class*="UserCard_is-active-user"]';
const TEAMS = 12;
const DRAFT_ID_PATTERN = /\/draft\/snake\/(\d+)/;

function parsePosition(text: string): Position | null {
  const p = text.trim().toUpperCase();
  if (p === 'QB' || p === 'RB' || p === 'WR' || p === 'TE') return p;
  return null;
}

function parseByeWeek(text: string): number {
  const m = text.trim().match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function slotFromOverallPick(overallPick: number): number | null {
  if (overallPick < 1) return null;

  const round = Math.ceil(overallPick / TEAMS);
  const pickInRound = ((overallPick - 1) % TEAMS) + 1;
  return round % 2 === 1 ? pickInRound : TEAMS - pickInRound + 1;
}

function draftCapital(pick: number): number {
  return Math.round(5000 * Math.exp(-Math.pow((pick - 1) / 57.5, 0.74)));
}

function findAvailablePlayersBody(): Element | null {
  const mobileSection = document.querySelector('.DraftablePlayersTable-Mobile_draftable-players');
  if (mobileSection) {
    const body = mobileSection.querySelector('.BaseTable__body');
    if (body) return body;
    const allTables = mobileSection.querySelectorAll('.BaseTable__body');
    return allTables[0] ?? null;
  }

  const desktopSection = document.querySelector('.LiveDraft_draftable-players');
  return desktopSection?.querySelector('.BaseTable__body') ?? null;
}

function parseAvailablePlayerRow(row: Element): AvailablePlayerRow | null {
  const cells = row.querySelectorAll('.BaseTable__row-cell');
  if (cells.length < 6) return null;

  const rankText = cells[1]?.textContent?.trim() ?? '0';
  const rank = parseInt(rankText, 10) || 0;
  const playerCell = cells[2] ?? null;
  const nameEl = playerCell?.querySelector('.PlayerCell_player-name');
  const posEl = playerCell?.querySelector('.player-position');
  const teamEl = playerCell?.querySelector('.PlayerCell_player-team div');
  const name = nameEl?.textContent?.trim() ?? '';
  const position = parsePosition(posEl?.textContent ?? '');
  const team = teamEl?.textContent?.trim() ?? '';
  if (!position || !name) return null;

  const adpSpan = cells[5]?.querySelector('.NumberCell_number-cell span');
  const adpText = adpSpan?.textContent?.trim() ?? '0';
  const adp = parseFloat(adpText) || 0;

  const byeCell = cells[4] as HTMLElement | undefined;
  const byeNumber = byeCell?.querySelector('.NumberCell_number-cell') as HTMLElement | null;
  const byeNumberSpan = byeNumber?.querySelector('span') as HTMLElement | null;
  const byeText = byeNumberSpan?.textContent?.trim() ?? '0';
  const byeWeek = parseByeWeek(byeText);

  return {
    row,
    rankCell: cells[1] as HTMLElement,
    playerCell,
    detailsContainer: playerCell?.querySelector('.PlayerCell_player-details-container') as HTMLElement | null,
    byeCell: byeCell ?? null,
    byeNumber,
    byeNumberSpan,
    rank,
    name,
    position,
    team,
    adp,
    byeWeek,
  };
}

const readRoster: Effect.Effect<ReadonlyArray<RosterPick>> =
  Effect.gen(function*() {
    yield* Effect.logDebug("[DraftHelper] DraftKings readRoster");

    const containers = yield* Effect.sync(() =>
      document.querySelectorAll('[class*="RosterTable"]')
    );
    yield* Effect.logDebug(`Roster containers found: ${containers.length}`);

    const picks: RosterPick[] = [];
    let pickNumber = 0;

    for (let ci = 0; ci < containers.length; ci++) {
      const container = containers[ci];
      const bodies = yield* Effect.sync(() =>
        container.querySelectorAll('.BaseTable__body')
      );

      for (let bi = 0; bi < bodies.length; bi++) {
        const body = bodies[bi];
        const rows = yield* Effect.sync(() => body.querySelectorAll('.BaseTable__row'));

        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
          const row = rows[rowIdx];
          const cells = yield* Effect.sync(() => row.querySelectorAll('.BaseTable__row-cell'));
          const cellsArr = Array.from(cells);
          const nameCell = cellsArr.find(c => c.querySelector('.PlayerCell_player-name'));
          let name: string;
          let position: Position | null;
          let team: string;
          let byeText: string;

          if (nameCell) {
            const posEl = nameCell.querySelector('.player-position');
            const nameEl = nameCell.querySelector('.PlayerCell_player-name');
            const teamEl = nameCell.querySelector('.PlayerCell_player-team div');
            position = posEl ? parsePosition(posEl.textContent ?? '') : null;
            name = nameEl?.textContent?.trim() ?? '';
            team = teamEl?.textContent?.trim() ?? '';

            const allNums = cellsArr.map(c => c.textContent?.trim() ?? '');
            const found = allNums.find(t => { const n = parseInt(t, 10); return n >= 1 && n <= 14; });
            byeText = found ?? '';
          } else if (cells.length >= 2) {
            position = parsePosition(cells[0]?.textContent?.trim() ?? '');
            name = cells[1]?.textContent?.trim() ?? '';
            team = '';
            const allNums = cellsArr.map(c => c.textContent?.trim() ?? '');
            const found = allNums.find(t => { const n = parseInt(t, 10); return n >= 1 && n <= 14; });
            byeText = found ?? '';
          } else {
            continue;
          }

          if (!position || !name) continue;

          pickNumber++;
          picks.push({
            round: 0,
            pick: 0,
            overallPick: pickNumber,
            name,
            position,
            team,
            byeWeek: parseByeWeek(byeText),
            adp: 0,
          });
        }
      }
    }

    yield* Effect.logDebug(`Parsed ${picks.length} roster picks total`);
    return picks;
  });

const readUserPickNumber: Effect.Effect<number | null> =
  Effect.sync(() => {
    const activeCard = document.querySelector(ACTIVE_USER);
    const teamLabel =
      activeCard
        ?.querySelector('[class*="UserCard_information-top"]')
        ?.textContent
        ?.trim()
      ?? activeCard?.textContent?.trim()
      ?? '';
    const teamMatch = teamLabel.match(/Team\s+(\d{1,2})(?!\d)/i);
    if (teamMatch) {
      const pick = parseInt(teamMatch[1], 10);
      return pick >= 1 && pick <= TEAMS ? pick : null;
    }

    const pickMatch = teamLabel.match(/Pick\s+(\d{1,3})(?!\d)/i);
    if (!pickMatch) return null;

    return slotFromOverallPick(parseInt(pickMatch[1], 10));
  });

const readAvailablePlayers: Effect.Effect<ReadonlyArray<Player>> =
  Effect.gen(function*() {
    yield* Effect.logDebug("[DraftHelper] DraftKings readAvailablePlayers");
    const body = yield* Effect.sync(findAvailablePlayersBody);

    if (!body) {
      yield* Effect.logDebug('No DraftKings available players body found');
      return [];
    }

    const rows = yield* Effect.sync(() => Array.from(body.querySelectorAll('.BaseTable__row')));
    const players: Player[] = [];

    for (const row of rows) {
      const parsed = parseAvailablePlayerRow(row);
      if (!parsed) continue;
      players.push({
        rank: parsed.rank,
        name: parsed.name,
        position: parsed.position,
        team: parsed.team,
        adp: parsed.adp,
        byeWeek: parsed.byeWeek,
        isDrafted: false,
      });
    }

    yield* Effect.logDebug(`Total players parsed: ${players.length}`);
    return players;
  });

export const draftKingsAdapter: DraftPlatformAdapter = {
  id: "draftkings",
  label: "DraftKings",
  teamCount: TEAMS,
  roundCount: 20,
  capitalCeilings: [
    { pos: ['QB'], label: 'QB', maxCapital: 3000 },
    { pos: ['RB'], label: 'RB', maxCapital: 9000 },
    { pos: ['WR'], label: 'WR', maxCapital: 13000 },
    { pos: ['TE'], label: 'TE', maxCapital: 3000 },
  ],
  draftCapital,
  getDraftId: Effect.sync(() => {
    const match = window.location.pathname.match(DRAFT_ID_PATTERN);
    return match ? `draftkings:${match[1]}` : 'draftkings:unknown';
  }),
  readRoster,
  readAvailablePlayers,
  readUserPickNumber,
  ui: {
    injectPageStyles: () => {
      const style = document.createElement('style');
      style.textContent = `
        [class*="SnakeDraft_snake-draft-inner-container"] {
          max-width: none !important;
        }
        #draft-helper-root {
          padding: 10px 12px 12px !important;
          margin: 10px 10px 12px 0 !important;
          background: var(--dh-shell, #dfe8ee) !important;
          border: 1px solid var(--dh-line-strong, #b6c5cf) !important;
          border-radius: 16px !important;
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--dh-panel, #ffffff) 70%, transparent),
            0 16px 34px rgba(16, 24, 32, 0.32) !important;
        }
        .LiveDraft_live-draft,
        .LiveDraft-Mobile_live-draft-mobile__body {
          padding: 0 24px !important;
        }
      `;
      document.head.appendChild(style);
    },
    findMountPoint: () => (
      document.querySelector('[class*="LiveDraft_queue"]')
      ?? document.querySelector('.LiveDraft-Mobile_live-draft-mobile__body')
      ?? document.querySelector('.LiveDraft_live-draft')
    ),
    placeMount: (host, mountPoint) => {
      const draftTable = document.querySelector('[class*="LiveDraft_draft-table"]');
      if (mountPoint.matches('[class*="LiveDraft_queue"]') && draftTable) {
        mountPoint.parentNode?.insertBefore(host, draftTable);
        return;
      }
      mountPoint.appendChild(host);
    },
    findAvailablePlayersBody,
    getAvailablePlayerRows: (body) => Array.from(body.querySelectorAll('.BaseTable__row')),
    parseAvailablePlayerRow,
  },
};
