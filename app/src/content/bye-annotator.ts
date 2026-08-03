import { Effect } from "effect";
import type { Player, Position, RosterPick } from './types';
import { attachOverlayTooltip, createOverlayTooltip } from './overlay-tooltip';
import { isFreeAgentTeam, isNflTeam, normalizeTeam } from '../utils/teams';
import type { DraftPlatformAdapter } from './adapters';
import { playerKey } from './player-key';

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
    'margin-left:2px',
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

function availableByes(available: ReadonlyArray<Player>): Map<string, number> {
  const byes = new Map<string, number>();
  for (const player of available) {
    if (isNflTeam(player.team) && player.byeWeek !== 0) {
      byes.set(playerKey(player), player.byeWeek);
    }
  }
  return byes;
}

function buildRosterIndex(roster: ReadonlyArray<RosterPick>) {
  const index = new Map<string, string[]>();
  for (const pick of roster) {
    if (isFreeAgentTeam(pick.team)) continue;
    const key = `${pick.position}::${pick.byeWeek}`;
    const names = index.get(key) ?? [];
    names.push(pick.name);
    index.set(key, names);
  }
  return index;
}

function readBye(text: string): number {
  const match = text.trim().match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function addTooltip(target: HTMLElement, count: number, position: Position, byeWeek: number, names: string[]) {
  const tooltip = createOverlayTooltip('dh-bye-tooltip');
  tooltip.textContent = `${count} ${position}s have a week ${byeWeek} bye.\n${names.length > 0 ? names.join(', ') : 'None'}`;
  attachOverlayTooltip(target, tooltip);
}

export const annotateByeWeekCounts = (
  adapter: DraftPlatformAdapter,
  roster: ReadonlyArray<RosterPick>,
  available: ReadonlyArray<Player>,
  persistedAvailable: ReadonlyArray<Player>,
): Effect.Effect<void> =>
  Effect.sync(() => {
    document.querySelectorAll('.dh-bye-count-badge, .dh-bye-tooltip').forEach(el => el.remove());

    const rosterIndex = buildRosterIndex(roster);
    const persistedByes = availableByes(persistedAvailable);

    const body = adapter.ui.findAvailablePlayersBody();
    if (!body) return;

    let annotated = 0;
    const rows = adapter.ui.getAvailablePlayerRows(body);
    for (const row of rows) {
      const parsed = adapter.ui.parseAvailablePlayerRow(row);
      if (!parsed) continue;

      const { name, position } = parsed;
      const team = normalizeTeam(parsed.team);
      if (!name || !position || !isNflTeam(team)) continue;

      const byeCell = parsed.byeCell;
      if (!byeCell) continue;
      const byeNumber = parsed.byeNumber;
      const byeNumberSpan = parsed.byeNumberSpan;

      const visibleBye = parsed.byeWeek || readBye(byeNumberSpan?.textContent ?? byeCell.textContent ?? '');
      const byeWeek = visibleBye || persistedByes.get(playerKey({ name, team, position })) || 0;
      const names = rosterIndex.get(`${position}::${byeWeek}`) ?? [];

      const badge = document.createElement('span');
      badge.className = 'dh-bye-count-badge';
      badge.textContent = String(names.length);
      badge.tabIndex = 0;
      badge.setAttribute('style', badgeStyle(names.length));

      addTooltip(badge, names.length, position, byeWeek, names);
      if (byeNumber) {
        byeNumber.style.display = 'inline-flex';
        byeNumber.style.alignItems = 'center';
        byeNumber.style.justifyContent = 'flex-start';
      }
      if (byeNumberSpan) {
        byeNumberSpan.style.display = 'inline-block';
        byeNumberSpan.style.width = '2ch';
        byeNumberSpan.style.textAlign = 'right';
      }
      (byeNumber ?? byeCell).appendChild(badge);
      annotated++;
    }

    if (annotated > 0) {
      console.log(`[Corollary] Annotated ${annotated} rows with bye week counts`);
    }
  });
