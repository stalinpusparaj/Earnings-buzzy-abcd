import {
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
} from 'three';
import { GLYPH_FONT, theme } from '../core/theme';

// Glyphs are drawn with the platform font onto canvases (no font files to ship
// yet). The "3D" letter is a stack of glyph-shaped layers: a chunky extruded look
// that works for any script, Tamil included, without outline extraction.

export type GlyphStyle = { fill: string; outline: string; outlineFrac?: number; bg?: string; ring?: string };

/** Draw `glyph` fitted into a centred boxW × boxH box, using its real ink bounds. */
export function drawGlyph(ctx: CanvasRenderingContext2D, glyph: string, cx: number, cy: number, boxW: number, style: GlyphStyle, boxH = boxW): void {
  const probe = 200;
  ctx.font = `800 ${probe}px ${GLYPH_FONT}`;
  const m = ctx.measureText(glyph);
  const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight || probe * 0.6;
  const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent || probe * 0.7;
  const size = probe * Math.min(boxW / w, boxH / h);
  ctx.font = `800 ${size}px ${GLYPH_FONT}`;
  const k = size / probe;
  const x = cx - ((m.actualBoundingBoxRight - m.actualBoundingBoxLeft) * k) / 2;
  const y = cy + ((m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) * k) / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * (style.outlineFrac ?? 0.1);
  ctx.strokeStyle = style.outline;
  ctx.strokeText(glyph, x, y);
  ctx.fillStyle = style.fill;
  ctx.fillText(glyph, x, y);
}

const texCache = new Map<string, CanvasTexture>();

/** Square glyph texture, optionally on a filled circle. Cached and shared. */
export function glyphTexture(glyph: string, style: GlyphStyle, px = 256): CanvasTexture {
  const key = `${glyph}|${style.fill}|${style.outline}|${style.bg ?? ''}|${style.ring ?? ''}|${px}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d')!;
  if (style.bg) {
    ctx.beginPath();
    ctx.arc(px / 2, px / 2, px * 0.46, 0, Math.PI * 2);
    ctx.fillStyle = style.bg;
    ctx.fill();
    if (style.ring) {
      ctx.lineWidth = px * 0.05;
      ctx.strokeStyle = style.ring;
      ctx.stroke();
    }
  }
  drawGlyph(ctx, glyph, px / 2, px / 2, px * (style.bg ? 0.5 : 0.78), style);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  tex.userData.shared = true;
  texCache.set(key, tex);
  return tex;
}

/** Round badge that always faces the camera (garden bud labels, bloom centres). */
export function glyphBadge(glyph: string, color: string, size: number): Sprite {
  const tex = glyphTexture(glyph, { fill: theme.glyphFill, outline: theme.glyphOutline, bg: color, ring: '#FFFFFF' });
  const sprite = new Sprite(new SpriteMaterial({ map: tex, depthWrite: false }));
  sprite.scale.setScalar(size);
  return sprite;
}

const shade = (hex: string, k: number) => '#' + new Color(hex).multiplyScalar(k).getHexString();

/**
 * Chunky 3D letter: a coloured front face plus `layers` darker silhouettes behind it.
 * Two draw calls (front + one instanced mesh for the sides).
 */
export function makeGlyph3D(glyph: string, color: string, height: number, layers = 12): Group {
  const group = new Group();
  const front = glyphTexture(glyph, { fill: color, outline: theme.glyphOutline, outlineFrac: 0.09 }, 512);
  const silhouette = glyphTexture(glyph, { fill: '#FFFFFF', outline: '#FFFFFF', outlineFrac: 0.09 }, 512);
  const plane = new PlaneGeometry(height, height);
  const depth = height * 0.16;

  const sides = new InstancedMesh(plane, new MeshBasicMaterial({ map: silhouette, alphaTest: 0.5 }), layers);
  sides.instanceMatrix.setUsage(DynamicDrawUsage);
  const m = new Matrix4();
  const dark = new Color(shade(color, 0.62));
  const outline = new Color(theme.glyphOutline);
  for (let i = 0; i < layers; i++) {
    m.makeTranslation(0, 0, -((i + 1) / layers) * depth);
    sides.setMatrixAt(i, m);
    sides.setColorAt(i, i === layers - 1 ? outline : dark);
  }
  const face = new Mesh(plane, new MeshBasicMaterial({ map: front, alphaTest: 0.5 }));
  group.add(sides, face);
  return group;
}
