import { test } from 'node:test';
import assert from 'node:assert/strict';
import { midiPitch } from '../src/music';
import { naturalMidi, staffNote, ledgerSteps, staffY, writtenNoteName } from '../src/notation';

void test('bass staff line pitches and middle C', () => {
  assert.deepEqual([4, 6, 8, 10, 12].map(naturalMidi), [43, 47, 50, 53, 57]);
  assert.equal(naturalMidi(0), 36);
  assert.equal(naturalMidi(18), 67);
  assert.equal(staffY(10), 90); // F3, bass-clef dots straddle this line.
  assert.deepEqual(ledgerSteps(14), [14]); // C4
  assert.deepEqual(ledgerSteps(0), [2, 0]); // C2
  assert.deepEqual(ledgerSteps(18), [14, 16, 18]); // G4
  assert.deepEqual(ledgerSteps(13), []); // H3 above the staff
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
    }
});

void test('written German note names retain enharmonic letter and octave', () => {
  assert.equal(writtenNoteName({ step: 9, accidental: 1 }), 'Eis3');
  assert.equal(writtenNoteName({ step: 10, accidental: -1 }), 'Fes3');
  assert.equal(writtenNoteName({ step: 13, accidental: -1 }), 'B3');
  assert.equal(writtenNoteName({ step: 13, accidental: 0 }), 'H3');
  assert.equal(writtenNoteName({ step: 13, accidental: 1 }), 'His3');
});
