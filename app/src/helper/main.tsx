import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ScoredPlayer } from '../rankings/next-best-pick';
import { buildPositionNeeds, rankNextBestPicks } from '../rankings/next-best-pick';
import { draftKingsAdapter } from '../content/adapters/draftkings';
import type { Position } from '../content/types';
import CapitalChart from '../panels/CapitalChart';
import { getScenarioState, scenarios, type DraftBoardEntry, type HelperScenario } from './scenarios';
import './styles.css';

const positionOrder: Position[] = ['QB', 'RB', 'WR', 'TE'];
const TEAM_COUNT = 12;

function App() {
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showBoard, setShowBoard] = useState(false);
  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
  const { roster, available, draftedByOthers, draftBoard } = useMemo(() => getScenarioState(scenario), [scenario]);
  const nextOverallPick = (roster.length + 1) * 12 - scenario.pick + 1;
  const scored = useMemo<ScoredPlayer[]>(() => {
    const needs = buildPositionNeeds(roster, draftKingsAdapter, scenario.pick);
    return rankNextBestPicks({ roster, available, customRankings: null, positionNeeds: needs, scoring: draftKingsAdapter.scoring, currentPick: nextOverallPick, upcomingPoolSize: 40, topN: 8 });
  }, [available, nextOverallPick, refreshKey, roster, scenario.pick]);

  return <div className="helper-app">
    <header className="helper-header">
      <div>
        <div className="eyebrow">COROLLARY / TUNING LAB</div>
        <h1>Next Best Helper</h1>
        <p>Replay realistic draft states against the live scoring formula.</p>
      </div>
      <button className="refresh-button" type="button" onClick={() => setRefreshKey((value) => value + 1)}>
        <span className="refresh-icon">↻</span> Refresh recommendations
      </button>
    </header>

    <section className="control-strip" aria-label="Scenario controls">
      <label htmlFor="scenario">Scenario</label>
      <select id="scenario" value={scenario.id} onChange={(event) => setScenarioId(event.target.value)}>
        {scenarios.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <button
        type="button"
        className={`board-toggle ${showBoard ? 'on' : ''}`}
        aria-pressed={showBoard}
        onClick={() => setShowBoard((value) => !value)}
      >
        {showBoard ? 'Hide draft board' : 'Show draft board'}
      </button>
    </section>

    <div className="current-pick-banner" aria-label="Current pick">
      <div>
        <div className="current-pick-label">YOU&apos;RE PICKING NOW</div>
        <div className="current-pick-number">Pick <span className="pick-num">{scenario.pick}</span></div>
        <div className="current-pick-sub">{roster.length + 1}{ordinal(roster.length + 1)} round · overall {nextOverallPick}</div>
      </div>
      <div className="current-pick-aside">
        <div><span className="live-dot" />{draftedByOthers.length} opponent picks simulated</div>
        <div className="current-pick-refresh">Calculated {refreshKey === 0 ? 'on load' : `refresh #${refreshKey}`}</div>
      </div>
    </div>

    <main className="dashboard">
      <section className="panel roster-panel">
        <PanelHeading eyebrow="YOUR BOARD" title="Roster at the turn" meta={`${roster.length} / 20 players`} />
        <div className="roster-table">
          <div className="table-head"><span>Player</span><span>Drafted</span><span>ADP</span></div>
          {roster.map((player) => <div className="roster-row" key={`${player.name}-${player.overallPick}`}>
            <div className="player-line"><span className={`position ${player.position.toLowerCase()}`}>{player.position}</span><span>{player.name}</span><small>{player.team}</small></div>
            <span className="pick-time">R{player.round} · {player.overallPick}</span>
            <span className="number">{player.adp.toFixed(1)}</span>
          </div>)}
        </div>
      </section>

      <section className="panel capital-panel">
        <PanelHeading eyebrow="ALLOCATION" title="Draft capital" meta="DK curve" />
        <CapitalChart roster={roster} userPickNumber={scenario.pick} adapter={draftKingsAdapter} fillHeight segmented />
        <div className="capital-note">Bars show capital spent against each position ceiling. Each segment is a player; hover for player and pick.</div>
      </section>

      <section className="panel recommendations-panel">
        <PanelHeading eyebrow="DECISION SUPPORT" title="Pick next" meta={`${scored.length} candidates`} />
        <div className="recommendation-list">
          {scored.map((item, index) => <Recommendation key={item.player.name} item={item} index={index} />)}
        </div>
      </section>

      <section className="panel available-panel">
        <PanelHeading eyebrow="THE BOARD" title="Next available players" meta={`${available.length} in sample`} />
        <div className="available-table">
          <div className="table-head"><span>Player</span><span>Pos</span><span>ADP</span><span>Rank</span></div>
          {available.slice(0, 24).map((player) => <div className="available-row" key={player.name}>
            <span className="player-line"><strong>{player.name}</strong><small>{player.team}</small></span>
            <span className={`position ${player.position.toLowerCase()}`}>{player.position}</span>
            <span className="number">{player.adp.toFixed(1)}</span>
            <span className="number muted-number">{player.rank}</span>
          </div>)}
        </div>
      </section>
    </main>
    {showBoard && <DraftBoardPanel board={draftBoard} userSlot={scenario.pick} />}
    <footer><span>25 draft states · DraftKings ETR rank + ADP export connected</span><span>Change weights in <code>src/rankings/next-best-pick.ts</code>, rebuild, refresh.</span></footer>
  </div>;
}

