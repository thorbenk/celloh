import { test, expect, type Page } from '@playwright/test';

test('notes, spellings, position variants, extensions, and audio', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.note')).toHaveCount(100);
  const firstStep = page.locator('.note[data-string="3"][data-offset="1"]');
  await expect(firstStep).toHaveText('Ais');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.getByRole('button', { name: 'Be ♭', exact: true }).click();
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  await expect(firstStep).toHaveText('B');
  await expect(page.locator('.note[data-string="3"][data-offset="2"]')).toHaveText('H');
  await firstStep.click();
  await expect(page.locator('#selected-note')).toHaveText('B3');
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  await expect(page.locator('#overlays g')).toHaveCount(4);
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.locator('input[data-position="1"]').uncheck();
  await expect(page.locator('#overlays g')).toHaveCount(3);
  await page.locator('#upper').check();
  await expect(page.locator('.position-overlay')).toHaveCount(5);
  await page.locator('#lower').uncheck();
  await expect(page.locator('.position-overlay')).toHaveCount(3);
  await page.locator('#extension').check();
  await expect(page.locator('.extension-text')).toHaveCount(3);
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
    'highlight-toggle',
    'notation-open',
    'settings-open',
    'info-open',
    'help-open',
  ]) {
    const control = page.locator(`#${id}`);
    await expect(control).toBeInViewport({ ratio: 1 });
    const bounds = await control.boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
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
  await page.locator('#upper').check();
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  await expect(page.locator('.position-overlay')).toHaveCount(6);
  await expect(page.locator('.finger-marker')).toHaveCount(24);
  await expect(page.locator('.finger-numbers')).toHaveCount(0);
  await page.screenshot({ path: '/tmp/celloh-all-positions.png', fullPage: true });
});

test('settings slide over the centered board and close with Escape, button, or backdrop', async ({
  page,
}) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/');
    const panel = page.getByRole('dialog', { name: 'Einstellungen' });
    const open = page.getByRole('button', { name: 'Einstellungen öffnen' });
    await expect(panel).not.toBeVisible();
    await expect(page.locator('.intro')).toHaveCount(0);
    const before = await page.locator('.board-card').boundingBox();
    const workspace = await page.locator('.workspace').boundingBox();
    expect(Math.abs(workspace!.x + workspace!.width / 2 - width / 2)).toBeLessThan(2);
    await open.click();
    await expect(panel).toBeVisible();
    expect(await page.locator('.board-card').boundingBox()).toEqual(before);
    await page.locator('#upper').check();
    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
    await expect(open).toBeFocused();
    await open.click();
    await expect(page.locator('#upper')).toBeChecked();
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

test('to-scale spacing preserves cello proportions, declutters notes, and restores equal spacing', async ({
  page,
}) => {
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
    const spread = page.getByRole('slider', { name: 'Spreizung' });
    await expect(spread).not.toBeVisible();
    await page.getByRole('checkbox', { name: 'Wie auf dem Cello' }).check();
    const scaled = await centers();
    const firstGap = scaled[2]! - scaled[1]!;
    expect((scaled[14]! - scaled[13]!) / firstGap).toBeCloseTo(0.5, 2);
    expect((scaled[3]! - scaled[2]!) / firstGap).toBeCloseTo(2 ** (-1 / 12), 2);
    await spread.fill('60');
    const compact = await centers();
    expect((compact[2]! - compact[1]!) / firstGap).toBeCloseTo(0.6, 2);
    await expect(page.locator('#spread-value')).toHaveText('60 %');
    await page.locator('#upper').check();
    await page.locator('#extension').check();
    await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
    const note = page.locator('.note[data-string="0"][data-offset="24"]');
    await expect(note).toHaveText('');
    await expect(note).toHaveAccessibleName('C, Oktave 4, C-Saite, Halbtonschritt 24');
    await note.click();
    await expect(page.locator('#selected-note')).toHaveText('C4');
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
    await expect(spread).toHaveValue('60');
    await spread.fill('180');
    const expanded = await centers();
    expect((expanded[2]! - expanded[1]!) / firstGap).toBeCloseTo(1.8, 2);
    await expect(note).toHaveText('C');
    await expect(note).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('checkbox', { name: 'Wie auf dem Cello' }).uncheck();
    await expect(spread).not.toBeVisible();
    const restored = await centers();
    expect(restored[2]! - restored[1]!).toBeCloseTo(58);
    expect(restored[24]! - restored[23]!).toBeCloseTo(58);
    await expect(note).toHaveText('C');
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
  await page.goto('http://127.0.0.1:4173');
  await page.getByRole('button', { name: 'Noten öffnen' }).tap();
  const point = await staffPoint(page, 12); // A3
  await page.touchscreen.tap(point.x, point.y);
  await expect(page.locator('#selected-note')).toHaveText('A3');
  await expect(page.locator('.note.selected')).toHaveCount(4);
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  await page.screenshot({ path: '/tmp/celloh-note-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Noten schließen' }).tap();
  await expect(page.getByRole('dialog', { name: 'Noten', exact: true })).not.toBeVisible();
  await context.close();
});

test('quick dimming toggle preserves selection and compact notation', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Andere Töne dimmen' });
  const compact = page.locator('#compact-staff');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.note[data-string="1"][data-offset="0"]').click();
  await expect(compact).toHaveAttribute('aria-label', 'G2, Bassschlüssel');
  await expect(compact.locator('.staff-note')).toHaveAttribute('data-midi', '43');
  const unmatched = page.locator('.note[data-midi="36"]').first();
  expect(await unmatched.evaluate((note) => getComputedStyle(note).opacity)).toBe('0.22');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
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
      const head = element.querySelector('.notehead') as SVGEllipseElement;
      const point = element.createSVGPoint();
      point.x = Number(head.getAttribute('cx'));
      point.y = Number(head.getAttribute('cy'));
      const screen = point.matrixTransform(element.getScreenCTM()!);
      const bounds = element.getBoundingClientRect();
      return screen.y > bounds.top + 8 && screen.y < bounds.bottom - 8;
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
  await page.locator('#volume').fill('20');
  gate.resolve();
  await expect(page.locator('html')).toHaveAttribute('data-audio-starts', '1');
  const gain = Number(await page.locator('html').getAttribute('data-audio-gain'));
  expect(gain).toBeCloseTo(0.2);
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
