import React, { useState } from 'react';
import { Option } from "effect";
import type { RosterPick, Player } from '../content/types';
import { getOpponents } from '../data/schedule';
import type { OpponentRow } from '../data/schedule';
import { getTeamInfo } from '../data/teams';
import { color, positionColor, styles as sharedStyles } from './styles';

interface Props {
  roster: RosterPick[];
  available: Player[];
}

function Pill({ abbr, players }: { abbr: string; players: Player[] }) {
  const [show, setShow] = useState(false);
  const info = getTeamInfo(abbr);
  if (!info) return <span style={styles.missingOpponent}>{abbr}</span>;
  const textStyle = getPillTextStyle(info.primaryColor, info.secondaryColor);

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
          background: `linear-gradient(135deg, ${info.primaryColor} 0 58%, ${info.secondaryColor} 58% 100%)`,
          borderColor: textStyle.borderColor,
        }}
      >
        <span style={{ ...styles.pillText, ...textStyle }}>{abbr}</span>
      </span>
      {show && top.length > 0 && (
        <div style={styles.tooltip}>
          <div style={styles.tooltipTitle}>
            <span>{info.name}</span>
            <span style={styles.tooltipTeam}>{abbr}</span>
          </div>
          {top.map((p, i) => (
            <div key={i} style={styles.tooltipRow}>
              <span>
                <span style={{ ...styles.pos, color: positionColor[p.position] }}>{p.position}</span> {p.name}
              </span>
              <span style={styles.tooltipAdp}>{p.adp.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getPillTextStyle(primary: string, secondary: string): React.CSSProperties {
  const blackMin = Math.min(contrastRatio('#101820', primary), contrastRatio('#101820', secondary));
  const whiteMin = Math.min(contrastRatio('#ffffff', primary), contrastRatio('#ffffff', secondary));
  if (blackMin >= whiteMin) {
    return {
      color: '#101820',
      background: 'rgba(255, 255, 255, 0.78)',
      borderColor: 'rgba(16, 24, 32, 0.18)',
      textShadow: 'none',
    };
  }
  return {
    color: '#ffffff',
    background: 'rgba(16, 24, 32, 0.62)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    textShadow: '0 1px 1px rgba(0, 0, 0, 0.65)',
  };
}

function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(hexToRgb(foreground));
  const bg = relativeLuminance(hexToRgb(background));
  const light = Math.max(fg, bg);
  const dark = Math.min(fg, bg);
  return (light + 0.05) / (dark + 0.05);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

export default function OpponentsTable({ roster, available }: Props) {
  const qbs = roster.filter(p => p.position === 'QB');
  const nonQbs = roster.filter(p => p.position !== 'QB');
  const first8 = [...qbs, ...nonQbs].slice(0, 8);

  return (
    <section style={styles.container} aria-label="Playoff opponents">
      <div style={sharedStyles.sectionHeader}>
        <h3 style={sharedStyles.heading}>Playoff Matchups</h3>
      </div>
      {first8.length === 0 ? (
        <p style={sharedStyles.empty}>Draft players to see playoff opponents.</p>
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
                    <div style={styles.playerCell}>
                      <div style={styles.playerText}>
                        <div style={{ ...styles.playerName, color: positionColor[pick.position] }}>{pick.name}</div>
                        <div style={styles.playerTeam}>{pick.team ? getTeamInfo(pick.team)?.name ?? pick.team : pick.team}</div>
                      </div>
                    </div>
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
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    ...sharedStyles.section,
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    fontSize: 10.5,
  },
  th: {
    textAlign: 'left',
    color: color.muted,
    fontWeight: 800,
    padding: '0 5px 5px',
    borderBottom: `1px solid ${color.line}`,
    fontSize: 9,
  },
  td: {
    padding: '5px',
    color: color.text,
    borderBottom: `1px solid ${color.line}`,
    verticalAlign: 'middle',
  },
  playerCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  playerText: {
    minWidth: 0,
  },
  playerName: {
    fontSize: 10.5,
    fontWeight: 900,
    lineHeight: 1.15,
    maxWidth: 126,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  playerTeam: {
    color: color.muted,
    fontSize: 9,
    fontWeight: 650,
    lineHeight: 1.15,
    maxWidth: 126,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 39,
    minHeight: 20,
    padding: 2,
    borderRadius: 8,
    border: '1px solid transparent',
    lineHeight: 1,
    cursor: 'default',
  },
  pillText: {
    display: 'block',
    minWidth: 30,
    padding: '3px 5px 2px',
    borderRadius: 6,
    border: '1px solid transparent',
    fontSize: 10,
    fontWeight: 900,
    lineHeight: 1,
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
  },
  missingOpponent: {
    color: color.faint,
    fontSize: 10,
    fontWeight: 800,
  },
  tooltip: {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: 4,
    background: color.panel,
    border: `1px solid ${color.lineStrong}`,
    borderRadius: 8,
    padding: '7px 9px',
    zIndex: 100,
    whiteSpace: 'nowrap',
    boxShadow: '0 12px 26px rgba(0, 0, 0, 0.42)',
  },
  tooltipTitle: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    fontSize: 12,
    fontWeight: 850,
    color: color.text,
    marginBottom: 5,
    borderBottom: `1px solid ${color.line}`,
    paddingBottom: 4,
  },
  tooltipTeam: {
    color: color.muted,
    fontSize: 10,
    fontWeight: 850,
  },
  tooltipRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 14,
    fontSize: 11,
    color: color.text,
    padding: '2px 0',
  },
  tooltipAdp: {
    color: color.muted,
    fontSize: 10,
    fontWeight: 750,
    fontVariantNumeric: 'tabular-nums',
  },
  pos: {
    fontSize: 10,
    fontWeight: 900,
    marginRight: 2,
  },
};
