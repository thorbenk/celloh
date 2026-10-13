import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    if (!localStorage.getItem('celloh.settings')) {
      localStorage.setItem(
        'celloh.settings',
        JSON.stringify({ version: 1, values: { 'octave-notation': 'scientific' } }),
      );
    }
  });
});

test('piano dock preserves board geometry and scroll, remembers visibility, and fits short portraits', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Klaviatur', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#piano')).toBeHidden();
  const height = (await page.locator('.board-scroll').boundingBox())!.height;
  await page.locator('.board-scroll').evaluate((board) => {
    board.scrollTop = 300;
    board.scrollLeft = 70;
  });
  const before = await page.locator('.note').first().boundingBox();
  await toggle.click();
  await expect(page.locator('#piano')).toBeVisible();
  expect(height - (await page.locator('.board-scroll').boundingBox())!.height).toBe(88);
  expect(await page.locator('.note').first().boundingBox()).toEqual(before);
  expect(
    await page.locator('.board-scroll').evaluate((board) => [board.scrollTop, board.scrollLeft]),
  ).toEqual([300, 70]);
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByLabel('Tonart', { exact: true }).selectOption({ label: 'Es-Dur' });
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  await page.setViewportSize({ width: 320, height: 500 });
  expect((await page.locator('.board-scroll').boundingBox())!.height).toBe(238);
  await expect(page.locator('#piano')).toBeInViewport({ ratio: 1 });
  await expect(toggle).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const dock = (await page.locator('#piano').boundingBox())!;
  const footer = (await page.locator('.footer').boundingBox())!;
  expect(dock.y + dock.height).toBe(footer.y);
  await toggle.click();
  expect((await page.locator('.board-scroll').boundingBox())!.height).toBe(326);
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('board, piano, and staff share exact pitch, spelling, highlighting, reset, and cello playback', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Klaviatur', exact: true }).click();
  const key = (midi: number) => page.locator(`.piano-key[data-midi="${midi}"]`);
  await page.locator('.note[data-string="2"][data-offset="0"]').click();
  await expect(key(50)).toHaveAttribute('aria-pressed', 'true');
  await expect(key(38)).toHaveAttribute('aria-pressed', 'false');
  expect(await key(50).evaluate((key) => getComputedStyle(key).backgroundColor)).toBe(
    await page
      .locator('.note.selected')
      .first()
      .evaluate((note) => getComputedStyle(note).backgroundColor),
  );
  await key(58).click();
  await expect(page.locator('#compact-staff')).toHaveAttribute('aria-label', 'Ais3, Bassschlüssel');
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  await expect(page.locator('.note.selected')).toHaveCount(4);
  expect(
    await page
      .locator('.note.selected')
      .evaluateAll((notes) => notes.map((note) => (note as HTMLElement).dataset.midi)),
  ).toEqual(['58', '58', '58', '58']);
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByRole('button', { name: 'Be ♭', exact: true }).click();
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  await expect(key(58)).toHaveAccessibleName('B3, Klaviertaste');
  await expect(key(59)).toHaveAccessibleName('H3, Klaviertaste');
  await expect(key(58)).toHaveText('B3');
  await page.getByRole('button', { name: 'Noten öffnen' }).click();
  const panelBounds = (await page.locator('#notation-panel').boundingBox())!;
  expect(panelBounds.y + panelBounds.height).toBe((await page.locator('.footer').boundingBox())!.y);
  await expect(page.getByRole('dialog', { name: 'Noten', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Auflösungszeichen' }).click();
  await expect(key(59)).toHaveAttribute('aria-pressed', 'true');
  await expect(key(58)).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Tonmarkierung aufheben' }).click();
  await expect(page.locator('.piano-key.selected, .note.selected')).toHaveCount(0);
  await page.getByRole('button', { name: 'Noten schließen' }).click();
  await expect(page.getByRole('button', { name: 'Noten öffnen' })).toBeFocused();
  await key(36).focus();
  await page.keyboard.press('ArrowRight');
  await expect(key(37)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#compact-staff')).toHaveAttribute('aria-label', 'Des2, Bassschlüssel');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(key(81)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#compact-staff')).toHaveAttribute('aria-label', 'A5, Bassschlüssel');
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(key(81)).toBeInViewport({ ratio: 1 });
});

test('touch resizing preserves key proportions, resets, and scrolling does not move the fingerboard', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 700 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem(
      'celloh.settings',
      JSON.stringify({ version: 1, values: { 'octave-notation': 'scientific' } }),
    );
  });
  await page.goto('http://127.0.0.1:4173');
  await page.getByRole('button', { name: 'Klaviatur', exact: true }).tap();
  await page.locator('.piano-key[data-midi="37"]').tap();
  await expect(page.locator('#compact-staff')).toHaveAttribute('aria-label', 'Cis2, Bassschlüssel');
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  const dock = (await page.locator('#piano').boundingBox())!;
  const touch = await context.newCDPSession(page);
  const handle = page.getByRole('separator', { name: 'Klaviaturhöhe' });
  const grip = (await handle.boundingBox())!;
  const boardHeight = (await page.locator('.board-scroll').boundingBox())!.height;
  const white = page.locator('.piano-key[data-midi="36"]');
  const black = page.locator('.piano-key[data-midi="37"]');
  const originalWhite = (await white.boundingBox())!;
  const originalBlack = (await black.boundingBox())!;
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }],
  });
  for (const delta of [20, 50, 90]) {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 - delta }],
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(handle).toHaveAttribute('aria-valuenow', '178');
  expect((await page.locator('#piano').boundingBox())!.height).toBe(178);
  expect((await page.locator('.board-scroll').boundingBox())!.height).toBe(boardHeight - 90);
  const enlargedWhite = (await white.boundingBox())!;
  const enlargedBlack = (await black.boundingBox())!;
  expect(enlargedWhite.width / enlargedWhite.height).toBeCloseTo(
    originalWhite.width / originalWhite.height,
    2,
  );
  expect(enlargedBlack.width / enlargedBlack.height).toBeCloseTo(
    originalBlack.width / originalBlack.height,
    2,
  );
  await expect(page.locator('#compact-staff')).toHaveAttribute('aria-label', 'Cis2, Bassschlüssel');
  expect(
    await page.locator('.board-scroll').evaluate((board) => [board.scrollLeft, board.scrollTop]),
  ).toEqual([0, 0]);
  // Chromium suppresses a synthetic tap immediately after the CDP drag gesture.
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Klaviaturhöhe zurücksetzen' }).tap();
  await expect(page.getByRole('button', { name: 'Klaviaturhöhe zurücksetzen' })).toBeHidden();
  expect((await page.locator('#piano').boundingBox())!.height).toBe(88);
  expect((await white.boundingBox())!.width).toBe(originalWhite.width);
  expect((await black.boundingBox())!.width).toBe(originalBlack.width);
  await handle.focus();
  await page.keyboard.press('ArrowUp');
  await expect(handle).toHaveAttribute('aria-valuenow', '104');
  await page.keyboard.press('End');
  await expect(handle).toHaveAttribute('aria-valuenow', '315');
  await page.setViewportSize({ width: 320, height: 500 });
  await expect(handle).toHaveAttribute('aria-valuenow', '225');
  await expect(page.locator('#piano')).toBeInViewport({ ratio: 1 });
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await expect(handle).toHaveAttribute('aria-valuenow', '88');
  await page.setViewportSize({ width: 390, height: 700 });
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 340, y: dock.y + 65 }],
  });
  for (const x of [290, 240, 190, 140, 90]) {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: dock.y + 65 }],
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect
    .poll(() => page.locator('.piano-scroll').evaluate((scroll) => scroll.scrollLeft))
    .toBeGreaterThan(100);
  await expect(page.locator('#compact-staff')).toHaveAttribute('aria-label', 'Cis2, Bassschlüssel');
  expect(
    await page.locator('.board-scroll').evaluate((board) => [board.scrollLeft, board.scrollTop]),
  ).toEqual([0, 0]);
  await page.locator('.note[data-string="3"][data-offset="24"]').tap();
  await expect(page.locator('.piano-key[data-midi="81"]')).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Tonfolge', exact: true }).tap();
  for (let i = 0; i < 15; i++) await page.locator('.piano-key[data-midi="81"]').tap();
  await expect(page.locator('.sequence-scroll .staff-note').last()).toBeInViewport({ ratio: 1 });
  const sequence = (await page.locator('.sequence-scroll').boundingBox())!;
  const endScroll = await page.locator('.sequence-scroll').evaluate((scroll) => scroll.scrollLeft);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 60, y: sequence.y + 40 }],
  });
  for (const x of [110, 160, 210, 260, 310]) {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: sequence.y + 40 }],
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect
    .poll(() => page.locator('.sequence-scroll').evaluate((scroll) => scroll.scrollLeft))
    .toBeLessThan(endScroll - 100);
  await expect(page.locator('.sequence-scroll .staff-note')).toHaveCount(17);
  await context.close();
});

