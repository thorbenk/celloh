import { WorkletSynthesizer } from 'spessasynth_lib';
import processorUrl from 'spessasynth_lib/dist/spessasynth_processor.min.js?url';
import { isPlayablePitch, type MidiPitch } from './music';
import type { AudioBackend } from './audio-backend';
import { soundingDuration, type NotePlayback } from './articulation';

/** Live SF2 synthesis; release tails may overlap the next bowed attack. */
export class SoundFontAudio implements AudioBackend {
  private synth: WorkletSynthesizer | null = null;
  private ready: Promise<void> | null = null;
  private request = 0;
  private readonly voices = new Map<
    number,
    {
      pitch: MidiPitch;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private nextChannel = 0;
  private referenceA = 440;
  private volume = 0.65;

  constructor(private readonly context: AudioContext) {}

  async prepare(): Promise<void> {
    // Resume before the first await, while still in the initiating gesture.
    const resumed = this.context.resume();
    this.ready ??= this.initialize().catch((error: unknown) => {
      this.synth?.destroy();
      this.synth = null;
      this.ready = null;
      throw error;
    });
    await Promise.all([resumed, this.ready]);
  }

  private async initialize(): Promise<void> {
    const context = this.context;
    await context.audioWorklet.addModule(processorUrl);
    const response = await fetch(`${import.meta.env.BASE_URL}soundfont/cello_solo.sf2`);
    if (!response.ok) throw new Error(`Could not load cello SoundFont: HTTP ${response.status}`);
    const bank = await response.arrayBuffer();
    const synth = new WorkletSynthesizer(context);
    this.synth = synth;
    await synth.soundBankManager.addSoundBank(bank, 'cello');
    await synth.isReady;
    synth.connect(context.destination);
    // The source is a solo cello bank, with its instrument at preset zero.
    synth.programChange(0, 0);
    synth.programChange(1, 0);
    this.applyParameters();
  }

  async play(pitch: MidiPitch, duration = 1.6, options?: NotePlayback): Promise<boolean> {
    if (!isPlayablePitch(pitch)) throw new RangeError(`Invalid cello pitch: ${pitch}`);
    if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Invalid note duration');
    const request = ++this.request;
    await this.prepare();
    if (request !== this.request) return false;
    if (!options) this.release();
    const synth = this.synth;
    if (!synth) throw new Error('SoundFont not initialized');
    // Alternate channels so a previous release cannot cut off a repeated pitch.
    const channel = this.nextChannel;
    this.nextChannel = 1 - channel;
    this.releaseChannel(channel);
    synth.noteOn(channel, pitch, 90);
    const gate = options ? soundingDuration(pitch, duration, options) : duration;
    const timer = setTimeout(() => this.releaseChannel(channel), gate * 1000);
    this.voices.set(channel, { pitch, timer });
    return true;
  }

  private releaseChannel(channel: number): void {
    const voice = this.voices.get(channel);
    if (!voice) return;
    clearTimeout(voice.timer);
    this.synth?.noteOff(channel, voice.pitch);
    this.voices.delete(channel);
  }

  private release(): void {
    for (const channel of this.voices.keys()) this.releaseChannel(channel);
  }

  stop(releaseTail = false): void {
    ++this.request;
    this.release();
    this.synth?.stopAll(!releaseTail);
  }

  setReferenceA(hz: number): void {
    if (!Number.isFinite(hz) || hz < 430 || hz > 450) throw new RangeError('Invalid reference A');
    this.referenceA = hz;
    this.applyParameters();
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1)
      throw new RangeError('Invalid volume');
    this.volume = volume;
    this.applyParameters();
  }

  private applyParameters(): void {
    this.synth?.setSystemParameter('gain', this.volume);
    this.synth?.setSystemParameter('fineTune', 1200 * Math.log2(this.referenceA / 440));
  }
}
