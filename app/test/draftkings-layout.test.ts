import { beforeEach, describe, expect, it } from 'vitest';
import { draftKingsAdapter } from '../src/content/adapters';

describe('DraftKings layout styles', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('lets the DraftKings page span the viewport in vertical mode', () => {
    draftKingsAdapter.ui.injectPageStyles();

    const styles = document.querySelector<HTMLStyleElement>(
      '[data-dh-platform-style="draftkings"]',
    )?.textContent;

    expect(styles).toContain(
      `[class*="SnakeDraft_snake-draft-inner-container"]:has(
          #draft-helper-root[data-dh-pane="vertical"]
        ) {
          max-width: 100% !important;
        }`,
    );
    expect(styles).not.toContain(
      `[class*="SnakeDraft_snake-draft-inner-container"]:has(
          #draft-helper-root[data-dh-pane="horizontal"]`,
    );
  });
});
