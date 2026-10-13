import { clickPlay, expect, savedProgress, startGame, test } from './fixtures';

test('Pollen Pop (A): a wrong tap only wobbles, three pops bloom the flower', async ({ page }) => {
  await startGame(page);
  const r = await page.evaluate(() => window.T.playLetter(0));
  expect(r).toMatchObject({ id: 'A', template: 'pollenPop', missesAfterWrong: 1, popped: 3 });
  expect((await savedProgress(page))?.bloomed).toContain('A');
});

test('Trace the Trail (B): cheat taps and off-path drags are ignored, strokes complete in order', async ({ page }) => {
  await startGame(page);
  const r = await page.evaluate(() => window.T.playLetter(1));
  expect(r).toMatchObject({ id: 'B', template: 'traceTrail', progressAfterCheat: 0, onPathAfterOff: false, done: true });
  expect((await savedProgress(page))?.bloomed).toContain('B');
});

test('Basket Match (C): a wrong drop bounces back, two rounds bloom the flower', async ({ page }) => {
  await startGame(page);
  const r = await page.evaluate(() => window.T.playLetter(2));
  expect(r).toMatchObject({ id: 'C', template: 'basketMatch', misses: 1 });
  expect((await savedProgress(page))?.bloomed).toContain('C');
});

test('Tamil: the language toggle swaps in அ–ஊ and a Tamil letter plays', async ({ page }) => {
  await startGame(page);
  await page.getByRole('button', { name: 'Language' }).click();
  await page.waitForFunction(() => window.__buzzy.garden.buds[0]?.letter.lang === 'ta' && window.__buzzy.game.mode === 'garden');
  const glyphs = await page.evaluate(() => window.__buzzy.garden.buds.map((b: { letter: { glyph: string } }) => b.letter.glyph).join(''));
  expect(glyphs).toBe('அஆஇஈஉஊ');
  const r = await page.evaluate(() => window.T.playLetter(0));
  expect(r).toMatchObject({ id: 'ta_a', template: 'pollenPop', popped: 3 });
  expect(await savedProgress(page)).toMatchObject({ lang: 'ta', bloomed: ['ta_a'] });
});

test('Home abandons a letter without penalty', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.T.tapBud(3));
  await page.evaluate(() => window.T.waitMini('pollenPop'));
  await page.getByRole('button', { name: 'Home' }).click();
  await page.waitForFunction(() => window.__buzzy.game.mode === 'garden');
  const state = await page.evaluate(() => ({ mini: window.__buzzy.game.mini, bloomed: window.__buzzy.garden.buds[3].bloomed }));
  expect(state).toEqual({ mini: null, bloomed: false });
  // Nothing is locked: the same bud can be played straight away.
  const r = await page.evaluate(() => window.T.playLetter(3));
  expect(r.id).toBe('D');
});

test('progress survives a reload', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.T.playLetter(0));
  await page.reload();
  await clickPlay(page);
  await page.waitForFunction(() => window.__buzzy?.game.mode === 'garden');
  const bloomed = await page.evaluate(() => window.__buzzy.garden.buds.map((b: { bloomed: boolean }) => b.bloomed));
  expect(bloomed).toEqual([true, false, false, false, false, false]);
});
