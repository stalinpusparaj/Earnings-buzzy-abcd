// Picks a render tier once at boot. Low-end first (P9): small DPR, fewer particles.
export type Quality = { tier: 'low' | 'mid' | 'high'; dpr: number; maxParticles: number; reducedMotion: boolean };

export function pickQuality(): Quality {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency || 4;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const deviceDpr = window.devicePixelRatio || 1;
  let tier: Quality['tier'] = 'mid';
  if ((memory !== undefined && memory <= 2) || cores <= 2) tier = 'low';
  else if (memory !== undefined && memory >= 8 && cores >= 8) tier = 'high';
  const dpr = tier === 'low' ? 1 : Math.min(deviceDpr, tier === 'high' ? 2 : 1.5);
  const maxParticles = reducedMotion ? 60 : tier === 'low' ? 100 : 200;
  return { tier, dpr, maxParticles, reducedMotion };
}
