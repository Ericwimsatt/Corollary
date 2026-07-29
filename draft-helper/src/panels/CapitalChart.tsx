import React from 'react';
import type { RosterPick, Position } from '../content/types';
import { draftCapital } from '../utils/capital';

interface Props {
  roster: RosterPick[];
  userPickNumber: number;
  useAdp: boolean;
}

const TEAMS = 12;

function overallFromUserPick(rosterIndex: number, userPick: number): number {
  const round = rosterIndex + 1;
  if (round % 2 === 1) return (round - 1) * TEAMS + userPick;
  return round * TEAMS - userPick + 1;
}

interface PosGroup {
  label: string;
  capital: number;
  count: number;
  color: string;
  maxCapital: number;
}

const POS_GROUPS: { pos: Position[]; label: string; color: string; maxCapital: number }[] = [
  { pos: ['QB'], label: 'QB', color: '#4fc3f7', maxCapital: 3000 },
  { pos: ['RB'], label: 'RB', color: '#81c784', maxCapital: 9000 },
  { pos: ['WR'], label: 'WR', color: '#ffb74d', maxCapital: 13000 },
  { pos: ['TE'], label: 'TE', color: '#ba68c8', maxCapital: 3000 },
];

function formatCapital(val: number): string {
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return String(val);
}

function pickForCapital(p: RosterPick, rosterIndex: number, userPickNumber: number, useAdp: boolean): number {
  if (useAdp && p.adp > 0) return Math.round(p.adp);
  return overallFromUserPick(rosterIndex, userPickNumber);
}

export default function CapitalChart({ roster, userPickNumber, useAdp }: Props) {
  console.group('[DraftHelper] CapitalChart');
  console.log(`User pick number: ${userPickNumber}, mode: ${useAdp ? 'ADP' : 'Actual'}`);
  console.log('Full roster:', JSON.parse(JSON.stringify(roster)));
  const groups: PosGroup[] = POS_GROUPS.map((g) => {
    const players = roster.filter((p) => g.pos.includes(p.position));
    console.log(`${g.label} players (${players.length}):`, players.map(p => p.name).join(', '));
    const details: string[] = [];
    const capital = players.reduce(
      (sum, p, idx) => {
        const rosterIndex = roster.indexOf(p);
        const pk = pickForCapital(p, rosterIndex, userPickNumber, useAdp);
        const cap = draftCapital(pk);
        details.push(`${p.name}: ${useAdp ? `adp=#${p.adp}` : `snakeOverall=#${pk}`} -> $${cap}`);
        return sum + cap;
      },
      0
    );
    details.forEach(d => console.log(`  ${d}`));
    console.log(`  total: $${capital}, max: $${g.maxCapital}`);
    return {
      label: g.label,
      capital,
      count: players.length,
      color: g.color,
      maxCapital: g.maxCapital,
    };
  });
  console.groupEnd();

  const missingAdpCount = useAdp ? roster.filter(p => p.adp <= 0).length : 0;

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>
        Draft Capital
        <span style={{ fontSize: 10, color: '#999', fontWeight: 400, marginLeft: 8 }}>
          ({useAdp ? 'ADP' : 'Actual'})
        </span>
      </h3>
      {missingAdpCount > 0 && (
        <div style={{ fontSize: 10, color: '#f0a030', marginBottom: 6 }}>
          ⚠ {missingAdpCount} player{missingAdpCount > 1 ? 's' : ''} missing ADP (using actual pick)
        </div>
      )}
      {groups.map((g) => {
        const pct = (g.capital / g.maxCapital) * 100;
        return (
          <div key={g.label} style={styles.row}>
            <span style={styles.label}>{g.label}</span>
            <div style={styles.barBg}>
              <div
                style={{
                  ...styles.barFill,
                  width: `${Math.max(pct, 2)}%`,
                  backgroundColor: g.color,
                }}
              />
            </div>
            <span style={styles.capital}>${formatCapital(g.capital)}</span>
            <span style={styles.count}>{g.count}</span>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: 12,
  },
  heading: {
    fontSize: 14,
    fontWeight: 700,
    color: '#e8e8e8',
    marginBottom: 8,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    fontSize: 12,
  },
  label: {
    width: 36,
    color: '#ccc',
    fontWeight: 600,
    flexShrink: 0,
  },
  barBg: {
    flex: 1,
    height: 16,
    backgroundColor: '#333',
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    borderRadius: 8,
    transition: 'width 0.3s',
  },
  capital: {
    width: 48,
    textAlign: 'right',
    color: '#e0e0e0',
    fontWeight: 600,
    fontSize: 11,
    fontVariantNumeric: 'tabular-nums',
  },
  count: {
    width: 20,
    textAlign: 'center',
    color: '#aaa',
    backgroundColor: '#444',
    borderRadius: 10,
    padding: '0 4px',
    fontSize: 11,
    fontWeight: 700,
  },
};
