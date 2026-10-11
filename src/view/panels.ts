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
  private readonly footer = requireElement('.footer', HTMLElement);
  private readonly board = requireElement('.board-card', HTMLElement);
  private readonly piano = requireElement('#piano', HTMLElement);
  private readonly sequence = requireElement('#pitch-sequence', HTMLElement);

  constructor(onNotationClose: () => void) {
    this.panels = [
      this.createPanel('#settings', '#settings-open', '#settings-close'),
      this.createPanel('#notation-panel', '#notation-open', '#notation-close'),
      this.createPanel('#assistance-panel', '#assistance-open', '#assistance-close'),
      this.createPanel('#info-panel', '#info-open', '#info-close'),
      this.createPanel('#help-panel', '#help-open', '#help-close'),
    ];
    const options = { signal: this.events.signal };
    const tabs = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.settings-tabs [role="tab"]'),
    );
    const selectTab = (selected: HTMLButtonElement): void => {
      for (const tab of tabs) {
        const active = tab === selected;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        requireElement(`#${tab.getAttribute('aria-controls')}`, HTMLDivElement).hidden = !active;
      }
      requireElement('#settings', HTMLDialogElement).scrollTop = 0;
    };
    for (const [index, tab] of tabs.entries()) {
      tab.addEventListener('click', () => selectTab(tab), options);
      tab.addEventListener(
        'keydown',
        (event) => {
          let next: number;
          switch (event.key) {
            case 'ArrowRight':
              next = (index + 1) % tabs.length;
              break;
            case 'ArrowLeft':
              next = (index + tabs.length - 1) % tabs.length;
              break;
            case 'Home':
              next = 0;
              break;
            case 'End':
              next = tabs.length - 1;
              break;
            default:
              return;
          }
          event.preventDefault();
          const target = tabs[next];
          if (target) {
            selectTab(target);
            target.focus();
          }
        },
        options,
      );
    }
    for (const panel of this.panels) {
      panel.button.addEventListener('click', () => this.toggle(panel), options);
      panel.closeButton.addEventListener('click', () => panel.dialog.close(), options);
      panel.dialog.addEventListener(
        'close',
        () => {
          if (panel.dialog.id === 'notation-panel') onNotationClose();
          // close events are queued; a panel may already have reopened by this point.
          panel.button.setAttribute('aria-expanded', String(panel.dialog.open));
          // Do not steal focus if the user has already moved to a piano key or another control.
          if (
            !this.panels.some((other) => other.dialog.open) &&
            (document.activeElement === document.body ||
              panel.dialog.contains(document.activeElement))
          )
            this.opener(panel).focus();
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
          this.toolbar.contains(target) ||
          this.footer.contains(target) ||
          this.sequence.contains(target)
        )
          return;
        if (
          active.dialog.id === 'notation-panel' &&
          (this.board.contains(target) || this.piano.contains(target))
        )
          return;
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
  private opener(panel: Panel): HTMLButtonElement {
    const parent = panel.button.closest('dialog');
    return parent && !parent.open
      ? requireElement('#assistance-open', HTMLButtonElement)
      : panel.button;
  }
}
