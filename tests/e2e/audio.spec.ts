import type { Page } from '@playwright/test';
import { clickPlay, expect, startGame, test } from './fixtures';

// iOS silent switch handling, emulated in Chrome. The real switch can only be checked on
// an iPhone/iPad (docs/QA_CHECKLIST.md §1).

const OLD_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1';

/** Fake the tab going to the background / foreground (drives the game loop's pause). */
async function setHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { value: h, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test('iOS 16.4+: the game asks for the playback audio session on the first tap', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'audioSession', { value: { type: 'auto' }, configurable: true });
  });
  await page.goto('./');
  // Nothing changes before the child's first tap.
  await page.waitForFunction(() => window.__buzzy !== undefined);
  expect(await page.evaluate(() => (navigator as unknown as { audioSession: { type: string } }).audioSession.type)).toBe('auto');
  await clickPlay(page);
  await page.waitForFunction(() => window.__buzzy.game.mode === 'garden');
  expect(await page.evaluate(() => (navigator as unknown as { audioSession: { type: string } }).audioSession.type)).toBe('playback');
  expect(await page.evaluate(() => window.__buzzy.audio.session.mode)).toBe('audio-session');
});

test.describe('older iOS without the Audio Session API', () => {
  test.use({ userAgent: OLD_IPHONE });

  test('a silent loop holds playback mode, and pauses while the game is in the background', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'audioSession', { value: undefined, configurable: true });
    });
    await startGame(page);
    const session = () => page.evaluate(() => ({ mode: window.__buzzy.audio.session.mode, playing: window.__buzzy.audio.session.keepAlivePlaying }));
    await expect.poll(session).toEqual({ mode: 'keep-alive', playing: true });
    await setHidden(page, true);
    await expect.poll(session).toEqual({ mode: 'keep-alive', playing: false });
    await setHidden(page, false);
    await expect.poll(session).toEqual({ mode: 'keep-alive', playing: true });
    // The game itself is unaffected.
    const r = await page.evaluate(() => window.T.playLetter(0));
    expect(r.id).toBe('A');
  });
});

test('desktop Chrome: no session tricks', async ({ page }) => {
  await startGame(page);
  const hasApi = await page.evaluate(() => 'audioSession' in navigator);
  expect(await page.evaluate(() => window.__buzzy.audio.session.mode)).toBe(hasApi ? 'audio-session' : 'none');
  expect(await page.evaluate(() => window.__buzzy.audio.session.keepAlivePlaying)).toBe(false);
});
