import {
  DEFAULT_NOTE_DISPLAY,
  keyName,
  type NoteDisplaySettings,
  type KeySignature,
  type Spelling,
} from '../music';
import { staffNote, staffY, writtenNoteName } from '../notation';
import { durationName, NOTE_VALUES, NOTE_VALUE_NAMES } from '../rhythm';
import type { SequenceAction, SequenceModel } from '../sequence';
import { NOTE_STEM_LENGTH, noteGlyphMarkup, staffMarkup } from './staff';

const SCALE = 0.55; // Stable note/staff size; ledger lines grow the viewport, never shrink the music.
const C_MAJOR: KeySignature = {
  id: 'major:0',
  name: 'C-Dur',
  tonic: 0,
  fifths: 0,
  spelling: 'sharp',
  mode: 'major',
};

/** Sequence notation and touch editor, mountable without the app, keyboard, or audio. */
export class PitchSequenceView {
  readonly element = document.createElement('section');
  private readonly scroll = document.createElement('div');
  private readonly staff = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  private readonly label = document.createElement('span');
  private readonly clear = document.createElement('button');
  private readonly play = document.createElement('button');
  private readonly confirmation = document.createElement('div');
  private readonly events = new AbortController();
  private readonly edit: HTMLButtonElement;
  private readonly editor = document.createElement('div');
  private readonly summary = document.createElement('span');
  private readonly hint = document.createElement('span');
  private readonly previous: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private readonly replace: HTMLButtonElement;
  private readonly insert: HTMLButtonElement;
  private readonly remove: HTMLButtonElement;
  private readonly undo: HTMLButtonElement;
  private readonly dot: HTMLButtonElement;
  private readonly durations;
  private editing = false;
  private selectedIndex: number | null = null;
  private location: number | null = null;
  private count = 0;

