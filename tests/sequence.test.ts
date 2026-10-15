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

void test('viewing selection does not record, and instrument input selects the new note', () => {
  const sequence = new SequenceModel();
  for (const pitch of [48, 50, 52]) sequence.input(midiPitch(pitch));
  sequence.dispatch({ type: 'select', index: 1 });
  assert.equal(sequence.selectedNote?.pitch, 50);
  assert.equal(sequence.editor.mode, 'capture');
  sequence.input(midiPitch(55));
  assert.equal(sequence.selectedIndex, 3);
  assert.deepEqual(
    sequence.notes.map((note) => note.pitch),
    [48, 50, 52, 55],
  );
});

void test('editing repeatedly replaces the selected note and changes its duration', () => {
  const sequence = new SequenceModel();
  for (const pitch of [48, 50, 52]) sequence.input(midiPitch(pitch));
  sequence.dispatch({ type: 'select', index: 1 });
  sequence.dispatch({ type: 'edit' });
  sequence.input(midiPitch(55));
  sequence.input(midiPitch(57));
  sequence.dispatch({ type: 'duration', value: 16 });
  sequence.dispatch({ type: 'dot' });
  assert.deepEqual(sequence.selectedNote, { pitch: 57, duration: { value: 16, dotted: true } });
  assert.equal(sequence.notes.length, 3);
  sequence.dispatch({ type: 'select', index: 0 });
  sequence.input(midiPitch(59));
  assert.equal(sequence.notes[0]?.pitch, 59);
  sequence.dispatch({ type: 'undo' });
  assert.equal(sequence.selectedNote?.pitch, 48);
  assert.equal(sequence.editor.mode, 'replace');
  sequence.dispatch({ type: 'done' });
  assert.equal(sequence.selectedIndex, 0);
  sequence.input(midiPitch(60));
  assert.equal(sequence.selectedIndex, 3);
  assert.equal(sequence.notes.at(-1)?.pitch, 60);
});

void test('insertion begins after selection, moves to gaps and advances with each note', () => {
  const sequence = new SequenceModel();
  for (const pitch of [48, 50, 52]) sequence.input(midiPitch(pitch));
  sequence.dispatch({ type: 'edit' });
  sequence.dispatch({ type: 'select', index: 1 });
  sequence.dispatch({ type: 'insert' });
  assert.equal(sequence.editor.mode === 'insert' && sequence.editor.position, 2);
  sequence.dispatch({ type: 'duration', value: 8 });
  sequence.input(midiPitch(55));
  sequence.input(midiPitch(57));
  assert.deepEqual(
    sequence.notes.map((note) => note.pitch),
    [48, 50, 55, 57, 52],
  );
  sequence.dispatch({ type: 'undo' });
  assert.equal(sequence.editor.mode === 'insert' && sequence.editor.position, 3);
  sequence.dispatch({ type: 'position', position: 0 });
  sequence.input(midiPitch(43));
  assert.equal(sequence.notes[0]?.pitch, 43);
  sequence.dispatch({ type: 'select', index: 4 });
  assert.equal(sequence.editor.mode === 'insert' && sequence.editor.position, 5);
  sequence.dispatch({ type: 'move', delta: 1 });
  sequence.input(midiPitch(60));
  assert.equal(sequence.notes.at(-1)?.pitch, 60);
  assert.deepEqual(sequence.notes.at(-1)?.duration, { value: 8, dotted: false });
  sequence.dispatch({ type: 'replace' });
  sequence.input(midiPitch(62));
  assert.equal(sequence.notes.at(-1)?.pitch, 62);
});

void test('deletion and clearing recover selection with undo, including empty editing', () => {
  const sequence = new SequenceModel();
  sequence.dispatch({ type: 'edit' });
  sequence.input(midiPitch(48));
  assert.equal(sequence.notes.length, 0);
  sequence.dispatch({ type: 'insert' });
  sequence.input(midiPitch(48));
  sequence.input(midiPitch(50));
  sequence.dispatch({ type: 'replace' });
  sequence.dispatch({ type: 'delete' });
  assert.equal(sequence.selectedNote?.pitch, 48);
  sequence.dispatch({ type: 'delete' });
  assert.equal(sequence.selectedIndex, null);
  sequence.dispatch({ type: 'undo' });
  assert.equal(sequence.selectedNote?.pitch, 48);
  sequence.dispatch({ type: 'clear' });
  sequence.dispatch({ type: 'undo' });
  assert.equal(sequence.selectedNote?.pitch, 48);
  sequence.dispatch({ type: 'done' });
  sequence.dispatch({ type: 'clear' });
  assert.equal(sequence.selectedIndex, null);
});

void test('jump controls target boundaries and done preserves the insertion location', () => {
  const sequence = new SequenceModel();
  for (const pitch of [48, 50, 52]) sequence.input(midiPitch(pitch));
  sequence.dispatch({ type: 'jump', edge: 'beginning' });
  assert.equal(sequence.selectedIndex, 0);
  sequence.dispatch({ type: 'jump', edge: 'end' });
  assert.equal(sequence.selectedIndex, 2);
  sequence.dispatch({ type: 'edit' });
  sequence.dispatch({ type: 'insert' });
  sequence.dispatch({ type: 'jump', edge: 'beginning' });
  sequence.dispatch({ type: 'done' });
  assert.equal(sequence.selectedIndex, 0);
});

void test('stopping unselects without changing notes, edit mode, or undo history', () => {
  const sequence = new SequenceModel();
  for (const pitch of [48, 50]) sequence.input(midiPitch(pitch));
  const notes = sequence.notes;
  sequence.dispatch({ type: 'unselect' });
  assert.equal(sequence.selectedIndex, null);
  assert.equal(sequence.notes, notes);
  sequence.dispatch({ type: 'edit' });
  sequence.dispatch({ type: 'unselect' });
  assert.equal(sequence.editor.mode, 'replace');
  assert.equal(sequence.selectedIndex, null);
  sequence.dispatch({ type: 'undo' });
  assert.equal(sequence.notes.length, 1);
});
