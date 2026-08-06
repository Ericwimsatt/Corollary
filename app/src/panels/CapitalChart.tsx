import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RosterPick, Position } from '../content/types';
import type { DraftPlatformAdapter } from '../content/adapters';
import { color, positionColor } from './styles';

interface Props {
  roster: RosterPick[];
  userPickNumber: number;
  adapter: DraftPlatformAdapter;
  fillHeight?: boolean;
  /** Render per-player segments inside each bar with hover tooltips. */
  segmented?: boolean;
}

interface PlayerSegment {
  pick: RosterPick;
  capital: number;
  overall: number;
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
  maxCapital: number;
  segments: PlayerSegment[];
}

function formatCapital(val: number): string {
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return String(val);
}

export default function CapitalChart({ roster, userPickNumber, adapter, fillHeight = false, segmented = false }: Props) {
  const groups: PosGroup[] = adapter.capitalCeilings.map((g) => {
    const players = roster.filter((p) => g.pos.includes(p.position));
    const segments: PlayerSegment[] = players.map((p) => {
      const rosterIndex = roster.indexOf(p);
      const pk = overallFromUserPick(rosterIndex, userPickNumber, adapter.teamCount);
      const cap = adapter.draftCapital(pk);
      return { pick: p, capital: cap, overall: pk };
    });
    const capital = segments.reduce((sum, s) => sum + s.capital, 0);
    const pct = (capital / g.maxCapital) * 100;
    return {
      label: g.label,
      capital,
      count: players.length,
      pct,
      maxCapital: g.maxCapital,
      segments,
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
                {segmented && g.segments.length > 0 ? (
                  <SegmentedFill
                    group={g}
                    posColor={posColor}
                    fillHeight={fillHeight}
                  />
                ) : (
                  <div
                    style={{
                      ...styles.barFill,
                      ...(fillHeight ? styles.barFillStretch : {}),
                      width: `${Math.max(g.pct, 2)}%`,
                      backgroundColor: posColor,
                    }}
                  />
                )}
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

interface SegmentedFillProps {
  group: PosGroup;
  posColor: string;
  fillHeight: boolean;
}

function SegmentedFill({ group, posColor, fillHeight }: SegmentedFillProps) {
  const [hover, setHover] = useState<{ seg: PlayerSegment; rect: DOMRect } | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hover) return;
    const update = () => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      setHover((prev) => (prev ? { ...prev, rect } : prev));
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [hover]);

  const totalCap = Math.max(group.capital, 1);
  const trackPct = Math.min((group.capital / group.maxCapital) * 100, 100);

  const tooltipContainer = trackRef.current?.getRootNode() instanceof ShadowRoot
    ? trackRef.current.getRootNode() as ShadowRoot
    : document.body;

  const tooltipStyle: React.CSSProperties = hover
    ? {
        ...styles.tooltip,
        top: hover.rect.top + hover.rect.height + 7,
        left: hover.rect.left + hover.rect.width / 2,
      }
    : styles.tooltip;

  return (
    <div
      ref={trackRef}
      style={{
        position: 'absolute',
        inset: -1,
        display: 'flex',
        borderRadius: 999,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {group.segments.map((seg, i) => {
        const segPct = (seg.capital / totalCap) * trackPct;
        return (
          <div
            key={`${seg.pick.name}-${i}`}
            style={{
              width: `${segPct}%`,
              height: '100%',
              backgroundColor: posColor,
              opacity: 1,
              boxShadow: i > 0 ? 'inset 1px 0 0 rgba(255,255,255,.45)' : undefined,
              pointerEvents: 'auto',
              cursor: 'help',
            }}
            onMouseEnter={(e) => {
              const target = e.currentTarget;
              setHover({ seg, rect: target.getBoundingClientRect() });
            }}
            onMouseLeave={() => setHover(null)}
          />
        );
      })}
      {hover && createPortal(
        <div style={tooltipStyle}>
          <div style={styles.tooltipTitle}>
            <span>{hover.seg.pick.name}</span>
            <span style={styles.tooltipTeam}>{hover.seg.pick.team}</span>
          </div>
          <div style={styles.tooltipRow}>
            <span><span style={{ ...styles.tooltipPos, color: posColor }}>{hover.seg.pick.position}</span> Pick {hover.seg.overall}</span>
            <span style={styles.tooltipAdp}>${formatCapital(hover.seg.capital)}</span>
          </div>
          <div style={styles.tooltipRow}>
            <span style={styles.tooltipMuted}>Round {hover.seg.pick.round} · ADP {hover.seg.pick.adp.toFixed(1)}</span>
          </div>
        </div>,
        tooltipContainer,
      )}
    </div>
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
    position: 'relative',
    color: color.muted,
    fontSize: 10,
    fontWeight: 800,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    zIndex: 3,
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
    gap: 14,
    fontSize: 11.5,
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
    gap: 16,
    fontSize: 10.5,
    fontWeight: 800,
    color: color.text,
    padding: '2px 0',
    fontVariantNumeric: 'tabular-nums',
  },
  tooltipAdp: {
    color: color.text,
    fontSize: 10.5,
    fontWeight: 850,
    fontVariantNumeric: 'tabular-nums',
  },
  tooltipMuted: {
    color: color.muted,
    fontSize: 10,
    fontWeight: 700,
  },
  tooltipPos: {
    fontSize: 10,
    fontWeight: 900,
    marginRight: 3,
  },
};
