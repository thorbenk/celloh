import { requireElement } from './dom';

type Fit = 'all' | 'width' | null;
interface Pinch {
  readonly distance: number;
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

/** Scale notes and overlays together; reserve only their scaled size for scrolling. */
export class BoardZoom {
  private readonly viewport: HTMLDivElement;
  private readonly space: HTMLDivElement;
  private readonly board: HTMLDivElement;
  private readonly events = new AbortController();
  private readonly observer: ResizeObserver;
  private scale = 1;
  private fit: Fit = null;
  private pinch: Pinch | null = null;
  private pinching = false;
  private suppressClickUntil = 0;

  constructor(root: ParentNode = document) {
    this.viewport = requireElement('.board-scroll', HTMLDivElement, root);
    this.space = requireElement('.board-zoom-space', HTMLDivElement, root);
    this.board = requireElement('.fingerboard', HTMLDivElement, root);
    this.space.classList.add('zoomable');
    const options = { signal: this.events.signal };
    for (const [id, fit] of [
      ['zoom-fit', 'all'],
      ['zoom-width', 'width'],
      ['zoom-reset', null],
    ] as const) {
      requireElement(`#${id}`, HTMLButtonElement, root).addEventListener(
        'click',
        () => {
          this.fit = fit;
          this.scale = 1;
          this.resize();
          this.viewport.scrollTo(0, 0);
          requireElement('#settings-close', HTMLButtonElement, root).click();
          requireElement('#settings-open', HTMLButtonElement, root).focus();
        },
        options,
      );
    }
    this.viewport.addEventListener(
      'touchstart',
      (event) => {
        if (event.touches.length !== 2) return;
        event.preventDefault();
        this.pinching = true;
        this.fit = null;
        const [a, b] = event.touches;
        if (!a || !b) return;
        const bounds = this.board.getBoundingClientRect();
        this.pinch = {
          distance: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
          scale: this.scale,
          x: ((a.clientX + b.clientX) / 2 - bounds.left) / this.scale,
          y: ((a.clientY + b.clientY) / 2 - bounds.top) / this.scale,
        };
      },
      { ...options, passive: false },
    );
    this.viewport.addEventListener(
      'touchmove',
      (event) => {
        if (!this.pinching) return;
        event.preventDefault();
        if (!this.pinch || event.touches.length !== 2) return;
        const [a, b] = event.touches;
        if (!a || !b) return;
        const distance = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
        if (this.pinch.distance === 0) return;
        this.zoomAt(
          (this.pinch.scale * distance) / this.pinch.distance,
          (a.clientX + b.clientX) / 2,
          (a.clientY + b.clientY) / 2,
          this.pinch.x,
          this.pinch.y,
        );
      },
      { ...options, passive: false },
    );
    const endPinch = (event: TouchEvent): void => {
      if (!this.pinching) return;
      this.suppressClickUntil = performance.now() + 400;
      if (event.touches.length < 2) this.pinch = null;
      if (event.touches.length === 0) this.pinching = false;
    };
    this.viewport.addEventListener('touchend', endPinch, options);
    this.viewport.addEventListener('touchcancel', endPinch, options);
    this.viewport.addEventListener(
      'click',
      (event) => {
        if (event.detail !== 0 && (this.pinching || performance.now() < this.suppressClickUntil)) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      { ...options, capture: true },
    );
    // Trackpads report pinch gestures as Ctrl+wheel; ordinary wheel scrolling stays native.
    this.viewport.addEventListener(
      'wheel',
      (event) => {
        if (!event.ctrlKey) return;
        event.preventDefault();
        this.fit = null;
        const bounds = this.board.getBoundingClientRect();
        this.zoomAt(
          this.scale * Math.exp(-event.deltaY * 0.01),
          event.clientX,
          event.clientY,
          (event.clientX - bounds.left) / this.scale,
          (event.clientY - bounds.top) / this.scale,
        );
      },
      { ...options, passive: false },
    );
    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.viewport);
    this.observer.observe(this.board);
  }

  destroy(): void {
    this.events.abort();
    this.observer.disconnect();
  }

  private resize(): void {
    this.board.style.width = `${Math.max(520, Math.min(900, this.viewport.clientWidth))}px`;
    if (this.fit) {
      this.scale = this.viewport.clientWidth / this.board.clientWidth;
      if (this.fit === 'all')
        this.scale = Math.min(this.scale, this.viewport.clientHeight / this.board.clientHeight);
    }
    this.apply();
  }

  private apply(): void {
    this.board.style.transform = `scale(${this.scale})`;
    this.space.style.width = `${this.board.clientWidth * this.scale}px`;
    this.space.style.height = `${this.board.clientHeight * this.scale}px`;
  }

  private zoomAt(scale: number, clientX: number, clientY: number, x: number, y: number): void {
    this.scale = Math.max(0.1, Math.min(4, scale));
    this.apply();
    const bounds = this.board.getBoundingClientRect();
    this.viewport.scrollLeft += bounds.left + x * this.scale - clientX;
    this.viewport.scrollTop += bounds.top + y * this.scale - clientY;
  }
}
