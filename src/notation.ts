import { midiPitch, pitchClass, type Accidental, type MidiPitch, type Spelling } from './music';

export type LetterIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const NATURALS = [0, 2, 4, 5, 7, 9, 11] as const;
const SHARP_STEPS = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6] as const;
const FLAT_STEPS = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6] as const;
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
}
export function naturalMidi(step: number): MidiPitch {
  return midiPitch(36 + Math.floor(step / 7) * 12 + NATURALS[letterIndex(step)]);
}
export function notePitch(note: StaffNote): MidiPitch {
  return midiPitch(naturalMidi(note.step) + note.accidental);
}
export function staffNote(midi: MidiPitch, spelling: Spelling): StaffNote {
  const index = pitchClass(midi);
  const step =
    (Math.floor(midi / 12) - 3) * 7 + (spelling === 'sharp' ? SHARP_STEPS : FLAT_STEPS)[index];
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
const WRITTEN_NAMES = {
  flat: ['Ces', 'Des', 'Es', 'Fes', 'Ges', 'As', 'B'],
  natural: ['C', 'D', 'E', 'F', 'G', 'A', 'H'],
  sharp: ['Cis', 'Dis', 'Eis', 'Fis', 'Gis', 'Ais', 'His'],
} as const;
export function writtenNoteName(note: StaffNote): string {
  const spelling = note.accidental < 0 ? 'flat' : note.accidental > 0 ? 'sharp' : 'natural';
  return `${WRITTEN_NAMES[spelling][letterIndex(note.step)]}${2 + Math.floor(note.step / 7)}`;
}
