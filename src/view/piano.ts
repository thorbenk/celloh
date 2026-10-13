import {
  ALL_PITCHES,
  NATURALS,
  keyLetter,
  noteHue,
  pitchClass,
  DEFAULT_NOTE_DISPLAY,
  type NoteDisplaySettings,
  type MidiPitch,
} from '../music';
import type { BoardSettings } from '../model';
import { staffNote, writtenNoteName } from '../notation';

const WHITE_KEY_WIDTH = 36;
const BLACK_KEY_WIDTH = 22;

/** Fixed key geometry inside any container; pitch, spelling, and selection come from the caller. */
export class PianoKeyboardView {
  readonly element = document.createElement('section');
  private readonly scroll = document.createElement('div');
  private readonly keys = document.createElement('div');
  private readonly events = new AbortController();
  private readonly observer: ResizeObserver;
  private readonly buttons = new Map<HTMLButtonElement, MidiPitch>();
  private selectedPitch: MidiPitch | null = null;
  private dragging = false;
  private manualScrollUntil = 0;

  constructor(onSelect: (pitch: MidiPitch) => void) {
    this.element.className = 'piano-dock';
    this.element.setAttribute('aria-label', 'Klaviatur, C2 bis A5');
    this.element.style.setProperty('--white-key-width', `${WHITE_KEY_WIDTH}px`);
    this.element.style.setProperty('--black-key-width', `${BLACK_KEY_WIDTH}px`);
    this.scroll.className = 'piano-scroll';
    this.keys.className = 'piano-keys';
    this.scroll.append(this.keys);
    this.element.append(this.scroll);
    let whites = 0;
    for (const pitch of ALL_PITCHES) {
      const black = !NATURALS.some((natural) => natural === pitchClass(pitch));
      const button = document.createElement('button');
      button.className = black ? 'piano-key black' : 'piano-key';
      button.dataset.midi = String(pitch);
      button.style.left = `${whites * WHITE_KEY_WIDTH - (black ? BLACK_KEY_WIDTH / 2 : 0)}px`;
      button.style.setProperty('--note-hue', String(noteHue(pitch)));
      button.tabIndex = pitch === ALL_PITCHES[0] ? 0 : -1;
      const label = document.createElement('span');
      label.className = 'piano-label';
      button.append(label);
      this.keys.append(button);
      this.buttons.set(button, pitch);
      if (!black) ++whites;
    }
    this.keys.style.width = `${whites * WHITE_KEY_WIDTH}px`;
    this.observer = new ResizeObserver(() => this.reveal(this.selectedPitch));
    this.observer.observe(this.scroll);
    const options = { signal: this.events.signal };
    this.keys.addEventListener(
      'click',
      (event) => {
        const button = this.buttonForTarget(event.target);
        const pitch = button ? this.buttons.get(button) : undefined;
        if (pitch !== undefined) onSelect(pitch);
      },
      options,
    );
    this.keys.addEventListener(
      'focusin',
      (event) => {
        const focused = this.buttonForTarget(event.target);
        for (const button of this.buttons.keys()) button.tabIndex = button === focused ? 0 : -1;
      },
      options,
    );
    this.keys.addEventListener(
      'keydown',
      (event) => {
        const focused = this.buttonForTarget(event.target);
        if (!focused) return;
        const buttons = [...this.buttons.keys()];
        const index = buttons.indexOf(focused);
        const next = {
          ArrowLeft: Math.max(0, index - 1),
          ArrowRight: Math.min(buttons.length - 1, index + 1),
          Home: 0,
          End: buttons.length - 1,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        buttons[next]?.focus();
      },
      options,
    );
    this.scroll.addEventListener(
      'pointerdown',
      () => {
        this.dragging = true;
      },
      options,
    );
    const endDrag = () => {
      this.dragging = false;
    };
    window.addEventListener('pointerup', endDrag, options);
    window.addEventListener('pointercancel', endDrag, options);
    this.scroll.addEventListener(
      'wheel',
      () => {
        this.manualScrollUntil = performance.now() + 900;
      },
      { ...options, passive: true },
    );
  }

  render(
    settings: BoardSettings,
    selected: MidiPitch | null,
    dimOthers: boolean,
    display: Readonly<NoteDisplaySettings> = DEFAULT_NOTE_DISPLAY,
  ): void {
    this.selectedPitch = selected;
    this.element.setAttribute(
      'aria-label',
      `Klaviatur, ${writtenNoteName({ step: 0, accidental: 0 }, display)} bis ${writtenNoteName({ step: 26, accidental: 0 }, display)}`,
    );
    for (const [button, pitch] of this.buttons) {
      const active = pitch === selected;
      const fullName = writtenNoteName(staffNote(pitch, settings.spelling, settings.key), display);
      button.setAttribute('aria-label', `${fullName}, Klaviertaste`);
      button.setAttribute('aria-pressed', String(active));
      button.title = fullName;
      button.classList.toggle('selected', active);
      button.classList.toggle('dimmed', dimOthers && selected !== null && !active);
      button.classList.toggle(
        'outside-key',
        settings.key !== null && keyLetter(pitch, settings.key) === -1,
      );
      const label = button.firstElementChild;
      if (label) label.textContent = active || !button.classList.contains('black') ? fullName : '';
    }
    // Keep one tab stop, using the selected pitch unless a key currently owns keyboard focus.
    if (!this.keys.contains(document.activeElement)) {
      for (const [button, pitch] of this.buttons) {
        button.tabIndex = pitch === (selected ?? ALL_PITCHES[0]) ? 0 : -1;
      }
    }
  }

  reveal(pitch: MidiPitch | null): void {
    if (
      pitch === null ||
      !this.scroll.clientWidth ||
      this.dragging ||
      performance.now() < this.manualScrollUntil
    )
      return;
    const button = [...this.buttons].find(([, value]) => value === pitch)?.[0];
    if (!button) return;
    const left =
      button.getBoundingClientRect().left -
      this.scroll.getBoundingClientRect().left +
      this.scroll.scrollLeft;
    const right = left + button.offsetWidth;
    const visibleLeft = this.scroll.scrollLeft;
    if (left < visibleLeft || right > visibleLeft + this.scroll.clientWidth) {
      this.scroll.scrollLeft = left - (this.scroll.clientWidth - button.offsetWidth) / 2;
    }
  }

  destroy(): void {
    this.events.abort();
    this.observer.disconnect();
  }

  private buttonForTarget(target: EventTarget | null): HTMLButtonElement | null {
    if (!(target instanceof Element)) return null;
    const button = target.closest('button');
    return button instanceof HTMLButtonElement && this.buttons.has(button) ? button : null;
  }
}
