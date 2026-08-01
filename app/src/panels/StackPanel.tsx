import React from 'react';
import type { StackTarget } from '../content/types';
import { adpToRound } from '../utils/adp';

interface Props {
  targets: StackTarget[];
}

export default function StackPanel({ targets }: Props) {
  if (targets.length === 0) {
    return (
      <div style={styles.container}>
        <h3 style={styles.heading}>Stack Targets</h3>
        <p style={styles.empty}>Draft RBs/WRs/TEs to see QB stack recommendations</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>Stack Targets</h3>
      {targets.slice(0, 5).map((t, i) => (
        <div key={i} style={styles.row}>
          <span style={styles.qb}>
            {t.qb.name} ({t.team})
          </span>
          <span style={styles.with}>→</span>
          <span style={styles.rostered}>{t.rostered.name}</span>
          <span style={styles.adp}>ADP: {t.qb.adp} (Rd {adpToRound(t.qb.adp)})</span>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: 12,
  },
  heading: {
    fontSize: 14,
    fontWeight: 700,
        color: '#e8e8e8',
    marginBottom: 8,
  },
  empty: {
    color: '#999',
    fontSize: 12,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 0',
    fontSize: 12,
    borderBottom: '1px solid #333',
  },
  qb: {
    color: '#4fc3f7',
    fontWeight: 600,
  },
  with: {
    color: '#666',
  },
  rostered: {
    color: '#e0e0e0',
  },
  adp: {
    color: '#aaa',
    fontSize: 11,
    marginLeft: 'auto',
  },
};
