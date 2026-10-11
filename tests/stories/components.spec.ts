import { expect, test } from '@playwright/test';

test('fingerboard fills its own container without the app shell or notation picker', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=components-existing-views--exact-pitch&viewMode=story');
  await expect(page.locator('.note')).toHaveCount(100);
  await expect(page.locator('.note.selected')).toHaveCount(3);
  await expect(page.locator('.header, .footer, #staff, #compact-staff')).toHaveCount(0);
  expect((await page.locator('.board-scroll').boundingBox())?.height).toBe(480);
  await page.locator('.board-scroll').evaluate((board) => {
    board.scrollTop = 700;
    board.scrollLeft = 100;
  });
  expect(await page.locator('.board-scroll').evaluate((board) => board.scrollTop)).toBe(700);
});

test('notation preview mounts independently and can expand without changing staff scale', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=components-existing-views--notation-preview&viewMode=story');
  await expect(page.locator('#compact-staff .staff-note')).toHaveAttribute('data-midi', '36');
  await expect(page.locator('#staff, .fingerboard')).toHaveCount(0);
  const scale = () =>
    page.locator('#compact-staff').evaluate((svg) => (svg as SVGSVGElement).getScreenCTM()?.a);
  const initialScale = await scale();
  await page.locator('#notation-size-toggle').click();
  expect((await page.locator('#notation-display').boundingBox())?.height).toBe(220);
  expect(await scale()).toBe(initialScale);
});

test('short portrait workspace allocates remaining height with a key-signature row', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/iframe.html?id=layout-workspace--with-key-signature&viewMode=story');
  await expect(page.locator('#active-key')).toBeVisible();
  await expect(page.locator('.note')).toHaveCount(100);
  expect((await page.locator('.board-scroll').boundingBox())?.height).toBe(326);
  expect((await page.locator('#app').boundingBox())?.height).toBe(500);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
