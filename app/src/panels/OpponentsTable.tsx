import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Option } from "effect";
import type { RosterPick, Player } from '../content/types';
import { getOpponents } from '../data/schedule';
import type { OpponentRow } from '../data/schedule';
import { getTeamInfo } from '../data/teams';
import { color, positionColor, styles as sharedStyles } from './styles';
import { playerKey } from '../content/player-key';

const MATCHUP_HEADER_HEIGHT = 21;
const MATCHUP_ROW_HEIGHT = 34;
const COMPACT_MATCHUP_HEADER_HEIGHT = 18;
const COMPACT_MATCHUP_ROW_HEIGHT = 25;

interface Props {
  roster: RosterPick[];
  available: Player[];
  maxVisibleRows?: number;
  startIndex?: number;
  limit?: number;
  title?: string;
  showHeader?: boolean;
  emptyMessage?: string;
  flushTop?: boolean;
  compactRows?: boolean;
}

function Pill({ abbr, players, compact = false }: { abbr: string; players: Player[]; compact?: boolean }) {
  const [show, setShow] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const info = getTeamInfo(abbr);

  const updateAnchorRect = () => {
    setAnchorRect(anchorRef.current?.getBoundingClientRect() ?? null);
  };

  useEffect(() => {
    if (!show) return;

    updateAnchorRect();
    window.addEventListener('scroll', updateAnchorRect, true);
    window.addEventListener('resize', updateAnchorRect);
    return () => {
      window.removeEventListener('scroll', updateAnchorRect, true);
      window.removeEventListener('resize', updateAnchorRect);
    };
  }, [show]);

  if (!info) return <span style={styles.missingOpponent}>{abbr}</span>;
  const textStyle = getPillTextStyle(info.primaryColor);

  const top = [...players]
    .filter(p => p.team === abbr && p.adp > 0)
    .sort((a, b) => a.adp - b.adp)
    .slice(0, 5);

  const tooltipContainer = anchorRef.current?.getRootNode() instanceof ShadowRoot
    ? anchorRef.current.getRootNode() as ShadowRoot
    : null;
  const tooltipStyle = anchorRect
    ? {
        ...styles.tooltip,
        top: anchorRect.bottom + 6,
        left: anchorRect.left + anchorRect.width / 2,
      }
    : styles.tooltip;

  return (
    <div
      ref={anchorRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => {
        updateAnchorRect();
        setShow(true);
      }}
      onMouseLeave={() => setShow(false)}
    >
      <span
        style={{
          ...styles.pill,
          ...(compact ? styles.pillCompact : {}),
          backgroundColor: info.primaryColor,
          borderColor: textStyle.borderColor,
        }}
      >
        <span style={{ ...styles.pillText, ...(compact ? styles.pillTextCompact : {}), ...textStyle }}>{abbr}</span>
        <span
          aria-hidden="true"
          style={{
            ...styles.pillEndcap,
            ...(compact ? styles.pillEndcapCompact : {}),
            backgroundColor: info.secondaryColor,
          }}
        />
      </span>
      {show && top.length > 0 && tooltipContainer ? createPortal(
        <div style={tooltipStyle}>
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
        </div>,
        tooltipContainer,
      ) : null}
    </div>
  );
}

