import { test } from 'node:test';
import assert from 'node:assert/strict';
import { midiPitch } from '../src/music';
import { SequenceModel } from '../src/sequence';
import { quarterBeats, type NoteValue } from '../src/rhythm';

void test('all supported note values and dots have exact quarter-beat lengths', () => {
  const cases: readonly [NoteValue, number, number][] = [
    [1, 4, 6],
    [2, 2, 3],
    [4, 1, 1.5],
    [8, 0.5, 0.75],
    [16, 0.25, 0.375],
  ];
  for (const [value, plain, dotted] of cases) {
    assert.equal(quarterBeats({ value, dotted: false }), plain);
    assert.equal(quarterBeats({ value, dotted: true }), dotted);
  }
});

void test('editing auditions without recording; one-shot replacement preserves duration', () => {
  const sequence = new SequenceModel();
  for (const pitch of [48, 50, 52]) sequence.input(midiPitch(pitch));
  sequence.dispatch({ type: 'edit' });
  assert.equal(sequence.selectedIndex, 2);
  sequence.dispatch({ type: 'select', index: 1 });
  sequence.dispatch({ type: 'duration', value: 16 });
  sequence.dispatch({ type: 'dot' });
  sequence.input(midiPitch(67));
  assert.deepEqual(
    sequence.notes.map((note) => note.pitch),
    [48, 50, 52],
  );
  sequence.dispatch({ type: 'replace' });
  sequence.input(midiPitch(55));
  sequence.input(midiPitch(57));
  assert.deepEqual(sequence.notes, [
    { pitch: 48, duration: { value: 4, dotted: false } },
    { pitch: 55, duration: { value: 16, dotted: true } },
    { pitch: 52, duration: { value: 4, dotted: false } },
  ]);
  sequence.dispatch({ type: 'undo' });
  assert.equal(sequence.selectedNote?.pitch, 50);
  sequence.input(midiPitch(59));
  assert.equal(sequence.selectedNote?.pitch, 50, 'undo must not re-arm replacement');
  sequence.dispatch({ type: 'done' });
  sequence.input(midiPitch(60));
  assert.equal(sequence.notes.at(-1)?.pitch, 60);
});

void test('insertion advances before the original note, retains rhythm, and undoes at its location', () => {
  const sequence = new SequenceModel();
  for (const pitch of [48, 50, 52, 53]) sequence.input(midiPitch(pitch));
  sequence.dispatch({ type: 'edit' });
  sequence.dispatch({ type: 'select', index: 2 });
  sequence.dispatch({ type: 'insert' });
  sequence.dispatch({ type: 'duration', value: 1 });
  sequence.dispatch({ type: 'dot' });
  sequence.input(midiPitch(55));
  sequence.input(midiPitch(57));
  assert.deepEqual(
    sequence.notes.map((note) => note.pitch),
    [48, 50, 55, 57, 52, 53],
  );
  assert.deepEqual(
    sequence.notes.slice(2, 4).map((note) => note.duration),
    [
      { value: 1, dotted: true },
      { value: 1, dotted: true },
    ],
  );
  assert.deepEqual(sequence.editor, {
    mode: 'insert',
    position: 4,
    duration: { value: 1, dotted: true },
  });
  sequence.dispatch({ type: 'undo' });
  sequence.input(midiPitch(59));
  assert.deepEqual(
    sequence.notes.map((note) => note.pitch),
    [48, 50, 55, 59, 52, 53],
  );
  sequence.dispatch({ type: 'cancel' });
  assert.equal(sequence.selectedNote?.pitch, 52);
  sequence.input(midiPitch(60));
  assert.equal(sequence.notes.length, 6, 'ending insertion keeps new notes but disarms input');
  sequence.dispatch({ type: 'undo' });
  sequence.input(midiPitch(61));
  assert.deepEqual(
    sequence.notes.map((note) => note.pitch),
    [48, 50, 55, 52, 53],
  );
  assert.equal(sequence.selectedNote?.pitch, 52, 'undo after ending insertion must not re-arm it');
});

void test('deletion selects the following note, then previous at the end, then empty; undo restores it', () => {
  const sequence = new SequenceModel();
  for (const pitch of [48, 50, 52]) sequence.input(midiPitch(pitch));
  sequence.dispatch({ type: 'edit' });
  sequence.dispatch({ type: 'select', index: 1 });
  sequence.dispatch({ type: 'delete' });
  assert.deepEqual(
    sequence.notes.map((note) => note.pitch),
    [48, 52],
  );
  assert.equal(sequence.selectedNote?.pitch, 52);
  sequence.dispatch({ type: 'delete' });
  assert.equal(sequence.selectedNote?.pitch, 48);
  sequence.dispatch({ type: 'delete' });
  assert.deepEqual(sequence.editor, { mode: 'select', index: null });
  assert.deepEqual(sequence.notes, []);
  sequence.dispatch({ type: 'undo' });
  assert.equal(sequence.selectedNote?.pitch, 48);
  sequence.dispatch({ type: 'clear' });
  sequence.dispatch({ type: 'undo' });
  assert.equal(sequence.selectedNote?.pitch, 48);
});

void test('empty sequences can insert and grow at the end, and cancel never rolls back entries', () => {
  const sequence = new SequenceModel();
  sequence.dispatch({ type: 'edit' });
  sequence.dispatch({ type: 'insert' });
  sequence.input(midiPitch(43));
  sequence.input(midiPitch(50));
  sequence.dispatch({ type: 'cancel' });
  assert.deepEqual(
    sequence.notes.map((note) => note.pitch),
    [43, 50],
  );
  assert.equal(sequence.selectedNote?.pitch, 50);
  sequence.dispatch({ type: 'replace' });
  sequence.dispatch({ type: 'cancel' });
  sequence.input(midiPitch(55));
  assert.equal(sequence.selectedNote?.pitch, 50);
});
