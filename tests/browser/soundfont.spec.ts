import { expect, test } from '@playwright/test';

// Observe the real worklet output, rather than substituting a fake synthesizer.
test('experimental engine loads lazily, produces audio, and preserves the selection', async ({
  page,
}) => {
  await page.addInitScript(() => {
    // Keep the native method to invoke it with each original receiver.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (
      this: AudioNode,
      ...args: Parameters<AudioNode['connect']>
    ) {
      if (this instanceof AudioWorkletNode) {
        const analyser = this.context.createAnalyser();
        Reflect.apply(connect, this, [analyser]);
        const samples = new Float32Array(analyser.fftSize);
        setInterval(() => {
          analyser.getFloatTimeDomainData(samples);
          const peak = Math.max(...samples.map(Math.abs));
          if (peak > 0.0001) {
            document.documentElement.dataset.synthAudible = 'true';
            document.documentElement.dataset.synthLastSound = String(performance.now());
          }
        }, 20);
      }
      return Reflect.apply(connect, this, args);
    } as AudioNode['connect'];
  });
  const assets: string[] = [];
  page.on('request', (request) => {
    if (/\.sf2|spessasynth_processor/.test(request.url())) assets.push(request.url());
  });
  await page.goto('/');
  expect(assets).toHaveLength(0);
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.locator('#sound-tab').click();
  await page.locator('#audio-backend').selectOption('soundfont');
  expect(assets).toHaveLength(0);
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  await page.locator('.note[data-string="3"][data-offset="1"]').click();
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  await expect(page.locator('html')).toHaveAttribute('data-synth-audible', 'true');
  expect(assets.some((url) => url.endsWith('cello_solo.sf2'))).toBe(true);
  // A whole note must sustain past the recordings' fixed 1.6-second bow,
  // then transition to an eighth note and finish without recording extra notes.
  await page.locator('.piano-key[data-midi="50"]').click();
  await page.getByRole('button', { name: 'Tonfolge', exact: true }).click();
  const sequence = page.locator('#pitch-sequence');
  await sequence.getByRole('button', { name: 'Tonfolge bearbeiten', exact: true }).click();
  const notes = sequence.locator('.sequence-scroll .staff-note');
  await notes.nth(0).click();
  await sequence.getByRole('button', { name: 'Ganze (1/1)', exact: true }).click();
  await notes.nth(1).click();
  await sequence.getByRole('button', { name: 'Achtel (1/8)', exact: true }).click();
  await notes.nth(0).click();
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  await sequence.getByRole('button', { name: 'Tonfolge abspielen' }).click();
  await expect(notes.nth(0)).toHaveClass(/playing/);
  const started = await page.evaluate(() => performance.now());
  await expect
    .poll(
      async () =>
        Number(await page.locator('html').getAttribute('data-synth-last-sound')) - started,
    )
    .toBeGreaterThan(1700);
  await expect(page.locator('#audio-status')).toHaveText('Tonfolge abgespielt');
  await expect(notes).toHaveCount(2);
  await page.reload();
  await expect(page.locator('#audio-backend')).toHaveValue('soundfont');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.locator('#sound-tab').click();
  await page.locator('#audio-backend').selectOption('recordings');
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  const sample = page.waitForResponse(
    (response) => response.url().includes('/audio/') && response.url().endsWith('.mp3'),
  );
  await page.locator('.note[data-string="3"][data-offset="1"]').click();
  expect((await sample).ok()).toBe(true);
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
});

