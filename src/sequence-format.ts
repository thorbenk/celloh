import { isPlayablePitch, midiPitch } from './music';
import { NOTE_VALUES, type NoteValue } from './rhythm';
import { DEFAULT_MEASURE, isMeasure, type Measure, type SequenceNote } from './sequence';

export const SEQUENCE_PREFIX = 'celloh:v2';
export type SequenceParseResult =
  | { readonly ok: true; readonly notes: readonly SequenceNote[]; readonly measure: Measure }
  | { readonly ok: false; readonly error: 'invalid' | 'unsupported-version' };

const PITCHES: Readonly<Record<string, number>> = {
  C: 0,
  Cis: 1,
  Des: 1,
  D: 2,
  Dis: 3,
  Es: 3,
  E: 4,
  Fes: 4,
  Eis: 5,
  F: 5,
  Fis: 6,
  Ges: 6,
  G: 7,
  Gis: 8,
  As: 8,
  A: 9,
  Ais: 10,
  B: 10,
  H: 11,
  Ces: -1,
  His: 12,
};
const NAMES = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'B', 'H'] as const;

export function exportSequence(
  notes: readonly SequenceNote[],
  measure: Measure = DEFAULT_MEASURE,
): string {
  return [
    SEQUENCE_PREFIX,
    `measure=${measure.numerator}/${measure.denominator}`,
    ...notes.map(
      ({ pitch, duration }) =>
        `${pitch === null ? 'R' : `${NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`}/${duration.value}${duration.dotted ? '.' : ''}`,
    ),
  ].join(' ');
}

export function sequenceLink(
  notes: readonly SequenceNote[],
  base: string,
  measure: Measure = DEFAULT_MEASURE,
): string {
  const url = new URL(base);
  url.hash = `tonfolge=${exportSequence(notes, measure).replaceAll(' ', ',')}`;
  return url.href;
}

/** Extract only our fragment payload; malformed escapes remain a simple invalid import. */
export function sequenceFromLink(input: string): string | null {
  try {
    const hash = new URL(input).hash;
    return hash.startsWith('#tonfolge=') ? decodeURIComponent(hash.slice(10)) : null;
  } catch {
    return null;
  }
}

export function parseSequence(input: string): SequenceParseResult {
  const invalid: SequenceParseResult = { ok: false, error: 'invalid' };
  const text = (sequenceFromLink(input.trim()) ?? input).trim();
  const tokens = text.split(/[\s,]+/);
  let version = 'celloh:v1';
  if (tokens[0]?.startsWith('celloh:')) {
    if (!/^celloh:v\d+$/.test(tokens[0])) return invalid;
    version = tokens.shift() ?? 'celloh:v1';
    if (version !== SEQUENCE_PREFIX && version !== 'celloh:v1')
      return { ok: false, error: 'unsupported-version' };
  } else if (!text) return invalid;
  let measure = DEFAULT_MEASURE;
  if (version === SEQUENCE_PREFIX) {
    const match = /^measure=(\d+)\/(\d+)$/.exec(tokens.shift() ?? '');
    if (!match) return invalid;
    measure = { numerator: Number(match[1]), denominator: Number(match[2]) };
    if (!isMeasure(measure)) return invalid;
  }
  const notes: SequenceNote[] = [];
  for (const token of tokens) {
    const rest = /^R\/(1|2|4|8|16)(\.)?$/.exec(token);
    if (rest) {
      notes.push({
        pitch: null,
        duration: { value: Number(rest[1]) as NoteValue, dotted: rest[2] === '.' },
      });
      continue;
    }
    const match = /^([A-H](?:is|es)?|Es|As)(\d)(?:\/(1|2|4|8|16)(\.)?)?$/.exec(token);
    if (!match || !match[1]) return invalid;
    const offset = PITCHES[match[1]];
    const pitch = (Number(match[2]) + 1) * 12 + (offset ?? NaN);
    const value = Number(match[3] ?? 4);
    if (!isPlayablePitch(pitch) || !isNoteValue(value)) return invalid;
    notes.push({ pitch: midiPitch(pitch), duration: { value, dotted: match[4] === '.' } });
  }
  return version === 'celloh:v1' ? migrateV1({ notes }) : { ok: true, notes, measure };
}

function isNoteValue(value: number): value is NoteValue {
  return NOTE_VALUES.some((candidate) => candidate === value);
}

/** Explicit upgrade for legacy versioned and bare note sequences. */
export function migrateV1(sequence: {
  readonly notes: readonly SequenceNote[];
}): SequenceParseResult {
  return { ok: true, notes: sequence.notes, measure: { ...DEFAULT_MEASURE } };
}
