import { test, expect } from '@playwright/test';

test('microphone is gesture gated, target reused, and all tracks stop', async ({ page }) => {
  await page.addInitScript(() => {
    const stats = { requests: 0, stopped: 0, closed: 0, constraints: null as unknown };
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
              input[i] = 0.3 * Math.sin((2 * Math.PI * 65.406 * i) / 48000);
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
  expect((await stats()).constraints).toEqual({
    audio: {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  await page.getByRole('button', { name: 'Stop Listening' }).click();
  expect((await stats()).stopped).toBe(1);
  expect((await stats()).closed).toBe(1);
  await expect(page.locator('.pitch-marker')).toBeHidden();
  await page.getByRole('button', { name: 'Start Listening' }).click();
  await expect(page.locator('.pitch-status')).toHaveText('In tune · Stimmt');
  await toggle.click();
  await expect(page.locator('#intonation')).toBeHidden();
  expect((await stats()).stopped).toBe(2);
  expect((await stats()).closed).toBe(2);
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Start Listening' })).toBeVisible();
});
