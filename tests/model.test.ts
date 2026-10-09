import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppModel } from '../src/model';
import { MAJOR_KEYS, MINOR_KEYS, midiPitch, type Accidental } from '../src/music';

void test('board selections retain origin; written selections retain their letter through accidental changes', () => {
  const model = new AppModel();
  model.selectBoard({ midi: midiPitch(52), location: { stringId: 2, offset: 2 } });
  const boardSelection = model.selection;
  assert.equal(boardSelection?.source, 'board');
  assert.equal(boardSelection?.note.step, 9); // E3
  for (const accidental of [-1, 0, 1, -1] as const satisfies readonly Accidental[]) {
    assert.equal(model.changeAccidental(accidental), true);
    const staffSelection = model.selection;
    assert.equal(staffSelection?.source, 'staff');
    assert.equal(staffSelection?.note.step, 9);
    assert.equal(model.selectedPitch, 52 + accidental);
    assert.equal(model.board.spelling, 'sharp');
  }
});

void test('hover is transient and keyboard movement resumes from the selected note', () => {
  const model = new AppModel();
  model.selectWritten(7, 0); // C3
  model.preview(14); // C4
  assert.equal(model.displayedNote?.step, 14);
  assert.equal(model.selectedPitch, 48);
  model.clearPreview();
  assert.equal(model.displayedNote?.step, 7);
  assert.equal(model.picker.step, 7);
});

void test('explicit spelling changes respell the selected pitch without changing sound', () => {
  const model = new AppModel();
  model.selectWritten(12, 1); // Ais3
  model.setSpelling('flat');
  assert.equal(model.selectedPitch, 58);
  assert.deepEqual(model.selection?.note, { step: 13, accidental: -1 }); // B3
});

void test('keys own spelling temporarily and restore the manual preference without changing pitch', () => {
  for (const spelling of ['flat', 'sharp'] as const) {
    const model = new AppModel();
    model.selectWritten(12, 1); // Ais3 / B3
    model.setSpelling(spelling);
    for (const name of ['D-Dur', 'c-Moll', 'a-Moll']) {
      const key = [...MAJOR_KEYS, ...MINOR_KEYS].find((key) => key.name === name)!;
      model.setKey(key);
      assert.equal(model.board.spelling, key.spelling);
      model.setSpelling(key.spelling === 'sharp' ? 'flat' : 'sharp');
      assert.equal(model.board.spelling, key.spelling);
      assert.equal(model.selectedPitch, 58);
    }
    model.setKey(null);
    assert.equal(model.board.spelling, spelling);
    assert.equal(model.selectedPitch, 58);
    assert.deepEqual(
      model.selection?.note,
      spelling === 'sharp' ? { step: 12, accidental: 1 } : { step: 13, accidental: -1 },
    );
  }
});

void test('unplayable accidentals cannot create an invalid selection; reset clears all selection state', () => {
  const model = new AppModel();
  assert.equal(model.selectWritten(0, -1), false);
  assert.equal(model.selection, null);
  assert.equal(model.selectWritten(33, 1), false); // Ais5 exceeds the recordings.
  model.selectWritten(10, 1);
  model.preview(12);
  model.clearSelection();
  assert.equal(model.selectedPitch, null);
  assert.equal(model.displayedNote, null);
  assert.equal(model.picker.accidental, 0);
});