function getPillTextStyle(background: string): React.CSSProperties {
  const blackContrast = contrastRatio('#000000', background);
  const whiteContrast = contrastRatio('#ffffff', background);
  if (blackContrast >= whiteContrast) {
    return {
      color: '#000000',
      borderColor: 'rgba(16, 24, 32, 0.18)',
      textShadow: 'none',
    };
  }
  return {
    color: '#ffffff',
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

export default function OpponentsTable({
  roster,
  available,
  maxVisibleRows,
  startIndex = 0,
  limit,
  title = 'Playoff Matchups',
  showHeader = true,
  emptyMessage = 'Draft players to see playoff opponents.',
  flushTop = false,
  compactRows = false,
}: Props) {
  // Display ordering belongs here, not in the persisted roster. QBs form the
  // first group; draft order is preserved explicitly within both groups.
  const ordered = [...roster].sort((a, b) => {
    const positionDelta = Number(b.position === 'QB') - Number(a.position === 'QB');
    return positionDelta || a.overallPick - b.overallPick;
  }).slice(0, 15);
  const rows = ordered.slice(startIndex, limit ? startIndex + limit : undefined);
  const tableWrapStyle = maxVisibleRows
    ? {
        ...styles.tableScroll,
        maxHeight: (compactRows ? COMPACT_MATCHUP_HEADER_HEIGHT : MATCHUP_HEADER_HEIGHT)
          + maxVisibleRows * (compactRows ? COMPACT_MATCHUP_ROW_HEIGHT : MATCHUP_ROW_HEIGHT),
      }
    : undefined;

  return (
    <section
      style={flushTop ? { ...styles.container, ...styles.containerFlush } : styles.container}
      aria-label="Playoff opponents"
    >
      {showHeader ? (
        <div style={sharedStyles.sectionHeader}>
          <h3 style={sharedStyles.heading}>{title}</h3>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p style={sharedStyles.empty}>{emptyMessage}</p>
      ) : (
        <div style={tableWrapStyle}>
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
              {rows.map((pick, i) => {
                const opps = pick.team
                  ? getOpponents(pick.team)
                  : Option.none<OpponentRow>();
                const week15 = Option.isSome(opps) ? opps.value.week15 : '—';
                const week16 = Option.isSome(opps) ? opps.value.week16 : '—';
                const week17 = Option.isSome(opps) ? opps.value.week17 : '—';
                return (
                  <tr key={`${playerKey(pick)}-${pick.overallPick}-${startIndex + i}`}>
                    <td style={compactRows ? { ...styles.td, ...styles.tdCompact } : styles.td}>
                      <div style={styles.playerCell}>
                        <div style={styles.playerText}>
                          {compactRows ? (
                            <div style={styles.compactPlayerLine}>
                              <span style={{ ...styles.playerNameCompact, color: positionColor[pick.position] }}>
                                {pick.name}
                              </span>
                              {pick.team ? <span style={styles.compactTeam}>· {pick.team}</span> : null}
                            </div>
                          ) : (
                            <>
                              <div style={{ ...styles.playerName, color: positionColor[pick.position] }}>{pick.name}</div>
                              <div style={styles.playerTeam}>
                                {pick.team ? getTeamInfo(pick.team)?.name ?? pick.team : pick.team}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={compactRows ? { ...styles.td, ...styles.tdCompact } : styles.td}>
                      <Pill abbr={week15} players={available} compact={compactRows} />
                    </td>
                    <td style={compactRows ? { ...styles.td, ...styles.tdCompact } : styles.td}>
                      <Pill abbr={week16} players={available} compact={compactRows} />
                    </td>
                    <td style={compactRows ? { ...styles.td, ...styles.tdCompact } : styles.td}>
                      <Pill abbr={week17} players={available} compact={compactRows} />
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
    ...sharedStyles.section,
  },
  containerFlush: {
    paddingTop: 0,
    borderTop: 0,
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    fontSize: 10.5,
  },
  tableScroll: {
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingRight: 4,
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
    padding: '4px 5px',
    color: color.text,
    borderBottom: `1px solid ${color.line}`,
    verticalAlign: 'middle',
  },
  tdCompact: {
    padding: '2px 5px',
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
    fontSize: 12,
    fontWeight: 900,
    lineHeight: 1.15,
    maxWidth: 126,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  playerNameCompact: {
    fontSize: 10.5,
    fontWeight: 900,
    lineHeight: 1.05,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
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
  compactPlayerLine: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 3,
    minWidth: 0,
  },
  compactTeam: {
    color: color.muted,
    fontSize: 8.5,
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    flex: '0 0 auto',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 44,
    minHeight: 22,
    overflow: 'hidden',
    borderRadius: 7,
    border: '1px solid transparent',
    lineHeight: 1,
    cursor: 'default',
    boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.12)',
  },
  pillCompact: {
    minHeight: 20,
  },
  pillText: {
    display: 'block',
    minWidth: 34,
    padding: '5px 6px 4px',
    fontSize: 10,
    fontWeight: 900,
    lineHeight: 1,
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
  },
  pillTextCompact: {
    padding: '4px 6px 3px',
    fontSize: 9.5,
  },
  pillEndcap: {
    alignSelf: 'stretch',
    width: 9,
    minHeight: 20,
    flex: '0 0 9px',
  },
  pillEndcapCompact: {
    minHeight: 18,
  },
  missingOpponent: {
    color: color.faint,
    fontSize: 10,
    fontWeight: 800,
  },
  tooltip: {
    position: 'fixed',
    transform: 'translateX(-50%)',
    background: color.panel,
    border: `1px solid ${color.lineStrong}`,
    borderRadius: 8,
    padding: '7px 9px',
    zIndex: 2147483647,
    whiteSpace: 'nowrap',
    boxShadow: '0 12px 26px rgba(0, 0, 0, 0.42)',
    pointerEvents: 'none',
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
