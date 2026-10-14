import type { Page } from '@playwright/test';
import { dummySongUrl } from './audioFixtures';
import { expect, startGame, test } from './fixtures';

// Song sing-along (brief §5.6): the gazebo plays the language's song; each cue makes its bud
// react within 50 ms; music holds during the song; Home and backgrounding behave.

const CUES = ['A', 'B', 'C', 'D', 'E', 'F'].map((id, i) => ({ id, t: 1 + i * 1.5 }));
type SingState = { mode: string; playing: boolean; held: boolean; log: { id: string; t: number; at: number }[] };

const sing = (page: Page) =>
  page.evaluate(() => ({ mode: window.__buzzy.game.mode, playing: window.__buzzy.audio.songPlaying, held: window.__buzzy.audio.musicIsHeld, log: [...window.__buzzy.game.singLog] }) as SingState);

async function setSong(page: Page, seconds: number | null): Promise<void> {
  const url = seconds === null ? null : dummySongUrl(seconds);
  await page.evaluate(([u, cues]) => window.__buzzy.setSong('en', u, cues), [url, CUES] as const);
}

const tapGazebo = (page: Page) => page.evaluate(() => window.T.tapObj(window.__buzzy.garden.gazeboCollider));

async function setHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { value: h, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

test('plays the song, fires every cue within 50 ms, holds the music, and returns to the garden', async ({ page }) => {
  await startGame(page);
  await setSong(page, 10);
  await tapGazebo(page);
  await expect.poll(() => sing(page), { timeout: 20_000 }).toMatchObject({ mode: 'sing', playing: true, held: true });
  await expect.poll(async () => (await sing(page)).log.length, { timeout: 20_000 }).toBe(6);
  const { log } = await sing(page);
  expect(log.map((c) => c.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  for (const c of log) expect(Math.abs(c.at - c.t), `cue ${c.id}`).toBeLessThanOrEqual(0.05);
  await expect.poll(() => sing(page), { timeout: 20_000 }).toMatchObject({ mode: 'garden', playing: false, held: false });
});

test('Home stops the song at once and lets the music play again', async ({ page }) => {
  await startGame(page);
  await setSong(page, 10);
  await tapGazebo(page);
  await expect.poll(async () => (await sing(page)).playing, { timeout: 20_000 }).toBe(true);
  await page.getByRole('button', { name: 'Home' }).click();
  await expect.poll(() => sing(page)).toMatchObject({ playing: false, held: false });
  await expect.poll(async () => (await sing(page)).mode).toBe('garden');
});

test('the song pauses while the game is in the background and resumes with it', async ({ page }) => {
  await startGame(page);
  await setSong(page, 10);
  await tapGazebo(page);
  await expect.poll(async () => (await sing(page)).playing, { timeout: 20_000 }).toBe(true);
  await setHidden(page, true);
  await expect.poll(async () => (await sing(page)).playing).toBe(false);
  const firedWhileHidden = (await sing(page)).log.length;
  await page.waitForTimeout(1500);
  expect((await sing(page)).log.length).toBe(firedWhileHidden);
  await setHidden(page, false);
  await expect.poll(async () => (await sing(page)).playing).toBe(true);
});

test('with no song for the language, the spoken sing-along runs', async ({ page }) => {
  await startGame(page);
  await setSong(page, null);
  await tapGazebo(page);
  await expect.poll(async () => (await sing(page)).mode).toBe('sing');
  expect((await sing(page)).playing).toBe(false);
  await expect.poll(async () => (await sing(page)).mode, { timeout: 60_000 }).toBe('garden');
  expect((await sing(page)).log).toEqual([]);
});

test('a song that cannot be played falls back to the spoken sing-along', async ({ page }) => {
  await startGame(page);
  await page.evaluate((cues) => window.__buzzy.setSong('en', 'data:audio/wav;base64,AAAA', cues), CUES);
  await tapGazebo(page);
  await expect.poll(async () => (await sing(page)).mode).toBe('sing');
  await expect.poll(async () => (await sing(page)).mode, { timeout: 60_000 }).toBe('garden');
  expect((await sing(page)).log).toEqual([]);
});
