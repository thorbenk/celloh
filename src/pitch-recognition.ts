import { frequency, isPlayablePitch, midiPitch, type MidiPitch } from './music';
import { centsBetween } from './pitch';

export const RECOGNITION_CONFIG = {
  holdMs: 250,
  maximumCents: 40,
  maximumSpreadCents: 30,
  maximumGapMs: 120,
  noSignalMs: 500,
};

/** Recognize an exact octave after a stable run of reliable estimates, without changing exercises. */
export class HeldPitchRecognizer {
  referenceA = 440;
  holdMs = RECOGNITION_CONFIG.holdMs;
  private candidate: MidiPitch | null = null;
  private candidateSince = 0;
  private minimumCents = 0;
  private maximumCents = 0;
  private lastAccepted: number | null = null;
  private recognized: MidiPitch | null = null;
  reset(): void {
    this.candidate = null;
    this.recognized = null;
    this.lastAccepted = null;
  }
  measure(hz: number, accepted: boolean, now: number): MidiPitch | null {
    if (this.lastAccepted !== null && now - this.lastAccepted >= RECOGNITION_CONFIG.noSignalMs)
      this.reset();
    if (!accepted || !Number.isFinite(hz) || hz <= 0) {
      this.candidate = null;
      return this.recognized;
    }
    const rounded = Math.round(69 + 12 * Math.log2(hz / this.referenceA));
    if (!isPlayablePitch(rounded)) {
      this.candidate = null;
      return this.recognized;
    }
    const pitch = midiPitch(rounded);
    const cents = centsBetween(hz, frequency(pitch, this.referenceA));
    if (Math.abs(cents) > RECOGNITION_CONFIG.maximumCents) {
      this.candidate = null;
      return this.recognized;
    }
    const gap =
      this.lastAccepted === null || now - this.lastAccepted > RECOGNITION_CONFIG.maximumGapMs;
    this.lastAccepted = now;
    const minimum = Math.min(this.minimumCents, cents);
    const maximum = Math.max(this.maximumCents, cents);
    if (
      gap ||
      pitch !== this.candidate ||
      maximum - minimum > RECOGNITION_CONFIG.maximumSpreadCents
    ) {
      this.candidate = pitch;
      this.candidateSince = now;
      this.minimumCents = cents;
      this.maximumCents = cents;
    } else {
      this.minimumCents = minimum;
      this.maximumCents = maximum;
    }
    if (now - this.candidateSince >= this.holdMs) this.recognized = pitch;
    return this.recognized;
  }
}
