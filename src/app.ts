import { CelloAudio } from './audio';
import { AppModel } from './model';
import {
  MAJOR_KEYS,
  MINOR_KEYS,
  keyNoteNames,
  POSITIONS,
  type PositionVariant,
  type Spelling,
} from './music';
import { requireElement } from './view/dom';
import { FingerboardView } from './view/fingerboard';
import { mountLayout } from './view/layout';
import { PanelController } from './view/panels';
import { StaffView } from './view/staff';
import { DraggableNotation } from './view/draggable-notation';

/** Wire typed user actions to the model, views, and audio. Rendering contains no event logic. */
export class App {
  private readonly model = new AppModel();
  private readonly audio = new CelloAudio();
  private readonly events = new AbortController();
  private readonly board: FingerboardView;
  private readonly staff: StaffView;
  private readonly panels: PanelController;
  private readonly draggableNotation: DraggableNotation;
  private readonly resizeObserver: ResizeObserver;
  private playbackRequest = 0;

  constructor(root: HTMLElement) {
    mountLayout(root);
    this.board = new FingerboardView();
    this.staff = new StaffView();
    this.draggableNotation = new DraggableNotation();
    this.panels = new PanelController(() => {
      this.model.clearPreview();
      this.staff.renderPicker(this.model);
    });
    this.bindBoard();
    this.bindPicker();
    this.bindSettings();
    this.renderBoard();
    this.resizeObserver = this.board.observeResize(this.model.board);
  }
  destroy(): void {
    this.events.abort();
    this.resizeObserver.disconnect();
    this.panels.destroy();
    this.draggableNotation.destroy();
    this.audio.stop();
    ++this.playbackRequest;
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
    this.board.highlight(this.model.selectedPitch, this.model.dimOthers, this.model.board.key);
    this.staff.renderSelection(this.model);
  }
  private async playSelection(): Promise<void> {
    const pitch = this.model.selectedPitch;
    if (pitch === null) return;
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
    const dimToggle = requireElement('#highlight-toggle', HTMLButtonElement);
    dimToggle.addEventListener(
      'click',
      () => {
        this.model.dimOthers = !this.model.dimOthers;
        dimToggle.setAttribute('aria-pressed', String(this.model.dimOthers));
        this.board.highlight(this.model.selectedPitch, this.model.dimOthers, this.model.board.key);
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
        ++this.playbackRequest;
        this.audio.stop();
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
          this.renderBoard();
        },
        options,
      );
    }
    for (const position of POSITIONS) {
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
    for (const variant of variants) {
      const input = requireElement(`#${variant}`, HTMLInputElement);
      input.addEventListener(
        'change',
        () => {
          if (input.checked) this.model.board.variants.add(variant);
          else this.model.board.variants.delete(variant);
          this.board.renderPositions(this.model.board);
        },
        options,
      );
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
  }
}
