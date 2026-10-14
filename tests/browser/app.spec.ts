import { test, expect, type Page } from '@playwright/test';

// Exercise the number-style preference; default Helmholtz and mode changes are covered in settings.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('celloh.settings')) {
      localStorage.setItem(
        'celloh.settings',
        JSON.stringify({ version: 1, values: { 'octave-notation': 'scientific' } }),
      );
    }
  });
});

test('help actions open information panels and return focus to the visible opener', async ({
  page,
}) => {
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Hilfe öffnen' });
  for (const [action, title] of [
    ['Gut zu wissen öffnen', 'Gut zu wissen'],
    ['Über CellOh! öffnen', 'Über CellOh!'],
  ] as const) {
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: action }).click();
    await expect(page.getByRole('dialog', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('#assistance-panel')).not.toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Escape');
    await expect(menu).toBeFocused();
  }
  await menu.click();
  await page.locator('.note[data-string="0"][data-offset="0"]').click();
  await expect(page.locator('#assistance-panel')).not.toBeVisible();
});

test('zoom actions fit the whole board or its width and restore the normal note size', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const zoom = async (label: string) => {
    await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
    await page.getByRole('tab', { name: 'Griffbrett' }).click();
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.locator('#settings')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Einstellungen öffnen' })).toBeFocused();
  };
  const size = () => page.locator('.fingerboard').boundingBox();
  await zoom('Alles einpassen');
  const viewport = (await page.locator('.board-scroll').boundingBox())!;
  expect((await size())!.height).toBeCloseTo(viewport.height, 0);
  expect((await size())!.width).toBeLessThan(viewport.width);
  await expect(page.locator('.note[data-string="3"][data-offset="24"]')).toBeInViewport({
    ratio: 0.999,
  });
  expect(await page.locator('.board-scroll').evaluate((el) => el.scrollHeight)).toBe(
    viewport.height,
  );
  await page.getByRole('button', { name: 'Klaviatur', exact: true }).click();
  await expect.poll(async () => (await size())!.height).toBeCloseTo(viewport.height - 88, 0);
  await zoom('Breite einpassen');
  expect((await size())!.width).toBeCloseTo(375, 0);
  expect((await size())!.height).toBeGreaterThan(viewport.height);
  await page.setViewportSize({ width: 320, height: 700 });
  await expect.poll(async () => (await size())!.width).toBeCloseTo(320, 0);
  await zoom('100 %');
  expect((await size())!.width).toBe(520);
  expect((await page.locator('.note').first().boundingBox())!.width).toBe(44);
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect.poll(async () => (await size())!.width).toBe(900);
  await zoom('Breite einpassen');
  expect((await size())!.width).toBeCloseTo(1200, 0);
});

test('touch pinch scales around the fingers without playing notes; one finger still scrolls', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(test.info().project.use.baseURL!);
  const cdp = await context.newCDPSession(page);
  const touch = async (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    points: { x: number; y: number }[],
  ) => {
    await cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((point, id) => ({ ...point, id })),
    });
  };
  const note = page.locator('.note[data-string="2"][data-offset="3"]');
  const before = (await note.boundingBox())!;
  await touch('touchStart', [
    { x: 190, y: 350 },
    { x: 310, y: 350 },
  ]);
  await touch('touchMove', [
    { x: 160, y: 350 },
    { x: 340, y: 350 },
  ]);
  await touch('touchMove', [
    { x: 130, y: 350 },
    { x: 370, y: 350 },
  ]);
  await touch('touchEnd', []);
  await expect.poll(async () => (await note.boundingBox())!.width).toBeCloseTo(88, 0);
  const after = (await note.boundingBox())!;
  expect(after.x + after.width / 2).toBeCloseTo(250 + 2 * (before.x + before.width / 2 - 250), 0);
  expect(after.y + after.height / 2).toBeCloseTo(350 + 2 * (before.y + before.height / 2 - 350), 0);
  await expect(page.locator('.note.selected')).toHaveCount(0);
  expect(await page.evaluate(() => window.visualViewport!.scale)).toBe(1);
  const scroll = () => page.locator('.board-scroll').evaluate((el) => el.scrollTop);
  const initialScroll = await scroll();
  await touch('touchStart', [{ x: 250, y: 550 }]);
  for (const y of [520, 480, 440, 400]) await touch('touchMove', [{ x: 250, y }]);
  await touch('touchEnd', []);
  await expect.poll(scroll).toBeGreaterThan(initialScroll + 50);
  // A tap during a native fling stops momentum instead of activating a control.
  await page.locator('.board-scroll').evaluate(
    (el) =>
      new Promise<void>((resolve) => {
        let previous = el.scrollTop;
        let stableFrames = 0;
        const frame = () => {
          stableFrames = el.scrollTop === previous ? stableFrames + 1 : 0;
          previous = el.scrollTop;
          if (stableFrames >= 10) resolve();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
  );
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).tap();
  await page.getByRole('tab', { name: 'Griffbrett' }).tap();
  await page.getByRole('button', { name: '100 %', exact: true }).tap();
  await touch('touchStart', [
    { x: 130, y: 350 },
    { x: 370, y: 350 },
  ]);
  await touch('touchMove', [
    { x: 190, y: 350 },
    { x: 310, y: 350 },
  ]);
  await touch('touchEnd', []);
  await expect.poll(async () => (await note.boundingBox())!.width).toBeCloseTo(22, 0);
  await expect(page.locator('.note.selected')).toHaveCount(0);
  // Wait out the compatibility-click guard before a deliberate new tap.
  await page.waitForTimeout(450);
  await note.tap();
  await expect(note).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  await context.close();
});

