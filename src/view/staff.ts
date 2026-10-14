import {
  isPlayablePitch,
  matchingBoardNotes,
  STRINGS,
  frequency,
  DEFAULT_NOTE_DISPLAY,
  type NoteDisplaySettings,
} from '../music';
import {
  naturalMidi,
  staffY,
  writtenNoteName,
  type StaffNote,
  PICKER_MAX,
  COMPACT_VIEW_BOX,
  stepAtStaffY,
  ACCIDENTALS,
} from '../notation';
import type { AppModel } from '../model';
import { requireElement } from './dom';
import { renderStaff } from './notation-renderer';

const NOTE_LEDGER_HALF_WIDTH = 20;
const COMPACT_CONTROL_CLEARANCE = 6;

export class StaffView {
  readonly staff: SVGSVGElement;
  private readonly name: HTMLDivElement;
  private readonly detail: HTMLDivElement;
  readonly status: HTMLSpanElement;
  readonly accidentalButtons;

  constructor(root: ParentNode = document) {
    this.staff = requireElement('#staff', SVGSVGElement, root);
    this.name = requireElement('#selected-note', HTMLDivElement, root);
    this.detail = requireElement('#selected-detail', HTMLDivElement, root);
    this.status = requireElement('#audio-status', HTMLSpanElement, root);
    this.accidentalButtons = ACCIDENTALS.map((accidental) => ({
      accidental,
      button: requireElement(`[data-accidental="${accidental}"]`, HTMLButtonElement, root),
    }));
  }

  renderSelection(model: AppModel): void {
    const selection = model.selection;
    requireElement('#add-note', HTMLButtonElement).disabled = !selection;
    const pitch = model.selectedPitch;
    this.name.textContent = selection
      ? writtenNoteName(selection.note, model.noteDisplay)
      : 'Noch kein Ton gewählt';
    if (selection && pitch !== null) {
      const matches = matchingBoardNotes(pitch).length;
      const origin =
        selection.source === 'board' ? `${STRINGS[selection.location.stringId].name}-Saite · ` : '';
      this.detail.textContent = `${origin}${matches} Griff${matches === 1 ? '' : 'e'} · ${frequency(pitch).toFixed(1).replace('.', ',')} Hz`;
    } else
      this.detail.textContent = `${writtenNoteName({ step: 0, accidental: 0 }, model.noteDisplay)}–${writtenNoteName({ step: PICKER_MAX, accidental: 0 }, model.noteDisplay)} auswählen`;
    this.staff.setAttribute(
      'aria-label',
      `Note wählen: ${writtenNoteName({ step: 0, accidental: 0 }, model.noteDisplay)} bis ${writtenNoteName({ step: PICKER_MAX, accidental: 0 }, model.noteDisplay)}. Pfeiltasten ändern den Ton, Eingabetaste spielt ihn.`,
    );
    this.renderPicker(model);
  }

  renderPicker(model: AppModel): void {
    const displayed = model.displayedNote;
    // Keep the selected high note visible; the interactive picker remains C2–G4.
    const selectedStep = model.selection?.note.step ?? PICKER_MAX;
    const top = Math.min(0, staffY(Math.max(PICKER_MAX, selectedStep)) - 45);
    this.staff.setAttribute('viewBox', `0 ${top} 240 ${230 - top}`);
    renderStaff(this.staff, displayed ?? undefined, model.picker.previewStep !== null);
    for (const { accidental, button } of this.accidentalButtons) {
      const currentAccidental = displayed?.accidental ?? model.picker.accidental;
      button.setAttribute('aria-pressed', String(accidental === currentAccidental));
      button.disabled = !isPlayablePitch(
        naturalMidi(displayed?.step ?? model.picker.step) + accidental,
      );
    }
  }
  stepAtPointer(event: PointerEvent | MouseEvent): number | null {
    const matrix = this.staff.getScreenCTM();
    if (!matrix) return null; // Closed panels do not have a screen transform.
    const point = this.staff.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return stepAtStaffY(point.matrixTransform(matrix.inverse()).y);
  }
}

/** Read-only notation can be mounted without the interactive picker or application shell. */
export class CompactStaffView {
  private readonly compact: SVGSVGElement;
  private readonly sizeToggle: HTMLButtonElement;

  constructor(root: ParentNode = document) {
    this.compact = requireElement('#compact-staff', SVGSVGElement, root);
    this.sizeToggle = requireElement('#notation-size-toggle', HTMLButtonElement, root);
  }

  render(
    note: StaffNote | null,
    display: Readonly<NoteDisplaySettings> = DEFAULT_NOTE_DISPLAY,
  ): void {
    this.compact.setAttribute('viewBox', COMPACT_VIEW_BOX);
    this.compact.setAttribute(
      'aria-label',
      note
        ? `${writtenNoteName(note, display)}, Bassschlüssel`
        : 'Bassschlüssel, noch kein Ton gewählt',
    );
    renderStaff(this.compact, note ?? undefined, false, this.compactNoteX());
  }

  /** Reserve the resize button's screen width, then convert the space to SVG units. */
  private compactNoteX(): number {
    const matrix = this.compact.getScreenCTM();
    if (!matrix) return 152;
    const edge = this.compact.createSVGPoint();
    edge.x = this.sizeToggle.getBoundingClientRect().left - COMPACT_CONTROL_CLEARANCE;
    return Math.min(152, edge.matrixTransform(matrix.inverse()).x - NOTE_LEDGER_HALF_WIDTH);
  }
}
