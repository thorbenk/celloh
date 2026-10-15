import {
  Accidental as VexAccidental,
  Dot,
  ModifierContext,
  Stave,
  StaveNote,
  SVGContext,
  TickContext,
} from 'vexflow/bravura';
import { keyAccidental, type KeySignature, type LetterIndex } from '../music';
import { notePitch, type StaffNote } from '../notation';
import { QUARTER_NOTE } from '../rhythm';

export const NOTE_STEM_LENGTH = 70; // 3.5 staff spaces in app coordinates.

const staffDrawings = new WeakMap<
  SVGSVGElement,
  { signature: string; stave: string; element: ChildNode }
>();

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

/** Tag VexFlow output for editor styling and geometry checks without changing its engraving. */
function tagged(context: SVGContext, className: string, draw: () => void): SVGGElement {
  const group = context.openGroup();
  group.setAttribute('class', className);
  draw();
  context.closeGroup();
  return group;
}

class EditorAccidental extends VexAccidental {
  constructor(
    private readonly svg: SVGContext,
    accidental: StaffNote['accidental'],
  ) {
    super(accidental === -1 ? 'b' : accidental === 1 ? '#' : 'n');
    this.symbol = accidental === -1 ? '♭' : accidental === 1 ? '♯' : '♮';
  }
  private readonly symbol: string;

  override draw(): void {
    const group = tagged(this.svg, 'staff-accidental', () => super.draw());
    const title = this.svg.create('title');
    title.textContent = this.symbol;
    group.prepend(title);
  }
}

class EditorDot extends Dot {
  constructor(private readonly svg: SVGContext) {
    super();
  }

  override draw(): void {
    tagged(this.svg, 'note-dot', () => super.draw());
  }
}

class EditorNote extends StaveNote {
  constructor(
    note: ConstructorParameters<typeof StaveNote>[0],
    private readonly svg: SVGContext,
  ) {
    super(note);
    this.setContext(svg);
  }

  override drawFlag(): void {
    if (this.hasFlag()) tagged(this.svg, 'note-flag', () => super.drawFlag());
  }

  override drawLedgerLines(): void {
    const group = tagged(this.svg, 'ledger-lines', () => super.drawLedgerLines());
    group.querySelectorAll('path').forEach((line) => line.classList.add('ledger-line'));
  }
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
  const rendered = new EditorNote(
    {
      clef: 'bass',
      keys: [`${letter}/${2 + Math.floor(note.step / 7)}`],
      duration: String(duration.value),
      stem_direction: note.step >= 8 ? -1 : 1,
    },
    context,
  )
    .setStemLength(NOTE_STEM_LENGTH / 2)
    .setStave(stave)
    .setContext(context);
  if (show) rendered.addModifier(new EditorAccidental(context, note.accidental), 0);
  if (duration.dotted) {
    rendered.addModifier(new EditorDot(context).setDotShiftY(rendered.glyphProps.dot_shiftY), 0);
  }
  // TickContext alone does not format accidentals or augmentation dots.
  rendered.addToModifierContext(new ModifierContext());
  const tick = new TickContext().addTickable(rendered).preFormat().setX(0);
  // Keep notehead centers stable when accidentals or rhythmic values change.
  tick.setX(x / 2 - rendered.getNoteHeadBeginX() - rendered.getGlyphWidth() / 2);
  const group = tagged(context, 'note-ink', () => rendered.draw());
  group.querySelectorAll('.vf-notehead > path').forEach((head) => head.classList.add('notehead'));
  group.querySelectorAll('.vf-stem').forEach((stem) => stem.classList.add('note-stem'));
}

/** Shared VexFlow drawing for notation and duration controls. */
export function renderNoteGlyph(
  target: SVGSVGElement,
  note: StaffNote,
  x: number,
  showAccidental = false,
): void {
  const context = notationContext();
  drawNote(context, notationStave(), note, x, showAccidental);
  target.replaceChildren(...context.svg.childNodes);
}

/** Preserve fixed editor spacing while VexFlow handles musical engraving. */
export function renderStaff(
  target: SVGSVGElement,
  note: StaffNote | readonly StaffNote[] | undefined,
  preview = false,
  noteX = 152,
  options: { width?: number; key?: KeySignature; spacing?: number } = {},
): void {
  const signature = JSON.stringify([note, preview, noteX, options]);
  const previousDrawing = staffDrawings.get(target);
  if (!Array.isArray(note) && previousDrawing?.signature === signature) return;
  const staveSignature = JSON.stringify([options.width ?? 240, options.key?.fifths ?? null]);
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
  // Draw editor groups outside the scaled stave group: their hit targets use app coordinates.
  context.closeGroup();
  notes.forEach((current, index) => {
    const keyAlteration = options.key
      ? keyAccidental(options.key, (((current.step % 7) + 7) % 7) as LetterIndex)
      : 0;
    // The unbarred practice sequence spells each note independently.
    const show = options.key
      ? current.accidental !== keyAlteration
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
  const drawings = Array.from(context.svg.childNodes);
  if (previousDrawing?.stave === staveSignature && previousDrawing.element.parentNode === target) {
    // Keep the unchanged staff and clef mounted while the selected note changes.
    target.replaceChildren(previousDrawing.element, ...drawings.slice(1));
  } else target.replaceChildren(...drawings);
  if (target.firstChild)
    staffDrawings.set(target, { signature, stave: staveSignature, element: target.firstChild });
}
