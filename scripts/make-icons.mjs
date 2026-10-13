// Draws the PWA icons (a round Buzzy on sky blue) and writes PNGs to public/icons.
// Zero dependencies: shapes are rasterised with 4×4 supersampling, PNG encoded with zlib.
// Run: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../public/icons');

const hex = (h, a = 1) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];
const SKY = hex('#8ED1FC');
const SKY_LOW = hex('#E0F4FF');
const BODY = hex('#FFD23F');
const STRIPE = hex('#3B2A20');
const WING = hex('#FFFFFF', 0.85);
const WING_EDGE = hex('#CFE7F5');
const CHEEK = hex('#FF8FA3', 0.8);
const WHITE = hex('#FFFFFF');

const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** Colour of one sample at unit coords (0–1). `k` scales the bee (maskable icons keep it in the safe zone). */
function sample(x, y, { background, k }) {
  // Map into bee space so the drawing can shrink around the centre.
  const u = (x - 0.5) / k + 0.5;
  const v = (y - 0.5) / k + 0.5;
  let c = background ? (y < 1 ? mix(SKY_LOW, SKY, y) : SKY) : [0, 0, 0, 0];
  const over = (top) => (c = blend(c, top));
  // Wings behind the body.
  for (const wx of [0.36, 0.64]) {
    if (inEllipse(u, v, wx, 0.27, 0.135, 0.17)) over(inEllipse(u, v, wx, 0.27, 0.11, 0.145) ? WING : WING_EDGE);
  }
  // Antennae.
  for (const [ax, dir] of [[0.42, -1], [0.58, 1]]) {
    const t = (0.3 - v) / 0.14;
    if (t >= 0 && t <= 1 && Math.abs(u - (ax + dir * 0.05 * t)) < 0.014) over(STRIPE);
    if (inEllipse(u, v, ax + dir * 0.05, 0.155, 0.032, 0.032)) over(STRIPE);
  }
  // Body with outline and two stripes.
  if (inEllipse(u, v, 0.5, 0.56, 0.33, 0.29)) {
    over(STRIPE);
    if (inEllipse(u, v, 0.5, 0.56, 0.305, 0.265)) {
      over(BODY);
      if (Math.abs(u - 0.6) < 0.035 || Math.abs(u - 0.74) < 0.035) over(STRIPE);
    }
  }
  // Face on the left half: eyes, pupils, cheeks, smile.
  for (const ex of [0.32, 0.46]) {
    if (inEllipse(u, v, ex, 0.5, 0.055, 0.065)) over(WHITE);
    if (inEllipse(u, v, ex + 0.012, 0.51, 0.03, 0.038)) over(STRIPE);
  }
  for (const cx of [0.27, 0.51]) if (inEllipse(u, v, cx, 0.6, 0.035, 0.022)) over(CHEEK);
  const r = Math.hypot(u - 0.39, v - 0.58);
  if (v > 0.6 && r > 0.045 && r < 0.062 && Math.abs(u - 0.39) < 0.05) over(STRIPE);
  return c;
}

function mix(a, b, t) {
  return a.map((x, i) => x + (b[i] - x) * t);
}

function blend(dst, src) {
  const a = src[3] + dst[3] * (1 - src[3]);
  if (a === 0) return [0, 0, 0, 0];
  const ch = (i) => (src[i] * src[3] + dst[i] * dst[3] * (1 - src[3])) / a;
  return [ch(0), ch(1), ch(2), a];
}

function render(size, opts) {
  const ss = 4;
  const px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = sample((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size, opts);
          acc[0] += c[0] * c[3];
          acc[1] += c[1] * c[3];
          acc[2] += c[2] * c[3];
          acc[3] += c[3];
        }
      }
      const i = (y * size + x) * 4;
      const a = acc[3] / (ss * ss);
      px[i] = acc[3] ? acc[0] / acc[3] : 0;
      px[i + 1] = acc[3] ? acc[1] / acc[3] : 0;
      px[i + 2] = acc[3] ? acc[2] / acc[3] : 0;
      px[i + 3] = Math.round(a * 255);
    }
  }
  return px;
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(px.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(OUT, { recursive: true });
const icons = [
  ['icon-192.png', 192, { background: true, k: 1 }],
  ['icon-512.png', 512, { background: true, k: 1 }],
  ['maskable-512.png', 512, { background: true, k: 0.72 }], // content inside the 80% safe zone
  ['apple-touch-icon.png', 180, { background: true, k: 0.9 }],
];
for (const [name, size, opts] of icons) {
  writeFileSync(join(OUT, name), png(size, render(size, opts)));
  console.log(`wrote public/icons/${name}`);
}
