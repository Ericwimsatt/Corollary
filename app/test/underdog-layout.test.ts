import { beforeEach, describe, expect, it } from 'vitest';
import { underdogAdapter } from '../src/content/adapters';

describe('Underdog layout styles', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('does not constrain virtualized lists to the zero-width AutoSizer wrapper', () => {
    underdogAdapter.ui.injectPageStyles();

    const styles = document.querySelector<HTMLStyleElement>(
      '[data-dh-platform-style="underdog"]',
    )?.textContent;

    expect(styles).toBeDefined();
    expect(styles).not.toMatch(/ReactVirtualized__Grid[\s\S]*max-width:\s*100%/);
  });

  it('gives all three draft columns a tall row and lets the page scroll', () => {
    underdogAdapter.ui.injectPageStyles();

    const styles = document.querySelector<HTMLStyleElement>(
      '[data-dh-platform-style="underdog"]',
    )?.textContent;

    expect(styles).toContain(
      'grid-template-rows: auto auto minmax(max(720px, calc(100vh - 180px)), auto) !important',
    );
    expect(styles).toMatch(/html,[\s\S]*body[\s\S]*overflow-y:\s*auto\s*!important/);
    expect(styles).toMatch(/rightColumnSection[\s\S]*overflow:\s*visible\s*!important/);
  });

  it('keeps the Underdog surface dark below the initial viewport', () => {
    underdogAdapter.ui.injectPageStyles();

    const styles = document.querySelector<HTMLStyleElement>(
      '[data-dh-platform-style="underdog"]',
    )?.textContent;

    expect(styles).toMatch(/html,[\s\S]*body[\s\S]*background:\s*#0f0f0f\s*!important/);
    expect(styles).toMatch(/draftDetailsSectionDesktop[\s\S]*background:\s*#0f0f0f\s*!important/);
  });

  it('places annotations in the existing metadata line', () => {
    document.body.innerHTML = `
      <div data-testid="player-cell-wrapper">
        <div class="playerInfo-test">
          <div class="playerName-test">Jonah Coleman</div>
          <div class="playerPosition-test">
            <span class="slotBadge-test">RB49</span>
            <span class="matchText-test">DEN</span>, Bye 10
          </div>
        </div>
        <div class="statCell-test">158</div>
        <div class="statCell-test">158.9</div>
      </div>
    `;

    const row = document.querySelector('[data-testid="player-cell-wrapper"]');
    const parsed = row ? underdogAdapter.ui.parseAvailablePlayerRow(row) : null;

    expect(parsed?.annotationContainer).toBe(document.querySelector('.playerPosition-test'));
    expect(parsed?.detailsContainer).toBe(document.querySelector('.playerInfo-test'));
  });
});
