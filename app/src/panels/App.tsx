import React, { useEffect, useRef, useState } from 'react';
import { Effect } from "effect";
import type { RosterPick, Player } from '../content/types';
import { runRefresh } from '../content/pipeline';
import { getActiveAdapter, type DraftPlatformAdapter } from '../content/adapters';
import {
  clearCustomRankings,
  getCustomRankings,
  parseRankingsCsv,
  saveCustomRankings,
  type CustomRankingsData,
} from '../rankings/custom-rankings';
import {
  defaultThemeSettings,
  getPlatformTheme,
  getThemeSettings,
  saveThemeSettings,
  type ThemeSettings,
} from '../settings/theme-settings';
import CapitalChart from './CapitalChart';
import OpponentsTable from './OpponentsTable';
import { color, getThemeCssVariables, type ThemeMode } from './styles';

const THREE_COLUMN_MIN_WIDTH = 1260;
const DRAFTKINGS_HORIZONTAL_MIN_WIDTH = 720;

export default function App() {
  const [adapter, setAdapter] = useState<DraftPlatformAdapter>(() => getActiveAdapter());
  const [roster, setRoster] = useState<ReadonlyArray<RosterPick>>([]);
  const [available, setAvailable] = useState<ReadonlyArray<Player>>([]);
  const [, setDraftId] = useState<string | null>(null);
  const [loadCount, setLoadCount] = useState(0);
  const [userPickNumber, setUserPickNumber] = useState(1);
  const [rankingsData, setRankingsData] = useState<CustomRankingsData | null>(null);
  const [rankingsOpen, setRankingsOpen] = useState(false);
  const [rankingsTooltipOpen, setRankingsTooltipOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rankingsText, setRankingsText] = useState('');
  const [rankingsMessage, setRankingsMessage] = useState('Paste a CSV with name, position, team, and rank columns.');
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(defaultThemeSettings);
  const settingsRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let running = false;
    let disconnected = false;
    let currentDraftId: string | null = null;

    const handler = () => {
      if (running || disconnected) return;
      running = true;
      Effect.runPromise(runRefresh).then(
        (data) => {
          running = false;
          if (disconnected) return;
          if (currentDraftId !== null && data.draftId !== currentDraftId) {
            setRoster([]);
            setAvailable([]);
          }
          currentDraftId = data.draftId;
          setAdapter(data.adapter);
          setDraftId(data.draftId);
          if (data.userPickNumber !== null) {
            setUserPickNumber(data.userPickNumber);
          }
          setRoster(data.roster);
          setAvailable(data.available);
          setLoadCount((c) => c + 1);
        },
        () => {
          running = false;
        },
      );
    };

    const observer = new MutationObserver(handler);
    observer.observe(document.body, { childList: true, subtree: true });
    handler();

    return () => {
      disconnected = true;
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    getCustomRankings(adapter.id).then(setRankingsData);
  }, [adapter.id]);

  useEffect(() => {
    getThemeSettings().then(setThemeSettings);
  }, []);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const path = event.composedPath();
      if (settingsRef.current && path.includes(settingsRef.current)) return;
      setSettingsOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [settingsOpen]);

  const refreshRankingsAnnotations = () => {
    Effect.runPromise(runRefresh).catch(() => undefined);
  };

  const importRankings = async () => {
    const result = parseRankingsCsv(rankingsText);
    if (result.rankings.length === 0) {
      setRankingsMessage('No usable rankings found. Include name, position, team, and rank.');
      return;
    }

    const saved = await saveCustomRankings(result.rankings, adapter.id);
    setRankingsData(saved);
    setRankingsMessage(`Imported ${result.rankings.length} rankings${result.skipped ? ` and skipped ${result.skipped}` : ''}.`);
    setRankingsOpen(false);
    setRankingsText('');
    refreshRankingsAnnotations();
  };

  const removeRankings = async () => {
    await clearCustomRankings(adapter.id);
    setRankingsData(null);
    setRankingsMessage('Custom rankings cleared.');
    refreshRankingsAnnotations();
  };

  const readRankingsFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      setRankingsText(text);
      const result = parseRankingsCsv(text);
      setRankingsMessage(`Ready to import ${result.rankings.length} rankings${result.skipped ? `; ${result.skipped} rows need review` : ''}.`);
    });
    event.target.value = '';
  };

  const isUnderdog = adapter.id === 'underdog';
  const isDraftKings = adapter.id === 'draftkings';
  const useThreeColumnUnderdog = isUnderdog && viewportWidth >= THREE_COLUMN_MIN_WIDTH;
  const useDraftKingsHorizontal =
    isDraftKings &&
    themeSettings.draftKingsPane === 'horizontal' &&
    viewportWidth >= DRAFTKINGS_HORIZONTAL_MIN_WIDTH;
  const activeTheme = getPlatformTheme(themeSettings, adapter.id);
  const themeVariables = getThemeCssVariables(activeTheme);

  useEffect(() => {
    const host = document.getElementById('draft-helper-root');
    if (!host) return;
    const variables = getThemeCssVariables(activeTheme) as Record<string, string>;
    Object.entries(variables).forEach(([key, value]) => {
      host.style.setProperty(key, value);
    });
    host.dataset.dhTheme = activeTheme;
  }, [activeTheme]);

  useEffect(() => {
    const host = document.getElementById('draft-helper-root');
    if (!host) return;

    if (adapter.id !== 'draftkings') {
      delete host.dataset.dhPane;
      document.querySelectorAll('[data-dh-draftkings-layout]').forEach((el) => {
        delete (el as HTMLElement).dataset.dhDraftkingsLayout;
      });
      return;
    }

    host.dataset.dhPane = themeSettings.draftKingsPane;
    document.querySelectorAll('[data-dh-draftkings-layout]').forEach((el) => {
      delete (el as HTMLElement).dataset.dhDraftkingsLayout;
    });

    if (themeSettings.draftKingsPane === 'horizontal') {
      const draftTable = document.querySelector('[class*="LiveDraft_draft-table"]');
      const queue = document.querySelector('[class*="LiveDraft_queue"]');
      const parent = draftTable?.parentElement ?? queue?.parentElement ?? null;
      if (!parent) return;

      (parent as HTMLElement).dataset.dhDraftkingsLayout = 'horizontal';
      const firstDraftArea = [draftTable, queue]
        .filter((el): el is Element => el !== null)
        .sort((a, b) => {
          if (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING) return 1;
          return -1;
        })[0];
      parent.insertBefore(host, firstDraftArea ?? parent.firstChild);
      return;
    }

    delete host.dataset.dhPane;
    const mountPoint = adapter.ui.findMountPoint();
    if (mountPoint && host.parentElement !== mountPoint) {
      adapter.ui.placeMount(host, mountPoint);
    }
  }, [adapter, themeSettings.draftKingsPane]);

  const updatePlatformTheme = (platformId: keyof ThemeSettings['platformThemes'], mode: ThemeMode) => {
    const next = {
      ...themeSettings,
      platformThemes: {
        ...themeSettings.platformThemes,
        [platformId]: mode,
      },
    };
    setThemeSettings(next);
    saveThemeSettings(next).catch(() => undefined);
  };

  const resetThemeDefaults = () => {
    setThemeSettings(defaultThemeSettings);
    saveThemeSettings(defaultThemeSettings).catch(() => undefined);
  };

  const updateDraftKingsPane = (pane: ThemeSettings['draftKingsPane']) => {
    const next = {
      ...themeSettings,
      draftKingsPane: pane,
    };
    setThemeSettings(next);
    saveThemeSettings(next).catch(() => undefined);
  };

  const appStyle = useDraftKingsHorizontal
    ? styles.appDraftKingsHorizontal
    : isUnderdog
      ? (useThreeColumnUnderdog ? styles.appWideThree : styles.appWideTwo)
      : styles.app;

  return (
    <div style={{ ...appStyle, ...themeVariables }}>
      <div style={isUnderdog || useDraftKingsHorizontal ? styles.leftColumn : undefined}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.titleRow}>
              <div style={styles.title}>Corollary</div>
              <span
                style={styles.tooltipAnchor}
                onMouseEnter={() => setRankingsTooltipOpen(true)}
                onMouseLeave={() => setRankingsTooltipOpen(false)}
              >
                <button
                  type="button"
                  style={styles.rankingsButton}
                  aria-describedby={rankingsTooltipOpen ? 'dh-rankings-tooltip' : undefined}
                  onFocus={() => setRankingsTooltipOpen(true)}
                  onBlur={() => setRankingsTooltipOpen(false)}
                  onClick={() => {
                    setRankingsTooltipOpen(false);
                    setRankingsOpen(true);
                  }}
                >
                  Rankings
                </button>
                {rankingsTooltipOpen ? (
                  <span id="dh-rankings-tooltip" role="tooltip" style={styles.tooltip}>
                    Import {adapter.label} rankings
                  </span>
                ) : null}
              </span>
              <span ref={settingsRef} style={styles.settingsAnchor}>
                <button
                  type="button"
                  style={styles.settingsButton}
                  aria-label="Settings"
                  aria-expanded={settingsOpen}
                  aria-controls="dh-settings-menu"
                  onClick={() => setSettingsOpen((open) => !open)}
                >
                  <SettingsIcon />
                </button>
                {settingsOpen ? (
                  <div id="dh-settings-menu" style={styles.settingsMenu}>
                    <div style={styles.settingsTitle}>Theme</div>
                    <ThemeRow
                      label="DraftKings"
                      value={themeSettings.platformThemes.draftkings}
                      onChange={(mode) => updatePlatformTheme('draftkings', mode)}
                    />
                    <ThemeRow
                      label="Underdog"
                      value={themeSettings.platformThemes.underdog}
                      onChange={(mode) => updatePlatformTheme('underdog', mode)}
                    />
                    <div style={styles.settingsDivider} />
                    <div style={styles.settingsTitle}>DraftKings pane</div>
                    <PaneRow value={themeSettings.draftKingsPane} onChange={updateDraftKingsPane} />
                    <button type="button" style={styles.resetButton} onClick={resetThemeDefaults}>
                      Defaults
                    </button>
                  </div>
                ) : null}
              </span>
            </div>
          </div>
          <div
            style={styles.pickStatus}
            title={`Detected from the active ${adapter.label} draft page. Synced ${loadCount} times.`}
          >
            Pick #{userPickNumber}
          </div>
        </div>

        <CapitalChart
          roster={roster as RosterPick[]}
          userPickNumber={userPickNumber}
          adapter={adapter}
          fillHeight={isUnderdog}
        />
      </div>

      <div style={isUnderdog || useDraftKingsHorizontal ? styles.matchupsColumn : undefined}>
        <OpponentsTable
          roster={roster as RosterPick[]}
          available={available as Player[]}
          limit={useThreeColumnUnderdog ? 4 : undefined}
          maxVisibleRows={isUnderdog ? (useThreeColumnUnderdog ? 4 : 6) : useDraftKingsHorizontal ? 6 : undefined}
        />
      </div>
      {useThreeColumnUnderdog ? (
        <div style={styles.matchupsColumn}>
          <OpponentsTable
            roster={roster as RosterPick[]}
            available={available as Player[]}
            startIndex={4}
            maxVisibleRows={4}
            showHeader={false}
            emptyMessage="More picks will appear here."
          />
        </div>
      ) : null}
      {rankingsOpen ? (
        <div style={styles.modalBackdrop} role="presentation" onClick={() => setRankingsOpen(false)}>
          <div style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="dh-rankings-title" onClick={(event) => event.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div id="dh-rankings-title" style={styles.modalTitle}>{adapter.label} Rankings</div>
                <div style={styles.modalMeta}>
                  {rankingsData ? `${rankingsData.rankings.length} saved` : 'No rankings saved'}
                </div>
              </div>
              <button type="button" style={styles.iconButton} aria-label="Close rankings import" onClick={() => setRankingsOpen(false)}>
                x
              </button>
            </div>

            <label style={styles.fileButton}>
              <input type="file" accept=".csv,text/csv" style={styles.fileInput} onChange={readRankingsFile} />
              Choose CSV
            </label>

            <textarea
              style={styles.rankingsTextarea}
              value={rankingsText}
              placeholder={'name,position,team,rank\nPlayer Name,RB,DET,1'}
              onChange={(event) => {
                setRankingsText(event.target.value);
                setRankingsMessage('Paste a CSV with name, position, team, and rank columns.');
              }}
            />

            <div style={styles.modalMessage}>{rankingsMessage}</div>

            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryButton} onClick={removeRankings} disabled={!rankingsData}>
                Clear
              </button>
              <button type="button" style={styles.primaryButton} onClick={importRankings}>
                Import
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={styles.settingsIcon}>
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
      <path d="M19.4 13.4c.1-.5.1-.9.1-1.4s0-.9-.1-1.4l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2.3-1.3L14.4 3h-4.8l-.4 2.4a8 8 0 0 0-2.3 1.3l-2.4-1-2 3.4 2 1.5c-.1.5-.1.9-.1 1.4s0 .9.1 1.4l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2.3 1.3l.4 2.4h4.8l.4-2.4a8 8 0 0 0 2.3-1.3l2.4 1 2-3.4-2.1-1.5Z" />
    </svg>
  );
}

function ThemeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}) {
  return (
    <div style={styles.themeRow}>
      <span style={styles.themeLabel}>{label}</span>
      <span style={styles.segmentedControl}>
        <button
          type="button"
          style={value === 'light' ? { ...styles.segmentButton, ...styles.segmentButtonActive } : styles.segmentButton}
          onClick={() => onChange('light')}
        >
          Light
        </button>
        <button
          type="button"
          style={value === 'dark' ? { ...styles.segmentButton, ...styles.segmentButtonActive } : styles.segmentButton}
          onClick={() => onChange('dark')}
        >
          Dark
        </button>
      </span>
    </div>
  );
}

function PaneRow({
  value,
  onChange,
}: {
  value: ThemeSettings['draftKingsPane'];
  onChange: (pane: ThemeSettings['draftKingsPane']) => void;
}) {
  return (
    <div style={styles.paneRow}>
      <span style={styles.segmentedControl}>
        <button
          type="button"
          style={value === 'vertical' ? { ...styles.segmentButton, ...styles.segmentButtonActive } : styles.segmentButton}
          onClick={() => onChange('vertical')}
        >
          Vertical
        </button>
        <button
          type="button"
          style={value === 'horizontal' ? { ...styles.segmentButton, ...styles.segmentButtonActive } : styles.segmentButton}
          onClick={() => onChange('horizontal')}
        >
          Horizontal
        </button>
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minWidth: 300,
  },
  appDraftKingsHorizontal: {
    display: 'grid',
    gridTemplateColumns: 'minmax(292px, 360px) minmax(360px, 560px)',
    gap: 12,
    alignItems: 'start',
    width: '100%',
    minWidth: 0,
  },
  appWideThree: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 360px) repeat(2, minmax(360px, 520px))',
    gap: 12,
    alignItems: 'start',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 1424,
    margin: '0 auto',
    minWidth: 0,
  },
  appWideTwo: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 360px) minmax(360px, 560px)',
    gap: 12,
    alignItems: 'start',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 932,
    margin: '0 auto',
    minWidth: 0,
  },
  leftColumn: {
    minWidth: 0,
    maxWidth: 360,
  },
  matchupsColumn: {
    minWidth: 0,
    maxWidth: 520,
  },
  topbar: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  title: {
    color: color.text,
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1.1,
  },
  titleRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
  },
  subtitle: {
    color: color.muted,
    fontSize: 10.5,
    fontWeight: 700,
    lineHeight: 1.2,
    marginTop: 3,
  },
  pickStatus: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: color.text,
    background: color.panel,
    border: `1px solid ${color.lineStrong}`,
    borderRadius: 999,
    padding: '4px 8px',
    fontSize: 11,
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
  },
  rankingsButton: {
    appearance: 'none',
    border: `1px solid ${color.lineStrong}`,
    borderRadius: 8,
    background: color.panelRaised,
    color: color.text,
    padding: '4px 8px',
    minHeight: 24,
    fontSize: 10,
    fontWeight: 900,
    lineHeight: 1,
    cursor: 'pointer',
  },
  settingsAnchor: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  },
  settingsButton: {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    border: '0',
    borderRadius: 8,
    background: 'transparent',
    color: color.faint,
    cursor: 'pointer',
  },
  settingsIcon: {
    display: 'block',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
  settingsMenu: {
    position: 'absolute',
    top: 'calc(100% + 7px)',
    left: 0,
    zIndex: 30,
    width: 244,
    padding: 10,
    border: '0',
    borderRadius: 10,
    background: color.panel,
    color: color.text,
    boxShadow: '0 14px 28px rgba(0, 0, 0, 0.26)',
  },
  settingsTitle: {
    color: color.text,
    fontSize: 11,
    fontWeight: 900,
    lineHeight: 1,
    marginBottom: 9,
  },
  themeRow: {
    display: 'grid',
    gridTemplateColumns: '74px 1fr',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  paneRow: {
    marginBottom: 8,
  },
  settingsDivider: {
    height: 1,
    background: color.line,
    margin: '2px 0 10px',
  },
  themeLabel: {
    color: color.muted,
    fontSize: 10,
    fontWeight: 850,
    lineHeight: 1,
  },
  segmentedControl: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    padding: 2,
    border: `1px solid ${color.line}`,
    borderRadius: 8,
    background: color.panelSoft,
  },
  segmentButton: {
    appearance: 'none',
    border: '0',
    borderRadius: 6,
    background: 'transparent',
    color: color.muted,
    minHeight: 24,
    padding: '0 7px',
    fontSize: 10,
    fontWeight: 900,
    cursor: 'pointer',
  },
  segmentButtonActive: {
    background: color.text,
    color: color.panel,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.18)',
  },
  resetButton: {
    appearance: 'none',
    width: '100%',
    height: 26,
    border: `1px solid ${color.lineStrong}`,
    borderRadius: 8,
    background: color.panelRaised,
    color: color.text,
    fontSize: 10,
    fontWeight: 900,
    cursor: 'pointer',
    marginTop: 2,
  },
  tooltipAnchor: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  },
  tooltip: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 20,
    width: 'max-content',
    maxWidth: 190,
    padding: '5px 7px',
    border: `1px solid ${color.lineStrong}`,
    borderRadius: 8,
    background: color.panel,
    color: color.text,
    boxShadow: '0 8px 18px rgba(16, 24, 32, 0.2)',
    fontSize: 10,
    fontWeight: 850,
    lineHeight: 1.1,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    background: 'rgba(16, 24, 32, 0.34)',
  },
  modal: {
    width: 'min(420px, calc(100vw - 24px))',
    maxHeight: 'calc(100vh - 24px)',
    overflow: 'auto',
    borderRadius: 12,
    border: `1px solid ${color.lineStrong}`,
    background: color.panel,
    color: color.text,
    padding: 12,
    boxShadow: '0 16px 34px rgba(16, 24, 32, 0.3)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  modalTitle: {
    color: color.text,
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.15,
  },
  modalMeta: {
    color: color.muted,
    fontSize: 10,
    fontWeight: 800,
    lineHeight: 1,
    marginTop: 4,
  },
  iconButton: {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    border: `1px solid ${color.line}`,
    borderRadius: 8,
    background: color.panelRaised,
    color: color.text,
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1,
    cursor: 'pointer',
  },
  fileButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
    padding: '0 9px',
    border: `1px solid ${color.lineStrong}`,
    borderRadius: 8,
    background: color.panelRaised,
    color: color.text,
    fontSize: 10,
    fontWeight: 900,
    cursor: 'pointer',
    marginBottom: 8,
  },
  fileInput: {
    display: 'none',
  },
  rankingsTextarea: {
    display: 'block',
    width: '100%',
    minHeight: 120,
    resize: 'vertical',
    border: `1px solid ${color.lineStrong}`,
    borderRadius: 8,
    background: color.panelSoft,
    color: color.text,
    padding: 8,
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1.35,
  },
  modalMessage: {
    minHeight: 16,
    color: color.muted,
    fontSize: 10,
    fontWeight: 800,
    lineHeight: 1.25,
    marginTop: 7,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 7,
    marginTop: 10,
  },
  primaryButton: {
    appearance: 'none',
    height: 26,
    border: `1px solid ${color.text}`,
    borderRadius: 8,
    background: color.text,
    color: color.panel,
    padding: '0 10px',
    fontSize: 10,
    fontWeight: 900,
    cursor: 'pointer',
  },
  secondaryButton: {
    appearance: 'none',
    height: 26,
    border: `1px solid ${color.lineStrong}`,
    borderRadius: 8,
    background: color.panel,
    color: color.text,
    padding: '0 10px',
    fontSize: 10,
    fontWeight: 900,
    cursor: 'pointer',
  },
};
