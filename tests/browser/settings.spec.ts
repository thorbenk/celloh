import { expect, test } from '@playwright/test';

test('preferences survive reload and preserve manual spelling when a key is cleared', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  if ((await page.locator('#advanced-settings').getAttribute('open')) === null)
    await page.locator('#advanced-settings > summary').click();
  await page.locator('#flat').click();
  await page.locator('#key').selectOption({ label: 'G-Dur' });
  if ((await page.locator('#position-options').getAttribute('open')) === null)
    await page.locator('#position-options > summary').click();
  await page.getByLabel('Namen der Lagen', { exact: true }).selectOption('lower-upper');
  await page.locator('#extension').check();
  if ((await page.locator('#position-options').getAttribute('open')) === null)
    await page.locator('#position-options > summary').click();
  await page.locator('#position-2-upper').check();
  await page.locator('#to-scale').check();
  await page.locator('#highlight-toggle').uncheck();
  await page.locator('#spread').fill('140');
  if ((await page.locator('#sound-settings').getAttribute('open')) === null)
    await page.locator('#sound-settings > summary').click();
  await page.locator('#volume').fill('35');
  await page.locator('#sequence-options > summary').click();
  await page.locator('#replay-tempo').fill('80');
  await page.locator('#intonation-options > summary').click();
  await page.locator('#pitch-hold-ms').fill('450');
  await page.locator('#settings-close').click();
  await page.locator('#sequence-toggle').click();
  await page.locator('#intonation-toggle').click();
  await page.reload();
  await expect(page.locator('#key')).toHaveValue('major:1');
  await expect(page.locator('#position-naming')).toHaveValue('lower-upper');
  await expect(page.locator('#position-summary')).toContainText('2 oben');
  await expect(page.locator('#position-summary')).toContainText('Streckung');
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
  await expect(page.locator('#intonation')).toBeVisible();
  await expect(page.locator('#pitch-sequence')).toBeVisible();
  await expect(page.locator('.pitch-mic')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#active-key').click();
  await page.reload();
  await expect(page.locator('#key')).toHaveValue('');
  await expect(page.locator('#flat')).toHaveAttribute('aria-pressed', 'true');
});

test('position naming translates Wolf, Schmidt and app labels without changing finger placements', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#position-naming')).toHaveValue('wolf');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.locator('#position-options > summary').click();
  await page.locator('#position-2-upper').check();
  await page.locator('#position-3-upper').check();
  await page.locator('#extension').check();
  const markers = page.locator('.finger-marker');
  const coordinates = await markers.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('cy')),
  );
  for (const [system, labels] of [
    ['wolf', ['1. Lage', '2. Zwischenlage', '2. Lage', '3. Lage', '3. Zwischenlage', '4. Lage']],
    [
      'lower-upper',
      ['1. Lage', '2. Lage unten', '2. Lage oben', '3. Lage unten', '3. Lage oben', '4. Lage'],
    ],
    ['schmidt', ['1. Lage', '1,5. Lage', '2. Lage', '2,5. Lage', '3. Lage', '4. Lage']],
  ] as const) {
    await page.getByLabel('Namen der Lagen', { exact: true }).selectOption(system);
    await expect(page.locator('.position-label')).toHaveText([...labels]);
    for (const label of labels) {
      await expect(
        page.getByRole('switch', { name: `${label} anzeigen`, exact: true }),
      ).toBeChecked();
      await expect(page.locator('#position-summary')).toContainText(label.replace('. Lage', ''));
    }
    expect(
      await markers.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('cy')),
      ),
    ).toEqual(coordinates);
  }
  await page.locator('.position-comparison > summary').click();
  const raised = page.getByRole('row', { name: /F–Fis–G–Gis/ });
  await expect(raised).toContainText('2. Zwischenlage');
  await expect(raised).toContainText('1,5. Lage');
  await expect(raised).toContainText('2. Lage unten');
  await page.reload();
  await expect(page.locator('#position-naming')).toHaveValue('schmidt');
  await expect(page.locator('.position-label')).toHaveText([
    '1. Lage',
    '1,5. Lage',
    '2. Lage',
    '2,5. Lage',
    '3. Lage',
    '4. Lage',
  ]);
  await expect(page.locator('#extension')).toBeChecked();
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
  await expect(page.locator('#volume')).toHaveValue('100');
  await expect(page.locator('#piano')).toBeVisible();
});

