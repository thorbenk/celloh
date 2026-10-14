import type { MidiPitch } from './music';

export type Articulation = 'neutral' | 'detached' | 'connected';

export interface NotePlayback {
  readonly articulation?: Articulation;
  readonly nextPitch?: MidiPitch | undefined;
}

/** Keep articulation proportional at fast tempos, and bound it at slow tempos. */
export function soundingDuration(
  pitch: MidiPitch,
  duration: number,
  { articulation = 'connected', nextPitch }: NotePlayback,
): number {
  if (articulation === 'neutral') return duration;
  if (articulation === 'detached') return duration - Math.min(0.12, duration * 0.22);
  if (nextPitch === undefined) return duration;
  if (nextPitch === pitch) return duration - Math.min(0.05, duration * 0.12);
  return duration + Math.min(0.065, duration * 0.12);
}
