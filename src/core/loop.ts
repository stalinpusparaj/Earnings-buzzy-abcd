import type { WebGLRenderer } from 'three';

export type Updater = (dt: number, time: number) => void;

const MAX_DT = 1 / 20;

/** One animation loop for the whole game. Clamps dt and pauses while the tab is hidden. */
export class Loop {
  private updaters = new Set<Updater>();
  private last = -1;
  private paused = false;
  time = 0;
  onPauseChange: (paused: boolean) => void = () => undefined;

  constructor(
    private renderer: WebGLRenderer,
    private render: () => void,
  ) {}

  add(fn: Updater): () => void {
    this.updaters.add(fn);
    return () => this.updaters.delete(fn);
  }

  start(): void {
    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden;
      this.last = -1;
      this.onPauseChange(this.paused);
    });
    this.renderer.setAnimationLoop((now: number) => {
      if (this.paused) return;
      const dt = this.last < 0 ? 0 : Math.min(MAX_DT, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      for (const fn of this.updaters) fn(dt, this.time);
      this.render();
    });
  }
}
