import { isPlayablePitch, type MidiPitch } from './music';

interface PlayingNote {
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
}

/** Lazily decode each sample once. Only the most recent play request may produce sound. */
export class CelloAudio {
  private context: AudioContext | null = null;
  private readonly buffers = new Map<MidiPitch, Promise<AudioBuffer>>();
  private active: PlayingNote | null = null;
  private request = 0;
  private volume = 0.65;

  async play(midi: MidiPitch): Promise<boolean> {
    if (!isPlayablePitch(midi)) throw new RangeError(`No cello recording for MIDI ${midi}`);
    const request = ++this.request;
    this.context ??= new AudioContext();
    const context = this.context;
    // Call resume during the user gesture, before fetching or decoding.
    await context.resume();
    const decoded = await this.loadBuffer(midi, context);
    if (request !== this.request) return false;

    this.fadeOutActiveNote();
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = decoded;
    // Read the latest volume, including changes made while the recording loaded.
    gain.gain.value = this.volume;
    source.connect(gain).connect(context.destination);
    const playing = { source, gain };
    this.active = playing;
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (this.active === playing) this.active = null;
    };
    source.start();
    return true;
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      throw new RangeError(`Invalid volume: ${volume}`);
    }
    this.volume = volume;
    if (this.context && this.active) {
      this.active.gain.gain.setTargetAtTime(volume, this.context.currentTime, 0.025);
    }
  }

  /** Invalidate in-flight requests as well as stopping the currently audible note. */
  stop(): void {
    ++this.request;
    this.fadeOutActiveNote();
  }

  private loadBuffer(midi: MidiPitch, context: AudioContext): Promise<AudioBuffer> {
    const cached = this.buffers.get(midi);
    if (cached) return cached;
    const pending = fetch(`${import.meta.env.BASE_URL}audio/${midi}.mp3`)
      .then((response) => {
        if (!response.ok)
          throw new Error(`Could not load cello recording ${midi}: HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data));
    this.buffers.set(midi, pending);
    // Remove failures so a later click can retry. Do not discard a newer request's cache entry.
    void pending.catch(() => {
      if (this.buffers.get(midi) === pending) this.buffers.delete(midi);
    });
    return pending;
  }

  private fadeOutActiveNote(): void {
    if (!this.context || !this.active) return;
    const { gain, source } = this.active;
    this.active = null;
    gain.gain.cancelScheduledValues(this.context.currentTime);
    gain.gain.setTargetAtTime(0, this.context.currentTime, 0.025);
    source.stop(this.context.currentTime + 0.15);
  }
}
