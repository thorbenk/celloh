/** Cello tuning, pitch names, and closed-hand fingering. No browser dependencies. */
export type Spelling = 'sharp' | 'flat';
export type StringId = 0 | 1 | 2 | 3;
export type PositionNumber = 1 | 2 | 3 | 4;
export type PositionVariant = 'lower' | 'upper';
export type Accidental = -1 | 0 | 1;
export type FingerOffsets = readonly [number, number, number, number];
export type LetterIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

declare const midiPitchBrand: unique symbol;
/** Construct with midiPitch() at boundaries; arithmetic alone is not a validated pitch. */
export type MidiPitch = number & { readonly [midiPitchBrand]: true };
export function midiPitch(value: number): MidiPitch {
  if (!Number.isInteger(value) || value < 0 || value > 127) {
    throw new RangeError(`Invalid MIDI pitch: ${value}`);
  }
  return value as MidiPitch;
}
export function pitchClass(midi: MidiPitch): PitchClass {
  // midiPitch guarantees a nonnegative integer, so the remainder is 0–11.
  return (midi % 12) as PitchClass;
}

export interface CelloString {
  readonly id: StringId;
  readonly name: string;
  readonly numeral: string;
  readonly midi: MidiPitch;
}
export const STRINGS = [
  { id: 0, name: 'C', numeral: 'IV', midi: midiPitch(36) },
  { id: 1, name: 'G', numeral: 'III', midi: midiPitch(43) },
  { id: 2, name: 'd', numeral: 'II', midi: midiPitch(50) },
  { id: 3, name: 'a', numeral: 'I', midi: midiPitch(57) },
] as const satisfies readonly CelloString[];
export const MAX_STRING_OFFSET = 24;
export const MIN_PLAYABLE_PITCH = midiPitch(36);
export const MAX_PLAYABLE_PITCH = midiPitch(81);
export function isPlayablePitch(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_PLAYABLE_PITCH && value <= MAX_PLAYABLE_PITCH;
}

export interface BoardLocation {
  readonly stringId: StringId;
  readonly offset: number;
}
export interface BoardNote {
  readonly location: BoardLocation;
  readonly midi: MidiPitch;
}
export const BOARD_NOTES: readonly BoardNote[] = Array.from(
  { length: MAX_STRING_OFFSET + 1 },
  (_, offset) =>
    STRINGS.map((string) => ({
      location: { stringId: string.id, offset },
      midi: midiPitch(string.midi + offset),
    })),
).flat();
export const ALL_PITCHES: readonly MidiPitch[] = [
  ...new Set(BOARD_NOTES.map((note) => note.midi)),
].sort((a, b) => a - b);
export function matchingBoardNotes(midi: MidiPitch): readonly BoardNote[] {
  return BOARD_NOTES.filter((note) => note.midi === midi);
}

const LABELS = {
  sharp: ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H'],
  flat: ['C', 'Des', 'D', 'Es', 'E', 'F', 'Ges', 'G', 'As', 'A', 'B', 'H'],
} as const;
export const NATURALS = [0, 2, 4, 5, 7, 9, 11] as const;
export const WRITTEN_NAMES = {
  flat: ['Ces', 'Des', 'Es', 'Fes', 'Ges', 'As', 'B'],
  natural: ['C', 'D', 'E', 'F', 'G', 'A', 'H'],
  sharp: ['Cis', 'Dis', 'Eis', 'Fis', 'Gis', 'Ais', 'His'],
} as const;
export interface KeySignature {
  readonly name: string;
  readonly tonic: PitchClass;
  readonly spelling: Spelling;
  readonly mode: 'major' | 'minor';
  /** Signed number of key-signature accidentals: negative for flats. */
  readonly fifths: number;
}
export const MAJOR_KEYS: readonly KeySignature[] = (
  [
    ['Ces-Dur', 11, -7],
    ['Ges-Dur', 6, -6],
    ['Des-Dur', 1, -5],
    ['As-Dur', 8, -4],
    ['Es-Dur', 3, -3],
    ['B-Dur', 10, -2],
    ['F-Dur', 5, -1],
    ['C-Dur', 0, 0],
    ['G-Dur', 7, 1],
    ['D-Dur', 2, 2],
    ['A-Dur', 9, 3],
    ['E-Dur', 4, 4],
    ['H-Dur', 11, 5],
    ['Fis-Dur', 6, 6],
    ['Cis-Dur', 1, 7],
  ] satisfies [string, PitchClass, number][]
).map(([name, tonic, fifths]) => ({
  name,
  tonic,
  spelling: fifths < 0 ? 'flat' : 'sharp',
  mode: 'major',
  fifths,
}));
export const MINOR_KEYS: readonly KeySignature[] = MAJOR_KEYS.map((major) => {
  const tonic = ((major.tonic + 9) % 12) as PitchClass;
  return {
    ...major,
    name: `${noteName(midiPitch(tonic), major.spelling, major).toLowerCase()}-Moll`,
    tonic,
    mode: 'minor',
  };
});
export function keyAccidental(key: KeySignature, letter: LetterIndex): Accidental {
  const order = key.fifths < 0 ? [6, 2, 5, 1, 4, 0, 3] : [3, 0, 4, 1, 5, 2, 6];
  return order.indexOf(letter) < Math.abs(key.fifths) ? (key.fifths < 0 ? -1 : 1) : 0;
}
/** The written letter in this key, or -1 for a chromatic note. */
export function keyLetter(midi: MidiPitch, key: KeySignature): LetterIndex | -1 {
  return NATURALS.findIndex(
    (natural, letter) =>
      (natural + keyAccidental(key, letter as LetterIndex) + 12) % 12 === pitchClass(midi),
  ) as LetterIndex | -1;
}
export function keyNoteNames(key: KeySignature): readonly string[] {
  const intervals = key.mode === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  return intervals.map((offset) => noteName(midiPitch(key.tonic + offset), key.spelling, key));
}
const NOTE_HUES = [5, 30, 52, 80, 115, 150, 180, 205, 230, 265, 295, 330] as const;
export function noteName(
  midi: MidiPitch,
  spelling: Spelling,
  key: KeySignature | null = null,
): string {
  const letter = key ? keyLetter(midi, key) : -1;
  if (key && letter !== -1) {
    const accidental = keyAccidental(key, letter);
    return WRITTEN_NAMES[accidental < 0 ? 'flat' : accidental > 0 ? 'sharp' : 'natural'][letter];
  }
  return LABELS[spelling][pitchClass(midi)];
}
export function noteHue(midi: MidiPitch): number {
  return NOTE_HUES[pitchClass(midi)];
}
export function octave(midi: MidiPitch): number {
  return Math.floor(midi / 12) - 1;
}
export function frequency(midi: MidiPitch): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export interface Position {
  readonly id: PositionNumber;
  readonly color: string;
  readonly side: 'left' | 'right';
}
export const POSITIONS = [
  { id: 1, color: '#287665', side: 'left' },
  { id: 2, color: '#9c5d21', side: 'right' },
  { id: 3, color: '#7561a7', side: 'left' },
  { id: 4, color: '#336ba0', side: 'right' },
] as const satisfies readonly Position[];
/** Closed hand: one semitone per finger. A backward extension moves only finger 1. */
export function fingerOffsets(
  id: PositionNumber,
  upper: boolean,
  extended: boolean,
): FingerOffsets {
  const start = id === 1 ? 2 : id === 2 ? (upper ? 4 : 3) : id === 3 ? (upper ? 6 : 5) : 7;
  return [start - (extended ? 1 : 0), start + 1, start + 2, start + 3];
}
