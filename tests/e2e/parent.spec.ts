import type { Page } from '@playwright/test';
import { expect, savedProgress, startGame, test } from './fixtures';

const WORDS: Record<string, number> = {
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
};
const parse = (words: string) => words.split('-').reduce((n, w) => n + WORDS[w], 0);

async function holdParentButton(page: Page, ms = 3300): Promise<void> {
  const box = (await page.getByRole('button', { name: 'Grown-ups' }).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

async function typeAnswer(page: Page, n: number): Promise<void> {
  const gate = page.locator('.gate');
  for (const d of String(n)) await gate.getByRole('button', { name: d, exact: true }).click();
  await gate.getByRole('button', { name: 'Check' }).click();
}

test('200 random taps never open the parent gate', async ({ page }) => {
  await startGame(page);
  const vp = page.viewportSize()!;
  const parent = (await page.getByRole('button', { name: 'Grown-ups' }).boundingBox())!;
  for (let i = 0; i < 200; i++) {
    // One tap in five lands right on the grown-ups button.
    const onParent = i % 5 === 0;
    const x = onParent ? parent.x + parent.width / 2 : Math.random() * vp.width;
    const y = onParent ? parent.y + parent.height / 2 : Math.random() * vp.height;
    await page.mouse.click(x, y);
    await page.waitForTimeout(15);
  }
  await expect(page.locator('.gate')).toHaveCount(0);
  await expect(page.locator('.zone')).toHaveCount(0);
});

test('a short tap is not enough; a 3 s hold opens the gate', async ({ page }) => {
  await startGame(page);
  await holdParentButton(page, 1200);
  await expect(page.locator('.gate')).toHaveCount(0);
  await holdParentButton(page);
  await expect(page.locator('.gate')).toBeVisible();
});

test('three wrong answers close the gate', async ({ page }) => {
  await startGame(page);
  await holdParentButton(page);
  const ask = await page.locator('.gate-ask strong').textContent();
  const wrong = parse(ask!) === 99 ? 98 : parse(ask!) + 1;
  for (let i = 0; i < 3; i++) await typeAnswer(page, wrong);
  await expect(page.locator('.gate')).toHaveCount(0);
  await expect(page.locator('.zone')).toHaveCount(0);
});

test('the right answer opens the parent zone, and its settings apply', async ({ page }) => {
  await startGame(page);
  await holdParentButton(page);
  const ask = await page.locator('.gate-ask strong').textContent();
  await typeAnswer(page, parse(ask!));
  const zone = page.locator('.zone');
  await expect(zone).toBeVisible();
  await expect(zone.getByText('What your child is learning')).toBeVisible();
  await expect(zone.locator('.privacy')).toContainText('no personal data');
  await zone.getByText('Big (5–6)').click();
  await zone.getByText('தமிழ்').click();
  await page.waitForFunction(() => window.__buzzy.garden.buds[0]?.letter.lang === 'ta');
  await zone.getByRole('button', { name: 'Close' }).click();
  await expect(zone).toHaveCount(0);
  expect(await savedProgress(page)).toMatchObject({ lang: 'ta', tolerance: 'big' });
});
