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
    shell: '#ecf4ee',
    panel: '#ffffff',
    panelRaised: '#f7fbf7',
    panelSoft: '#dfeae3',
    line: '#ccdcd2',
    lineStrong: '#9ab0a3',
    text: '#101914',
    muted: '#4a5d50',
    faint: '#77877d',
    warning: '#935a0d',
    qb: '#1165b7',
    rb: '#05613d',
    wr: '#bd6414',
    te: '#6f4ab0',
  },
  dark: {
    shell: '#1a1212',
    panel: '#241b1a',
    panelRaised: '#302421',
    panelSoft: '#110c0b',
    line: '#463734',
    lineStrong: '#72554d',
    text: '#fff3ea',
    muted: '#d0bbb0',
    faint: '#9d877c',
    warning: '#ffd36a',
    qb: '#68b8ff',
    rb: '#58d28a',
    wr: '#ff7b45',
    te: '#cba0ff',
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
