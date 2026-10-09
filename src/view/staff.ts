import bassClefUrl from '../assets/bass-clef.svg';
import { isPlayablePitch, matchingBoardNotes, STRINGS, frequency } from '../music';
import {
  naturalMidi,
  staffY,
  ledgerSteps,
  writtenNoteName,
  type StaffNote,
  PICKER_MAX,
  COMPACT_VIEW_BOX,
  stepAtStaffY,
  ACCIDENTALS,
  STAFF_LINES,
  notePitch,
} from '../notation';
import type { AppModel } from '../model';
import { requireElement } from './dom';

const ACCIDENTAL_SYMBOLS = { [-1]: '♭', 0: '♮', 1: '♯' } as const;

function quarterNoteMarkup(note: StaffNote, preview: boolean): string {
  const y = staffY(note.step);
  const color = preview ? '#287665' : '#26382b';
  const stemDown = note.step >= 8; // Middle staff line and above: stem on the left, pointing down.
  const stemX = stemDown ? 143 : 161;
  const stemEnd = y + (stemDown ? 55 : -55);
  const ledgers = ledgerSteps(note.step)
    .map(
      (step) => `
    <line class="ledger-line" x1="133" x2="171" y1="${staffY(step)}" y2="${staffY(step)}" stroke="currentColor" stroke-width="1.5"/>
  `,
    )
    .join('');
  const accidental =
    note.accidental !== 0 || note.showNatural
      ? `
    <text class="staff-accidental" x="114" y="${y + 8}" font-size="30">${ACCIDENTAL_SYMBOLS[note.accidental]}</text>
  `
      : '';
  return `
    <g class="staff-note ${preview ? 'preview-note' : ''}" data-step="${note.step}" data-midi="${notePitch(note)}" fill="${color}">
      ${ledgers}
      ${accidental}
      <ellipse class="notehead" cx="152" cy="${y}" rx="10" ry="7" transform="rotate(-18 152 ${y})"/>
      <line class="note-stem" x1="${stemX}" x2="${stemX}" y1="${y}" y2="${stemEnd}" stroke="${color}" stroke-width="2"/>
    </g>
  `;
}

/** Shared drawing for the interactive picker and the read-only corner notation. */
export function staffMarkup(note: StaffNote | undefined, preview = false): string {
  const lines = STAFF_LINES.map(
    (step) => `
    <line x1="18" x2="222" y1="${staffY(step)}" y2="${staffY(step)}"/>
  `,
  ).join('');
  return `
    <g class="staff-lines" stroke="#657166" stroke-width="1">${lines}</g>
    <image class="bass-clef" href="${bassClefUrl}" x="24" y="70" width="56" height="65"/>
    ${note ? quarterNoteMarkup(note, preview) : ''}
  `;
}

export class StaffView {
  readonly staff = requireElement('#staff', SVGSVGElement);
  private readonly compact = requireElement('#compact-staff', SVGSVGElement);
  private readonly name = requireElement('#selected-note', HTMLDivElement);
  private readonly detail = requireElement('#selected-detail', HTMLDivElement);
  readonly status = requireElement('#audio-status', HTMLSpanElement);
  readonly accidentalButtons = ACCIDENTALS.map((accidental) => ({
    accidental,
    button: requireElement(`[data-accidental="${accidental}"]`, HTMLButtonElement),
  }));

  renderSelection(model: AppModel): void {
    const selection = model.selection;
    const pitch = model.selectedPitch;
    this.name.textContent = selection ? writtenNoteName(selection.note) : 'Noch kein Ton gewählt';
    if (selection && pitch !== null) {
      const matches = matchingBoardNotes(pitch).length;
      const origin =
        selection.source === 'board' ? `${STRINGS[selection.location.stringId].name}-Saite · ` : '';
      this.detail.textContent = `${origin}${matches} Griff${matches === 1 ? '' : 'e'} · ${frequency(pitch).toFixed(1).replace('.', ',')} Hz`;
    } else this.detail.textContent = 'C2–G4 auswählen';
    this.compact.setAttribute('viewBox', COMPACT_VIEW_BOX);
    this.compact.setAttribute(
      'aria-label',
      selection
        ? `${writtenNoteName(selection.note)}, Bassschlüssel`
        : 'Bassschlüssel, noch kein Ton gewählt',
    );
    this.compact.innerHTML = staffMarkup(selection?.note);
    this.renderPicker(model);
  }
  renderPicker(model: AppModel): void {
    const displayed = model.displayedNote;
    // Keep the selected high note visible; the interactive picker remains C2–G4.
    const selectedStep = model.selection?.note.step ?? PICKER_MAX;
    const top = Math.min(0, staffY(Math.max(PICKER_MAX, selectedStep)) - 45);
    this.staff.setAttribute('viewBox', `0 ${top} 240 ${230 - top}`);
    this.staff.innerHTML = staffMarkup(displayed ?? undefined, model.picker.previewStep !== null);
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
