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
  for (let i = 0; i < 3; i++) await page.locator('.driver-popover-next-btn').click();
  await page.locator('#piano-toggle').click();
  await expect(page.locator('#piano')).toBeVisible();
  await page.locator('#piano .piano-key').first().click();
  await expect(page.locator('.driver-popover-title')).toHaveText('Töne auf der Klaviatur');
  await page.keyboard.press('Escape');
  await expect(page.locator('#piano')).toBeVisible();
});
