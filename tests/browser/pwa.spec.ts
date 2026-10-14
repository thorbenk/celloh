import { expect, test } from '@playwright/test';

test('installs an offline app shell and both audio engines', async ({ page, context }) => {
  await page.goto('/');
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const manifest = await page.evaluate(async (href) => {
    const response = await fetch(href!);
    return (await response.json()) as {
      display: string;
      start_url: string;
      icons: { src: string; sizes: string }[];
    };
  }, manifestHref);
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('./');
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512']);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The first installation takes control on the next navigation.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.fingerboard')).toBeVisible();
  const assets = await page.evaluate(async () => {
    const urls = ['audio/36.mp3', 'soundfont/cello_solo.sf2', 'pwa-192x192.png'];
    return Promise.all(
      urls.map(async (url) => {
        const response = await fetch(url);
        return { ok: response.ok, size: (await response.arrayBuffer()).byteLength };
      }),
    );
  });
  for (const asset of assets) {
    expect(asset.ok).toBe(true);
    expect(asset.size).toBeGreaterThan(0);
  }
  await page.locator('.note[data-string="0"][data-offset="0"]').click();
  await expect(page.locator('.note[data-string="0"][data-offset="0"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
