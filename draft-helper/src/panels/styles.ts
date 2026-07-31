import type React from 'react';

export type ThemeMode = 'light' | 'dark';

export interface ThemePalette {
  shell: string;
  panel: string;
  panelRaised: string;
  panelSoft: string;
  line: string;
  lineStrong: string;
  text: string;
  muted: string;
  faint: string;
  warning: string;
  qb: string;
  rb: string;
  wr: string;
  te: string;
}

export const themePalettes: Record<ThemeMode, ThemePalette> = {
  light: {
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
  },
  dark: {
    shell: '#111820',
    panel: '#17212b',
    panelRaised: '#202b36',
    panelSoft: '#121b24',
    line: '#2f3c48',
    lineStrong: '#4b5b68',
    text: '#edf5fb',
    muted: '#a6b4c0',
    faint: '#788895',
    warning: '#f1bd5b',
    qb: '#58a6ff',
    rb: '#4fd08b',
    wr: '#f2a43a',
    te: '#b58cff',
  },
};

export const color = {
  shell: 'var(--dh-shell)',
  panel: 'var(--dh-panel)',
  panelRaised: 'var(--dh-panel-raised)',
  panelSoft: 'var(--dh-panel-soft)',
  line: 'var(--dh-line)',
  lineStrong: 'var(--dh-line-strong)',
  text: 'var(--dh-text)',
  muted: 'var(--dh-muted)',
  faint: 'var(--dh-faint)',
  warning: 'var(--dh-warning)',
  qb: 'var(--dh-qb)',
  rb: 'var(--dh-rb)',
  wr: 'var(--dh-wr)',
  te: 'var(--dh-te)',
} as const;

export const positionColor = {
  QB: color.qb,
  RB: color.rb,
  WR: color.wr,
  TE: color.te,
} as const;

export function getThemeCssVariables(mode: ThemeMode): React.CSSProperties {
  const palette = themePalettes[mode];
  return {
    '--dh-shell': palette.shell,
    '--dh-panel': palette.panel,
    '--dh-panel-raised': palette.panelRaised,
    '--dh-panel-soft': palette.panelSoft,
    '--dh-line': palette.line,
    '--dh-line-strong': palette.lineStrong,
    '--dh-text': palette.text,
    '--dh-muted': palette.muted,
    '--dh-faint': palette.faint,
    '--dh-warning': palette.warning,
    '--dh-qb': palette.qb,
    '--dh-rb': palette.rb,
    '--dh-wr': palette.wr,
    '--dh-te': palette.te,
  } as React.CSSProperties;
}

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
