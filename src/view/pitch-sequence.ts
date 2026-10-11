import { type KeySignature, type MidiPitch } from '../music';
import { staffNote, staffY, writtenNoteName } from '../notation';
import { staffMarkup } from './staff';

const SCALE = 0.55; // Stable note/staff size; ledger lines grow the viewport, never shrink the music.
const C_MAJOR: KeySignature = {
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
  private readonly events = new AbortController();
  private count = 0;

  constructor(onClear: () => void) {
    this.element.className = 'pitch-sequence';
    this.element.setAttribute('aria-label', 'Tonfolge');
    const heading = document.createElement('div');
    heading.className = 'sequence-heading';
    this.clear.className = 'clear-note';
    this.clear.textContent = 'Leeren';
    this.clear.setAttribute('aria-label', 'Tonfolge leeren');
    this.clear.addEventListener('click', onClear, { signal: this.events.signal });
    heading.append(this.label, this.clear);
    this.scroll.className = 'sequence-scroll';
    this.scroll.tabIndex = 0;
    this.scroll.setAttribute('aria-label', 'Tonfolge, horizontal scrollbar');
    this.staff.setAttribute('role', 'img');
    this.scroll.append(this.staff);
    this.element.append(heading, this.scroll);
  }

  render(pitches: readonly MidiPitch[], selectedKey: KeySignature | null = null): void {
    const following =
      this.scroll.scrollLeft + this.scroll.clientWidth >= this.scroll.scrollWidth - 1;
    const key = selectedKey ?? C_MAJOR;
    const notes = pitches.map((pitch) => staffNote(pitch, key.spelling, key));
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
      `${key.name}: ${notes.length ? notes.map(writtenNoteName).join(', ') : 'noch keine Töne'}`,
    );
    this.staff.innerHTML = staffMarkup(notes, false, firstX, { width, key });
    this.label.textContent = `Tonfolge · ${key.name}`;
    this.clear.disabled = pitches.length === 0;
    const added = pitches.length > this.count;
    this.count = pitches.length;
    if (added || following || pitches.length === 0) this.revealLatest();
  }

  revealLatest(): void {
    this.scroll.scrollLeft = this.count ? this.scroll.scrollWidth : 0;
  }

  destroy(): void {
    this.events.abort();
  }
}
