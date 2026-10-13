import { Mesh, Points, Sprite, type Material, type Object3D, type Texture } from 'three';

function disposeMaterial(mat: Material): void {
  if (mat.userData.shared) return;
  for (const value of Object.values(mat)) {
    const tex = value as Texture | null;
    if (tex && typeof tex === 'object' && (tex as Texture).isTexture && !tex.userData.shared) tex.dispose();
  }
  mat.dispose();
}

/**
 * Removes an object and frees its GPU resources. Anything marked `userData.shared`
 * (cached GLB geometry, shared materials) is left alone so other instances keep working.
 */
export function disposeObject(root: Object3D): void {
  root.removeFromParent();
  root.traverse((o) => {
    if (o instanceof Mesh || o instanceof Points || o instanceof Sprite) {
      if (o.userData.shared) return; // cached GLB mesh: geometry, materials and textures stay alive
      if (!o.geometry.userData.shared) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) disposeMaterial(m);
    }
  });
}
