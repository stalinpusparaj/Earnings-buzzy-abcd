import { expect, startGame, test } from './fixtures';

test('the game plays normally when storage throws', async ({ page }) => {
  await page.addInitScript(() => {
    const boom = () => {
      throw new DOMException('storage disabled', 'SecurityError');
    };
    Storage.prototype.getItem = boom;
    Storage.prototype.setItem = boom;
    Storage.prototype.removeItem = boom;
  });
  await startGame(page);
  const r = await page.evaluate(() => window.T.playLetter(0));
  expect(r.id).toBe('A');
  // Progress is kept in memory for the session even though nothing could be saved.
  expect(await page.evaluate(() => window.__buzzy.garden.buds[0].bloomed)).toBe(true);
});

test('the game plays when localStorage itself is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
  });
  await startGame(page);
  const r = await page.evaluate(() => window.T.playLetter(1));
  expect(r.id).toBe('B');
});
