import { SettingsStore, type Preferences } from './settings';
import { PitchFeedbackView } from './view/pitch-feedback';
import { frequency, keyName, NOTE_NAMINGS, OCTAVE_NOTATIONS } from './music';
import { staffNote, writtenNoteName } from './notation';
import { AudioPlayer } from './audio-backend';
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
import { SequenceModel } from './sequence';
import { quarterBeats } from './rhythm';
import { FeatureTour } from './view/feature-tour';

/** Wire typed user actions to the model, views, and audio. Rendering contains no event logic. */
export class App {
  private readonly settings = new SettingsStore();
  private automaticPitch: MidiPitch | null | undefined = undefined;
  private readonly pitchFeedback: PitchFeedbackView;
  private readonly model = new AppModel();
  private readonly audio = new AudioPlayer();
  private readonly events = new AbortController();
  private readonly board: FingerboardView;
  private readonly staff: StaffView;
  private readonly compact: CompactStaffView;
  private readonly piano: PianoKeyboardView;
  private readonly sequence: PitchSequenceView;
  private readonly sequenceModel = new SequenceModel();
  private readonly panels: PanelController;
  private readonly tour: FeatureTour;
  private readonly draggableNotation: DraggableNotation;
  private readonly zoom: BoardZoom;
  private readonly resizeObserver: ResizeObserver;
  private readonly sequenceObserver: ResizeObserver;
  private playbackRequest = 0;
  private replayIndex: number | null = null;
  private replayTimer: number | null = null;
  private intonationActive = false;
  private referenceA = 442;
  private tempo = 120;

