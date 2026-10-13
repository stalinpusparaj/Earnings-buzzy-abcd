import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Point2 } from '../core/types';
import { theme } from '../core/theme';
import { drawGlyph } from '../procedural/glyph';
import { rng } from '../procedural/geo';
import { pointAt, strokeLength, type Stroke } from './traceMath';

const PX = 768;
const BOX = 0.8; // glyph box as a fraction of the board face

/** Canvas face of the Trace the Trail plot: soil, faint glyph, dotted guide, pollen trail. */
export class TraceBoard {
  readonly texture: CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private soil: HTMLCanvasElement;

  constructor(
    private glyph: string,
    private strokes: readonly Stroke[],
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = PX;
    this.ctx = canvas.getContext('2d')!;
    this.texture = new CanvasTexture(canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.soil = this.paintSoil();
  }

  /** Glyph-box coordinates (0–1, y up) → canvas pixels. */
  private px(p: Point2): [number, number] {
    const m = (PX * (1 - BOX)) / 2;
    return [m + p[0] * PX * BOX, m + (1 - p[1]) * PX * BOX];
  }

  private paintSoil(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = c.height = PX;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#8A5A36';
    ctx.fillRect(0, 0, PX, PX);
    const rand = rng(42);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(60,35,20,0.35)' : 'rgba(190,140,90,0.3)';
      ctx.beginPath();
      ctx.arc(rand() * PX, rand() * PX, 3 + rand() * 7, 0, Math.PI * 2);
      ctx.fill();
    }
    // Faint glyph sized to the stroke data's bounds so guide and letter line up.
    const all = this.strokes.flat();
    const [x0, y0] = this.px([Math.min(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))]);
    const [x1, y1] = this.px([Math.max(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1]))]);
    drawGlyph(ctx, this.glyph, (x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, PX * 0.3) * 1.15, { fill: 'rgba(255,240,220,0.22)', outline: 'rgba(0,0,0,0)', outlineFrac: 0 }, y1 - y0);
    return c;
  }

  private path(s: Stroke, upTo: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    const start = this.px(s[0]);
    ctx.moveTo(start[0], start[1]);
    let acc = 0;
    for (let i = 1; i < s.length; i++) {
      const seg = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
      if (acc + seg >= upTo) {
        const p = this.px(pointAt(s, upTo));
        ctx.lineTo(p[0], p[1]);
        break;
      }
      const p = this.px(s[i]);
      ctx.lineTo(p[0], p[1]);
      acc += seg;
    }
  }

  private trail(s: Stroke, upTo: number): void {
    const ctx = this.ctx;
    if (upTo <= 0) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = theme.pollen;
    ctx.shadowBlur = 24;
    ctx.strokeStyle = theme.trail;
    ctx.lineWidth = 40;
    this.path(s, upTo);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#FFF6C8';
    ctx.lineWidth = 14;
    this.path(s, upTo);
    ctx.stroke();
    ctx.restore();
  }

  private dots(s: Stroke): void {
    const ctx = this.ctx;
    const len = strokeLength(s);
    const step = 0.035;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let d = 0; d <= len; d += step) {
      const [x, y] = this.px(pointAt(s, d));
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Start dot plus an arrow pointing along the stroke. */
  private start(s: Stroke): void {
    const ctx = this.ctx;
    const [x, y] = this.px(s[0]);
    const [ax, ay] = this.px(pointAt(s, Math.min(0.09, strokeLength(s) * 0.4)));
    const ang = Math.atan2(ay - y, ax - x);
    ctx.fillStyle = theme.startDot;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-10, -16);
    ctx.lineTo(-10, 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  draw(strokeIndex: number, progress: number, done: boolean): void {
    const ctx = this.ctx;
    ctx.drawImage(this.soil, 0, 0);
    this.strokes.forEach((s, i) => {
      if (done || i < strokeIndex) this.trail(s, strokeLength(s));
      else this.dots(s);
    });
    if (!done) {
      const cur = this.strokes[strokeIndex];
      this.trail(cur, progress);
      if (progress === 0) this.start(cur);
    }
    this.texture.needsUpdate = true;
  }

  /** Board-face local coordinates (face is `size` wide, centred) ↔ glyph box. */
  static toBox(lx: number, ly: number, size: number): Point2 {
    return [lx / (size * BOX) + 0.5, ly / (size * BOX) + 0.5];
  }

  static fromBox(p: Point2, size: number): [number, number] {
    return [(p[0] - 0.5) * size * BOX, (p[1] - 0.5) * size * BOX];
  }
}