test('notes, spellings, position variants, extensions, and audio', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.note')).toHaveCount(100);
  const firstStep = page.locator('.note[data-string="3"][data-offset="1"]');
  await expect(firstStep).toHaveText('Ais3');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByRole('button', { name: 'Be ♭', exact: true }).click();
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  await expect(firstStep).toHaveText('B3');
  await expect(page.locator('.note[data-string="3"][data-offset="2"]')).toHaveText('H3');
  await firstStep.click();
  await expect(page.locator('#selected-note')).toHaveText('B3');
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  await expect(page.locator('#overlays g')).toHaveCount(4);
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.locator('input[data-position="1"]').uncheck();
  await expect(page.locator('#overlays g')).toHaveCount(3);
  await page.locator('#position-2-upper').check();
  await page.locator('#position-3-upper').check();
  await expect(page.locator('.position-overlay')).toHaveCount(5);
  await page.locator('#position-2-lower').uncheck();
  await page.locator('#position-3-lower').uncheck();
  await expect(page.locator('.position-overlay')).toHaveCount(3);
  await page.locator('#extension').check();
  await expect(page.locator('.extension-bracket')).toHaveCount(3);
  await expect(page.locator('.extension-text, .board-bottom')).toHaveCount(0);
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  await page.locator('.note[data-string="0"][data-offset="24"]').click();
  await expect(page.locator('#selected-note')).toHaveText('C4');
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  await page.screenshot({ path: '/tmp/celloh-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('mobile layout stays within viewport and brackets align with notes', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  for (const id of [
    'assistance-open',
    'notation-open',
    'settings-open',
    'piano-toggle',
    'sequence-toggle',
  ]) {
    const control = page.locator(`#${id}`);
    await expect(control).toBeInViewport({ ratio: 1 });
    const bounds = await control.boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: 'Hilfe öffnen' }).click();
  for (const id of ['info-open', 'help-open']) {
    await expect(page.locator(`#${id}`)).toBeInViewport({ ratio: 1 });
    expect((await page.locator(`#${id}`).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByRole('tab', { name: 'Griffbrett' }).click();
  for (const id of ['zoom-fit', 'zoom-width', 'zoom-reset']) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await expect(page.locator(`#${id}`)).toBeInViewport({ ratio: 1 });
    expect((await page.locator(`#${id}`).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.keyboard.press('Escape');
  const button = page.locator('.note[data-string="0"][data-offset="2"]');
  const bounds = await button.boundingBox();
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
  const alignment = await page.evaluate(() => {
    const svg = document.querySelector('#overlays') as SVGSVGElement;
    const matrix = svg.getScreenCTM()!;
    const marker = svg.querySelector('.finger-marker')!;
    const point = svg.createSVGPoint();
    point.x = Number(marker.getAttribute('cx'));
    point.y = Number(marker.getAttribute('cy'));
    const bracket = point.matrixTransform(matrix);
    const note = document
      .querySelector('.note[data-string="0"][data-offset="2"]')!
      .getBoundingClientRect();
    return Math.abs(bracket.y - (note.top + note.height / 2));
  });
  expect(alignment).toBeLessThanOrEqual(4);
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#selected-note')).toHaveText('D2');
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  await page.screenshot({ path: '/tmp/celloh-mobile.png', fullPage: true });
});

test('note colors match across strings and spelling, with clear nut and bracket bounds', async ({
  page,
}) => {
  await page.goto('/');
  const colors = await page.evaluate(() => {
    const color = (string: number, offset: number) =>
      getComputedStyle(
        document.querySelector(`.note[data-string="${string}"][data-offset="${offset}"]`)!,
      ).backgroundColor;
    return [color(0, 7), color(1, 0), color(0, 8), color(1, 1)];
  });
  expect(colors[0]).toBe(colors[1]);
  expect(colors[2]).toBe(colors[3]);
  expect(colors[0]).not.toBe(colors[2]);
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByRole('button', { name: 'Be ♭', exact: true }).click();
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  expect(
    await page
      .locator('.note[data-string="0"][data-offset="8"]')
      .evaluate((note) => getComputedStyle(note).backgroundColor),
  ).toBe(colors[2]);
  const geometry = await page.evaluate(() => {
    const notes = document.querySelector('#notes')!.getBoundingClientRect();
    const nutStyle = getComputedStyle(document.querySelector('#notes')!, '::before');
    const nutTop = notes.top + parseFloat(nutStyle.top);
    const nutBottom = nutTop + parseFloat(nutStyle.height);
    const open = document
      .querySelector('.note[data-string="0"][data-offset="0"]')!
      .getBoundingClientRect();
    const first = document
      .querySelector('.note[data-string="0"][data-offset="1"]')!
      .getBoundingClientRect();
    const path = document.querySelector('.position-bracket') as SVGPathElement;
    const matrix = path.getScreenCTM()!;
    const box = path.getBBox();
    const svg = document.querySelector('#overlays') as SVGSVGElement;
    const top = svg.createSVGPoint();
    top.y = box.y;
    const bottom = svg.createSVGPoint();
    bottom.y = box.y + box.height;
    const start = document
      .querySelector('.note[data-string="0"][data-offset="2"]')!
      .getBoundingClientRect();
    const end = document
      .querySelector('.note[data-string="0"][data-offset="5"]')!
      .getBoundingClientRect();
    return {
      aboveNut: nutTop - open.bottom,
      belowNut: first.top - nutBottom,
      startError: Math.abs(top.matrixTransform(matrix).y - start.top),
      endError: Math.abs(bottom.matrixTransform(matrix).y - end.bottom),
    };
  });
  expect(geometry.aboveNut).toBeGreaterThanOrEqual(20);
  expect(geometry.belowNut).toBeGreaterThanOrEqual(12);
  expect(geometry.startError).toBeLessThan(1);
  expect(geometry.endError).toBeLessThan(1);
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.locator('#position-2-upper').check();
  await page.locator('#position-3-upper').check();
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  await expect(page.locator('.position-overlay')).toHaveCount(6);
  await expect(page.locator('.finger-marker')).toHaveCount(24);
  await expect(page.locator('.finger-numbers')).toHaveCount(0);
  await page.screenshot({ path: '/tmp/celloh-all-positions.png', fullPage: true });
});

test('settings slide over the centered board and close with Escape, button, or backdrop', async ({
  page,
}) => {
  // Each viewport scenario starts with default preferences.
  await page.addInitScript(() => localStorage.clear());
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/');
    const panel = page.getByRole('dialog', { name: 'Einstellungen' });
    const open = page.getByRole('button', { name: 'Einstellungen öffnen' });
    await expect(panel).not.toBeVisible();
    await expect(page.locator('.intro')).toHaveCount(0);
    const piano = page.getByRole('button', { name: 'Klaviatur', exact: true });
    if ((await piano.getAttribute('aria-expanded')) === 'false') await piano.click();
    await page.getByRole('button', { name: 'Tonfolge', exact: true }).click();
    const before = await page.locator('.board-card').boundingBox();
    const workspace = await page.locator('.workspace').boundingBox();
    expect(Math.abs(workspace!.x + workspace!.width / 2 - width / 2)).toBeLessThan(2);
    await open.click();
    await expect(panel).toBeVisible();
    expect(await page.locator('.board-card').boundingBox()).toEqual(before);
    await panel.evaluate((panel) =>
      Promise.all(panel.getAnimations().map((animation) => animation.finished)),
    );
    const bounds = (await panel.boundingBox())!;
    const footer = (await page.locator('.footer').boundingBox())!;
    expect(bounds.y + bounds.height).toBe(footer.y);
    expect(
      await page.locator('#piano').evaluate((piano) => {
        const bounds = piano.getBoundingClientRect();
        return Boolean(
          document.elementFromPoint(bounds.right - 20, bounds.top + 20)?.closest('#settings'),
        );
      }),
    ).toBe(true);
    await expect(piano).toBeInViewport({ ratio: 1 });
    await page.locator('#position-2-upper').check();
    await page.locator('#position-3-upper').check();
    await page.getByRole('tab', { name: 'Musik' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Griffbrett' })).toBeFocused();
    await expect(page.getByRole('tabpanel', { name: 'Griffbrett' })).toBeVisible();
    await expect(page.getByRole('tabpanel', { name: 'Musik' })).toBeHidden();
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Intonation', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'Klang' })).toBeFocused();
    await page.getByRole('slider', { name: 'Tonfolge-Tempo' }).fill('80');
    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
    await expect(open).toBeFocused();
    await open.click();
    await expect(page.getByRole('tab', { name: 'Klang' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('slider', { name: 'Tonfolge-Tempo' })).toHaveValue('80');
    await page.getByRole('tab', { name: 'Klang' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Intonation', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Musik' })).toBeFocused();
    await expect(page.locator('#position-2-upper')).toBeChecked();
    await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
    await expect(panel).not.toBeVisible();
    if (width === 1280) {
      await open.click();
      await page.mouse.click(20, 200);
      await expect(panel).not.toBeVisible();
    }
    await page.screenshot({ path: `/tmp/celloh-centered-${width}.png`, fullPage: true });
  }
});

test('one bottom tool row keeps notation, keyboard and sequence independently usable', async ({
  page,
}) => {
  // Each viewport scenario starts with default preferences.
  await page.addInitScript(() => localStorage.clear());
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/');
    const tools = page.locator('.footer button');
    await expect(tools).toHaveText(['Noten', 'Klaviatur', 'Tonfolge', 'Intonation']);
    for (const label of await page.locator('.footer .tool-label').all()) {
      if (width < 500) await expect(label).toBeHidden();
      else await expect(label).toBeVisible();
    }
    await expect(page.locator('#intonation')).toBeHidden();
    const rows = await tools.evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().top),
    );
    expect(new Set(rows).size).toBe(1);
    for (const tool of await tools.all()) await expect(tool).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const piano = page.getByRole('button', { name: 'Klaviatur', exact: true });
    if ((await piano.getAttribute('aria-expanded')) === 'false') await piano.click();
    await page.getByRole('button', { name: 'Tonfolge', exact: true }).click();
    await page.getByRole('button', { name: 'Noten öffnen' }).click();
    const picker = page.getByRole('dialog', { name: 'Noten', exact: true });
    await expect(picker).toBeVisible();
    await picker.evaluate((panel) =>
      Promise.all(panel.getAnimations().map((animation) => animation.finished)),
    );
    const bounds = (await picker.boundingBox())!;
    expect(bounds.y + bounds.height).toBe((await page.locator('.footer').boundingBox())!.y);
    for (const id of ['piano', 'pitch-sequence']) {
      expect(
        await page.locator(`#${id}`).evaluate((dock) => {
          const bounds = dock.getBoundingClientRect();
          return Boolean(
            document
              .elementFromPoint(bounds.right - 20, bounds.top + 20)
              ?.closest('#notation-panel'),
          );
        }),
      ).toBe(true);
    }
    await expect(picker.getByRole('heading', { name: 'Bassschlüssel' })).toHaveCount(0);
    await expect(picker.getByRole('button', { name: 'Tonmarkierung aufheben' })).toBeInViewport({
      ratio: 1,
    });
    await expect(page.locator('#piano')).toBeVisible();
    await expect(page.locator('#pitch-sequence')).toBeVisible();
    await expect(
      page.locator('#pitch-sequence').getByRole('button', { name: 'Tonfolge abspielen' }),
    ).toBeVisible();
    await expect(page.locator('.footer').getByRole('slider')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Noten öffnen' })).toBeFocused();
    await expect(page.locator('#piano')).toBeVisible();
    await expect(page.locator('#pitch-sequence')).toBeVisible();
  }
});

test('to-scale spacing preserves cello proportions, declutters notes, and restores equal spacing', async ({
  page,
}) => {
  // Each viewport scenario starts with default preferences.
  await page.addInitScript(() => localStorage.clear());
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/');
    const centers = () =>
      page.locator('.note[data-string="0"]').evaluateAll((notes) =>
        notes.map((note) => {
          const bounds = note.getBoundingClientRect();
          return bounds.top + bounds.height / 2;
        }),
      );
    const equal = await centers();
    expect(equal[2]! - equal[1]!).toBeCloseTo(58);
    expect(equal[24]! - equal[23]!).toBeCloseTo(58);
    await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
    await page.getByRole('tab', { name: 'Griffbrett' }).click();
    const spread = page.getByRole('slider', { name: 'Spreizung' });
    await expect(spread).not.toBeVisible();
    await page.getByRole('switch', { name: 'Wie auf dem Cello' }).check();
    const scaled = await centers();
    const firstGap = scaled[2]! - scaled[1]!;
    expect((scaled[14]! - scaled[13]!) / firstGap).toBeCloseTo(0.5, 2);
    expect((scaled[3]! - scaled[2]!) / firstGap).toBeCloseTo(2 ** (-1 / 12), 2);
    await spread.fill('60');
    const compact = await centers();
    expect((compact[2]! - compact[1]!) / firstGap).toBeCloseTo(0.6, 2);
    await expect(page.locator('#spread-value')).toHaveText('60 %');
    await page.getByRole('tab', { name: 'Musik' }).click();
    await page.locator('#position-2-upper').check();
    await page.locator('#position-3-upper').check();
    await page.locator('#extension').check();
    await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
    const note = page.locator('.note[data-string="0"][data-offset="24"]');
    await expect(note).toHaveText('');
    await expect(note).toHaveAccessibleName('c′, C-Saite, Halbtonschritt 24');
    await note.click();
    await expect(page.locator('#selected-note')).toHaveText('c′');
    await expect(note).toHaveAttribute('aria-pressed', 'true');
    const clearance = await page.locator('.note[data-string="0"]').evaluateAll((notes) =>
      notes.slice(1).map((note, index) => {
        const previous = notes[index]!.getBoundingClientRect();
        return note.getBoundingClientRect().top - previous.bottom;
      }),
    );
    expect(Math.min(...clearance)).toBeGreaterThan(0);
    const alignment = await page
      .locator('.position-overlay[data-position="1"] .finger-marker')
      .evaluateAll((markers) => {
        const offsets = [1, 3, 4, 5]; // Backward extension moves only finger 1.
        return markers.map((marker, index) => {
          const bounds = marker.getBoundingClientRect();
          const note = document
            .querySelector(`.note[data-string="0"][data-offset="${offsets[index]}"]`)!
            .getBoundingClientRect();
          return Math.abs(bounds.top + bounds.height / 2 - note.top - note.height / 2);
        });
      });
    expect(Math.max(...alignment)).toBeLessThan(1);
    await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
    await page.getByRole('tab', { name: 'Griffbrett' }).click();
    await expect(spread).toHaveValue('60');
    await spread.fill('180');
    const expanded = await centers();
    expect((expanded[2]! - expanded[1]!) / firstGap).toBeCloseTo(1.8, 2);
    await expect(note).toHaveText('c′');
    await expect(note).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('switch', { name: 'Wie auf dem Cello' }).uncheck();
    await expect(spread).not.toBeVisible();
    const restored = await centers();
    expect(restored[2]! - restored[1]!).toBeCloseTo(58);
    expect(restored[24]! - restored[23]!).toBeCloseTo(58);
    await expect(note).toHaveText('c′');
  }
});

async function staffPoint(page: Page, step: number) {
  await page
    .locator('#notation-panel')
    .evaluate((panel) => Promise.all(panel.getAnimations().map((animation) => animation.finished)));
  return page.locator('#staff').evaluate((svg, step) => {
    const staff = svg as SVGSVGElement;
    const point = staff.createSVGPoint();
    point.x = 152;
    point.y = 190 - step * 10;
    const screen = point.matrixTransform(staff.getScreenCTM()!);
    return { x: screen.x, y: screen.y };
  }, step);
}

test('note panel toggles and switches exclusively with settings', async ({ page }) => {
  await page.goto('/');
  const notes = page.getByRole('dialog', { name: 'Noten', exact: true });
  const settings = page.getByRole('dialog', { name: 'Einstellungen' });
  const open = page.getByRole('button', { name: 'Noten öffnen' });
  await expect(notes).not.toBeVisible();
  await open.click();
  await expect(notes).toBeVisible();
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await expect(settings).toBeVisible();
  await expect(notes).not.toBeVisible();
  await open.click();
  await expect(notes).toBeVisible();
  await expect(settings).not.toBeVisible();
  await page.keyboard.press('Escape');
  await expect(notes).not.toBeVisible();
  await expect(open).toBeFocused();
  await open.click();
  await open.click();
  await expect(notes).not.toBeVisible();
});

test('staff previews silently, selects exact matches, and renders board clicks while open', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('.note[data-string="1"][data-offset="0"]').click();
  await page.getByRole('button', { name: 'Noten öffnen' }).click();
  await expect(page.locator('#staff .staff-note')).toHaveAttribute('data-midi', '43');
  const point = await staffPoint(page, 14); // C4, one ledger line
  await page.mouse.move(point.x, point.y);
  await expect(page.locator('#staff .preview-note')).toHaveAttribute('data-midi', '60');
  await expect(page.locator('#staff .ledger-line')).toHaveCount(1);
  await expect(page.locator('#selected-note')).toHaveText('G2');
  await page.mouse.move(5, 5);
  await expect(page.locator('#staff .staff-note')).toHaveAttribute('data-midi', '43');
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#selected-note')).toHaveText('C4');
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  await expect(page.locator('.note.selected')).toHaveCount(4);
  expect(
    await page
      .locator('.note.selected')
      .evaluateAll((notes) => notes.every((note) => (note as HTMLElement).dataset.midi === '60')),
  ).toBe(true);
  expect(
    await page
      .locator('.note[data-midi="48"]')
      .first()
      .evaluate((note) => getComputedStyle(note).opacity),
  ).toBe('0.22');
  await page.locator('.note[data-string="0"][data-offset="0"]').click();
  await expect(page.getByRole('dialog', { name: 'Noten', exact: true })).toBeVisible();
  await expect(page.locator('#staff .staff-note')).toHaveAttribute('data-midi', '36');
  await expect(page.locator('#staff .ledger-line')).toHaveCount(2);
  await page.screenshot({ path: '/tmp/celloh-note-panel.png', fullPage: true });
  await page.getByRole('button', { name: 'Tonmarkierung aufheben' }).click();
  await expect(page.locator('.note.selected')).toHaveCount(0);
  await expect(page.locator('#staff .staff-note')).toHaveCount(0);
});

test('staff accidentals and keyboard distinguish German H and B', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Noten öffnen' }).click();
  const point = await staffPoint(page, 13); // H3
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#selected-note')).toHaveText('H3');
  await page.getByRole('button', { name: 'Be', exact: true }).click();
  await expect(page.locator('#selected-note')).toHaveText('B3');
  await expect(page.locator('#staff .staff-note')).toHaveAttribute('data-step', '13');
  await expect(page.locator('#staff .staff-accidental')).toHaveText('♭');
  await page.getByRole('button', { name: 'Auflösungszeichen' }).click();
  await expect(page.locator('#selected-note')).toHaveText('H3');
  await page.locator('#staff').focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.locator('#selected-note')).toHaveText('C4');
});

