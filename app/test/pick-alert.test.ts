import { describe, expect, it, vi } from 'vitest';
import { PickAlert } from '../src/content/pick-alert';

describe('PickAlert', () => {
  it('plays once when the user goes on the clock', () => {
    const play = vi.fn();
    const alert = new PickAlert(play);

    alert.update('draft:1', false);
    alert.update('draft:1', true);
    alert.update('draft:1', true);

    expect(play).toHaveBeenCalledTimes(1);
  });

  it('plays again after the user goes off and back on the clock', () => {
    const play = vi.fn();
    const alert = new PickAlert(play);

    alert.update('draft:1', true);
    alert.update('draft:1', false);
    alert.update('draft:1', true);

    expect(play).toHaveBeenCalledTimes(2);
  });

  it('resets the transition state when the draft changes', () => {
    const play = vi.fn();
    const alert = new PickAlert(play);

    alert.update('draft:1', true);
    alert.update('draft:2', true);

    expect(play).toHaveBeenCalledTimes(2);
  });
});
