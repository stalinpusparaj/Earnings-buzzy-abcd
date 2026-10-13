import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Cue Recorder (brief Phase 3): records cues from key presses, exports JSON that passes
// validation, and in Preview fires each cue within 50 ms of its timestamp. Uses a dummy song.

/** A 16-bit mono WAV: a quiet 440 Hz tone that beeps louder every half second. */
function dummySong(seconds: number, rate = 8000): Buffer {
  const n = seconds * rate;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const amp = t % 0.5 < 0.08 ? 0.5 : 0.05;
    buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * t) * amp * 32767), 44 + i * 2);
  }
  return buf;
}

type State = { mode: string; cues: { id: string; t: number }[]; report: { expected: number; fired: number; maxLateMs: number }; duration: number };
const state = (page: Page) => page.evaluate(() => (window as unknown as { __cueRecorder: { state: () => State } }).__cueRecorder.state());

test.beforeEach(async ({ page }) => {
  await page.goto('./?dev=cues');
  await page.waitForFunction(() => (window as unknown as { __cueRecorder?: { ready: boolean } }).__cueRecorder?.ready);
  await page.setInputFiles('#cr-file', { name: 'dummy-song.wav', mimeType: 'audio/wav', buffer: dummySong(6) });
  await expect.poll(async () => (await state(page)).duration).toBeGreaterThan(5.9);
});

test('records a cue per key press and exports JSON that passes validation', async ({ page }) => {
  await page.click('#cr-rec');
  for (const key of ['1', '2', '3', '4', '5', '6']) {
    await page.waitForTimeout(350);
    await page.keyboard.press(key);
  }
  await page.keyboard.press('7'); // not a letter: ignored
  await page.click('#cr-rec'); // stop (takes effect on the audio element's pause event)
  await expect.poll(async () => (await state(page)).mode).toBe('idle');
  const s = await state(page);
  expect(s.cues.map((c) => c.id)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  const times = s.cues.map((c) => c.t);
  expect(times).toEqual([...times].sort((a, b) => a - b));
  expect(times[0]).toBeGreaterThan(0.1);
  expect(times[5]).toBeLessThan(6);
  // The export is exactly the cue list, in the cues.{lang}.json shape.
  expect(JSON.parse(await page.inputValue('#cr-json'))).toEqual(s.cues);
  await expect(page.locator('#cr-valid')).toHaveText('Valid: 6 cues');

  // Backspace undoes the last cue.
  await page.keyboard.press('Backspace');
  expect((await state(page)).cues.map((c) => c.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
  await expect(page.locator('#cr-valid')).toContainText('no cue yet for F');
});

test('Preview fires every cue within 50 ms of its timestamp', async ({ page }) => {
  const cues = ['A', 'B', 'C', 'D', 'E', 'F'].map((id, i) => ({ id, t: 0.4 + i * 0.45 }));
  await page.fill('#cr-import', JSON.stringify(cues));
  await page.click('#cr-import-go');
  await expect(page.locator('#cr-valid')).toHaveText('Valid: 6 cues');
  await page.click('#cr-preview');
  await expect.poll(async () => (await state(page)).report.fired, { timeout: 15_000 }).toBe(6);
  const { report } = await state(page);
  expect(report.expected).toBe(6);
  expect(report.maxLateMs).toBeLessThanOrEqual(50);
  await page.click('#cr-preview'); // stop
  await expect(page.locator('#cr-report')).toContainText('6/6 cues fired');
});

test('rejects imported cues that would not validate', async ({ page }) => {
  await page.fill('#cr-import', JSON.stringify([{ id: 'A', t: 2 }, { id: 'Q', t: 1 }]));
  await page.click('#cr-import-go');
  await expect(page.locator('#cr-valid')).toContainText('not a letter');
  await expect(page.locator('#cr-valid')).toContainText('in order');
  expect((await state(page)).cues).toEqual([]);
});
