import { test, expect } from '@playwright/test';

test('share links load and paste imports validate, replace, and undo', async ({ page }) => {
  await page.goto('/#tonfolge=celloh:v1,C3/4,D3/8.');
  const sequence = page.locator('#pitch-sequence');
  const notes = sequence.locator('.staff-note');
  await expect(sequence).toBeVisible();
  await expect(notes).toHaveCount(2);
  await expect(
    sequence.getByRole('button', { name: 'Tonfolge abspielen', exact: true }),
  ).toBeVisible();
  await sequence.getByRole('button', { name: 'Weitere Tonfolge-Aktionen' }).click();
  await sequence.getByRole('button', { name: 'Importieren …', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Tonfolge importieren' });
  const input = dialog.getByRole('textbox');
  await input.fill('bad');
  await dialog.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(dialog).toContainText('Ungültiges Tonfolge-Format.');
  await expect(notes).toHaveCount(2);
  await input.fill('celloh:v1 Fis3/2');
  await dialog.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(notes).toHaveCount(1);
  await sequence.getByRole('button', { name: 'Tonfolge bearbeiten', exact: true }).click();
  await sequence.getByRole('button', { name: 'Rückgängig', exact: true }).click();
  await expect(notes).toHaveCount(2);
  await page.evaluate(() => {
    location.hash = 'tonfolge=celloh:v1,G3/4';
  });
  await expect(dialog).toBeVisible();
  await expect(input).toHaveValue('celloh:v1,G3/4');
  await expect(notes).toHaveCount(2);
});

test('menu copies readable text and links, with a manual clipboard fallback', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/#tonfolge=celloh:v1,C3/4,Fis3/8.');
  const sequence = page.locator('#pitch-sequence');
  await expect(sequence.locator('.sequence-menu .material-icon')).toHaveCount(4);
  for (const label of ['Text kopieren', 'Link kopieren']) {
    await sequence.getByRole('button', { name: 'Weitere Tonfolge-Aktionen' }).click();
    await sequence.getByRole('button', { name: label, exact: true }).click();
    await expect(sequence.locator('.sequence-transfer-feedback')).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    if (label === 'Text kopieren') expect(copied).toBe('celloh:v1 C3/4 Fis3/8.');
    else expect(copied).toContain('#tonfolge=celloh:v1,C3/4,Fis3/8.');
  }
  await expect(sequence.locator('.sequence-transfer-feedback')).toBeHidden();
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      value: () => Promise.reject(new Error('denied')),
    });
  });
  await sequence.getByRole('button', { name: 'Weitere Tonfolge-Aktionen' }).click();
  await sequence.getByRole('button', { name: 'Text kopieren', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Text kopieren' }).getByRole('textbox'),
  ).toHaveValue('celloh:v1 C3/4 Fis3/8.');
});
