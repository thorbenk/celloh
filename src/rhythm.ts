/** Denominator of a whole note, not a time in milliseconds or a playback tempo. */
export const NOTE_VALUES = [1, 2, 4, 8, 16] as const;
export type NoteValue = (typeof NOTE_VALUES)[number] | 32;

export interface NoteDuration {
  readonly value: NoteValue;
  readonly dotted: boolean;
}

export const QUARTER_NOTE: NoteDuration = { value: 4, dotted: false };
export const NOTE_VALUE_NAMES: Readonly<Record<NoteValue, string>> = {
  1: 'Ganze',
  2: 'Halbe',
  4: 'Viertel',
  8: 'Achtel',
  16: 'Sechzehntel',
  32: 'Zweiunddreißigstel',
};

/** Tempo is measured in quarter notes per minute. */
export function quarterBeats(duration: NoteDuration): number {
  return (4 / duration.value) * (duration.dotted ? 1.5 : 1);
}

export function durationName(duration: NoteDuration): string {
  return `${NOTE_VALUE_NAMES[duration.value]}${duration.dotted ? ', punktiert' : ''}`;
}
