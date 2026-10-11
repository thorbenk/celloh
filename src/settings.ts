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
    try {
      if (!('pianoVisible' in this.values)) {
        const legacy = localStorage.getItem('celloh.piano-visible');
        if (legacy === 'true' || legacy === 'false') this.values.pianoVisible = legacy === 'true';
      }
    } catch {
      /* Use defaults when storage is blocked or malformed. */
    }
  }

  boolean(key: string, fallback: boolean): boolean {
    const value = this.values[key];
    return typeof value === 'boolean' ? value : fallback;
  }

  number(key: string, fallback: number, min: number, max: number): number {
    const value = this.values[key];
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
      ? value
      : fallback;
  }

  choice<T extends string>(key: string, fallback: T, choices: readonly T[]): T {
    const value = this.values[key];
    return typeof value === 'string' && choices.includes(value as T) ? (value as T) : fallback;
  }

  set(key: string, value: boolean | number | string): void {
    this.values[key] = value;
    try {
      localStorage.setItem('celloh.settings', JSON.stringify({ version: 1, values: this.values }));
    } catch {
      /* Retain preferences in memory when storage is unavailable. */
    }
  }
}
