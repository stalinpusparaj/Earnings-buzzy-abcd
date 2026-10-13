import { lettersFor, strokesFor } from '../core/content';
import { GLYPH_FONT, theme } from '../core/theme';
import type { Lang, LetterDef } from '../core/types';
import { drawGlyph, glyphTexture } from '../procedural/glyph';
import { TraceBoard } from '../minigames/traceBoard';

/**
 * Dev/e2e Glyph Sheet (/?dev=glyphs). Draws every letter exactly as the game does
 * (bubble label, bud badge, 3D-letter face, tracing board) on static canvases, so a
 * Tamil reviewer can check them and screenshot tests get deterministic pixels.
 */

const CELL = 200;

function cell(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = CELL, bg = '#E0F4FF'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  draw(ctx, size);
  return c;
}

function row(letter: LetterDef, index: number): HTMLElement {
  const color = theme.petals[index % theme.petals.length];
  const el = document.createElement('section');
  el.className = 'glyph-row';
  el.dataset.letter = letter.id;
  const head = document.createElement('h3');
  head.textContent = `${letter.id} · ${letter.word}${letter.wordRoman ? ` · ${letter.wordRoman}` : ''}`;
  const cells = document.createElement('div');
  cells.className = 'glyph-cells';
  cells.dataset.letter = letter.id;
  // Pollen Pop bubble: translucent blue shell behind a white glyph with a dark outline.
  const bubble = glyphTexture(letter.glyph, { fill: theme.glyphFill, outline: theme.glyphOutline, outlineFrac: 0.14 }).image as HTMLCanvasElement;
  cells.appendChild(
    cell((ctx, s) => {
      ctx.fillStyle = '#BDEBFF';
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s * 0.47, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(bubble, s * 0.1, s * 0.1, s * 0.8, s * 0.8);
    }),
  );
  // Garden bud badge.
  const badge = glyphTexture(letter.glyph, { fill: theme.glyphFill, outline: theme.glyphOutline, bg: color, ring: '#FFFFFF' }).image as HTMLCanvasElement;
  cells.appendChild(cell((ctx, s) => ctx.drawImage(badge, 0, 0, s, s)));
  // Face of the 3D intro letter.
  const face = glyphTexture(letter.glyph, { fill: color, outline: theme.glyphOutline, outlineFrac: 0.09 }, 512).image as HTMLCanvasElement;
  cells.appendChild(cell((ctx, s) => ctx.drawImage(face, 0, 0, s, s)));
  el.append(head, cells);

  const strokes = letter.template === 'traceTrail' ? strokesFor(letter) : null;
  if (strokes) {
    const board = new TraceBoard(letter.glyph, strokes.strokes);
    board.draw(0, 0, false);
    const boardCanvas = board.texture.image as HTMLCanvasElement;
    boardCanvas.className = 'glyph-board';
    boardCanvas.dataset.letter = letter.id;
    el.appendChild(boardCanvas);
  }
  return el;
}

/** 8×8 ink-coverage signature of a glyph drawn alone, used to catch missing-glyph boxes. */
export function glyphSignature(glyph: string): { coverage: number; grid: number[] } {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  drawGlyph(ctx, glyph, size / 2, size / 2, size * 0.8, { fill: '#000', outline: 'rgba(0,0,0,0)', outlineFrac: 0 });
  const data = ctx.getImageData(0, 0, size, size).data;
  const grid = new Array<number>(64).fill(0);
  let ink = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3] > 128) {
        ink++;
        grid[Math.floor(y / 16) * 8 + Math.floor(x / 16)] += 1 / 256;
      }
    }
  }
  return { coverage: ink / (size * size), grid };
}

export async function mountGlyphSheet(root: HTMLElement): Promise<void> {
  await document.fonts.ready;
  const page = document.createElement('div');
  page.className = 'glyph-sheet';
  page.innerHTML = `<style>
    .glyph-sheet { position: fixed; inset: 0; overflow: auto; background: #fff; color: #1f2933; padding: 16px; font: 15px system-ui, sans-serif; -webkit-user-select: text; user-select: text; }
    .glyph-sheet h2 { margin: 8px 0 12px; }
    .glyph-row { display: grid; grid-template-columns: auto auto; gap: 8px 16px; align-items: start; margin-bottom: 20px; }
    .glyph-row h3 { grid-column: 1 / -1; margin: 0; font-size: 15px; font-weight: 600; }
    .glyph-cells { display: flex; gap: 8px; width: max-content; }
    .glyph-cells canvas { width: ${CELL}px; height: ${CELL}px; display: block; }
    .glyph-board { width: 300px; height: 300px; display: block; }
  </style>`;
  const langs: [Lang, string][] = [
    ['ta', 'Tamil (REVIEW: check against the Tamil Nadu primer)'],
    ['en', 'English'],
  ];
  for (const [lang, title] of langs) {
    const h = document.createElement('h2');
    h.textContent = title;
    page.appendChild(h);
    lettersFor(lang).forEach((l, i) => page.appendChild(row(l, i)));
  }
  root.appendChild(page);
  Object.assign(window, { __glyphSheet: { signature: glyphSignature, font: GLYPH_FONT, ready: true } });
}
