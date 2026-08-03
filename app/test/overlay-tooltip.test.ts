import { beforeEach, describe, expect, it, vi } from 'vitest';
import { attachOverlayTooltip } from '../src/content/overlay-tooltip';

describe('overlay tooltip placement', () => {
  beforeEach(() => {
    document.body.innerHTML = '<button id="target">Annotation</button><div id="tooltip"></div>';
  });

  it('opens above an annotation when there is room so it does not cover the next player row', () => {
    const target = document.querySelector<HTMLElement>('#target')!;
    const tooltip = document.querySelector<HTMLElement>('#tooltip')!;

    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 220,
      right: 180,
      bottom: 234,
      left: 60,
      width: 120,
      height: 14,
      x: 60,
      y: 220,
      toJSON: () => ({}),
    });
    vi.spyOn(tooltip, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: 220,
      height: 34,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    attachOverlayTooltip(target, tooltip);
    target.dispatchEvent(new MouseEvent('mouseenter'));

    expect(tooltip.style.top).toBe('180px');
    expect(tooltip.style.left).toBe('60px');
  });
});
