import {
  Accidental as VexAccidental,
  Dot,
  ModifierContext,
  Stave,
  StaveNote,
  SVGContext,
  TickContext,
} from 'vexflow/bravura';
import {
  isPlayablePitch,
  matchingBoardNotes,
  STRINGS,
  frequency,
  keyAccidental,
  DEFAULT_NOTE_DISPLAY,
  type NoteDisplaySettings,
  type KeySignature,
  type LetterIndex,
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
  notePitch,
} from '../notation';
import type { AppModel } from '../model';
import { QUARTER_NOTE } from '../rhythm';
import { requireElement } from './dom';

export const NOTE_STEM_LENGTH = 70; // 3.5 staff spaces.
const NOTE_LEDGER_HALF_WIDTH = 20;
const COMPACT_CONTROL_CLEARANCE = 6;

/** VexFlow uses 10-unit staff spaces; our interactive views use 20. */
function notationContext(): SVGContext {
  const context = new SVGContext(document.createElement('div'));
  const group = context.openGroup();
  group.setAttribute('transform', 'scale(2)');
  context.setFillStyle('currentColor').setStrokeStyle('currentColor');
  return context;
}

function notationStave(width = 240): Stave {
  // VexFlow's top line is y + 40; align it with our A3 line at y = 70.
  const stave = new Stave(9, -5, (width - 36) / 2, {
    left_bar: false,
    right_bar: false,
    fill_style: '#657166',
  }).setClef('bass');
  stave.setDefaultLedgerLineStyle({ strokeStyle: 'currentColor', lineWidth: 0.75 });
  return stave;
}

function drawNote(
  context: SVGContext,
  stave: Stave,
  note: StaffNote,
  x: number,
  show: boolean,
): void {
  const duration = note.duration ?? QUARTER_NOTE;
  const letter = ['c', 'd', 'e', 'f', 'g', 'a', 'b'][((note.step % 7) + 7) % 7];
  const octave = 2 + Math.floor(note.step / 7);
  const rendered = new StaveNote({
    clef: 'bass',
    keys: [`${letter}/${octave}`],
    duration: String(duration.value),
    stem_direction: note.step >= 8 ? -1 : 1,
  })
    .setStemLength(NOTE_STEM_LENGTH / 2)
    .setStave(stave)
    .setContext(context);
  if (show)
    rendered.addModifier(
      new VexAccidental(note.accidental === -1 ? 'b' : note.accidental === 1 ? '#' : 'n'),
      0,
    );
  if (duration.dotted) {
    Dot.buildAndAttach([rendered], { all: true });
    for (const dot of rendered.getModifiers().filter((modifier) => modifier instanceof Dot)) {
      const draw = dot.draw.bind(dot);
      dot.draw = () => {
        const group = context.openGroup();
        group.setAttribute('class', 'note-dot');
        draw();
        context.closeGroup();
      };
    }
  }
  // TickContext alone does not format accidentals or augmentation dots.
  rendered.addToModifierContext(new ModifierContext());
  const tick = new TickContext().addTickable(rendered).preFormat().setX(0);
  // Keep notehead centers stable when accidentals or rhythmic values change.
  tick.setX(x / 2 - rendered.getNoteHeadBeginX() - rendered.getGlyphWidth() / 2);
  const group = context.openGroup();
  if (show) {
    const modifier = rendered.getModifiers().find((entry) => entry instanceof VexAccidental);
    if (modifier) {
      const draw = modifier.draw.bind(modifier);
      modifier.draw = () => {
        const accidental = context.openGroup();
        accidental.setAttribute('class', 'staff-accidental');
        accidental.innerHTML = `<title>${note.accidental === -1 ? '♭' : note.accidental === 1 ? '♯' : '♮'}</title>`;
        draw();
        context.closeGroup();
      };
    }
  }
  const drawFlag = rendered.drawFlag.bind(rendered);
  rendered.drawFlag = () => {
    if (duration.value < 8) return;
    const flag = context.openGroup();
    flag.setAttribute('class', 'note-flag');
    drawFlag();
    context.closeGroup();
  };
  const drawLedgers = rendered.drawLedgerLines.bind(rendered);
  rendered.drawLedgerLines = () => {
    const ledgers = context.openGroup();
    drawLedgers();
    ledgers.querySelectorAll('path').forEach((path) => path.classList.add('ledger-line'));
    context.closeGroup();
  };
  rendered.draw();
  group.querySelectorAll('.vf-notehead > path').forEach((head) => head.classList.add('notehead'));
  group.querySelectorAll('.vf-stem').forEach((stem) => stem.classList.add('note-stem'));
  context.closeGroup();
}

/** Shared VexFlow drawing for notation and duration controls. */
export function noteGlyphMarkup(note: StaffNote, x: number, showAccidental = false): string {
  const context = notationContext();
  drawNote(context, notationStave(), note, x, showAccidental);
  return context.svg.innerHTML;
}

/** Preserve fixed editor spacing while VexFlow handles musical engraving. */
export function staffMarkup(
  note: StaffNote | readonly StaffNote[] | undefined,
  preview = false,
  noteX = 152,
  options: { width?: number; key?: KeySignature; spacing?: number } = {},
): string {
  const context = notationContext();
  const stave = notationStave(options.width);
  if (options.key) {
    const keys = [
      'Cb',
      'Gb',
      'Db',
      'Ab',
      'Eb',
      'Bb',
      'F',
      'C',
      'G',
      'D',
      'A',
      'E',
      'B',
      'F#',
      'C#',
    ];
    const keyName = keys[options.key.fifths + 7];
    if (!keyName) throw new RangeError('Invalid key signature');
    stave.addKeySignature(keyName);
  }
  stave.setContext(context).draw();
  context.svg.querySelectorAll('.vf-keysignature').forEach((signature) => {
    signature.classList.add('key-signature');
    signature.querySelectorAll('path').forEach((path) => path.classList.add('staff-accidental'));
  });
  const notes = note === undefined ? [] : 'step' in note ? [note] : note;
  const alterations = new Map<number, StaffNote['accidental']>();
  // Draw editor groups outside the scaled stave group: their hit targets use app coordinates.
  context.closeGroup();
  notes.forEach((current, index) => {
    const previous =
      alterations.get(current.step) ??
      (options.key ? keyAccidental(options.key, (((current.step % 7) + 7) % 7) as LetterIndex) : 0);
    alterations.set(current.step, current.accidental);
    const show = options.key
      ? current.accidental !== previous
      : current.accidental !== 0 || !!current.showNatural;
    const duration = current.duration ?? QUARTER_NOTE;
    const group = context.openGroup();
    group.setAttribute('class', `staff-note ${preview ? 'preview-note' : ''}`);
    group.setAttribute('data-step', String(current.step));
    group.setAttribute('data-midi', String(notePitch(current)));
    group.setAttribute('data-value', String(duration.value));
    group.setAttribute('data-dotted', String(duration.dotted));
    group.setAttribute('color', preview ? '#287665' : '#26382b');
    // Editor hit targets are added to this group; only the musical ink should inherit a stroke.
    group.setAttribute('stroke', 'none');
    const ink = context.openGroup();
    ink.setAttribute('transform', 'scale(2)');
    ink.setAttribute('stroke', 'currentColor');
    drawNote(context, stave, current, noteX + index * (options.spacing ?? 72), show);
    context.closeGroup();
    context.closeGroup();
  });
  return context.svg.innerHTML;
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
