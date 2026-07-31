import React from 'react';
import type { RosterPick, Position } from '../content/types';
import type { DraftPlatformAdapter } from '../content/adapters';
import { color, positionColor } from './styles';

interface Props {
  roster: RosterPick[];
  userPickNumber: number;
  adapter: DraftPlatformAdapter;
  fillHeight?: boolean;
}

function overallFromUserPick(rosterIndex: number, userPick: number, teamCount: number): number {
  const round = rosterIndex + 1;
  if (round % 2 === 1) return (round - 1) * teamCount + userPick;
  return round * teamCount - userPick + 1;
}

interface PosGroup {
  label: Position;
  capital: number;
  count: number;
  pct: number;
}

function formatCapital(val: number): string {
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return String(val);
}

export default function CapitalChart({ roster, userPickNumber, adapter, fillHeight = false }: Props) {
  const groups: PosGroup[] = adapter.capitalCeilings.map((g) => {
    const players = roster.filter((p) => g.pos.includes(p.position));
    const capital = players.reduce(
      (sum, p) => {
        const rosterIndex = adapter.id === 'draftkings' && p.overallPick > 0
          ? p.overallPick - 1
          : roster.indexOf(p);
        const pk = overallFromUserPick(rosterIndex, userPickNumber, adapter.teamCount);
        const cap = adapter.draftCapital(pk);
        return sum + cap;
      },
      0
    );
    const pct = (capital / g.maxCapital) * 100;
    return {
      label: g.label,
      capital,
      count: players.length,
      pct,
    };
  });

  return (
    <section style={fillHeight ? { ...styles.container, ...styles.containerFill } : styles.container} aria-label="Draft capital by position">
      <div style={styles.header}>
        <h3 style={styles.heading}>Draft Capital</h3>
        <span style={styles.mode}>{adapter.roundCount} rounds</span>
      </div>
      <div style={fillHeight ? { ...styles.barList, ...styles.barListFill } : styles.barList}>
        {groups.map((g) => {
          const posColor = positionColor[g.label];
          return (
            <div key={g.label} style={fillHeight ? { ...styles.row, ...styles.rowFill } : styles.row}>
              <span style={{ ...styles.label, color: posColor }}>{g.label}</span>
              <div style={fillHeight ? { ...styles.barBg, ...styles.barBgFill } : styles.barBg}>
                <div
                  style={{
                    ...styles.barFill,
                    ...(fillHeight ? styles.barFillStretch : {}),
                    width: `${Math.max(g.pct, 2)}%`,
                    backgroundColor: posColor,
                  }}
                />
              </div>
              <span style={styles.capital}>${formatCapital(g.capital)}</span>
              <span style={styles.count}>{g.count}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: 12,
  },
  containerFill: {
    marginBottom: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  heading: {
    color: color.text,
    fontSize: 12,
    fontWeight: 850,
    lineHeight: 1.2,
  },
  mode: {
    color: color.muted,
    fontSize: 10,
    fontWeight: 750,
  },
  barList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  barListFill: {
    gap: 5,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '26px minmax(128px, 1fr) 52px 18px',
    alignItems: 'center',
    gap: 7,
    minHeight: 20,
  },
  rowFill: {
    minHeight: 29,
  },
  label: {
    fontSize: 11,
    fontWeight: 900,
    lineHeight: 1,
  },
  barBg: {
    height: 14,
    backgroundColor: color.panel,
    border: `1px solid ${color.line}`,
    borderRadius: 999,
    position: 'relative',
    overflow: 'visible',
  },
  barBgFill: {
    height: 22,
    minHeight: 22,
  },
  barFill: {
    position: 'absolute',
    left: -1,
    top: -1,
    height: '100%',
    minHeight: 14,
    borderRadius: 999,
    boxShadow: 'inset 0 -1px 0 rgba(0, 0, 0, 0.18)',
  },
  barFillStretch: {
    minHeight: '100%',
  },
  capital: {
    position: 'relative',
    color: color.text,
    fontWeight: 850,
    fontSize: 11,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    zIndex: 2,
  },
  count: {
    color: color.muted,
    fontSize: 10,
    fontWeight: 800,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  warning: {
    color: color.warning,
    background: 'rgba(246, 196, 83, 0.1)',
    border: '1px solid rgba(246, 196, 83, 0.24)',
    borderRadius: 7,
    padding: '5px 7px',
    marginBottom: 7,
    fontSize: 10,
    fontWeight: 700,
  },
};
