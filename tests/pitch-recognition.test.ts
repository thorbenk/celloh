import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frequency, midiPitch } from '../src/music';
import { HeldPitchRecognizer } from '../src/pitch-recognition';

void test('recognizes a sustained exact octave only after the configured hold', () => {
  const r = new HeldPitchRecognizer();
  const hz = frequency(midiPitch(50));
  for (let time = 0; time <= 240; time += 40) assert.equal(r.measure(hz, true, time), null);
  assert.equal(r.measure(hz, true, 280), 50);
  for (let time = 320; time <= 560; time += 40) assert.equal(r.measure(hz * 2, true, time), 50);
  assert.equal(r.measure(hz * 2, true, 600), 62);
});
void test('rejects unstable, ambiguous and unplayable estimates, clearing after silence', () => {
  const r = new HeldPitchRecognizer();
  const hz = frequency(midiPitch(50));
  for (let time = 0; time < 400; time += 40) {
    assert.equal(r.measure(hz * 2 ** ((time % 80 ? 25 : -25) / 1200), true, time), null);
  }
  assert.equal(r.measure(hz * 2 ** (45 / 1200), true, 400), null);
  assert.equal(r.measure(20, true, 440), null);
  for (let time = 480; time <= 760; time += 40) r.measure(hz, true, time);
  assert.equal(r.measure(hz, false, 800), 50);
  assert.equal(r.measure(hz, false, 1260), null);
});
void test('rejected frames interrupt candidate holds and duration can be tuned', () => {
  const r = new HeldPitchRecognizer();
  r.holdMs = 150;
  const hz = frequency(midiPitch(36));
  r.measure(hz, true, 0);
  r.measure(hz, true, 40);
  r.measure(hz, false, 80);
  for (let time = 120; time <= 240; time += 40) assert.equal(r.measure(hz, true, time), null);
  assert.equal(r.measure(hz, true, 280), 36);
  r.reset();
  assert.equal(r.measure(hz, true, 320), null);
});
