import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { soundingDuration } from '../src/articulation';
import { midiPitch } from '../src/music';

void test('connected phrases overlap changing pitches but separate repeated attacks', () => {
  assert.equal(soundingDuration(midiPitch(48), 0.5, { nextPitch: midiPitch(50) }), 0.56);
  assert.equal(soundingDuration(midiPitch(48), 0.5, { nextPitch: midiPitch(48) }), 0.45);
  assert.equal(soundingDuration(midiPitch(48), 0.5, {}), 0.5);
});

void test('articulation scales down for short notes and stays bounded for long notes', () => {
  for (const duration of [0.0625, 0.125, 0.25, 0.5, 1, 3, 9]) {
    const connected = soundingDuration(midiPitch(48), duration, { nextPitch: midiPitch(50) });
    const repeated = soundingDuration(midiPitch(48), duration, { nextPitch: midiPitch(48) });
    const detached = soundingDuration(midiPitch(48), duration, {
      articulation: 'detached',
      nextPitch: midiPitch(50),
    });
    assert.ok(connected > duration && connected <= duration + 0.065);
    assert.ok(repeated > 0 && repeated < duration);
    assert.ok(detached > 0 && detached < repeated);
    assert.equal(
      soundingDuration(midiPitch(48), duration, {
        articulation: 'neutral',
        nextPitch: midiPitch(50),
      }),
      duration,
    );
  }
});
