import { expect, test } from '@playwright/test';

for (const backend of ['recordings', 'soundfont']) {
  test(`${backend} releases naturally during a rest and resumes on the next note`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // Tap the actual output from both audio engines without replacing their playback.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (
        this: AudioNode,
        ...args: Parameters<AudioNode['connect']>
      ) {
        if (Object.is(args[0], this.context.destination)) {
          const analyser = this.context.createAnalyser();
          Reflect.apply(connect, this, [analyser]);
          const samples = new Float32Array(analyser.fftSize);
          setInterval(() => {
            analyser.getFloatTimeDomainData(samples);
            const peak = Math.max(...samples.map(Math.abs));
            document.documentElement.dataset.audioPeak = String(peak);
            document.documentElement.dataset.audioMax = String(
              Math.max(peak, Number(document.documentElement.dataset.audioMax ?? 0)),
            );
            if (peak > 0.0001) {
              document.documentElement.dataset.lastAudio = String(performance.now());
            }
          }, 10);
        }
        return Reflect.apply(connect, this, args);
      } as AudioNode['connect'];
    });
    await page.goto('/#tonfolge=celloh:v2,measure=0/0,C3/8,R/2,D3/2');
    await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
    if ((await page.locator('#sound-settings').getAttribute('open')) === null)
      await page.locator('#sound-settings > summary').click();
    await page.locator('#audio-backend').selectOption(backend);
    await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
    const sequence = page.locator('#pitch-sequence');
    await sequence.getByRole('button', { name: 'Tonfolge abspielen', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-last-audio', /\d/);
    await expect(sequence.locator('.staff-note').nth(1)).toHaveAttribute('aria-pressed', 'true');
    // Resonance may remain audible, but the bowed note must stop sustaining.
    await page.waitForTimeout(350);
    const earlyTail = await page.evaluate(() => ({
      peak: Number(document.documentElement.dataset.audioPeak),
      maximum: Number(document.documentElement.dataset.audioMax),
    }));
    expect(earlyTail.maximum).toBeGreaterThan(0.0001);
    expect(earlyTail.peak).toBeLessThan(earlyTail.maximum * 0.5);
    await page.waitForTimeout(300);
    const lateTail = await page.evaluate(() => Number(document.documentElement.dataset.audioPeak));
    expect(lateTail).toBeLessThan(Math.max(0.0001, earlyTail.peak * 0.8));
    await expect(sequence.locator('.staff-note').nth(1)).toHaveAttribute('aria-pressed', 'true');
    const restTime = await page.evaluate(() => performance.now());
    await expect
      .poll(async () => Number(await page.locator('html').getAttribute('data-last-audio')))
      .toBeGreaterThan(restTime);
    await expect(sequence.locator('.staff-note').nth(2)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#audio-status')).toHaveText('Tonfolge abgespielt');
  });
}
