import { requireElement } from './dom';

interface Drag {
  readonly pointerId: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/** Move the read-only notation within the visible board, independently of board scrolling. */
export class DraggableNotation {
  private readonly widget = requireElement('#notation-display', HTMLDivElement);
  private readonly sizeToggle = requireElement('#notation-size-toggle', HTMLButtonElement);
  private readonly canvas = requireElement('.board-scroll-wrap', HTMLDivElement);
  private readonly events = new AbortController();
  private readonly observer: ResizeObserver;
  private drag: Drag | null = null;
  private x = 4;
  private y = 4;

  constructor() {
    const options = { signal: this.events.signal };
    this.sizeToggle.addEventListener(
      'click',
      () => {
        const expanded = this.widget.classList.toggle('expanded');
        const label = expanded ? 'Notenanzeige verkleinern' : 'Notenanzeige vergrößern';
        this.sizeToggle.setAttribute('aria-expanded', String(expanded));
        this.sizeToggle.setAttribute('aria-label', label);
        this.sizeToggle.title = label;
        requireElement('path', SVGPathElement, this.sizeToggle).setAttribute(
          'd',
          expanded
            ? 'M20 4l-7 7m0-6v6h6M4 20l7-7m-6 0h6v6'
            : 'M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7',
        );
        this.move(this.x, this.y);
      },
      options,
    );
    this.widget.addEventListener(
      'pointerdown',
      (event) => {
        if (!event.isPrimary || event.button !== 0 || this.drag) return;
        if (event.target instanceof Node && this.sizeToggle.contains(event.target)) return;
        event.preventDefault();
        const bounds = this.widget.getBoundingClientRect();
        this.drag = {
          pointerId: event.pointerId,
          offsetX: event.clientX - bounds.left,
          offsetY: event.clientY - bounds.top,
        };
        this.widget.setPointerCapture(event.pointerId);
        this.widget.classList.add('dragging');
      },
      options,
    );
    this.widget.addEventListener(
      'pointermove',
      (event) => {
        if (!this.drag || event.pointerId !== this.drag.pointerId) return;
        const bounds = this.canvas.getBoundingClientRect();
        this.move(
          event.clientX - bounds.left - this.drag.offsetX,
          event.clientY - bounds.top - this.drag.offsetY,
        );
      },
      options,
    );
    const endDrag = (event: PointerEvent): void => {
      if (event.pointerId !== this.drag?.pointerId) return;
      this.drag = null;
      this.widget.classList.remove('dragging');
      if (this.widget.hasPointerCapture(event.pointerId))
        this.widget.releasePointerCapture(event.pointerId);
    };
    this.widget.addEventListener('pointerup', endDrag, options);
    this.widget.addEventListener('pointercancel', endDrag, options);
    this.widget.addEventListener('lostpointercapture', endDrag, options);
    this.widget.addEventListener(
      'keydown',
      (event) => {
        if (event.target !== this.widget) return;
        const distance = event.shiftKey ? 30 : 10;
        switch (event.key) {
          case 'ArrowLeft':
            this.move(this.x - distance, this.y);
            break;
          case 'ArrowRight':
            this.move(this.x + distance, this.y);
            break;
          case 'ArrowUp':
            this.move(this.x, this.y - distance);
            break;
          case 'ArrowDown':
            this.move(this.x, this.y + distance);
            break;
          default:
            return;
        }
        event.preventDefault();
      },
      options,
    );
    this.observer = new ResizeObserver(() => this.move(this.x, this.y));
    this.observer.observe(this.canvas);
  }

  destroy(): void {
    this.events.abort();
    this.observer.disconnect();
    if (this.drag && this.widget.hasPointerCapture(this.drag.pointerId))
      this.widget.releasePointerCapture(this.drag.pointerId);
    this.drag = null;
    this.widget.classList.remove('dragging');
  }

  private move(x: number, y: number): void {
    const bounds = this.widget.getBoundingClientRect();
    this.x = Math.max(0, Math.min(x, this.canvas.clientWidth - bounds.width));
    this.y = Math.max(0, Math.min(y, this.canvas.clientHeight - bounds.height));
    this.widget.style.left = `${this.x}px`;
    this.widget.style.top = `${this.y}px`;
  }
}