test('phone taps select notes in the note panel', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(test.info().project.use.baseURL!);
  await page.getByRole('button', { name: 'Noten öffnen' }).tap();
  const point = await staffPoint(page, 12); // A3
  await page.touchscreen.tap(point.x, point.y);
  await expect(page.locator('#selected-note')).toHaveText('a');
  await expect(page.locator('.note.selected')).toHaveCount(4);
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  await page.screenshot({ path: '/tmp/celloh-note-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Noten schließen' }).tap();
  await expect(page.getByRole('dialog', { name: 'Noten', exact: true })).not.toBeVisible();
  await context.close();
});

test('quick dimming toggle preserves selection and compact notation', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByRole('switch', { name: 'Andere Töne dimmen' });
  const compact = page.locator('#compact-staff');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByRole('tab', { name: 'Griffbrett' }).click();
  await expect(toggle).toBeChecked();
  await page.locator('.note[data-string="1"][data-offset="0"]').click();
  await expect(compact).toHaveAttribute('aria-label', 'G2, Bassschlüssel');
  await expect(compact.locator('.staff-note')).toHaveAttribute('data-midi', '43');
  const unmatched = page.locator('.note[data-midi="36"]').first();
  expect(await unmatched.evaluate((note) => getComputedStyle(note).opacity)).toBe('0.22');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByRole('tab', { name: 'Griffbrett' }).click();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  expect(await unmatched.evaluate((note) => getComputedStyle(note).opacity)).toBe('1');
  await expect(page.locator('.note.selected')).toHaveCount(2);
  await page.locator('.note[data-string="0"][data-offset="0"]').click();
  await expect(compact.locator('.staff-note')).toHaveAttribute('data-midi', '36');
  await expect(compact.locator('.ledger-line')).toHaveCount(2);
  expect(
    await page
      .locator('.note[data-midi="43"]')
      .first()
      .evaluate((note) => getComputedStyle(note).opacity),
  ).toBe('1');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByRole('tab', { name: 'Griffbrett' }).click();
  await toggle.click();
  expect(
    await page
      .locator('.note[data-midi="43"]')
      .first()
      .evaluate((note) => getComputedStyle(note).opacity),
  ).toBe('0.22');
  await page.getByRole('button', { name: 'Noten öffnen' }).click();
  const point = await staffPoint(page, 14);
  await page.mouse.move(point.x, point.y);
  await expect(page.locator('#staff .preview-note')).toHaveAttribute('data-midi', '60');
  await expect(compact.locator('.staff-note')).toHaveAttribute('data-midi', '36');
  await page.getByRole('button', { name: 'Noten schließen' }).click();
  await page.locator('.board-scroll').evaluate((board) => {
    board.scrollTop = 500;
  });
  await expect(compact).toBeInViewport();
  await page.screenshot({ path: '/tmp/celloh-compact-notation.png', fullPage: true });
});

