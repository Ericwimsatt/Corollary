import { Effect } from "effect";
import { type Player, type RosterPick, type Position } from './types';

const ACTIVE_USER = '[class*="UserCard_is-active-user"]';
const TEAMS = 12;

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

export const readRoster: Effect.Effect<ReadonlyArray<RosterPick>> =
  Effect.gen(function*() {
    yield* Effect.logDebug("[DraftHelper] readRoster");

    const containers = yield* Effect.sync(() =>
      document.querySelectorAll('[class*="RosterTable"]')
    );
    yield* Effect.logDebug(`Roster containers found: ${containers.length}`);
    for (let ci = 0; ci < containers.length; ci++) {
      yield* Effect.logDebug(`  [${ci}]: class="${containers[ci].className}"`);
    }

    const picks: RosterPick[] = [];
    let pickNumber = 0;

    for (let ci = 0; ci < containers.length; ci++) {
      const container = containers[ci];
      const bodies = yield* Effect.sync(() =>
        container.querySelectorAll('.BaseTable__body')
      );
      yield* Effect.logDebug(`  Container [${ci}] BaseTable__body count: ${bodies.length}`);
      if (bodies.length === 0) {
        yield* Effect.logDebug(`  Container [${ci}] innerHTML (first 300): ${container.innerHTML.slice(0, 300)}`);
      }

      for (let bi = 0; bi < bodies.length; bi++) {
        const body = bodies[bi];
        const rows = yield* Effect.sync(() => body.querySelectorAll('.BaseTable__row'));
        yield* Effect.logDebug(`  Body [${ci}][${bi}] row count: ${rows.length}`);

        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
          const row = rows[rowIdx];
          const cells = yield* Effect.sync(() => row.querySelectorAll('.BaseTable__row-cell'));
          yield* Effect.logDebug(`  Row [${ci}][${bi}][${rowIdx}]: ${cells.length} cells`);
          for (let j = 0; j < cells.length; j++) {
            yield* Effect.logDebug(`    cell[${j}]: "${(cells[j].textContent ?? '').trim().slice(0, 50)}"`);
          }

          const cellsArr = Array.from(cells);
          const nameCell = cellsArr.find(c => c.querySelector('.PlayerCell_player-name'));
          let name: string, position: Position | null, team: string, byeText: string;

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
            yield* Effect.logDebug(`    PlayerCell format: pos="${position}" name="${name}" team="${team}" bye="${byeText}"`);
          } else if (cells.length >= 2) {
            position = parsePosition(cells[0]?.textContent?.trim() ?? '');
            name = cells[1]?.textContent?.trim() ?? '';
            team = '';
            const allNums = cellsArr.map(c => c.textContent?.trim() ?? '');
            const found = allNums.find(t => { const n = parseInt(t, 10); return n >= 1 && n <= 14; });
            byeText = found ?? '';
            yield* Effect.logDebug(`    Simple format: pos="${position}" name="${name}" team="${team}" bye="${byeText}"`);
          } else {
            yield* Effect.logDebug(`    Unrecognized row format — skipping`);
            continue;
          }

          if (!position || !name) {
            yield* Effect.logDebug(`    Missing position or name — skipping`);
            continue;
          }

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

export const readUserPickNumber: Effect.Effect<number | null> =
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

export const readAvailablePlayers: Effect.Effect<ReadonlyArray<Player>> =
  Effect.gen(function*() {
    yield* Effect.logDebug("[DraftHelper] readAvailablePlayers");

    const mobileSection = yield* Effect.sync(() =>
      document.querySelector('.DraftablePlayersTable-Mobile_draftable-players')
    );
    yield* Effect.logDebug('Mobile section (.DraftablePlayersTable-Mobile_draftable-players):', !!mobileSection);

    const desktopSection = yield* Effect.sync(() =>
      document.querySelector('.LiveDraft_draftable-players')
    );
    yield* Effect.logDebug('Desktop section (.LiveDraft_draftable-players):', !!desktopSection);

    let body: Element | null = null;

    if (mobileSection) {
      yield* Effect.logDebug('Using mobile path');
      body = yield* Effect.sync(() =>
        mobileSection.querySelector('.BaseTable__body')
      );
      yield* Effect.logDebug('BaseTable__body under mobile section:', !!body);
      if (!body) {
        const allTables = yield* Effect.sync(() =>
          mobileSection.querySelectorAll('.BaseTable__body')
        );
        yield* Effect.logDebug(`All .BaseTable__body under mobile: ${allTables.length}`);
        body = allTables[0] ?? null;
      }
    } else if (desktopSection) {
      yield* Effect.logDebug('Using desktop path');
      body = yield* Effect.sync(() =>
        desktopSection.querySelector('.BaseTable__body')
      );
    } else {
      const allPlayers = yield* Effect.sync(() =>
        document.querySelectorAll('[class*="draftable-player"]')
      );
      yield* Effect.logDebug(`Fallback: [class*="draftable-player"]: ${allPlayers.length}`);
      for (let i = 0; i < allPlayers.length; i++) {
        yield* Effect.logDebug(`  [${i}]: ${allPlayers[i].className}`);
      }
    }

    if (!body) {
      yield* Effect.logDebug('No body found — dumping all BaseTable__body elements:');
      const allBodies = yield* Effect.sync(() => document.querySelectorAll('.BaseTable__body'));
      for (let i = 0; i < allBodies.length; i++) {
        yield* Effect.logDebug(`  [${i}]: parent className="${allBodies[i].parentElement?.className}"`);
      }
      return [];
    }

    const allRows = yield* Effect.sync(() => body.querySelectorAll('.BaseTable__row'));
    yield* Effect.logDebug(`BaseTable__row count: ${allRows.length}`);

    if (allRows.length === 0) {
      const allChildren = yield* Effect.sync(() => body.children);
      yield* Effect.logDebug(`Body children count: ${allChildren.length}`);
      for (let i = 0; i < allChildren.length; i++) {
        yield* Effect.logDebug(`  child[${i}]: tag=${allChildren[i].tagName} class="${allChildren[i].className}" html=${allChildren[i].innerHTML.slice(0, 100)}`);
      }
    }

    const players: Player[] = [];

    for (let rowIdx = 0; rowIdx < allRows.length; rowIdx++) {
      const row = allRows[rowIdx];
      const cells = yield* Effect.sync(() => row.querySelectorAll('.BaseTable__row-cell'));
      yield* Effect.logDebug(`Row ${rowIdx}: ${cells.length} cells`);
      if (cells.length < 6) {
        for (let j = 0; j < cells.length; j++) {
          const cellContent = cells[j].textContent?.trim() ?? '';
          yield* Effect.logDebug(`  cell[${j}]: class="${cells[j].className}" text="${cellContent.slice(0, 30)}"`);
        }
        continue;
      }

      for (let j = 0; j < cells.length; j++) {
        const cellContent = cells[j].textContent?.trim() ?? '';
        yield* Effect.logDebug(`  cell[${j}]: text="${cellContent.slice(0, 30)}" html="${cells[j].innerHTML.slice(0, 80)}"`);
      }

      const nameEl = cells[2]?.querySelector('.PlayerCell_player-name');
      const posEl = cells[2]?.querySelector('.player-position');
      const teamEl = cells[2]?.querySelector('.PlayerCell_player-team div');

      yield* Effect.logDebug(`  nameEl: ${!!nameEl}, posEl: ${!!posEl}, teamEl: ${!!teamEl}`);

      if (nameEl) yield* Effect.logDebug(`  nameEl text: "${nameEl.textContent?.trim()}"`);
      if (posEl) yield* Effect.logDebug(`  posEl text: "${posEl.textContent?.trim()}"`);
      if (teamEl) yield* Effect.logDebug(`  teamEl text: "${teamEl.textContent?.trim()}"`);

      const rankText = cells[1]?.textContent?.trim() ?? '0';
      const rank = parseInt(rankText, 10) || 0;

      const name = nameEl?.textContent?.trim() ?? '';
      const posText = posEl?.textContent?.trim() ?? '';
      const team = teamEl?.textContent?.trim() ?? '';

      const position = parsePosition(posText);
      if (!position || !name) {
        yield* Effect.logDebug(`  SKIPPED: position=${!!position} name="${name}"`);
        continue;
      }

      const adpSpan = cells[5]?.querySelector('.NumberCell_number-cell span');
      const adpText = adpSpan?.textContent?.trim() ?? '0';
      const adp = parseFloat(adpText) || 0;
      yield* Effect.logDebug(`  ADP span found: ${!!adpSpan}, value: "${adpText}" -> ${adp}`);

      const byeSpan = cells[4]?.querySelector('.NumberCell_number-cell span');
      const byeText = byeSpan?.textContent?.trim() ?? '0';
      const byeWeek = parseByeWeek(byeText);

      players.push({ rank, name, position, team, adp, byeWeek, isDrafted: false });
      yield* Effect.logDebug(`  PUSHED: rank=${rank} name="${name}" pos=${position} team="${team}" adp=${adp}`);
    }

    yield* Effect.logDebug(`Total players parsed: ${players.length}`);
    return players;
  });

export const isUserOnClock: Effect.Effect<boolean> =
  Effect.sync(() => !!document.querySelector(ACTIVE_USER));
