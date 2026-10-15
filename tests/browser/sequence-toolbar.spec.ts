import { test, expect } from '@playwright/test';

test('compact toolbar pauses, resets, confirms clearing, and clears the piano handle', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Klaviatur', exact: true }).click();
  for (const pitch of [50, 54, 57]) {
    await page.locator(`.piano-key[data-midi="${pitch}"]`).click();
    await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  }
  await page.locator('#sequence-toggle').click();
  const sequence = page.locator('#pitch-sequence');
  const notes = sequence.locator('.staff-note');
  await sequence.getByRole('button', { name: 'Zum Anfang', exact: true }).click();
  await sequence.getByRole('button', { name: 'Tonfolge abspielen', exact: true }).click();
  await sequence.getByRole('button', { name: 'Tonfolge pausieren', exact: true }).click();
  const selected = await notes.evaluateAll((nodes) =>
    nodes.findIndex((n) => n.classList.contains('sequence-selected')),
  );
  expect(selected).toBeGreaterThanOrEqual(0);
  await page.waitForTimeout(650);
  await expect(notes.nth(selected)).toHaveClass(/sequence-selected/);
  await sequence.getByRole('button', { name: 'Tonfolge abspielen', exact: true }).click();
  await expect(notes.nth(selected)).toHaveClass(/sequence-selected/);
  await sequence.getByRole('button', { name: 'Tonfolge stoppen', exact: true }).click();
  await expect(sequence.locator('.sequence-selected')).toHaveCount(0);
  await sequence.getByRole('button', { name: 'Tonfolge abspielen', exact: true }).click();
  await expect(notes.nth(0)).toHaveClass(/sequence-selected/);
  await sequence.getByRole('button', { name: 'Tonfolge stoppen', exact: true }).click();
  await sequence.getByRole('button', { name: 'Tonfolge bearbeiten', exact: true }).click();
  await expect(sequence.locator('.sequence-editor')).toBeVisible();
  await sequence.getByRole('button', { name: 'Bearbeiten beenden', exact: true }).click();
  const toolbar = (await sequence.locator('.sequence-transport').boundingBox())!;
  const handle = (await page.locator('.piano-resize-handle').boundingBox())!;
  expect(handle.y).toBeGreaterThanOrEqual(toolbar.y + toolbar.height);
  expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(320);
  await sequence.getByRole('button', { name: 'Weitere Tonfolge-Aktionen' }).click();
  await sequence.getByRole('button', { name: 'Tonfolge leeren', exact: true }).click();
  await expect(notes).toHaveCount(3);
  await sequence.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(notes).toHaveCount(3);
  await sequence.getByRole('button', { name: 'Weitere Tonfolge-Aktionen' }).click();
  await sequence.getByRole('button', { name: 'Tonfolge leeren', exact: true }).click();
  await sequence.getByRole('button', { name: 'Ja, leeren', exact: true }).click();
  await expect(notes).toHaveCount(0);
});
