import type { BoardSettings } from '../model';
import { MAX_STRING_OFFSET } from '../music';

/** Shared pixel geometry. The CSS receives these values as custom properties. */
export const NOTE_RADIUS = 22;
export const NOTE_DIAMETER = NOTE_RADIUS * 2;
export const NOTE_CLEARANCE = 4;
export const ROW_HEIGHT = 50;
const BOARD_TOP_PADDING = 54;
const BOARD_BOTTOM_PADDING = 26;
const OPEN_STRING_NUT_GAP = 48;
const FIRST_NOTE_NUT_GAP = 32;
const EQUIDISTANT_NOTE_GAP = 14;
const SEMITONES_PER_OCTAVE = 12;

const OPEN_STRING_Y = BOARD_TOP_PADDING + NOTE_RADIUS;
export const NUT_Y = OPEN_STRING_Y + NOTE_RADIUS + OPEN_STRING_NUT_GAP;
const FIRST_NOTE_Y = NUT_Y + NOTE_RADIUS + FIRST_NOTE_NUT_GAP;
const EQUIDISTANT_ROW_STEP = NOTE_DIAMETER + EQUIDISTANT_NOTE_GAP;
const LAST_NOTE_Y = FIRST_NOTE_Y + (MAX_STRING_OFFSET - 1) * EQUIDISTANT_ROW_STEP;
const STRING_LENGTH =
  (LAST_NOTE_Y - NUT_Y) / (1 - 2 ** (-MAX_STRING_OFFSET / SEMITONES_PER_OCTAVE));

export function rowY(offset: number, settings: BoardSettings): number {
  // Open strings are labels above the nut, not stopped positions on the string.
  if (offset === 0) return OPEN_STRING_Y;
  if (offset > 0 && settings.toScale) {
    // A semitone shortens the vibrating string by 2^(-1/12).
    // At 100%, the two-octave range ends at the same height as the linear board.
    return NUT_Y + STRING_LENGTH * settings.spread * (1 - 2 ** (-offset / SEMITONES_PER_OCTAVE));
  }
  return FIRST_NOTE_Y + (offset - 1) * EQUIDISTANT_ROW_STEP;
}

export function boardHeight(settings: BoardSettings): number {
  return rowY(MAX_STRING_OFFSET, settings) + NOTE_RADIUS + BOARD_BOTTOM_PADDING;
}

/** Nearest row determines whether circles would collide on the same string/lane. */
export function rowGap(offset: number, settings: BoardSettings): number {
  const y = rowY(offset, settings);
  return Math.min(
    offset > 0 ? y - rowY(offset - 1, settings) : Infinity,
    offset < MAX_STRING_OFFSET ? rowY(offset + 1, settings) - y : Infinity,
  );
}
