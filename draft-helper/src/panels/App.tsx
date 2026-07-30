import React, { useEffect, useState } from 'react';
import { Effect } from "effect";
import type { RosterPick, Player } from '../content/types';
import { runRefresh } from '../content/pipeline';
import CapitalChart from './CapitalChart';
import OpponentsTable from './OpponentsTable';
import { color } from './styles';

export default function App() {
  const [roster, setRoster] = useState<ReadonlyArray<RosterPick>>([]);
  const [available, setAvailable] = useState<ReadonlyArray<Player>>([]);
  const [, setDraftId] = useState<string | null>(null);
  const [loadCount, setLoadCount] = useState(0);
  const [userPickNumber, setUserPickNumber] = useState(1);
  const [useAdpCapital, setUseAdpCapital] = useState(false);

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
          setDraftId(data.draftId);
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

  return (
    <div style={styles.app}>
      <div style={styles.topbar}>
        <div>
          <div style={styles.title}>Draft Helper</div>
        </div>
        <div style={styles.liveStatus} title={`Synced ${loadCount} times`}>
          <span style={styles.liveDot} />
          live
        </div>
      </div>

      <div style={styles.controls}>
        <label style={styles.pickLabel}>
          Pick
          <input
            type="number"
            min={1}
            max={12}
            aria-label="Your draft position"
            value={userPickNumber}
            onChange={(e) => setUserPickNumber(Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 1)))}
            style={styles.pickInput}
          />
          <span style={styles.pickMax}>of 12</span>
        </label>
        <div style={styles.segmented} aria-label="Draft capital mode">
          <button
            type="button"
            onClick={() => setUseAdpCapital(false)}
            style={{
              ...styles.segment,
              ...(useAdpCapital ? null : styles.segmentActive),
            }}
            aria-pressed={!useAdpCapital}
          >
            Actual
          </button>
          <button
            type="button"
            onClick={() => setUseAdpCapital(true)}
            style={{
              ...styles.segment,
              ...(useAdpCapital ? styles.segmentActive : null),
            }}
            aria-pressed={useAdpCapital}
          >
            ADP
          </button>
        </div>
      </div>
      <CapitalChart roster={roster as RosterPick[]} userPickNumber={userPickNumber} useAdp={useAdpCapital} />
      <OpponentsTable roster={roster as RosterPick[]} available={available as Player[]} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minWidth: 300,
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
  subtitle: {
    color: color.muted,
    fontSize: 10.5,
    fontWeight: 700,
    lineHeight: 1.2,
    marginTop: 3,
  },
  liveStatus: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    color: color.muted,
    background: color.panelRaised,
    border: `1px solid ${color.line}`,
    borderRadius: 999,
    padding: '4px 7px',
    fontSize: 10,
    fontWeight: 800,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: '#1fbf75',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
    padding: 7,
    borderRadius: 11,
    background: color.panelRaised,
    border: `1px solid ${color.line}`,
  },
  pickLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: color.muted,
    fontSize: 11,
    fontWeight: 750,
  },
  pickInput: {
    width: 38,
    height: 25,
    borderRadius: 8,
    border: `1px solid ${color.lineStrong}`,
    background: color.panel,
    color: color.text,
    fontSize: 12,
    fontWeight: 800,
    textAlign: 'center',
    fontVariantNumeric: 'tabular-nums',
  },
  pickMax: {
    color: color.faint,
    fontSize: 10,
    fontWeight: 650,
  },
  segmented: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    borderRadius: 8,
    background: color.panel,
    border: `1px solid ${color.line}`,
    padding: 2,
  },
  segment: {
    minWidth: 52,
    height: 24,
    border: 0,
    borderRadius: 7,
    background: 'transparent',
    color: color.muted,
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 800,
  },
  segmentActive: {
    background: color.text,
    color: '#ffffff',
    boxShadow: '0 2px 6px rgba(16, 24, 32, 0.18)',
  },
};