function PanelHeading({ eyebrow, title, meta }: { eyebrow: string; title: string; meta: string }) {
  return <div className="panel-heading"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div><span className="panel-meta">{meta}</span></div>;
}

function Recommendation({ item, index }: { item: ScoredPlayer; index: number }) {
  return <div className={`recommendation ${index === 0 ? 'recommended' : ''}`}>
    <div className="recommendation-main"><span className="rank-number">{String(index + 1).padStart(2, '0')}</span><span className={`position ${item.player.position.toLowerCase()}`}>{item.player.position}</span><strong>{item.player.name}</strong><small>{item.player.team} · ADP {item.player.adp.toFixed(1)}</small><span className="score">{item.score.toFixed(1)}</span></div>
    <BreakdownTable contributions={item.contributions} total={item.score} />
  </div>;
}

function BreakdownTable({ contributions, total }: { contributions: ScoredPlayer['contributions']; total: number }) {
  const maxScaled = Math.max(...contributions.map((row) => Math.abs(row.scaled)), 1);
  return <div className="breakdown-table" aria-label="Score breakdown">
    <div className="breakdown-head">
      <span>Factor</span><span>Raw</span><span>Scale</span><span>Pts</span>
    </div>
    {contributions.map((row) => {
      const width = Math.min(100, (Math.abs(row.scaled) / maxScaled) * 100);
      const positive = row.scaled >= 0;
      return <div className="breakdown-row" key={row.label}>
        <span className="breakdown-factor">{row.label}</span>
        <span className="breakdown-raw">{formatScore(row.raw)}</span>
        <span className="breakdown-scale">{formatScale(row.scale)}</span>
        <span className="breakdown-scaled">
          <span className={`breakdown-bar ${positive ? 'pos' : 'neg'}`} style={{ width: `${width}%` }} />
          <span className="breakdown-value">{formatScore(row.scaled)}</span>
        </span>
      </div>;
    })}
    <div className="breakdown-total"><span>Total</span><span>{total.toFixed(1)}</span></div>
  </div>;
}

function ordinal(value: number) { const mod = value % 100; return `${value}${mod >= 11 && mod <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[value % 10] ?? 'th'}`; }
function formatScore(value: number) { return Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(1)}` : '—'; }
function formatScale(value: number) { return Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(1)}×` : '—'; }

function DraftBoardPanel({ board, userSlot }: { board: DraftBoardEntry[]; userSlot: number }) {
  if (!board.length) return null;
  const byOverall = new Map(board.map((entry) => [entry.overallPick, entry]));
  const maxRound = board[board.length - 1].round;
  const rounds = Array.from({ length: maxRound }, (_, i) => i + 1);
  return <section className="panel draft-board-panel" aria-label="Full draft board">
    <PanelHeading eyebrow="DRAFT BOARD" title="Entire board to this point" meta={`${board.length} picks · slot ${userSlot}`} />
    <div className="draft-board-grid">
      <div className="draft-board-slotrow">
        <span className="draft-board-corner">Rd</span>
        {Array.from({ length: TEAM_COUNT }, (_, i) => {
          const slot = i + 1;
          return <span key={slot} className={`draft-board-slothead ${slot === userSlot ? 'user' : ''}`}>{slot}</span>;
        })}
      </div>
      {rounds.map((round) => {
        const cells = Array.from({ length: TEAM_COUNT }, (_, i) => {
          const slot = i + 1;
          const overall = round % 2 === 1 ? (round - 1) * TEAM_COUNT + slot : round * TEAM_COUNT - slot + 1;
          return byOverall.get(overall);
        });
        return <DraftBoardRow key={round} round={round} cells={cells} userSlot={userSlot} />;
      })}
    </div>
  </section>;
}

function DraftBoardRow({ round, cells, userSlot }: { round: number; cells: (DraftBoardEntry | undefined)[]; userSlot: number }) {
  return <div className="draft-board-row">
    <span className="draft-board-roundlabel">{round}</span>
    {cells.map((entry, index) => {
      const slot = index + 1;
      const isUserSlot = slot === userSlot;
      const cls = `draft-board-cell ${isUserSlot ? 'user' : ''} ${entry ? 'taken' : 'empty'} ${entry?.player.position.toLowerCase() ?? ''}`;
      return <span key={slot} className={cls} title={entry ? `${entry.player.name} · ADP ${entry.player.adp.toFixed(1)} · Δ${entry.adpDelta >= 0 ? '+' : ''}${entry.adpDelta.toFixed(0)}` : undefined}>
        {entry && <>
          <span className="draft-board-name">{entry.player.name}</span>
          <span className="draft-board-meta">{entry.player.position} · {entry.player.adp.toFixed(0)}{entry.isUser ? ' · YOU' : ''}</span>
        </>}
      </span>;
    })}
  </div>;
}

createRoot(document.getElementById('helper-root')!).render(<App />);
