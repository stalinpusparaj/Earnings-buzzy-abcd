import { lettersFor, strokesFor } from '../core/content';
import type { Point2 } from '../core/types';
import { drawGlyph } from '../procedural/glyph';

/**
 * Dev-only Stroke Editor (/?dev=strokes). Pick a letter, click to place points,
 * Enter ends a stroke, Backspace removes the last point, Export copies the JSON.
 */
export function mountStrokeEditor(root: HTMLElement): void {
  const letters = [...lettersFor('en'), ...lettersFor('ta')];
  root.innerHTML = `
    <div class="dev-editor">
      <header><select></select> <button data-a="end">End stroke (Enter)</button> <button data-a="undo">Undo (⌫)</button>
      <button data-a="clear">Clear</button> <button data-a="export">Export JSON</button></header>
      <canvas width="640" height="640"></canvas>
      <textarea readonly rows="6"></textarea>
    </div>`;
  const select = root.querySelector('select')!;
  const canvas = root.querySelector('canvas')!;
  const out = root.querySelector('textarea')!;
  const ctx = canvas.getContext('2d')!;
  for (const l of letters) select.add(new Option(`${l.glyph}  ${l.lang}/${l.id}`, `${l.lang}:${l.id}`));
  let strokes: Point2[][] = [[]];
  const current = () => letters.find((l) => `${l.lang}:${l.id}` === select.value)!;
  const toPx = (p: Point2): [number, number] => [64 + p[0] * 512, 64 + (1 - p[1]) * 512];

  const load = () => {
    const def = strokesFor(current());
    strokes = def ? def.strokes.map((s) => [...s]) : [];
    strokes.push([]);
    draw();
  };
  const draw = () => {
    ctx.fillStyle = '#8A5A36';
    ctx.fillRect(0, 0, 640, 640);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(64, 64, 512, 512);
    drawGlyph(ctx, current().glyph, 320, 320, 460, { fill: 'rgba(255,240,220,0.3)', outline: 'rgba(0,0,0,0)', outlineFrac: 0 });
    strokes.forEach((s, i) => {
      ctx.strokeStyle = `hsl(${i * 70}, 90%, 65%)`;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 6;
      ctx.beginPath();
      s.forEach((p, j) => (j === 0 ? ctx.moveTo(...toPx(p)) : ctx.lineTo(...toPx(p))));
      ctx.stroke();
      s.forEach((p, j) => {
        ctx.beginPath();
        ctx.arc(...toPx(p), j === 0 ? 10 : 5, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    const clean = strokes.filter((s) => s.length > 1);
    out.value = JSON.stringify({ id: current().id, strokes: clean.map((s) => s.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)])) });
  };
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) * (640 / r.width) - 64) / 512;
    const y = 1 - ((e.clientY - r.top) * (640 / r.height) - 64) / 512;
    strokes[strokes.length - 1].push([x, y]);
    draw();
  });
  const act = (a: string) => {
    if (a === 'end' && strokes[strokes.length - 1].length > 1) strokes.push([]);
    if (a === 'undo') {
      const last = strokes[strokes.length - 1];
      if (last.length) last.pop();
      else if (strokes.length > 1) strokes.pop();
    }
    if (a === 'clear') strokes = [[]];
    if (a === 'export') void navigator.clipboard?.writeText(out.value);
    draw();
  };
  root.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => act(b.dataset.a!)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') act('end');
    if (e.key === 'Backspace') act('undo');
  });
  select.addEventListener('change', load);
  load();
}
