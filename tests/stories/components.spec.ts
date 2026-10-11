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

test('pitch sequence replay highlighting and stop work without the app or audio', async ({
  page,
}) => {
  await page.goto('/iframe.html?id=components-pitch-sequence--long-history&viewMode=story');
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.getByRole('button', { name: 'Tonfolge abspielen' }).click();
  await expect(page.locator('.staff-note.playing')).toHaveAttribute('data-midi', '48');
  await expect(page.locator('.staff-note.playing')).toBeInViewport({ ratio: 1 });
  await page.clock.runFor(9000);
  await expect(page.locator('.staff-note.playing')).toHaveAttribute('data-midi', '54');
  await expect(page.locator('.staff-note.playing')).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.staff-note')).toHaveCount(40);
  await page.getByRole('button', { name: 'Tonfolge stoppen' }).click();
  await page.clock.runFor(1000);
  await expect(page.locator('.staff-note.playing')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tonfolge abspielen' })).toBeEnabled();
});

test('pitch sequence uses the key signature and cancels/restores alterations per octave', async ({
  page,
}) => {
  for (const [story, label, signs] of [
    ['sharp-key', 'D-Dur: Fis3, F3, F3, Fis3, Fis4, F4, Fis4', ['', '♮', '', '♯', '', '♮', '♯']],
    ['flat-key', 'Es-Dur: Es3, E3, E3, Es3, B3, H3, B3', ['', '♮', '', '♭', '', '♮', '♭']],
  ] as const) {
    await page.goto(`/iframe.html?id=components-pitch-sequence--${story}&viewMode=story`);
    await expect(page.locator('.sequence-scroll svg')).toHaveAccessibleName(label);
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
