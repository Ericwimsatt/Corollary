import React, { useMemo } from 'react';
import type { Player, RosterPick } from '../content/types';
import type { DraftPlatformAdapter } from '../content/adapters/types';
import type { CustomRanking } from '../rankings/custom-rankings';
import {
  buildPositionNeeds,
  rankNextBestPicks,
  type ScoredPlayer,
  type StackDetail,
} from '../rankings/next-best-pick';
import { color, positionColor, styles as sharedStyles } from './styles';

const ROW_HEIGHT = 24;
const HEADER_HEIGHT = 19;
const VISIBLE_ROWS = 5;

interface Props {
  roster: RosterPick[];
  available: Player[];
  customRankings: ReadonlyArray<CustomRanking> | null;
  adapter: DraftPlatformAdapter;
  userPickNumber: number;
}

export default function NextBestPick({
  roster,
  available,
  customRankings,
  adapter,
  userPickNumber,
}: Props) {
  const scored = useMemo<ScoredPlayer[]>(() => {
    const positionNeeds = buildPositionNeeds(roster, adapter, userPickNumber);
    return rankNextBestPicks({
      roster,
      available,
      customRankings,
      positionNeeds,
    });
  }, [roster, available, customRankings, adapter, userPickNumber]);

  return (
    <section style={styles.container} aria-label="Next best pick recommendations">
      <div style={sharedStyles.sectionHeader}>
        <h3 style={sharedStyles.heading}>Next Best Pick</h3>
      </div>
      {scored.length === 0 ? (
        <p style={sharedStyles.empty}>Players will appear here once the draft starts.</p>
      ) : (
        <div style={styles.tableScroll}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Player</th>
                <th style={styles.thRight}>ADP</th>
                <th style={styles.thRight}>Pos</th>
                <th style={styles.thRight}>Stacks</th>
                <th style={styles.thRight}>Wk17</th>
              </tr>
            </thead>
            <tbody>
              {scored.map((s, i) => {
                const pos = s.player.position;
                const team = s.player.team || '';
                return (
                  <tr key={`${s.player.name}-${s.player.position}-${i}`}>
                    <td style={styles.td}>
                      <div style={styles.playerCell}>
                        <span style={{ ...styles.pos, color: positionColor[pos] }}>{pos}</span>
                        <span style={styles.playerIdentity}>
                          <span style={styles.playerName}>{s.player.name}</span>
                          {team && <span style={styles.playerTeam}>· {team}</span>}
                        </span>
                      </div>
                    </td>
                    <td style={styles.tdRight}>
                      <span style={styles.num}>{fmtAdp(s.player.adp)}</span>
                    </td>
                    <td style={styles.tdRight}>
                      <span style={styles.num}>{fmtScore(s.breakdown.need)}</span>
                    </td>
                    <td style={styles.tdRight}>
                      <span style={styles.num}>{fmtStack(s.stackDetail)}</span>
                    </td>
                    <td style={styles.tdRight}>
                      <span style={styles.num}>{fmtStack(s.week17Detail)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: 12,
  },
  tableScroll: {
    overflowY: 'auto',
    overflowX: 'hidden',
    maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT,
    paddingRight: 4,
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    fontSize: 12,
  },
  th: {
    textAlign: 'left',
    color: color.muted,
    fontWeight: 800,
    padding: '0 5px 5px',
    borderBottom: `1px solid ${color.line}`,
    fontSize: 9,
  },
  thRight: {
    textAlign: 'right' as const,
    color: color.muted,
    fontWeight: 800,
    padding: '0 5px 5px',
    borderBottom: `1px solid ${color.line}`,
    fontSize: 9,
  },
  td: {
    padding: '3px 5px',
    color: color.text,
    borderBottom: `1px solid ${color.line}`,
    verticalAlign: 'middle',
  },
  tdRight: {
    padding: '3px 5px',
    color: color.text,
    borderBottom: `1px solid ${color.line}`,
    textAlign: 'right' as const,
    verticalAlign: 'middle',
  },
  playerCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  playerIdentity: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 3,
    minWidth: 0,
    flex: '1 1 auto',
    overflow: 'hidden',
  },
  pos: {
    fontSize: 12,
    fontWeight: 900,
    lineHeight: 1,
    flex: '0 0 auto',
  },
  playerName: {
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.15,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    flex: '0 1 auto',
  },
  playerTeam: {
    color: color.faint,
    fontSize: 11,
    fontWeight: 400,
    whiteSpace: 'nowrap',
    flex: '0 0 auto',
  },
  num: {
    fontWeight: 600,
    fontSize: 12,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
};

function fmtScore(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}`;
}

function fmtAdp(adp: number): string {
  return Number.isFinite(adp) && adp > 0 ? adp.toFixed(1) : '—';
}

function fmtStack(detail: StackDetail): string {
  if (detail.count <= 0) return '—';
  return detail.hasQb ? `QB+${detail.count}` : `${detail.count}`;
}
