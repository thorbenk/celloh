import {
  midiPitch,
  pitchClass,
  keyLetter,
  keyAccidental,
  NATURALS,
  SHARP_LETTERS,
  FLAT_LETTERS,
  noteLetterName,
  DEFAULT_NOTE_DISPLAY,
  type NoteNaming,
  type NoteDisplaySettings,
  type Accidental,
  type MidiPitch,
  type Spelling,
  type KeySignature,
  type LetterIndex,
} from './music';
import type { NoteDuration } from './rhythm';

export const ACCIDENTALS = [-1, 0, 1] as const satisfies readonly Accidental[];
export const PICKER_MIN = 0; // C2
export const PICKER_MAX = 18; // G4
export const STAFF_LINES = [4, 6, 8, 10, 12] as const; // G2, H2, D3, F3, A3
export const COMPACT_VIEW_BOX = '0 -160 205 375'; // Fixed C2–A5 range, including ledger lines.
const STAFF_BOTTOM_Y = 190;
const STAFF_STEP_HEIGHT = 10;

/** Diatonic distance from C2; moving one step changes the written letter, not a semitone. */
function letterIndex(step: number): LetterIndex {
  if (!Number.isInteger(step)) throw new RangeError(`Invalid staff step: ${step}`);
  return (((step % 7) + 7) % 7) as LetterIndex;
}
export interface StaffNote {
  readonly step: number;
  readonly accidental: Accidental;
  readonly showNatural?: boolean;
  /** Pitch-only views draw a quarter note when no rhythmic value is supplied. */
  readonly duration?: NoteDuration;
}
export function naturalMidi(step: number): MidiPitch {
  return midiPitch(36 + Math.floor(step / 7) * 12 + NATURALS[letterIndex(step)]);
}
export function notePitch(note: StaffNote): MidiPitch {
  return midiPitch(naturalMidi(note.step) + note.accidental);
}
export function staffNote(
  midi: MidiPitch,
  spelling: Spelling,
  key: KeySignature | null = null,
): StaffNote {
  const letter = key ? keyLetter(midi, key) : -1;
  if (key && letter !== -1) {
    const accidental = keyAccidental(key, letter);
    // Ces and His cross the sounding octave boundary.
    const step = (Math.floor((midi - accidental) / 12) - 3) * 7 + letter;
    return { step, accidental };
  }
  const index = pitchClass(midi);
  const step =
    (Math.floor(midi / 12) - 3) * 7 + (spelling === 'sharp' ? SHARP_LETTERS : FLAT_LETTERS)[index];
  const accidental = midi === naturalMidi(step) ? 0 : spelling === 'sharp' ? 1 : -1;
  return { step, accidental };
}
export function clampPickerStep(step: number): number {
  return Math.max(PICKER_MIN, Math.min(PICKER_MAX, Math.round(step)));
}
export function staffY(step: number): number {
  return STAFF_BOTTOM_Y - step * STAFF_STEP_HEIGHT;
}
export function stepAtStaffY(y: number): number {
  return clampPickerStep((STAFF_BOTTOM_Y - y) / STAFF_STEP_HEIGHT);
}
export function ledgerSteps(step: number): readonly number[] {
  const lines: number[] = [];
  for (let line = 2; line >= step; line -= 2) lines.push(line);
  for (let line = 14; line <= step; line += 2) lines.push(line);
  return lines;
}
/** A pitch-class label deliberately carries no octave, including no octave-dependent casing. */
export function noteName(note: StaffNote, naming: NoteNaming): string {
  return noteLetterName(letterIndex(note.step), note.accidental, naming);
}
export function writtenNoteName(
  note: StaffNote,
  display: Readonly<NoteDisplaySettings> = DEFAULT_NOTE_DISPLAY,
): string {
  const name = noteName(note, display.naming);
  const octave = 2 + Math.floor(note.step / 7);
  if (display.octaveNotation === 'scientific') return `${name}${octave}`;
  // Great octave C2 is uppercase; small octave C3 is lowercase, then primes above it.
  return octave < 3
    ? `${name}${','.repeat(2 - octave)}`
    : `${name.toLowerCase()}${'′'.repeat(octave - 3)}`;
}
