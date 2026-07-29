import React, { useState } from 'react';
import { Option } from "effect";
import type { RosterPick, Player } from '../content/types';
import { getOpponents } from '../data/schedule';
import type { OpponentRow } from '../data/schedule';
import { getTeamInfo } from '../data/teams';

interface Props {
  roster: RosterPick[];
  available: Player[];
}

function Pill({ abbr, players }: { abbr: string; players: Player[] }) {
  const [show, setShow] = useState(false);
  const info = getTeamInfo(abbr);
  if (!info) return <span>{abbr}</span>;

  const top = [...players]
    .filter(p => p.team === abbr && p.adp > 0)
    .sort((a, b) => a.adp - b.adp)
    .slice(0, 5);

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span
        style={{
          ...styles.pill,
          backgroundColor: info.primaryColor,
          color: info.textColor,
        }}
      >
        {abbr}
      </span>
      {show && top.length > 0 && (
        <div style={styles.tooltip}>
          <div style={styles.tooltipTitle}>{info.name}</div>
          {top.map((p, i) => (
            <div key={i} style={styles.tooltipRow}>
              <span>
                <span style={styles.pos}>{p.position}</span> {p.name}
              </span>
              <span style={styles.tooltipAdp}>{p.adp.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OpponentsTable({ roster, available }: Props) {
  const qbs = roster.filter(p => p.position === 'QB');
  const nonQbs = roster.filter(p => p.position !== 'QB');
  const first8 = [...qbs, ...nonQbs].slice(0, 8);

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>Playoff Stacks</h3>
      {first8.length === 0 ? (
        <p style={styles.empty}>Draft players to see their playoff schedule</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Player</th>
              <th style={styles.th}>Wk 15</th>
              <th style={styles.th}>Wk 16</th>
              <th style={styles.th}>Wk 17</th>
            </tr>
          </thead>
          <tbody>
            {first8.map((pick, i) => {
              const opps = pick.team
                ? getOpponents(pick.team)
                : Option.none<OpponentRow>();
              const week15 = Option.isSome(opps) ? opps.value.week15 : '—';
              const week16 = Option.isSome(opps) ? opps.value.week16 : '—';
              const week17 = Option.isSome(opps) ? opps.value.week17 : '—';
              return (
                <tr key={i}>
                  <td style={styles.td}>
                    <div>{pick.name}</div>
                    <div style={styles.playerTeam}>{pick.team ? getTeamInfo(pick.team)?.name ?? pick.team : pick.team}</div>
                  </td>
                  <td style={styles.td}><Pill abbr={week15} players={available} /></td>
                  <td style={styles.td}><Pill abbr={week16} players={available} /></td>
                  <td style={styles.td}><Pill abbr={week17} players={available} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {},
  heading: {
    fontSize: 14,
    fontWeight: 700,
    color: '#e8e8e8',
    marginBottom: 8,
  },
  empty: {
    color: '#999',
    fontSize: 12,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
  },
  th: {
    textAlign: 'left',
    color: '#aaa',
    fontWeight: 600,
    padding: '4px 6px',
    borderBottom: '1px solid #333',
  },
  td: {
    padding: '4px 6px',
    color: '#e0e0e0',
    borderBottom: '1px solid #333',
  },
  playerTeam: {
    color: '#999',
    fontSize: 11,
  },
  pill: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 700,
    lineHeight: '18px',
    cursor: 'default',
  },
  tooltip: {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: 4,
    background: '#1a1a2e',
    border: '1px solid #444',
    borderRadius: 6,
    padding: '6px 10px',
    zIndex: 100,
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  },
  tooltipTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#e8e8e8',
    marginBottom: 4,
    borderBottom: '1px solid #333',
    paddingBottom: 2,
  },
  tooltipRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    fontSize: 11,
    color: '#ccc',
    padding: '1px 0',
  },
  tooltipAdp: {
    color: '#888',
    fontSize: 10,
  },
  pos: {
    color: '#888',
    fontSize: 10,
    marginRight: 2,
  },
};
