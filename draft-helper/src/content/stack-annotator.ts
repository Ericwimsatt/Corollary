import { Effect, Option } from "effect";
import type { Player, RosterPick } from './types';
import { getOpponents } from "../data/schedule";
import { attachOverlayTooltip, createOverlayTooltip, tooltipLabelStyle } from './overlay-tooltip';
import { isNflTeam, normalizeTeam } from '../utils/teams';
import type { DraftPlatformAdapter } from './adapters';

const badgeRowStyle = [
  'display:flex',
  'align-items:center',
  'gap:5px',
  'flex-wrap:nowrap',
  'margin-top:1px',
  'position:relative',
  'width:max-content',
  'max-width:100%',
].join(';');

const stackBadgeStyle = [
  'display:inline-flex',
  'align-items:center',
  'padding:0 4px',
  'border-radius:6px',
  'border:1px solid #1570d6',
  'background:#fff',
  'color:#1570d6',
  'font-size:10px',
  'font-weight:900',
  'line-height:12px',
  'white-space:nowrap',
  'box-shadow:0 1px 2px rgba(16,24,32,.12)',
].join(';');

const week17BadgeStyle = [
  'display:inline-flex',
  'align-items:center',
  'padding:0 4px',
  'border-radius:6px',
  'border:1px solid #c24132',
  'background:#fff',
  'color:#c24132',
  'font-size:10px',
  'font-weight:900',
  'line-height:12px',
  'white-space:nowrap',
  'box-shadow:0 1px 2px rgba(16,24,32,.12)',
].join(';');

function abbreviateName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

function getInlineText(names: string[], totalCount: number): string {
  if (names.length === 0) return '';
  if (totalCount > 3 || names.length > 2) return String(names.length);
  return names.slice(0, 2).map(abbreviateName).join(', ');
}

function addBadge(row: HTMLElement, className: string, label: string, style: string) {
  const badge = document.createElement('span');
  badge.className = className;
  badge.textContent = label;
  badge.tabIndex = 0;
  badge.setAttribute('style', style);
  row.appendChild(badge);
}

function addTooltip(row: HTMLElement, stacks: string[], week17: string[]) {
  const tooltip = createOverlayTooltip();

  if (stacks.length > 0) {
    const stackLine = document.createElement('div');
    const label = document.createElement('span');
    label.textContent = 'Stacks: ';
    label.setAttribute('style', `${tooltipLabelStyle};color:#1570d6;`);
    stackLine.appendChild(label);
    stackLine.append(document.createTextNode(stacks.join(', ')));
    tooltip.appendChild(stackLine);
  }

  if (week17.length > 0) {
    const week17Line = document.createElement('div');
    const label = document.createElement('span');
    label.textContent = 'Week 17 VS: ';
    label.setAttribute('style', `${tooltipLabelStyle};color:#c24132;`);
    week17Line.appendChild(label);
    week17Line.append(document.createTextNode(week17.join(', ')));
    tooltip.appendChild(week17Line);
  }

  attachOverlayTooltip(row, tooltip);
}

export const annotateStackTargets = (
  adapter: DraftPlatformAdapter,
  roster: ReadonlyArray<RosterPick>,
  available: ReadonlyArray<Player>,
): Effect.Effect<void> =>
  Effect.sync(() => {
    document.querySelectorAll('.dh-stack-badge, .dh-week17-badge, .dh-overlay-row, .dh-overlay-tooltip').forEach(el => el.remove());

    const rosterByTeam = new Map<string, { qb: string[]; wr: string[]; te: string[]; rb: string[] }>();
    for (const pick of roster) {
      const team = normalizeTeam(pick.team);
      if (!isNflTeam(team)) continue;
      let entry = rosterByTeam.get(team);
      if (!entry) {
        entry = { qb: [], wr: [], te: [], rb: [] };
        rosterByTeam.set(team, entry);
      }
      if (pick.position === 'QB') {
        entry.qb.push(pick.name);
      } else if (pick.position === 'WR') {
        entry.wr.push(pick.name);
      } else if (pick.position === 'TE') {
        entry.te.push(pick.name);
      } else if (pick.position === 'RB') {
        entry.rb.push(pick.name);
      }
    }

    const teamPlayers = new Map<string, string[]>();
    const order: Array<'qb' | 'wr' | 'te' | 'rb'> = ['qb', 'wr', 'te', 'rb'];
    for (const [team, entry] of rosterByTeam) {
      const names = order.flatMap((key) => entry[key]);
      if (names.length > 0) teamPlayers.set(team, names);
    }

    const body = adapter.ui.findAvailablePlayersBody();
    if (!body) {
      console.log('[DraftHelper] No available players table body found for stack annotations');
      return;
    }

    let annotated = 0;
    const rows = adapter.ui.getAvailablePlayerRows(body);
    for (const row of rows) {
      const parsed = adapter.ui.parseAvailablePlayerRow(row);
      if (!parsed) continue;

      const team = normalizeTeam(parsed.team);
      if (!isNflTeam(team)) continue;

      const stackNames = teamPlayers.get(team) ?? [];
      const opponents = getOpponents(team);
      const week17Opponent = Option.isSome(opponents) ? normalizeTeam(opponents.value.week17) : null;
      const week17Names = week17Opponent ? teamPlayers.get(week17Opponent) ?? [] : [];

      if (stackNames.length === 0 && week17Names.length === 0) continue;

      if (!parsed.detailsContainer) continue;

      const badgeRow = document.createElement('div');
      badgeRow.className = 'dh-overlay-row';
      badgeRow.setAttribute('style', badgeRowStyle);

      const totalCount = stackNames.length + week17Names.length;
      const stackText = getInlineText(stackNames, totalCount);
      const week17Text = getInlineText(week17Names, totalCount);

      if (stackText) {
        addBadge(
          badgeRow,
          'dh-stack-badge',
          stackText,
          stackBadgeStyle,
        );
      }

      if (week17Text) {
        addBadge(
          badgeRow,
          'dh-week17-badge',
          week17Text,
          week17BadgeStyle,
        );
      }

      addTooltip(badgeRow, stackNames, week17Names);
      parsed.detailsContainer.appendChild(badgeRow);
      annotated++;
    }

    if (annotated > 0) {
      console.log(`[DraftHelper] Annotated ${annotated} rows with stack info`);
    }
  });
