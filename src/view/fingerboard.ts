import { BoardPitchFeedbackView } from './board-pitch-feedback';
import {
  BOARD_NOTES,
  MAX_STRING_OFFSET,
  STRINGS,
  noteHue,
  keyLetter,
  DEFAULT_NOTE_DISPLAY,
  type NoteDisplaySettings,
  type BoardNote,
  type BoardLocation,
  type MidiPitch,
  type KeySignature,
} from '../music';
import type { BoardSettings } from '../model';
import { noteName, staffNote, writtenNoteName } from '../notation';
import { requireElement } from './dom';
import { boardHeight, NOTE_DIAMETER, NOTE_CLEARANCE, ROW_HEIGHT, rowY, rowGap } from './geometry';
import { positionMarkup } from './positions';

export class FingerboardView {
  readonly pitchFeedback = new BoardPitchFeedbackView();
  readonly notes: HTMLDivElement;
  readonly board: HTMLElement;
  private readonly fingerboard: HTMLDivElement;
  private readonly overlays: SVGSVGElement;
  private readonly buttons = new Map<HTMLButtonElement, BoardNote>();

  constructor(root: ParentNode = document) {
    this.notes = requireElement('#notes', HTMLDivElement, root);
    this.board = requireElement('.board-card', HTMLElement, root);
    this.fingerboard = requireElement('.fingerboard', HTMLDivElement, root);
    this.overlays = requireElement('#overlays', SVGSVGElement, root);
    this.fingerboard.style.setProperty('--note-diameter', `${NOTE_DIAMETER}px`);
    this.fingerboard.style.setProperty('--row-height', `${ROW_HEIGHT}px`);
  }
  renderNotes(
    settings: BoardSettings,
    display: Readonly<NoteDisplaySettings> = DEFAULT_NOTE_DISPLAY,
  ): void {
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
      const name = noteName(written, display.naming);
      const fullName = writtenNoteName(written, display);
      button.setAttribute(
        'aria-label',
        `${fullName}, ${string.name}-Saite, ${offset === 0 ? 'leere Saite' : `Halbtonschritt ${offset}`}`,
      );
      button.style.setProperty('--note-hue', String(noteHue(note.midi)));
      const label = settings.showOctaves ? fullName : name;
      const gap = rowGap(offset, settings);
      const crowded = gap < NOTE_DIAMETER;
      button.classList.toggle('crowded', crowded);
      button.style.setProperty(
        '--note-size',
        `${crowded ? gap - NOTE_CLEARANCE : NOTE_DIAMETER}px`,
      );
      button.textContent = crowded ? '' : label;
      button.title = `${fullName} · ${string.name}-Saite${offset === 0 ? ' · Leere Saite' : ''}`;
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
  highlight(
    selectedPitch: MidiPitch | null,
    dimOthers: boolean,
    key: KeySignature | null,
    location?: BoardLocation,
    playedPitch?: MidiPitch | null,
  ): void {
    const anchors: HTMLButtonElement[] = [];
    const highlightedPitch = playedPitch === undefined ? selectedPitch : playedPitch;
    this.notes.classList.toggle('has-selection', dimOthers && highlightedPitch !== null);
    this.notes.classList.toggle('has-key', key !== null);
    for (const [button, note] of this.buttons) {
      const selected = note.midi === selectedPitch;
      const playing = playedPitch !== undefined && note.midi === playedPitch;
      if (
        note.midi === highlightedPitch &&
        (!location ||
          (location.stringId === note.location.stringId &&
            location.offset === note.location.offset))
      )
        anchors.push(button);
      button.classList.toggle('selected', selected);
      button.classList.toggle('playing', playing);
      button.classList.toggle('outside-key', key !== null && keyLetter(note.midi, key) === -1);
      button.setAttribute('aria-pressed', String(selected));
    }
    this.pitchFeedback.setAnchors(anchors);
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
