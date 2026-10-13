import { fileURLToPath } from 'node:url';
import { test as base, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    // Untyped on purpose: the e2e-only hook exposes game internals to the harness.
    __buzzy: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    // The in-page harness from harness.js.
    T: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

const harness = fileURLToPath(new URL('./harness.js', import.meta.url));

/** Every test gets the harness, and fails if the page logs an error or throws. */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`);
      });
      await page.addInitScript({ path: harness });
      await use(errors);
      expect(errors, 'the page must not log errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Load, tap Play, and wait until the garden accepts taps. */
export async function startGame(page: Page): Promise<void> {
  await page.goto('./');
  await clickPlay(page);
  await page.waitForFunction(() => window.__buzzy?.game.mode === 'garden', undefined, { timeout: 30_000 });
}

/** The Play button pulses forever, so it never counts as "stable": wait for it, then force the click. */
export async function clickPlay(page: Page): Promise<void> {
  const play = page.getByRole('button', { name: 'Play' });
  await play.waitFor({ state: 'visible', timeout: 90_000 });
  await play.click({ force: true });
}

export function savedProgress(page: Page): Promise<{ lang: string; bloomed: string[] } | null> {
  return page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('buzzyabc:v1') ?? 'null');
    } catch {
      return null;
    }
  });
}
