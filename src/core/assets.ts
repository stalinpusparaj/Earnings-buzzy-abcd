import {
  Box3,
  Color,
  DataTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  Vector3,
  type ColorRepresentation,
  type Material,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Shared 3-step toon ramp (brief §4) used by every material in the game.
const ramp = new DataTexture(new Uint8Array([150, 210, 255]), 3, 1, RedFormat);
ramp.minFilter = NearestFilter;
ramp.magFilter = NearestFilter;
ramp.generateMipmaps = false;
ramp.needsUpdate = true;
export const toonRamp = ramp;

const colorMats = new Map<string, MeshToonMaterial>();

/** Cached solid-colour toon material for procedural meshes. Marked shared so dispose() skips it. */
export function toon(color: ColorRepresentation): MeshToonMaterial {
  const key = new Color(color).getHexString();
  let mat = colorMats.get(key);
  if (!mat) {
    mat = new MeshToonMaterial({ color, gradientMap: ramp });
    mat.userData.shared = true;
    colorMats.set(key, mat);
  }
  return mat;
}

/** Toon material that reads per-vertex colours (merged procedural models: one draw call each). */
export const vertexToon = new MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
vertexToon.userData.shared = true;

const loader = new GLTFLoader();
const cache = new Map<string, Promise<Group>>();
const modelUrl = (id: string) => `${import.meta.env.BASE_URL}assets/models/${id}.glb`;

function toToon(mat: Material): Material {
  if (!(mat instanceof MeshStandardMaterial)) return mat;
  const out = new MeshToonMaterial({ map: mat.map, color: mat.color, gradientMap: ramp, transparent: mat.transparent, opacity: mat.opacity });
  out.userData.shared = true;
  if (out.map) out.map.userData.shared = true;
  mat.dispose();
  return out;
}

/**
 * Loads a GLB once and returns a normalised template: 1 unit tall, feet on y=0,
 * centred on x/z, facing +Z, every material converted to toon.
 */
export function loadModel(id: string): Promise<Group> {
  let p = cache.get(id);
  if (!p) {
    p = loader.loadAsync(modelUrl(id)).then((gltf) => {
      const inner = gltf.scene;
      inner.traverse((o) => {
        if (o instanceof Mesh) {
          o.material = Array.isArray(o.material) ? o.material.map(toToon) : toToon(o.material);
          o.userData.shared = true;
        }
      });
      const box = new Box3().setFromObject(inner);
      const size = box.getSize(new Vector3());
      const centre = box.getCenter(new Vector3());
      inner.position.set(-centre.x, -box.min.y, -centre.z);
      const wrapper = new Group();
      wrapper.add(inner);
      wrapper.scale.setScalar(1 / Math.max(size.y, 1e-6));
      wrapper.userData.footprint = Math.max(size.x, size.z) / Math.max(size.y, 1e-6);
      return wrapper;
    });
    cache.set(id, p);
  }
  return p;
}

/** A fresh instance of a model, `height` units tall. Geometry and materials are shared with the cache. */
export async function modelInstance(id: string, height: number): Promise<Group> {
  const template = await loadModel(id);
  const holder = new Group();
  const inst = template.clone(true);
  inst.scale.multiplyScalar(height);
  holder.add(inst);
  holder.userData.modelId = id;
  holder.userData.footprint = (template.userData.footprint as number) * height;
  return holder;
}

export function preload(ids: Iterable<string>, onProgress?: (done: number, total: number) => void): Promise<void> {
  const list = [...new Set(ids)];
  let done = 0;
  return Promise.all(
    list.map((id) =>
      loadModel(id)
        .catch((err: unknown) => console.warn(`model ${id} failed to load`, err))
        .finally(() => onProgress?.(++done, list.length)),
    ),
  ).then(() => undefined);
}

export function setOpacity(obj: Object3D, opacity: number): void {
  obj.traverse((o) => {
    if (o instanceof Mesh && !Array.isArray(o.material)) {
      o.material.transparent = opacity < 1;
      o.material.opacity = opacity;
    }
  });
}
