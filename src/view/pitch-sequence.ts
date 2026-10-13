import {
  DEFAULT_NOTE_DISPLAY,
  keyName,
  type NoteDisplaySettings,
  type KeySignature,
  type MidiPitch,
  type Spelling,
} from '../music';
import { staffNote, staffY, writtenNoteName } from '../notation';
import { staffMarkup } from './staff';

const SCALE = 0.55; // Stable note/staff size; ledger lines grow the viewport, never shrink the music.
const C_MAJOR: KeySignature = {
  id: 'major:0',
  name: 'C-Dur',
  tonic: 0,
  fifths: 0,
  spelling: 'sharp',
  mode: 'major',
};

/** Read-only pitch history, mountable without the app, keyboard, picker, or audio. */
export class PitchSequenceView {
  readonly element = document.createElement('section');
  private readonly scroll = document.createElement('div');
  private readonly staff = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  private readonly label = document.createElement('span');
  private readonly clear = document.createElement('button');
  private readonly play = document.createElement('button');
  private readonly confirmation = document.createElement('div');
  private readonly events = new AbortController();
  private count = 0;

  constructor(onClear: () => void, onReplay: () => void) {
    this.element.className = 'pitch-sequence';
    this.element.setAttribute('aria-label', 'Tonfolge');
    const heading = document.createElement('div');
    heading.className = 'sequence-heading';
    this.clear.className = 'clear-note';
    this.clear.textContent = 'Leeren';
    this.clear.setAttribute('aria-label', 'Tonfolge leeren');
    const options = { signal: this.events.signal };
    this.play.className = 'clear-note sequence-play';
    this.play.addEventListener('click', onReplay, options);
    const cancel = document.createElement('button');
    cancel.className = 'clear-note';
    cancel.textContent = 'Abbrechen';
    const confirm = document.createElement('button');
    confirm.className = 'clear-note';
    confirm.textContent = 'Ja, leeren';
    const question = document.createElement('span');
    question.textContent = 'Tonfolge wirklich leeren?';
    this.confirmation.className = 'sequence-confirm';
    this.confirmation.hidden = true;
    this.confirmation.setAttribute('role', 'group');
    this.confirmation.setAttribute('aria-label', question.textContent);
    this.confirmation.append(question, cancel, confirm);
    const dismiss = (): void => {
      this.confirmation.hidden = true;
      this.clear.focus();
    };
    this.clear.addEventListener(
      'click',
      () => {
        this.confirmation.hidden = false;
        cancel.focus();
      },
      options,
    );
    cancel.addEventListener('click', dismiss, options);
    confirm.addEventListener(
      'click',
      () => {
        dismiss();
        onClear();
        this.scroll.focus();
      },
      options,
    );
    this.confirmation.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          dismiss();
        }
      },
      options,
    );
    heading.append(this.label, this.play, this.clear);
    this.scroll.className = 'sequence-scroll';
    this.scroll.tabIndex = 0;
    this.scroll.setAttribute('aria-label', 'Tonfolge, horizontal scrollbar');
    this.staff.setAttribute('role', 'img');
    this.scroll.append(this.staff);
    this.element.append(heading, this.confirmation, this.scroll);
  }

  render(
    pitches: readonly MidiPitch[],
    selectedKey: KeySignature | null = null,
    playingIndex: number | null = null,
    display: Readonly<NoteDisplaySettings> = DEFAULT_NOTE_DISPLAY,
    spelling: Spelling = 'sharp',
  ): void {
    const following =
      this.scroll.scrollLeft + this.scroll.clientWidth >= this.scroll.scrollWidth - 1;
    const key = selectedKey ?? C_MAJOR;
    const notes = pitches.map((pitch) =>
      staffNote(pitch, selectedKey?.spelling ?? spelling, selectedKey),
    );
    const firstX = 140 + Math.abs(key.fifths) * 22;
    const width = Math.max(240, firstX + Math.max(0, notes.length - 1) * 72 + 40);
    let top = 40;
    let bottom = 175;
    for (const note of notes) {
      const y = staffY(note.step);
      top = Math.min(top, y - (note.step >= 8 ? 32 : 65));
      bottom = Math.max(bottom, y + (note.step >= 8 ? 65 : 32));
    }
    this.staff.setAttribute('viewBox', `0 ${top} ${width} ${bottom - top}`);
    this.staff.style.width = `${width * SCALE}px`;
    this.staff.style.height = `${(bottom - top) * SCALE}px`;
    this.staff.setAttribute(
      'aria-label',
      `${keyName(key, display.naming)}: ${notes.length ? notes.map((note) => writtenNoteName(note, display)).join(', ') : 'noch keine Töne'}`,
    );
    this.staff.innerHTML = staffMarkup(notes, false, firstX, { width, key });
    this.play.textContent = playingIndex === null ? '▶ Abspielen' : '■ Stopp';
    this.play.setAttribute(
      'aria-label',
      playingIndex === null ? 'Tonfolge abspielen' : 'Tonfolge stoppen',
    );
    this.play.disabled = pitches.length === 0;
    this.label.textContent = `Tonfolge · ${keyName(key, display.naming)}`;
    this.clear.disabled = pitches.length === 0;
    const added = pitches.length > this.count;
    this.count = pitches.length;
    if (playingIndex !== null) {
      const x = firstX + playingIndex * 72;
      this.staff.insertAdjacentHTML(
        'afterbegin',
        `<rect class="sequence-playhead" x="${x - 25}" y="${top}" width="50" height="${bottom - top}" rx="6"/>`,
      );
      const active = this.staff.querySelectorAll('.staff-note')[playingIndex];
      active?.classList.add('playing');
      this.scroll.scrollLeft = x * SCALE - this.scroll.clientWidth / 2;
    } else if (added || following || pitches.length === 0) this.revealLatest();
  }

  revealLatest(): void {
    this.scroll.scrollLeft = this.count ? this.scroll.scrollWidth : 0;
  }

  destroy(): void {
    this.events.abort();
  }
}
