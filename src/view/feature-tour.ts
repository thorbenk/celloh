import { driver, type Driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { requireElement } from './dom';
import type { PanelController } from './panels';

/** A repeatable overview: trying a feature is optional, never a prerequisite. */
export class FeatureTour {
  private readonly events = new AbortController();
  private readonly tour: Driver;
  private savedTab: HTMLButtonElement | null = null;
  private savedScroll = 0;
  private readonly popoverObserver = new ResizeObserver(() => this.reservePopoverSpace());
  private layoutFrame = 0;
  private readonly boardScroll = requireElement('.board-scroll', HTMLDivElement);

  constructor(private readonly panels: PanelController) {
    const step = (
      element: string,
      title: string,
      description: string,
      panel: string | null = null,
    ): DriveStep => ({
      element: () => {
        const dock =
          element === '#piano-toggle'
            ? '#piano'
            : element === '#sequence-toggle'
              ? '#pitch-sequence'
              : null;
        if (dock) {
          const view = requireElement(dock, HTMLElement);
          if (!view.hidden) return view;
        }
        return requireElement(element, HTMLElement);
      },
      popover: { title, description, side: 'top', align: 'center' },
      onHighlightStarted: () => {
        this.panels.showForTour(panel);
        if (panel === 'settings') requireElement('#music-tab', HTMLButtonElement).click();
        requireElement(element, HTMLElement).scrollIntoView({ block: 'nearest' });
      },
    });
    this.tour = driver({
      animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      showProgress: true,
      progressText: '{{current}} von {{total}}',
      nextBtnText: 'Weiter',
      prevBtnText: 'Zurück',
      doneBtnText: 'Los geht’s!',
      closeBtnLabel: 'Rundgang beenden',
      overlayClickBehavior: 'none',
      allowKeyboardControl: false,
      popoverClass: 'feature-tour',
      onPopoverRender: (popover) => {
        popover.wrapper.setAttribute('lang', 'de');
        this.popoverObserver.disconnect();
        this.popoverObserver.observe(popover.wrapper);
        this.reservePopoverSpace();
        popover.nextButton.focus({ preventScroll: true });
      },
      steps: [
        step(
          '.board-card',
          'Töne entdecken',
          'Tippe auf einen Griff und höre den Ton. Derselbe Ton leuchtet auf allen Saiten auf. Probiere es aus oder tippe auf „Weiter“.',
        ),
        step(
          '#position-controls',
          'Die Lagen kennenlernen',
          'Blende Lagen und Fingerzahlen ein. Bei der 2. und 3. Lage kannst du zwischen unten und oben wählen. Darunter aktivierst du die Rückwärtsstreckung.',
          'settings',
        ),
        step(
          '#notation-panel',
          'Noten lesen und spielen',
          'Wähle und spiele einen Ton im Notenfenster. ♭ und ♯ verändern ihn um einen Halbton. Die verschiebbare Anzeige auf dem Griffbrett zeigt dieselbe Note.',
          'notation-panel',
        ),
        step(
          '#piano-toggle',
          'Töne auf der Klaviatur',
          'Öffne die Klaviatur und probiere einen Ton. Die Tasten spielen Cello-Klang und verbinden Taste, Note und Griff miteinander.',
        ),
        step(
          '#sequence-toggle',
          'Deine eigene Tonfolge',
          '„Tonfolge“ sammelt deine gespielten Töne. Spiele sie ab oder ändere unter „Bearbeiten“ Töne und Notenlängen. Das Tempo findest du unter Einstellungen → Klang.',
        ),
        step(
          '#intonation-toggle',
          'Intonation üben',
          '„Intonation“ zeigt, wie genau du einen Ton triffst. Aktiviere das Mikrofon, wenn du bereit bist. Diesen Rundgang findest du unter Hilfe → App entdecken.',
        ),
      ],
      onDestroyed: () => {
        this.popoverObserver.disconnect();
        cancelAnimationFrame(this.layoutFrame);
        document.body.style.removeProperty('--tour-space');
        this.panels.showForTour(null);
        this.savedTab?.click();
        this.boardScroll.scrollTop = this.savedScroll;
        requireElement('#assistance-open', HTMLButtonElement).focus({ preventScroll: true });
      },
    });
    requireElement('#tour-start', HTMLButtonElement).addEventListener(
      'click',
      () => {
        this.savedTab = document.querySelector<HTMLButtonElement>(
          '.settings-tabs [aria-selected="true"]',
        );
        this.savedScroll = this.boardScroll.scrollTop;
        this.tour.drive();
      },
      { signal: this.events.signal },
    );
    for (const [selector, index] of [
      ['#piano-toggle', 3],
      ['#sequence-toggle', 4],
    ] as const) {
      requireElement(selector, HTMLButtonElement).addEventListener(
        'click',
        () => {
          if (this.tour.isActive() && this.tour.getActiveIndex() === index) {
            this.tour.moveTo(index);
          }
        },
        { signal: this.events.signal },
      );
    }
    // Escape is reserved for the tour, without also closing an app panel or editor.
    document.addEventListener(
      'keydown',
      (event) => {
        if (this.tour.isActive() && event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.tour.destroy();
        }
      },
      { capture: true, signal: this.events.signal },
    );
  }

  /** Reserve actual card height instead of guessing where each mobile target sits. */
  private reservePopoverSpace(): void {
    const popover = document.querySelector<HTMLElement>('.driver-popover');
    if (!popover || !window.matchMedia('(max-width: 600px)').matches) return;
    document.body.style.setProperty(
      '--tour-space',
      `${popover.getBoundingClientRect().height + 24}px`,
    );
    cancelAnimationFrame(this.layoutFrame);
    this.layoutFrame = requestAnimationFrame(() => {
      this.tour.getActiveElement()?.scrollIntoView({ block: 'nearest' });
      this.tour.refresh();
    });
  }

  destroy(): void {
    this.events.abort();
    this.tour.destroy();
  }
}
