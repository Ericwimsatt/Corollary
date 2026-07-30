import { Effect } from "effect";
import { rankings } from "../data/rankings";

const teamAliases: Record<string, string> = {
  'LA': 'LAR',
};

function normalizeTeam(team: string): string {
  return teamAliases[team] ?? team;
}

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

function matchLastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  for (let i = parts.length - 1; i >= 0; i--) {
    const cleaned = parts[i].toLowerCase().replace(/\./g, '');
    if (!SUFFIXES.has(cleaned)) return cleaned;
  }
  return '';
}

export const annotateExternalRankings: Effect.Effect<void> =
  Effect.sync(() => {
    document.querySelectorAll('.dh-rank-badge').forEach(el => el.remove());

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

      const dkRankText = cells[1]?.textContent?.trim() ?? '0';
      const dkRank = parseInt(dkRankText, 10) || 0;

      const nameEl = cells[2]?.querySelector('.PlayerCell_player-name');
      const posEl = cells[2]?.querySelector('.player-position');
      const teamEl = cells[2]?.querySelector('.PlayerCell_player-team div');

      const dkName = nameEl?.textContent?.trim() ?? '';
      const dkPos = posEl?.textContent?.trim() ?? '';
      const dkTeam = normalizeTeam(teamEl?.textContent?.trim() ?? '');
      if (!dkName || !dkPos || !dkTeam) continue;

      const dkLastName = matchLastName(dkName);

      const match = rankings.find(r => {
        if (r.position !== dkPos) return false;
        if (normalizeTeam(r.team) !== dkTeam) return false;
        const csvLastName = matchLastName(r.name);
        return csvLastName === dkLastName;
      });

      if (!match) continue;

      const rankCell = cells[1];
      const badge = document.createElement('span');
      badge.className = 'dh-rank-badge';
      badge.textContent = `\u00A0${match.etrRank}`;

      let color: string;
      if (match.etrRank < dkRank) {
        color = '#168a52';
      } else if (match.etrRank > dkRank) {
        color = '#c24132';
      } else {
        color = '#9b6200';
      }

      badge.setAttribute('style',
        `display:inline-flex;align-items:center;margin-left:5px;padding:1px 5px;border-radius:6px;border:1px solid ${color};background:#fff;color:${color};font-size:10px;font-weight:900;line-height:14px;white-space:nowrap;font-variant-numeric:tabular-nums;box-shadow:0 1px 2px rgba(16,24,32,.12);`
      );
      rankCell.appendChild(badge);
      annotated++;
    }

    if (annotated > 0) {
      console.log(`[DraftHelper] Annotated ${annotated} rows with external rankings`);
    }
  });
