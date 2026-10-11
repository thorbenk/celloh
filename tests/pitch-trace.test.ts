import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PitchTrace } from '../src/view/pitch-trace';

void test('trace scrolls by elapsed time, centers zero, and expires after one second', () => {
  const trace = new PitchTrace();
  trace.add(0, 0);
  trace.add(40, 25);
  assert.equal(trace.path(40), 'M69.68 22.00L72.00 12.00');
  assert.equal(trace.path(1040), 'M14.00 12.00');
  assert.equal(trace.path(1041), '');
});
void test('rejected frames and delayed frames break the line; flat pitches plot below zero', () => {
  const trace = new PitchTrace();
  trace.add(0, 0);
  trace.add(40, null);
  trace.add(80, -25);
  trace.add(240, 50);
  assert.equal(trace.path(240), 'M58.08 22.00M62.72 32.00M72.00 2.00');
  trace.clear();
  assert.equal(trace.path(240), '');
});
void test('large pitch errors stay within the plot scale', () => {
  const trace = new PitchTrace();
  trace.add(0, -1200);
  trace.add(40, 1200);
  assert.equal(trace.path(40), 'M69.68 42.00L72.00 2.00');
});
