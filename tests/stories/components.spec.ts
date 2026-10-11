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

test('piano mounts without other views, keeps physical key geometry, and selects both endpoints', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=components-piano-keyboard--black-key-selection&viewMode=story');
  await expect(page.locator('.piano-key')).toHaveCount(46);
  await expect(page.locator('.piano-key.selected')).toHaveAccessibleName('B3, Klaviertaste');
  await expect(page.locator('.fingerboard, #staff, #compact-staff, .header')).toHaveCount(0);
  expect((await page.locator('.piano-dock').boundingBox())?.height).toBe(88);
  const geometry = await page.locator('.piano-key').evaluateAll((keys) =>
    keys.slice(0, 13).map((key) => ({
      black: key.classList.contains('black'),
      left: (key as HTMLElement).offsetLeft,
      width: (key as HTMLElement).offsetWidth,
    })),
  );
  expect(geometry.map((key) => key.black)).toEqual([
    false,
    true,
    false,
    true,
    false,
    false,
    true,
    false,
    true,
    false,
    true,
    false,
    false,
  ]);
  expect(geometry.slice(0, 3).map((key) => [key.left, key.width])).toEqual([
    [0, 36],
    [25, 22],
    [36, 36],
  ]);
  await page.locator('.piano-key.selected').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(page.locator('.piano-key.selected')).toHaveAccessibleName('C2, Klaviertaste');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.locator('.piano-key.selected')).toHaveAccessibleName('A5, Klaviertaste');
});

test('short workspace reserves the dock below the board and above the footer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/iframe.html?id=layout-workspace--short-portrait-with-piano&viewMode=story');
  await expect(page.locator('.piano-key')).toHaveCount(46);
  await expect(page.locator('#active-key')).toBeVisible();
  expect((await page.locator('.board-scroll').boundingBox())?.height).toBe(238);
  expect((await page.locator('#app').boundingBox())?.height).toBe(500);
});
