import { HeldPitchRecognizer } from '../pitch-recognition';
import { frequency, type MidiPitch } from '../music';
import {
  centsBetween,
  PitchDetectionService,
  pitchDirection,
  type PitchMeasurement,
  type ListeningState,
} from '../pitch';
import { requireElement } from './dom';

export class PitchFeedbackView {
  readonly element = document.createElement('section');
  readonly diagnostics = document.createElement('aside');
  private readonly diagnosticsButton: HTMLButtonElement;
  private readonly service: PitchDetectionService;
  private readonly events = new AbortController();
  private readonly button: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly reading: HTMLElement;
  private readonly debug: HTMLElement;
  private state: ListeningState = 'stopped';
  private readonly recognizer = new HeldPitchRecognizer();
  private automatic = false;
  private detectedPitch: MidiPitch | null = null;
  private detectedName: string | null = null;
  private targetName: string | null = null;
  private targetHz: number | null = null;
  constructor(
    onStart: () => void,
    private readonly onFeedback: (cents: number | null, active: boolean, accepted: boolean) => void,
    private readonly onAutomaticPitch: (
      pitch: MidiPitch | null,
      automatic: boolean,
    ) => string | null,
  ) {
    this.element.className = 'pitch-feedback';
    this.element.id = 'intonation';
    this.element.hidden = true;
    this.element.setAttribute('aria-label', 'Intonation');
    this.element.innerHTML = `<div class="pitch-heading"><div class="pitch-controls"><button class="pitch-mic icon-button" type="button" aria-label="Mikrofon starten" title="Mikrofon starten" aria-pressed="false"><span class="material-icon icon-mic-off" aria-hidden="true"></span></button><label class="pitch-mode-switch slider-switch"><input class="pitch-auto-toggle" type="checkbox" role="switch" /><span class="switch-track" aria-hidden="true"></span><span>Ton erkennen</span></label></div><strong class="pitch-target">Ton wählen</strong></div>
      <div class="pitch-summary"><div class="pitch-status" role="status">Wähle einen Ton auf dem Griffbrett.</div><div class="pitch-reading">— Hz · — Cent</div></div>
      <button class="icon-button pitch-diagnostics-toggle" type="button" aria-label="Diagnose anzeigen" title="Diagnose anzeigen" aria-expanded="false" aria-controls="pitch-diagnostics"><span class="material-icon icon-terminal" aria-hidden="true"></span></button>`;
    this.diagnostics.id = 'pitch-diagnostics';
    this.diagnostics.className = 'pitch-diagnostics';
    this.diagnostics.setAttribute('aria-label', 'Intonationsdiagnose');
    this.diagnostics.hidden = true;
    this.diagnostics.innerHTML = '<pre class="pitch-debug">Noch keine Messung</pre>';
    this.diagnosticsButton = requireElement(
      '.pitch-diagnostics-toggle',
      HTMLButtonElement,
      this.element,
    );
    this.diagnosticsButton.addEventListener(
      'click',
      () => this.setDiagnosticsVisible(this.diagnostics.hidden),
      { signal: this.events.signal },
    );
    this.button = requireElement('button', HTMLButtonElement, this.element);
    this.status = requireElement('.pitch-status', HTMLElement, this.element);
    this.reading = requireElement('.pitch-reading', HTMLElement, this.element);
    this.debug = requireElement('.pitch-debug', HTMLElement, this.diagnostics);
    this.service = new PitchDetectionService(
      (measurement, rate) => this.render(measurement, rate),
      (state, error) => this.setState(state, error),
    );
    const automatic = requireElement('.pitch-auto-toggle', HTMLInputElement, this.element);
    automatic.addEventListener(
      'change',
      () => {
        this.automatic = automatic.checked;
        this.resetRecognition();
        this.clear();
      },
      { signal: this.events.signal },
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
    this.targetName = name;
    this.renderTarget();
    if (hz === this.targetHz) return;
    this.targetHz = hz;
    this.service.setTarget(hz);
    if (!this.automatic) this.clear();
    this.renderTarget();
  }
  private resetRecognition(): void {
    this.recognizer.reset();
    this.detectedPitch = null;
    this.detectedName = this.onAutomaticPitch(null, this.automatic);
    this.renderTarget();
  }
  private renderTarget(): void {
    const hz = this.automatic
      ? this.detectedPitch === null
        ? null
        : frequency(this.detectedPitch)
      : this.targetHz;
    const name = this.automatic ? this.detectedName : this.targetName;
    requireElement('.pitch-target', HTMLElement, this.element).textContent =
      name && hz
        ? `${name} · ${hz.toFixed(1)} Hz`
        : this.automatic
          ? 'Ton erkennen …'
          : 'Ton wählen';
  }
  private hasTarget(): boolean {
    return this.automatic ? this.detectedPitch !== null : this.targetHz !== null;
  }
  private clear(): void {
    this.onFeedback(null, this.state === 'listening' && !this.element.hidden, false);
    this.reading.textContent = '— Hz · — Cent';
    this.debug.textContent = 'Noch keine Messung';
    this.status.textContent =
      !this.hasTarget() && !this.automatic
        ? 'Wähle einen Ton auf dem Griffbrett.'
        : this.state === 'listening'
          ? 'Listening…'
          : 'Bereit';
  }
  private setState(state: ListeningState, error?: string): void {
    this.state = state;
    if (state !== 'listening') this.resetRecognition();
    const active = state === 'starting' || state === 'listening';
    this.button.setAttribute('aria-pressed', String(active));
    this.button.setAttribute('aria-busy', String(state === 'starting'));
    this.button.setAttribute('aria-label', active ? 'Mikrofon stoppen' : 'Mikrofon starten');
    this.button.title = active ? 'Mikrofon stoppen' : 'Mikrofon starten';
    const icon = requireElement('.material-icon', HTMLElement, this.button);
    icon.classList.toggle('icon-mic', active);
    icon.classList.toggle('icon-mic-off', !active);
    this.clear();
    if (state === 'starting') this.status.textContent = 'Mikrofon wird gestartet …';
    if (error) this.status.textContent = error;
  }
  private render(m: PitchMeasurement, rate: number): void {
    if (this.automatic) {
      const pitch = this.recognizer.measure(m.rawHz, m.accepted, performance.now());
      if (pitch !== this.detectedPitch) {
        this.detectedPitch = pitch;
        this.detectedName = this.onAutomaticPitch(pitch, true);
        // A newly recognized note starts its own cents trace, without restarting audio.
        this.onFeedback(null, this.state === 'listening' && !this.element.hidden, false);
        this.renderTarget();
      }
      m = {
        ...m,
        cents:
          pitch !== null && m.filteredHz !== null
            ? centsBetween(m.filteredHz, frequency(pitch))
            : null,
      };
    }
    const hz = (value: number | null) =>
      value !== null && Number.isFinite(value) ? value.toFixed(1) : '—';
    this.debug.textContent = `Roh: ${hz(m.rawHz)} Hz\nGefiltert: ${hz(m.filteredHz)} Hz\nAbweichung: ${hz(m.cents)} Cent\nKlarheit: ${m.clarity.toFixed(3)}\nFrame: ${m.accepted ? 'akzeptiert' : 'verworfen'}\nAbtastrate: ${rate} Hz`;
    this.onFeedback(m.cents, this.state === 'listening' && !this.element.hidden, m.accepted);
    if (m.filteredHz === null || m.cents === null) {
      this.reading.textContent = '— Hz · — Cent';
      this.status.textContent =
        !this.hasTarget() && !this.automatic ? 'Wähle einen Ton auf dem Griffbrett.' : 'Listening…';
      return;
    }
    if (!m.accepted) return;
    const direction = pitchDirection(m.cents);
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
  setHoldMs(ms: number): void {
    if (this.recognizer.holdMs === ms) return;
    this.recognizer.holdMs = ms;
    this.resetRecognition();
    this.clear();
  }
  setDiagnosticsVisible(visible: boolean): void {
    this.diagnostics.hidden = !visible;
    this.diagnosticsButton.setAttribute('aria-expanded', String(visible));
    const label = visible ? 'Diagnose ausblenden' : 'Diagnose anzeigen';
    this.diagnosticsButton.setAttribute('aria-label', label);
    this.diagnosticsButton.title = label;
  }
  setVisible(visible: boolean): void {
    this.element.hidden = !visible;
    if (!visible) {
      this.setDiagnosticsVisible(false);
      this.service.stop();
    }
  }
  destroy(): void {
    this.events.abort();
    this.service.stop();
    this.diagnostics.remove();
  }
}