test('optional pitch history records only played notes, follows key changes, and reserves growing dock space', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 500 });
  await page.goto('/');
  const sequence = page.locator('#pitch-sequence');
  const notes = sequence.locator('.staff-note');
  await expect(sequence).toBeHidden();
  await page.locator('.note[data-string="2"][data-offset="0"]').click();
  await page.getByRole('button', { name: 'Tonfolge', exact: true }).click();
  await expect(notes).toHaveCount(1);
  await expect(sequence.locator('svg')).toHaveAccessibleName('C-Dur: D3');
  await expect(page.locator('#piano')).toBeHidden();
  const normalHeight = (await sequence.boundingBox())!.height;
  await page.locator('.board-scroll').evaluate((board) => {
    board.scrollTop = 120;
    board.scrollLeft = 50;
  });
  await page.getByRole('button', { name: 'Klaviatur', exact: true }).click();
  expect(
    await page.locator('.board-scroll').evaluate((board) => [board.scrollTop, board.scrollLeft]),
  ).toEqual([120, 50]);
  for (const pitch of [54, 54, 81, 50, 53, 54, 57])
    await page.locator(`.piano-key[data-midi="${pitch}"]`).click();
  await expect(notes).toHaveCount(8);
  expect((await sequence.boundingBox())!.height).toBeGreaterThan(normalHeight);
  const grownHeight = (await sequence.boundingBox())!.height;
  const pianoBounds = (await page.locator('#piano').boundingBox())!;
  expect((await sequence.boundingBox())!.y + grownHeight).toBe(pianoBounds.y);
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByLabel('Tonart', { exact: true }).selectOption({ label: 'D-Dur' });
  await expect(sequence.locator('svg')).toHaveAccessibleName(
    'D-Dur: D3, Fis3, Fis3, A5, D3, F3, Fis3, A3',
  );
  await expect(notes).toHaveCount(8);
  await expect(notes.last()).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  await page.getByRole('button', { name: 'Noten öffnen' }).click();
  await expect
    .poll(async () => {
      const panel = (await page.locator('#notation-panel').boundingBox())!;
      return panel.y + panel.height - (await page.locator('.footer').boundingBox())!.y;
    })
    .toBe(0);
  await page.locator('#staff').focus();
  await page.keyboard.press('ArrowUp');
  await expect(notes).toHaveCount(8);
  await page.keyboard.press('Enter');
  await expect(notes).toHaveCount(9);
  await page.getByRole('button', { name: 'Be', exact: true }).click();
  await expect(notes).toHaveCount(10);
  await page.getByRole('button', { name: 'Tonmarkierung aufheben' }).click();
  await expect(notes).toHaveCount(10);
  await page.getByRole('button', { name: 'Noten schließen' }).click();
  await page.getByRole('button', { name: 'Tonfolge leeren' }).click();
  await expect(notes).toHaveCount(10);
  await page.getByRole('button', { name: 'Ja, leeren' }).click();
  await expect(notes).toHaveCount(0);
  expect((await sequence.boundingBox())!.height).toBe(normalHeight);
  await page.getByRole('button', { name: 'D-Dur: Tonart aufheben' }).click();
  await expect(sequence.locator('svg')).toHaveAccessibleName('C-Dur: noch keine Töne');
  await page.getByRole('button', { name: 'Tonfolge', exact: true }).click();
  await expect(sequence).toBeHidden();
  await expect(page.locator('#piano')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
