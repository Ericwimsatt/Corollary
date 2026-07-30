import { describe, expect, it, beforeEach } from 'vitest';
import { Effect } from 'effect';
import { setupDraftPage } from './fixtures/setup';
import { annotateByeWeekCounts } from '../src/content/bye-annotator';
import { annotateStackTargets } from '../src/content/stack-annotator';
import type { Player, RosterPick } from '../src/content/types';

function run<A>(eff: Effect.Effect<A>): A {
  return Effect.runSync(eff);
}

function appendAvailablePlayer(name: string, position: string, team: string, byeWeek: string) {
  document.querySelector('.DraftablePlayersTable-Mobile_draftable-players .BaseTable__body')?.insertAdjacentHTML(
    'beforeend',
    `
      <div class="BaseTable__row">
        <div class="BaseTable__row-cell"></div>
        <div class="BaseTable__row-cell">99</div>
        <div class="BaseTable__row-cell">
          <div class="PlayerCell_player-cell">
            <div class="PlayerCell_player-details-container">
              <div class="PlayerCell_player-name-container">
                <div class="PlayerCell_player-name">${name}</div>
              </div>
              <div class="PlayerCell_player-position-and-team">
                <div class="player-position">${position}</div>
                <div class="PlayerCell_player-team"><div>${team}</div></div>
              </div>
            </div>
          </div>
        </div>
        <div class="BaseTable__row-cell"><button>Draft</button></div>
        <div class="BaseTable__row-cell"><span class="NumberCell_number-cell"><span>${byeWeek}</span></span></div>
        <div class="BaseTable__row-cell"><span class="NumberCell_number-cell"><span>200.0</span></span></div>
      </div>
    `,
  );
}

function player(name: string, position: Player['position'], team: string, byeWeek: number): Player {
  return { rank: 99, name, position, team, adp: 200, byeWeek, isDrafted: false };
}

function pick(name: string, position: RosterPick['position'], team: string, byeWeek: number): RosterPick {
  return { round: 1, pick: 1, overallPick: 1, name, position, team, byeWeek, adp: 0 };
}

describe('free agent annotations', () => {
  beforeEach(() => {
    setupDraftPage();
    appendAvailablePlayer('Free Agent Receiver', 'WR', 'FA', '0');
  });

  it('does not annotate free agent rows with stack badges', () => {
    const roster = [
      pick('Free Agent QB', 'QB', 'FA', 0),
      pick('Ja\'Marr Chase', 'WR', 'CIN', 6),
    ];
    const available = [
      player('Free Agent Receiver', 'WR', 'FA', 0),
      player('Joe Burrow', 'QB', 'CIN', 6),
    ];

    run(annotateStackTargets(roster, available));

    const freeAgentRow = Array.from(document.querySelectorAll('.BaseTable__row')).find((row) =>
      row.textContent?.includes('Free Agent Receiver'),
    );

    expect(freeAgentRow?.querySelector('.dh-stack-badge')).toBeNull();
    expect(document.querySelectorAll('.dh-stack-badge').length).toBeGreaterThan(0);
  });

  it('does not annotate free agent rows with bye count badges', () => {
    const roster = [
      pick('Free Agent Receiver', 'WR', 'FA', 0),
      pick('Ja\'Marr Chase', 'WR', 'CIN', 6),
    ];
    const available = [player('Free Agent Receiver', 'WR', 'FA', 0)];

    run(annotateByeWeekCounts(roster, available, available));

    const freeAgentRow = Array.from(document.querySelectorAll('.BaseTable__row')).find((row) =>
      row.textContent?.includes('Free Agent Receiver'),
    );
    const chaseRow = Array.from(document.querySelectorAll('.BaseTable__row')).find((row) =>
      row.textContent?.includes('Ja\'Marr Chase'),
    );

    expect(freeAgentRow?.querySelector('.dh-bye-count-badge')).toBeNull();
    expect(chaseRow?.querySelector('.dh-bye-count-badge')?.textContent).toBe('1');
  });
});
