import { test, expect } from '@playwright/test';

test('hover highlights open and stopped notes without moving or resizing their borders', async ({
  page,
}) => {
  await page.goto('/');
  for (const fit of ['normal', 'width']) {
    if (fit === 'width') {
      await page.locator('#settings-open').click();
      await page.locator('#zoom-width').click();
    }
    for (const offset of [0, 2]) {
      const note = page.locator(`.note[data-string="0"][data-offset="${offset}"]`);
      await page.mouse.move(0, 0);
      const before = (await note.boundingBox())!;
      const shadow = await note.evaluate((element) => getComputedStyle(element).boxShadow);
      await note.hover();
      const frames = await note.evaluate(async (element) => {
        const frames = [];
        for (let i = 0; i < 15; i++) {
          await new Promise(requestAnimationFrame);
          const { x, y, width, height } = element.getBoundingClientRect();
          frames.push({ x, y, width, height });
        }
        return frames;
      });
      for (const frame of frames) {
        // Firefox rounds transformed layout coordinates differently from its protocol bounds.
        for (const coordinate of ['x', 'y', 'width', 'height'] as const) {
          expect(Math.abs(frame[coordinate] - before[coordinate])).toBeLessThan(0.05);
        }
      }
      await expect
        .poll(() => note.evaluate((element) => getComputedStyle(element).boxShadow))
        .not.toBe(shadow);
      await expect(note).toBeEnabled();
    }
  }
});
