import { describe, expect, it } from 'vitest';
import { TraceState, pointAt, project, strokeLength, type Stroke } from '../../src/minigames/traceMath';

const line: Stroke = [
  [0, 0],
  [1, 0],
];
const A: Stroke[] = [
  [
    [0.5, 0.95],
    [0.08, 0.05],
  ],
  [
    [0.5, 0.95],
    [0.92, 0.05],
  ],
  [
    [0.25, 0.4],
    [0.75, 0.4],
  ],
];

/** Walk a stroke from start to end in small steps, feeding every point. */
function walk(state: TraceState, s: Stroke, steps = 40) {
  const len = strokeLength(s);
  const events = [];
  for (let i = 0; i <= steps; i++) events.push(state.feed(pointAt(s, (len * i) / steps)));
  return events;
}

describe('geometry', () => {
  it('measures and samples polylines', () => {
    expect(strokeLength(line)).toBeCloseTo(1);
    expect(pointAt(line, 0.25)).toEqual([0.25, 0]);
    expect(pointAt(line, 5)).toEqual([1, 0]);
  });

  it('projects a point onto the nearest segment', () => {
    const p = project(line, [0.4, 0.1]);
    expect(p.along).toBeCloseTo(0.4);
    expect(p.dist).toBeCloseTo(0.1);
  });
});

describe('TraceState', () => {
  it('advances while the finger is on the path', () => {
    const s = new TraceState([line]);
    expect(s.feed([0.05, 0.02])).toBe('progress');
    expect(s.feed([0.15, 0.0])).toBe('progress');
    expect(s.progress).toBeCloseTo(0.15);
  });

  it('pauses (no progress) when off the path', () => {
    const s = new TraceState([line]);
    s.feed([0.1, 0]);
    expect(s.feed([0.2, 0.5])).toBe('offPath');
    expect(s.progress).toBeCloseTo(0.1);
    expect(s.lastOnPath).toBe(false);
  });

  it('only moves forward', () => {
    const s = new TraceState([line]);
    s.feed([0.1, 0]);
    s.feed([0.2, 0]);
    expect(s.feed([0.12, 0])).toBe('none');
    expect(s.progress).toBeCloseTo(0.2);
  });

  it('ignores jumps of more than 15% of the stroke (no tapping the end)', () => {
    const s = new TraceState([line]);
    expect(s.feed([0.95, 0])).toBe('none');
    expect(s.progress).toBe(0);
    s.feed([0.1, 0]);
    expect(s.feed([0.3, 0])).toBe('none');
    expect(s.progress).toBeCloseTo(0.1);
  });

  it('enforces stroke order', () => {
    const s = new TraceState(A);
    // Tracing the crossbar first does nothing: it is stroke 3.
    walk(s, A[2]);
    expect(s.strokeIndex).toBe(0);
    expect(s.progress).toBe(0);
  });

  it('completes a stroke at 85% coverage and a letter after all strokes', () => {
    const s = new TraceState(A);
    expect(walk(s, A[0])).toContain('strokeDone');
    expect(s.strokeIndex).toBe(1);
    expect(walk(s, A[1])).toContain('strokeDone');
    const last = walk(s, A[2]);
    expect(last).toContain('letterDone');
    expect(s.done).toBe(true);
    expect(s.feed([0.5, 0.4])).toBe('none');
  });

  it('uses the tighter tolerance for older children', () => {
    const s = new TraceState([line], { tolerance: 0.08, jumpFrac: 0.15, completeFrac: 0.85 });
    expect(s.feed([0.05, 0.1])).toBe('offPath');
    expect(s.feed([0.05, 0.07])).toBe('progress');
  });
});