test('failed SoundFont loading can be retried without silently playing recordings', async ({
  page,
}) => {
  let fail = true;
  let samples = 0;
  await page.route('**/soundfont/cello_solo.sf2', (route) =>
    fail ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.continue(),
  );
  page.on('request', (request) => {
    if (request.url().includes('/audio/')) ++samples;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.locator('#sound-tab').click();
  await page.locator('#audio-backend').selectOption('soundfont');
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  const note = page.locator('.note[data-string="3"][data-offset="1"]');
  await note.click();
  await expect(page.locator('#audio-status')).toContainText('konnte nicht geladen');
  expect(samples).toBe(0);
  fail = false;
  await note.click();
  await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
});

test('articulation overlaps changing pitches, separates repetitions, and persists', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const events: { on: boolean; pitch: number; channel: number; time: number }[] = [];
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const post = MessagePort.prototype.postMessage;
    MessagePort.prototype.postMessage = function (
      this: MessagePort,
      ...args: Parameters<MessagePort['postMessage']>
    ) {
      const message: unknown = args[0];
      if (
        message &&
        typeof message === 'object' &&
        'type' in message &&
        message.type === 'midiMessage' &&
        'data' in message &&
        message.data &&
        typeof message.data === 'object' &&
        'messageData' in message.data
      ) {
        const midi = message.data.messageData;
        if (
          midi instanceof Uint8Array &&
          midi[0] !== undefined &&
          midi[1] !== undefined &&
          ((midi[0] & 0xf0) === 0x90 || (midi[0] & 0xf0) === 0x80)
        ) {
          events.push({
            on: (midi[0] & 0xf0) === 0x90,
            channel: midi[0] & 0xf,
            pitch: midi[1],
            time: performance.now(),
          });
          document.documentElement.dataset.midiEvents = JSON.stringify(events);
        }
      }
      return Reflect.apply(post, this, args);
    } as MessagePort['postMessage'];
    document.addEventListener('clear-midi-events', () => {
      events.length = 0;
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
  await page.locator('#sound-tab').click();
  await page.locator('#audio-backend').selectOption('soundfont');
  await expect(page.locator('#articulation')).toHaveValue('connected');
  await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
  for (const pitch of [48, 50, 50]) {
    await page.locator(`.piano-key[data-midi="${pitch}"]`).click();
    await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
  }
  await page.getByRole('button', { name: 'Tonfolge', exact: true }).click();
  const sequence = page.locator('#pitch-sequence');
  await sequence.getByRole('button', { name: 'Tonfolge bearbeiten', exact: true }).click();
  const notes = sequence.locator('.sequence-scroll .staff-note');
  await notes.nth(1).click();
  await sequence.getByRole('button', { name: 'Achtel (1/8)', exact: true }).click();
  for (const articulation of ['connected', 'detached']) {
    await page.getByRole('button', { name: 'Einstellungen öffnen' }).click();
    await page.locator('#sound-tab').click();
    await page.locator('#articulation').selectOption(articulation);
    await page.getByRole('button', { name: 'Einstellungen schließen' }).click();
    await notes.nth(0).click();
    await expect(page.locator('#audio-status')).toHaveText('Cello-Klang abgespielt');
    await page.evaluate(() => document.dispatchEvent(new Event('clear-midi-events')));
    await sequence.getByRole('button', { name: 'Tonfolge abspielen' }).click();
    await expect(page.locator('#audio-status')).toHaveText('Tonfolge abgespielt');
    const events = await page.evaluate(() => {
      const events = JSON.parse(document.documentElement.dataset.midiEvents ?? '[]') as {
        on: boolean;
        pitch: number;
        channel: number;
        time: number;
      }[];
      return events.slice(events.findIndex((event) => event.on));
    });
    const starts = events.filter((event) => event.on);
    expect(starts.map((event) => event.pitch)).toEqual([48, 50, 50]);
    const firstOff = events.find(
      (event) => !event.on && event.channel === starts[0]!.channel && event.pitch === 48,
    )!;
    const secondOff = events.find(
      (event) => !event.on && event.channel === starts[1]!.channel && event.pitch === 50,
    )!;
    if (articulation === 'connected') expect(firstOff.time).toBeGreaterThan(starts[1]!.time);
    else expect(firstOff.time).toBeLessThan(starts[1]!.time);
    expect(secondOff.time).toBeLessThan(starts[2]!.time);
  }
  await page.reload();
  await expect(page.locator('#articulation')).toHaveValue('detached');
});
