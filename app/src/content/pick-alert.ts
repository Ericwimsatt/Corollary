export type PlayPickAlert = () => void;

export function playPickAlertSound(): void {
  try {
    const context = new AudioContext();

    void context.resume().then(() => {
      const start = context.currentTime;
      const masterGain = context.createGain();
      const filter = context.createBiquadFilter();

      // A short ascending fanfare: bright enough to read as brass, but brief
      // enough that it does not get in the way during a live draft.
      const notes = [
        { frequency: 523.25, duration: 0.24 }, // C5
        { frequency: 659.25, duration: 0.24 }, // E5
        { frequency: 783.99, duration: 0.24 }, // G5
        { frequency: 1046.5, duration: 0.52 }, // C6
      ];

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2800, start);
      filter.Q.setValueAtTime(1.2, start);
      masterGain.gain.setValueAtTime(0.0001, start);
      masterGain.gain.linearRampToValueAtTime(0.72, start + 0.03);
      masterGain.gain.setValueAtTime(0.72, start + 1.18);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, start + 1.38);

      masterGain.connect(filter);
      filter.connect(context.destination);

      let offset = 0;
      for (const note of notes) {
        const noteStart = start + offset;
        const noteEnd = noteStart + note.duration;
        const noteGain = context.createGain();
        const oscillator = context.createOscillator();
        const harmonic = context.createOscillator();

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(note.frequency, noteStart);
        harmonic.type = 'square';
        harmonic.frequency.setValueAtTime(note.frequency * 2, noteStart);

        noteGain.gain.setValueAtTime(0.0001, noteStart);
        noteGain.gain.exponentialRampToValueAtTime(0.22, noteStart + 0.018);
        noteGain.gain.setValueAtTime(0.22, noteEnd - 0.045);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

        oscillator.connect(noteGain);
        harmonic.connect(noteGain);
        noteGain.connect(masterGain);
        oscillator.start(noteStart);
        harmonic.start(noteStart);
        oscillator.stop(noteEnd);
        harmonic.stop(noteEnd);

        offset += note.duration;
      }

      window.setTimeout(() => void context.close(), 1500);
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
