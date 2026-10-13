import { describe, expect, it } from 'vitest';
import { FrameGovernor, GOVERNOR_DEFAULTS } from '../../src/core/qualityGovernor';
import type { Tier } from '../../src/core/quality';

/** Feed `seconds` worth of frames of `ms` each. */
function run(g: FrameGovernor, ms: number, seconds: number): void {
  const dt = ms / 1000;
  for (let t = 0; t < seconds; t += dt) g.sample(dt);
}

function governor(start: Tier) {
  const steps: { tier: Tier; reason: string }[] = [];
  const g = new FrameGovernor(start, (tier, _avg, reason) => steps.push({ tier, reason }));
  return { g, steps };
}

/** Warm-up + a clean probe, so tests start in the watch phase. */
function pastProbe(g: FrameGovernor): void {
  run(g, 16, GOVERNOR_DEFAULTS.warmupSeconds + GOVERNOR_DEFAULTS.probeSeconds + 0.1);
}

describe('FrameGovernor', () => {
  it('keeps the tier when frames are fast', () => {
    const { g, steps } = governor('high');
    run(g, 16, 60);
    expect(steps).toEqual([]);
    expect(g.tier).toBe('high');
  });

  it('ignores slow frames during the warm-up (shader compiles)', () => {
    const { g, steps } = governor('high');
    run(g, 50, GOVERNOR_DEFAULTS.warmupSeconds - 0.05);
    run(g, 16, 10);
    expect(steps).toEqual([]);
  });

  it('boot probe: a slow average drops one tier', () => {
    const { g, steps } = governor('high');
    run(g, 16, GOVERNOR_DEFAULTS.warmupSeconds);
    run(g, 38, GOVERNOR_DEFAULTS.probeSeconds + 0.1);
    expect(steps).toEqual([{ tier: 'mid', reason: 'probe' }]);
  });

  it('boot probe: a very slow average drops two tiers', () => {
    const { g, steps } = governor('high');
    run(g, 16, GOVERNOR_DEFAULTS.warmupSeconds);
    run(g, 50, GOVERNOR_DEFAULTS.probeSeconds + 0.1);
    expect(steps.map((s) => s.tier)).toEqual(['mid', 'low']);
    expect(g.tier).toBe('low');
  });

  it('drops a tier when frames stay above 40 ms for 3 s', () => {
    const { g, steps } = governor('high');
    pastProbe(g);
    run(g, 45, 2.5);
    expect(steps).toEqual([]);
    run(g, 45, 0.6);
    expect(steps).toEqual([{ tier: 'mid', reason: 'sustained' }]);
  });

  it('a short burst of slow frames does not count', () => {
    const { g, steps } = governor('high');
    pastProbe(g);
    for (let i = 0; i < 5; i++) {
      run(g, 50, 1);
      run(g, 16, 3);
    }
    expect(steps).toEqual([]);
  });

  it('needs a fresh 3 s window before stepping again, and stops at low', () => {
    const { g, steps } = governor('high');
    pastProbe(g);
    run(g, 50, 3.05);
    expect(g.tier).toBe('mid');
    run(g, 50, 2.5);
    expect(g.tier).toBe('mid');
    run(g, 50, 0.6);
    expect(g.tier).toBe('low');
    run(g, 50, 30);
    expect(g.tier).toBe('low');
    expect(steps.length).toBe(2);
  });

  it('ignores zero-length frames (first frame after the tab comes back)', () => {
    const { g, steps } = governor('mid');
    pastProbe(g);
    const before = g.averageMs;
    for (let i = 0; i < 1000; i++) g.sample(0);
    expect(steps).toEqual([]);
    expect(g.averageMs).toBe(before);
  });
});
