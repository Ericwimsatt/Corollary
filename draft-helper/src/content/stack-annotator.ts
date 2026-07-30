import { Effect } from "effect";
import type { Player, RosterPick } from './types';

export const annotateStackTargets = (
  roster: ReadonlyArray<RosterPick>,
  available: ReadonlyArray<Player>,
): Effect.Effect<void> =>
  Effect.sync(() => {
    document.querySelectorAll('.dh-stack-badge').forEach(el => el.remove());

    const rosterByTeam = new Map<string, { qb: string[]; wr: string[]; te: string[]; rb: string[] }>();
    for (const pick of roster) {
      if (!pick.team) continue;
      let entry = rosterByTeam.get(pick.team);
      if (!entry) {
        entry = { qb: [], wr: [], te: [], rb: [] };
        rosterByTeam.set(pick.team, entry);
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

    if (rosterByTeam.size === 0) return;

    const teamLabels = new Map<string, string>();
    const order: Array<'qb' | 'wr' | 'te' | 'rb'> = ['qb', 'wr', 'te', 'rb'];
    for (const [team, entry] of rosterByTeam) {
      const parts: string[] = [];
      for (const key of order) {
        if (entry[key].length > 0) parts.push(entry[key].join(', '));
      }
      if (parts.length > 0) teamLabels.set(team, `(${parts.join(', ')})`);
    }

    if (teamLabels.size === 0) return;

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

    if (!body) {
      console.log('[DraftHelper] No available players table body found for stack annotations');
      return;
    }

    let annotated = 0;
    const rows = body.querySelectorAll('.BaseTable__row');
    for (const row of rows) {
      const cells = row.querySelectorAll('.BaseTable__row-cell');
      if (cells.length < 6) continue;

      const teamEl = cells[2]?.querySelector('.PlayerCell_player-team div');
      const team = teamEl?.textContent?.trim() ?? '';
      if (!team) continue;

      const label = teamLabels.get(team);
      if (!label) continue;

      const container = cells[2]?.querySelector('.PlayerCell_player-details-container');
      if (!container) continue;

      const badge = document.createElement('span');
      badge.className = 'dh-stack-badge';
      badge.textContent = '\u00A0' + label;
      badge.setAttribute('style',
        'display:inline-flex;align-items:center;margin-left:5px;padding:1px 5px;border-radius:6px;border:1px solid #1570d6;background:#fff;color:#1570d6;font-size:10px;font-weight:900;line-height:14px;white-space:nowrap;box-shadow:0 1px 2px rgba(16,24,32,.12);'
      );
      container.appendChild(badge);
      annotated++;
    }

    if (annotated > 0) {
      console.log(`[DraftHelper] Annotated ${annotated} rows with stack info`);
    }
  });
