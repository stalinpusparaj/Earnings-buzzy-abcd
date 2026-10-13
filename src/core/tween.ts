export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
} satisfies Record<string, Ease>;

type Job = {
  elapsed: number;
  duration: number;
  ease: Ease;
  fn: (k: number) => void;
  resolve: () => void;
};

/** Frame-driven tweens. Paused whenever the loop is paused, so nothing jumps after a background tab. */
export class Tweener {
  private jobs: Job[] = [];

  to(duration: number, fn: (k: number) => void, e: Ease = ease.inOutCubic): Promise<void> {
    return new Promise((resolve) => {
      if (duration <= 0) {
        fn(1);
        resolve();
        return;
      }
      fn(0);
      this.jobs.push({ elapsed: 0, duration, ease: e, fn, resolve });
    });
  }

  wait(seconds: number): Promise<void> {
    return this.to(seconds, () => undefined, ease.linear);
  }

  update(dt: number): void {
    if (this.jobs.length === 0) return;
    const running = this.jobs;
    this.jobs = [];
    for (const job of running) {
      job.elapsed += dt;
      const t = Math.min(1, job.elapsed / job.duration);
      job.fn(job.ease(t));
      if (t >= 1) job.resolve();
      else this.jobs.push(job);
    }
  }

  /** Jump every running tween to its end (used to skip intros and to abort flows). */
  finishAll(): void {
    const running = this.jobs;
    this.jobs = [];
    for (const job of running) {
      job.fn(1);
      job.resolve();
    }
  }
}

export const tweens = new Tweener();
