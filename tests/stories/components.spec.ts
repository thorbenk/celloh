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
  const header = (await page.locator('.header').boundingBox())!;
  const footer = (await page.locator('.footer').boundingBox())!;
  const board = (await page.locator('.board-scroll').boundingBox())!;
  expect(board.y).toBe(header.y + header.height);
  expect(board.y + board.height).toBe(footer.y);
  expect((await page.locator('#app').boundingBox())?.height).toBe(500);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('piano mounts without other views, keeps physical key geometry, and selects both endpoints', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=components-piano-keyboard--black-key-selection&viewMode=story');
  await expect(page.locator('.piano-key')).toHaveCount(46);
  await expect(page.locator('.piano-key.selected')).toHaveAccessibleName('b, Klaviertaste');
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
  await expect(page.locator('.piano-key.selected')).toHaveAccessibleName('C, Klaviertaste');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.locator('.piano-key.selected')).toHaveAccessibleName('a′′, Klaviertaste');
});

test('short workspace reserves the dock below the board and above the footer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/iframe.html?id=layout-workspace--short-portrait-with-piano&viewMode=story');
  await expect(page.locator('.piano-key')).toHaveCount(46);
  await expect(page.locator('#active-key')).toBeVisible();
  const board = (await page.locator('.board-scroll').boundingBox())!;
  const piano = (await page.locator('.piano-dock').boundingBox())!;
  const footer = (await page.locator('.footer').boundingBox())!;
  expect(board.y + board.height).toBe(piano.y);
  expect(piano.y + piano.height).toBe(footer.y);
  expect((await page.locator('#app').boundingBox())?.height).toBe(500);
});

