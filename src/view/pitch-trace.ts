/** One second of accepted cents measurements; rejected frames break the trace. */
export class PitchTrace {
  private readonly samples: { time: number; cents: number | null }[] = [];
  readonly durationMs = 1000;
  clear(): void {
    this.samples.length = 0;
  }
  add(time: number, cents: number | null): void {
    this.samples.push({ time, cents });
    this.prune(time);
  }
  private prune(now: number): void {
    while (this.samples[0] && this.samples[0].time < now - this.durationMs) this.samples.shift();
  }
  path(now: number): string {
    this.prune(now);
    let path = '';
    let previousTime: number | null = null;
    for (const sample of this.samples) {
      if (sample.cents === null) {
        previousTime = null;
        continue;
      }
      const x = 14 + 58 * (1 - (now - sample.time) / this.durationMs);
      const y = 22 - Math.max(-50, Math.min(50, sample.cents)) * 0.4;
      const command = previousTime === null || sample.time - previousTime > 120 ? 'M' : 'L';
      path += `${command}${x.toFixed(2)} ${y.toFixed(2)}`;
      previousTime = sample.time;
    }
    return path;
  }
}
