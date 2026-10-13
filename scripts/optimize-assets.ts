// Phase 6 asset pipeline (brief §12): drop a GLB from an AI 3D tool into
// public/assets/models/ and run `npm run optimize-assets`. In place, per file:
//   dedup + weld → simplify only when over its triangle budget → textures to WebP ≤ 512²
//   → meshopt geometry compression (needs MeshoptDecoder at runtime; see src/core/assets.ts).
// Processed files are stamped, so re-running skips them. Use --force to redo,
// or pass model ids to limit the run:  npm run optimize-assets -- gazebo tree
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { dedup, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { MODELS_DIR, budgets, countTriangles, createIO, kb, maxTextureSize, modelFiles, triBudget } from './lib/gltf.ts';

const PIPELINE_VERSION = 1;
const SIMPLIFY_ERRORS = [0.002, 0.005, 0.01, 0.02, 0.04];

const args = process.argv.slice(2);
const force = args.includes('--force');
const files = modelFiles(args.filter((a) => !a.startsWith('--')));
const io = await createIO();

let changed = 0;
for (const file of files) {
  const id = file.replace(/\.glb$/, '');
  const path = join(MODELS_DIR, file);
  const bytesBefore = statSync(path).size;
  const doc = await io.read(path);
  const asset = doc.getRoot().getAsset();
  const extras = (asset.extras ?? {}) as Record<string, unknown>;
  if (extras.buzzyPipeline === PIPELINE_VERSION && !force) {
    console.log(`· ${id.padEnd(10)} already optimised (v${PIPELINE_VERSION})`);
    continue;
  }

  const trisBefore = countTriangles(doc);
  await doc.transform(dedup(), weld());
  const budget = triBudget(id);
  // Simplify gently, raising the allowed error only until the budget is met.
  for (const error of SIMPLIFY_ERRORS) {
    const tris = countTriangles(doc);
    if (tris <= budget) break;
    // lockBorder keeps open edges fixed, so thin parts (wings, leaves, cloth) keep their outline.
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, (budget / tris) * 0.97), error, lockBorder: true }));
  }
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [budgets.maxTexture, budgets.maxTexture], quality: 82 }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  asset.extras = { ...extras, buzzyPipeline: PIPELINE_VERSION };
  await io.write(path, doc);
  changed++;

  const trisAfter = countTriangles(doc);
  const bytesAfter = statSync(path).size;
  const flag = trisAfter > budget || bytesAfter > budgets.maxBytes ? '✗' : '✓';
  console.log(
    `${flag} ${id.padEnd(10)} tris ${String(trisBefore).padStart(5)} → ${String(trisAfter).padStart(5)} (budget ${budget})  ` +
      `size ${kb(bytesBefore).padStart(7)} → ${kb(bytesAfter).padStart(7)}  texture ≤ ${maxTextureSize(doc)}px`,
  );
}
console.log(`\n${changed} model(s) optimised, ${files.length - changed} skipped.`);