test('pitch sequence works independently, scrolls on append, and clears to its minimal height', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=components-pitch-sequence--extreme-range&viewMode=story');
  const notes = page.locator('.pitch-sequence .staff-note');
  await expect(notes).toHaveCount(5);
  await expect(
    page.locator('.piano-key, .fingerboard, #staff, #compact-staff, .header'),
  ).toHaveCount(0);
  const svg = page.locator('.sequence-scroll svg');
  const scale = await svg.evaluate((svg) => (svg as SVGSVGElement).getScreenCTM()?.a);
  const height = (await svg.boundingBox())!.height;
  await page.getByRole('button', { name: 'Ton hinzufügen' }).click();
  expect((await svg.boundingBox())!.height).toBe(height);
  expect(await svg.evaluate((svg) => (svg as SVGSVGElement).getScreenCTM()?.a)).toBe(scale);
  await page.getByRole('button', { name: 'Tonfolge leeren' }).click();
  await expect(page.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
  await expect(notes).toHaveCount(6);
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(notes).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Tonfolge leeren' })).toBeFocused();
  await page.getByRole('button', { name: 'Tonfolge leeren' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: 'Tonfolge wirklich leeren?' })).toBeHidden();
  await expect(notes).toHaveCount(6);
  await page.getByRole('button', { name: 'Tonfolge leeren' }).click();
  await page.getByRole('button', { name: 'Ja, leeren' }).click();
  await expect(notes).toHaveCount(0);
  await expect(page.locator('.sequence-scroll')).toBeFocused();
  expect((await svg.boundingBox())!.height).toBeLessThan(height);
  await expect(page.getByRole('button', { name: 'Tonfolge leeren' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Tonfolge abspielen' })).toBeDisabled();
  for (let i = 0; i < 15; i++) await page.getByRole('button', { name: 'Ton hinzufügen' }).click();
  await expect(notes).toHaveCount(15);
  expect(
    await page.locator('.sequence-scroll').evaluate((scroll) => scroll.scrollLeft),
  ).toBeGreaterThan(200);
  await expect(notes.last()).toBeInViewport({ ratio: 1 });
  await page.locator('.sequence-scroll').evaluate((scroll) => {
    scroll.scrollLeft = 0;
  });
  await expect(notes.first()).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Ton hinzufügen' }).click();
  await expect(notes.last()).toBeInViewport({ ratio: 1 });
});

test('pitch sequence shares selection with playback, seeks, and preserves notation after editing', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=components-pitch-sequence--long-history&viewMode=story');
  await expect(page.getByRole('button', { name: 'Zum Anfang', exact: true })).toBeEnabled();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const selected = page.locator('.staff-note.sequence-selected');
  await page.getByRole('button', { name: 'Zum Anfang', exact: true }).click();
  await page.getByRole('button', { name: 'Tonfolge abspielen' }).click();
  await expect(selected).toHaveCount(1);
  await expect(selected).toHaveAttribute('data-midi', '48');
  await page.clock.runFor(9000);
  await expect(selected).toHaveAttribute('data-midi', '54');
  await expect(selected).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Vorherige Note', exact: true }).click();
  await expect(selected).toHaveAttribute('data-midi', '53');
  await expect(page.getByRole('button', { name: 'Tonfolge stoppen' })).toBeEnabled();
  await page.locator('.staff-note').nth(16).click();
  await expect(selected).toHaveAttribute('data-midi', '52');
  await page.clock.runFor(500);
  await expect(selected).toHaveAttribute('data-midi', '53');
  await page.getByRole('button', { name: 'Tonfolge stoppen' }).click();
  await page.clock.runFor(1000);
  await expect(selected).toHaveAttribute('data-midi', '53');
  await page.getByRole('button', { name: 'Tonfolge bearbeiten', exact: true }).click();
  await page.getByRole('button', { name: 'Bearbeiten beenden' }).click();
  await expect(page.locator('.sequence-scroll .vf-clef')).toHaveCount(1);
  await expect(page.locator('.sequence-scroll .vf-stave')).toHaveCount(1);
  await expect(selected).toHaveCount(1);
  await page.getByRole('button', { name: 'Zum Ende', exact: true }).click();
  await page.getByRole('button', { name: 'Tonfolge abspielen' }).click();
  await page.clock.runFor(500);
  await expect(page.getByRole('button', { name: 'Tonfolge abspielen' })).toBeEnabled();
  await expect(page.locator('.staff-note').last()).toHaveClass(/sequence-selected/);
});

test('pitch sequence spells each note independently against the key signature', async ({
  page,
}) => {
  // The unbarred practice strip repeats cancellations; key-signature notes need no restoration.
  for (const [story, label, signs] of [
    ['sharp-key', 'D-Dur: fis, f, f, fis, fis′, f′, fis′', ['', '♮', '♮', '', '', '♮', '']],
    ['flat-key', 'Es-Dur: es, e, e, es, b, h, b', ['', '♮', '♮', '', '', '♮', '']],
  ] as const) {
    await page.goto(`/iframe.html?id=components-pitch-sequence--${story}&viewMode=story`);
    await expect(page.locator('.sequence-scroll svg')).toHaveAccessibleName(label);
    await expect(page.locator('.sequence-scroll .vf-clef')).toHaveCount(1);
    const notes = page.locator('.staff-note');
    await expect(notes).toHaveCount(signs.length);
    await expect(notes.locator('.note-stem path')).toHaveCount(signs.length);
    for (const note of await notes.all()) {
      const stem = note.locator('.note-stem path');
      expect(await stem.evaluate((path) => getComputedStyle(path).stroke)).not.toBe('none');
      const stemBounds = await stem.boundingBox();
      const headBounds = await note.locator('.notehead').boundingBox();
      expect(stemBounds).not.toBeNull();
      expect(headBounds).not.toBeNull();
      if (stemBounds && headBounds) {
        expect(stemBounds.height).toBeGreaterThan(30);
        expect(stemBounds.x).toBeGreaterThanOrEqual(headBounds.x - 1);
        expect(stemBounds.x).toBeLessThanOrEqual(headBounds.x + headBounds.width + 1);
        expect(stemBounds.y).toBeLessThan(headBounds.y + headBounds.height);
        expect(stemBounds.y + stemBounds.height).toBeGreaterThan(headBounds.y);
      }
    }
    const alterations = page.locator('.staff-note .staff-accidental');
    for (const accidental of await alterations.all()) {
      const bounds = await accidental.boundingBox();
      const head = await accidental
        .locator('xpath=ancestor::*[contains(@class, "staff-note")]')
        .locator('.notehead')
        .boundingBox();
      expect(bounds).not.toBeNull();
      expect(head).not.toBeNull();
      if (bounds && head) expect(bounds.x + bounds.width).toBeLessThan(head.x);
    }
    expect(
      await page
        .locator('.staff-note')
        .evaluateAll((notes) =>
          notes.map((note) => note.querySelector('.staff-accidental')?.textContent ?? ''),
        ),
    ).toEqual(signs);
    await expect(page.locator('.key-signature .staff-accidental')).toHaveCount(
      story === 'sharp-key' ? 2 : 3,
    );
  }
  await page.goto('/iframe.html?id=components-pitch-sequence--seven-flats&viewMode=story');
  await expect(page.locator('.key-signature .staff-accidental')).toHaveCount(7);
  // C2 cancels Ces here: the natural extends below the low notehead, unlike its upward stem.
  await expect(page.locator('.staff-note .staff-accidental').first()).toBeInViewport({ ratio: 1 });
});

test('pitch feedback stories show all matching positions with a live trace and no microphone', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=components-pitch-feedback--in-tune&viewMode=story');
  await expect(page.locator('.note.selected')).toHaveCount(3);
  await expect(page.locator('.board-pitch-feedback:visible')).toHaveCount(3);
  await expect(page.locator('.board-pitch-feedback').first()).toHaveAttribute(
    'data-direction',
    'tune',
  );
  await expect(page.locator('.pitch-trace-line').first()).not.toHaveAttribute('d', '');
  await page.goto('/iframe.html?id=components-pitch-feedback--too-low&viewMode=story');
  await expect(page.locator('.board-pitch-feedback').first()).toHaveAttribute(
    'data-direction',
    'low',
  );
  await page.goto('/iframe.html?id=components-pitch-feedback--listening&viewMode=story');
  await expect(page.locator('.board-pitch-feedback').first()).toHaveAttribute(
    'data-direction',
    'neutral',
  );
});

test('compact intonation panel has icon controls and hold time in settings', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/iframe.html?id=layout-workspace--intonation&viewMode=story');
  const mic = page.getByRole('button', { name: 'Mikrofon starten' });
  await expect(mic).toHaveAttribute('aria-pressed', 'false');
  expect((await page.locator('#intonation').boundingBox())!.height).toBeLessThanOrEqual(61);
  await expect(page.locator('.pitch-meter')).toHaveCount(0);
  await expect(page.locator('#intonation input[type="range"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.locator('#intonation-options > summary').click();
  await expect(page.getByRole('slider', { name: 'Haltezeit für Tonerkennung' })).toHaveValue('250');
});
