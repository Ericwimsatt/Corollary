import { Effect } from "effect";
import {
  getCustomRankings,
  type CustomRanking,
} from "../rankings/custom-rankings";
import type { DraftPlatformAdapter } from "./adapters";
import { findMatchingPlayer } from './player-key';

export const annotateExternalRankings = (adapter: DraftPlatformAdapter): Effect.Effect<void> =>
  Effect.tryPromise({
    try: async () => {
      const data = await getCustomRankings(adapter.id);
      annotateRankings(adapter, data?.rankings ?? []);
    },
    catch: () => new Error("custom rankings annotation failed"),
  }).pipe(Effect.catchAll(() => Effect.sync(() => annotateRankings(adapter, []))));

function annotateRankings(adapter: DraftPlatformAdapter, rankings: ReadonlyArray<CustomRanking>) {
  document.querySelectorAll('.dh-rank-badge').forEach(el => el.remove());
  if (rankings.length === 0) return;

  const body = adapter.ui.findAvailablePlayersBody();
  if (!body) return;

  let annotated = 0;
  const rows = adapter.ui.getAvailablePlayerRows(body);
  for (const row of rows) {
    const parsed = adapter.ui.parseAvailablePlayerRow(row);
    if (!parsed?.rankCell) continue;

    const match = findMatchingPlayer(rankings, parsed);

    if (!match) continue;

    const badge = document.createElement('span');
    badge.className = 'dh-rank-badge';
    badge.textContent = `\u00A0${match.rank}`;

    let color: string;
    if (match.rank < parsed.rank) {
      color = '#168a52';
    } else if (match.rank > parsed.rank) {
      color = '#c24132';
    } else {
      color = '#101820';
    }

    badge.setAttribute('style',
      `display:inline-flex;align-items:center;margin-left:5px;padding:1px 5px;border-radius:6px;border:1px solid ${color};background:#fff;color:${color};font-size:10px;font-weight:900;line-height:14px;white-space:nowrap;font-variant-numeric:tabular-nums;box-shadow:0 1px 2px rgba(16,24,32,.12);`
    );
    parsed.rankCell.appendChild(badge);
    annotated++;
  }

  if (annotated > 0) {
    console.log(`[Corollary] Annotated ${annotated} rows with custom rankings`);
  }
}
