export type PlayPickAlert = () => void;

export function playPickAlertSound(): void {
  try {
    const context = new AudioContext();

    void context.resume().then(() => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(1, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.22);
      oscillator.addEventListener('ended', () => void context.close(), { once: true });
    }).catch(() => void context.close());
  } catch {
    // Audio can be unavailable when the page has not received a user gesture yet.
  }
}

export class PickAlert {
  private draftId: string | null = null;
  private wasOnClock = false;

  constructor(private readonly play: PlayPickAlert = playPickAlertSound) {}

  update(draftId: string, isUserOnClock: boolean): void {
    if (draftId !== this.draftId) {
      this.draftId = draftId;
      this.wasOnClock = false;
    }

    if (isUserOnClock && !this.wasOnClock) {
      this.play();
    }
    this.wasOnClock = isUserOnClock;
  }
}
