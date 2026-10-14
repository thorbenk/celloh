import { test, expect } from '@playwright/test';

for (const width of [320, 375, 1280]) {
  test(`compact settings remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 667 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('#settings-open')).toHaveText('');
    await expect(page.locator('#assistance-open')).toHaveText('');
    await page.locator('#settings-open').click();
    await expect(page.getByRole('tablist')).toHaveCount(0);
    const panelBounds = (await page.locator('#settings').boundingBox())!;
    const headerBounds = (await page.locator('.header').boundingBox())!;
    expect(panelBounds.y).toBe(headerBounds.y + headerBounds.height);
    expect(headerBounds.height).toBe((await page.locator('.footer').boundingBox())!.height);
    const columns = await page.locator('#settings').evaluate((panel) => {
      const selectors = [
        'label[for="key"]',
        '#spelling-controls > span',
        '#position-options > summary > span:first-child',
        '.zoom-row > span',
      ];
      return selectors.map(
        (selector) => panel.querySelector(selector)?.getBoundingClientRect().left,
      );
    });
    expect(new Set(columns).size).toBe(1);
    const controls = await page
      .locator('#key, #spelling-controls .segmented, .zoom-actions')
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().left));
    expect(new Set(controls).size).toBe(1);
    await expect(page.locator('#spelling-controls')).toBeVisible();
    await page.locator('#key').selectOption({ label: 'G-Dur' });
    await expect(page.locator('#spelling-controls')).not.toBeVisible();
    await expect(page.locator('#position-options')).not.toHaveAttribute('open', '');
    await expect(page.locator('#position-summary')).toHaveText('1 · 2 unten · 3 unten · 4');
    await page.locator('#position-options > summary').click();
    await page.locator('#position-2-upper').check();
    await page.locator('input[data-position="4"]').uncheck();
    await page.locator('#extension').check();
    await page.locator('#position-options > summary').click();
    await expect(page.locator('#position-controls')).not.toBeVisible();
    await expect(page.locator('#position-summary')).toHaveText(
      '1 · 2 unten · 2 oben · 3 unten · Streckung',
    );
    const header = await page.locator('.header').boundingBox();
    const help = await page.locator('#assistance-open').boundingBox();
    expect(help!.x + help!.width).toBeLessThanOrEqual(width);
    expect(header!.height).toBeLessThanOrEqual(78);
    await page.locator('#board-settings > summary').scrollIntoViewIfNeeded();
    const zoom = page.getByRole('group', { name: 'Griffbrett-Zoom' });
    const buttons = await zoom.getByRole('button').all();
    const bounds = await Promise.all(buttons.map((button) => button.boundingBox()));
    expect(new Set(bounds.map((box) => box!.y)).size).toBe(1);
    await buttons[0]!.click();
    await expect(page.locator('#settings')).not.toBeVisible();
    await page.locator('#settings-open').click();
    await expect(page.locator('#board-settings')).toHaveAttribute('open', '');
    await page.locator('#sound-settings > summary').click();
    await expect(page.locator('#articulation')).not.toBeVisible();
    await page.locator('#audio-backend').selectOption('soundfont');
    await expect(page.locator('#articulation')).toBeVisible();
    const dropdownStyles = await page
      .locator('#key, #audio-backend, #articulation')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const css = getComputedStyle(element);
          return [
            css.backgroundColor,
            css.color,
            css.border,
            css.borderRadius,
            css.padding,
            css.minHeight,
            css.fontSize,
          ];
        }),
      );
    expect(dropdownStyles[1]).toEqual(dropdownStyles[0]);
    expect(dropdownStyles[2]).toEqual(dropdownStyles[0]);
    for (const selector of ['#audio-backend', '#articulation']) {
      const bounds = await page.locator(selector).boundingBox();
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    }
    await expect(page.locator('#articulation-help')).not.toBeVisible();
    await page.getByLabel('Hinweise zu Artikulation', { exact: true }).click();
    await expect(page.locator('#articulation-help')).toBeVisible();
    await page.getByLabel('Hinweise zu Artikulation', { exact: true }).click();
    await expect(page.locator('#articulation-help')).not.toBeVisible();
    await expect(page.locator('#music-settings')).toHaveAttribute('open', '');
    await page.locator('#settings-close').click();
    await page.locator('#sequence-toggle').click();
    await page.locator('#sequence-options > summary').click();
    await page.locator('#replay-tempo').fill('90');
    await expect(page.locator('#pitch-sequence #replay-tempo-value')).toHaveText('90 BPM');
    await page.locator('#intonation-toggle').click();
    await page.locator('#intonation-options > summary').click();
    await page.locator('#pitch-hold-ms').fill('350');
    await expect(page.locator('#intonation #pitch-hold-value')).toHaveText('350 ms');
    await expect(page.locator('.pitch-mic')).toHaveAttribute('aria-pressed', 'false');
  });
}

test('fresh defaults use full volume and 442 Hz, with a compact attribution page', async ({
  page,
}) => {
  await page.addInitScript(() => {
    // Reflect.apply below preserves the source node as the receiver.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalStart = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (
      ...args: Parameters<AudioBufferSourceNode['start']>
    ) {
      document.documentElement.dataset.playbackRate = String(this.playbackRate.value);
      Reflect.apply(originalStart, this, args);
    };
  });
  await page.goto('/');
  await expect(page.locator('#volume')).toHaveValue('100');
  await expect(page.locator('#volume-value')).toHaveText('100 %');
  await expect(page.locator('#reference-a')).toHaveValue('442');
  await expect(page.locator('#reference-a-value')).toHaveText('442 Hz');
  await page.locator('.note[data-string="0"][data-offset="0"]').click();
  await expect
    .poll(async () => Number(await page.locator('html').getAttribute('data-playback-rate')))
    .toBeCloseTo(442 / 440);
  await page.locator('#assistance-open').click();
  await expect(page.getByRole('button', { name: 'Gut zu wissen öffnen' })).toHaveCount(0);
  await page.locator('#help-open').click();
  await expect(page.locator('#help-panel img')).toBeVisible();
  await expect(page.locator('#help-panel p')).toHaveCount(0);
  await expect(page.locator('#help-panel li a')).toHaveCount(7);
  for (const label of ['Bravura', 'Material Icons']) {
    const href = await page
      .locator('#help-panel')
      .getByRole('link', { name: new RegExp(label) })
      .getAttribute('href');
    expect(href).toBeTruthy();
    const license = await page.request.get(href!);
    expect(license.ok()).toBe(true);
    expect((await license.text()).length).toBeGreaterThan(100);
  }
});

test('mobile settings stay flush with the header as the usable screen height changes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#settings-open').click();
  for (const height of [915, 780, 667]) {
    await page.setViewportSize({ width: 412, height });
    await expect
      .poll(async () => {
        const header = (await page.locator('.header').boundingBox())!;
        const panel = (await page.locator('#settings').boundingBox())!;
        const footer = (await page.locator('.footer').boundingBox())!;
        return {
          top: panel.y - header.y - header.height,
          bottom: panel.y + panel.height - footer.y,
          headerHeight: header.height,
        };
      })
      .toEqual({ top: 0, bottom: 0, headerHeight: 56 });
  }
});
