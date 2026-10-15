import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportSequence, parseSequence, sequenceLink } from '../src/sequence-format';
import { SequenceModel } from '../src/sequence';

void test('versioned text and readable links round-trip every playable pitch and duration', () => {
  const text = 'celloh:v1 C2/1 Cis3/2 D3/4. Es3/8 H3/16 A5/4';
  const parsed = parseSequence(text);
  assert.ok(parsed.ok);
  assert.deepEqual(parseSequence(exportSequence(parsed.notes)), parsed);
  const link = sequenceLink(parsed.notes, 'https://example.com/cello/?x=1#old');
  assert.ok(link.includes('#tonfolge=celloh:v1,C2/1'));
  assert.deepEqual(parseSequence(link), parsed);
  assert.deepEqual(parseSequence('celloh:v1'), { ok: true, notes: [] });
});

void test('bare input accepts whitespace, commas, flats and independent quarter defaults', () => {
  const parsed = parseSequence('Ges3/8, H3\nB3 C4');
  assert.ok(parsed.ok);
  assert.deepEqual(
    parsed.notes.map((note) => note.pitch),
    [54, 59, 58, 60],
  );
  assert.deepEqual(
    parsed.notes.map((note) => note.duration.value),
    [8, 4, 4, 4],
  );
  assert.deepEqual(
    parseSequence('https://example.com/#tonfolge=celloh%3Av1%20C3'),
    parseSequence('C3'),
  );
});

void test('invalid input and unknown versions fail as a whole', () => {
  for (const text of [
    '',
    'C3 bad',
    'C1',
    'B5',
    'C3/3',
    'C3.',
    'Cis',
    'C3/4..',
    'celloh:v1 C3 garbage',
    'https://example.com/#tonfolge=%ZZ',
  ]) {
    assert.deepEqual(parseSequence(text), { ok: false, error: 'invalid' }, text);
  }
  assert.deepEqual(parseSequence('celloh:v2 C3'), { ok: false, error: 'unsupported-version' });
});

void test('import replaces atomically and can be undone', () => {
  const model = new SequenceModel();
  const first = parseSequence('C3 D3');
  const second = parseSequence('E3/8.');
  assert.ok(first.ok && second.ok);
  model.dispatch({ type: 'import', notes: first.notes });
  model.dispatch({ type: 'import', notes: second.notes });
  assert.deepEqual(model.notes, second.notes);
  model.dispatch({ type: 'undo' });
  assert.deepEqual(model.notes, first.notes);
});
