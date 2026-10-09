import { requireElement } from './dom';

interface Panel {
  readonly dialog: HTMLDialogElement;
  readonly button: HTMLButtonElement;
  readonly closeButton: HTMLButtonElement;
}

/** Nonmodal, mutually exclusive panels: toolbar and fingerboard remain usable. */
export class PanelController {
  private readonly panels: readonly Panel[];
  private readonly events = new AbortController();
  private readonly toolbar = requireElement('.header-actions', HTMLDivElement);
  private readonly board = requireElement('.board-card', HTMLElement);

  constructor(onNotationClose: () => void) {
    this.panels = [
      this.createPanel('#settings', '#settings-open', '#settings-close'),
      this.createPanel('#notation-panel', '#notation-open', '#notation-close'),
    ];
    const options = { signal: this.events.signal };
    for (const panel of this.panels) {
      panel.button.addEventListener('click', () => this.toggle(panel), options);
      panel.closeButton.addEventListener('click', () => panel.dialog.close(), options);
      panel.dialog.addEventListener(
        'close',
        () => {
          if (panel.dialog.id === 'notation-panel') onNotationClose();
          // close events are queued; a panel may already have reopened by this point.
          panel.button.setAttribute('aria-expanded', String(panel.dialog.open));
          if (!this.panels.some((other) => other.dialog.open)) panel.button.focus();
        },
        options,
      );
    }
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape') return;
        const active = this.panels.find((panel) => panel.dialog.open);
        if (active) {
          event.preventDefault();
          this.close(active);
        }
      },
      options,
    );
    document.addEventListener(
      'pointerdown',
      (event) => {
        const active = this.panels.find((panel) => panel.dialog.open);
        const target = event.target;
        if (
          !active ||
          !(target instanceof Node) ||
          active.dialog.contains(target) ||
          this.toolbar.contains(target)
        )
          return;
        if (active.dialog.id === 'notation-panel' && this.board.contains(target)) return;
        this.close(active);
      },
      options,
    );
  }
  destroy(): void {
    this.events.abort();
    for (const panel of this.panels) if (panel.dialog.open) panel.dialog.close();
  }
  private createPanel(dialog: string, button: string, close: string): Panel {
    return {
      dialog: requireElement(dialog, HTMLDialogElement),
      button: requireElement(button, HTMLButtonElement),
      closeButton: requireElement(close, HTMLButtonElement),
    };
  }
  private toggle(panel: Panel): void {
    if (panel.dialog.open) {
      this.close(panel);
      return;
    }
    for (const other of this.panels) if (other.dialog.open) this.close(other);
    panel.dialog.show();
    panel.button.setAttribute('aria-expanded', 'true');
  }
  private close(panel: Panel): void {
    panel.button.setAttribute('aria-expanded', 'false');
    panel.dialog.close();
  }
}
