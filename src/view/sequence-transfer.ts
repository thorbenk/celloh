import { exportSequence, parseSequence, sequenceLink } from '../sequence-format';
import type { SequenceNote } from '../sequence';

/** Native modal supplies focus containment, Escape dismissal, and focus restoration. */
export class SequenceTransfer {
  readonly feedback = document.createElement('span');
  readonly dialog = document.createElement('dialog');
  private readonly input = document.createElement('textarea');
  private readonly status = document.createElement('p');
  private readonly apply = document.createElement('button');
  private feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly title = document.createElement('h2');

  constructor(onImport: (notes: readonly SequenceNote[]) => void) {
    this.feedback.setAttribute('role', 'status');
    this.feedback.className = 'sequence-transfer-feedback';
    this.dialog.className = 'sequence-transfer';
    this.title.id = 'sequence-transfer-title';
    this.dialog.setAttribute('aria-labelledby', this.title.id);
    this.input.setAttribute('aria-label', 'Tonfolge als Text oder Link');
    this.input.spellcheck = false;
    this.input.placeholder = 'celloh:v1 C3/4 D3/8 E3/8';
    this.status.setAttribute('role', 'status');
    this.status.id = 'sequence-transfer-help';
    this.input.id = 'sequence-transfer-input';
    this.input.setAttribute('aria-describedby', this.status.id);
    const label = document.createElement('label');
    label.htmlFor = this.input.id;
    label.textContent = 'Tonfolge als Text oder Link';
    const cancel = document.createElement('button');
    cancel.textContent = 'Schließen';
    cancel.type = this.apply.type = 'button';
    cancel.addEventListener('click', () => this.dialog.close());
    this.apply.textContent = 'Übernehmen';
    this.apply.addEventListener('click', () => {
      const result = parseSequence(this.input.value);
      if (!result.ok) {
        this.input.setAttribute('aria-invalid', 'true');
        this.status.textContent =
          result.error === 'unsupported-version'
            ? 'Diese Tonfolge-Version wird noch nicht unterstützt.'
            : 'Ungültiges Tonfolge-Format.';
        return;
      }
      onImport(result.notes);
      this.dialog.close();
    });
    const actions = document.createElement('div');
    actions.append(cancel, this.apply);
    this.dialog.append(this.title, label, this.input, this.status, actions);
    this.input.addEventListener('input', () => this.input.removeAttribute('aria-invalid'));
    // Keep app-level editing shortcuts away from the text field and modal Escape handling.
    this.dialog.addEventListener('keydown', (event) => event.stopPropagation());
  }

  openImport(text = ''): void {
    this.title.textContent = 'Tonfolge importieren';
    this.input.readOnly = false;
    this.input.value = text;
    this.status.textContent = 'Übernehmen ersetzt die aktuelle Tonfolge. Rückgängig ist möglich.';
    this.apply.hidden = false;
    this.show();
  }

  async copy(kind: 'text' | 'link', notes: readonly SequenceNote[]): Promise<void> {
    const text = kind === 'text' ? exportSequence(notes) : sequenceLink(notes, location.href);
    try {
      await navigator.clipboard.writeText(text);
      clearTimeout(this.feedbackTimer);
      this.feedback.textContent = kind === 'text' ? 'Text kopiert.' : 'Link kopiert.';
      this.feedbackTimer = setTimeout(() => {
        this.feedback.textContent = '';
      }, 2500);
    } catch {
      this.title.textContent = kind === 'text' ? 'Text kopieren' : 'Link kopieren';
      this.input.value = text;
      this.input.readOnly = true;
      this.apply.hidden = true;
      this.status.textContent = 'Bitte den markierten Text kopieren.';
      this.show();
      this.input.select();
    }
  }

  destroy(): void {
    clearTimeout(this.feedbackTimer);
    this.dialog.remove();
  }

  private show(): void {
    clearTimeout(this.feedbackTimer);
    this.feedback.textContent = '';
    this.input.removeAttribute('aria-invalid');
    if (!this.dialog.open) this.dialog.showModal();
    this.input.focus();
  }
}
