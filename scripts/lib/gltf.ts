// Shared glTF helpers for the asset scripts (Node, run with built-in TypeScript type stripping).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ImageUtils, Logger, NodeIO, Primitive, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import budgets from '../model-budgets.json' with { type: 'json' };

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const MODELS_DIR = join(ROOT, 'public/assets/models');
export { budgets };

export async function createIO(): Promise<NodeIO> {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  return new NodeIO()
    .setLogger(new Logger(Logger.Verbosity.WARN))
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });
}

export function modelFiles(only: string[] = []): string[] {
  return readdirSync(MODELS_DIR)
    .filter((f) => f.endsWith('.glb'))
    .filter((f) => only.length === 0 || only.includes(f.replace(/\.glb$/, '')))
    .sort();
}

export function triBudget(id: string): number {
  return (budgets.tris as Record<string, number>)[id] ?? budgets.defaultTris;
}

/** Triangles across every mesh primitive (each mesh counted once). */
export function countTriangles(doc: Document): number {
  let tris = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== Primitive.Mode.TRIANGLES) continue;
      const indices = prim.getIndices();
      const position = prim.getAttribute('POSITION');
      tris += Math.floor((indices ? indices.getCount() : position ? position.getCount() : 0) / 3);
    }
  }
  return tris;
}

/** Largest texture dimension in the file (0 when untextured). */
export function maxTextureSize(doc: Document): number {
  let max = 0;
  for (const tex of doc.getRoot().listTextures()) {
    const image = tex.getImage();
    const size = image ? ImageUtils.getSize(image, tex.getMimeType()) : null;
    if (size) max = Math.max(max, size[0], size[1]);
  }
  return max;
}

export const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;
