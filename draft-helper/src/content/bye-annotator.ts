import { Effect } from "effect";
import type { Player, Position, RosterPick } from './types';
import { attachOverlayTooltip, createOverlayTooltip } from './overlay-tooltip';

function colorForByeCount(count: number): string {
  if (count === 0) return '#168a52';
  if (count === 1) return '#101820';
  return '#c24132';
}

function badgeStyle(count: number): string {
  const color = colorForByeCount(count);
  return [
    'display:inline-flex',
    'align-items:center',
    'margin-left:5px',
    'padding:1px 5px',
    'border-radius:6px',
    `border:1px solid ${color}`,
    'background:#fff',
    `color:${color}`,
    'font-size:10px',
    'font-weight:900',
    'line-height:14px',
    'white-space:nowrap',
    'font-variant-numeric:tabular-nums',
    'box-shadow:0 1px 2px rgba(16,24,32,.12)',
  ].join(';');
}

function playerKey(player: Pick<Player, 'name' | 'team' | 'position'>): string {
  return `${player.name}::${player.team}::${player.position}`;
}

function availableByes(available: ReadonlyArray<Player>): Map<string, number> {
  const byes = new Map<string, number>();
  for (const player of available) {
    if (player.byeWeek !== 0) {
      byes.set(playerKey(player), player.byeWeek);
    }
  }
  return byes;
}

function buildRosterIndex(roster: ReadonlyArray<RosterPick>) {
  const index = new Map<string, string[]>();
  for (const pick of roster) {
    const key = `${pick.position}::${pick.byeWeek}`;
    const names = index.get(key) ?? [];
    names.push(pick.name);
    index.set(key, names);
  }
  return index;
}

function readPosition(text: string): Position | null {
  const position = text.trim().toUpperCase();
  if (position === 'QB' || position === 'RB' || position === 'WR' || position === 'TE') return position;
  return null;
}

function readBye(text: string): number {
  const match = text.trim().match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function addTooltip(target: HTMLElement, count: number, position: Position, byeWeek: number, names: string[]) {
  const tooltip = createOverlayTooltip('dh-bye-tooltip');
  tooltip.textContent = `${count} ${position} have a week ${byeWeek} bye.\n${names.length > 0 ? names.join(', ') : 'None'}`;
  attachOverlayTooltip(target, tooltip);
}

export const annotateByeWeekCounts = (
  roster: ReadonlyArray<RosterPick>,
  available: ReadonlyArray<Player>,
  persistedAvailable: ReadonlyArray<Player>,
): Effect.Effect<void> =>
  Effect.sync(() => {
    document.querySelectorAll('.dh-bye-count-badge, .dh-bye-tooltip').forEach(el => el.remove());

    const rosterIndex = buildRosterIndex(roster);
    const persistedByes = availableByes(persistedAvailable);

    let body: Element | null = null;
    const mobileSection = document.querySelector('.DraftablePlayersTable-Mobile_draftable-players');
    if (mobileSection) {
      body = mobileSection.querySelector('.BaseTable__body');
      if (!body) {
        const allTables = mobileSection.querySelectorAll('.BaseTable__body');
        body = allTables[0] ?? null;
      }
    } else {
      const desktopSection = document.querySelector('.LiveDraft_draftable-players');
      if (desktopSection) {
        body = desktopSection.querySelector('.BaseTable__body');
      }
    }

    if (!body) return;

    let annotated = 0;
    const rows = body.querySelectorAll('.BaseTable__row');
    for (const row of rows) {
      const cells = row.querySelectorAll('.BaseTable__row-cell');
      if (cells.length < 6) continue;

      const name = cells[2]?.querySelector('.PlayerCell_player-name')?.textContent?.trim() ?? '';
      const team = cells[2]?.querySelector('.PlayerCell_player-team div')?.textContent?.trim() ?? '';
      const position = readPosition(cells[2]?.querySelector('.player-position')?.textContent ?? '');
      if (!name || !position) continue;

      const byeCell = cells[4] as HTMLElement | undefined;
      if (!byeCell) continue;

      const visibleBye = readBye(byeCell.textContent ?? '');
      const byeWeek = visibleBye || persistedByes.get(playerKey({ name, team, position })) || 0;
      const names = rosterIndex.get(`${position}::${byeWeek}`) ?? [];

      const badge = document.createElement('span');
      badge.className = 'dh-bye-count-badge';
      badge.textContent = String(names.length);
      badge.tabIndex = 0;
      badge.setAttribute('style', badgeStyle(names.length));

      addTooltip(badge, names.length, position, byeWeek, names);
      byeCell.appendChild(badge);
      annotated++;
    }

    if (annotated > 0) {
      console.log(`[DraftHelper] Annotated ${annotated} rows with bye week counts`);
    }
  });
