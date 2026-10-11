import { PitchDetector } from 'pitchy';

export const PITCH_CONFIG = {
  bufferSize: 4096,
  intervalMs: 40,
  minimumClarity: 0.9,
  medianSamples: 5,
  smoothingMs: 150,
  toleranceCents: 5,
  noSignalMs: 500,
  minimumHz: 40,
  maximumHz: 2000,
};
export type PitchConfig = typeof PITCH_CONFIG;
export const centsBetween = (detectedHz: number, targetHz: number): number =>
  1200 * Math.log2(detectedHz / targetHz);
export function pitchDirection(cents: number, tolerance = PITCH_CONFIG.toleranceCents) {
  return cents < -tolerance ? 'low' : cents > tolerance ? 'high' : 'tune';
}
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[middle] ?? NaN)
    : ((sorted[middle - 1] ?? NaN) + (sorted[middle] ?? NaN)) / 2;
}
export interface PitchMeasurement {
  rawHz: number;
  clarity: number;
  accepted: boolean;
  filteredHz: number | null;
  cents: number | null;
}
/** Filter logarithmic pitch relative to A4, so octave errors remain visible. */
export class PitchFilter {
  private values: number[] = [];
  private smoothed: number | null = null;
  private lastValid: number | null = null;
  constructor(private readonly config: PitchConfig = PITCH_CONFIG) {}
  reset(): void {
    this.values.length = 0;
    this.smoothed = null;
    this.lastValid = null;
  }
  measure(rawHz: number, clarity: number, now: number, targetHz: number | null): PitchMeasurement {
    if (this.lastValid !== null && now - this.lastValid >= this.config.noSignalMs) this.reset();
    const accepted =
      Number.isFinite(rawHz) &&
      rawHz >= this.config.minimumHz &&
      rawHz <= this.config.maximumHz &&
      Number.isFinite(clarity) &&
      clarity >= this.config.minimumClarity &&
      clarity <= 1;
    if (accepted) {
      this.values.push(centsBetween(rawHz, 440));
      if (this.values.length > this.config.medianSamples) this.values.shift();
      const current = median(this.values);
      const alpha =
        this.lastValid === null
          ? 1
          : 1 - Math.exp(-(now - this.lastValid) / this.config.smoothingMs);
      this.smoothed =
        this.smoothed === null ? current : this.smoothed + alpha * (current - this.smoothed);
      this.lastValid = now;
    }
    const filteredHz = this.smoothed === null ? null : 440 * 2 ** (this.smoothed / 1200);
    return {
      rawHz,
      clarity,
      accepted,
      filteredHz,
      cents: filteredHz !== null && targetHz !== null ? centsBetween(filteredHz, targetHz) : null,
    };
  }
}
export type ListeningState = 'stopped' | 'starting' | 'listening' | 'error';
export class PitchDetectionService {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private timer: number | null = null;
  private generation = 0;
  private filter: PitchFilter;
  targetHz: number | null = null;
  constructor(
    private readonly onMeasurement: (measurement: PitchMeasurement, sampleRate: number) => void,
    private readonly onState: (state: ListeningState, error?: string) => void,
    private readonly config: PitchConfig = PITCH_CONFIG,
  ) {
    this.filter = new PitchFilter(config);
  }
  async start(): Promise<void> {
    this.stop();
    const generation = this.generation;
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      this.onState(
        'error',
        'Mikrofon nicht verfügbar. Öffne die App über HTTPS in einem aktuellen Browser.',
      );
      return;
    }
    this.onState('starting');
    try {
      const context = new AudioContext();
      this.context = context;
      // Resume synchronously from the button gesture, before awaiting permission.
      const resumed = context.resume();
      void resumed.catch(() => {});
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      await resumed;
      if (generation !== this.generation) return;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = this.config.bufferSize;
      analyser.channelCount = 1;
      analyser.channelCountMode = 'explicit';
      source.connect(analyser);
      this.source = source;
      this.analyser = analyser;
      const input = new Float32Array(this.config.bufferSize);
      const detector = PitchDetector.forFloat32Array(input.length);
      detector.minVolumeDecibels = -60;
      for (const track of stream.getAudioTracks())
        track.addEventListener(
          'ended',
          () => {
            if (generation !== this.generation) return;
            this.stop();
            this.onState('error', 'Mikrofonverbindung beendet. Starte erneut.');
          },
          { once: true },
        );
      this.onState('listening');
      this.timer = window.setInterval(() => {
        try {
          analyser.getFloatTimeDomainData(input);
          const [hz, clarity] = detector.findPitch(input, context.sampleRate);
          this.onMeasurement(
            this.filter.measure(hz, clarity, performance.now(), this.targetHz),
            context.sampleRate,
          );
        } catch {
          this.stop();
          this.onState('error', 'Ton konnte nicht erkannt werden. Starte erneut.');
        }
      }, this.config.intervalMs);
    } catch (error) {
      if (generation !== this.generation) return;
      this.stop();
      this.onState(
        'error',
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Mikrofonzugriff verweigert. Erlaube ihn in den Browsereinstellungen und starte erneut.'
          : 'Mikrofon konnte nicht gestartet werden. Prüfe die Verbindung und versuche es erneut.',
      );
    }
  }
  setTarget(hz: number | null): void {
    if (this.targetHz === hz) return;
    this.targetHz = hz;
    this.filter.reset();
  }
  stop(): void {
    ++this.generation;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.stream = null;
    this.source = null;
    this.analyser = null;
    this.filter.reset();
    this.onState('stopped');
  }
}
