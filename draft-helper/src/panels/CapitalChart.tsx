import React from 'react';
import type { RosterPick, Position } from '../content/types';
import { draftCapital } from '../utils/capital';
import { color, positionColor } from './styles';

interface Props {
  roster: RosterPick[];
  userPickNumber: number;
}

const TEAMS = 12;

function overallFromUserPick(rosterIndex: number, userPick: number): number {
  const round = rosterIndex + 1;
  if (round % 2 === 1) return (round - 1) * TEAMS + userPick;
  return round * TEAMS - userPick + 1;
}

interface PosGroup {
  label: Position;
  capital: number;
  count: number;
  pct: number;
}

const POS_GROUPS: { pos: Position[]; label: Position; maxCapital: number }[] = [
  { pos: ['QB'], label: 'QB', maxCapital: 3000 },
  { pos: ['RB'], label: 'RB', maxCapital: 9000 },
  { pos: ['WR'], label: 'WR', maxCapital: 13000 },
  { pos: ['TE'], label: 'TE', maxCapital: 3000 },
];

function formatCapital(val: number): string {
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return String(val);
}

export default function CapitalChart({ roster, userPickNumber }: Props) {
  const groups: PosGroup[] = POS_GROUPS.map((g) => {
    const players = roster.filter((p) => g.pos.includes(p.position));
    const capital = players.reduce(
      (sum, p) => {
        const rosterIndex = roster.indexOf(p);
        const pk = overallFromUserPick(rosterIndex, userPickNumber);
        const cap = draftCapital(pk);
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
    <section style={styles.container} aria-label="Draft capital by position">
      <div style={styles.header}>
        <h3 style={styles.heading}>Draft Capital</h3>
      </div>
      <div style={styles.barList}>
        {groups.map((g) => {
          const posColor = positionColor[g.label];
          return (
            <div key={g.label} style={styles.row}>
              <span style={{ ...styles.label, color: posColor }}>{g.label}</span>
              <div style={styles.barBg}>
                <div
                  style={{
                    ...styles.barFill,
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
  row: {
    display: 'grid',
    gridTemplateColumns: '26px minmax(128px, 1fr) 52px 18px',
    alignItems: 'center',
    gap: 7,
    minHeight: 20,
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
  barFill: {
    position: 'absolute',
    left: -1,
    top: -1,
    height: '100%',
    minHeight: 14,
    borderRadius: 999,
    boxShadow: 'inset 0 -1px 0 rgba(0, 0, 0, 0.18)',
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
