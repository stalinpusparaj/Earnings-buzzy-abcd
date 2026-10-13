import type { Point2 } from '../core/types';

// Pure tracing rules (brief §5.3). Coordinates are the glyph's 0–1 box, y up.

export type Stroke = readonly Point2[];
export type Projection = { along: number; dist: number; point: Point2 };
export type TraceEvent = 'none' | 'progress' | 'offPath' | 'strokeDone' | 'letterDone';
export type TraceConfig = { tolerance: number; jumpFrac: number; completeFrac: number };

export const TOLERANCE = { little: 0.12, big: 0.08 } as const;
export const defaultTraceConfig: TraceConfig = { tolerance: TOLERANCE.little, jumpFrac: 0.15, completeFrac: 0.85 };

const segLen = (a: Point2, b: Point2) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export function strokeLength(s: Stroke): number {
  let len = 0;
  for (let i = 1; i < s.length; i++) len += segLen(s[i - 1], s[i]);
  return len;
}

/** Point at distance `d` along the stroke (clamped). */
export function pointAt(s: Stroke, d: number): Point2 {
  if (s.length === 1 || d <= 0) return s[0];
  let left = d;
  for (let i = 1; i < s.length; i++) {
    const l = segLen(s[i - 1], s[i]);
    if (left <= l) {
      const t = l === 0 ? 0 : left / l;
      return [s[i - 1][0] + (s[i][0] - s[i - 1][0]) * t, s[i - 1][1] + (s[i][1] - s[i - 1][1]) * t];
    }
    left -= l;
  }
  return s[s.length - 1];
}

/** Every segment's closest point to p, as distance-along and distance-away. */
export function projections(s: Stroke, p: Point2): Projection[] {
  const out: Projection[] = [];
  let acc = 0;
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1];
    const b = s[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
    const point: Point2 = [a[0] + dx * t, a[1] + dy * t];
    out.push({ along: acc + Math.sqrt(l2) * t, dist: Math.hypot(p[0] - point[0], p[1] - point[1]), point });
    acc += Math.sqrt(l2);
  }
  return out;
}

/** Closest projection of p onto the whole stroke. */
export function project(s: Stroke, p: Point2): Projection {
  return projections(s, p).reduce((best, c) => (c.dist < best.dist ? c : best));
}

/**
 * Tracing state for one letter. Progress only moves forward, jumps of more than
 * `jumpFrac` of the stroke are ignored (no tapping the end), off-path input
 * pauses progress, and strokes must be finished in order.
 */
export class TraceState {
  strokeIndex = 0;
  progress = 0;
  done = false;
  lastOnPath = true;

  constructor(
    readonly strokes: readonly Stroke[],
    readonly cfg: TraceConfig = defaultTraceConfig,
  ) {
    if (strokes.length === 0) this.done = true;
  }

  get current(): Stroke {
    return this.strokes[Math.min(this.strokeIndex, this.strokes.length - 1)];
  }

  get length(): number {
    return strokeLength(this.current);
  }

  /** 0–1 coverage of the current stroke. */
  get fraction(): number {
    const len = this.length;
    return len === 0 ? 1 : this.progress / len;
  }

  progressPoint(): Point2 {
    return pointAt(this.current, this.progress);
  }

  feed(p: Point2): TraceEvent {
    if (this.done) return 'none';
    const len = this.length;
    // Among the parts of the stroke within tolerance, follow the one nearest the
    // current progress, so loops and overlaps can't teleport the trail.
    const near = projections(this.current, p).filter((c) => c.dist <= this.cfg.tolerance);
    if (near.length === 0) {
      this.lastOnPath = false;
      return 'offPath';
    }
    this.lastOnPath = true;
    const pick = near.reduce((best, c) => (Math.abs(c.along - this.progress) < Math.abs(best.along - this.progress) ? c : best));
    const step = pick.along - this.progress;
    if (step <= 0 || step > this.cfg.jumpFrac * len) return 'none';
    this.progress = pick.along;
    if (this.progress >= this.cfg.completeFrac * len) {
      this.strokeIndex++;
      this.progress = 0;
      if (this.strokeIndex >= this.strokes.length) {
        this.done = true;
        this.strokeIndex = this.strokes.length - 1;
        this.progress = strokeLength(this.current);
        return 'letterDone';
      }
      return 'strokeDone';
    }
    return 'progress';
  }
}
