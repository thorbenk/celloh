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
        popover.nextButton.focus({ preventScroll: true });
      },
      steps: [
        step(
          '.board-card',
          'Töne entdecken',
          'Tippe auf einen Ton auf dem Griffbrett, um ihn zu hören. Derselbe Ton wird auf allen Saiten hervorgehoben. Du kannst es gleich ausprobieren oder mit „Weiter“ fortfahren.',
        ),
        step(
          '#position-controls',
          'Die Lagen kennenlernen',
          'Hier blendest du Lagen und Fingerzahlen ein. Die 2. und 3. Lage haben eine untere und eine obere Variante. Darunter findest du die Rückwärtsstreckung für den ersten Finger.',
          'settings',
        ),
        step(
          '#notation-panel',
          'Noten lesen und spielen',
          'Wähle einen Ton direkt im Notenfenster. Die Vorzeichen ändern ihn um einen Halbton. Auf dem Griffbrett zeigt die kleine, verschiebbare Notenanzeige ebenfalls deinen gewählten Ton.',
          'notation-panel',
        ),
        step(
          '#piano-toggle',
          'Töne auf der Klaviatur',
          'Mit „Klaviatur“ öffnest oder schließt du die Klaviertasten. Sie spielen denselben Cello-Klang und zeigen die Verbindung zwischen Taste, Note und Griff. Öffne sie gern und probiere einen Ton.',
        ),
        step(
          '#sequence-toggle',
          'Deine eigene Tonfolge',
          'Öffne „Tonfolge“, um gespielte Töne zu sammeln. Du kannst sie abspielen oder unter „Bearbeiten“ Notenlängen ändern, Töne ersetzen und weitere Noten einfügen. Das Tempo findest du unter Einstellungen → Klang.',
        ),
        step(
          '#intonation-toggle',
          'Intonation üben',
          '„Intonation“ zeigt dir, wie genau du einen Ton triffst. Öffne die Ansicht und aktiviere das Mikrofon erst, wenn du bereit bist. Du entscheidest über den Mikrofonzugriff. Den Rundgang findest du jederzeit wieder unter Hilfe → App entdecken.',
        ),
      ],
      onDestroyed: () => {
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

  destroy(): void {
    this.events.abort();
    this.tour.destroy();
  }
}