test('note displays update globally while simplified fingerboard names retain full accessible pitches', async ({
  page,
}) => {
  await page.goto('/');
  const note = page.locator('.note[data-string="3"][data-offset="1"]');
  await expect(page.locator('#note-naming')).toHaveValue('german');
  await expect(page.locator('#octave-notation')).toHaveValue('helmholtz');
  await expect(note).toHaveText('ais');
  await expect(page.locator('.open-row .note')).toHaveText(['C', 'G', 'd', 'a']);
  await note.click();
  await page.locator('#sequence-toggle').click();
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  if ((await page.locator('#advanced-settings').getAttribute('open')) === null)
    await page.locator('#advanced-settings > summary').click();
  await page.locator('#flat').click();
  const naming = page.getByLabel('Notennamen', { exact: true });
  const octaves = page.getByLabel('Oktavbezeichnung', { exact: true });
  for (const [names, octaveStyle, expected] of [
    ['german', 'scientific', 'B3'],
    ['german', 'helmholtz', 'b'],
    ['international', 'helmholtz', 'b♭'],
    ['international', 'scientific', 'B♭3'],
  ] as const) {
    await naming.selectOption(names);
    await octaves.selectOption(octaveStyle);
    await expect(note).toHaveText(expected);
    await expect(page.locator('#selected-note')).toHaveText(expected);
    await expect(page.locator('#compact-staff')).toHaveAccessibleName(`${expected}, Bassschlüssel`);
    await expect(page.locator('.piano-key[data-midi="58"]')).toHaveAccessibleName(
      `${expected}, Klaviertaste`,
    );
    await expect(page.locator('.piano-key[data-midi="58"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('#pitch-sequence .sequence-scroll svg')).toHaveAccessibleName(
      `C-Dur: ${expected}`,
    );
  }
  await page.locator('#key').selectOption({ label: 'B-Dur' });
  await expect(page.locator('#active-key-name')).toHaveText('B-Dur');
  await naming.selectOption('german');
  await expect(page.locator('#active-key-name')).toHaveText('H-Dur');
  await naming.selectOption('international');
  await octaves.selectOption('helmholtz');
  await page.getByRole('switch', { name: 'Oktaven anzeigen' }).uncheck();
  await expect(page.locator('.open-row .note')).toHaveText(['C', 'G', 'D', 'A']);
  await expect(note).toHaveText('A♯'); // Chromatic spelling follows this sharp key.
  await expect(note).toHaveAccessibleName('a♯, A-Saite, Halbtonschritt 1');
  await expect(note).toHaveAttribute('title', 'a♯ · A-Saite');
  await expect(page.locator('.piano-key[data-midi="58"]')).toHaveText('a♯');
  await expect(page.locator('#selected-note')).toHaveText('a♯');
  await page.reload();
  await expect(naming).toHaveValue('international');
  await expect(octaves).toHaveValue('helmholtz');
  await expect(page.locator('#key')).toHaveValue('major:5');
  await expect(page.locator('#show-octaves')).not.toBeChecked();
  await expect(note).toHaveText('A♯');
});

test('legacy key names migrate independently of notation and invalid display preferences fall back', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'celloh.settings',
      JSON.stringify({
        version: 1,
        values: {
          key: 'Ges-Dur',
          'note-naming': 'helmholtz',
          'octave-notation': 4,
          'show-octaves': 'false',
        },
      }),
    );
  });
  await page.goto('/');
  await expect(page.locator('#key')).toHaveValue('major:-6');
  await expect(page.locator('#note-naming')).toHaveValue('german');
  await expect(page.locator('#octave-notation')).toHaveValue('helmholtz');
  await expect(page.locator('#show-octaves')).toBeChecked();
  const ces = page.locator('.note[data-string="3"][data-offset="2"]');
  await expect(ces).toHaveText('ces′');
  await ces.click();
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  if ((await page.locator('#advanced-settings').getAttribute('open')) === null)
    await page.locator('#advanced-settings > summary').click();
  await page.locator('#note-naming').selectOption('international');
  await page.locator('#octave-notation').selectOption('helmholtz');
  await expect(ces).toHaveText('c♭′');
  await expect(page.locator('#selected-note')).toHaveText('c♭′');
  await expect(page.locator('#key')).toHaveValue('major:-6');
  await expect(page.locator('#active-key-name')).toHaveText('G♭-Dur');
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
  if ((await page.locator('#advanced-settings').getAttribute('open')) === null)
    await page.locator('#advanced-settings > summary').click();
  await page.locator('#flat').click();
  if ((await page.locator('#position-options').getAttribute('open')) === null)
    await page.locator('#position-options > summary').click();
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
  if ((await page.locator('#advanced-settings').getAttribute('open')) === null)
    await page.locator('#advanced-settings > summary').click();
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

test('reference A retunes samples and intonation and persists across reloads', async ({ page }) => {
  await page.addInitScript(() => {
    // Called with the source node as its receiver below.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (
      this: AudioBufferSourceNode,
      ...args: Parameters<AudioBufferSourceNode['start']>
    ) {
      document.documentElement.dataset.playbackRate = String(this.playbackRate.value);
      start.apply(this, args);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  if ((await page.locator('#advanced-settings').getAttribute('open')) === null)
    await page.locator('#advanced-settings > summary').click();
  if ((await page.locator('#sound-settings').getAttribute('open')) === null)
    await page.locator('#sound-settings > summary').click();
  await page.getByRole('slider', { name: 'Kammerton A' }).fill('442');
  await expect(page.locator('#reference-a-value')).toHaveText('442 Hz');
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  await page.locator('.note[data-string="3"][data-offset="12"]').click();
  await expect(page.locator('.pitch-target')).toHaveText('a′ · 442.0 Hz');
  await expect
    .poll(async () => Number(await page.locator('html').getAttribute('data-playback-rate')))
    .toBeCloseTo(442 / 440);
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  if ((await page.locator('#advanced-settings').getAttribute('open')) === null)
    await page.locator('#advanced-settings > summary').click();
  if ((await page.locator('#sound-settings').getAttribute('open')) === null)
    await page.locator('#sound-settings > summary').click();
  await page.locator('#reference-a').fill('444');
  await expect(page.locator('.pitch-target')).toHaveText('a′ · 444.0 Hz');
  await page.reload();
  await expect(page.locator('#reference-a')).toHaveValue('444');
  await expect(page.locator('#reference-a-value')).toHaveText('444 Hz');
  await page.locator('.note[data-string="3"][data-offset="12"]').click();
  await expect(page.locator('.pitch-target')).toHaveText('a′ · 444.0 Hz');
  await expect
    .poll(async () => Number(await page.locator('html').getAttribute('data-playback-rate')))
    .toBeCloseTo(444 / 440);
});
