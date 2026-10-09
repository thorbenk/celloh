import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  midiPitch,
  STRINGS,
  ALL_PITCHES,
  noteName,
  octave,
  frequency,
  fingerOffsets,
  POSITIONS,
  MAJOR_KEYS,
  MINOR_KEYS,
  keyNoteNames,
} from '../src/music';

void test('cello tuning and two-octave range', () => {
  assert.deepEqual(
    STRINGS.map((string) => string.midi),
    [36, 43, 50, 57],
  );
  assert.equal(ALL_PITCHES.length, 46);
  assert.equal(ALL_PITCHES[0], 36);
  assert.equal(ALL_PITCHES.at(-1), 81);
  assert.equal(octave(midiPitch(36)), 2);
  assert.equal(octave(midiPitch(81)), 5);
  assert.equal(frequency(midiPitch(69)), 440);
});
void test('German spelling distinguishes H from B and preserves pitch', () => {
  assert.equal(noteName(midiPitch(59), 'sharp'), 'H');
  assert.equal(noteName(midiPitch(59), 'flat'), 'H');
  assert.equal(noteName(midiPitch(58), 'flat'), 'B');
  assert.equal(noteName(midiPitch(58), 'sharp'), 'Ais');
  assert.deepEqual(
    STRINGS.map((string) => noteName(midiPitch(string.midi + 1), 'sharp')),
    ['Cis', 'Gis', 'Dis', 'Ais'],
  );
  assert.deepEqual(
    STRINGS.map((string) => noteName(midiPitch(string.midi + 1), 'flat')),
    ['Des', 'As', 'Es', 'B'],
  );
  assert.deepEqual(
    STRINGS.map((string) => noteName(midiPitch(string.midi + 2), 'sharp')),
    ['D', 'A', 'E', 'H'],
  );
});
void test('position variants use the correct first finger offsets', () => {
  assert.deepEqual(fingerOffsets(1, false, false), [2, 3, 4, 5]);
  assert.deepEqual(fingerOffsets(2, false, false), [3, 4, 5, 6]);
  assert.deepEqual(fingerOffsets(2, true, false), [4, 5, 6, 7]);
  assert.deepEqual(fingerOffsets(3, false, false), [5, 6, 7, 8]);
  assert.deepEqual(fingerOffsets(3, true, false), [6, 7, 8, 9]);
  assert.deepEqual(fingerOffsets(4, false, false), [7, 8, 9, 10]);
});
void test('key names use the correct major and natural-minor notes, including enharmonic keys', () => {
  const expected: Record<string, string[]> = {
    'Es-Dur': ['Es', 'F', 'G', 'As', 'B', 'C', 'D'],
    'D-Dur': ['D', 'E', 'Fis', 'G', 'A', 'H', 'Cis'],
    'Ges-Dur': ['Ges', 'As', 'B', 'Ces', 'Des', 'Es', 'F'],
    'Cis-Dur': ['Cis', 'Dis', 'Eis', 'Fis', 'Gis', 'Ais', 'His'],
    'c-Moll': ['C', 'D', 'Es', 'F', 'G', 'As', 'B'],
    'a-Moll': ['A', 'H', 'C', 'D', 'E', 'F', 'G'],
    'fis-Moll': ['Fis', 'Gis', 'A', 'H', 'Cis', 'D', 'E'],
    'as-Moll': ['As', 'B', 'Ces', 'Des', 'Es', 'Fes', 'Ges'],
    'ais-Moll': ['Ais', 'His', 'Cis', 'Dis', 'Eis', 'Fis', 'Gis'],
  };
  for (const [name, notes] of Object.entries(expected)) {
    const key = [...MAJOR_KEYS, ...MINOR_KEYS].find((key) => key.name === name)!;
    assert.deepEqual(keyNoteNames(key), notes);
  }
});
void test('backward extensions move only the first finger', () => {
  for (const position of POSITIONS)
    for (const upper of [true, false]) {
      const normal = fingerOffsets(position.id, upper, false);
      const extended = fingerOffsets(position.id, upper, true);
      assert.equal(extended[0], normal[0] - 1);
      assert.deepEqual(extended.slice(1), normal.slice(1));
    }
});