  constructor(onAction: (action: SequenceAction) => void, onReplay: () => void) {
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
        onAction({ type: 'clear' });
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
    this.edit = this.button('Bearbeiten', 'Tonfolge bearbeiten', () => {
      onAction({ type: this.editing ? 'done' : 'edit' });
      if (!this.editing) this.edit.focus();
    });
    this.edit.className = 'clear-note sequence-edit-toggle';
    heading.append(this.label, this.play, this.edit, this.clear);
    this.scroll.className = 'sequence-scroll';
    this.scroll.tabIndex = 0;
    this.scroll.setAttribute('aria-label', 'Tonfolge, horizontal scrollbar');
    this.staff.setAttribute('role', 'img');
    this.scroll.append(this.staff);
    this.editor.className = 'sequence-editor';
    this.editor.hidden = true;
    this.editor.id = 'sequence-editor';
    this.editor.setAttribute('role', 'group');
    this.editor.setAttribute('aria-label', 'Tonfolge bearbeiten');
    this.edit.setAttribute('aria-controls', this.editor.id);
    const selection = document.createElement('div');
    selection.className = 'sequence-selection';
    this.summary.className = 'sequence-summary';
    this.summary.setAttribute('aria-live', 'polite');
    this.previous = this.button('', 'Vorherige Note', () => onAction({ type: 'move', delta: -1 }));
    this.previous.innerHTML =
      '<span class="material-icon icon-chevron-left" aria-hidden="true"></span>';
    this.next = this.button('', 'Nächste Note', () => onAction({ type: 'move', delta: 1 }));
    this.next.innerHTML =
      '<span class="material-icon icon-chevron-right" aria-hidden="true"></span>';
    selection.append(this.summary, this.previous, this.next);
    const rhythm = document.createElement('div');
    rhythm.className = 'sequence-durations';
    const lengths = document.createElement('div');
    lengths.className = 'sequence-duration-segments';
    lengths.setAttribute('role', 'group');
    lengths.setAttribute('aria-label', 'Notenlänge');
    this.durations = NOTE_VALUES.map((value) => {
      const button = this.button('', `${NOTE_VALUE_NAMES[value]} (1/${value})`, () =>
        onAction({ type: 'duration', value }),
      );
      const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      symbol.classList.add('sequence-duration-symbol');
      symbol.setAttribute('viewBox', '0 45 60 100');
      symbol.setAttribute('fill', 'currentColor');
      symbol.innerHTML = noteGlyphMarkup(
        { step: 6, accidental: 0, duration: { value, dotted: false } },
        20,
      );
      symbol.setAttribute('aria-hidden', 'true');
      button.append(symbol);
      lengths.append(button);
      return { value, button };
    });
    this.dot = this.button('·', 'Punktierung', () => onAction({ type: 'dot' }));
    this.dot.classList.add('sequence-dot-toggle');
    rhythm.append(lengths, this.dot);
    const actions = document.createElement('div');
    actions.className = 'sequence-actions';
    this.replace = this.button('', 'Note bearbeiten', () => onAction({ type: 'replace' }));
    this.insert = this.button('', 'Einfügen', () => onAction({ type: 'insert' }));
    this.replace.innerHTML =
      '<span class="material-icon icon-replace-audio" aria-hidden="true"></span>';
    this.insert.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10M12 3v18M7 21h10" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    const modes = document.createElement('div');
    modes.className = 'sequence-modes';
    modes.setAttribute('role', 'group');
    modes.setAttribute('aria-label', 'Bearbeitungsmodus');
    modes.append(this.replace, this.insert);
    this.remove = this.button('', 'Ausgewählte Note löschen', () => onAction({ type: 'delete' }));
    this.remove.classList.add('sequence-delete');
    this.remove.innerHTML = '<span class="material-icon icon-delete" aria-hidden="true"></span>';
    this.undo = this.button('', 'Rückgängig', () => onAction({ type: 'undo' }));
    this.undo.innerHTML = '<span class="material-icon icon-undo" aria-hidden="true"></span>';
    actions.append(modes, this.remove, this.undo);
    this.hint.className = 'sequence-hint';
    this.editor.append(selection, rhythm, actions, this.hint);
    this.element.append(heading, this.confirmation, this.scroll, this.editor);
    // Delegate from the stable SVG: note nodes are replaced on every render.
    const selectNote = (target: EventTarget | null): boolean => {
      if (!(target instanceof Node)) return false;
      const index = Array.from(this.staff.querySelectorAll('.staff-note')).findIndex((note) =>
        note.contains(target),
      );
      if (index === -1) return false;
      onAction({ type: 'select', index });
      return true;
    };
    this.staff.addEventListener(
      'click',
      (event) => {
        const gap =
          event.target instanceof Element ? event.target.closest('[data-position]') : null;
        if (gap)
          onAction({ type: 'position', position: Number(gap.getAttribute('data-position')) });
        else selectNote(event.target);
      },
      options,
    );
    this.scroll.addEventListener(
      'keydown',
      (event) => {
        switch (event.key) {
          case 'Enter':
          case ' ':
            if (event.target instanceof Element && event.target.hasAttribute('data-position')) {
              event.preventDefault();
              onAction({
                type: 'position',
                position: Number(event.target.getAttribute('data-position')),
              });
            } else if (selectNote(event.target)) {
              event.preventDefault();
              this.focusSelected();
            }
            break;
          case 'ArrowLeft':
          case 'ArrowRight':
            event.preventDefault();
            onAction({ type: 'move', delta: event.key === 'ArrowLeft' ? -1 : 1 });
            this.focusSelected();
            break;
          case 'Delete':
          case 'Backspace':
            event.preventDefault();
            if (!this.editing) break;
            onAction({ type: 'delete' });
            this.focusSelected();
            break;
        }
      },
      options,
    );
    this.element.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape' || !this.editing) return;
        event.preventDefault();
        onAction({ type: 'done' });
        this.edit.focus();
      },
      options,
    );
  }

  render(
    sequence: SequenceModel,
    selectedKey: KeySignature | null = null,
    playingIndex: number | null = null,
    display: Readonly<NoteDisplaySettings> = DEFAULT_NOTE_DISPLAY,
    spelling: Spelling = 'sharp',
  ): void {
    const following =
      this.scroll.scrollLeft + this.scroll.clientWidth >= this.scroll.scrollWidth - 1;
    const focusedNote = this.staff.contains(document.activeElement);
    const editor = sequence.editor;
    this.editing = editor.mode !== 'capture';
    this.selectedIndex = sequence.selectedIndex;
    const key = selectedKey ?? C_MAJOR;
    const notes = sequence.notes.map(({ pitch, duration }) => ({
      ...staffNote(pitch, selectedKey?.spelling ?? spelling, selectedKey),
      duration,
    }));
    // Insertion gives notes and the gaps separate 44px touch targets without adding panel height.
    const spacing = editor.mode === 'insert' ? 176 : 88;
    const firstX = 140 + Math.abs(key.fifths) * 22;
    const width = Math.max(
      240,
      firstX + Math.max(0, notes.length - 1) * spacing + (this.editing ? spacing : 48),
    );
    let top = 40;
    let bottom = staffY(8) + NOTE_STEM_LENGTH + 10; // Empty staff also fits a middle-line down-stem.
    for (const note of notes) {
      const y = staffY(note.step);
      // Reserve stem space even for whole notes: changing duration must not move the staff.
      top = Math.min(top, y - (note.step >= 8 ? 32 : NOTE_STEM_LENGTH + 10));
      bottom = Math.max(bottom, y + (note.step >= 8 ? NOTE_STEM_LENGTH + 10 : 32));
    }
    bottom = Math.max(bottom, top + 80 / SCALE); // Full-height finger targets.
    this.staff.setAttribute('viewBox', `0 ${top} ${width} ${bottom - top}`);
    this.staff.style.width = `${width * SCALE}px`;
    this.staff.style.height = `${(bottom - top) * SCALE}px`;
    this.staff.setAttribute(
      'aria-label',
      `${keyName(key, display.naming)}: ${notes.length ? notes.map((note) => writtenNoteName(note, display)).join(', ') : 'noch keine Töne'}`,
    );
    this.staff.setAttribute('role', 'group');
    this.staff.innerHTML = staffMarkup(notes, false, firstX, {
      width,
      key,
      spacing,
    });
    const groups = this.staff.querySelectorAll<SVGGElement>('.staff-note');
    groups.forEach((group, index) => {
      const note = notes[index];
      const duration = sequence.notes[index]?.duration;
      if (!note || !duration) return;
      group.setAttribute('role', 'button');
      group.setAttribute('tabindex', index === (this.selectedIndex ?? 0) ? '0' : '-1');
      group.setAttribute(
        'aria-label',
        `Note ${index + 1}: ${writtenNoteName(note, display)}, ${durationName(duration)}`,
      );
      group.setAttribute('aria-pressed', String(index === this.selectedIndex));
      group.classList.toggle('sequence-selected', index === this.selectedIndex);
      group.insertAdjacentHTML(
        'afterbegin',
        `<rect class="sequence-note-target" x="${firstX + index * spacing - 44}" y="${top + 1}" width="88" height="${bottom - top - 2}" rx="6"/>`,
      );
    });
    const activeDuration =
      editor.mode === 'insert' ? editor.duration : sequence.selectedNote?.duration;
    this.editor.hidden = !this.editing;
    this.edit.textContent = this.editing ? 'Fertig' : 'Bearbeiten';
    this.edit.setAttribute(
      'aria-label',
      this.editing ? 'Bearbeiten beenden' : 'Tonfolge bearbeiten',
    );
    this.edit.setAttribute('aria-expanded', String(this.editing));
    const selectedStaffNote = this.selectedIndex === null ? undefined : notes[this.selectedIndex];
    this.summary.textContent =
      editor.mode === 'insert'
        ? `Einfügen ${editor.position < notes.length ? `vor Note ${editor.position + 1}` : 'am Ende'} · ${durationName(editor.duration)}`
        : this.selectedIndex !== null && selectedStaffNote
          ? `Note ${this.selectedIndex + 1} von ${notes.length} · ${writtenNoteName(selectedStaffNote, display)} · ${durationName(selectedStaffNote.duration)}`
          : 'Noch keine Töne · Einfügen zum Starten';
    this.previous.disabled =
      editor.mode === 'insert'
        ? editor.position === 0
        : this.selectedIndex === null || this.selectedIndex === 0;
    this.next.disabled =
      editor.mode === 'insert'
        ? editor.position === notes.length
        : this.selectedIndex === null || this.selectedIndex === notes.length - 1;
    this.replace.setAttribute('aria-pressed', String(editor.mode === 'replace'));
    this.insert.setAttribute('aria-pressed', String(editor.mode === 'insert'));
    this.remove.disabled = this.selectedIndex === null;
    this.undo.disabled = !sequence.canUndo;
    this.hint.textContent =
      editor.mode === 'replace'
        ? 'Note antippen zum Anhören. Klaviatur oder Griffbrett ersetzen die ausgewählte Note.'
        : editor.mode === 'insert'
          ? 'Zwischen die Noten tippen, um den Cursor zu bewegen. Klaviatur und Griffbrett fügen neue Töne ein.'
          : 'Note antippen zum Bearbeiten. Klaviatur und Griffbrett spielen nur zur Probe.';
    for (const { value, button } of this.durations) {
      button.disabled = activeDuration === undefined;
      button.setAttribute('aria-pressed', String(activeDuration?.value === value));
    }
    this.dot.disabled = activeDuration === undefined;
    this.dot.setAttribute('aria-pressed', String(activeDuration?.dotted ?? false));
    this.play.textContent = playingIndex === null ? '▶ Abspielen' : '■ Stopp';
    this.play.setAttribute(
      'aria-label',
      playingIndex === null ? 'Tonfolge abspielen' : 'Tonfolge stoppen',
    );
    this.play.disabled = notes.length === 0;
    this.label.textContent = `Tonfolge · ${keyName(key, display.naming)}`;
    this.clear.disabled = notes.length === 0;
    const added = notes.length > this.count;
    this.count = notes.length;
    const location = editor.mode === 'insert' ? editor.position : this.selectedIndex;
    if (editor.mode === 'insert') {
      for (let position = 0; position <= notes.length; position++) {
        const x = firstX + position * spacing - spacing / 2;
        this.staff.insertAdjacentHTML(
          'beforeend',
          `<rect class="sequence-gap-target" data-position="${position}" role="button" tabindex="${position === editor.position ? 0 : -1}" aria-label="${position === notes.length ? 'Am Ende einfügen' : `Vor Note ${position + 1} einfügen`}" aria-pressed="${position === editor.position}" x="${x - 41}" y="${top + 1}" width="82" height="${bottom - top - 2}"/>`,
        );
      }
      const x = firstX + editor.position * spacing - spacing / 2;
      this.staff.insertAdjacentHTML(
        'beforeend',
        `<path class="sequence-insertion-marker" d="M${x - 7} ${top + 3}H${x + 7}M${x} ${top + 3}V${bottom - 3}M${x - 7} ${bottom - 3}H${x + 7}"/>`,
      );
    }
    if (playingIndex !== null) {
      const x = firstX + playingIndex * spacing;
      this.staff.insertAdjacentHTML(
        'afterbegin',
        `<rect class="sequence-playhead" x="${x - 25}" y="${top}" width="50" height="${bottom - top}" rx="6"/>`,
      );
      const active = groups[playingIndex];
      active?.classList.add('playing');
      this.scroll.scrollLeft = x * SCALE - this.scroll.clientWidth / 2;
    } else if (location !== null) {
      if (location !== this.location || added) {
        const x = (firstX + location * spacing) * SCALE;
        if (
          x < this.scroll.scrollLeft + 24 ||
          x > this.scroll.scrollLeft + this.scroll.clientWidth - 24
        )
          this.scroll.scrollLeft = x - this.scroll.clientWidth / 2;
      }
    } else if (!this.editing && (added || following || notes.length === 0)) this.revealLatest();
    this.location = location;
    if (focusedNote) this.focusSelected();
  }

  private button(text: string, label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sequence-control';
    button.textContent = text;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.addEventListener('click', action, { signal: this.events.signal });
    return button;
  }

  private focusSelected(): void {
    const cursor = this.staff.querySelector<SVGElement>(
      '.sequence-gap-target[aria-pressed="true"]',
    );
    if (cursor) {
      cursor.focus({ preventScroll: true });
      return;
    }
    const note =
      this.selectedIndex === null
        ? undefined
        : this.staff.querySelectorAll<SVGGElement>('.staff-note')[this.selectedIndex];
    if (note) note.focus({ preventScroll: true });
    else this.scroll.focus({ preventScroll: true });
  }

  revealLatest(): void {
    this.scroll.scrollLeft = this.count ? this.scroll.scrollWidth : 0;
  }

  destroy(): void {
    this.events.abort();
  }
}
