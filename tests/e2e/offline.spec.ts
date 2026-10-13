import { expect, startGame, test } from './fixtures';

const MODEL_COUNT = 18; // every .glb in public/assets/models

test('after one online visit the game loads and plays offline', async ({ page, context }) => {
  // One full online visit.
  await startGame(page);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, { timeout: 30_000 });
  // The current language loads before play; the other language warms in the background.
  await page.waitForFunction(
    async (n) => {
      const cache = await caches.open('buzzy-packs');
      return (await cache.keys()).filter((r) => r.url.endsWith('.glb')).length >= n;
    },
    MODEL_COUNT,
    { timeout: 60_000, polling: 500 },
  );

  // Airplane mode: the page itself now comes from the service worker.
  await context.setOffline(true);
  await startGame(page);
  const r = await page.evaluate(() => window.T.playLetter(2));
  expect(r.id).toBe('C');

  // The other language's models come from the cache too.
  await page.getByRole('button', { name: 'Language' }).click();
  await page.waitForFunction(() => window.__buzzy.garden.buds[0]?.letter.lang === 'ta' && window.__buzzy.game.mode === 'garden');
  await context.setOffline(false);
});
