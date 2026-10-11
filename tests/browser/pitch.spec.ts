import { test, expect } from '@playwright/test';

test('microphone is gesture gated, target reused, and all tracks stop', async ({ page }) => {
  await page.addInitScript(() => {
    const stats = { requests: 0, stopped: 0, closed: 0, constraints: null as unknown, hz: 65.406 };
    Object.assign(window, { pitchTestStats: stats });
    class FakeContext {
      sampleRate = 48000;
      resume() {
        return Promise.resolve();
      }
      close() {
        stats.closed++;
        return Promise.resolve();
      }
      createMediaStreamSource() {
        return { connect() {}, disconnect() {} };
      }
      createAnalyser() {
        return {
          fftSize: 4096,
          channelCount: 1,
          channelCountMode: 'explicit',
          disconnect() {},
          getFloatTimeDomainData(input: Float32Array) {
            for (let i = 0; i < input.length; i++)
              input[i] = 0.3 * Math.sin((2 * Math.PI * stats.hz * i) / 48000);
          },
        };
      }
    }
    Object.defineProperty(window, 'AudioContext', { value: FakeContext });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: (constraints: unknown) => {
        stats.requests++;
        stats.constraints = constraints;
        const track = {
          stop() {
            stats.stopped++;
          },
          addEventListener() {},
        };
        return Promise.resolve({ getTracks: () => [track], getAudioTracks: () => [track] });
      },
    });
  });
  await page.goto('/');
  const stats = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            pitchTestStats: {
              requests: number;
              stopped: number;
              closed: number;
              constraints: unknown;
            };
          }
        ).pitchTestStats,
    );
  expect((await stats()).requests).toBe(0);
  const toggle = page.getByRole('button', { name: 'Intonation', exact: true });
  await expect(page.locator('#intonation')).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(page.locator('#intonation')).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect((await stats()).requests).toBe(0);
  await page.locator('.note[data-string="0"][data-offset="0"]').click();
  await expect(page.locator('.pitch-target')).toHaveText('C2 · 65.4 Hz');
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.locator('.pitch-status')).toHaveText('In tune · Stimmt');
  const indicator = page.locator('.board-pitch-feedback:visible');
  await expect(indicator).toHaveCount(1);
  await expect(indicator).toHaveAttribute('data-direction', 'tune');
  const setHz = (hz: number) =>
    page.evaluate((hz) => {
      (window as unknown as { pitchTestStats: { hz: number } }).pitchTestStats.hz = hz;
    }, hz);
  await setHz(65.406 * 2 ** (-12 / 1200));
  await expect(indicator).toHaveAttribute('data-direction', 'low');
  await expect(indicator.locator('.board-pitch-dot')).toBeHidden();
  await expect(indicator.locator('.board-pitch-cents')).toHaveText('−12');
  const smallArrow = (await indicator.locator('.board-pitch-arrow path').boundingBox())!.height;
  const coordinates = await indicator.locator('.board-pitch-arrow path').getAttribute('d');
  const values = coordinates!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  expect(values[2]! - values[1]!).toBeGreaterThanOrEqual(10);
  expect(values[2]! - values[1]!).toBeLessThan(14);
  const nearColor = await indicator.evaluate((element) => getComputedStyle(element).color);
  expect(values[2]).toBeGreaterThan(values[1]!); // Arrow points down toward bridge.
  await setHz(65.406 * 2 ** (-100 / 1200));
  await expect(indicator.locator('.board-pitch-cents')).toHaveText('−100');
  expect(
    (await indicator.locator('.board-pitch-arrow path').boundingBox())!.height,
  ).toBeGreaterThan(smallArrow);
  expect(await indicator.evaluate((element) => getComputedStyle(element).color)).not.toBe(
    nearColor,
  );
  await setHz(65.406 * 2 ** (20 / 1200));
  await expect(indicator).toHaveAttribute('data-direction', 'high');
  await expect(indicator.locator('.board-pitch-cents')).toHaveText('+20');
  const upValues = (await indicator.locator('.board-pitch-arrow path').getAttribute('d'))!
    .match(/-?\d+(?:\.\d+)?/g)!
    .map(Number);
  expect(upValues[2]).toBeLessThan(upValues[1]!); // Arrow points up toward scroll.
  await setHz(0);
  await expect(indicator).toHaveAttribute('data-direction', 'neutral');
  await expect(indicator.locator('.board-pitch-arrow')).toBeHidden();
  await expect(indicator.locator('.board-pitch-cents')).toHaveText('—');
  await expect(indicator.locator('.pitch-trace-line')).toHaveAttribute('d', '');
  await setHz(65.406 * 2 ** (8 / 1200));
  await expect(indicator).toHaveAttribute('data-direction', 'tune');
  await page.mouse.move(5, 5);
  const circle = await page.locator('.note[data-string="0"][data-offset="0"]').boundingBox();
  const feedback = await indicator.boundingBox();
  // Leave room for the note's six-pixel selection outline as well as its circle.
  expect(feedback!.x + feedback!.width).toBeLessThan(circle!.x - 6);
  const dot = (await indicator.locator('.board-pitch-dot').boundingBox())!;
  const zero = (await indicator.locator('.pitch-trace-zero').boundingBox())!;
  expect(zero.y + zero.height / 2 - (circle!.y + circle!.height / 2)).toBeCloseTo(0);
  await expect(indicator.locator('.pitch-trace-line')).not.toHaveAttribute('d', '');
  const trace = (await indicator.locator('.pitch-trace-line').boundingBox())!;
  expect(zero.x + zero.width - (trace.x + trace.width)).toBeGreaterThan(35);
  expect(zero.x + zero.width).toBeLessThan(circle!.x - 6);
  expect(dot.width).toBe(12);
  expect(dot.height).toBe(12);
  expect(dot.y + dot.height / 2 - (circle!.y + circle!.height / 2)).toBeCloseTo(0);
  expect(await indicator.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    'rgba(0, 0, 0, 0)',
  );
  expect((await stats()).constraints).toEqual({
    audio: {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  await setHz(65.406);
  await page.getByRole('button', { name: 'Stop Listening' }).click();
  expect((await stats()).stopped).toBe(1);
  expect((await stats()).closed).toBe(1);
  await expect(page.locator('.pitch-marker')).toBeHidden();
  await expect(indicator).toHaveCount(0);
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.locator('.pitch-status')).toHaveText('In tune · Stimmt');
  await toggle.click();
  await expect(page.locator('#intonation')).toBeHidden();
  expect((await stats()).stopped).toBe(2);
  expect((await stats()).closed).toBe(2);
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Start Listening' })).toBeVisible();
});
