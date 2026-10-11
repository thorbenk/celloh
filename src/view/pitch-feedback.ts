import {
  PitchDetectionService,
  pitchDirection,
  type PitchMeasurement,
  type ListeningState,
} from '../pitch';
import { requireElement } from './dom';

export class PitchFeedbackView {
  readonly element = document.createElement('section');
  private readonly service: PitchDetectionService;
  private readonly events = new AbortController();
  private readonly button: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly reading: HTMLElement;
  private readonly marker: HTMLElement;
  private readonly debug: HTMLElement;
  private state: ListeningState = 'stopped';
  private targetHz: number | null = null;
  constructor(
    onStart: () => void,
    private readonly onFeedback: (cents: number | null, active: boolean, accepted: boolean) => void,
  ) {
    this.element.className = 'pitch-feedback';
    this.element.id = 'intonation';
    this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Intonation');
    this.element.innerHTML = `<div class="pitch-heading"><strong>Intonation · <span class="pitch-target">Ton wählen</span></strong><button type="button">Start Listening</button></div>
      <div class="pitch-status" role="status">Wähle einen Ton auf dem Griffbrett.</div>
      <div class="pitch-reading">— Hz · — Cent</div>
      <div class="pitch-meter" aria-hidden="true"><span class="pitch-zero"></span><span class="pitch-marker" hidden></span></div>
      <div class="pitch-labels"><span>Zu tief</span><span>0</span><span>Zu hoch</span></div>
      <details><summary>Diagnose</summary><pre class="pitch-debug">Noch keine Messung</pre></details>`;
    this.button = requireElement('button', HTMLButtonElement, this.element);
    this.status = requireElement('.pitch-status', HTMLElement, this.element);
    this.reading = requireElement('.pitch-reading', HTMLElement, this.element);
    this.marker = requireElement('.pitch-marker', HTMLElement, this.element);
    this.debug = requireElement('.pitch-debug', HTMLElement, this.element);
    this.service = new PitchDetectionService(
      (measurement, rate) => this.render(measurement, rate),
      (state, error) => this.setState(state, error),
    );
    this.button.addEventListener(
      'click',
      () => {
        if (this.state === 'listening' || this.state === 'starting') this.service.stop();
        else {
          onStart();
          void this.service.start();
        }
      },
      { signal: this.events.signal },
    );
    window.addEventListener('pagehide', () => this.service.stop(), { signal: this.events.signal });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.service.stop();
      },
      { signal: this.events.signal },
    );
  }
  setTarget(name: string | null, hz: number | null): void {
    requireElement('.pitch-target', HTMLElement, this.element).textContent =
      name && hz ? `${name} · ${hz.toFixed(1)} Hz` : 'Ton wählen';
    if (hz === this.targetHz) return;
    this.targetHz = hz;
    this.service.setTarget(hz);
    this.clear();
  }
  private clear(): void {
    this.onFeedback(null, this.state === 'listening' && !this.element.hidden, false);
    this.marker.hidden = true;
    this.reading.textContent = '— Hz · — Cent';
    this.debug.textContent = 'Noch keine Messung';
    this.status.textContent =
      this.targetHz === null
        ? 'Wähle einen Ton auf dem Griffbrett.'
        : this.state === 'listening'
          ? 'Listening…'
          : 'Bereit';
  }
  private setState(state: ListeningState, error?: string): void {
    this.state = state;
    this.button.textContent =
      state === 'starting' || state === 'listening' ? 'Stop Listening' : 'Start Listening';
    this.clear();
    if (state === 'starting') this.status.textContent = 'Mikrofon wird gestartet …';
    if (error) this.status.textContent = error;
  }
  private render(m: PitchMeasurement, rate: number): void {
    const hz = (value: number | null) =>
      value !== null && Number.isFinite(value) ? value.toFixed(1) : '—';
    this.debug.textContent = `Roh: ${hz(m.rawHz)} Hz\nGefiltert: ${hz(m.filteredHz)} Hz\nAbweichung: ${hz(m.cents)} Cent\nKlarheit: ${m.clarity.toFixed(3)}\nFrame: ${m.accepted ? 'akzeptiert' : 'verworfen'}\nAbtastrate: ${rate} Hz`;
    this.onFeedback(m.cents, this.state === 'listening' && !this.element.hidden, m.accepted);
    if (m.filteredHz === null || m.cents === null) {
      this.marker.hidden = true;
      this.reading.textContent = '— Hz · — Cent';
      this.status.textContent =
        this.targetHz === null ? 'Wähle einen Ton auf dem Griffbrett.' : 'Listening…';
      return;
    }
    if (!m.accepted) return;
    const direction = pitchDirection(m.cents);
    this.marker.hidden = false;
    this.marker.dataset.direction = direction;
    this.marker.style.left = `${50 + Math.max(-50, Math.min(50, direction === 'tune' ? 0 : m.cents)) * 0.9}%`;
    this.reading.textContent = `${m.filteredHz.toFixed(1)} Hz · ${m.cents > 0 ? '+' : ''}${m.cents.toFixed(1)} Cent`;
    const octaveError = Math.abs(m.cents) > 1150 ? ' · Oktave prüfen' : '';
    const message =
      direction === 'low'
        ? 'Zu tief — Finger Richtung Steg →'
        : direction === 'high'
          ? 'Zu hoch — Finger Richtung Schnecke ←'
          : 'In tune · Stimmt';
    if (this.status.textContent !== message + octaveError)
      this.status.textContent = message + octaveError;
  }
  setVisible(visible: boolean): void {
    this.element.hidden = !visible;
    if (!visible) this.service.stop();
  }
  destroy(): void {
    this.events.abort();
    this.service.stop();
  }
}
