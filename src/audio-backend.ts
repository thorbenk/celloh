import { CelloAudio } from './audio';
import type { MidiPitch } from './music';

export type AudioBackendId = 'recordings' | 'soundfont';

/** Duration is in seconds; omitted durations are short note previews. */
export interface AudioBackend {
  prepare(pitches: readonly MidiPitch[]): Promise<void>;
  play(pitch: MidiPitch, duration?: number): Promise<boolean>;
  stop(releaseTail?: boolean): void;
  setReferenceA(hz: number): void;
  setVolume(volume: number): void;
}

/** Owns selection and invalidates loading requests when the engine changes. */
export class AudioPlayer implements AudioBackend {
  private readonly recordings = new CelloAudio();
  private backend: AudioBackend = this.recordings;
  private id: AudioBackendId = 'recordings';
  private generation = 0;
  private referenceA = 440;
  private volume = 0.65;
  private loading: Promise<AudioBackend> | null = null;
  private soundfontContext: AudioContext | null = null;

  setBackend(id: AudioBackendId): void {
    if (id === this.id) return;
    this.stop();
    this.id = id;
    if (id === 'recordings') this.backend = this.recordings;
  }

  private async selected(): Promise<AudioBackend> {
    if (this.id === 'recordings') return this.backend;
    // Unlock audio during the gesture, before fetching the optional engine module.
    this.soundfontContext ??= new AudioContext();
    const context = this.soundfontContext;
    const resumed = context.resume();
    this.loading ??= import('./soundfont-audio')
      .then(({ SoundFontAudio }) => new SoundFontAudio(context))
      .catch((error: unknown) => {
        this.loading = null;
        throw error;
      });
    const [backend] = await Promise.all([this.loading, resumed]);
    if (this.id === 'soundfont') this.backend = backend;
    return backend;
  }

  async prepare(pitches: readonly MidiPitch[]): Promise<void> {
    const generation = this.generation;
    const backend = await this.selected();
    if (generation !== this.generation) return;
    backend.setReferenceA(this.referenceA);
    backend.setVolume(this.volume);
    await backend.prepare(pitches);
  }

  async play(pitch: MidiPitch, duration?: number): Promise<boolean> {
    const generation = this.generation;
    const backend = await this.selected();
    if (generation !== this.generation) return false;
    backend.setReferenceA(this.referenceA);
    backend.setVolume(this.volume);
    return backend.play(pitch, duration);
  }

  stop(releaseTail = false): void {
    ++this.generation;
    this.backend.stop(releaseTail);
  }

  setReferenceA(hz: number): void {
    this.backend.setReferenceA(hz);
    this.referenceA = hz;
  }

  setVolume(volume: number): void {
    this.backend.setVolume(volume);
    this.volume = volume;
  }
}
