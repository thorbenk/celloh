import {
  BOARD_NOTES,
  MAX_STRING_OFFSET,
  STRINGS,
  noteName,
  noteHue,
  keyLetter,
  type BoardNote,
  type MidiPitch,
  type KeySignature,
} from '../music';
import type { BoardSettings } from '../model';
import { staffNote, writtenNoteName } from '../notation';
import { requireElement } from './dom';
import {
  boardHeight,
  NOTE_DIAMETER,
  NOTE_CLEARANCE,
  ROW_HEIGHT,
  NUT_Y,
  rowY,
  rowGap,
} from './geometry';
import { positionMarkup } from './positions';

export class FingerboardView {
  readonly notes = requireElement('#notes', HTMLDivElement);
  readonly board = requireElement('.board-card', HTMLElement);
  private readonly fingerboard = requireElement('.fingerboard', HTMLDivElement);
  private readonly overlays = requireElement('#overlays', SVGSVGElement);
  private readonly buttons = new Map<HTMLButtonElement, BoardNote>();

  constructor() {
    this.fingerboard.style.setProperty('--note-diameter', `${NOTE_DIAMETER}px`);
    this.fingerboard.style.setProperty('--row-height', `${ROW_HEIGHT}px`);
    this.fingerboard.style.setProperty('--nut-y', `${NUT_Y}px`);
  }
  renderNotes(settings: BoardSettings): void {
    const { spelling, key } = settings;
    this.fingerboard.style.setProperty('--board-height', `${boardHeight(settings)}px`);
    this.buttons.clear();
    const rows = Array.from({ length: MAX_STRING_OFFSET + 1 }, (_, offset) => {
      const row = document.createElement('div');
      row.className = offset === 0 ? 'note-row open-row' : 'note-row';
      row.style.top = `${rowY(offset, settings) - ROW_HEIGHT / 2}px`;
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
      const written = staffNote(note.midi, spelling, key);
      const name = noteName(note.midi, spelling, key);
      button.setAttribute(
        'aria-label',
        `${name}, Oktave ${2 + Math.floor(written.step / 7)}, ${string.name}-Saite, ${offset === 0 ? 'leere Saite' : `Halbtonschritt ${offset}`}`,
      );
      button.style.setProperty('--note-hue', String(noteHue(note.midi)));
      const label = offset === 0 ? string.name : name;
      const gap = rowGap(offset, settings);
      const crowded = gap < NOTE_DIAMETER;
      button.classList.toggle('crowded', crowded);
      button.style.setProperty(
        '--note-size',
        `${crowded ? gap - NOTE_CLEARANCE : NOTE_DIAMETER}px`,
      );
      button.textContent = crowded ? '' : label;
      button.title = `${writtenNoteName(written)} · ${string.name}-Saite`;
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
    this.overlays.setAttribute(
      'viewBox',
      `0 0 ${this.fingerboard.clientWidth} ${boardHeight(settings)}`,
    );
    this.overlays.innerHTML = positionMarkup(settings, this.fingerboard.clientWidth);
  }
  highlight(pitch: MidiPitch | null, dimOthers: boolean, key: KeySignature | null): void {
    this.notes.classList.toggle('has-selection', dimOthers && pitch !== null);
    this.notes.classList.toggle('has-key', key !== null);
    for (const [button, note] of this.buttons) {
      const matches = note.midi === pitch;
      button.classList.toggle('selected', matches);
      button.classList.toggle('outside-key', key !== null && keyLetter(note.midi, key) === -1);
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
