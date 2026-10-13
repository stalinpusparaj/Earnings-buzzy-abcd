import { BufferAttribute, BufferGeometry, Color, Vector3, type ColorRepresentation } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Small toolkit for programmatic low-poly models: deterministic randomness,
// faceted jitter, per-face vertex colours and merging into one draw call.

/** mulberry32: deterministic so every device builds the same garden. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash of a position, so vertices shared by several faces move together. */
function hash3(x: number, y: number, z: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Pushes each vertex in or out along its direction from the origin, then
 * un-indexes so every face gets a flat normal (the faceted toy look).
 */
export function lowPoly(geo: BufferGeometry, amount: number, seed: number): BufferGeometry {
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const merged = mergeVertices(geo, 1e-4);
  geo.dispose();
  const pos = merged.getAttribute('position') as BufferAttribute;
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length();
    if (len < 1e-6) continue;
    const k = 1 + (hash3(v.x, v.y, v.z, seed) - 0.5) * amount;
    v.multiplyScalar(k);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const flat = merged.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

/** Flat-shade a geometry without moving it. */
export function facet(geo: BufferGeometry): BufferGeometry {
  geo.deleteAttribute('uv');
  const flat = geo.index ? geo.toNonIndexed() : geo;
  flat.computeVertexNormals();
  return flat;
}

/**
 * Colour every triangle. `pick` sees the face centre and normal; return a colour.
 * Geometry must be non-indexed (lowPoly/facet output).
 */
export function paintFaces(
  geo: BufferGeometry,
  pick: (centre: Vector3, normal: Vector3, face: number) => ColorRepresentation,
): BufferGeometry {
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const centre = new Vector3();
  const normal = new Vector3();
  const col = new Color();
  for (let f = 0; f < pos.count / 3; f++) {
    a.fromBufferAttribute(pos, f * 3);
    b.fromBufferAttribute(pos, f * 3 + 1);
    c.fromBufferAttribute(pos, f * 3 + 2);
    centre.copy(a).add(b).add(c).divideScalar(3);
    normal.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    col.set(pick(centre, normal, f));
    for (let k = 0; k < 3; k++) colors.set([col.r, col.g, col.b], (f * 3 + k) * 3);
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  return geo;
}

export function paint(geo: BufferGeometry, color: ColorRepresentation): BufferGeometry {
  return paintFaces(facet(geo), () => color);
}

/** Merge painted pieces into one geometry (one draw call). */
export function merge(parts: BufferGeometry[]): BufferGeometry {
  for (const p of parts) {
    for (const name of Object.keys(p.attributes)) if (!['position', 'normal', 'color'].includes(name)) p.deleteAttribute(name);
  }
  const out = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!out) throw new Error('merge failed: attribute mismatch');
  return out;
}

/** Slightly vary a colour so faces don't look flat-filled. */
export function vary(color: ColorRepresentation, rand: () => number, amount = 0.06): Color {
  const c = new Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + (rand() - 0.5) * amount * 2)));
}
