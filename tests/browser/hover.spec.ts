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

test('dimmed notes keep opaque fills and readable labels over the strings', async ({ page }) => {
  await page.goto('/');
  await page.locator('.open-row .note').first().click();
  const note = page.locator('.note[data-string="0"][data-offset="2"]');
  const paint = await note.evaluate((element) => {
    const css = getComputedStyle(element);
    const context = document.createElement('canvas').getContext('2d')!;
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    };
    const foreground = rgba(css.color);
    const background = rgba(css.backgroundColor);
    const luminance = (rgb: number[]) =>
      rgb.slice(0, 3).reduce((sum, channel, index) => {
        const value = channel / 255;
        const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        return sum + linear * [0.2126, 0.7152, 0.0722][index]!;
      }, 0);
    const levels = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
    return {
      opacity: css.opacity,
      backgroundAlpha: background[3],
      textAlpha: foreground[3],
      contrast: (levels[1]! + 0.05) / (levels[0]! + 0.05),
    };
  });
  expect(paint.opacity).toBe('1');
  expect(paint.backgroundAlpha).toBe(255);
  expect(paint.textAlpha).toBe(255);
  expect(paint.contrast).toBeGreaterThanOrEqual(4.5);
  await expect(note).toBeEnabled();
});