  constructor(root: HTMLElement) {
    mountLayout(root);
    this.board = new FingerboardView(root);
    this.staff = new StaffView(root);
    this.compact = new CompactStaffView(root);
    this.piano = new PianoKeyboardView(
      (pitch) => {
        if (!this.model.selectPiano(pitch)) return;
        this.renderSelection();
        void this.playSelection();
      },
      (height) => {
        if (height === null) root.style.removeProperty('--piano-height');
        else root.style.setProperty('--piano-height', `${height}px`);
      },
    );
    this.piano.element.id = 'piano';
    requireElement('.footer', HTMLElement, root).before(this.piano.element);
    this.pitchFeedback = new PitchFeedbackView(
      () => this.stopReplay(),
      (cents, active, accepted) => this.board.pitchFeedback.update(cents, active, accepted),
      (pitch, automatic) => {
        this.automaticPitch = automatic ? pitch : undefined;
        this.board.pitchFeedback.resetHistory();
        this.renderBoardHighlight();
      },
      (pitch) =>
        writtenNoteName(
          staffNote(pitch, this.model.board.spelling, this.model.board.key),
          this.model.noteDisplay,
        ),
    );
    requireElement('main', HTMLElement, root).append(this.pitchFeedback.element);
    this.pitchFeedback.element.append(
      requireElement('#intonation-options', HTMLDetailsElement, root),
    );
    requireElement('.board-scroll-wrap', HTMLElement, root).append(this.pitchFeedback.diagnostics);
    const intonationToggle = requireElement('#intonation-toggle', HTMLButtonElement, root);
    intonationToggle.addEventListener(
      'click',
      () => {
        const visible = this.pitchFeedback.element.hidden;
        this.intonationActive = visible;
        this.pitchFeedback.setVisible(visible);
        this.renderBoardHighlight();
        this.settings.set('intonationVisible', visible);
        intonationToggle.setAttribute('aria-expanded', String(visible));
      },
      { signal: this.events.signal },
    );
    this.bindPiano(root);
    this.sequence = new PitchSequenceView(
      (action) => {
        this.stopReplay();
        this.sequenceModel.dispatch(action);
        const audition =
          action.type === 'select' ? this.sequenceModel.notes[action.index] : undefined;
        const selected = audition ?? this.sequenceModel.selectedNote;
        if (selected) this.model.selectPiano(selected.pitch);
        this.renderSelection();
        if (audition) void this.auditionPitch(audition.pitch);
      },
      () => {
        if (this.replayIndex !== null) this.stopReplay();
        else void this.startReplay();
      },
    );
    this.sequence.element.id = 'pitch-sequence';
    this.sequence.element.append(requireElement('#sequence-options', HTMLDetailsElement, root));
    this.sequence.element.hidden = true;
    this.piano.element.before(this.sequence.element);
    const sequenceToggle = requireElement('#sequence-toggle', HTMLButtonElement, root);
    sequenceToggle.addEventListener(
      'click',
      () => {
        const visible = this.sequence.element.hidden;
        this.sequence.element.hidden = !visible;
        if (!visible) {
          this.sequenceModel.dispatch({ type: 'done' });
          this.renderSequence();
        }
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
    this.tour = new FeatureTour(this.panels);
  }
  destroy(): void {
    this.tour.destroy();
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
  private renderPositionSummary(): void {
    const labels: string[] = [];
    for (const position of POSITIONS) {
      if (position.id === 2 || position.id === 3) {
        for (const variant of this.model.board.variants[position.id]) {
          labels.push(`${position.id} ${variant === 'lower' ? 'unten' : 'oben'}`);
        }
      } else if (this.model.board.visiblePositions.has(position.id)) {
        labels.push(String(position.id));
      }
    }
    if (this.model.board.extended) labels.push('Streckung');
    requireElement('#position-summary', HTMLSpanElement).textContent =
      labels.join(' · ') || 'Keine';
  }

  private renderBoard(): void {
    this.renderPositionSummary();
    const key = this.model.board.key;
    const naming = this.model.noteDisplay.naming;
    const name = key ? keyName(key, naming) : '';
    const chip = requireElement('#active-key', HTMLButtonElement);
    chip.hidden = key === null;
    chip.setAttribute('aria-label', key ? `${name}: Tonart aufheben` : 'Tonart aufheben');
    requireElement('#active-key-name', HTMLSpanElement).textContent = name;
    const keySelect = requireElement('#key', HTMLSelectElement);
    for (const signature of [...MAJOR_KEYS, ...MINOR_KEYS]) {
      const option = Array.from(keySelect.options).find((option) => option.value === signature.id);
      if (option) option.textContent = keyName(signature, naming);
    }
    keySelect.value = key?.id ?? '';
    requireElement('#note-naming-help', HTMLParagraphElement).textContent =
      naming === 'german'
        ? 'Deutsche Notennamen: H = B natural, B = B flat.'
        : 'Internationale Notennamen: B = deutsches H, B♭ = deutsches B.';
    keySelect.setAttribute(
      'aria-describedby',
      key?.mode === 'minor' ? 'key-notes key-help minor-help' : 'key-notes key-help',
    );
    const notes = requireElement('#key-notes', HTMLParagraphElement);
    notes.hidden = key === null;
    notes.textContent = key ? keyNoteNames(key, naming).join(' · ') : '';
    requireElement('#spelling-help', HTMLParagraphElement).hidden = key === null;
    requireElement('#spelling-controls', HTMLDivElement).hidden = key !== null;
    requireElement('#key-help', HTMLParagraphElement).hidden = key === null;
    requireElement('#minor-help', HTMLParagraphElement).hidden = key?.mode !== 'minor';
    requireElement('.header', HTMLElement).classList.toggle('has-key', key !== null);
    for (const spelling of ['sharp', 'flat']) {
      const button = requireElement(`#${spelling}`, HTMLButtonElement);
      button.disabled = key !== null;
      if (key) button.setAttribute('aria-describedby', 'spelling-help');
      else button.removeAttribute('aria-describedby');
      button.setAttribute('aria-pressed', String(spelling === this.model.board.spelling));
    }
    this.board.renderNotes(this.model.board, this.model.noteDisplay);
    this.board.renderPositions(this.model.board);
    this.renderSelection();
  }
  private renderSelection(): void {
    const target = this.model.selectedPitch;
    this.pitchFeedback.setTarget(
      this.model.selection === null
        ? null
        : writtenNoteName(this.model.selection.note, this.model.noteDisplay),
      target === null ? null : frequency(target, this.referenceA),
    );
    this.renderBoardHighlight();
    this.staff.renderSelection(this.model);
    this.compact.render(this.model.selection?.note ?? null, this.model.noteDisplay);
    this.piano.render(
      this.model.board,
      this.model.selectedPitch,
      this.model.dimOthers,
      this.model.noteDisplay,
    );
    this.piano.reveal(this.model.selectedPitch);
    this.renderSequence();
  }
  private renderSequence(): void {
    this.sequence.render(
      this.sequenceModel,
      this.model.board.key,
      this.replayIndex,
      this.model.noteDisplay,
      this.model.board.spelling,
    );
  }
  private renderBoardHighlight(): void {
    this.board.highlight(
      this.intonationActive ? null : this.model.selectedPitch,
      this.model.dimOthers,
      this.model.board.key,
      !this.intonationActive && this.model.selection?.source === 'board'
        ? this.model.selection.location
        : undefined,
      this.automaticPitch,
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
    this.bindChoice('audio-backend', 'recordings', ['recordings', 'soundfont'], (backend) => {
      this.stopReplay();
      this.audio.setBackend(backend);
      requireElement('#articulation-controls', HTMLDivElement).hidden = backend !== 'soundfont';
    });
    this.bindChoice('articulation', 'connected', ['neutral', 'detached', 'connected'], (value) => {
      this.stopReplay();
      this.audio.setArticulation(value);
    });
    this.bindChoice('note-naming', this.model.noteDisplay.naming, NOTE_NAMINGS, (naming) => {
      this.model.noteDisplay.naming = naming;
    });
    this.bindChoice(
      'octave-notation',
      this.model.noteDisplay.octaveNotation,
      OCTAVE_NOTATIONS,
      (notation) => {
        this.model.noteDisplay.octaveNotation = notation;
      },
    );
    this.bindChoice(
      'key',
      '',
      ['', ...MAJOR_KEYS.map((key) => key.id), ...MINOR_KEYS.map((key) => key.id)],
      (id) => {
        this.model.setKey([...MAJOR_KEYS, ...MINOR_KEYS].find((key) => key.id === id) ?? null);
      },
    );
    for (const key of [
      'extension',
      'to-scale',
      'highlight-toggle',
      'show-octaves',
      'position-1',
      'position-4',
      'position-2-lower',
      'position-2-upper',
      'position-3-lower',
      'position-3-upper',
    ] as const) {
      const selector =
        key === 'position-1' || key === 'position-4'
          ? `input[data-position="${key.slice(-1)}"]`
          : `#${key}`;
      const input = requireElement(selector, HTMLInputElement, root);
      input.checked = this.settings.boolean(key, input.checked);
      input.dispatchEvent(new Event('change'));
      input.addEventListener('change', () => this.settings.set(key, input.checked), {
        signal: this.events.signal,
      });
    }
    for (const key of [
      'spread',
      'reference-a',
      'volume',
      'replay-tempo',
      'pitch-hold-ms',
    ] as const) {
      const input = requireElement(`#${key}`, HTMLInputElement, root);
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
      input.dispatchEvent(new Event('input'));
      input.addEventListener('input', () => this.settings.set(key, input.valueAsNumber), {
        signal: this.events.signal,
      });
    }
    const intonationVisible = this.settings.boolean('intonationVisible', false);
    this.intonationActive = intonationVisible;
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
  /** Validate DOM strings against domain choices before they reach model or storage. */
  private bindChoice<
    K extends 'note-naming' | 'octave-notation' | 'key' | 'audio-backend' | 'articulation',
  >(
    key: K,
    fallback: Preferences[K],
    choices: readonly Preferences[K][],
    apply: (value: Preferences[K]) => void,
  ): void {
    const select = requireElement(`#${key}`, HTMLSelectElement);
    const restored = this.settings.choice(key, fallback, choices);
    select.value = restored;
    apply(restored);
    select.addEventListener(
      'change',
      () => {
        const value = choices.find((choice) => choice === select.value);
        if (value === undefined) return;
        apply(value);
        this.settings.set(key, value);
        this.renderBoard();
      },
      { signal: this.events.signal },
    );
  }
  private async playSelection(): Promise<void> {
    this.stopReplay();
    const pitch = this.model.selectedPitch;
    if (pitch === null) return;
    this.sequenceModel.input(pitch);
    this.renderSequence();
    await this.auditionPitch(pitch);
  }
  private async auditionPitch(pitch: MidiPitch): Promise<void> {
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
  private stopReplay(releaseTail = false): void {
    ++this.playbackRequest;
    this.audio.stop(releaseTail);
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
    const start = this.sequenceModel.selectedIndex ?? 0;
    const first = this.sequenceModel.notes[start];
    if (first === undefined) return;
    this.stopReplay();
    const request = this.playbackRequest;
    this.replayIndex = start;
    this.model.selectPiano(first.pitch);
    this.renderSelection();
    this.staff.status.textContent = 'Tonfolge wird geladen …';
    try {
      await this.audio.prepare(this.sequenceModel.notes.map((note) => note.pitch));
      if (request === this.playbackRequest) await this.playSequenceNote(start, request);
    } catch {
      if (request !== this.playbackRequest) return;
      this.stopReplay();
      this.staff.status.textContent = 'Tonfolge konnte nicht geladen werden. Tippe erneut.';
    }
  }
  private async playSequenceNote(index: number, request: number): Promise<void> {
    if (request !== this.playbackRequest) return;
    const note = this.sequenceModel.notes[index];
    if (note === undefined) {
      this.stopReplay(true);
      this.staff.status.textContent = 'Tonfolge abgespielt';
      return;
    }
    try {
      if (
        !(await this.audio.play(note.pitch, (60 / this.tempo) * quarterBeats(note.duration), {
          nextPitch: this.sequenceModel.notes[index + 1]?.pitch,
        })) ||
        request !== this.playbackRequest
      )
        return;
      this.replayIndex = index;
      this.model.selectPiano(note.pitch);
      this.renderSelection();
      this.staff.status.textContent = `Tonfolge: Ton ${index + 1} von ${this.sequenceModel.notes.length}`;
      this.replayTimer = window.setTimeout(
        () => {
          void this.playSequenceNote(index + 1, request);
        },
        (60_000 / this.tempo) * quarterBeats(note.duration),
      );
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
    requireElement('#position-options', HTMLDetailsElement).addEventListener(
      'change',
      () => this.renderPositionSummary(),
      { signal: this.events.signal },
    );
    const options = { signal: this.events.signal };
    const showOctaves = requireElement('#show-octaves', HTMLInputElement);
    showOctaves.addEventListener(
      'change',
      () => {
        this.model.board.showOctaves = showOctaves.checked;
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
        requireElement('#scale-help', HTMLParagraphElement).hidden = !toScale.checked;
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
