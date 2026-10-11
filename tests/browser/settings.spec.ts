import { expect, test } from '@playwright/test';

test('preferences survive reload and preserve manual spelling when a key is cleared', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.locator('#flat').click();
  await page.locator('#key').selectOption('G-Dur');
  await page.locator('#extension').check();
  await page.locator('#position-2-upper').check();
  await page.locator('#board-tab').click();
  await page.locator('#to-scale').check();
  await page.locator('#highlight-toggle').uncheck();
  await page.locator('#spread').fill('140');
  await page.locator('#sound-tab').click();
  await page.locator('#volume').fill('35');
  await page.locator('#replay-tempo').fill('80');
  await page.locator('#intonation-tab').click();
  await page.locator('#pitch-hold-ms').fill('450');
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  await page.locator('#intonation-toggle').click();
  await page.locator('.pitch-auto-toggle').check();
  await page.locator('#sequence-toggle').click();
  await page.reload();
  await expect(page.locator('#key')).toHaveValue('G-Dur');
  for (const id of ['extension', 'position-2-upper', 'to-scale']) {
    await expect(page.locator(`#${id}`)).toBeChecked();
  }
  await expect(page.locator('#highlight-toggle')).not.toBeChecked();
  for (const [id, value] of [
    ['spread', '140'],
    ['volume', '35'],
    ['replay-tempo', '80'],
    ['pitch-hold-ms', '450'],
  ] as const) {
    await expect(page.locator(`#${id}`)).toHaveValue(value);
  }
  await expect(page.locator('.pitch-auto-toggle')).toBeChecked();
  await expect(page.locator('#intonation')).toBeVisible();
  await expect(page.locator('#pitch-sequence')).toBeVisible();
  await expect(page.locator('.pitch-mic')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#active-key').click();
  await page.reload();
  await expect(page.locator('#key')).toHaveValue('');
  await expect(page.locator('#flat')).toHaveAttribute('aria-pressed', 'true');
});

test('malformed preferences fall back to defaults and migrate piano visibility', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('celloh.settings', '{broken');
    localStorage.setItem('celloh.piano-visible', 'true');
  });
  await page.goto('/');
  await expect(page.locator('#key')).toHaveValue('');
  await expect(page.locator('#volume')).toHaveValue('65');
  await expect(page.locator('#piano')).toBeVisible();
});

test('blocked storage leaves settings usable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    Storage.prototype.setItem = () => {
      throw new Error('blocked');
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.locator('#flat').click();
  await page.locator('#extension').check();
  await expect(page.locator('#flat')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#extension')).toBeChecked();
});

test('zoom and notation size and position survive reload', async ({ page }) => {
  await page.goto('/');
  await page.locator('#notation-size-toggle').click();
  await page.locator('#notation-display').focus();
  await page.keyboard.press('ArrowRight');
  const left = await page.locator('#notation-display').evaluate((element) => element.style.left);
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.locator('#board-tab').click();
  await page.locator('#zoom-width').click();
  await page.reload();
  await expect(page.locator('#notation-size-toggle')).toHaveAttribute('aria-expanded', 'true');
  expect(await page.locator('#notation-display').evaluate((element) => element.style.left)).toBe(
    left,
  );
  const values = await page.evaluate(
    () =>
      (JSON.parse(localStorage.getItem('celloh.settings')!) as { values: { zoomFit: string } })
        .values,
  );
  expect(values.zoomFit).toBe('width');
  const widths = await page
    .locator('.board-scroll')
    .evaluate((viewport) => [
      viewport.clientWidth,
      document.querySelector('.fingerboard')!.getBoundingClientRect().width,
    ]);
  expect(Math.abs(widths[0]! - widths[1]!)).toBeLessThan(1);
});
