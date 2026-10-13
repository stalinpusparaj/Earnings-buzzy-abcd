import { expect, startGame, test } from './fixtures';

// 2× screens, so each tier's pixel ratio is visible (high 2, mid 1.5, low 1).
test.use({ deviceScaleFactor: 2 });

test('sustained slow frames step quality down one tier at a time, and never back up', async ({ page }) => {
  const steps: string[] = [];
  page.on('console', (m) => {
    if (m.text().startsWith('[quality]')) steps.push(m.text());
  });
  await startGame(page);
  // Let the boot probe finish, then start from a known tier.
  await page.waitForFunction(() => window.__buzzy.governor.phase === 'watch', undefined, { timeout: 30_000 });
  await page.evaluate(() => window.__buzzy.setTier('high'));
  steps.length = 0;
  expect(await page.evaluate(() => window.__buzzy.quality())).toMatchObject({ tier: 'high', dpr: 2, particles: 200 });

  // Burn 60 ms per frame (~16 fps, well under the 25 fps line).
  await page.evaluate(() => {
    window.T.stopSlow = window.__buzzy.loop.add(() => {
      const t = performance.now();
      while (performance.now() - t < 60) {
        /* busy */
      }
    });
  });
  await page.waitForFunction(() => window.__buzzy.quality().tier === 'mid', undefined, { timeout: 20_000 });
  expect(await page.evaluate(() => window.__buzzy.quality())).toMatchObject({ tier: 'mid', dpr: 1.5 });
  const midAt = Date.now();
  await page.waitForFunction(() => window.__buzzy.quality().tier === 'low', undefined, { timeout: 20_000 });
  // A fresh 3 s window is needed between steps.
  expect(Date.now() - midAt).toBeGreaterThan(2500);
  expect(await page.evaluate(() => window.__buzzy.quality())).toMatchObject({ tier: 'low', dpr: 1, particles: 100 });
  expect(await page.evaluate(() => window.__buzzy.garden.flowers.count)).toBeLessThan(await page.evaluate(() => window.__buzzy.garden.flowerTotal));
  expect(steps).toEqual([expect.stringMatching(/sustained slow frames.*→ mid$/), expect.stringMatching(/sustained slow frames.*→ low$/)]);

  // Load removed: the game keeps playing on the low tier (quality never flickers back up).
  await page.evaluate(() => window.T.stopSlow());
  const r = await page.evaluate(() => window.T.playLetter(0));
  expect(r.id).toBe('A');
  expect(await page.evaluate(() => window.__buzzy.quality().tier)).toBe('low');
});

test('a short hitch does not change the tier', async ({ page }) => {
  await startGame(page);
  await page.waitForFunction(() => window.__buzzy.governor.phase === 'watch', undefined, { timeout: 30_000 });
  await page.evaluate(() => window.__buzzy.setTier('high'));
  // One 400 ms stall (like a shader compile), then normal frames.
  await page.evaluate(() => {
    const t = performance.now();
    while (performance.now() - t < 400) {
      /* busy */
    }
  });
  await page.waitForTimeout(4000);
  expect(await page.evaluate(() => window.__buzzy.quality().tier)).toBe('high');
});
