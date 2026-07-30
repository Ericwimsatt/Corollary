import React, { useEffect, useState } from 'react';
import { Effect } from "effect";
import type { RosterPick, Player } from '../content/types';
import { runRefresh } from '../content/pipeline';
import {
  clearCustomRankings,
  getCustomRankings,
  parseRankingsCsv,
  saveCustomRankings,
  type CustomRankingsData,
} from '../rankings/custom-rankings';
import CapitalChart from './CapitalChart';
import OpponentsTable from './OpponentsTable';
import { color } from './styles';

export default function App() {
  const [roster, setRoster] = useState<ReadonlyArray<RosterPick>>([]);
  const [available, setAvailable] = useState<ReadonlyArray<Player>>([]);
  const [, setDraftId] = useState<string | null>(null);
  const [loadCount, setLoadCount] = useState(0);
  const [userPickNumber, setUserPickNumber] = useState(1);
  const [rankingsData, setRankingsData] = useState<CustomRankingsData | null>(null);
  const [rankingsOpen, setRankingsOpen] = useState(false);
  const [rankingsText, setRankingsText] = useState('');
  const [rankingsMessage, setRankingsMessage] = useState('Paste a CSV with name, position, team, and rank columns.');

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
    getCustomRankings().then(setRankingsData);
  }, []);

  const refreshRankingsAnnotations = () => {
    Effect.runPromise(runRefresh).catch(() => undefined);
  };

  const importRankings = async () => {
    const result = parseRankingsCsv(rankingsText);
    if (result.rankings.length === 0) {
      setRankingsMessage('No usable rankings found. Include name, position, team, and rank.');
      return;
    }

    const saved = await saveCustomRankings(result.rankings);
    setRankingsData(saved);
    setRankingsMessage(`Imported ${result.rankings.length} rankings${result.skipped ? ` and skipped ${result.skipped}` : ''}.`);
    setRankingsOpen(false);
    setRankingsText('');
    refreshRankingsAnnotations();
  };

  const removeRankings = async () => {
    await clearCustomRankings();
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

  return (
    <div style={styles.app}>
      <div style={styles.topbar}>
        <div>
          <div style={styles.title}>Draft Hand</div>
        </div>
        <div style={styles.statusGroup}>
          <div
            style={styles.pickStatus}
            title={`Detected from the active DraftKings team card. Synced ${loadCount} times.`}
          >
            Pick {userPickNumber}
          </div>
          <button
            type="button"
            style={styles.rankingsButton}
            title="Import custom rankings"
            onClick={() => setRankingsOpen(true)}
          >
            Rankings
          </button>
        </div>
      </div>

      <CapitalChart roster={roster as RosterPick[]} userPickNumber={userPickNumber} />
      <OpponentsTable roster={roster as RosterPick[]} available={available as Player[]} />
      {rankingsOpen ? (
        <div style={styles.modalBackdrop} role="presentation">
          <div style={styles.modal} role="dialog" aria-modal="true" aria-labelledby="dh-rankings-title">
            <div style={styles.modalHeader}>
              <div>
                <div id="dh-rankings-title" style={styles.modalTitle}>Custom Rankings</div>
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
  statusGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  rankingsButton: {
    appearance: 'none',
    border: `1px solid ${color.lineStrong}`,
    borderRadius: 8,
    background: color.text,
    color: color.panel,
    padding: '4px 8px',
    minHeight: 24,
    fontSize: 10,
    fontWeight: 900,
    lineHeight: 1,
    cursor: 'pointer',
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
