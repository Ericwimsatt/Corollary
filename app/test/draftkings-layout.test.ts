import { beforeEach, describe, expect, it } from 'vitest';
import { draftKingsAdapter } from '../src/content/adapters';

describe('DraftKings layout styles', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('does not include the removed vertical DraftKings layout rules', () => {
    draftKingsAdapter.ui.injectPageStyles();

    const styles = document.querySelector<HTMLStyleElement>(
      '[data-dh-platform-style="draftkings"]',
    )?.textContent;

    expect(styles).not.toContain(
      `[class*="SnakeDraft_snake-draft-inner-container"]:has(
          #draft-helper-root[data-dh-pane="vertical"]`,
    );
    expect(styles).toContain('[data-dh-draftkings-layout="horizontal"]');
  });
});
