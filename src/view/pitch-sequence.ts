import {
  DEFAULT_NOTE_DISPLAY,
  keyName,
  type NoteDisplaySettings,
  type KeySignature,
  type Spelling,
} from '../music';
import { staffNote, staffY, writtenNoteName } from '../notation';
import { sequenceNotation } from '../sequence-notation';
import { midiPitch } from '../music';
import { durationName, NOTE_VALUES, NOTE_VALUE_NAMES } from '../rhythm';
import { SequenceTransfer } from './sequence-transfer';
import { DEFAULT_MEASURE, isMeasure, type Measure, type SequenceNote } from '../sequence';
import type { SequenceAction, SequenceModel } from '../sequence';
import { NOTE_STEM_LENGTH, renderNoteGlyph, renderStaff } from './notation-renderer';

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
  private readonly stop: HTMLButtonElement;
  private readonly more: HTMLButtonElement;
  private readonly menu = document.createElement('div');
  private readonly play = document.createElement('button');
  private readonly confirmation = document.createElement('div');
  private readonly events = new AbortController();
  private readonly edit: HTMLButtonElement;
  private readonly editor = document.createElement('div');
  private readonly summary = document.createElement('span');
  private readonly beginning: HTMLButtonElement;
  private readonly end: HTMLButtonElement;
  private readonly previous: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private readonly replace: HTMLButtonElement;
  private readonly insert: HTMLButtonElement;
  private readonly remove: HTMLButtonElement;
  private readonly undo: HTMLButtonElement;
  private readonly dot: HTMLButtonElement;
  private readonly durations;
  private measure: Measure = DEFAULT_MEASURE;
  private readonly openMeasure: () => void;
  private readonly measureDialog = document.createElement('dialog');
  private editing = false;
  private selectedIndex: number | null = null;
  private count = 0;
  private notes: readonly SequenceNote[] = [];
  private readonly transfer: SequenceTransfer;

  constructor(
    onAction: (action: SequenceAction) => void,
    onReplay: () => void,
    onStop: () => void = () => onAction({ type: 'unselect' }),
  ) {
    this.element.className = 'pitch-sequence';
    this.element.setAttribute('aria-label', 'Tonfolge');
    this.clear.className = 'clear-note';
    this.clear.textContent = 'Leeren';
    this.clear.setAttribute('aria-label', 'Tonfolge leeren');
    const options = { signal: this.events.signal };
    this.play.className = 'sequence-control sequence-play';
    this.play.type = 'button';
    this.stop = this.button('', 'Tonfolge stoppen', onStop);
    this.stop.innerHTML = '<span class="material-icon icon-stop" aria-hidden="true"></span>';
    this.more = this.button('', 'Weitere Tonfolge-Aktionen', () => {
      this.menu.hidden = !this.menu.hidden;
      this.more.setAttribute('aria-expanded', String(!this.menu.hidden));
    });
    this.more.innerHTML = '<span class="material-icon icon-more-vert" aria-hidden="true"></span>';
    this.more.setAttribute('aria-expanded', 'false');
    this.menu.className = 'sequence-menu';
    this.menu.hidden = true;
    this.transfer = new SequenceTransfer((notes, measure) =>
      onAction({ type: 'import', notes, measure }),
    );
    this.openMeasure = () => {
      enabled.checked = this.measure.numerator !== 0;
      numerator.value = String(this.measure.numerator || 4);
      denominator.value = String(this.measure.denominator || 4);
      numerator.disabled = denominator.disabled = !enabled.checked;
      denominator.setCustomValidity('');
      this.measureDialog.showModal();
    };
    const form = document.createElement('form');
    const heading = document.createElement('h2');
    heading.textContent = 'Taktart ändern';
    heading.id = 'measure-title';
    this.measureDialog.setAttribute('aria-labelledby', heading.id);
    this.measureDialog.className = 'sequence-transfer sequence-measure-dialog';
    const field = (name: string, max: number): HTMLInputElement => {
      const label = document.createElement('label');
      label.textContent = name;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '1';
      input.max = String(max);
      input.step = '1';
      input.required = true;
      label.append(input);
      form.append(label);
      return input;
    };
    form.append(heading);
    const enabledLabel = document.createElement('label');
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabledLabel.append(enabled, 'Takte anzeigen');
    form.append(enabledLabel);
    const numerator = field('Zähler', 32);
    const denominator = field('Nenner', 32);
    enabled.addEventListener('change', () => {
      numerator.disabled = denominator.disabled = !enabled.checked;
    });
    denominator.addEventListener('input', () => denominator.setCustomValidity(''));
    const cancelMeasure = this.button('Abbrechen', 'Abbrechen', () => this.measureDialog.close());
    const applyMeasure = document.createElement('button');
    applyMeasure.type = 'submit';
    applyMeasure.textContent = 'Übernehmen';
    form.append(cancelMeasure, applyMeasure);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const measure = {
        numerator: enabled.checked ? Number(numerator.value) : 0,
        denominator: enabled.checked ? Number(denominator.value) : 0,
      };
      if (!isMeasure(measure)) {
        denominator.setCustomValidity('Bitte 1, 2, 4, 8, 16 oder 32 wählen.');
        denominator.reportValidity();
        return;
      }
      onAction({ type: 'measure', measure });
      this.measureDialog.close();
    });
    this.measureDialog.addEventListener('keydown', (event) => event.stopPropagation());
    this.measureDialog.addEventListener('close', () => {
      this.staff.querySelector<SVGElement>('.vf-timesignature')?.focus();
    });
    this.measureDialog.append(form);
    this.element.append(this.measureDialog);
    for (const [text, icon, action] of [
      [
        'Text kopieren',
        'content-copy',
        () => void this.transfer.copy('text', this.notes, this.measure),
      ],
      ['Link kopieren', 'link', () => void this.transfer.copy('link', this.notes, this.measure)],
      ['Pause hinzufügen', 'more-vert', () => onAction({ type: 'rest' })],
      ['Importieren …', 'file-upload', () => this.transfer.openImport()],
    ] satisfies readonly (readonly [string, string, () => void])[]) {
      const button = this.button(text, text, () => {
        this.menu.hidden = true;
        this.more.setAttribute('aria-expanded', 'false');
        action();
      });
      const symbol = document.createElement('span');
      symbol.className = `material-icon icon-${icon}`;
      symbol.setAttribute('aria-hidden', 'true');
      button.prepend(symbol);
      this.menu.append(button);
    }
    const clearIcon = document.createElement('span');
    clearIcon.className = 'material-icon icon-delete';
    clearIcon.setAttribute('aria-hidden', 'true');
    this.clear.prepend(clearIcon);
    this.menu.append(this.clear);
    this.element.append(this.transfer.dialog, this.transfer.feedback);
    document.addEventListener(
      'pointerdown',
      (event) => {
        if (
          event.target instanceof Node &&
          !this.menu.contains(event.target) &&
          !this.more.contains(event.target)
        ) {
          this.menu.hidden = true;
          this.more.setAttribute('aria-expanded', 'false');
        }
      },
      options,
    );
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
      this.more.focus();
    };
    this.clear.addEventListener(
      'click',
      () => {
        this.menu.hidden = true;
        this.more.setAttribute('aria-expanded', 'false');
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
    this.edit.classList.add('sequence-edit-toggle');
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
    this.summary.className = 'sequence-summary visually-hidden';
    this.summary.setAttribute('aria-live', 'polite');
    this.previous = this.button('', 'Vorherige Note', () => onAction({ type: 'move', delta: -1 }));
    this.previous.innerHTML =
      '<span class="material-icon icon-chevron-left" aria-hidden="true"></span>';
    this.next = this.button('', 'Nächste Note', () => onAction({ type: 'move', delta: 1 }));
    this.next.innerHTML =
      '<span class="material-icon icon-chevron-right" aria-hidden="true"></span>';
    this.beginning = this.button('', 'Zum Anfang', () =>
      onAction({ type: 'jump', edge: 'beginning' }),
    );
    this.beginning.innerHTML =
      '<span class="material-icon icon-first-page" aria-hidden="true"></span>';
    this.end = this.button('', 'Zum Ende', () => onAction({ type: 'jump', edge: 'end' }));
    this.end.innerHTML = '<span class="material-icon icon-last-page" aria-hidden="true"></span>';
    const transport = document.createElement('div');
    transport.className = 'sequence-transport';
    transport.setAttribute('role', 'group');
    transport.setAttribute('aria-label', 'Wiedergabe');
    transport.append(
      this.label,
      this.beginning,
      this.previous,
      this.play,
      this.stop,
      this.next,
      this.end,
      this.edit,
      this.more,
    );
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
      renderNoteGlyph(symbol, { step: 6, accidental: 0, duration: { value, dotted: false } }, 20);
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
    this.editor.append(this.summary, rhythm, actions);
    this.element.append(this.scroll, transport, this.menu, this.confirmation, this.editor);
    this.element.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape' && !this.menu.hidden) {
          this.menu.hidden = true;
          this.more.setAttribute('aria-expanded', 'false');
          this.more.focus();
          event.stopImmediatePropagation();
        }
      },
      options,
    );
    // Delegate from the stable SVG: note nodes are replaced on every render.
    const selectNote = (target: EventTarget | null): boolean => {
      if (!(target instanceof Node)) return false;
      const group = target instanceof Element ? target.closest('[data-source-index]') : null;
      if (!group) return false;
      const index = Number(group.getAttribute('data-source-index'));
      onAction({ type: 'select', index });
      return true;
    };
    this.staff.addEventListener(
      'click',
      (event) => {
        if (event.target instanceof Element && event.target.closest('.vf-timesignature')) {
          this.openMeasure();
          return;
        }
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
            if (event.target instanceof Element && event.target.closest('.vf-timesignature')) {
              event.preventDefault();
              this.openMeasure();
              return;
            }
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
    this.notes = sequence.notes;
    this.measure = sequence.measure;
    const following =
      this.scroll.scrollLeft + this.scroll.clientWidth >= this.scroll.scrollWidth - 1;
    const focusedNote = this.staff.contains(document.activeElement);
    const editor = sequence.editor;
    this.editing = editor.mode !== 'capture';
    this.selectedIndex = sequence.selectedIndex;
    const key = selectedKey ?? C_MAJOR;
    const notes = sequence.notes.map(({ pitch, duration }) => ({
      ...staffNote(pitch ?? midiPitch(50), selectedKey?.spelling ?? spelling, selectedKey),
      rest: pitch === null,
      duration,
    }));
    const parts = sequenceNotation(sequence.notes, this.measure);
    const drawnNotes = parts.map((part) => ({
      ...(notes[part.sourceIndex] ?? { step: 6, accidental: 0 as const }),
      duration: part.duration,
    }));
    const visualPosition = (position: number) => {
      const found = parts.findIndex((part) => part.sourceIndex === position);
      return found < 0 ? parts.length : found;
    };
    // Keep the music stationary when switching between replacement and insertion.
    const spacing = 88;
    const firstX = 220 + Math.abs(key.fifths) * 22;
    const width = Math.max(
      240,
      firstX + Math.max(0, drawnNotes.length - 1) * spacing + (this.editing ? spacing : 48),
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
      `${keyName(key, display.naming)}: ${notes.length ? notes.map((note) => (note.rest ? 'Pause' : writtenNoteName(note, display))).join(', ') : 'noch keine Töne'}`,
    );
    this.staff.setAttribute('role', 'group');
    renderStaff(this.staff, drawnNotes, false, firstX, {
      width,
      key,
      spacing,
      measure: this.measure,
    });
    this.setupMeasureTarget();
    // Put selection backgrounds below the stave and musical ink.
    const backgrounds = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    backgrounds.setAttribute('pointer-events', 'none');
    this.staff.prepend(backgrounds);
    parts.forEach((part, index) => {
      const x = firstX + index * spacing;
      if (part.barAfter)
        this.staff.insertAdjacentHTML(
          'beforeend',
          `<path class="sequence-bar-line" d="M${x + spacing / 2} 70V150"/>`,
        );
      if (part.tieNext) {
        const y = staffY(drawnNotes[index]?.step ?? 6) + 22;
        this.staff.insertAdjacentHTML(
          'beforeend',
          `<path class="sequence-tie" d="M${x + 8} ${y} Q${x + spacing / 2} ${y + 24} ${x + spacing - 8} ${y}" fill="none" stroke="currentColor" stroke-width="2"/>`,
        );
      }
    });
    const groups = this.staff.querySelectorAll<SVGGElement>('.staff-note');
    groups.forEach((group, visualIndex) => {
      const index = parts[visualIndex]?.sourceIndex;
      if (index === undefined) return;
      group.setAttribute('data-source-index', String(index));
      const note = notes[index];
      const duration = sequence.notes[index]?.duration;
      if (!note || !duration) return;
      group.setAttribute('role', 'button');
      group.setAttribute(
        'tabindex',
        index === (this.selectedIndex ?? 0) && visualIndex === visualPosition(index) ? '0' : '-1',
      );
      group.setAttribute(
        'aria-label',
        `Note ${index + 1}: ${note.rest ? 'Pause' : writtenNoteName(note, display)}, ${durationName(duration)}`,
      );
      group.setAttribute('aria-pressed', String(index === this.selectedIndex));
      group.classList.toggle('sequence-selected', index === this.selectedIndex);
      if (index === this.selectedIndex)
        backgrounds.insertAdjacentHTML(
          'beforeend',
          `<rect class="sequence-note-highlight" x="${firstX + visualIndex * spacing - 44}" y="${top + 1}" width="88" height="${bottom - top - 2}" rx="6"/>`,
        );
      group.insertAdjacentHTML(
        'afterbegin',
        `<rect class="sequence-note-target" x="${firstX + visualIndex * spacing - 44}" y="${top + 1}" width="88" height="${bottom - top - 2}" rx="6"/>`,
      );
    });
    const activeDuration =
      editor.mode === 'insert' ? editor.duration : sequence.selectedNote?.duration;
    this.editor.hidden = !this.editing;
    this.edit.innerHTML = `<span class="material-icon icon-${this.editing ? 'check' : 'edit'}" aria-hidden="true"></span>`;
    this.edit.title = this.editing ? 'Bearbeiten beenden' : 'Tonfolge bearbeiten';
    this.edit.setAttribute('aria-pressed', String(this.editing));
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
          ? `Note ${this.selectedIndex + 1} von ${notes.length} · ${selectedStaffNote.rest ? 'Pause' : writtenNoteName(selectedStaffNote, display)} · ${durationName(selectedStaffNote.duration)}`
          : notes.length
            ? 'Keine Note ausgewählt'
            : 'Noch keine Töne · Einfügen zum Starten';
    this.previous.disabled =
      editor.mode === 'insert'
        ? editor.position === 0
        : this.selectedIndex === null || this.selectedIndex === 0;
    this.next.disabled =
      editor.mode === 'insert'
        ? editor.position === notes.length
        : this.selectedIndex === null || this.selectedIndex === notes.length - 1;
    this.beginning.disabled =
      notes.length === 0 || (this.selectedIndex !== null && this.previous.disabled);
    this.end.disabled = notes.length === 0 || (this.selectedIndex !== null && this.next.disabled);
    this.replace.setAttribute('aria-pressed', String(editor.mode === 'replace'));
    this.insert.setAttribute('aria-pressed', String(editor.mode === 'insert'));
    this.remove.disabled = this.selectedIndex === null;
    this.undo.disabled = !sequence.canUndo;
    for (const { value, button } of this.durations) {
      button.disabled = activeDuration === undefined;
      button.setAttribute('aria-pressed', String(activeDuration?.value === value));
    }
    this.dot.disabled = activeDuration === undefined;
    this.dot.setAttribute('aria-pressed', String(activeDuration?.dotted ?? false));
    this.play.innerHTML = `<span class="material-icon icon-${playingIndex === null ? 'play-arrow' : 'pause'}" aria-hidden="true"></span>`;
    this.play.setAttribute(
      'aria-label',
      playingIndex === null ? 'Tonfolge abspielen' : 'Tonfolge pausieren',
    );
    this.play.title = this.play.getAttribute('aria-label') ?? '';
    this.play.disabled = notes.length === 0;
    this.stop.disabled = playingIndex === null && this.selectedIndex === null;
    this.label.textContent = keyName(key, display.naming);
    this.clear.disabled = notes.length === 0;
    const added = notes.length > this.count;
    this.count = notes.length;
    const location = editor.mode === 'insert' ? editor.position : this.selectedIndex;
    if (editor.mode === 'insert') {
      for (let position = 0; position <= notes.length; position++) {
        const x = firstX + visualPosition(position) * spacing - spacing / 2;
        this.staff.insertAdjacentHTML(
          'beforeend',
          `<rect class="sequence-gap-target" data-position="${position}" role="button" tabindex="${position === editor.position ? 0 : -1}" aria-label="${position === notes.length ? 'Am Ende einfügen' : `Vor Note ${position + 1} einfügen`}" aria-pressed="${position === editor.position}" x="${x - 22}" y="${top + 1}" width="44" height="${bottom - top - 2}"/>`,
        );
      }
      const x = firstX + visualPosition(editor.position) * spacing - spacing / 2;
      this.staff.insertAdjacentHTML(
        'beforeend',
        `<path class="sequence-insertion-marker" d="M${x - 7} ${top + 3}H${x + 7}M${x} ${top + 3}V${bottom - 3}M${x - 7} ${bottom - 3}H${x + 7}"/>`,
      );
    }
    if (location !== null) {
      const x = (firstX + visualPosition(location) * spacing) * SCALE;
      const margin = 44 * SCALE + 2;
      if (
        x < this.scroll.scrollLeft + margin ||
        x > this.scroll.scrollLeft + this.scroll.clientWidth - margin
      )
        this.scroll.scrollLeft = x - this.scroll.clientWidth / 2;
    } else if (!this.editing && (added || following || notes.length === 0)) this.revealLatest();
    if (focusedNote) this.focusSelected();
  }

  private setupMeasureTarget(): void {
    const signature = this.staff.querySelector<SVGGElement>('.vf-timesignature');
    if (!signature) return;
    signature.setAttribute('role', 'button');
    signature.setAttribute('tabindex', '0');
    signature.setAttribute(
      'aria-label',
      `Taktart ändern: ${this.measure.numerator}/${this.measure.denominator}`,
    );
    signature.setAttribute('aria-haspopup', 'dialog');
    if (!signature.querySelector('.sequence-measure-target')) {
      const bounds = signature.getBBox();
      // Coordinates are inside VexFlow's scale(2) group; retain a 44px touch target.
      const width = Math.max(bounds.width + 12, 44 / (2 * SCALE));
      const height = Math.max(bounds.height + 12, 44 / (2 * SCALE));
      signature.insertAdjacentHTML(
        'afterbegin',
        `<rect class="sequence-measure-target" x="${bounds.x + bounds.width / 2 - width / 2}" y="${bounds.y + bounds.height / 2 - height / 2}" width="${width}" height="${height}" rx="3"/>`,
      );
    }
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
        : this.staff.querySelector<SVGGElement>(`[data-source-index="${this.selectedIndex}"]`);
    if (note) note.focus({ preventScroll: true });
    else this.scroll.focus({ preventScroll: true });
  }

  openImport(text: string): void {
    this.transfer.openImport(text);
  }

  revealLatest(): void {
    this.scroll.scrollLeft = this.count ? this.scroll.scrollWidth : 0;
  }

  destroy(): void {
    this.events.abort();
    this.transfer.destroy();
  }
}
