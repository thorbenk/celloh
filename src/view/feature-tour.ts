import { driver, type Driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { requireElement } from './dom';
import type { PanelController } from './panels';

/** A repeatable overview: trying a feature is optional, never a prerequisite. */
export class FeatureTour {
  private readonly events = new AbortController();
  private readonly tour: Driver;
  private savedMusicOpen = true;
  private savedPositionsOpen = false;
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
        if (panel === 'settings') {
          requireElement('#music-settings', HTMLDetailsElement).open = true;
          requireElement('#position-options', HTMLDetailsElement).open = true;
        }
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
          '#settings-open',
          'Einstellungen öffnen',
          'Mit dem Zahnrad öffnest du Tonart, Lagen, Ansicht und Klang. Im nächsten Schritt schauen wir uns die Lagen an.',
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
          '„Tonfolge“ sammelt deine gespielten Töne. Spiele sie ab oder ändere unter „Bearbeiten“ Töne und Notenlängen. Das Tempo stellst du direkt in der Tonfolge ein.',
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
        document.body.style.removeProperty('--tour-anchor');
        delete document.body.dataset.tourPlacement;
        this.panels.showForTour(null);
        requireElement('#music-settings', HTMLDetailsElement).open = this.savedMusicOpen;
        requireElement('#position-options', HTMLDetailsElement).open = this.savedPositionsOpen;
        this.boardScroll.scrollTop = this.savedScroll;
        requireElement('#assistance-open', HTMLButtonElement).focus({ preventScroll: true });
      },
    });
    requireElement('#tour-start', HTMLButtonElement).addEventListener(
      'click',
      () => {
        this.savedMusicOpen = requireElement('#music-settings', HTMLDetailsElement).open;
        this.savedPositionsOpen = requireElement('#position-options', HTMLDetailsElement).open;
        this.savedScroll = this.boardScroll.scrollTop;
        this.tour.drive();
      },
      { signal: this.events.signal },
    );
    for (const [selector, index] of [
      ['#piano-toggle', 4],
      ['#sequence-toggle', 5],
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
    window.addEventListener(
      'resize',
      () => {
        if (this.tour.isActive()) this.reservePopoverSpace();
      },
      { signal: this.events.signal },
    );
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

  /** Keep toolbars fixed; only reserve workspace space for large board/panel targets. */
  private reservePopoverSpace(): void {
    cancelAnimationFrame(this.layoutFrame);
    this.layoutFrame = requestAnimationFrame(() => {
      const popover = document.querySelector<HTMLElement>('.driver-popover');
      const target = this.tour.getActiveElement();
      if (!popover || !target || !window.matchMedia('(max-width: 600px)').matches) return;
      const above =
        target.closest('.footer') !== null ||
        target.id === 'piano' ||
        target.id === 'pitch-sequence';
      const below = target.closest('.header') !== null;
      const placement = above ? 'above' : below ? 'below' : 'workspace';
      document.body.dataset.tourPlacement = placement;
      const bounds = target.getBoundingClientRect();
      document.body.style.setProperty(
        '--tour-anchor',
        `${above ? window.innerHeight - bounds.top + 12 : bounds.bottom + 12}px`,
      );
      document.body.style.setProperty(
        '--tour-space',
        placement === 'workspace' ? `${popover.getBoundingClientRect().height + 24}px` : '0px',
      );
      if (placement === 'workspace') target.scrollIntoView({ block: 'nearest' });
      this.tour.refresh();
    });
  }

  destroy(): void {
    this.events.abort();
    this.tour.destroy();
  }
}
