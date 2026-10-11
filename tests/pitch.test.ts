import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PitchDetector } from 'pitchy';
import { centsBetween, pitchDirection, median, PitchFilter } from '../src/pitch';

void test('cents preserve octave differences and direction includes tolerance boundaries', () => {
  assert.equal(centsBetween(220, 220), 0);
  assert.equal(centsBetween(440, 220), 1200);
  assert.equal(centsBetween(110, 220), -1200);
  assert.equal(pitchDirection(-10.01), 'low');
  assert.equal(pitchDirection(-10), 'tune');
  assert.equal(pitchDirection(10), 'tune');
  assert.equal(pitchDirection(10.01), 'high');
  assert.equal(pitchDirection(8, 5), 'high');
});
void test('median rejects isolated outliers', () => {
  assert.equal(median([4, 2, 1000, 3, 1]), 3);
  assert.equal(median([2, 4]), 3);
  const filter = new PitchFilter();
  for (let i = 0; i < 5; i++) filter.measure(220, 1, i * 40, 220);
  assert.equal(filter.measure(440, 1, 200, 220).cents, 0);
});
void test('invalid frames hold feedback until timeout, then clear and restart without stale history', () => {
  const filter = new PitchFilter();
  filter.measure(220, 1, 0, 220);
  for (const [hz, clarity] of [
    [0, 1],
    [NaN, 1],
    [Infinity, 1],
    [220, 0.89],
    [220, NaN],
  ]) {
    const m = filter.measure(hz!, clarity!, 499, 220);
    assert.equal(m.accepted, false);
    assert.equal(m.filteredHz, 220);
  }
  assert.equal(filter.measure(0, 0, 500, 220).filteredHz, null);
  assert.equal(filter.measure(440, 1, 540, 220).cents, 1200);
});
void test('smoothing uses elapsed time in logarithmic pitch', () => {
  const filter = new PitchFilter({
    bufferSize: 4096,
    intervalMs: 40,
    minimumClarity: 0.9,
    medianSamples: 1,
    smoothingMs: 150,
    toleranceCents: 5,
    noSignalMs: 500,
    minimumHz: 40,
    maximumHz: 2000,
  });
  filter.measure(220, 1, 0, 220);
  const m = filter.measure(440, 1, 150, 220);
  assert.ok(Math.abs(m.cents! - 1200 * (1 - Math.exp(-1))) < 0.001);
});
void test('Pitchy detects sustained C2 at common mobile sample rates', () => {
  for (const rate of [44100, 48000]) {
    const input = Float32Array.from(
      { length: 4096 },
      (_, i) => 0.3 * Math.sin((2 * Math.PI * 65.406 * i) / rate),
    );
    const [hz, clarity] = PitchDetector.forFloat32Array(input.length).findPitch(input, rate);
    assert.ok(Math.abs(centsBetween(hz, 65.406)) < 1);
    assert.ok(clarity >= 0.9);
  }
});
