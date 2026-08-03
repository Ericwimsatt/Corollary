import { Effect } from "effect";
import type { DraftedPlayerObservation, Player, Position, RosterPick } from "../types";
import type { AvailablePlayerRow, DraftPlatformAdapter } from "./types";

const ACTIVE_USER = '[class*="UserCard_is-active-user"]';
const TEAMS = 12;
const DRAFT_ID_PATTERN = /\/draft\/snake\/(\d+)/;

function sourcePlayerIdFromImage(image: Element | null): string | null {
  const src = image?.getAttribute('src') ?? '';
  const match = src.match(/\/players\/\d+\/(\d+)\.(?:png|jpe?g|webp)(?:[?#]|$)/i);
  return match ? `draftkings:${match[1]}` : null;
}

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

function virtualRowIndex(row: Element, fallbackIndex: number): number {
  const attrIndex =
    row.getAttribute('data-row-index')
    ?? row.getAttribute('aria-rowindex')
    ?? row.getAttribute('data-index');
  const parsedAttr = attrIndex !== null ? parseInt(attrIndex, 10) : NaN;
  if (Number.isFinite(parsedAttr)) {
    if (row.getAttribute('aria-rowindex')) return Math.max(0, parsedAttr - 1);
    if (parsedAttr >= 0) return parsedAttr;
  }

  const htmlRow = row as HTMLElement;
  const transform = htmlRow.style.transform;
  const translateMatch = transform.match(/translate(?:3d|Y)?\([^,\d.-]*(-?\d+(?:\.\d+)?)px(?:,\s*(-?\d+(?:\.\d+)?)px)?/i);
  const translatedY = translateMatch
    ? parseFloat(translateMatch[2] ?? translateMatch[1])
    : NaN;
  const top = parseFloat(htmlRow.style.top);
  const offset = Number.isFinite(translatedY) ? translatedY : top;
  const height = htmlRow.offsetHeight || parseFloat(htmlRow.style.height);
  if (Number.isFinite(offset) && Number.isFinite(height) && height > 0) {
    return Math.max(0, Math.round(offset / height));
  }

  return fallbackIndex;
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
  const playerImage = playerCell?.querySelector('img[alt^="Headshot for"]') ?? null;
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
    annotationContainer: playerCell?.querySelector('.PlayerCell_player-details-container') as HTMLElement | null,
    byeCell: byeCell ?? null,
    byeNumber,
    byeNumberSpan,
    sourcePlayerId: sourcePlayerIdFromImage(playerImage),
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
    yield* Effect.logDebug("[Corollary] DraftKings readRoster");

    const containers = yield* Effect.sync(() =>
      document.querySelectorAll('[class*="RosterTable"]')
    );
    yield* Effect.logDebug(`Roster containers found: ${containers.length}`);

    const picks: RosterPick[] = [];
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

          const rosterIndex = virtualRowIndex(row, picks.length);
          const overallPick = rosterIndex + 1;
          picks.push({
            round: overallPick,
            pick: overallPick,
            overallPick,
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

function isUserOnClock(): boolean {
  const onClockText = document.querySelector(
    '[class*="PickOrder_pick-order__sticky-user-card-container"] [class*="UserCard_information-top"]',
  )?.textContent ?? '';
  const overallPick = parseInt(onClockText.match(/Pick\s+(\d+)/i)?.[1] ?? '', 10);
  const currentSlot = slotFromOverallPick(overallPick);
  if (currentSlot === null) return false;

  return Effect.runSync(readUserPickNumber) === currentSlot;
}

const readAvailablePlayers: Effect.Effect<ReadonlyArray<Player>> =
  Effect.gen(function*() {
    yield* Effect.logDebug("[Corollary] DraftKings readAvailablePlayers");
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
        ...(parsed.sourcePlayerId ? { sourcePlayerId: parsed.sourcePlayerId } : {}),
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

function readDraftTeam(column: Element): string | null {
  const summary = column.querySelector('[class*="UserPickSummaryCard_summary-card"]');
  if (!summary) return null;
  const candidate = Array.from(summary.children).find(child => {
    const className = typeof child.className === 'string' ? child.className : '';
    return !/avatar|position-summary/i.test(className) && (child.textContent?.trim() ?? '') !== '';
  });
  return candidate?.textContent?.trim() || null;
}

function parseDraftBoardCell(
  cell: Element,
  draftSlot: number,
  draftTeam: string | null,
): DraftedPlayerObservation | null {
  const overallPick = parseInt(cell.querySelector('[class*="CellHeader_pick-number"]')?.textContent ?? '', 10);
  const details = cell.querySelector('[class*="PlayerCell_player-details"]');
  const image = details?.querySelector('[class*="PlayerCell_player-thumbnail"]') ?? null;
  const imageAlt = image?.getAttribute('alt')?.trim() ?? '';
  const name = imageAlt.replace(/\s+icon$/i, '').trim()
    || details?.querySelector('[class*="PlayerCell_player-name"]')?.textContent?.trim()
    || '';
  const positionAndTeam = details?.querySelector('[class*="PlayerCell_position-and-team"]');
  const position = parsePosition(positionAndTeam?.children[0]?.textContent ?? '');
  const team = positionAndTeam?.querySelector('[class*="PlayerCell_team"]')?.textContent?.trim() ?? '';
  if (!Number.isFinite(overallPick) || overallPick < 1 || !name || !position || !team) return null;

  return {
    sourcePlayerId: sourcePlayerIdFromImage(image),
    name,
    position,
    team,
    overallPick,
    round: Math.ceil(overallPick / TEAMS),
    pick: ((overallPick - 1) % TEAMS) + 1,
    draftSlot,
    draftTeam,
  };
}

function readDraftBoard(): ReadonlyArray<DraftedPlayerObservation> {
  const board = document.querySelector('[class*="DraftBoard_draft-board"]');
  if (!board) return [];
  const columns = Array.from(board.querySelectorAll('[class*="DraftBoardColumn_draft-board-column"]'));
  return columns.flatMap((column, index) => {
    const draftTeam = readDraftTeam(column);
    return Array.from(column.children)
      .filter(child => typeof child.className === 'string' && child.className.includes('CellBase_draft-cell'))
      .map(cell => parseDraftBoardCell(cell, index + 1, draftTeam))
      .filter((event): event is DraftedPlayerObservation => event !== null);
  });
}

function readPickOrderTeam(draftSlot: number): string | null {
  const cards = Array.from(document.querySelectorAll('[class*="PickOrder_pick-order"] [class*="UserCard_user-card"]'));
  for (const card of cards) {
    const overall = parseInt(card.querySelector('[class*="UserCard_information-top"]')?.textContent?.match(/Pick\s+(\d+)/i)?.[1] ?? '', 10);
    if (slotFromOverallPick(overall) !== draftSlot) continue;
    const name = card.querySelector('[class*="UserCard_user-name"]')?.textContent?.trim();
    if (name) return name;
  }
  return null;
}

function readLatestPick(): ReadonlyArray<DraftedPlayerObservation> {
  const latest = document.querySelector('[class*="PickOrder_pick-order__last-drafted-player"]');
  const value = latest?.children[1]?.textContent?.trim() ?? '';
  const match = value.match(/^(.+?)\s*\|\s*(QB|RB|WR|TE)\s+([A-Z]{2,3})$/i);
  const onClockText = document.querySelector(
    '[class*="PickOrder_pick-order__sticky-user-card-container"] [class*="UserCard_information-top"]',
  )?.textContent ?? '';
  const nextOverallPick = parseInt(onClockText.match(/Pick\s+(\d+)/i)?.[1] ?? '', 10);
  const overallPick = nextOverallPick - 1;
  if (!match || overallPick < 1) return [];
  const draftSlot = slotFromOverallPick(overallPick);
  if (draftSlot === null) return [];

  return [{
    sourcePlayerId: null,
    name: match[1].trim(),
    position: match[2].toUpperCase() as Position,
    team: match[3].toUpperCase(),
    overallPick,
    round: Math.ceil(overallPick / TEAMS),
    pick: ((overallPick - 1) % TEAMS) + 1,
    draftSlot,
    draftTeam: readPickOrderTeam(draftSlot),
  }];
}

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
  draftedPlayerSources: [
    { id: 'live-panel', read: Effect.sync(readLatestPick) },
    { id: 'draft-board', read: Effect.sync(readDraftBoard) },
  ],
  readUserPickNumber,
  isUserOnClock,
  ui: {
    injectPageStyles: () => {
      document.querySelectorAll('[data-dh-platform-style="draftkings"]').forEach((el) => el.remove());
      const style = document.createElement('style');
      style.dataset.dhPlatformStyle = 'draftkings';
      style.textContent = `
        [class*="SnakeDraft_snake-draft-inner-container"] {
          max-width: min(100vw, 1440px) !important;
        }
        [class*="SnakeDraft_snake-draft-inner-container"]:has(
          #draft-helper-root[data-dh-pane="vertical"]
        ) {
          max-width: 100% !important;
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
        #draft-helper-root[data-dh-pane="horizontal"] {
          width: 100% !important;
          max-width: none !important;
          margin: 0 0 10px 0 !important;
          flex: 0 0 100% !important;
          align-self: stretch !important;
          grid-column: 1 / -1 !important;
          order: -1 !important;
        }
        [data-dh-draftkings-layout="horizontal"] {
          display: flex !important;
          flex-wrap: wrap !important;
          align-items: flex-start !important;
          gap: 0 12px !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        [data-dh-draftkings-layout="horizontal"] > [class*="LiveDraft_draft-table"] {
          flex: 1 1 min(880px, calc(100% - 332px)) !important;
          min-width: 640px !important;
        }
        [data-dh-draftkings-layout="horizontal"] > [class*="LiveDraft_queue"] {
          flex: 0 0 320px !important;
          min-width: 300px !important;
        }
        .LiveDraft_live-draft,
        .LiveDraft-Mobile_live-draft-mobile__body {
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: 100vw !important;
          padding: 0 16px !important;
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
