// Render quality tiers (brief §7.3). Low-end first (P9). A tier is picked at boot from
// device hints, refined by a frame-time probe, and stepped down at runtime when frames
// stay slow (see qualityGovernor.ts). No tier uses shadow maps: blob decals everywhere
// keep the garden within its 80 draw-call budget.
export type Tier = 'low' | 'mid' | 'high';

type TierSpec = { dpr: number; particles: number; decor: number };
export const TIERS: Record<Tier, TierSpec> = {
  low: { dpr: 1, particles: 100, decor: 0.4 }, // decor = share of decorative flowers drawn
  mid: { dpr: 1.5, particles: 200, decor: 1 },
  high: { dpr: 2, particles: 200, decor: 1 },
};

export type Quality = { tier: Tier; dpr: number; maxParticles: number; decor: number; reducedMotion: boolean };

const ORDER: Tier[] = ['low', 'mid', 'high'];

/** The next tier down, or null at the bottom. */
export function lowerTier(tier: Tier): Tier | null {
  const i = ORDER.indexOf(tier);
  return i > 0 ? ORDER[i - 1] : null;
}

export function settingsFor(tier: Tier, reducedMotion: boolean, deviceDpr = window.devicePixelRatio || 1): Quality {
  const spec = TIERS[tier];
  return {
    tier,
    dpr: Math.max(1, Math.min(deviceDpr, spec.dpr)),
    maxParticles: reducedMotion ? Math.min(60, spec.particles) : spec.particles,
    decor: spec.decor,
    reducedMotion,
  };
}

/** Starting tier from device hints (deviceMemory is Chrome-only; cores everywhere). */
export function pickQuality(): Quality {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency || 4;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let tier: Tier = 'mid';
  if ((memory !== undefined && memory <= 2) || cores <= 2) tier = 'low';
  else if (memory !== undefined && memory >= 8 && cores >= 8) tier = 'high';
  return settingsFor(tier, reducedMotion);
}
