import {
  POSITIONS,
  isPlayablePitch,
  type Accidental,
  type BoardNote,
  type BoardLocation,
  type MidiPitch,
  type PositionNumber,
  type PositionVariant,
  type Spelling,
} from './music';
import { clampPickerStep, naturalMidi, notePitch, staffNote, type StaffNote } from './notation';

/** A selection always has a written note. Its sounding pitch is derived, never stored separately. */
export type Selection =
  | { readonly source: 'board'; readonly note: StaffNote; readonly location: BoardLocation }
  | { readonly source: 'staff'; readonly note: StaffNote };
export interface BoardSettings {
  spelling: Spelling;
  readonly visiblePositions: Set<PositionNumber>;
  readonly variants: Set<PositionVariant>;
  extended: boolean;
  toScale: boolean;
  spread: number;
}
export interface PickerState {
  step: number;
  accidental: Accidental;
  previewStep: number | null;
}

/** Browser-independent application state and musical selection rules. */
export class AppModel {
  readonly board: BoardSettings = {
    spelling: 'sharp',
    visiblePositions: new Set(POSITIONS.map((position) => position.id)),
    variants: new Set(['lower']),
    extended: false,
    toScale: false,
    spread: 1,
  };
  readonly picker: PickerState = { step: 7, accidental: 0, previewStep: null };
  dimOthers = true;
  private currentSelection: Selection | null = null;

  get selection(): Selection | null {
    return this.currentSelection;
  }

  get selectedPitch(): MidiPitch | null {
    return this.selection ? notePitch(this.selection.note) : null;
  }
  get displayedNote(): StaffNote | null {
    if (this.picker.previewStep === null) return this.selection?.note ?? null;
    const step = this.picker.previewStep;
    // A flat below the lowest cello pitch cannot be played; preview C2 instead.
    const accidental = isPlayablePitch(naturalMidi(step) + this.picker.accidental)
      ? this.picker.accidental
      : 0;
    return { step, accidental, showNatural: accidental === 0 };
  }
  selectBoard(note: BoardNote): void {
    this.commitSelection({
      source: 'board',
      note: staffNote(note.midi, this.board.spelling),
      location: note.location,
    });
  }
  selectWritten(step: number, accidental: Accidental = this.picker.accidental): boolean {
    if (!isPlayablePitch(naturalMidi(step) + accidental)) return false;
    this.commitSelection({
      source: 'staff',
      note: { step, accidental, showNatural: accidental === 0 },
    });
    return true;
  }
  changeAccidental(accidental: Accidental): boolean {
    if (this.selection) return this.selectWritten(this.selection.note.step, accidental);
    if (!isPlayablePitch(naturalMidi(this.picker.step) + accidental)) return false;
    this.picker.accidental = accidental;
    this.picker.previewStep = this.picker.step;
    return false; // Preview only; there is no selected pitch to play.
  }
  preview(step: number): void {
    this.picker.step = clampPickerStep(step);
    this.picker.previewStep = this.picker.step;
  }
  clearPreview(): void {
    this.picker.previewStep = null;
    if (this.selection) this.picker.step = clampPickerStep(this.selection.note.step);
  }
  setSpelling(spelling: Spelling): void {
    this.board.spelling = spelling;
    if (this.selection) {
      this.commitSelection({
        ...this.selection,
        note: staffNote(notePitch(this.selection.note), spelling),
      });
    }
  }
  clearSelection(): void {
    this.currentSelection = null;
    this.picker.step = 7;
    this.picker.accidental = 0;
    this.picker.previewStep = null;
  }
  private commitSelection(selection: Selection): void {
    this.currentSelection = selection;
    this.picker.step = clampPickerStep(selection.note.step);
    this.picker.accidental = selection.note.accidental;
    this.picker.previewStep = null;
  }
}
