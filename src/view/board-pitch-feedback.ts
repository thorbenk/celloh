import { PITCH_CONFIG, pitchDirection } from '../pitch';
import { requireElement } from './dom';
import { PitchTrace } from './pitch-trace';

/** Indicators live in the note cells, so scrolling, zoom, and spacing carry them with the notes. */
export class BoardPitchFeedbackView {
  private readonly trace = new PitchTrace();
  private animation: number | null = null;
  private lastPaint = 0;
  private indicators: HTMLElement[] = [];
  private anchors: HTMLButtonElement[] = [];
  private active = false;
  private cents: number | null = null;

  setAnchors(anchors: HTMLButtonElement[]): void {
    if (
      anchors.length === this.anchors.length &&
      anchors.every((anchor, i) => anchor === this.anchors[i])
    )
      return;
    this.trace.clear();
    this.indicators.forEach((indicator) => indicator.remove());
    this.anchors = anchors;
    this.indicators = anchors.map((anchor) => {
      const indicator = document.createElement('div');
      indicator.className = 'board-pitch-feedback';
      indicator.style.setProperty('--anchor-size', anchor.style.getPropertyValue('--note-size'));
      indicator.innerHTML = `<svg class="board-pitch-trace" width="116" height="66" viewBox="0 0 116 44" preserveAspectRatio="none" role="img" aria-label="Tonhöhenverlauf der letzten Sekunde, plus/minus 50 Cent"><rect x="14" y="18" width="58" height="8" fill="#287665" opacity="0.08"/><path class="pitch-trace-zero" d="M14 22H116" fill="none" stroke="#737a70" stroke-width="1.2"/><path class="pitch-trace-line" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="board-pitch-symbol"><svg class="board-pitch-arrow" width="20" height="44" viewBox="0 0 20 44" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg><span class="board-pitch-dot" aria-hidden="true"></span></span><span class="board-pitch-cents"></span><span class="board-pitch-unit">Cent</span>`;
      anchor.after(indicator);
      return indicator;
    });
    this.render();
  }
  update(cents: number | null, active: boolean, accepted: boolean): void {
    this.cents = cents;
    this.active = active;
    if (active) {
      this.trace.add(performance.now(), accepted ? cents : null);
      if (this.animation === null) this.animation = requestAnimationFrame(this.animate);
    } else {
      this.trace.clear();
      if (this.animation !== null) cancelAnimationFrame(this.animation);
      this.animation = null;
    }
    this.render();
    this.renderTrace(performance.now());
  }
  private readonly animate = (now: number): void => {
    if (!this.active) return;
    if (now - this.lastPaint >= 30) {
      this.renderTrace(now);
      this.lastPaint = now;
    }
    this.animation = requestAnimationFrame(this.animate);
  };
  private renderTrace(now: number): void {
    const path = this.trace.path(now);
    for (const indicator of this.indicators) {
      requireElement('.pitch-trace-line', SVGElement, indicator).setAttribute('d', path);
    }
  }
  private render(): void {
    const cents = this.cents;
    const direction = cents === null ? 'neutral' : pitchDirection(cents);
    // Short near tolerance, progressively longer for large errors; retain a distinct arrowhead.
    const error = cents === null ? 0 : Math.abs(cents);
    const progress = Math.max(
      0,
      Math.min(1, (error - PITCH_CONFIG.toleranceCents) / (50 - PITCH_CONFIG.toleranceCents)),
    );
    const length = 10 + 30 * progress ** 1.3;
    const hue = progress <= 0.5 ? 155 - 120 * progress * 2 : 35 - 30 * (progress - 0.5) * 2;
    const end = direction === 'low' ? 22 + length / 2 : 22 - length / 2;
    const start = direction === 'low' ? 22 - length / 2 : 22 + length / 2;
    const wing = direction === 'low' ? end - 4 : end + 4;
    for (const indicator of this.indicators) {
      indicator.hidden = !this.active;
      indicator.dataset.direction = direction;
      indicator.style.setProperty(
        '--pitch-color',
        `hsl(${hue} ${50 + progress * 20}% ${32 + progress * 12}%)`,
      );
      requireElement('.board-pitch-arrow path', SVGElement, indicator).setAttribute(
        'd',
        `M10 ${start}V${end}M4 ${wing}L10 ${end}L16 ${wing}`,
      );
      requireElement('.board-pitch-cents', HTMLElement, indicator).textContent =
        cents === null
          ? '—'
          : `${cents > 0 ? '+' : cents < 0 ? '−' : ''}${Math.abs(cents).toFixed(0)}`;
      indicator.setAttribute(
        'aria-label',
        cents === null
          ? 'Listening…'
          : `${cents.toFixed(1)} Cent: ${direction === 'low' ? 'Finger Richtung Steg' : direction === 'high' ? 'Finger Richtung Schnecke' : 'Stimmt'}`,
      );
    }
  }
}
