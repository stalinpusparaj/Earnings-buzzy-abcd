import {
  ConeGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
  Color,
  type BufferGeometry,
} from 'three';
import { toon, vertexToon } from '../core/assets';
import { theme } from '../core/theme';
import { lowPoly, merge, paint, paintFaces, rng, vary } from './geo';

// Programmatic replacements for the rock and bush props (no Higgsfield),
// plus clouds, grass tufts and little flowers to dress the island.

/** Grey low-poly boulder with moss on its upward faces, like the concept art. */
export function makeRock(seed: number, size = 1): Mesh {
  const rand = rng(seed);
  const geo = lowPoly(new IcosahedronGeometry(1, 1), 0.35, seed);
  geo.scale(size * (0.9 + rand() * 0.3), size * (0.55 + rand() * 0.2), size * (0.75 + rand() * 0.25));
  geo.translate(0, size * 0.3, 0);
  paintFaces(geo, (_c, n) => (n.y > 0.55 && rand() < 0.55 ? vary(theme.moss, rand) : vary(theme.rock, rand, 0.05)));
  const mesh = new Mesh(geo, vertexToon);
  mesh.rotation.y = rand() * Math.PI * 2;
  return mesh;
}

/** A round bush: a cluster of faceted green blobs dotted with small flowers. */
export function makeBush(seed: number, size = 1): Mesh {
  const rand = rng(seed);
  const parts: BufferGeometry[] = [];
  const blobs = 4 + Math.floor(rand() * 3);
  const centres: Vector3[] = [];
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + rand() * 0.4;
    const r = i === 0 ? 0 : 0.45 + rand() * 0.2;
    const s = (i === 0 ? 0.75 : 0.5 + rand() * 0.2) * size;
    const c = new Vector3(Math.cos(a) * r * size, (i === 0 ? 0.75 : 0.5 + rand() * 0.2) * size, Math.sin(a) * r * size);
    centres.push(c);
    const g = lowPoly(new IcosahedronGeometry(1, 1), 0.18, seed + i);
    g.scale(s, s * 0.9, s);
    g.translate(c.x, c.y, c.z);
    paintFaces(g, () => vary(theme.grass, rand, 0.07));
    parts.push(g);
  }
  // Flowers sit on the blob surfaces.
  const flowerCount = 4 + Math.floor(rand() * 4);
  for (let i = 0; i < flowerCount; i++) {
    const c = centres[Math.floor(rand() * centres.length)];
    const dir = new Vector3(rand() - 0.5, 0.4 + rand() * 0.6, rand() - 0.5 + 0.5).normalize();
    const p = c.clone().add(dir.multiplyScalar(0.62 * size));
    const petal = paint(new IcosahedronGeometry(0.12 * size, 0), theme.petals[(seed + i) % theme.petals.length]);
    petal.translate(p.x, p.y, p.z);
    const centre = paint(new IcosahedronGeometry(0.06 * size, 0), theme.pollen);
    centre.translate(p.x + dir.x * 0.08, p.y + dir.y * 0.08, p.z + dir.z * 0.08);
    parts.push(petal, centre);
  }
  return new Mesh(merge(parts), vertexToon);
}

/** A soft flat-bottomed cloud of merged blobs. */
export function makeCloud(seed: number, size = 1): Mesh {
  const rand = rng(seed);
  const parts: BufferGeometry[] = [];
  const n = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const s = (0.8 + rand() * 0.7) * size;
    const g = lowPoly(new IcosahedronGeometry(1, 1), 0.12, seed * 7 + i);
    g.scale(s * 1.2, s * 0.8, s);
    g.translate((i - n / 2) * 1.1 * size, rand() * 0.5 * size, (rand() - 0.5) * size);
    paintFaces(g, (_c, nrm) => (nrm.y < -0.3 ? '#E4F1FB' : theme.cloud));
    parts.push(g);
  }
  return new Mesh(merge(parts), vertexToon);
}

export type Scatter = { x: number; z: number; scale: number; rot: number };

/** Grass tufts: one instanced mesh for hundreds of blades (one draw call). */
export function makeGrassTufts(spots: Scatter[]): InstancedMesh {
  const blade = new ConeGeometry(0.1, 0.45, 4, 1);
  blade.translate(0, 0.22, 0);
  const mesh = new InstancedMesh(blade, toon(theme.grassDark), spots.length * 3);
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  let i = 0;
  for (const s of spots) {
    for (let k = 0; k < 3; k++) {
      const tilt = new Quaternion().setFromAxisAngle(new Vector3(Math.cos(k * 2.1), 0, Math.sin(k * 2.1)), 0.3);
      q.setFromAxisAngle(up, s.rot + k).multiply(tilt);
      m.compose(new Vector3(s.x + Math.cos(k * 2.1) * 0.08, 0, s.z + Math.sin(k * 2.1) * 0.08), q, new Vector3(s.scale, s.scale * (0.8 + k * 0.2), s.scale));
      mesh.setMatrixAt(i++, m);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/** Little five-petal flowers, tinted per instance from the petal palette. */
export function makeFlowers(spots: Scatter[], seed: number): InstancedMesh {
  const parts: BufferGeometry[] = [];
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2;
    const g = paint(new SphereGeometry(0.11, 6, 4), '#FFFFFF');
    g.scale(1, 0.45, 1);
    g.translate(Math.cos(a) * 0.12, 0.32, Math.sin(a) * 0.12);
    parts.push(g);
  }
  const centre = paint(new SphereGeometry(0.08, 6, 4), theme.pollen);
  centre.translate(0, 0.36, 0);
  const stem = paint(new ConeGeometry(0.03, 0.32, 4), theme.grassDark);
  stem.translate(0, 0.16, 0);
  parts.push(centre, stem);
  const mesh = new InstancedMesh(merge(parts), vertexToon, spots.length);
  const rand = rng(seed);
  const dummy = new Object3D();
  spots.forEach((s, i) => {
    dummy.position.set(s.x, 0, s.z);
    dummy.rotation.set(0, s.rot, 0);
    dummy.scale.setScalar(s.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, new Color(theme.petals[Math.floor(rand() * theme.petals.length)]).lerp(new Color('#ffffff'), 0.15));
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
