/** Shared pixel geometry. The CSS receives these values as custom properties. */
export const BOARD_HEIGHT = 1582;
export const NOTE_RADIUS = 22;
export const ROW_HEIGHT = 50;
export const NUT_Y = 146;
export function rowY(offset: number): number {
  return offset === 0 ? 76 : 200 + (offset - 1) * 58;
}
