import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sequenceNotation } from '../src/sequence-notation';
import { SequenceModel } from '../src/sequence';
import { midiPitch } from '../src/music';
import { quarterBeats } from '../src/rhythm';
import { exportSequence, parseSequence } from '../src/sequence-format';

void test('meter changes split engraving without changing sequence or sounding duration', () => {
  const sequence = new SequenceModel();
  sequence.dispatch({
    type: 'import',
    notes: [{ pitch: midiPitch(48), duration: { value: 1, dotted: true } }],
  });
  const original = sequence.notes;
  for (const measure of [
    { numerator: 4, denominator: 4 },
    { numerator: 3, denominator: 4 },
    { numerator: 1, denominator: 32 },
    { numerator: 0, denominator: 0 },
  ]) {
    sequence.dispatch({ type: 'measure', measure });
    assert.equal(sequence.notes, original);
    const parts = sequenceNotation(sequence.notes, measure);
    assert.equal(
      parts.reduce((sum, part) => sum + quarterBeats(part.duration), 0),
      6,
    );
    assert.ok(parts.every((part) => part.sourceIndex === 0));
    assert.ok(parts.slice(0, -1).every((part) => part.tieNext));
    assert.equal(parts.at(-1)?.tieNext, false);
  }
});

void test('spillovers fill the previous measure and continue in the next', () => {
  const parts = sequenceNotation(
    [
      { pitch: midiPitch(48), duration: { value: 2, dotted: true } },
      { pitch: midiPitch(50), duration: { value: 2, dotted: false } },
    ],
    { numerator: 4, denominator: 4 },
  );
  assert.deepEqual(
    parts.map((part) => [
      part.sourceIndex,
      quarterBeats(part.duration),
      part.barAfter,
      part.tieNext,
    ]),
    [
      [0, 3, false, false],
      [1, 1, true, true],
      [1, 1, false, false],
    ],
  );
});

void test('rests insert, undo, round-trip and split without ties', () => {
  const sequence = new SequenceModel();
  sequence.dispatch({ type: 'rest' });
  assert.equal(sequence.notes[0]?.pitch, null);
  sequence.dispatch({ type: 'edit' });
  sequence.dispatch({ type: 'duration', value: 1 });
  const measure = { numerator: 3, denominator: 4 };
  assert.ok(sequenceNotation(sequence.notes, measure).every((part) => !part.tieNext));
  assert.deepEqual(
    parseSequence(exportSequence(sequence.notes, { numerator: 0, denominator: 0 })),
    { ok: true, notes: sequence.notes, measure: { numerator: 0, denominator: 0 } },
  );
  sequence.dispatch({ type: 'undo' });
  sequence.dispatch({ type: 'undo' });
  assert.equal(sequence.notes.length, 0);
});
