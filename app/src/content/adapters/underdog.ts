import { Effect } from "effect";
import type { DraftedPlayerObservation, Player, Position, RosterPick } from "../types";
import type { AvailablePlayerRow, DraftPlatformAdapter } from "./types";
import { findMatchingPlayer } from '../player-key';
import { underdogScoring } from "../../rankings/next-best-pick";

const TEAMS = 12;
const DRAFT_ID_PATTERN = /\/draft\/([^/?#]+)/;

interface RosterDetail {
  readonly name: string;
  readonly position: Position | null;
  readonly team: string;
  readonly byeWeek: number;
  readonly adp: number;
  readonly overallPick: number;
}

function draftCapital(pick: number): number {
  return Math.round(5000 * Math.exp(-Math.pow((pick - 1) / 52, 0.74)));
}

function parsePosition(text: string): Position | null {
  const match = text.trim().toUpperCase().match(/^(QB|RB|WR|TE)/);
  if (!match) return null;
  return match[1] as Position;
}

function parseNumber(text: string): number {
  const cleaned = text.trim().replace(/[^\d.]/g, '');
  return Number(cleaned) || 0;
}

function parseByeWeek(text: string): number {
  const match = text.match(/Bye\s+(\d+)/i);
  if (!match) return 0;

  const digits = match[1];
  const firstTwo = Number(digits.slice(0, 2));
  if (firstTwo >= 10 && firstTwo <= 18) return firstTwo;

  const firstOne = Number(digits.slice(0, 1));
  return firstOne >= 1 && firstOne <= 9 ? firstOne : 0;
}

function textWithoutHelperBadges(element: Element | null): string {
  if (!element) return '';
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('.dh-bye-count-badge, .dh-stack-badge, .dh-week17-badge, .dh-overlay-row').forEach((el) => el.remove());
  return clone.textContent ?? '';
}

function findAvailablePlayersBody(): Element | null {
  return (
    document.querySelector('[class*="leftColumnSection"] .ReactVirtualized__Grid__innerScrollContainer')
    ?? document.querySelector('[class*="playerListWrapper"] .ReactVirtualized__Grid__innerScrollContainer')
  );
}

function getAvailablePlayerRows(body: Element): ReadonlyArray<Element> {
  return Array.from(body.querySelectorAll('[data-testid="player-cell-wrapper"]'));
}

function parseAvailablePlayerRow(row: Element): AvailablePlayerRow | null {
  const nameEl = row.querySelector('[class*="playerName"]');
  const positionEl = row.querySelector('[class*="playerPosition"]');
  const positionBadge = positionEl?.querySelector('[class*="slotBadge"]');
  const teamEl = positionEl?.querySelector('[class*="matchText"]');
  const statCells = Array.from(row.querySelectorAll('[class*="statCell"]')) as HTMLElement[];

  const name = nameEl?.textContent?.trim() ?? '';
  const positionText = textWithoutHelperBadges(positionEl);
  const position = parsePosition(positionBadge?.textContent ?? positionText);
  const team = teamEl?.textContent?.trim() ?? '';
  const byeWeek = parseByeWeek(positionText);
  const myRankText = statCells[0]?.textContent?.trim() ?? '';
  const adp = parseNumber(statCells[1]?.textContent ?? '');
  const rank = parseInt(myRankText, 10) || Math.round(adp) || 0;
  const platformId = row.getAttribute('data-id')?.trim() ?? '';

  if (!name || !position || !team) return null;

  return {
    row,
    rankCell: statCells[0] ?? null,
    playerCell: row,
    detailsContainer: row.querySelector('[class*="playerInfo"]') as HTMLElement | null,
    annotationContainer: positionEl as HTMLElement | null,
    byeCell: positionEl as HTMLElement | null,
    byeNumber: positionEl as HTMLElement | null,
    byeNumberSpan: null,
    sourcePlayerId: platformId ? `underdog:${platformId}` : null,
    rank,
    name,
    position,
    team,
    adp,
    byeWeek,
  };
}

function parseRosterPickCell(cell: Element, index: number): RosterDetail | null {
  const name = cell.querySelector('[class*="playerNameRow"]')?.textContent?.trim() ?? '';
  const infoLine = cell.querySelector('[class*="infoLine"]')?.textContent?.trim() ?? '';
  const position = parsePosition(infoLine) ?? readActiveRosterTabPosition();
  const team = infoLine.slice(name.length).trim();
  const additional = cell.querySelector('[class*="additionalInfo"]')?.textContent ?? '';
  const byeMatch = additional.match(/(\d{1,2})\s*Bye/i);
  const adpMatch = additional.match(/Bye\s*([\d.]+)\s*ADP/i);
  const pickMatch = additional.match(/ADP\s*(\d{1,3})\s*Pick/i);

  if (!name || !team) return null;

  return {
    overallPick: pickMatch ? parseInt(pickMatch[1], 10) : index + 1,
    name,
    position,
    team,
    byeWeek: byeMatch ? parseInt(byeMatch[1], 10) : 0,
    adp: adpMatch ? parseFloat(adpMatch[1]) || 0 : 0,
  };
}

function readActiveRosterTabPosition(): Position | null {
  const tabs = Array.from(document.querySelectorAll('[class*="rightColumnSection"] button'));
  const selected = tabs.find((button) => /\bactive\b/i.test(button.className));
  const text = selected?.textContent?.trim() ?? '';
  return parsePosition(text);
}

function readRosterFromRightColumn(): RosterDetail[] {
  const cells = Array.from(document.querySelectorAll('[class*="rightColumnSection"] [class*="playerPickCell"]'));
  return cells
    .map((cell, index) => parseRosterPickCell(cell, index))
    .filter((pick): pick is RosterDetail => pick !== null);
}

function draftSlotForPick(overallPick: number): number {
  const round = Math.ceil(overallPick / TEAMS);
  const pickInRound = ((overallPick - 1) % TEAMS) + 1;
  return round % 2 === 1 ? pickInRound : TEAMS - pickInRound + 1;
}

function parseDraftBoardObservation(cell: Element): DraftedPlayerObservation | null {
  const roundPickText = cell.querySelector('[class*="roundAndPick"]')?.textContent ?? '';
  const overallPick = parseInt(roundPickText.split('|')[1] ?? '', 10) || 0;
  const name = cell.querySelector('[class*="pickName"]')?.textContent?.trim() ?? '';
  const posText = cell.querySelector('[class*="pickPos"]')?.textContent?.trim() ?? '';
  const position = parsePosition(posText);
  const team = posText.match(/-\s*([A-Z]{2,3})/)?.[1] ?? '';

  if (!overallPick || !name || !position || !team) return null;

  return {
    sourcePlayerId: null,
    round: Math.ceil(overallPick / TEAMS),
    pick: ((overallPick - 1) % TEAMS) + 1,
    overallPick,
    name,
    position,
    team,
    draftSlot: draftSlotForPick(overallPick),
    draftTeam: cell.querySelector('[class*="username"]')?.textContent?.trim() || null,
  };
}

function parseDraftBoardPick(cell: Element): RosterPick | null {
  const observation = parseDraftBoardObservation(cell);
  if (!observation) return null;
  return {
    sourcePlayerId: observation.sourcePlayerId ?? undefined,
    round: observation.round,
    pick: observation.pick,
    overallPick: observation.overallPick,
    name: observation.name,
    position: observation.position,
    team: observation.team,
    byeWeek: 0,
    adp: 0,
  };
}

function readDraftBoard(): ReadonlyArray<DraftedPlayerObservation> {
  return Array.from(document.querySelectorAll('[class*="draftingBar"] [class*="draftingCell"]'))
    .map(parseDraftBoardObservation)
    .filter((pick): pick is DraftedPlayerObservation => pick !== null);
}

function readRosterFromDraftBoard(): RosterPick[] {
  return Array.from(document.querySelectorAll('[class*="draftingCell"][class*="userCell"]'))
    .map(parseDraftBoardPick)
    .filter((pick): pick is RosterPick => pick !== null);
}

function readRoster(): ReadonlyArray<RosterPick> {
  const board = readRosterFromDraftBoard();
  const details = readRosterFromRightColumn();
  if (board.length === 0) {
    return details
      .filter((detail): detail is RosterDetail & { readonly position: Position } => detail.position !== null)
      .map((detail) => ({
        round: Math.ceil(detail.overallPick / TEAMS),
        pick: ((detail.overallPick - 1) % TEAMS) + 1,
        overallPick: detail.overallPick,
        name: detail.name,
        position: detail.position,
        team: detail.team,
        byeWeek: detail.byeWeek,
        adp: detail.adp,
      }));
  }

  return board.map((pick) => {
    const candidates = details.filter((candidate): candidate is RosterDetail & { readonly position: Position } =>
      candidate.position !== null
    );
    const detail = findMatchingPlayer(candidates, pick);
    return detail
      ? { ...pick, name: detail.name, byeWeek: detail.byeWeek, adp: detail.adp }
      : pick;
  });
}

function readPickNumberFromRightColumn(): number | null {
  const rightColumn = document.querySelector('[class*="rightColumnSection"]');
  const text = rightColumn?.textContent?.replace(/\s+/g, ' ') ?? '';
  const match = text.match(/(\d{1,2})\s*Pick position/i) ?? text.match(/Pick position\s*(\d{1,2})(?![\d.])/i);
  if (!match) return null;
  const pick = parseInt(match[1], 10);
  return pick >= 1 && pick <= TEAMS ? pick : null;
}

function readPickNumberFromDraftBoard(): number | null {
  const userCell = document.querySelector('[class*="draftingCell"][class*="userCell"]');
  const text = userCell?.textContent ?? '';
  const match = text.match(/(\d{1,2})\.\d{1,2}\|(\d{1,3})/);
  if (!match) return null;

  const overallPick = parseInt(match[2], 10);
  const pickInRound = ((overallPick - 1) % TEAMS) + 1;
  const round = Math.ceil(overallPick / TEAMS);
  return round % 2 === 1 ? pickInRound : TEAMS - pickInRound + 1;
}

const readRosterEffect: Effect.Effect<ReadonlyArray<RosterPick>> =
  Effect.sync(readRoster);

const readAvailablePlayers: Effect.Effect<ReadonlyArray<Player>> =
  Effect.sync(() => {
    const body = findAvailablePlayersBody();
    if (!body) return [];

    return getAvailablePlayerRows(body)
      .map(parseAvailablePlayerRow)
      .filter((row): row is AvailablePlayerRow => row !== null)
      .map((row) => ({
        sourcePlayerId: row.sourcePlayerId ?? undefined,
        rank: row.rank,
        name: row.name,
        position: row.position,
        team: row.team,
        adp: row.adp,
        byeWeek: row.byeWeek,
        isDrafted: false,
      }));
  });

const readUserPickNumber: Effect.Effect<number | null> =
  Effect.sync(() => readPickNumberFromRightColumn() ?? readPickNumberFromDraftBoard());

function isUserOnClock(): boolean {
  if (document.querySelector('[class*="draftingCell"][class*="userCell"][class*="onTheClock"]')) {
    return true;
  }
  const draftingBar = document.querySelector('[class*="draftingBarWrapper"]');
  const text = draftingBar?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return /(?:you(?:'re| are)?|your)\s+(?:are\s+)?(?:on the clock|turn|pick)\b/i.test(text);
}

export const underdogAdapter: DraftPlatformAdapter = {
  id: "underdog",
  label: "Underdog",
  teamCount: TEAMS,
  roundCount: 18,
  capitalCeilings: [
    { pos: ['QB'], label: 'QB', maxCapital: 2000 },
    { pos: ['RB'], label: 'RB', maxCapital: 8200 },
    { pos: ['WR'], label: 'WR', maxCapital: 11000 },
    { pos: ['TE'], label: 'TE', maxCapital: 2400 },
  ],
  draftCapital,
  scoring: underdogScoring,
  getDraftId: Effect.sync(() => {
    const match = window.location.pathname.match(DRAFT_ID_PATTERN);
    return match ? `underdog:${match[1]}` : `underdog:${window.location.hostname}${window.location.pathname}`;
  }),
  readRoster: readRosterEffect,
  readAvailablePlayers,
  draftedPlayerSources: [
    { id: 'live-panel', read: Effect.succeed([]) },
    { id: 'draft-board', read: Effect.sync(readDraftBoard) },
  ],
  readUserPickNumber,
  isUserOnClock,
  ui: {
    injectPageStyles: () => {
      document.querySelectorAll('[data-dh-platform-style="underdog"]').forEach((el) => el.remove());
      const style = document.createElement('style');
      style.dataset.dhPlatformStyle = 'underdog';
      style.textContent = `
        html,
        body {
          overflow-x: hidden !important;
          overflow-y: auto !important;
          max-width: 100vw !important;
          min-height: 100% !important;
          background: #0f0f0f !important;
        }
        #draft-helper-root,
        #draft-helper-root * {
          box-sizing: border-box !important;
        }
        #draft-helper-root {
          margin: 0 0 10px 0 !important;
          border-radius: 12px !important;
          overflow: visible !important;
          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
          align-self: start !important;
          grid-column: 1 / -1 !important;
          grid-row: 2 !important;
        }
        [class*="draftDetailsSectionDesktop"] {
          box-sizing: border-box !important;
          width: 100% !important;
          max-width: 100vw !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          padding-left: 12px !important;
          padding-right: 12px !important;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(0, clamp(320px, 28vw, 500px)) minmax(0, clamp(280px, 22vw, 380px)) !important;
          grid-template-rows: auto auto minmax(max(720px, calc(100vh - 180px)), auto) !important;
          height: auto !important;
          min-height: 100vh !important;
          column-gap: clamp(8px, 1vw, 16px) !important;
          row-gap: 12px !important;
          align-items: stretch !important;
          overflow-x: hidden !important;
          background: #0f0f0f !important;
        }
        [class*="draftingBarWrapper"] {
          grid-column: 1 / -1 !important;
          grid-row: 1 !important;
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
        }
        [class*="leftColumnSection"] {
          grid-column: 1 !important;
          grid-row: 3 !important;
          min-width: 0 !important;
          width: auto !important;
          max-width: 100% !important;
          overflow-x: hidden !important;
        }
        [class*="centerColumnSection"] {
          grid-column: 2 !important;
          grid-row: 3 !important;
          min-width: 0 !important;
          width: auto !important;
          max-width: 100% !important;
          overflow-x: hidden !important;
        }
        [class*="rightColumnSection"] {
          grid-column: 3 !important;
          grid-row: 3 !important;
          min-width: 0 !important;
          width: auto !important;
          max-width: 100% !important;
          overflow: visible !important;
        }
        [class*="playerListWrapper"],
        [class*="queueListWrapper"] {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
        }
      `;
      document.head.appendChild(style);
    },
    findMountPoint: () => (
      document.querySelector('[class*="draftDetailsSectionDesktop"]')
    ),
    placeMount: (host, mountPoint) => {
      const insertBefore = mountPoint.querySelector('[class*="leftColumnSection"]');
      if (insertBefore) {
        mountPoint.insertBefore(host, insertBefore);
        return;
      }
      mountPoint.prepend(host);
    },
    findAvailablePlayersBody,
    getAvailablePlayerRows,
    parseAvailablePlayerRow,
  },
};
