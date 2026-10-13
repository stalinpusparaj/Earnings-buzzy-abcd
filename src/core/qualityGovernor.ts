import { lowerTier, type Tier } from './quality';

// Frame-time rules for automatic quality step-down (brief §7.3). Pure logic: it is fed
// one frame time per frame and calls onStep when the tier should drop. Never steps up,
// so a child never sees quality flicker back and forth.

export type GovernorConfig = {
  warmupSeconds: number; // ignore shader-compile hitches right after boot
  probeSeconds: number; // the boot probe ("2-second frame-time probe on the loading screen")
  probeLimitMs: number; // probe average above this → one tier down
  probeSevereMs: number; // probe average above this → two tiers down
  windowSeconds: number; // "average frame time stays above 40 ms for 3 s"
  limitMs: number;
};

export const GOVERNOR_DEFAULTS: GovernorConfig = {
  warmupSeconds: 0.5,
  probeSeconds: 2,
  probeLimitMs: 33,
  probeSevereMs: 45,
  windowSeconds: 3,
  limitMs: 40,
};

export type StepReason = 'probe' | 'sustained';

export class FrameGovernor {
  private elapsed = 0;
  private phase: 'warmup' | 'probe' | 'watch' = 'warmup';
  private times: number[] = [];
  private sum = 0;

  constructor(
    public tier: Tier,
    private onStep: (tier: Tier, avgMs: number, reason: StepReason) => void,
    private cfg: GovernorConfig = GOVERNOR_DEFAULTS,
  ) {}

  get averageMs(): number {
    return this.times.length ? (this.sum / this.times.length) * 1000 : 0;
  }

  /** Feed one frame's duration in seconds. Zero (first frame after a pause) is ignored. */
  sample(dt: number): void {
    if (!(dt > 0)) return;
    this.elapsed += dt;
    if (this.phase === 'warmup') {
      if (this.elapsed >= this.cfg.warmupSeconds) this.phase = 'probe';
      return;
    }
    this.times.push(dt);
    this.sum += dt;

    if (this.phase === 'probe') {
      if (this.sum < this.cfg.probeSeconds) return;
      const avg = this.averageMs;
      const steps = avg > this.cfg.probeSevereMs ? 2 : avg > this.cfg.probeLimitMs ? 1 : 0;
      for (let i = 0; i < steps; i++) this.step(avg, 'probe');
      this.phase = 'watch';
      this.reset();
      return;
    }

    // Rolling window covering the last windowSeconds of frames.
    while (this.times.length > 1 && this.sum - this.times[0] >= this.cfg.windowSeconds) this.sum -= this.times.shift()!;
    if (this.sum >= this.cfg.windowSeconds && this.averageMs > this.cfg.limitMs) {
      this.step(this.averageMs, 'sustained');
      this.reset(); // a fresh full window is needed before the next step (built-in cooldown)
    }
  }

  private step(avgMs: number, reason: StepReason): void {
    const next = lowerTier(this.tier);
    if (!next) return;
    this.tier = next;
    this.onStep(next, avgMs, reason);
  }

  private reset(): void {
    this.times = [];
    this.sum = 0;
  }
}
