import { expect, startGame, test } from './fixtures';

test('a full play session makes same-origin requests only', async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const requests: string[] = [];
  // Context-level, so service-worker fetches are included too.
  context.on('request', (r) => requests.push(r.url()));
  await startGame(page);
  const result = await page.evaluate(() => window.T.playLetter(0));
  expect(result.id).toBe('A');
  // Switching language loads the Tamil packs as well.
  await page.getByRole('button', { name: 'Language' }).click();
  await page.waitForFunction(() => window.__buzzy.garden.buds[0]?.letter.lang === 'ta' && window.__buzzy.game.mode === 'garden');
  const foreign = requests.filter((u) => !u.startsWith('data:') && !u.startsWith('blob:') && new URL(u).origin !== origin);
  expect(requests.length).toBeGreaterThan(10);
  expect(foreign).toEqual([]);
});

test('garden stays within the draw-call budget and the HUD is icon-only', async ({ page }) => {
  await startGame(page);
  await page.waitForTimeout(1500);
  const calls = await page.evaluate(() => window.__buzzy.renderer.info.render.calls as number);
  expect(calls).toBeGreaterThan(10);
  expect(calls).toBeLessThanOrEqual(80);
  // Pre-readers first: no visible text on the child HUD except the A / அ glyph toggle.
  const hudText = await page.locator('.hud').evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelector('.hud-lang')?.remove();
    return clone.textContent?.trim() ?? '';
  });
  expect(hudText).toBe('');
});

test('portrait screens show the rotate prompt', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.locator('.rotate-prompt')).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('.rotate-prompt')).toBeHidden();
});

test('the web app manifest and icons are served', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(new URL(href!, page.url()).toString());
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.name).toBe('Buzzy ABC Garden');
  for (const icon of manifest.icons as { src: string }[]) {
    const img = await request.get(new URL(icon.src, page.url()).toString());
    expect(img.ok(), icon.src).toBe(true);
  }
});

test('the QA build shows the perf overlay with tier and load time', async ({ page }) => {
  await page.goto('./?dev=perf');
  await page.getByRole('button', { name: 'Play' }).waitFor({ state: 'visible', timeout: 90_000 });
  const perf = page.locator('#perf');
  await expect(perf).toContainText(/fps \d+/);
  await expect(perf).toContainText(/tier (high|mid|low) dpr [\d.]+/);
  await expect(perf).toContainText(/ready \d+\.\d s/);
});
