import { SettingsStore } from './settings';
import { PitchFeedbackView } from './view/pitch-feedback';
import { frequency, noteName, octave } from './music';
import { CelloAudio } from './audio';
import { AppModel } from './model';
import {
  MAJOR_KEYS,
  MINOR_KEYS,
  keyNoteNames,
  POSITIONS,
  type PositionVariant,
  type Spelling,
  type MidiPitch,
} from './music';
import { requireElement } from './view/dom';
import { FingerboardView } from './view/fingerboard';
import { mountLayout } from './view/layout';
import { PanelController } from './view/panels';
import { CompactStaffView, StaffView } from './view/staff';
import { DraggableNotation } from './view/draggable-notation';
import { PianoKeyboardView } from './view/piano';
import { PitchSequenceView } from './view/pitch-sequence';
import { BoardZoom } from './view/board-zoom';

/** Wire typed user actions to the model, views, and audio. Rendering contains no event logic. */
export class App {
  private readonly settings = new SettingsStore();
  private automaticPitch: MidiPitch | null | undefined = undefined;
  private readonly pitchFeedback: PitchFeedbackView;
  private readonly model = new AppModel();
  private readonly audio = new CelloAudio();
  private readonly events = new AbortController();
  private readonly board: FingerboardView;
  private readonly staff: StaffView;
  private readonly compact: CompactStaffView;
  private readonly piano: PianoKeyboardView;
  private readonly sequence: PitchSequenceView;
  private readonly pitches: MidiPitch[] = [];
  private readonly panels: PanelController;
  private readonly draggableNotation: DraggableNotation;
  private readonly zoom: BoardZoom;
  private readonly resizeObserver: ResizeObserver;
  private readonly sequenceObserver: ResizeObserver;
  private playbackRequest = 0;
  private replayIndex: number | null = null;
  private replayTimer: number | null = null;
  private referenceA = 440;
  private tempo = 120;