test('key shading combines with pitch focus without disabling notes or changing positions', async ({
  page,
}) => {
  await page.goto('/');
  const positions = await page.locator('#overlays').innerHTML();
  await expect(page.locator('#active-key')).toBeHidden();
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByLabel('Tonart', { exact: true }).selectOption({ label: 'Es-Dur' });
  await expect(page.locator('#key-notes')).toHaveText('Es · F · G · As · B · C · D');
  await expect(page.getByRole('button', { name: 'Be ♭', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  expect(await page.locator('#overlays').innerHTML()).toBe(positions);
  const notes = await page.locator('.note').evaluateAll((notes) =>
    notes.map((note) => ({
      midi: Number((note as HTMLElement).dataset.midi),
      opacity: getComputedStyle(note).opacity,
      disabled: (note as HTMLButtonElement).disabled,
    })),
  );
  for (const note of notes) {
    expect(note.opacity).toBe([0, 2, 3, 5, 7, 8, 10].includes(note.midi % 12) ? '1' : '0.22');
    expect(note.disabled).toBe(false);
  }
  const outside = page.locator('.note[data-string="0"][data-offset="4"]'); // E2
  const inside = page.locator('.note[data-string="0"][data-offset="3"]'); // Es2
  const higherE = page.locator('.note[data-string="2"][data-offset="2"]'); // E3
  await expect(inside).toHaveText('Es2');
  await page.keyboard.press('Tab');
  await outside.focus();
  await expect(outside).toHaveCSS('opacity', '1');
  await page.keyboard.press('Enter');
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  await expect(page.locator('#compact-staff')).toHaveAttribute('aria-label', 'E2, Bassschlüssel');
  await page.mouse.move(0, 0);
  await expect(outside).toHaveCSS('opacity', '1');
  await expect(inside).toHaveCSS('opacity', '0.55');
  await expect(higherE).toHaveCSS('opacity', '0.22'); // Key is octave-independent; selection isn't.
  await inside.focus();
  await expect(inside).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByRole('tab', { name: 'Griffbrett' }).click();
  await page.getByRole('switch', { name: 'Andere Töne dimmen' }).click();
  await expect(inside).toHaveCSS('opacity', '1');
  await expect(higherE).toHaveCSS('opacity', '0.22');
  await page.getByRole('switch', { name: 'Andere Töne dimmen' }).click();
  await page.getByRole('button', { name: 'Noten öffnen' }).click();
  await page.getByRole('button', { name: 'Tonmarkierung aufheben' }).click();
  await page.getByRole('button', { name: 'Noten schließen' }).click();
  await expect(outside).toHaveCSS('opacity', '0.22');
  await expect(inside).toHaveCSS('opacity', '1');
  await inside.click();
  await page.mouse.move(0, 0);
  await expect(page.locator('#compact-staff')).toHaveAttribute('aria-label', 'Es2, Bassschlüssel');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  for (const id of ['active-key', 'assistance-open', 'notation-open', 'settings-open']) {
    const button = page.locator(`#${id}`);
    await expect(button).toBeInViewport({ ratio: 1 });
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: 'Es-Dur: Tonart aufheben' }).click();
  await expect(page.locator('#active-key')).toBeHidden();
  await expect(page.locator('#compact-staff')).toHaveAttribute('aria-label', 'Dis2, Bassschlüssel');
  await expect(outside).toHaveCSS('opacity', '0.22'); // Original pitch-focus behavior.
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByRole('tab', { name: 'Musik' }).click();
  await expect(page.getByLabel('Tonart', { exact: true })).toHaveValue('');
});

test('Dur and natural Moll lock spelling and restore the manual preference when cleared', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  const sharp = page.getByRole('button', { name: 'Kreuze ♯', exact: true });
  const flat = page.getByRole('button', { name: 'Be ♭', exact: true });
  const key = page.getByLabel('Tonart', { exact: true });
  await flat.click();
  await expect(sharp).toBeEnabled();
  await expect(flat).toBeEnabled();
  await expect(sharp).toHaveAccessibleDescription('');
  await expect(page.locator('#spelling-help')).toBeHidden();
  await expect(key.locator('optgroup')).toHaveCount(2);
  await expect(key.locator('optgroup[label="Moll"] option')).toHaveCount(15);
  await key.selectOption({ label: 'D-Dur' });
  await expect(sharp).toBeDisabled();
  await expect(flat).toBeDisabled();
  await expect(sharp).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#spelling-help')).toHaveText('Die Tonart bestimmt die Schreibweise.');
  await expect(page.locator('#spelling-help')).toBeVisible();
  await expect(sharp).toHaveAccessibleDescription('Die Tonart bestimmt die Schreibweise.');
  await expect(key).not.toHaveAccessibleDescription(/Natürliches Moll/);
  await expect(page.locator('#minor-help')).toBeHidden();
  await key.selectOption({ label: 'c-Moll' });
  await expect(flat).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#key-notes')).toHaveText('C · D · Es · F · G · As · B');
  await expect(page.locator('#minor-help')).toBeVisible();
  await expect(key).toHaveAccessibleDescription(/Natürliches Moll/);
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  await expect(page.getByRole('button', { name: 'c-Moll: Tonart aufheben' })).toBeVisible();
  const raisedSeventh = page.locator('.note[data-string="1"][data-offset="4"]'); // H2
  await expect(raisedSeventh).toHaveCSS('opacity', '0.22');
  await raisedSeventh.click();
  await expect(raisedSeventh).toHaveCSS('opacity', '1');
  await expect(page.locator('#compact-staff')).toHaveAttribute('aria-label', 'H2, Bassschlüssel');
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await key.selectOption({ label: 'a-Moll' });
  await expect(sharp).toBeDisabled();
  await expect(flat).toBeDisabled();
  await expect(sharp).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#key-notes')).toHaveText('A · H · C · D · E · F · G');
  await key.selectOption('');
  await expect(sharp).toBeEnabled();
  await expect(flat).toBeEnabled();
  await expect(flat).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#spelling-help')).toBeHidden();
  await expect(flat).toHaveAccessibleDescription('');
  await expect(page.locator('#minor-help')).toBeHidden();
  await key.selectOption({ label: 'fis-Moll' });
  await expect(sharp).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#key-notes')).toHaveText('Fis · Gis · A · H · Cis · D · E');
  await page.getByRole('button', { name: 'fis-Moll: Tonart aufheben' }).click();
  await expect(key).toHaveValue('');
  await expect(flat).toBeEnabled();
  await expect(flat).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#compact-staff')).toHaveAttribute('aria-label', 'H2, Bassschlüssel');
});

test('corner notation reserves a fixed range and divider clears it', async ({ page }) => {
  await page.goto('/');
  const compact = page.locator('#compact-staff');
  const before = await compact.boundingBox();
  const viewBox = await compact.getAttribute('viewBox');
  for (const [string, offset, pitch] of [
    [0, 0, 36],
    [2, 0, 50],
    [3, 10, 67],
    [3, 24, 81],
  ]) {
    await page.locator(`.note[data-string="${string}"][data-offset="${offset}"]`).click();
    await expect(compact.locator('.staff-note')).toHaveAttribute('data-midi', String(pitch));
    await expect(compact).toHaveAttribute('viewBox', viewBox!);
    expect(await compact.boundingBox()).toEqual(before);
    const inside = await compact.evaluate((svg) => {
      const element = svg as SVGSVGElement;
      const head = element.querySelector('.notehead')!.getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      return head.top > bounds.top + 8 && head.bottom < bounds.bottom - 8;
    });
    expect(inside).toBe(true);
  }
  await page.locator('.board-scroll').evaluate((board) => {
    board.scrollTop = 0;
  });
  const clearance = await page.evaluate(() => {
    const compact = document.querySelector('#compact-staff')!.getBoundingClientRect();
    const notes = document.querySelector('#notes')!;
    const bounds = notes.getBoundingClientRect();
    const nut = getComputedStyle(notes, '::before');
    return bounds.left + parseFloat(nut.left) - compact.right;
  });
  expect(clearance).toBeGreaterThan(12);
  await page.screenshot({ path: '/tmp/celloh-fixed-corner-staff.png', fullPage: true });
});

test('accidental buttons preserve the written letter and explicitly render all three signs', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Noten öffnen' }).click();
  for (const [step, flatName, naturalName, sharpName, naturalPitch] of [
    [9, 'Es3', 'E3', 'Eis3', 52],
    [10, 'Fes3', 'F3', 'Fis3', 53],
    [13, 'B3', 'H3', 'His3', 59],
  ] as const) {
    await page.getByRole('button', { name: 'Auflösungszeichen' }).click();
    const point = await staffPoint(page, step);
    await page.mouse.click(point.x, point.y);
    for (const [button, sign, name, offset] of [
      ['Be', '♭', flatName, -1],
      ['Kreuz', '♯', sharpName, 1],
      ['Auflösungszeichen', '♮', naturalName, 0],
      ['Be', '♭', flatName, -1],
      ['Be', '♭', flatName, -1],
    ] as const) {
      await page.getByRole('button', { name: button, exact: true }).click();
      await expect(page.locator('#staff .staff-note')).toHaveAttribute('data-step', String(step));
      await expect(page.locator('#staff .staff-note')).toHaveAttribute(
        'data-midi',
        String(naturalPitch + offset),
      );
      await expect(page.locator('#staff .staff-accidental')).toHaveText(sign);
      await expect(page.locator('#compact-staff .staff-accidental')).toHaveText(sign);
      await expect(page.locator('#selected-note')).toHaveText(name);
      await expect(page.getByRole('button', { name: button, exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(
        await page
          .locator('.note.selected')
          .evaluateAll((notes) => notes.map((note) => Number((note as HTMLElement).dataset.midi))),
      ).toEqual(Array(await page.locator('.note.selected').count()).fill(naturalPitch + offset));
    }
  }
  await expect(page.locator('#sharp')).toHaveAttribute('aria-pressed', 'true');
});

test('accidental controls stay within the playable audio range', async ({ page }) => {
  await page.goto('/');
  await page.locator('.note[data-string="0"][data-offset="0"]').click();
  await page.getByRole('button', { name: 'Noten öffnen' }).click();
  await expect(page.getByRole('button', { name: 'Be', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Noten schließen' }).click();
  await page.locator('.note[data-string="3"][data-offset="24"]').click();
  await page.getByRole('button', { name: 'Noten öffnen' }).click();
  await expect(page.getByRole('button', { name: 'Kreuz', exact: true })).toBeDisabled();
});

async function recordAudioPlayback(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let starts = 0;
    let decodes = 0;
    let latestGain: GainNode | null = null;
    /* eslint-disable @typescript-eslint/unbound-method -- Native methods are saved for instrumentation and called with their original receiver below. */
    const originalStart = AudioBufferSourceNode.prototype.start;
    const originalGain = AudioContext.prototype.createGain;
    const originalDecode = AudioContext.prototype.decodeAudioData;
    /* eslint-enable @typescript-eslint/unbound-method */

    AudioContext.prototype.createGain = function (this: AudioContext) {
      latestGain = originalGain.call(this);
      return latestGain;
    };
    AudioBufferSourceNode.prototype.start = function (
      this: AudioBufferSourceNode,
      ...args: Parameters<AudioBufferSourceNode['start']>
    ) {
      document.documentElement.dataset.audioStarts = String(++starts);
      document.documentElement.dataset.audioGain = String(latestGain?.gain.value);
      originalStart.apply(this, args);
    };
    AudioContext.prototype.decodeAudioData = function (
      this: AudioContext,
      ...args: Parameters<AudioContext['decodeAudioData']>
    ) {
      return originalDecode.apply(this, args).then((buffer) => {
        document.documentElement.dataset.audioDecodes = String(++decodes);
        return buffer;
      });
    };
  });
}

function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('reset cancels playback while the sample is still loading', async ({ page }) => {
  await recordAudioPlayback(page);
  const gate = deferred();
  await page.route('**/audio/43.mp3', async (route) => {
    const response = await route.fetch();
    await gate.promise;
    await route.fulfill({ response });
  });
  await page.goto('/');
  await page.locator('.note[data-string="1"][data-offset="0"]').click();
  await expect(page.locator('#audio-status')).toHaveText('Klang wird geladen …');
  await page.getByRole('button', { name: 'Noten öffnen' }).click();
  await page.getByRole('button', { name: 'Tonmarkierung aufheben' }).click();
  gate.resolve();
  await expect(page.locator('html')).toHaveAttribute('data-audio-decodes', '1');
  await expect(page.locator('html')).not.toHaveAttribute('data-audio-starts');
  await expect(page.locator('#audio-status')).toHaveText('Bereit');
  await expect(page.locator('.note.selected')).toHaveCount(0);
});

test('playback uses volume changes made while the sample is loading', async ({ page }) => {
  await recordAudioPlayback(page);
  const gate = deferred();
  await page.route('**/audio/43.mp3', async (route) => {
    const response = await route.fetch();
    await gate.promise;
    await route.fulfill({ response });
  });
  await page.goto('/');
  await page.locator('.note[data-string="1"][data-offset="0"]').click();
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByRole('tab', { name: 'Klang' }).click();
  await page.locator('#volume').fill('20');
  gate.resolve();
  await expect(page.locator('html')).toHaveAttribute('data-audio-starts', '1');
  const gain = Number(await page.locator('html').getAttribute('data-audio-gain'));
  expect(gain).toBeCloseTo(0.2);
});

test('sequence viewing auditions selection, replays from it, and clears selection on recording', async ({
  page,
}) => {
  await recordAudioPlayback(page);
  await page.goto('/');
  for (const pitch of [48, 50, 52]) {
    await page.locator(`.piano-key[data-midi="${pitch}"]`).click();
    await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  }
  await page.getByRole('button', { name: 'Tonfolge', exact: true }).click();
  const sequence = page.locator('#pitch-sequence');
  const notes = sequence.locator('.sequence-scroll .staff-note');
  await notes.nth(1).click();
  await expect(notes.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.piano-key.selected')).toHaveAttribute('data-midi', '50');
  await expect(page.locator('.note.selected').first()).toHaveAttribute('data-midi', '50');
  await expect(page.locator('html')).toHaveAttribute('data-audio-starts', '4');
  await expect(notes).toHaveCount(3);
  await sequence.getByRole('button', { name: 'Tonfolge abspielen' }).click();
  await expect(notes.nth(1)).toHaveClass(/playing/);
  await sequence.getByRole('button', { name: 'Tonfolge stoppen' }).click();
  await expect(notes.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.piano-key[data-midi="55"]').click();
  await expect(notes).toHaveCount(4);
  await expect(sequence.locator('.sequence-selected')).toHaveCount(0);
  await sequence.getByRole('button', { name: 'Tonfolge abspielen' }).click();
  await expect(notes.nth(0)).toHaveClass(/playing/);
});

test('sequence insertion moves between every note and keeps its cursor through playback', async ({
  page,
}) => {
  await recordAudioPlayback(page);
  await page.goto('/');
  for (const pitch of [48, 50]) {
    await page.locator(`.piano-key[data-midi="${pitch}"]`).click();
    await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  }
  await page.getByRole('button', { name: 'Tonfolge', exact: true }).click();
  const sequence = page.locator('#pitch-sequence');
  const notes = sequence.locator('.sequence-scroll .staff-note');
  await sequence.getByRole('button', { name: 'Tonfolge bearbeiten', exact: true }).click();
  await sequence.getByRole('button', { name: 'Einfügen', exact: true }).click();
  await expect(sequence.getByRole('button', { name: 'Am Ende einfügen' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await sequence.getByRole('button', { name: 'Vor Note 1 einfügen' }).click();
  await page.locator('.piano-key[data-midi="43"]').click();
  await expect(notes.first()).toHaveAttribute('data-midi', '43');
  await notes.nth(1).click();
  await expect(sequence.getByRole('button', { name: 'Einfügen', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(sequence.getByRole('button', { name: 'Vor Note 3 einfügen' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.piano-key.selected')).toHaveAttribute('data-midi', '48');
  await sequence.getByRole('button', { name: 'Tonfolge abspielen' }).click();
  await expect(notes.first()).toHaveClass(/playing/);
  await sequence.getByRole('button', { name: 'Tonfolge stoppen' }).click();
  await expect(sequence.getByRole('button', { name: 'Vor Note 3 einfügen' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await sequence.getByRole('button', { name: 'Am Ende einfügen' }).click();
  await page.locator('.piano-key[data-midi="55"]').click();
  expect(
    await notes.evaluateAll((notes) => notes.map((note) => Number(note.getAttribute('data-midi')))),
  ).toEqual([43, 48, 50, 55]);
  for (const gap of await sequence.locator('.sequence-gap-target').all()) {
    const box = (await gap.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

test('sequence editing repeatedly replaces, inserts after selection, and resumes capture', async ({
  page,
}) => {
  await recordAudioPlayback(page);
  await page.goto('/');
  for (const pitch of [48, 50, 52, 53]) {
    await page.locator(`.piano-key[data-midi="${pitch}"]`).click();
    await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  }
  await page.getByRole('button', { name: 'Tonfolge', exact: true }).click();
  const sequence = page.locator('#pitch-sequence');
  const notes = sequence.locator('.sequence-scroll .staff-note');
  const editor = sequence.locator('.sequence-editor');
  await expect(editor).toBeHidden();
  await sequence.getByRole('button', { name: 'Tonfolge bearbeiten', exact: true }).click();
  await expect(notes.last()).toHaveAttribute('aria-pressed', 'true');
  await sequence.getByRole('button', { name: 'Note 3: E3, Viertel', exact: true }).click();
  await sequence.getByRole('button', { name: 'Ganze (1/1)', exact: true }).click();
  await sequence.getByRole('button', { name: 'Punktierung', exact: true }).click();
  await expect(notes.nth(2)).toHaveAccessibleName('Note 3: E3, Ganze, punktiert');
  await expect(notes.nth(2).locator('.note-stem')).toHaveCount(0);
  await expect(notes.nth(2).locator('.note-dot')).toHaveCount(1);
  await sequence.getByRole('button', { name: 'Note bearbeiten', exact: true }).click();
  await expect(sequence.locator('.sequence-hint')).toContainText('ersetzen');
  await page.locator('.note[data-string="1"][data-offset="0"]').click();
  await expect(notes.nth(2)).toHaveAccessibleName('Note 3: G2, Ganze, punktiert');
  await page.locator('.piano-key[data-midi="57"]').click();
  await expect(notes).toHaveCount(4);
  await expect(notes.nth(2)).toHaveAttribute('data-midi', '57');
  await sequence.getByRole('button', { name: 'Einfügen', exact: true }).click();
  await sequence.getByRole('button', { name: 'Sechzehntel (1/16)', exact: true }).click();
  await sequence.getByRole('button', { name: 'Punktierung', exact: true }).click();
  await page.locator('.piano-key[data-midi="55"]').click();
  await page.locator('.piano-key[data-midi="59"]').click();
  expect(
    await notes.evaluateAll((notes) => notes.map((note) => Number(note.getAttribute('data-midi')))),
  ).toEqual([48, 50, 57, 55, 59, 53]);
  await expect(notes.nth(3)).toHaveAttribute('data-value', '16');
  await expect(notes.nth(3)).toHaveAttribute('data-dotted', 'false');
  await expect(notes.nth(3).locator('.note-flag')).toBeVisible();
  await expect(sequence.locator('.sequence-summary')).toContainText('vor Note 6');
  await sequence.getByRole('button', { name: 'Note bearbeiten', exact: true }).click();
  await expect(notes.nth(4)).toHaveAttribute('aria-pressed', 'true');
  await sequence.getByRole('button', { name: 'Ausgewählte Note löschen' }).click();
  await expect(notes.nth(4)).toHaveAccessibleName('Note 5: F3, Viertel');
  await expect(notes.nth(4)).toHaveAttribute('aria-pressed', 'true');
  await sequence.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(notes.nth(4)).toHaveAccessibleName('Note 5: H3, Sechzehntel');
  await notes.nth(4).focus();
  await page.keyboard.press('ArrowRight');
  await expect(notes.nth(5)).toBeFocused();
  await page.keyboard.press('Delete');
  await expect(notes.nth(4)).toBeFocused();
  await expect(notes).toHaveCount(5);
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
  await page.locator('.piano-key[data-midi="60"]').click();
  await expect(notes).toHaveCount(6);
  await expect(notes.last()).toHaveAttribute('data-midi', '60');
});

test('sequence editor supports touch targets and empty insertion on tablet and narrow screens', async ({
  browser,
}) => {
  for (const width of [320, 834]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: true,
      isMobile: true,
    });
    try {
      const page = await context.newPage();
      await page.goto(test.info().project.use.baseURL!);
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
      if (width === 320) await page.getByRole('button', { name: 'Klaviatur', exact: true }).tap();
      await page.getByRole('button', { name: 'Tonfolge', exact: true }).tap();
      const sequence = page.locator('#pitch-sequence');
      await sequence.getByRole('button', { name: 'Tonfolge bearbeiten', exact: true }).tap();
      await expect(
        sequence.getByRole('button', { name: 'Note bearbeiten', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await sequence.getByRole('button', { name: 'Einfügen', exact: true }).tap();
      await sequence.getByRole('button', { name: 'Halbe (1/2)', exact: true }).tap();
      await page.locator('.piano-key[data-midi="50"]').tap();
      await expect(sequence.locator('.sequence-scroll .staff-note')).toHaveAttribute(
        'data-value',
        '2',
      );
      await sequence.getByRole('button', { name: 'Vor Note 1 einfügen' }).tap();
      await expect(sequence.getByRole('button', { name: 'Vor Note 1 einfügen' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await sequence.getByRole('button', { name: 'Am Ende einfügen' }).tap();
      await expect(sequence.getByRole('button', { name: 'Am Ende einfügen' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      if (width === 320) await sequence.screenshot({ path: '/tmp/celloh-tonfolge-insert.png' });
      await sequence.getByRole('button', { name: 'Note bearbeiten', exact: true }).tap();
      await sequence.locator('.sequence-note-target').tap({ position: { x: 4, y: 4 } });
      await expect(sequence.locator('.sequence-scroll .staff-note')).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      for (const control of await sequence.locator('.sequence-control:visible').all()) {
        const box = (await control.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
      const target = (await sequence.locator('.sequence-note-target').boundingBox())!;
      expect(target.width).toBeGreaterThanOrEqual(44);
      await sequence.getByRole('button', { name: 'Ausgewählte Note löschen' }).tap();
      await expect(sequence.locator('.sequence-scroll .staff-note')).toHaveCount(0);
      await expect(sequence.locator('.sequence-editor')).toBeVisible();
      await sequence.getByRole('button', { name: 'Rückgängig' }).tap();
      await expect(sequence.locator('.sequence-scroll .staff-note')).toHaveCount(1);
      await sequence.getByRole('button', { name: 'Note bearbeiten', exact: true }).tap();
      await page.getByRole('button', { name: 'Tonfolge', exact: true }).tap();
      await page.locator('.piano-key[data-midi="55"]').tap();
      await page.getByRole('button', { name: 'Tonfolge', exact: true }).tap();
      await expect(sequence.locator('.sequence-editor')).toBeHidden();
      await expect(sequence.locator('.sequence-scroll .staff-note')).toHaveCount(2);
    } finally {
      await context.close();
    }
  }
});

test('sequence replay honors dotted whole, dotted eighth, and sixteenth durations without recording', async ({
  page,
}) => {
  await recordAudioPlayback(page);
  await page.goto('/');
  for (const pitch of [48, 50, 52]) {
    await page.locator(`.piano-key[data-midi="${pitch}"]`).click();
    await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  }
  await page.getByRole('button', { name: 'Tonfolge', exact: true }).click();
  const sequence = page.locator('#pitch-sequence');
  await sequence.getByRole('button', { name: 'Tonfolge bearbeiten', exact: true }).click();
  const notes = sequence.locator('.sequence-scroll .staff-note');
  await notes.nth(0).click();
  await sequence.getByRole('button', { name: 'Ganze (1/1)', exact: true }).click();
  await sequence.getByRole('button', { name: 'Punktierung', exact: true }).click();
  await notes.nth(1).click();
  await sequence.getByRole('button', { name: 'Achtel (1/8)', exact: true }).click();
  await sequence.getByRole('button', { name: 'Punktierung', exact: true }).click();
  await notes.nth(2).click();
  await sequence.getByRole('button', { name: 'Sechzehntel (1/16)', exact: true }).click();
  await notes.nth(0).click();
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await sequence.getByRole('button', { name: 'Tonfolge abspielen' }).click();
  await expect(notes.nth(0)).toHaveClass(/playing/);
  await page.clock.runFor(2999);
  await expect(notes.nth(0)).toHaveClass(/playing/);
  await page.clock.runFor(1);
  await expect(notes.nth(1)).toHaveClass(/playing/);
  await page.clock.runFor(374);
  await expect(notes.nth(1)).toHaveClass(/playing/);
  await page.clock.runFor(1);
  await expect(notes.nth(2)).toHaveClass(/playing/);
  await page.clock.runFor(124);
  await expect(notes.nth(2)).toHaveClass(/playing/);
  await page.clock.runFor(1);
  await expect(page.locator('#audio-status')).toHaveText('Tonfolge abgespielt');
  await expect(notes).toHaveCount(3);
  await expect(page.locator('html')).toHaveAttribute('data-audio-starts', '10');
});

test('sequence replay keeps every pitch view in sync, honors tempo, and never records itself', async ({
  page,
}) => {
  await recordAudioPlayback(page);
  await page.goto('/');
  for (const pitch of [50, 54, 54, 43]) {
    await page.locator(`.piano-key[data-midi="${pitch}"]`).click();
    await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  }
  await page.getByRole('button', { name: 'Tonfolge', exact: true }).click();
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByRole('tab', { name: 'Klang' }).click();
  const tempo = page.getByRole('slider', { name: 'Tonfolge-Tempo' });
  await expect(tempo).toHaveValue('120');
  await tempo.fill('40');
  await expect(page.locator('#replay-tempo-value')).toHaveText('40 BPM');
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.getByRole('button', { name: 'Tonfolge abspielen' }).click();
  await page.getByRole('button', { name: 'Noten öffnen' }).click();
  const notes = page.locator('.sequence-scroll .staff-note');
  const checkPitch = async (index: number, pitch: number): Promise<void> => {
    await expect(notes.nth(index)).toHaveClass(/playing/);
    await expect(page.locator('.piano-key.selected')).toHaveAttribute('data-midi', String(pitch));
    await expect(page.locator('#staff .staff-note')).toHaveAttribute('data-midi', String(pitch));
    await expect(page.locator('#compact-staff .staff-note')).toHaveAttribute(
      'data-midi',
      String(pitch),
    );
    expect(
      await page
        .locator('.note.selected')
        .evaluateAll((notes) => notes.map((note) => Number((note as HTMLElement).dataset.midi))),
    ).toEqual(Array(await page.locator('.note.selected').count()).fill(pitch));
    await expect(page.locator('.note.selected').first()).toBeAttached();
    await expect(page.locator('html')).toHaveAttribute('data-audio-starts', String(5 + index));
    await expect(notes).toHaveCount(4);
  };
  await checkPitch(0, 50);
  await page.clock.runFor(1499);
  await checkPitch(0, 50);
  await page.clock.runFor(1);
  await checkPitch(1, 54);
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await tempo.fill('240');
  await expect(page.locator('#replay-tempo-value')).toHaveText('240 BPM');
  await page.getByRole('button', { name: 'Noten öffnen' }).click();
  await page.clock.runFor(1500);
  await checkPitch(2, 54);
  await page.clock.runFor(249);
  await checkPitch(2, 54);
  await page.clock.runFor(1);
  await checkPitch(3, 43);
  await page.clock.runFor(250);
  await expect(page.locator('#audio-status')).toHaveText('Tonfolge abgespielt');
  await expect(page.locator('.staff-note.playing')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tonfolge abspielen' })).toBeEnabled();

  // Stop, manual playing, and confirmed clearing must invalidate all future beats.
  await page.getByRole('button', { name: 'Noten schließen' }).click();
  await page.getByRole('button', { name: 'Tonfolge abspielen' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-audio-starts', '9');
  await page.getByRole('button', { name: 'Tonfolge stoppen' }).click();
  await page.clock.runFor(2000);
  await expect(page.locator('html')).toHaveAttribute('data-audio-starts', '9');
  await expect(notes).toHaveCount(4);
  await page.getByRole('button', { name: 'Tonfolge abspielen' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-audio-starts', '10');
  await page.locator('.piano-key[data-midi="57"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-audio-starts', '11');
  await page.clock.runFor(2000);
  await expect(page.locator('html')).toHaveAttribute('data-audio-starts', '11');
  await expect(notes).toHaveCount(5);
  await expect(page.locator('.staff-note.playing')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tonfolge abspielen' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-audio-starts', '12');
  await page.getByRole('button', { name: 'Tonfolge leeren' }).click();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(notes).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Tonfolge stoppen' })).toBeVisible();
  await page.getByRole('button', { name: 'Tonfolge leeren' }).click();
  await page.getByRole('button', { name: 'Ja, leeren' }).click();
  await page.clock.runFor(2000);
  await expect(page.locator('html')).toHaveAttribute('data-audio-starts', '12');
  await expect(notes).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tonfolge abspielen' })).toBeDisabled();
});

test('clearing while sequence samples load cannot start stale replay after the load finishes', async ({
  page,
}) => {
  await recordAudioPlayback(page);
  const gate = deferred();
  await page.route('**/audio/43.mp3', async (route) => {
    const response = await route.fetch();
    await gate.promise;
    await route.fulfill({ response });
  });
  await page.goto('/');
  await page.locator('.piano-key[data-midi="43"]').click();
  await page.locator('.piano-key[data-midi="50"]').click();
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  await page.getByRole('button', { name: 'Tonfolge', exact: true }).click();
  await page.getByRole('button', { name: 'Tonfolge abspielen' }).click();
  await expect(page.locator('#audio-status')).toHaveText('Tonfolge wird geladen …');
  await page.getByRole('button', { name: 'Tonfolge leeren' }).click();
  await page.getByRole('button', { name: 'Ja, leeren' }).click();
  gate.resolve();
  await expect(page.locator('html')).toHaveAttribute('data-audio-decodes', '2');
  await expect(page.locator('html')).toHaveAttribute('data-audio-starts', '1');
  await expect(page.locator('.sequence-scroll .staff-note')).toHaveCount(0);
  await expect(page.locator('#audio-status')).toHaveText('Wiedergabe gestoppt');
});

test('corner notation can be moved and stays within the board after resizing', async ({ page }) => {
  await page.goto('/');
  const widget = page.locator('#notation-display');
  const initial = (await widget.boundingBox())!;
  expect(initial.height).toBe(130);
  const notationScale = () =>
    page.locator('#compact-staff').evaluate((svg) => {
      const matrix = (svg as SVGSVGElement).getScreenCTM()!;
      return [matrix.a, matrix.d];
    });
  const collapsedScale = await notationScale();
  await page.locator('#notation-size-toggle').click();
  expect((await widget.boundingBox())!.height).toBe(220);
  expect(await notationScale()).toEqual(collapsedScale);
  await page.locator('#notation-size-toggle').click();
  expect((await widget.boundingBox())!.height).toBe(130);
  await page.mouse.move(initial.x + 60, initial.y + 100);
  await page.mouse.down();
  await page.mouse.move(initial.x + 360, initial.y + 200);
  await page.mouse.up();
  const moved = (await widget.boundingBox())!;
  expect(moved.x - initial.x).toBeCloseTo(300);
  expect(moved.y - initial.y).toBeCloseTo(100);
  await widget.focus();
  await page.keyboard.press('ArrowRight');
  expect((await widget.boundingBox())!.x - moved.x).toBeCloseTo(10);
  await page.setViewportSize({ width: 375, height: 500 });
  await expect(async () => {
    const bounds = (await widget.boundingBox())!;
    const canvas = (await page.locator('.board-scroll-wrap').boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(canvas.x);
    expect(bounds.y).toBeGreaterThanOrEqual(canvas.y);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(canvas.x + canvas.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(canvas.y + canvas.height);
  }).toPass();
});

test('position switches keep second and third position variants independent', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#position-controls [role="switch"]')).toHaveCount(6);
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByRole('switch', { name: '2. Lage oben', exact: true }).check();
  await expect(page.locator('.position-overlay[data-position="2"]')).toHaveCount(2);
  await expect(page.locator('.position-overlay[data-position="3"]')).toHaveCount(1);
  await page.getByRole('switch', { name: '3. Lage unten', exact: true }).uncheck();
  await expect(page.locator('.position-overlay[data-position="3"]')).toHaveCount(0);
  await expect(page.locator('.position-overlay[data-position="2"]')).toHaveCount(2);
  await page.getByRole('switch', { name: '2. Lage unten', exact: true }).uncheck();
  await page.getByRole('switch', { name: '2. Lage oben', exact: true }).uncheck();
  await expect(page.locator('.position-overlay[data-position="2"]')).toHaveCount(0);
  await page.getByRole('switch', { name: '2. Lage unten', exact: true }).check();
  await page.getByRole('switch', { name: '2. Lage oben', exact: true }).check();
  await expect(page.locator('.position-overlay[data-position="2"]')).toHaveCount(2);
});
