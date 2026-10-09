import {
  BOARD_NOTES,
  MAX_STRING_OFFSET,
  STRINGS,
  noteName,
  noteHue,
  octave,
  type BoardNote,
  type MidiPitch,
  type Spelling,
} from '../music';
import type { BoardSettings } from '../model';
import { requireElement } from './dom';
import { BOARD_HEIGHT, NOTE_RADIUS, ROW_HEIGHT, NUT_Y, rowY } from './geometry';
import { positionMarkup } from './positions';

export class FingerboardView {
  readonly notes = requireElement('#notes', HTMLDivElement);
  readonly board = requireElement('.board-card', HTMLElement);
  private readonly fingerboard = requireElement('.fingerboard', HTMLDivElement);
  private readonly overlays = requireElement('#overlays', SVGSVGElement);
  private readonly buttons = new Map<HTMLButtonElement, BoardNote>();

  constructor() {
    this.fingerboard.style.setProperty('--board-height', `${BOARD_HEIGHT}px`);
    this.fingerboard.style.setProperty('--note-diameter', `${NOTE_RADIUS * 2}px`);
    this.fingerboard.style.setProperty('--row-height', `${ROW_HEIGHT}px`);
    this.fingerboard.style.setProperty('--nut-y', `${NUT_Y}px`);
  }
  renderNotes(spelling: Spelling): void {
    this.buttons.clear();
    const rows = Array.from({ length: MAX_STRING_OFFSET + 1 }, (_, offset) => {
      const row = document.createElement('div');
      row.className = offset === 0 ? 'note-row open-row' : 'note-row';
      row.style.top = `${rowY(offset) - ROW_HEIGHT / 2}px`;
      return row;
    });
    for (const note of BOARD_NOTES) {
      const { stringId, offset } = note.location;
      const string = STRINGS[stringId];
      const cell = document.createElement('div');
      cell.className = 'note-cell';
      const button = document.createElement('button');
      button.className = 'note';
      button.dataset.string = String(stringId);
      button.dataset.offset = String(offset);
      button.dataset.midi = String(note.midi);
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute(
        'aria-label',
        `${noteName(note.midi, spelling)}, Oktave ${octave(note.midi)}, ${string.name}-Saite, ${offset === 0 ? 'leere Saite' : `Halbtonschritt ${offset}`}`,
      );
      button.style.setProperty('--note-hue', String(noteHue(note.midi)));
      button.textContent = offset === 0 ? string.name : noteName(note.midi, spelling);
      cell.append(button);
      if (offset === 0) {
        const numeral = document.createElement('span');
        numeral.className = 'string-numeral';
        numeral.textContent = string.numeral;
        cell.append(numeral);
      }
      this.buttons.set(button, note);
      const row = rows[offset];
      if (!row) throw new Error(`Missing fingerboard row ${offset}`);
      row.append(cell);
    }
    this.notes.replaceChildren(...rows);
  }
  renderPositions(settings: BoardSettings): void {
    this.overlays.setAttribute('viewBox', `0 0 ${this.fingerboard.clientWidth} ${BOARD_HEIGHT}`);
    this.overlays.innerHTML = positionMarkup(settings, this.fingerboard.clientWidth);
  }
  highlight(pitch: MidiPitch | null, dimOthers: boolean): void {
    this.notes.classList.toggle('has-selection', dimOthers && pitch !== null);
    for (const [button, note] of this.buttons) {
      const matches = note.midi === pitch;
      button.classList.toggle('selected', matches);
      button.setAttribute('aria-pressed', String(matches));
    }
  }
  noteForTarget(target: EventTarget | null): BoardNote | null {
    if (!(target instanceof Element)) return null;
    const button = target.closest('button');
    return button instanceof HTMLButtonElement ? (this.buttons.get(button) ?? null) : null;
  }
  observeResize(settings: BoardSettings): ResizeObserver {
    const observer = new ResizeObserver(() => this.renderPositions(settings));
    observer.observe(this.fingerboard);
    return observer;
  }
}