  constructor(root: HTMLElement) {
    mountLayout(root);
    this.board = new FingerboardView(root);
    this.staff = new StaffView(root);
    this.compact = new CompactStaffView(root);
    this.piano = new PianoKeyboardView((pitch) => {
      if (!this.model.selectPiano(pitch)) return;
      this.renderSelection();
      void this.playSelection();
    });
    this.piano.element.id = 'piano';
    requireElement('.footer', HTMLElement, root).before(this.piano.element);
    this.pitchFeedback = new PitchFeedbackView(
      () => this.stopReplay(),
      (cents, active, accepted) => this.board.pitchFeedback.update(cents, active, accepted),
      (pitch, automatic) => {
        this.automaticPitch = automatic ? pitch : undefined;
        this.board.pitchFeedback.resetHistory();
        this.renderBoardHighlight();
        return pitch === null
          ? null
          : `${noteName(pitch, this.model.board.spelling, this.model.board.key)}${octave(pitch)}`;
      },
    );
    requireElement('main', HTMLElement, root).append(this.pitchFeedback.element);
    requireElement('.board-scroll-wrap', HTMLElement, root).append(this.pitchFeedback.diagnostics);
    const intonationToggle = requireElement('#intonation-toggle', HTMLButtonElement, root);
    intonationToggle.addEventListener(
      'click',
      () => {
        const visible = this.pitchFeedback.element.hidden;
        this.pitchFeedback.setVisible(visible);
        this.settings.set('intonationVisible', visible);
        intonationToggle.setAttribute('aria-expanded', String(visible));
      },
      { signal: this.events.signal },
    );
    this.bindPiano(root);
    this.sequence = new PitchSequenceView(
      () => {
        this.stopReplay();
        this.pitches.length = 0;
        this.sequence.render(this.pitches, this.model.board.key);
      },
      () => {
        if (this.replayIndex !== null) this.stopReplay();
        else void this.startReplay();
      },
    );
    this.sequence.element.id = 'pitch-sequence';
    this.sequence.element.hidden = true;
    this.piano.element.before(this.sequence.element);
    const sequenceToggle = requireElement('#sequence-toggle', HTMLButtonElement, root);
    sequenceToggle.addEventListener(
      'click',
      () => {
        const visible = this.sequence.element.hidden;
        this.sequence.element.hidden = !visible;
        this.settings.set('sequenceVisible', visible);
        sequenceToggle.setAttribute('aria-expanded', String(visible));
        this.sequence.revealLatest();
      },
      { signal: this.events.signal },
    );
    this.draggableNotation = new DraggableNotation(root, this.settings);
    this.panels = new PanelController(() => {
      this.model.clearPreview();
      this.staff.renderPicker(this.model);
    });
    this.bindBoard();
    this.bindPicker();
    this.bindSettings();
    this.restoreSettings(root);
    this.renderBoard();
    this.zoom = new BoardZoom(root, this.settings);
    this.resizeObserver = this.board.observeResize(this.model.board);
    this.sequenceObserver = new ResizeObserver(() => {
      root.style.setProperty(
        '--sequence-visible-height',
        `${this.sequence.element.getBoundingClientRect().height}px`,
      );
    });
    this.sequenceObserver.observe(this.sequence.element);
  }
  destroy(): void {
    this.stopReplay();
    this.events.abort();
    this.pitchFeedback.destroy();
    this.resizeObserver.disconnect();
    this.sequenceObserver.disconnect();
    this.panels.destroy();
    this.piano.destroy();
    this.sequence.destroy();
    this.draggableNotation.destroy();
    this.zoom.destroy();
  }
  private renderBoard(): void {
    const key = this.model.board.key;
    const chip = requireElement('#active-key', HTMLButtonElement);
    chip.hidden = key === null;
    chip.setAttribute('aria-label', key ? `${key.name}: Tonart aufheben` : 'Tonart aufheben');
    requireElement('#active-key-name', HTMLSpanElement).textContent = key?.name ?? '';
    const keySelect = requireElement('#key', HTMLSelectElement);
    keySelect.value = key?.name ?? '';
    keySelect.setAttribute(
      'aria-describedby',
      key?.mode === 'minor' ? 'key-notes key-help minor-help' : 'key-notes key-help',
    );
    const notes = requireElement('#key-notes', HTMLParagraphElement);
    notes.hidden = key === null;
    notes.textContent = key ? keyNoteNames(key).join(' · ') : '';
    requireElement('#spelling-help', HTMLParagraphElement).hidden = key === null;
    requireElement('#minor-help', HTMLParagraphElement).hidden = key?.mode !== 'minor';
    requireElement('.header', HTMLElement).classList.toggle('has-key', key !== null);
    for (const spelling of ['sharp', 'flat']) {
      const button = requireElement(`#${spelling}`, HTMLButtonElement);
      button.disabled = key !== null;
      if (key) button.setAttribute('aria-describedby', 'spelling-help');
      else button.removeAttribute('aria-describedby');
      button.setAttribute('aria-pressed', String(spelling === this.model.board.spelling));
    }
    this.board.renderNotes(this.model.board);
    this.board.renderPositions(this.model.board);
    this.renderSelection();
  }
  private renderSelection(): void {
    const target = this.model.selectedPitch;
    this.pitchFeedback.setTarget(
      target === null
        ? null
        : `${noteName(target, this.model.board.spelling, this.model.board.key)}${octave(target)}`,
      target === null ? null : frequency(target, this.referenceA),
    );
    this.renderBoardHighlight();
    this.staff.renderSelection(this.model);
    this.compact.render(this.model.selection?.note ?? null);
    this.piano.render(this.model.board, this.model.selectedPitch, this.model.dimOthers);
    this.piano.reveal(this.model.selectedPitch);
    this.sequence.render(this.pitches, this.model.board.key, this.replayIndex);
  }
  private renderBoardHighlight(): void {
    this.board.highlight(
      this.automaticPitch === undefined ? this.model.selectedPitch : this.automaticPitch,
      this.model.dimOthers,
      this.model.board.key,
      this.automaticPitch === undefined && this.model.selection?.source === 'board'
        ? this.model.selection.location
        : undefined,
    );
  }
  private bindPiano(root: HTMLElement): void {
    const toggle = requireElement('#piano-toggle', HTMLButtonElement, root);
    let visible = this.settings.boolean('pianoVisible', matchMedia('(min-width: 701px)').matches);
    const update = (): void => {
      this.piano.element.hidden = !visible;
      toggle.setAttribute('aria-expanded', String(visible));
      toggle.title = visible ? 'Klaviatur ausblenden' : 'Klaviatur anzeigen';
      this.piano.reveal(this.model.selectedPitch);
    };
    update();
    toggle.addEventListener(
      'click',
      () => {
        visible = !visible;
        update();
        this.settings.set('pianoVisible', visible);
      },
      { signal: this.events.signal },
    );
  }
  private restoreSettings(root: HTMLElement): void {
    this.model.setSpelling(this.settings.choice('spelling', 'sharp', ['sharp', 'flat']));
    const inputs = root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      '#settings input, #settings select, .pitch-auto-toggle',
    );
    for (const input of inputs) {
      const key =
        input.id ||
        (input instanceof HTMLInputElement && input.dataset.position
          ? `position-${input.dataset.position}`
          : 'automaticPitch');
      if (input instanceof HTMLSelectElement) {
        input.value = this.settings.choice(
          key,
          input.value,
          Array.from(input.options, (option) => option.value),
        );
      } else if (input.type === 'checkbox') {
        input.checked = this.settings.boolean(key, input.checked);
      } else {
        const value = this.settings.number(
          key,
          input.valueAsNumber,
          Number(input.min),
          Number(input.max),
        );
        const step = Number(input.step || 1);
        input.value = String(
          Number(input.min) + Math.round((value - Number(input.min)) / step) * step,
        );
      }
      const event =
        input instanceof HTMLInputElement && input.type === 'range' ? 'input' : 'change';
      input.dispatchEvent(new Event(event));
      input.addEventListener(
        event,
        () => {
          this.settings.set(
            key,
            input instanceof HTMLSelectElement
              ? input.value
              : input.type === 'checkbox'
                ? input.checked
                : input.valueAsNumber,
          );
        },
        { signal: this.events.signal },
      );
    }
    const intonationVisible = this.settings.boolean('intonationVisible', false);
    this.pitchFeedback.setVisible(intonationVisible);
    requireElement('#intonation-toggle', HTMLButtonElement, root).setAttribute(
      'aria-expanded',
      String(intonationVisible),
    );
    const sequenceVisible = this.settings.boolean('sequenceVisible', false);
    this.sequence.element.hidden = !sequenceVisible;
    requireElement('#sequence-toggle', HTMLButtonElement, root).setAttribute(
      'aria-expanded',
      String(sequenceVisible),
    );
  }
  private async playSelection(): Promise<void> {
    this.stopReplay();
    const pitch = this.model.selectedPitch;
    if (pitch === null) return;
    this.pitches.push(pitch);
    this.sequence.render(this.pitches, this.model.board.key);
    const request = ++this.playbackRequest;
    this.staff.status.textContent = 'Klang wird geladen …';
    try {
      if ((await this.audio.play(pitch)) && request === this.playbackRequest) {
        this.staff.status.textContent = 'Cello-Klang abgespielt';
      }
    } catch {
      if (request === this.playbackRequest)
        this.staff.status.textContent = 'Klang konnte nicht geladen werden. Tippe erneut.';
    }
  }
  private stopReplay(): void {
    ++this.playbackRequest;
    this.audio.stop();
    if (this.replayTimer !== null) window.clearTimeout(this.replayTimer);
    this.replayTimer = null;
    const playing = this.replayIndex !== null;
    this.replayIndex = null;
    if (playing) {
      this.renderSelection();
      this.staff.status.textContent = 'Wiedergabe gestoppt';
    }
  }
  private async startReplay(): Promise<void> {
    const first = this.pitches[0];
    if (first === undefined) return;
    this.stopReplay();
    const request = this.playbackRequest;
    this.replayIndex = 0;
    this.model.selectPiano(first);
    this.renderSelection();
    this.staff.status.textContent = 'Tonfolge wird geladen …';
    try {
      await this.audio.prepare(this.pitches);
      if (request === this.playbackRequest) await this.playSequenceNote(0, request);
    } catch {
      if (request !== this.playbackRequest) return;
      this.stopReplay();
      this.staff.status.textContent = 'Tonfolge konnte nicht geladen werden. Tippe erneut.';
    }
  }
  private async playSequenceNote(index: number, request: number): Promise<void> {
    if (request !== this.playbackRequest) return;
    const pitch = this.pitches[index];
    if (pitch === undefined) {
      this.stopReplay();
      this.staff.status.textContent = 'Tonfolge abgespielt';
      return;
    }
    try {
      if (!(await this.audio.play(pitch)) || request !== this.playbackRequest) return;
      this.replayIndex = index;
      this.model.selectPiano(pitch);
      this.renderSelection();
      this.staff.status.textContent = `Tonfolge: Ton ${index + 1} von ${this.pitches.length}`;
      this.replayTimer = window.setTimeout(() => {
        void this.playSequenceNote(index + 1, request);
      }, 60_000 / this.tempo);
    } catch {
      if (request !== this.playbackRequest) return;
      this.stopReplay();
      this.staff.status.textContent = 'Tonfolge konnte nicht abgespielt werden. Tippe erneut.';
    }
  }
  private selectWrittenNote(step: number): void {
    const accidental =
      this.model.picker.previewStep !== null
        ? (this.model.displayedNote?.accidental ?? this.model.picker.accidental)
        : this.model.picker.accidental;
    if (!this.model.selectWritten(step, accidental)) return;
    this.renderSelection();
    void this.playSelection();
  }
  private bindBoard(): void {
    const options = { signal: this.events.signal };
    this.board.notes.addEventListener(
      'click',
      (event) => {
        const note = this.board.noteForTarget(event.target);
        if (!note) return;
        this.model.selectBoard(note);
        this.renderSelection();
        void this.playSelection();
      },
      options,
    );
    const dimToggle = requireElement('#highlight-toggle', HTMLInputElement);
    dimToggle.addEventListener(
      'change',
      () => {
        this.model.dimOthers = dimToggle.checked;
        this.renderSelection();
      },
      options,
    );
  }
  private bindPicker(): void {
    const options = { signal: this.events.signal };
    const staff = this.staff.staff;
    staff.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType === 'touch') return;
        const step = this.staff.stepAtPointer(event);
        if (step === null) return;
        this.model.preview(step);
        this.staff.renderPicker(this.model);
      },
      options,
    );
    staff.addEventListener(
      'pointerleave',
      () => {
        this.model.clearPreview();
        this.staff.renderPicker(this.model);
      },
      options,
    );
    staff.addEventListener(
      'click',
      (event) => {
        const step = event.detail === 0 ? this.model.picker.step : this.staff.stepAtPointer(event);
        if (step !== null) this.selectWrittenNote(step);
      },
      options,
    );
    staff.addEventListener(
      'keydown',
      (event) => {
        switch (event.key) {
          case 'ArrowUp':
          case 'ArrowDown':
            event.preventDefault();
            this.model.preview(this.model.picker.step + (event.key === 'ArrowUp' ? 1 : -1));
            this.staff.renderPicker(this.model);
            break;
          case 'Enter':
          case ' ':
            event.preventDefault();
            this.selectWrittenNote(this.model.picker.step);
            break;
          case 'Escape':
            this.model.clearPreview();
            this.staff.renderPicker(this.model);
            break;
        }
      },
      options,
    );
    for (const { accidental, button } of this.staff.accidentalButtons) {
      button.addEventListener(
        'click',
        () => {
          const shouldPlay = this.model.changeAccidental(accidental);
          this.renderSelection();
          if (shouldPlay) void this.playSelection();
        },
        options,
      );
    }
    requireElement('#clear-note', HTMLButtonElement).addEventListener(
      'click',
      () => {
        this.stopReplay();
        this.model.clearSelection();
        this.staff.status.textContent = 'Bereit';
        this.renderSelection();
      },
      options,
    );
  }
  private bindSettings(): void {
    const options = { signal: this.events.signal };
    const keySelect = requireElement('#key', HTMLSelectElement);
    keySelect.addEventListener(
      'change',
      () => {
        this.model.setKey(
          [...MAJOR_KEYS, ...MINOR_KEYS].find((key) => key.name === keySelect.value) ?? null,
        );
        this.renderBoard();
      },
      options,
    );
    requireElement('#active-key', HTMLButtonElement).addEventListener(
      'click',
      () => {
        this.model.setKey(null);
        this.settings.set('key', '');
        this.renderBoard();
        requireElement('#settings-open', HTMLButtonElement).focus();
      },
      options,
    );
    const toScale = requireElement('#to-scale', HTMLInputElement);
    const spreadControls = requireElement('#spread-controls', HTMLDivElement);
    const spread = requireElement('#spread', HTMLInputElement);
    const spreadValue = requireElement('#spread-value', HTMLOutputElement);
    toScale.addEventListener(
      'change',
      () => {
        this.model.board.toScale = toScale.checked;
        spreadControls.hidden = !toScale.checked;
        this.renderBoard();
      },
      options,
    );
    spread.addEventListener(
      'input',
      () => {
        this.model.board.spread = spread.valueAsNumber / 100;
        spreadValue.value = `${spread.value} %`;
        this.renderBoard();
      },
      options,
    );
    const spellings: readonly Spelling[] = ['sharp', 'flat'];
    for (const spelling of spellings) {
      requireElement(`#${spelling}`, HTMLButtonElement).addEventListener(
        'click',
        () => {
          this.model.setSpelling(spelling);
          this.settings.set('spelling', spelling);
          this.renderBoard();
        },
        options,
      );
    }
    for (const position of POSITIONS) {
      if (position.id === 2 || position.id === 3) continue;
      const input = requireElement(`input[data-position="${position.id}"]`, HTMLInputElement);
      input.addEventListener(
        'change',
        () => {
          if (input.checked) this.model.board.visiblePositions.add(position.id);
          else this.model.board.visiblePositions.delete(position.id);
          this.board.renderPositions(this.model.board);
        },
        options,
      );
    }
    const variants: readonly PositionVariant[] = ['lower', 'upper'];
    for (const position of [2, 3] as const) {
      for (const variant of variants) {
        const input = requireElement(`#position-${position}-${variant}`, HTMLInputElement);
        input.addEventListener(
          'change',
          () => {
            if (input.checked) this.model.board.variants[position].add(variant);
            else this.model.board.variants[position].delete(variant);
            this.board.renderPositions(this.model.board);
          },
          options,
        );
      }
    }
    const extension = requireElement('#extension', HTMLInputElement);
    extension.addEventListener(
      'change',
      () => {
        this.model.board.extended = extension.checked;
        this.board.renderPositions(this.model.board);
      },
      options,
    );
    const hold = requireElement('#pitch-hold-ms', HTMLInputElement);
    const holdValue = requireElement('#pitch-hold-value', HTMLOutputElement);
    hold.addEventListener(
      'input',
      () => {
        holdValue.value = `${hold.value} ms`;
        this.pitchFeedback.setHoldMs(hold.valueAsNumber);
      },
      options,
    );
    const referenceA = requireElement('#reference-a', HTMLInputElement);
    const referenceValue = requireElement('#reference-a-value', HTMLOutputElement);
    referenceA.addEventListener(
      'input',
      () => {
        this.referenceA = referenceA.valueAsNumber;
        referenceValue.value = `${referenceA.value} Hz`;
        this.audio.setReferenceA(this.referenceA);
        this.pitchFeedback.setReferenceA(this.referenceA);
        this.board.pitchFeedback.resetHistory();
        this.renderSelection();
      },
      options,
    );
    const volume = requireElement('#volume', HTMLInputElement);
    const volumeValue = requireElement('#volume-value', HTMLSpanElement);
    volume.addEventListener(
      'input',
      () => {
        this.audio.setVolume(volume.valueAsNumber / 100);
        volumeValue.textContent = `${volume.value} %`;
      },
      options,
    );
    const tempo = requireElement('#replay-tempo', HTMLInputElement);
    const tempoValue = requireElement('#replay-tempo-value', HTMLOutputElement);
    tempo.addEventListener(
      'input',
      () => {
        this.tempo = tempo.valueAsNumber;
        tempoValue.value = `${tempo.value} BPM`;
      },
      options,
    );
  }
}
