import { expect, test } from './fixtures';
import ta from '../../src/data/letters.ta.json' with { type: 'json' };

// Screenshot tests for the Tamil glyphs (brief Phase 4). The glyph sheet draws every
// letter the way the game does, on static canvases, so pixels are deterministic.
// Baselines are per platform (fonts differ by OS): tests/e2e/glyphs.spec.ts-snapshots/*-darwin.png.
// After an intended change, review the sheet at /?dev=glyphs, then run:
//   npx playwright test glyphs --update-snapshots

const letters = ta.letters.map((l) => ({ id: l.id, glyph: l.glyph, template: l.template }));
const MISSING = ''; // private-use code point: renders as the missing-glyph box (or nothing)

test.beforeEach(async ({ page }) => {
  await page.goto('./?dev=glyphs');
  await page.waitForFunction(() => (window as unknown as { __glyphSheet?: { ready: boolean } }).__glyphSheet?.ready);
});

for (const l of letters) {
  test(`${l.glyph} (${l.id}) renders as bubble, badge and 3D-letter face`, async ({ page }) => {
    await expect(page.locator(`.glyph-cells[data-letter="${l.id}"]`)).toHaveScreenshot(`${l.id}.png`);
  });
  if (l.template === 'traceTrail') {
    test(`${l.glyph} (${l.id}) tracing board`, async ({ page }) => {
      await expect(page.locator(`.glyph-board[data-letter="${l.id}"]`)).toHaveScreenshot(`${l.id}-board.png`, { threshold: 0.03 }); // the letter is faint here, so compare colours tightly
    });
  }
}

test('every Tamil glyph has real ink, differs from the missing-glyph box, and from each other', async ({ page }) => {
  type Sig = { coverage: number; grid: number[] };
  const sigs = await page.evaluate(
    ([glyphs, missing]) => {
      const sheet = (window as unknown as { __glyphSheet: { signature: (g: string) => Sig } }).__glyphSheet;
      return { glyphs: glyphs.map((g) => sheet.signature(g)), missing: sheet.signature(missing) };
    },
    [letters.map((l) => l.glyph), MISSING] as const,
  );
  const diff = (a: Sig, b: Sig) => a.grid.reduce((s, v, i) => s + Math.abs(v - b.grid[i]), 0) / a.grid.length;
  sigs.glyphs.forEach((s, i) => {
    const name = letters[i].glyph;
    expect(s.coverage, `${name} should have ink`).toBeGreaterThan(0.04);
    expect(s.coverage, `${name} should not be a filled block`).toBeLessThan(0.6);
    expect(diff(s, sigs.missing), `${name} must not render as the missing-glyph box`).toBeGreaterThan(0.04);
  });
  for (let i = 0; i < sigs.glyphs.length; i++) {
    for (let j = i + 1; j < sigs.glyphs.length; j++) {
      expect(diff(sigs.glyphs[i], sigs.glyphs[j]), `${letters[i].glyph} vs ${letters[j].glyph}`).toBeGreaterThan(0.02);
    }
  }
});

test('the self-hosted Baloo fonts load before any glyph is drawn', async ({ page }) => {
  expect(await page.evaluate(() => (window as unknown as { __glyphSheet: { fontsLoaded: boolean } }).__glyphSheet.fontsLoaded)).toBe(true);
  // Both script ranges resolve to the self-hosted family (Latin: Baloo 2, Tamil: Baloo Thambi 2).
  expect(await page.evaluate(() => document.fonts.check('800 40px "Buzzy Glyph"', 'Aஅ'))).toBe(true);
});
