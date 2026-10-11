import bassClefUrl from '../assets/bass-clef.svg';
import {
  isPlayablePitch,
  matchingBoardNotes,
  STRINGS,
  frequency,
  keyAccidental,
  type Accidental,
  type KeySignature,
  type LetterIndex,
} from '../music';
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

const NOTE_LEDGER_HALF_WIDTH = 19;
const COMPACT_CONTROL_CLEARANCE = 6; // CSS pixels between the note's ledger lines and resize button.

const ACCIDENTAL_SYMBOLS = { [-1]: '♭', 0: '♮', 1: '♯' } as const;

/** Font-independent musical signs: upright stems, slanted thick crossbars, and a tapered flat bowl. */
function accidentalMarkup(accidental: Accidental, x: number, y: number): string {
  const paths = {
    [-1]: '<path d="M-5 -29V10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M-5 -7C12 -18 18 -2 -5 10V6C10 -4 6 -13 -5 -3Z"/>',
    0: '<path d="M-5 -23V13M5 -13V23" fill="none" stroke="currentColor" stroke-width="2"/><path d="M-5 -10L5 -14V-8L-5 -4ZM-5 8L5 4V10L-5 14Z"/>',
    1: '<path d="M-5 -23V23M5 -26V20" fill="none" stroke="currentColor" stroke-width="2"/><path d="M-11 -8L11 -14V-7L-11 -1ZM-11 8L11 2V9L-11 15Z"/>',
  };
  return `<g class="staff-accidental" data-accidental="${accidental}" transform="translate(${x} ${y})" fill="currentColor"><title>${ACCIDENTAL_SYMBOLS[accidental]}</title>${paths[accidental]}</g>`;
}

function quarterNoteMarkup(
  note: StaffNote,
  preview: boolean,
  x: number,
  showAccidental: boolean,
): string {
  const y = staffY(note.step);
  const color = preview ? '#287665' : '#26382b';
  const stemDown = note.step >= 8; // Middle staff line and above: stem on the left, pointing down.
  const stemX = x + (stemDown ? -9 : 9);
  const stemEnd = y + (stemDown ? 55 : -55);
  const ledgers = ledgerSteps(note.step)
    .map(
      (step) => `
    <line class="ledger-line" x1="${x - NOTE_LEDGER_HALF_WIDTH}" x2="${x + NOTE_LEDGER_HALF_WIDTH}" y1="${staffY(step)}" y2="${staffY(step)}" stroke="currentColor" stroke-width="1.5"/>
  `,
    )
    .join('');
  const accidental = showAccidental ? accidentalMarkup(note.accidental, x - 32, y) : '';
  return `
    <g class="staff-note ${preview ? 'preview-note' : ''}" data-step="${note.step}" data-midi="${notePitch(note)}" fill="${color}" color="${color}">
      ${ledgers}
      ${accidental}
      <ellipse class="notehead" cx="${x}" cy="${y}" rx="10" ry="7" transform="rotate(-18 ${x} ${y})"/>
      <line class="note-stem" x1="${stemX}" x2="${stemX}" y1="${y}" y2="${stemEnd}" stroke="${color}" stroke-width="2"/>
    </g>
  `;
}

/** Shared single/multiple-quarter-note drawing for the picker and read-only notation. */
export function staffMarkup(
  note: StaffNote | readonly StaffNote[] | undefined,
  preview = false,
  noteX = 152,
  options: { width?: number; key?: KeySignature } = {},
): string {
  const key = options.key;
  const signatureSteps = key && key.fifths < 0 ? [6, 9, 5, 8, 4, 7, 3] : [10, 7, 11, 8, 5, 9, 6];
  const signature = signatureSteps
    .slice(0, Math.abs(key?.fifths ?? 0))
    .map((step, index) =>
      accidentalMarkup(key && key.fifths < 0 ? -1 : 1, 94 + index * 22, staffY(step)),
    )
    .join('');
  const notes = note === undefined ? [] : 'step' in note ? [note] : note;
  // No barlines: an explicit alteration remains in force for this written pitch until changed.
  const alterations = new Map<number, Accidental>();
  const quarters = notes
    .map((current, index) => {
      const previous =
        alterations.get(current.step) ??
        (key ? keyAccidental(key, (((current.step % 7) + 7) % 7) as LetterIndex) : 0);
      alterations.set(current.step, current.accidental);
      const show = key
        ? current.accidental !== previous
        : current.accidental !== 0 || !!current.showNatural;
      return quarterNoteMarkup(current, preview, noteX + index * 72, show);
    })
    .join('');
  const lines = STAFF_LINES.map(
    (step) => `
    <line x1="18" x2="${(options.width ?? 240) - 18}" y1="${staffY(step)}" y2="${staffY(step)}"/>
  `,
  ).join('');
  return `
    <g class="staff-lines" stroke="#657166" stroke-width="1">${lines}</g>
    <image class="bass-clef" href="${bassClefUrl}" x="24" y="70" width="56" height="65"/>
    <g class="key-signature">${signature}</g>
    ${quarters}
  `;
}

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
    const pitch = model.selectedPitch;
    this.name.textContent = selection ? writtenNoteName(selection.note) : 'Noch kein Ton gewählt';
    if (selection && pitch !== null) {
      const matches = matchingBoardNotes(pitch).length;
      const origin =
        selection.source === 'board' ? `${STRINGS[selection.location.stringId].name}-Saite · ` : '';
      this.detail.textContent = `${origin}${matches} Griff${matches === 1 ? '' : 'e'} · ${frequency(pitch).toFixed(1).replace('.', ',')} Hz`;
    } else this.detail.textContent = 'C2–G4 auswählen';
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

/** Read-only notation can be mounted without the interactive picker or application shell. */
export class CompactStaffView {
  private readonly compact: SVGSVGElement;
  private readonly sizeToggle: HTMLButtonElement;

  constructor(root: ParentNode = document) {
    this.compact = requireElement('#compact-staff', SVGSVGElement, root);
    this.sizeToggle = requireElement('#notation-size-toggle', HTMLButtonElement, root);
  }

  render(note: StaffNote | null): void {
    this.compact.setAttribute('viewBox', COMPACT_VIEW_BOX);
    this.compact.setAttribute(
      'aria-label',
      note ? `${writtenNoteName(note)}, Bassschlüssel` : 'Bassschlüssel, noch kein Ton gewählt',
    );
    this.compact.innerHTML = staffMarkup(note ?? undefined, false, this.compactNoteX());
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
