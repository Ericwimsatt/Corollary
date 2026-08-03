import { describe, it, expect, beforeEach } from 'vitest';
import { Effect } from 'effect';
import { setupDraftPage } from './fixtures/setup';
import { draftKingsAdapter, underdogAdapter } from '../src/content/adapters';

function run<A>(eff: Effect.Effect<A>): A {
  return Effect.runSync(eff);
}

describe('readRoster', () => {
  beforeEach(() => {
    setupDraftPage();
  });

  it('reads roster rows', () => {
    const roster = run(draftKingsAdapter.readRoster);
    expect(roster).toHaveLength(1);
    expect(roster[0].name).toBe('Ja\'Marr Chase');
    expect(roster[0].position).toBe('WR');
    expect(roster[0].byeWeek).toBe(6);
    expect(roster[0].overallPick).toBe(1);
  });
});

describe('readAvailablePlayers', () => {
  beforeEach(() => {
    setupDraftPage();
  });

  it('reads available players with ADP', () => {
    const players = run(draftKingsAdapter.readAvailablePlayers);
    expect(players.length).toBeGreaterThanOrEqual(4);
    const allen = players.find((p) => p.name === 'Josh Allen');
    expect(allen).toBeDefined();
    expect(allen!.position).toBe('QB');
    expect(allen!.team).toBe('BUF');
    expect(allen!.adp).toBe(25.4);
  });

  it('parses ADP as float', () => {
    const players = run(draftKingsAdapter.readAvailablePlayers);
    const chase = players.find((p) => p.name === 'Ja\'Marr Chase');
    expect(chase!.adp).toBe(3.0);
  });
});

describe('DraftKings drafted-player sources', () => {
  const source = (id: string) => {
    const found = draftKingsAdapter.draftedPlayerSources.find(candidate => candidate.id === id);
    if (!found) throw new Error(`Missing ${id} source`);
    return found.read;
  };

  it('reads full player identity, ownership, and pick from the draft board', () => {
    document.body.innerHTML = `
      <div class="DraftBoard_draft-board">
        <div class="DraftBoardColumn_draft-board-column">
          <div class="UserPickSummaryCard_summary-card">
            <div class="UserPickSummaryCard_user-avatar-container"></div>
            <div class="generated-user-name"><span>chrud21</span></div>
            <div class="UserPickSummaryCard_position-summary-group">QB0RB1WR0TE0</div>
          </div>
          <div class="CellBase_draft-cell">
            <div class="CellBase_cell-background-overlay">
              <div class="CellHeader_header"><div>1.4</div><div class="CellHeader_pick-number">4</div></div>
              <div class="PlayerCell_player-details">
                <img class="PlayerCell_player-thumbnail" alt="Bijan Robinson icon"
                  src="https://dkn.gs/sports/images/nfl/players/50/693112.png">
                <div class="PlayerCell_name-and-team">
                  <button class="PlayerCell_player-name">B. Robinson</button>
                  <div class="PlayerCell_position-and-team">
                    <div>RB</div><div class="PlayerCell_team">ATL</div><div class="PlayerCell_team">(BYE 11)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    const picks = run(source('draft-board'));
    expect(picks).toEqual([expect.objectContaining({
      sourcePlayerId: 'draftkings:693112',
      name: 'Bijan Robinson',
      position: 'RB',
      team: 'ATL',
      overallPick: 4,
      round: 1,
      pick: 4,
      draftSlot: 1,
      draftTeam: 'chrud21',
    })]);
  });

  it('reads the latest pick and resolves its owner from the pick order', () => {
    document.body.innerHTML = `
      <div class="PickOrder_pick-order">
        <div class="PickOrder_pick-order__sticky-user-card-container">
          <div class="UserCard_information-top">On the clock: Pick 35</div>
        </div>
        <div class="PickOrder_pick-order__scrollable-container">
          <div class="UserCard_user-card">
            <div class="UserCard_information-top">Pick 39</div>
            <div class="UserCard_user-name">smcguiga</div>
          </div>
        </div>
        <div class="PickOrder_pick-order__last-drafted-player">
          <div class="PickOrder_pick-order__last-drafted-player__last-pick">Last Pick:</div>
          <div>Javonte Williams | RB DAL</div>
        </div>
      </div>`;

    const picks = run(source('live-panel'));
    expect(picks).toEqual([expect.objectContaining({
      name: 'Javonte Williams',
      position: 'RB',
      team: 'DAL',
      overallPick: 34,
      round: 3,
      pick: 10,
      draftSlot: 10,
      draftTeam: 'smcguiga',
    })]);
  });
});

describe('on-the-clock detection', () => {
  it('detects the DraftKings user slot on the sticky pick card', () => {
    document.body.innerHTML = `
      <div class="UserCard_is-active-user">
        <div class="UserCard_information-top">Team 10</div>
      </div>
      <div class="PickOrder_pick-order__sticky-user-card-container">
        <div class="UserCard_information-top">On the clock: Pick 34</div>
      </div>`;

    expect(draftKingsAdapter.isUserOnClock()).toBe(true);
  });

  it('does not flag a different DraftKings slot', () => {
    document.body.innerHTML = `
      <div class="UserCard_is-active-user">
        <div class="UserCard_information-top">Team 10</div>
      </div>
      <div class="PickOrder_pick-order__sticky-user-card-container">
        <div class="UserCard_information-top">On the clock: Pick 35</div>
      </div>`;

    expect(draftKingsAdapter.isUserOnClock()).toBe(false);
  });

  it('detects the Underdog drafting-bar turn message', () => {
    document.body.innerHTML = `
      <div class="draftingBarWrapper_ab12">
        <span>You're on the clock</span>
      </div>`;

    expect(underdogAdapter.isUserOnClock()).toBe(true);
  });

  it('ignores an opponent turn in the Underdog drafting bar', () => {
    document.body.innerHTML = `
      <div class="draftingBarWrapper_ab12">
        <span>Eric is on the clock</span>
      </div>`;

    expect(underdogAdapter.isUserOnClock()).toBe(false);
  });
});
