import { test, expect } from '@playwright/test';

for (const width of [1280, 375]) {
  test(`feature tour completes and restarts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const start = async () => {
      await page.locator('#assistance-open').click({ timeout: 5000 });
      await page.locator('#tour-start').click({ timeout: 5000 });
      await expect(page.locator('.driver-popover-title')).toHaveText('Töne entdecken');
    };
    await start();
    await page.locator('.note[data-string="0"][data-offset="0"]').click({ timeout: 5000 });
    await page.locator('.driver-popover-next-btn').click({ timeout: 5000 });
    await expect(page.locator('.driver-active-element')).toHaveAttribute('id', 'settings-open');
    await expect(page.locator('.driver-popover-title')).toHaveText('Einstellungen öffnen');
    await expect(page.locator('#settings')).not.toBeVisible();
    await page.locator('.driver-popover-next-btn').click({ timeout: 5000 });
    await expect(page.locator('#settings')).toBeVisible();
    await expect(page.locator('.driver-popover-title')).toHaveText('Die Lagen kennenlernen');
    await page.locator('.driver-popover-next-btn').click({ timeout: 5000 });
    await expect(page.locator('#notation-panel')).toBeVisible();
    await expect(page.locator('#settings')).not.toBeVisible();
    await page.locator('.driver-popover-prev-btn').click({ timeout: 5000 });
    await expect(page.locator('#settings')).toBeVisible();
    for (let i = 0; i < 4; i++)
      await page.locator('.driver-popover-next-btn').click({ timeout: 5000 });
    await expect(page.locator('.driver-popover-title')).toHaveText('Intonation üben');
    const box = await page.locator('.driver-popover').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(800);
    await page.locator('.driver-popover-next-btn').click({ timeout: 5000 });
    await expect(page.locator('.driver-popover')).toHaveCount(0);
    await expect(page.locator('#assistance-open')).toBeFocused();
    await start();
    await page.locator('.driver-popover-next-btn').click({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.driver-popover')).toHaveCount(0);
    await expect(page.locator('#settings')).not.toBeVisible();
  });
}

test('opening the piano during the tour allows playing without forcing progression', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#assistance-open').click();
  await page.locator('#tour-start').click();
  for (let i = 0; i < 4; i++) await page.locator('.driver-popover-next-btn').click();
  await page.locator('#piano-toggle').click();
  await expect(page.locator('#piano')).toBeVisible();
  await page.locator('#piano .piano-key').first().click();
  await expect(page.locator('.driver-popover-title')).toHaveText('Töne auf der Klaviatur');
  await page.keyboard.press('Escape');
  await expect(page.locator('#piano')).toBeVisible();
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
]) {
  test(`mobile tour keeps every highlighted target clear at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.locator('#assistance-open').click();
    const footerBefore = await page.locator('.footer').boundingBox();
    await page.locator('#tour-start').click();
    const assertClear = async () => {
      await expect
        .poll(
          async () => {
            const bubble = await page.locator('.driver-popover').boundingBox();
            const target = await page.locator('.driver-active-element').boundingBox();
            if (!bubble || !target) return false;
            const overlaps =
              bubble.x < target.x + target.width &&
              bubble.x + bubble.width > target.x &&
              bubble.y < target.y + target.height &&
              bubble.y + bubble.height > target.y;
            const clear =
              !overlaps &&
              target.y >= 0 &&
              target.y + target.height <= viewport.height &&
              bubble.y >= 0 &&
              bubble.y + bubble.height <= viewport.height;
            return clear ? 'clear' : JSON.stringify({ bubble, target });
          },
          {
            message:
              'The tour bubble must stay inside the screen and leave the entire highlighted target visible',
          },
        )
        .toBe('clear');
    };
    for (let index = 0; index < 7; index++) {
      await assertClear();
      expect(await page.locator('.footer').boundingBox()).toEqual(footerBefore);
      if (index >= 4) {
        const bubble = (await page.locator('.driver-popover').boundingBox())!;
        const target = (await page.locator('.driver-active-element').boundingBox())!;
        expect(bubble.y + bubble.height).toBeLessThanOrEqual(target.y);
      }
      if (index === 4 || index === 5) {
        await page.locator(index === 4 ? '#piano-toggle' : '#sequence-toggle').click();
        await assertClear();
        const bubble = (await page.locator('.driver-popover').boundingBox())!;
        const target = (await page.locator('.driver-active-element').boundingBox())!;
        expect(bubble.y + bubble.height).toBeLessThanOrEqual(target.y);
        expect(await page.locator('.footer').boundingBox()).toEqual(footerBefore);
      }
      await page.locator('.driver-popover-next-btn').click();
    }
  });
}
