// Enforces the performance budgets of BUILD_PROMPT.md §7.4 against a production build
// (`npm run build` runs it last, so the build fails when a budget is exceeded).
// Runtime budgets (draw calls, frame rate, tap response) are covered by the e2e suite / QA.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import en from '../src/data/letters.en.json' with { type: 'json' };
import ta from '../src/data/letters.ta.json' with { type: 'json' };
import manifest from '../src/data/vo-manifest.json' with { type: 'json' };
import { MODELS_DIR, ROOT, budgets, countTriangles, createIO, kb, maxTextureSize, triBudget } from './lib/gltf.ts';

const KB = 1024;
const MB = 1024 * KB;
const LIMITS = { jsGzip: 300 * KB, toStart: 2 * MB, toPlayable: 5 * MB, letterPack: 1.5 * MB };
const SHARED_MODELS = ['buzzy', 'bud', 'bloom', 'gazebo', 'tree', 'basket']; // loaded before play (src/main.ts)

const DIST = join(ROOT, 'dist');
if (!existsSync(join(DIST, 'index.html'))) {
  console.error('check-budgets: no dist/ build found. Run `npm run build` first.');
  process.exit(1);
}

type Row = { budget: string; item: string; value: string; limit: string; ok: boolean };
const rows: Row[] = [];
const check = (budget: string, item: string, value: number, limit: number, fmt: (n: number) => string) =>
  rows.push({ budget, item, value: fmt(value), limit: fmt(limit), ok: value <= limit });

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)]));
const gz = (path: string) => gzipSync(readFileSync(path), { level: 9 }).length;
const size = (path: string) => statSync(path).size;

// JS, all chunks (game + service worker + Workbox), gzip.
const js = files(DIST).filter((f) => f.endsWith('.js'));
check('JS (all chunks, gzip)', `${js.length} files`, js.reduce((s, f) => s + gz(f), 0), LIMITS.jsGzip, kb);

// Transferred until the "tap to start" screen: HTML + CSS + the boot JS.
const shell = [join(DIST, 'index.html'), ...files(join(DIST, 'assets')).filter((f) => /\.(js|css)$/.test(f)), ...files(join(DIST, 'fonts')).filter((f) => f.endsWith('.woff2'))];
const shellBytes = shell.reduce((s, f) => s + gz(f), 0);
check('Transferred until tap-to-start', 'html + css + js + fonts (gzip)', shellBytes, LIMITS.toStart, kb);

// Transferred until the garden is playable: shell + shared models + the heavier language's objects.
const modelBytes = (id: string) => size(join(MODELS_DIR, `${id}.glb`));
const langObjects = [en.letters, ta.letters].map((ls) => ls.reduce((s, l) => s + modelBytes(l.objectModel), 0));
const playable = shellBytes + SHARED_MODELS.reduce((s, id) => s + modelBytes(id), 0) + Math.max(...langObjects);
check('Transferred until garden playable', 'shell + shared + one language', playable, LIMITS.toPlayable, kb);

// Each letter pack: object model + stroke file + recorded VO files.
const lines = manifest.lines as Record<string, { en: string | null; ta: string | null }>;
for (const l of [...en.letters, ...ta.letters]) {
  const strokes = join(ROOT, 'src/data/strokes', l.lang, `${l.id}.json`);
  const vo = Object.values(l.vo)
    .map((id) => lines[id]?.[l.lang as 'en' | 'ta'])
    .filter((f): f is string => !!f)
    .map((f) => join(ROOT, 'public', f));
  const bytes = modelBytes(l.objectModel) + (existsSync(strokes) ? size(strokes) : 0) + vo.reduce((s, f) => s + (existsSync(f) ? size(f) : 0), 0);
  check('Letter pack', `${l.lang}/${l.id}`, bytes, LIMITS.letterPack, kb);
}

// Every GLB: file size, triangles, texture size.
const io = await createIO();
for (const file of readdirSync(MODELS_DIR).filter((f) => f.endsWith('.glb')).sort()) {
  const id = file.replace(/\.glb$/, '');
  const doc = await io.read(join(MODELS_DIR, file));
  check('GLB size', id, modelBytes(id), budgets.maxBytes, kb);
  check('GLB triangles', id, countTriangles(doc), triBudget(id), String);
  check('Texture size', id, maxTextureSize(doc), budgets.maxTexture, (n) => `${n}px`);
}

const failed = rows.filter((r) => !r.ok);
const w = (k: keyof Row) => Math.max(...rows.map((r) => String(r[k]).length));
for (const r of rows) {
  if (r.ok && process.argv.includes('--quiet')) continue;
  console.log(`${r.ok ? '✓' : '✗'} ${r.budget.padEnd(w('budget'))}  ${r.item.padEnd(w('item'))}  ${r.value.padStart(w('value'))} / ${r.limit}`);
}
console.log(`\n${rows.length - failed.length}/${rows.length} budgets met.`);
if (failed.length) {
  console.error(`check-budgets: ${failed.length} budget(s) exceeded.`);
  process.exit(1);
}
