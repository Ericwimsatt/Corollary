import type React from 'react';

export const color = {
  shell: '#edf2f5',
  panel: '#ffffff',
  panelRaised: '#f7fafb',
  panelSoft: '#f1f5f7',
  line: '#d8e1e7',
  lineStrong: '#b7c6d0',
  text: '#101820',
  muted: '#536273',
  faint: '#7b8794',
  warning: '#9b6200',
  qb: '#1570d6',
  rb: '#168a52',
  wr: '#c96d00',
  te: '#7b43c4',
} as const;

export const positionColor = {
  QB: color.qb,
  RB: color.rb,
  WR: color.wr,
  TE: color.te,
} as const;

export const styles = {
  section: {
    paddingTop: 12,
    borderTop: `1px solid ${color.line}`,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 7,
  },
  heading: {
    color: color.text,
    fontSize: 12,
    fontWeight: 850,
    lineHeight: 1.2,
    letterSpacing: 0,
  },
  meta: {
    color: color.muted,
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  empty: {
    color: color.muted,
    fontSize: 11,
    lineHeight: 1.35,
    padding: '8px 10px',
    border: `1px solid ${color.line}`,
    borderRadius: 10,
    background: color.panelSoft,
  },
  focusRing: {
    outline: `2px solid ${color.qb}`,
    outlineOffset: 2,
  },
} satisfies Record<string, React.CSSProperties>;
