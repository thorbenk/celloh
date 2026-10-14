import type { BoardSettings } from '../model';
import { MAX_STRING_OFFSET } from '../music';

/** Shared pixel geometry. The CSS receives these values as custom properties. */
export const NOTE_RADIUS = 22;
export const NOTE_DIAMETER = NOTE_RADIUS * 2;
export const NOTE_CLEARANCE = 4;
export const ROW_HEIGHT = 50;
const BOARD_BOTTOM_PADDING = 26;
const EQUIDISTANT_NOTE_GAP = 14;
const SEMITONES_PER_OCTAVE = 12;

// The open-string cap starts flush with the board, with a short square top and round bottom.
const OPEN_STRING_Y = NOTE_RADIUS;
const SCALE_ORIGIN_Y = OPEN_STRING_Y + NOTE_RADIUS;
const EQUIDISTANT_ROW_STEP = NOTE_DIAMETER + EQUIDISTANT_NOTE_GAP;
const FIRST_NOTE_Y = OPEN_STRING_Y + EQUIDISTANT_ROW_STEP;
const LAST_NOTE_Y = FIRST_NOTE_Y + (MAX_STRING_OFFSET - 1) * EQUIDISTANT_ROW_STEP;
const STRING_LENGTH =
  (LAST_NOTE_Y - SCALE_ORIGIN_Y) / (1 - 2 ** (-MAX_STRING_OFFSET / SEMITONES_PER_OCTAVE));

export function rowY(offset: number, settings: BoardSettings): number {
  // Open strings remain fixed headers when stopped-note spacing is proportional.
  if (offset === 0) return OPEN_STRING_Y;
  if (offset > 0 && settings.toScale) {
    // A semitone shortens the vibrating string by 2^(-1/12).
    // At 100%, the two-octave range ends at the same height as the linear board.
    return (
      SCALE_ORIGIN_Y + STRING_LENGTH * settings.spread * (1 - 2 ** (-offset / SEMITONES_PER_OCTAVE))
    );
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
