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

  return (
    <div style={styles.app}>
      <div style={styles.topbar}>
        <div>
          <div style={styles.title}>Draft Hand</div>
        </div>
        <div
          style={styles.pickStatus}
          title={`Detected from the active DraftKings team card. Synced ${loadCount} times.`}
        >
          Pick {userPickNumber}
        </div>
      </div>

      <CapitalChart roster={roster as RosterPick[]} userPickNumber={userPickNumber} />
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
};
