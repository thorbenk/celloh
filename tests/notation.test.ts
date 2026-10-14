import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAJOR_KEYS, MINOR_KEYS, midiPitch } from '../src/music';
import {
  naturalMidi,
  staffNote,
  staffY,
  writtenNoteName,
  noteName,
  type StaffNote,
} from '../src/notation';

void test('bass staff line pitches and middle C', () => {
  assert.deepEqual([4, 6, 8, 10, 12].map(naturalMidi), [43, 47, 50, 53, 57]);
  assert.equal(naturalMidi(0), 36);
  assert.equal(naturalMidi(18), 67);
  assert.equal(staffY(10), 90); // F3, bass-clef dots straddle this line.
});
void test('German H and B occupy the same staff step with different accidentals', () => {
  assert.deepEqual(staffNote(midiPitch(59), 'flat'), { step: 13, accidental: 0 });
  assert.deepEqual(staffNote(midiPitch(58), 'flat'), { step: 13, accidental: -1 });
  assert.deepEqual(staffNote(midiPitch(58), 'sharp'), { step: 12, accidental: 1 });
});
void test('every displayed pitch reconstructs correctly in both spellings', () => {
  for (let midi = 36; midi <= 81; midi++)
    for (const spelling of ['sharp', 'flat'] as const) {
      const note = staffNote(midiPitch(midi), spelling);
      assert.equal(naturalMidi(note.step) + note.accidental, midi);
      for (const key of [...MAJOR_KEYS, ...MINOR_KEYS]) {
        const keyed = staffNote(midiPitch(midi), spelling, key);
        assert.equal(naturalMidi(keyed.step) + keyed.accidental, midi, key.name);
      }
    }
});

void test('written German note names retain enharmonic letter and octave', () => {
  assert.equal(writtenNoteName({ step: 9, accidental: 1 }), 'eis');
  assert.equal(writtenNoteName({ step: 10, accidental: -1 }), 'fes');
  assert.equal(writtenNoteName({ step: 13, accidental: -1 }), 'b');
  assert.equal(writtenNoteName({ step: 13, accidental: 0 }), 'h');
  assert.equal(writtenNoteName({ step: 13, accidental: 1 }), 'his');
  const ges = MAJOR_KEYS.find((key) => key.name === 'Ges-Dur')!;
  const cis = MAJOR_KEYS.find((key) => key.name === 'Cis-Dur')!;
  assert.equal(writtenNoteName(staffNote(midiPitch(59), 'flat', ges)), 'ces′');
  assert.equal(writtenNoteName(staffNote(midiPitch(60), 'sharp', cis)), 'his');
});

void test('display styles preserve written octaves and international accidentals', () => {
  const cases: readonly [StaffNote, string, string, string, string][] = [
    [{ step: 0, accidental: 0 }, 'C2', 'C', 'C2', 'C'],
    [{ step: 6, accidental: 0 }, 'H2', 'H', 'B2', 'B'],
    [{ step: 7, accidental: 0 }, 'C3', 'c', 'C3', 'c'],
    [{ step: 10, accidental: 1 }, 'Fis3', 'fis', 'F♯3', 'f♯'],
    [{ step: 13, accidental: -1 }, 'B3', 'b', 'B♭3', 'b♭'],
    [{ step: 13, accidental: 1 }, 'His3', 'his', 'B♯3', 'b♯'],
    [{ step: 14, accidental: -1 }, 'Ces4', 'ces′', 'C♭4', 'c♭′'],
    [{ step: 14, accidental: 0 }, 'C4', 'c′', 'C4', 'c′'],
    [{ step: 21, accidental: 0 }, 'C5', 'c′′', 'C5', 'c′′'],
  ];
  for (const [note, germanNumber, germanPrime, internationalNumber, internationalPrime] of cases) {
    assert.equal(
      writtenNoteName(note, { naming: 'german', octaveNotation: 'scientific' }),
      germanNumber,
    );
    assert.equal(
      writtenNoteName(note, { naming: 'german', octaveNotation: 'helmholtz' }),
      germanPrime,
    );
    assert.equal(
      writtenNoteName(note, { naming: 'international', octaveNotation: 'scientific' }),
      internationalNumber,
    );
    assert.equal(
      writtenNoteName(note, { naming: 'international', octaveNotation: 'helmholtz' }),
      internationalPrime,
    );
  }
  assert.equal(noteName({ step: 24, accidental: 1 }, 'german'), 'Fis');
  assert.equal(noteName({ step: 24, accidental: 1 }, 'international'), 'F♯');
});
