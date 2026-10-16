import { quarterBeats, type NoteDuration } from './rhythm';
import type { Measure, SequenceNote } from './sequence';

export interface NotationPart {
  readonly sourceIndex: number;
  readonly duration: NoteDuration;
  readonly barAfter: boolean;
  readonly tieNext: boolean;
}

/** Derive engraving only; changing meter never changes the sounding sequence. */
export function sequenceNotation(notes: readonly SequenceNote[], measure: Measure): NotationPart[] {
  if (measure.numerator === 0)
    return notes.map((note, sourceIndex) => ({
      sourceIndex,
      duration: note.duration,
      barAfter: false,
      tieNext: false,
    }));
  const parts: NotationPart[] = [];
  const capacity =
    measure.numerator === 0 ? Infinity : (measure.numerator * 32) / measure.denominator;
  let position = 0;
  notes.forEach((note, sourceIndex) => {
    let remaining = quarterBeats(note.duration) * 8;
    while (remaining > 0) {
      const available = Math.min(remaining, capacity - position);
      const candidates: NoteDuration[] = [1, 2, 4, 8, 16, 32].flatMap((value) =>
        [true, false].map((dotted) => ({ value: value as NoteDuration['value'], dotted })),
      );
      const duration = candidates.find((candidate) => quarterBeats(candidate) * 8 <= available);
      if (!duration) throw new RangeError('Duration cannot be engraved');
      const ticks = quarterBeats(duration) * 8;
      remaining -= ticks;
      position += ticks;
      const barAfter = position === capacity;
      parts.push({
        sourceIndex,
        duration,
        barAfter,
        tieNext: remaining > 0 && note.pitch !== null,
      });
      if (barAfter) position = 0;
    }
  });
  return parts;
}
