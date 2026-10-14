import {
  MAJOR_KEYS,
  MINOR_KEYS,
  type KeyId,
  type NoteNaming,
  type OctaveNotation,
  type Spelling,
} from './music';

export interface Preferences {
  spelling: Spelling;
  key: KeyId | '';
  'note-naming': NoteNaming;
  'octave-notation': OctaveNotation;
  'show-octaves': boolean;
  extension: boolean;
  'to-scale': boolean;
  'highlight-toggle': boolean;
  'position-1': boolean;
  'position-4': boolean;
  'position-2-lower': boolean;
  'position-2-upper': boolean;
  'position-3-lower': boolean;
  'position-3-upper': boolean;
  spread: number;
  volume: number;
  'audio-backend': 'recordings' | 'soundfont';
  'reference-a': number;
  'replay-tempo': number;
  'pitch-hold-ms': number;
  pianoVisible: boolean;
  intonationVisible: boolean;
  sequenceVisible: boolean;
  notationExpanded: boolean;
  notationX: number;
  notationY: number;
  zoomFit: 'manual' | 'all' | 'width';
  zoomScale: number;
}
type KeysOfType<T> = {
  [K in keyof Preferences]: Preferences[K] extends T ? K : never;
}[keyof Preferences];

/** Versioned browser preferences; storage failures leave session controls usable. */
export class SettingsStore {
  private values: Record<string, unknown> = {};

  constructor() {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('celloh.settings') ?? 'null');
      if (
        saved &&
        typeof saved === 'object' &&
        'version' in saved &&
        saved.version === 1 &&
        'values' in saved &&
        saved.values &&
        typeof saved.values === 'object' &&
        !Array.isArray(saved.values)
      ) {
        this.values = saved.values as Record<string, unknown>;
      }
    } catch {
      /* Use defaults when storage is blocked or malformed. */
    }
    const legacyKey = [...MAJOR_KEYS, ...MINOR_KEYS].find((key) => key.name === this.values.key);
    if (legacyKey) this.values.key = legacyKey.id;
    try {
      if (!('pianoVisible' in this.values)) {
        const legacy = localStorage.getItem('celloh.piano-visible');
        if (legacy === 'true' || legacy === 'false') this.values.pianoVisible = legacy === 'true';
      }
    } catch {
      /* Use defaults when storage is blocked or malformed. */
    }
  }

  boolean(key: KeysOfType<boolean>, fallback: boolean): boolean {
    const value = this.values[key];
    return typeof value === 'boolean' ? value : fallback;
  }

  number(key: KeysOfType<number>, fallback: number, min: number, max: number): number {
    const value = this.values[key];
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
      ? value
      : fallback;
  }

  choice<K extends KeysOfType<string>>(
    key: K,
    fallback: Preferences[K],
    choices: readonly Preferences[K][],
  ): Preferences[K] {
    const value = this.values[key];
    return choices.find((choice) => choice === value) ?? fallback;
  }

  set<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    this.values[key] = value;
    try {
      localStorage.setItem('celloh.settings', JSON.stringify({ version: 1, values: this.values }));
    } catch {
      /* Retain preferences in memory when storage is unavailable. */
    }
  }
}
